"use strict";
// Stage F (W2 batch) — sigma_prepare_intent_score. Same two-stage shape as
// prepareIntentAmendment.ts, including the "business args must be
// re-supplied and hash-matched at commit" discipline (see that file's
// header) — `score`/`notes` are not stored raw on the ticket.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrepareIntentScoreTool = registerPrepareIntentScoreTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function assertValidScoreArgs(score, notes) {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'score must be an integer between 0 and 100.');
    }
    if (/[|\n\r]/.test(notes)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'notes cannot contain "|" or a newline (breaks the intent-history.md table).');
    }
}
function registerPrepareIntentScoreTool(server) {
    server.registerTool('sigma_prepare_intent_score', {
        title: 'Prepare an intent ARC-score operation ticket',
        description: 'Freezes an ARC Satisfaction Score (`score` 0-100, `notes`) against the active chain\'s RATIFIED ' +
            'DIR-INTENT into an operation ticket. Gate 3.5 precondition for `sigma close new`. Does not record ' +
            'anything. The ticket grants no authority by itself: a Director must record an approval via the ' +
            'trusted local CLI (`sigma control approve <ticket_id>`) before sigma_commit_intent_score can use it. ' +
            'Tickets expire after 30 minutes. ARC role only.',
        inputSchema: {
            score: zod_1.z.number().int().min(0).max(100),
            notes: zod_1.z.string().min(1),
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
            tool: 'sigma_prepare_intent_score',
            operationId: 'intent_score_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: { score: args.score, notes: args.notes },
            allowedRoles: ['ARC'],
            checkPreconditions: () => assertValidScoreArgs(args.score, args.notes),
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            if (chain.intent.state !== 'RATIFIED') {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Active DIR-INTENT is "${chain.intent.state}", not RATIFIED. ARC score requires RATIFIED.`);
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
                operation_id: 'intent_score',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({ score: args.score, notes: args.notes }),
                target: { artifact: 'intent', version: chain.intent.version, sha256: doc.sha256 },
                expected_state_revision: revision,
                effects: [
                    `intent.arc_score: ${chain.intent.arc_score ?? '(unset)'} -> ${args.score}`,
                    `gates.gate_3_5 (close new precondition): ${args.score >= 50 ? 'OPEN' : 'BLOCKED'}`,
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
//# sourceMappingURL=prepareIntentScore.js.map