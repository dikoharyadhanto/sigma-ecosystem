"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommitIntentRatifyTool = registerCommitIntentRatifyTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const intentRatifyService_1 = require("../../../services/intentRatifyService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerCommitIntentRatifyTool(server) {
    server.registerTool('sigma_commit_intent_ratify', {
        title: 'Commit an approved intent ratify',
        description: 'Ratifies the DIR-INTENT DRAFT frozen by operation_ticket_id, opening Gate 1 — the MCP control-plane ' +
            'equivalent of `sigma intent ratify`. Requires a Director approval record for that exact ticket, ' +
            'recorded via the trusted local CLI (`sigma control approve <ticket_id>`); a chat/runtime confirmation ' +
            'is never accepted as approval. The approval is consumed on a successful commit and cannot be reused. ' +
            'ARC role only.',
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
        // Non-authoritative pre-read, purely to annotate the audit trail with
        // the artifact hash this commit is about (plan §17's
        // artifact_hash_before). The REAL check against this same ticket
        // happens again inside checkPreconditions, under the lock — a stale
        // or missing value here only means a slightly less informative audit
        // line, never a bypassed check.
        const preBinding = (0, shared_1.getBinding)();
        const preTicket = preBinding.root ? (0, controlStore_1.readTicket)(preBinding.root, args.operation_ticket_id) : null;
        // Shared between checkPreconditions and mutate below (same closure,
        // both run inside the same lock acquisition, checkPreconditions
        // always first) — avoids a second readTicket() call in mutate() just
        // to recover the same target for the audit's artifact_hash_after.
        let verifiedTicketTarget = null;
        return (0, shared_2.respondControlWrite)({
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
                ...(0, intentRatifyService_1.ratifyIntentDraftTransactionFiles)(root),
                (0, controlStore_1.ticketPath)(root, args.operation_ticket_id),
                (0, controlStore_1.approvalPath)(root, args.approval_id),
            ],
            checkPreconditions: (root) => {
                const binding = (0, shared_1.getBinding)();
                const ticket = (0, controlStore_1.readTicket)(root, args.operation_ticket_id);
                if (!ticket || ticket.project_id !== binding.projectId) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'Unknown operation_ticket_id.');
                }
                if (ticket.operation_id !== 'intent_ratify') {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'That ticket is not an intent_ratify ticket.');
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
                    // Codex round 2 finding: an earlier version only compared
                    // target_sha256, so an approval recorded against a different
                    // artifact type or version but a coincidentally identical hash
                    // (e.g. two empty/placeholder documents) would have been
                    // accepted. All three fields of the target identity must match.
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
                // The ticket and its approval agree with each other; now check
                // both against the live world, which may have moved since
                // prepare — a valid approval for a stale snapshot is still stale.
                const { revision } = (0, contract_1.computeStateRevision)(root);
                if (revision !== ticket.expected_state_revision) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_STATE, 'Project state has changed since this ticket was prepared.');
                }
                const { data: chain } = (0, chain_1.readActiveChain)(root);
                if (!ticket.target || chain.intent.version !== ticket.target.version || !chain.intent.file) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, "The active intent no longer matches this ticket's target.");
                }
                const doc = (0, artifactPath_1.readCanonicalArtifactFile)(root, 'intent', chain.intent.version, chain.intent.file);
                if (!doc.present || doc.sha256 !== ticket.target.sha256) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, 'The DRAFT document has changed since this ticket was prepared.');
                }
                // Every check above passed against this exact ticket — safe to
                // hand its target to mutate() below without reading it again.
                verifiedTicketTarget = ticket.target;
            },
        }, (root) => {
            const { chainVersion, version } = (0, intentRatifyService_1.ratifyIntentDraft)(root);
            const consumedAt = new Date().toISOString();
            (0, controlStore_1.markTicketConsumed)(root, args.operation_ticket_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('ratify_after_ticket_consumed');
            (0, controlStore_1.markApprovalConsumed)(root, args.approval_id, consumedAt);
            (0, controlStore_1.controlTestFailpoint)('ratify_after_approval_consumed');
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
        });
    });
}
//# sourceMappingURL=commitIntentRatify.js.map