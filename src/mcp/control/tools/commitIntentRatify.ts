// Stage D pilot — sigma_commit_intent_ratify. Second half of the two-stage
// transition: validates a Director approval record against the operation
// ticket it references, re-verifies live state/artifact against what the
// ticket froze (the world may have moved since prepare), then performs the
// same ratify use-case `sigma intent ratify` (CLI) uses
// (src/services/intentRatifyService.ts). On success, both the ticket and the
// approval are marked consumed — single-use, matching plan §10.2.
//
// Error code mapping onto the frozen ERROR_CODES vocabulary (contract.ts
// declares that Stage C/D may not invent variants):
//   unknown/foreign/wrong-type ticket        -> INVALID_OPERATION
//   ticket expired                           -> STALE_STATE
//   ticket already consumed                  -> APPROVAL_MISMATCH
//   no approval record for approval_id       -> APPROVAL_REQUIRED
//   approval doesn't reference this ticket,
//     wrong operation/arguments/target artifact
//     type+version+hash/state, decision is
//     "reject", already consumed, or expired -> APPROVAL_MISMATCH
//   live state_revision moved                -> STALE_STATE
//   live intent no longer matches the ticket's
//     target (version or document hash)      -> STALE_ARTIFACT

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { readCanonicalArtifactFile } from '../../artifactPath';
import {
  readTicket,
  readApproval,
  markTicketConsumed,
  markApprovalConsumed,
  ticketPath,
  approvalPath,
  controlTestFailpoint,
} from '../../../engine/controlStore';
import { ratifyIntentDraft, ratifyIntentDraftTransactionFiles } from '../../../services/intentRatifyService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite } from '../shared';

export function registerCommitIntentRatifyTool(server: McpServer): void {
  server.registerTool(
    'sigma_commit_intent_ratify',
    {
      title: 'Commit an approved intent ratify',
      description:
        'Ratifies the DIR-INTENT DRAFT frozen by operation_ticket_id, opening Gate 1 — the MCP control-plane ' +
        'equivalent of `sigma intent ratify`. Requires a Director approval record for that exact ticket, ' +
        'recorded via the trusted local CLI (`sigma control approve <ticket_id>`); a chat/runtime confirmation ' +
        'is never accepted as approval. The approval is consumed on a successful commit and cannot be reused. ' +
        'ARC role only.',
      inputSchema: {
        operation_ticket_id: z.string().min(1),
        approval_id: z.string().min(1),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { operation_ticket_id: string; approval_id: string; idempotency_key: string }) => {
      // Non-authoritative pre-read, purely to annotate the audit trail with
      // the artifact hash this commit is about (plan §17's
      // artifact_hash_before). The REAL check against this same ticket
      // happens again inside checkPreconditions, under the lock — a stale
      // or missing value here only means a slightly less informative audit
      // line, never a bypassed check.
      const preBinding = getBinding();
      const preTicket = preBinding.root ? readTicket(preBinding.root, args.operation_ticket_id) : null;
      // Shared between checkPreconditions and mutate below (same closure,
      // both run inside the same lock acquisition, checkPreconditions
      // always first) — avoids a second readTicket() call in mutate() just
      // to recover the same target for the audit's artifact_hash_after.
      let verifiedTicketTarget: { artifact: string; version: string; sha256: string } | null = null;

      return respondControlWrite(
        {
          tool: 'sigma_commit_intent_ratify',
          operationId: 'intent_ratify_commit',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
          },
          allowedRoles: ['ARC'],
          operationTicketId: args.operation_ticket_id,
          approvalId: args.approval_id,
          ...(preTicket?.target?.sha256 ? { artifactHashBefore: preTicket.target.sha256 } : {}),
          transactionFiles: (root) => [
            ...ratifyIntentDraftTransactionFiles(root),
            ticketPath(root, args.operation_ticket_id),
            approvalPath(root, args.approval_id),
          ],
          checkPreconditions: (root) => {
            const binding = getBinding();

            const ticket = readTicket(root, args.operation_ticket_id);
            if (!ticket || ticket.project_id !== binding.projectId) {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
            }
            if (ticket.operation_id !== 'intent_ratify') {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'That ticket is not an intent_ratify ticket.');
            }
            if (ticket.consumed_at) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'This operation ticket has already been consumed.');
            }
            if (new Date(ticket.expires_at).getTime() < Date.now()) {
              throw new McpQueryError(ERROR_CODES.STALE_STATE, 'This operation ticket has expired. Prepare a new one.');
            }

            const approval = readApproval(root, args.approval_id);
            if (!approval) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_REQUIRED, 'No approval record found for approval_id.');
            }
            if (approval.project_id !== binding.projectId || approval.operation_ticket_id !== ticket.operation_ticket_id) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'That approval does not reference this operation ticket.');
            }
            if (approval.operation_id !== ticket.operation_id || approval.arguments_hash !== ticket.arguments_hash) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's operation/arguments.");
            }
            if (approval.expected_state_revision !== ticket.expected_state_revision) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's expected state.");
            }
            if (
              approval.target_sha256 !== (ticket.target?.sha256 ?? null) ||
              approval.target_artifact !== (ticket.target?.artifact ?? null) ||
              approval.target_version !== (ticket.target?.version ?? null)
            ) {
              // Codex round 2 finding: an earlier version only compared
              // target_sha256, so an approval recorded against a different
              // artifact type or version but a coincidentally identical hash
              // (e.g. two empty/placeholder documents) would have been
              // accepted. All three fields of the target identity must match.
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's target artifact.");
            }
            if (approval.decision !== 'approve') {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'That approval was recorded as reject, not approve.');
            }
            if (approval.consumed_at) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'This approval has already been consumed.');
            }
            if (new Date(approval.expires_at).getTime() < Date.now()) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'This approval has expired.');
            }

            // The ticket and its approval agree with each other; now check
            // both against the live world, which may have moved since
            // prepare — a valid approval for a stale snapshot is still stale.
            const { revision } = computeStateRevision(root);
            if (revision !== ticket.expected_state_revision) {
              throw new McpQueryError(ERROR_CODES.STALE_STATE, 'Project state has changed since this ticket was prepared.');
            }

            const { data: chain } = readActiveChain(root);
            if (!ticket.target || chain.intent.version !== ticket.target.version || !chain.intent.file) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, "The active intent no longer matches this ticket's target.");
            }
            const doc = readCanonicalArtifactFile(root, 'intent', chain.intent.version, chain.intent.file);
            if (!doc.present || doc.sha256 !== ticket.target.sha256) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, 'The DRAFT document has changed since this ticket was prepared.');
            }

            // Every check above passed against this exact ticket — safe to
            // hand its target to mutate() below without reading it again.
            verifiedTicketTarget = ticket.target;
          },
        },
        (root) => {
          const { chainVersion, version } = ratifyIntentDraft(root);
          const consumedAt = new Date().toISOString();
          markTicketConsumed(root, args.operation_ticket_id, consumedAt);
          controlTestFailpoint('ratify_after_ticket_consumed');
          markApprovalConsumed(root, args.approval_id, consumedAt);
          controlTestFailpoint('ratify_after_approval_consumed');
          // Ratify does not alter the document's bytes, only the chain's
          // governance state, so artifact_hash_after is the same value as
          // before by construction, not a guess.
          return {
            chainVersion,
            version,
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
            ...(verifiedTicketTarget?.sha256 ? { sha256: verifiedTicketTarget.sha256 } : {}),
          };
        }
      );
    }
  );
}
