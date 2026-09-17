// Stage F (W2 batch, continued) — sigma_commit_plan_promote. Mirrors
// commitIntentAmendment.ts. `id`, `title`, `focus` must be re-supplied and
// are checked to hash-match both the ticket's frozen arguments_hash and the
// approval's.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { readCanonicalPendingPlanFile } from '../../artifactPath';
import {
  readTicket,
  readApproval,
  markTicketConsumed,
  markApprovalConsumed,
  ticketPath,
  approvalPath,
  controlTestFailpoint,
} from '../../../engine/controlStore';
import { promotePlanUseCase, planPromoteTransactionFiles } from '../../../services/planPromoteService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerCommitPlanPromoteTool(server: McpServer): void {
  server.registerTool(
    'sigma_commit_plan_promote',
    {
      title: 'Commit an approved plan promote',
      description:
        'Promotes the pending plan frozen by operation_ticket_id into the official FMN-PLAN DRAFT queue with ' +
        'an assigned version — the MCP control-plane equivalent of `sigma plan promote`. Requires a Director ' +
        'approval record for that exact ticket, recorded via the trusted local CLI (`sigma control approve ' +
        '<ticket_id>`). `id`/`title`/`focus` must match what was frozen at prepare time exactly. The approval ' +
        'is consumed on a successful commit and cannot be reused. FMN role only.',
      inputSchema: {
        operation_ticket_id: z.string().min(1),
        approval_id: z.string().min(1),
        id: z.string().min(1),
        title: z.string().min(1),
        focus: z.string().min(1),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: {
      operation_ticket_id: string; approval_id: string; id: string; title: string; focus: string; idempotency_key: string;
    }) => {
      const preBinding = getBinding();
      const preTicket = preBinding.root ? readTicket(preBinding.root, args.operation_ticket_id) : null;

      return respondControlWrite(
        {
          tool: 'sigma_commit_plan_promote',
          operationId: 'plan_promote_commit',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
            id: args.id,
            title: args.title,
            focus: args.focus,
          },
          allowedRoles: ['FMN'],
          operationTicketId: args.operation_ticket_id,
          approvalId: args.approval_id,
          ...(preTicket?.target?.sha256 ? { artifactHashBefore: preTicket.target.sha256 } : {}),
          transactionFiles: (root) => [
            ...planPromoteTransactionFiles(root, args.id),
            ticketPath(root, args.operation_ticket_id),
            approvalPath(root, args.approval_id),
          ],
          checkPreconditions: (root) => {
            const binding = getBinding();
            const argsHash = stableHash({ id: args.id, title: args.title, focus: args.focus });

            const ticket = readTicket(root, args.operation_ticket_id);
            if (!ticket || ticket.project_id !== binding.projectId) {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
            }
            if (ticket.operation_id !== 'plan_promote') {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'That ticket is not a plan_promote ticket.');
            }
            if (ticket.consumed_at) {
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, 'This operation ticket has already been consumed.');
            }
            if (new Date(ticket.expires_at).getTime() < Date.now()) {
              throw new McpQueryError(ERROR_CODES.STALE_STATE, 'This operation ticket has expired. Prepare a new one.');
            }
            if (ticket.arguments_hash !== argsHash) {
              throw new McpQueryError(
                ERROR_CODES.INVALID_OPERATION,
                'The supplied id/title/focus do not match what this ticket was prepared with.'
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
              throw new McpQueryError(ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's target.");
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
            const pending = chain.plan.pending.find(p => p.id === args.id);
            if (!ticket.target || !pending || ticket.target.version !== args.id) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, "The pending plan no longer matches this ticket's target.");
            }
            const doc = readCanonicalPendingPlanFile(root, args.id, pending.file);
            if (!doc.present || doc.sha256 !== ticket.target.sha256) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, 'The pending plan file has changed since this ticket was prepared.');
            }
          },
        },
        (root) => {
          const result = promotePlanUseCase(root, args.id, args.title, args.focus);
          const consumedAt = new Date().toISOString();
          markTicketConsumed(root, args.operation_ticket_id, consumedAt);
          controlTestFailpoint('plan_promote_after_ticket_consumed');
          markApprovalConsumed(root, args.approval_id, consumedAt);
          controlTestFailpoint('plan_promote_after_approval_consumed');
          return {
            chainVersion: result.chainVersion,
            version: result.version,
            newRelPath: result.newRelPath,
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
          };
        }
      );
    }
  );
}
