// Stage F (W2 batch, continued) — sigma_commit_intent_supersede. Mirrors
// commitIntentAmendment.ts. `reason` must be re-supplied and is checked to
// hash-match both the ticket's frozen arguments_hash and the approval's.

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
import { supersedeIntentUseCase, intentSupersedeTransactionFiles } from '../../../services/intentSupersedeService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerCommitIntentSupersedeTool(server: McpServer): void {
  server.registerTool(
    'sigma_commit_intent_supersede',
    {
      title: 'Commit an approved intent supersede',
      description:
        'Supersedes the active chain\'s RATIFIED DIR-INTENT frozen by operation_ticket_id, cascading ' +
        'SUPERSEDED to its ROADMAP/PLAN/EXEC/CLOSE — the MCP control-plane equivalent of `sigma intent ' +
        'supersede` (active chain only). Requires a Director approval record for that exact ticket, recorded ' +
        'via the trusted local CLI (`sigma control approve <ticket_id>`). `reason` must match the text frozen ' +
        'at prepare time exactly. The approval is consumed on a successful commit and cannot be reused. ' +
        'ARC role only.',
      inputSchema: {
        operation_ticket_id: z.string().min(1),
        approval_id: z.string().min(1),
        reason: z.string().min(1),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { operation_ticket_id: string; approval_id: string; reason: string; idempotency_key: string }) => {
      const preBinding = getBinding();
      const preTicket = preBinding.root ? readTicket(preBinding.root, args.operation_ticket_id) : null;

      return respondControlWrite(
        {
          tool: 'sigma_commit_intent_supersede',
          operationId: 'intent_supersede_commit',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
            reason: args.reason,
          },
          allowedRoles: ['ARC'],
          operationTicketId: args.operation_ticket_id,
          approvalId: args.approval_id,
          ...(preTicket?.target?.sha256 ? { artifactHashBefore: preTicket.target.sha256 } : {}),
          transactionFiles: (root) => [
            ...intentSupersedeTransactionFiles(root),
            ticketPath(root, args.operation_ticket_id),
            approvalPath(root, args.approval_id),
          ],
          checkPreconditions: (root) => {
            const binding = getBinding();
            const reasonHash = stableHash({ reason: args.reason });

            const ticket = readTicket(root, args.operation_ticket_id);
            if (!ticket || ticket.project_id !== binding.projectId) {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
            }
            if (ticket.operation_id !== 'intent_supersede') {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'That ticket is not an intent_supersede ticket.');
            }
            if (ticket.consumed_at) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'This operation ticket has already been consumed.');
            }
            if (new Date(ticket.expires_at).getTime() < Date.now()) {
              throw new McpQueryError(ERROR_CODES.STALE_STATE, 'This operation ticket has expired. Prepare a new one.');
            }
            if (ticket.arguments_hash !== reasonHash) {
              throw new McpQueryError(
                ERROR_CODES.INVALID_OPERATION,
                'The supplied `reason` does not match the text this ticket was prepared with.'
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
          const result = supersedeIntentUseCase(root, args.reason);
          const consumedAt = new Date().toISOString();
          markTicketConsumed(root, args.operation_ticket_id, consumedAt);
          controlTestFailpoint('intent_supersede_after_ticket_consumed');
          markApprovalConsumed(root, args.approval_id, consumedAt);
          controlTestFailpoint('intent_supersede_after_approval_consumed');
          return {
            chainVersion: result.chainVersion,
            version: result.version,
            cascaded: {
              roadmap: result.cascade.roadmap ? 1 : 0,
              plan: result.cascade.plan.length,
              exec: result.cascade.exec.length,
              close: result.cascade.close ? 1 : 0,
            },
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
          };
        }
      );
    }
  );
}
