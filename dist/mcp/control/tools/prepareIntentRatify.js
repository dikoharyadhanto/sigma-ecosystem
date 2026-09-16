"use strict";
// Stage D pilot — sigma_prepare_intent_ratify. First half of the two-stage
// governance transition (plan §9.3): "typed prepare → durable Director
// approval → typed commit". This tool only freezes an operation ticket; it
// grants no authority (§10.1) and never mutates governance state — the
// ticket file it writes lives under Sigma/.mcp-control/, excluded from
// state_revision, same as Stage C's idempotency store.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrepareIntentRatifyTool = registerPrepareIntentRatifyTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerPrepareIntentRatifyTool(server) {
    server.registerTool('sigma_prepare_intent_ratify', {
        title: 'Prepare an intent ratify operation ticket',
        description: 'Freezes the active chain\'s current DRAFT intent (version, document hash, state_revision) into an ' +
            'operation ticket. Does not ratify anything and does not touch governance state. The ticket grants ' +
            'no authority by itself: a Director must record an approval for it via the trusted local CLI ' +
            '(`sigma control approve <ticket_id>`) before sigma_commit_intent_ratify can use it — a chat/runtime ' +
            'confirmation is never sufficient. Tickets expire after 30 minutes. ARC role only.',
        inputSchema: {
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
            tool: 'sigma_prepare_intent_ratify',
            operationId: 'intent_ratify_prepare',
            idempotencyKey: args.idempotency_key,
            // Ratify takes no business arguments — there is nothing to bind a
            // stale-argument replay to beyond the ticket's own frozen target,
            // so this hashes an empty object rather than nothing.
            argumentsForHash: {},
            allowedRoles: ['ARC'],
            // No precondition to check before writing a ticket — prepare
            // establishes the baseline, it does not compare against one.
            checkPreconditions: () => { },
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            if (chain.intent.state !== 'DRAFT') {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Active DIR-INTENT is "${chain.intent.state}", not DRAFT. Nothing to ratify.`);
            }
            if (!chain.intent.file) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
            }
            const doc = (0, artifactPath_1.readCanonicalArtifactFile)(root, 'intent', chain.intent.version, chain.intent.file);
            if (!doc.present || !doc.sha256) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The registered DRAFT file is not present on disk — nothing to ratify.');
            }
            const { revision } = (0, contract_1.computeStateRevision)(root);
            if (!revision) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
            }
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'intent_ratify',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({}),
                target: { artifact: 'intent', version: chain.intent.version, sha256: doc.sha256 },
                expected_state_revision: revision,
                // plan §10.1's effects[] — fixed for this operation_id (the
                // pilot has exactly one), not computed generically. A future
                // second W2 operation gets its own effects list, not a shared
                // inference engine.
                effects: [
                    `intent.state: DRAFT -> RATIFIED (${chain.intent.version})`,
                    'gates.gate_1_open: false -> true',
                    'lifecycle_state: DESIGN -> BUILD (if not already BUILD)',
                ],
                authority: 'director',
                issued_at: now.toISOString(),
                expires_at: new Date(now.getTime() + controlStore_1.TICKET_TTL_MS).toISOString(),
                consumed_at: null,
            };
            (0, controlStore_1.writeTicket)(root, ticket);
            // Returned to the calling role, whose job is to hand
            // operation_ticket_id to the Director for approval — not to act on
            // it further. No authority travels with this payload.
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
//# sourceMappingURL=prepareIntentRatify.js.map