// Stage F (W2 batch) — sigma_commit_intent_amendment. Second half of the
// two-stage transition: validates a Director approval record against the
// operation ticket it references, re-verifies live state/artifact against
// what the ticket froze, then performs the same use-case `sigma intent
// amendment` (CLI) uses (src/services/intentAmendmentService.ts). On
// success, both the ticket and the approval are marked consumed.
//
// `change` must be re-supplied here (see prepareIntentAmendment.ts's header
// for why) and is checked to hash-match both the ticket's frozen
// arguments_hash and the approval's — a caller cannot substitute a
// different change text than the one Director approved.

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
import { recordIntentAmendmentUseCase, intentAmendmentTransactionFiles } from '../../../services/intentAmendmentService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerCommitIntentAmendmentTool(server: McpServer): void {
  server.registerTool(
    'sigma_commit_intent_amendment',
    {
      title: 'Commit an approved intent amendment',
      description:
        'Records the Amendment frozen by operation_ticket_id against the active chain\'s RATIFIED DIR-INTENT ' +
        '— the MCP control-plane equivalent of `sigma intent amendment`. Requires a Director approval record ' +
        'for that exact ticket, recorded via the trusted local CLI (`sigma control approve <ticket_id>`). ' +
        '`change` must match the text frozen at prepare time exactly. The approval is consumed on a successful ' +
        'commit and cannot be reused. ARC role only.',
      inputSchema: {
        operation_ticket_id: z.string().min(1),
        approval_id: z.string().min(1),
        change: z.string().min(1),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { operation_ticket_id: string; approval_id: string; change: string; idempotency_key: string }) => {
      const preBinding = getBinding();
      const preTicket = preBinding.root ? readTicket(preBinding.root, args.operation_ticket_id) : null;

      return respondControlWrite(
        {
          tool: 'sigma_commit_intent_amendment',
          operationId: 'intent_amendment_commit',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
            change: args.change,
          },
          allowedRoles: ['ARC'],
          operationTicketId: args.operation_ticket_id,
          approvalId: args.approval_id,
          ...(preTicket?.target?.sha256 ? { artifactHashBefore: preTicket.target.sha256 } : {}),
          transactionFiles: (root) => [
            ...intentAmendmentTransactionFiles(root),
            ticketPath(root, args.operation_ticket_id),
            approvalPath(root, args.approval_id),
          ],
          checkPreconditions: (root) => {
            const binding = getBinding();
            const changeHash = stableHash({ change: args.change });

            const ticket = readTicket(root, args.operation_ticket_id);
            if (!ticket || ticket.project_id !== binding.projectId) {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
            }
            if (ticket.operation_id !== 'intent_amendment') {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'That ticket is not an intent_amendment ticket.');
            }
            if (ticket.consumed_at) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'This operation ticket has already been consumed.');
            }
            if (new Date(ticket.expires_at).getTime() < Date.now()) {
              throw new McpQueryError(ERROR_CODES.STALE_STATE, 'This operation ticket has expired. Prepare a new one.');
            }
            if (ticket.arguments_hash !== changeHash) {
              throw new McpQueryError(
                ERROR_CODES.INVALID_OPERATION,
                'The supplied `change` does not match the text this ticket was prepared with.'
              );
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

            const { revision } = computeStateRevision(root);
            if (revision !== ticket.expected_state_revision) {
              throw new McpQueryError(ERROR_CODES.STALE_STATE, 'Project state has changed since this ticket was prepared.');
            }

            const { data: chain } = readActiveChain(root);
            if (chain.intent.state !== 'RATIFIED' || !ticket.target || chain.intent.version !== ticket.target.version || !chain.intent.file) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, "The active intent no longer matches this ticket's target.");
            }
            const doc = readCanonicalArtifactFile(root, 'intent', chain.intent.version, chain.intent.file);
            if (!doc.present || doc.sha256 !== ticket.target.sha256) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, 'The RATIFIED document has changed since this ticket was prepared.');
            }
          },
        },
        (root) => {
          const result = recordIntentAmendmentUseCase(root, args.change);
          const consumedAt = new Date().toISOString();
          markTicketConsumed(root, args.operation_ticket_id, consumedAt);
          controlTestFailpoint('amendment_after_ticket_consumed');
          markApprovalConsumed(root, args.approval_id, consumedAt);
          controlTestFailpoint('amendment_after_approval_consumed');
          return {
            chainVersion: result.chainVersion,
            version: result.version,
            amendment_id: result.entry.id,
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
            ...(result.certifiedDocSha256 ? { sha256: result.certifiedDocSha256 } : {}),
          };
        }
      );
    }
  );
}
