"use strict";
// Stage F (W2 batch) — sigma_prepare_intent_amendment. First half of the
// two-stage governance transition (plan §9.3), same shape as Stage D's
// prepareIntentRatify.ts: "typed prepare -> durable Director approval ->
// typed commit". This tool only freezes an operation ticket; it grants no
// authority and never mutates governance state.
//
// Unlike ratify, this operation carries a business argument (`change`) that
// the commit tool needs again to perform the write — there is no ticket
// field that stores raw business payloads (OperationTicket only stores
// arguments_hash, by design — see engine/controlStore.ts). The same
// `change` text is therefore required again at commit time, and commit's
// checkPreconditions re-hashes it and compares against the ticket's frozen
// arguments_hash (and the approval's) before trusting it — a caller cannot
// silently substitute a different change text than the one Director
// approved.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrepareIntentAmendmentTool = registerPrepareIntentAmendmentTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
const MAX_CHANGE_LENGTH = 2000;
function assertValidChange(change) {
    const trimmed = change.trim();
    if (!trimmed) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, '--change cannot be empty.');
    }
    if (/[|\n\r]/.test(change)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, '--change cannot contain "|" or a newline (breaks the Amendment History table).');
    }
    if (change.length > MAX_CHANGE_LENGTH) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `--change exceeds ${MAX_CHANGE_LENGTH} characters.`);
    }
}
function registerPrepareIntentAmendmentTool(server) {
    server.registerTool('sigma_prepare_intent_amendment', {
        title: 'Prepare an intent amendment operation ticket',
        description: 'Freezes a Director-approved Amendment (free-text `change`) against the active chain\'s RATIFIED ' +
            'DIR-INTENT into an operation ticket. Does not record anything. The ticket grants no authority by ' +
            'itself: a Director must record an approval for it via the trusted local CLI (`sigma control approve ' +
            '<ticket_id>`) before sigma_commit_intent_amendment can use it. Tickets expire after 30 minutes. ARC role only.',
        inputSchema: {
            change: zod_1.z.string().min(1).max(MAX_CHANGE_LENGTH),
            idempotency_key: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const operationTicketId = (0, controlStore_1.generateId)('opt');
        return (0, shared_2.respondControlWrite)({
            tool: 'sigma_prepare_intent_amendment',
            operationId: 'intent_amendment_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: { change: args.change },
            allowedRoles: ['ARC'],
            checkPreconditions: () => assertValidChange(args.change),
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            if (chain.intent.state !== 'RATIFIED') {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Active DIR-INTENT is "${chain.intent.state}", not RATIFIED. Amendment requires RATIFIED.`);
            }
            if (!chain.intent.file) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
            }
            const doc = (0, artifactPath_1.readCanonicalArtifactFile)(root, 'intent', chain.intent.version, chain.intent.file);
            if (!doc.present || !doc.sha256) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The RATIFIED DIR-INTENT file is not present on disk.');
            }
            const { revision } = (0, contract_1.computeStateRevision)(root);
            if (!revision) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
            }
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'intent_amendment',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({ change: args.change }),
                target: { artifact: 'intent', version: chain.intent.version, sha256: doc.sha256 },
                expected_state_revision: revision,
                effects: [
                    `intent.amendments: +1 entry (change: "${args.change}")`,
                    'intent.certified_doc_sha256: recomputed after Section 14 (Amendment History) re-render',
                ],
                authority: 'director',
                issued_at: now.toISOString(),
                expires_at: new Date(now.getTime() + controlStore_1.TICKET_TTL_MS).toISOString(),
                consumed_at: null,
            };
            (0, controlStore_1.writeTicket)(root, ticket);
            return {
                operation_ticket_id: ticket.operation_ticket_id,
                operation_id: ticket.operation_id,
                target: ticket.target,
                effects: ticket.effects,
                expected_state_revision: ticket.expected_state_revision,
                expires_at: ticket.expires_at,
            };
        });
    });
}
//# sourceMappingURL=prepareIntentAmendment.js.map