"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerArtifactApprovalTools = registerArtifactApprovalTools;
const zod_1 = require("zod");
const approvalService_1 = require("../../../services/approvalService");
const controlStore_1 = require("../../../engine/controlStore");
const revisions_1 = require("../../../engine/revisions");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function readyReview(root, domain, version) {
    try {
        const review = (0, approvalService_1.approvalReview)(root, domain, version);
        (0, approvalService_1.ensureApprovalReady)(review);
        return review;
    }
    catch (e) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, e.message.split(root).join('.'));
    }
}
function registerArtifactApprovalTools(server, domain) {
    const role = domain === 'plan' ? 'FMN' : 'DEV';
    const prepare = 'sigma_prepare_' + domain + '_approve';
    const commit = 'sigma_commit_' + domain + '_approve';
    server.registerTool(prepare, { title: 'Prepare ' + domain + ' approval', description: 'Freeze artifact, lifecycle, source revisions, full document hashes, ledger/notice and delta review package. Trusted local Director approval required; role ' + role + '.', inputSchema: { version: zod_1.z.string().min(1).optional(), idempotency_key: zod_1.z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (args) => {
        const id = (0, controlStore_1.generateId)('opt');
        return (0, shared_2.respondControlWrite)({ tool: prepare, operationId: domain + '_approve_prepare', guardedWrites: true, idempotencyKey: args.idempotency_key, argumentsForHash: { version: args.version ?? null }, allowedRoles: [role], checkPreconditions: () => { }, transactionFiles: root => [(0, controlStore_1.ticketPath)(root, id)] }, root => {
            const review = readyReview(root, domain, args.version);
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = { operation_ticket_id: id, operation_id: domain + '_approve', project_id: binding.projectId, bound_role: role, arguments_hash: (0, shared_2.stableHash)({ version: review.version, review }), target: { artifact: domain, version: review.version, sha256: review.target_sha256 }, expected_state_revision: (0, contract_1.computeStateRevision)(root).revision, effects: review.effects, authority: 'director', issued_at: now.toISOString(), expires_at: new Date(now.getTime() + controlStore_1.TICKET_TTL_MS).toISOString(), consumed_at: null, review_package: review, dependencies_sha256: review.dependencies_sha256 };
            (0, controlStore_1.writeTicket)(root, ticket);
            return ticket;
        });
    });
    server.registerTool(commit, { title: 'Commit ' + domain + ' approval', description: 'Consume the exact trusted local Director approval after rechecking all frozen dependencies under the shared lease. EXEC approval locks its same-number PLAN/EXEC together.', inputSchema: { operation_ticket_id: zod_1.z.string().min(1), approval_id: zod_1.z.string().min(1), idempotency_key: zod_1.z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (args) => {
        let version = '';
        let dependencies = '';
        return (0, shared_2.respondControlWrite)({ tool: commit, operationId: domain + '_approve_commit', guardedWrites: true, idempotencyKey: args.idempotency_key, argumentsForHash: { operation_ticket_id: args.operation_ticket_id, approval_id: args.approval_id }, allowedRoles: [role], operationTicketId: args.operation_ticket_id, approvalId: args.approval_id,
            transactionFiles: root => [...(0, approvalService_1.approveArtifactTransactionFiles)(root, domain, version), (0, controlStore_1.ticketPath)(root, args.operation_ticket_id), (0, controlStore_1.approvalPath)(root, args.approval_id)],
            checkPreconditions: root => {
                const ticket = (0, controlStore_1.readTicket)(root, args.operation_ticket_id);
                if (!ticket?.target || ticket.operation_id !== domain + '_approve' || ticket.target.artifact !== domain || ticket.bound_role !== role)
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'Approval ticket operation/role/target mismatch; lock tickets are tombstones.');
                version = ticket.target.version;
                const review = readyReview(root, domain, version);
                dependencies = review.dependencies_sha256;
                if (ticket.target.sha256 !== review.target_sha256 || ticket.dependencies_sha256 !== dependencies)
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, 'Approval artifact/source/dependencies changed; prepare a new ticket.');
                try {
                    (0, revisions_1.validateDirectorTicket)(root, args.operation_ticket_id, args.approval_id, domain + '_approve', version, review.target_sha256, dependencies);
                }
                catch (e) {
                    const message = e.message;
                    throw new errors_1.McpQueryError(message.startsWith('APPROVAL_MISMATCH') ? contract_1.ERROR_CODES.APPROVAL_MISMATCH : contract_1.ERROR_CODES.STALE_STATE, message);
                }
            } }, root => {
            if ((0, approvalService_1.approvalReview)(root, domain, version).dependencies_sha256 !== dependencies)
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, 'Dependencies changed immediately before approval.');
            const result = (0, approvalService_1.approveArtifactUseCase)(root, domain, version, { channel: 'mcp-control', ticket_id: args.operation_ticket_id, approval_id: args.approval_id });
            const time = new Date().toISOString();
            (0, controlStore_1.markTicketConsumed)(root, args.operation_ticket_id, time);
            (0, controlStore_1.controlTestFailpoint)('approval_after_ticket_consumed');
            (0, controlStore_1.markApprovalConsumed)(root, args.approval_id, time);
            (0, controlStore_1.controlTestFailpoint)('approval_after_approval_consumed');
            return { ...result, operation_ticket_id: args.operation_ticket_id, approval_id: args.approval_id };
        });
    });
}
//# sourceMappingURL=approveArtifact.js.map