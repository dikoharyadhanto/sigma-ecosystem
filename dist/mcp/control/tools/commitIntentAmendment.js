"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommitIntentAmendmentTool = registerCommitIntentAmendmentTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const intentAmendmentService_1 = require("../../../services/intentAmendmentService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerCommitIntentAmendmentTool(server) {
    server.registerTool('sigma_commit_intent_amendment', {
        title: 'Commit an approved intent amendment',
        description: 'Records the Amendment frozen by operation_ticket_id against the active chain\'s RATIFIED DIR-INTENT ' +
            '— the MCP control-plane equivalent of `sigma intent amendment`. Requires a Director approval record ' +
            'for that exact ticket, recorded via the trusted local CLI (`sigma control approve <ticket_id>`). ' +
            '`change` must match the text frozen at prepare time exactly. The approval is consumed on a successful ' +
            'commit and cannot be reused. ARC role only.',
        inputSchema: {
            operation_ticket_id: zod_1.z.string().min(1),
            approval_id: zod_1.z.string().min(1),
            change: zod_1.z.string().min(1),
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
                ...(0, intentAmendmentService_1.intentAmendmentTransactionFiles)(root),
                (0, controlStore_1.ticketPath)(root, args.operation_ticket_id),
                (0, controlStore_1.approvalPath)(root, args.approval_id),
            ],
            checkPreconditions: (root) => {
                const binding = (0, shared_1.getBinding)();
                const changeHash = (0, shared_2.stableHash)({ change: args.change });
                const ticket = (0, controlStore_1.readTicket)(root, args.operation_ticket_id);
                if (!ticket || ticket.project_id !== binding.projectId) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
                }
                if (ticket.operation_id !== 'intent_amendment') {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'That ticket is not an intent_amendment ticket.');
                }
                if (ticket.consumed_at) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, 'This operation ticket has already been consumed.');
                }
                if (new Date(ticket.expires_at).getTime() < Date.now()) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_STATE, 'This operation ticket has expired. Prepare a new one.');
                }
                if (ticket.arguments_hash !== changeHash) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The supplied `change` does not match the text this ticket was prepared with.');
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
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.APPROVAL_MISMATCH, "That approval does not match this ticket's target artifact.");
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
                if (chain.intent.state !== 'RATIFIED' || !ticket.target || chain.intent.version !== ticket.target.version || !chain.intent.file) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, "The active intent no longer matches this ticket's target.");
                }
                const doc = (0, artifactPath_1.readCanonicalArtifactFile)(root, 'intent', chain.intent.version, chain.intent.file);
                if (!doc.present || doc.sha256 !== ticket.target.sha256) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, 'The RATIFIED document has changed since this ticket was prepared.');
                }
            },
        }, (root) => {
            const result = (0, intentAmendmentService_1.recordIntentAmendmentUseCase)(root, args.change);
            const consumedAt = new Date().toISOString();
            (0, controlStore_1.markTicketConsumed)(root, args.operation_ticket_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('amendment_after_ticket_consumed');
            (0, controlStore_1.markApprovalConsumed)(root, args.approval_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('amendment_after_approval_consumed');
            return {
                chainVersion: result.chainVersion,
                version: result.version,
                amendment_id: result.entry.id,
                operation_ticket_id: args.operation_ticket_id,
                approval_id: args.approval_id,
                ...(result.certifiedDocSha256 ? { sha256: result.certifiedDocSha256 } : {}),
            };
        });
    });
}
//# sourceMappingURL=commitIntentAmendment.js.map