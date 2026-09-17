"use strict";
// Stage F (W2 batch) — sigma_commit_close_new. Second half of the two-stage
// transition, mirroring commitIntentRatify.ts. `target` is null on this
// ticket (see prepareCloseNew.ts's header) — staleness is caught by
// `expected_state_revision` alone, and createCloseDraftUseCase() re-runs
// every business precondition (Gate 3, Gate 3.5, humanize gate) itself
// before writing anything, so there is no separate live-precondition check
// here beyond the state_revision match.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommitCloseNewTool = registerCommitCloseNewTool;
const zod_1 = require("zod");
const controlStore_1 = require("../../../engine/controlStore");
const closeNewService_1 = require("../../../services/closeNewService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerCommitCloseNewTool(server) {
    server.registerTool('sigma_commit_close_new', {
        title: 'Commit an approved close-new',
        description: 'Creates the DIR-CLOSE draft frozen by operation_ticket_id — the MCP control-plane equivalent of ' +
            '`sigma close new`. Requires a Director approval record for that exact ticket, recorded via the ' +
            'trusted local CLI (`sigma control approve <ticket_id>`). The approval is consumed on a successful ' +
            'commit and cannot be reused. AUD role only.',
        inputSchema: {
            operation_ticket_id: zod_1.z.string().min(1),
            approval_id: zod_1.z.string().min(1),
            idempotency_key: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        return (0, shared_2.respondControlWrite)({
            tool: 'sigma_commit_close_new',
            operationId: 'close_new_commit',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: {
                operation_ticket_id: args.operation_ticket_id,
                approval_id: args.approval_id,
            },
            allowedRoles: ['AUD'],
            operationTicketId: args.operation_ticket_id,
            approvalId: args.approval_id,
            transactionFiles: (root) => [
                ...(0, closeNewService_1.closeNewTransactionFiles)(root),
                (0, controlStore_1.ticketPath)(root, args.operation_ticket_id),
                (0, controlStore_1.approvalPath)(root, args.approval_id),
            ],
            checkPreconditions: (root) => {
                const binding = (0, shared_1.getBinding)();
                const ticket = (0, controlStore_1.readTicket)(root, args.operation_ticket_id);
                if (!ticket || ticket.project_id !== binding.projectId) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
                }
                if (ticket.operation_id !== 'close_new') {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'That ticket is not a close_new ticket.');
                }
                if (ticket.consumed_at) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, 'This operation ticket has already been consumed.');
                }
                if (new Date(ticket.expires_at).getTime() < Date.now()) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_STATE, 'This operation ticket has expired. Prepare a new one.');
                }
                const approval = (0, controlStore_1.readApproval)(root, args.approval_id);
                if (!approval) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_REQUIRED, 'No approval record found for approval_id.');
                }
                if (approval.project_id !== binding.projectId || approval.operation_ticket_id !== ticket.operation_ticket_id) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, 'That approval does not reference this operation ticket.');
                }
                if (approval.operation_id !== ticket.operation_id || approval.arguments_hash !== ticket.arguments_hash) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's operation/arguments.");
                }
                if (approval.expected_state_revision !== ticket.expected_state_revision) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's expected state.");
                }
                if (approval.target_sha256 !== (ticket.target?.sha256 ?? null) ||
                    approval.target_artifact !== (ticket.target?.artifact ?? null) ||
                    approval.target_version !== (ticket.target?.version ?? null)) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's target.");
                }
                if (approval.decision !== 'approve') {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, 'That approval was recorded as reject, not approve.');
                }
                if (approval.consumed_at) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, 'This approval has already been consumed.');
                }
                if (new Date(approval.expires_at).getTime() < Date.now()) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, 'This approval has expired.');
                }
                const { revision } = (0, contract_1.computeStateRevision)(root);
                if (revision !== ticket.expected_state_revision) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_STATE, 'Project state has changed since this ticket was prepared.');
                }
            },
        }, (root) => {
            const result = (0, closeNewService_1.createCloseDraftUseCase)(root);
            const consumedAt = new Date().toISOString();
            (0, controlStore_1.markTicketConsumed)(root, args.operation_ticket_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('close_new_after_ticket_consumed');
            (0, controlStore_1.markApprovalConsumed)(root, args.approval_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('close_new_after_approval_consumed');
            return {
                chainVersion: result.chainVersion,
                version: result.version,
                relPath: result.relPath,
                operation_ticket_id: args.operation_ticket_id,
                approval_id: args.approval_id,
            };
        });
    });
}
//# sourceMappingURL=commitCloseNew.js.map