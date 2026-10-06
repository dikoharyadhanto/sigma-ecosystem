"use strict";
// Stage F (W2 batch, continued) — sigma_prepare_intent_supersede. Same
// re-supply-and-hash-match shape as prepareIntentAmendment.ts for the
// `reason` business argument. Scoped to the active chain only — see
// intentSupersedeService.ts's header for why the MCP surface does not
// expose the CLI's cross-chain `--v`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrepareIntentSupersedeTool = registerPrepareIntentSupersedeTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const intentSupersedeService_1 = require("../../../services/intentSupersedeService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerPrepareIntentSupersedeTool(server) {
    server.registerTool('sigma_prepare_intent_supersede', {
        title: 'Prepare an intent supersede operation ticket',
        description: 'Freezes a supersede of the active chain\'s RATIFIED DIR-INTENT (`reason`) into an operation ticket. ' +
            'Retires the entire chain — cascades SUPERSEDED to its ROADMAP/PLAN/EXEC/CLOSE, listed in `effects[]`. ' +
            'Only the active chain can be targeted (unlike `sigma intent supersede --v`, which is human/CLI-only). ' +
            'Does not supersede anything. The ticket grants no authority by itself: a Director must record an ' +
            'approval via the trusted local CLI (`sigma control approve <ticket_id>`) before ' +
            'sigma_commit_intent_supersede can use it. Tickets expire after 30 minutes. ARC role only.',
        inputSchema: {
            reason: zod_1.z.string().min(1).max(2000),
            idempotency_key: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const operationTicketId = (0, controlStore_1.generateId)('opt');
        return (0, shared_2.respondControlWrite)({
            tool: 'sigma_prepare_intent_supersede',
            operationId: 'intent_supersede_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: { reason: args.reason },
            allowedRoles: ['ARC'],
            checkPreconditions: () => (0, intentSupersedeService_1.assertValidSupersedeReason)(args.reason),
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            if (chain.intent.state !== 'RATIFIED') {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Active DIR-INTENT is "${chain.intent.state}", not RATIFIED. Supersede requires RATIFIED.`);
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
            const cascade = (0, chain_1.previewIntentSupersedeCascade)(chain);
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'intent_supersede',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({ reason: args.reason }),
                target: { artifact: 'intent', version: chain.intent.version, sha256: doc.sha256 },
                expected_state_revision: revision,
                effects: (0, intentSupersedeService_1.describeSupersedeCascadeEffects)(chain, cascade),
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
//# sourceMappingURL=prepareIntentSupersede.js.map