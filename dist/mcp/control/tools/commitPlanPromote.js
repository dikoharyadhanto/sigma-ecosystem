"use strict";
// Stage F (W2 batch, continued) — sigma_commit_plan_promote. Mirrors
// commitIntentAmendment.ts. `id`, `title`, `focus` must be re-supplied and
// are checked to hash-match both the ticket's frozen arguments_hash and the
// approval's.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommitPlanPromoteTool = registerCommitPlanPromoteTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const planPromoteService_1 = require("../../../services/planPromoteService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerCommitPlanPromoteTool(server) {
    server.registerTool('sigma_commit_plan_promote', {
        title: 'Commit an approved plan promote',
        description: 'Promotes the pending plan frozen by operation_ticket_id into the official FMN-PLAN DRAFT queue with ' +
            'an assigned version — the MCP control-plane equivalent of `sigma plan promote`. Requires a Director ' +
            'approval record for that exact ticket, recorded via the trusted local CLI (`sigma control approve ' +
            '<ticket_id>`). `id`/`title`/`focus` must match what was frozen at prepare time exactly. The promoted ' +
            'document is structurally validated after promotion; `doc_report.ok` in the result says whether it ' +
            'still needs fixing before `sigma_commit_plan_lock` — an invalid result does not roll the promotion ' +
            'back, matching the CLI. The approval is consumed on a successful commit and cannot be reused. FMN role only.',
        inputSchema: {
            operation_ticket_id: zod_1.z.string().min(1),
            approval_id: zod_1.z.string().min(1),
            id: zod_1.z.string().min(1),
            title: zod_1.z.string().min(1),
            focus: zod_1.z.string().min(1),
            idempotency_key: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const preBinding = (0, shared_1.getBinding)();
        const preTicket = preBinding.root ? (0, controlStore_1.readTicket)(preBinding.root, args.operation_ticket_id) : null;
        return (0, shared_2.respondControlWrite)({
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
                ...(0, planPromoteService_1.planPromoteTransactionFiles)(root, args.id),
                (0, controlStore_1.ticketPath)(root, args.operation_ticket_id),
                (0, controlStore_1.approvalPath)(root, args.approval_id),
            ],
            checkPreconditions: (root) => {
                const binding = (0, shared_1.getBinding)();
                const argsHash = (0, shared_2.stableHash)({ id: args.id, title: args.title, focus: args.focus });
                const ticket = (0, controlStore_1.readTicket)(root, args.operation_ticket_id);
                if (!ticket || ticket.project_id !== binding.projectId) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
                }
                if (ticket.operation_id !== 'plan_promote') {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'That ticket is not a plan_promote ticket.');
                }
                if (ticket.consumed_at) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, 'This operation ticket has already been consumed.');
                }
                if (new Date(ticket.expires_at).getTime() < Date.now()) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_STATE, 'This operation ticket has expired. Prepare a new one.');
                }
                if (ticket.arguments_hash !== argsHash) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The supplied id/title/focus do not match what this ticket was prepared with.');
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
                const { data: chain } = (0, chain_1.readActiveChain)(root);
                const pending = chain.plan.pending.find(p => p.id === args.id);
                if (!ticket.target || !pending || ticket.target.version !== args.id) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, "The pending plan no longer matches this ticket's target.");
                }
                const doc = (0, artifactPath_1.readCanonicalPendingPlanFile)(root, args.id, pending.file);
                if (!doc.present || doc.sha256 !== ticket.target.sha256) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, 'The pending plan file has changed since this ticket was prepared.');
                }
            },
        }, (root) => {
            const result = (0, planPromoteService_1.promotePlanUseCase)(root, args.id, args.title, args.focus);
            const consumedAt = new Date().toISOString();
            (0, controlStore_1.markTicketConsumed)(root, args.operation_ticket_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('plan_promote_after_ticket_consumed');
            (0, controlStore_1.markApprovalConsumed)(root, args.approval_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('plan_promote_after_approval_consumed');
            return {
                chainVersion: result.chainVersion,
                version: result.version,
                newRelPath: result.newRelPath,
                doc_report: result.docReport,
                operation_ticket_id: args.operation_ticket_id,
                approval_id: args.approval_id,
            };
        });
    });
}
//# sourceMappingURL=commitPlanPromote.js.map