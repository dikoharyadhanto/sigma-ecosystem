"use strict";
// Stage F (W2 batch) — sigma_prepare_close_new. Same two-stage shape as
// Stage D's prepareIntentRatify.ts, with one structural difference: this
// operation creates a DIR-CLOSE artifact that does not exist yet, so there
// is no pre-existing document to freeze a sha256 against — `target` is
// null, and staleness is caught entirely by `expected_state_revision`
// (every precondition here is a function of chain.json's own bytes, which
// state_revision already hashes). See closeNewService.ts's header.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrepareCloseNewTool = registerPrepareCloseNewTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const controlStore_1 = require("../../../engine/controlStore");
const closeNewService_1 = require("../../../services/closeNewService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerPrepareCloseNewTool(server) {
    server.registerTool('sigma_prepare_close_new', {
        title: 'Prepare a close-new operation ticket',
        description: 'Freezes the active chain\'s Gate 3/3.5 readiness (state_revision) into an operation ticket for ' +
            'creating a new DIR-CLOSE draft. Does not create anything. The ticket grants no authority by itself: a ' +
            'Director must record an approval via the trusted local CLI (`sigma control approve <ticket_id>`) ' +
            'before sigma_commit_close_new can use it. Tickets expire after 30 minutes. AUD role only.',
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
            tool: 'sigma_prepare_close_new',
            operationId: 'close_new_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: {},
            allowedRoles: ['AUD'],
            checkPreconditions: () => { },
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            (0, closeNewService_1.assertCloseNewEligible)(root, chain);
            const { revision } = (0, contract_1.computeStateRevision)(root);
            if (!revision) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
            }
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'close_new',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({}),
                target: null,
                expected_state_revision: revision,
                effects: [
                    `Creates Sigma/close/DIR-CLOSE-${chain.chain_version}.md (DRAFT)`,
                    'lifecycle_state: BUILD -> CLOSE',
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
//# sourceMappingURL=prepareCloseNew.js.map