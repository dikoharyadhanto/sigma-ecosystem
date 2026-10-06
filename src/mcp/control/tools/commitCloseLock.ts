// Stage F (W2 batch, continued) — sigma_commit_close_lock. Second half of
// the two-stage transition, mirroring commitPlanLock.ts. No business
// argument to re-supply.

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
import { lockCloseUseCase, closeLockTransactionFiles } from '../../../services/closeLockService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite } from '../shared';

export function registerCommitCloseLockTool(server: McpServer): void {
  server.registerTool(
    'sigma_commit_close_lock',
    {
      title: 'Commit an approved close-lock',
      description:
        'Locks the DRAFT DIR-CLOSE frozen by operation_ticket_id (lifecycle -> CLOSED), auto-locking a ' +
        'still-DRAFT ROADMAP as a side effect — the MCP control-plane equivalent of `sigma close lock`. ' +
        'Requires a Director approval record for that exact ticket, recorded via the trusted local CLI ' +
        '(`sigma control approve <ticket_id>`). The approval is consumed on a successful commit and cannot be ' +
        'reused. AUD role only.',
      inputSchema: {
        operation_ticket_id: z.string().min(1),
        approval_id: z.string().min(1),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { operation_ticket_id: string; approval_id: string; idempotency_key: string }) => {
      const preBinding = getBinding();
      const preTicket = preBinding.root ? readTicket(preBinding.root, args.operation_ticket_id) : null;

      return respondControlWrite(
        {
          tool: 'sigma_commit_close_lock',
          operationId: 'close_lock_commit',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
          },
          allowedRoles: ['AUD'],
          operationTicketId: args.operation_ticket_id,
          approvalId: args.approval_id,
          ...(preTicket?.target?.sha256 ? { artifactHashBefore: preTicket.target.sha256 } : {}),
          transactionFiles: (root) => [
            ...closeLockTransactionFiles(root),
            ticketPath(root, args.operation_ticket_id),
            approvalPath(root, args.approval_id),
          ],
          checkPreconditions: (root) => {
            const binding = getBinding();

            const ticket = readTicket(root, args.operation_ticket_id);
            if (!ticket || ticket.project_id !== binding.projectId) {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
            }
            if (ticket.operation_id !== 'close_lock') {
              throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'That ticket is not a close_lock ticket.');
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
            if (!ticket.target || !chain.close || chain.close.version !== ticket.target.version || chain.close.state !== 'DRAFT' || !chain.close.file) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, "The active DIR-CLOSE no longer matches this ticket's target.");
            }
            const doc = readCanonicalArtifactFile(root, 'close', chain.close.version, chain.close.file);
            if (!doc.present || doc.sha256 !== ticket.target.sha256) {
              throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, 'The DRAFT document has changed since this ticket was prepared.');
            }
          },
        },
        (root) => {
          const result = lockCloseUseCase(root);
          const consumedAt = new Date().toISOString();
          markTicketConsumed(root, args.operation_ticket_id, consumedAt);
          controlTestFailpoint('close_lock_after_ticket_consumed');
          markApprovalConsumed(root, args.approval_id, consumedAt);
          controlTestFailpoint('close_lock_after_approval_consumed');
          return {
            chainVersion: result.chainVersion,
            version: result.version,
            roadmapLocked: result.roadmapLocked,
            operation_ticket_id: args.operation_ticket_id,
            approval_id: args.approval_id,
          };
        }
      );
    }
  );
}
