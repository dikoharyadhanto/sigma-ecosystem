"use strict";
// Stage F (W2 batch, continued) — sigma_prepare_plan_supersede. Same
// re-supply-and-hash-match shape as prepareIntentAmendment.ts for the
// `reason` business argument; `version` is a structural selector frozen via
// `ticket.target.version` (same reasoning as preparePlanLock.ts).
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPreparePlanSupersedeTool = registerPreparePlanSupersedeTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const planSupersedeService_1 = require("../../../services/planSupersedeService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerPreparePlanSupersedeTool(server) {
    server.registerTool('sigma_prepare_plan_supersede', {
        title: 'Prepare a plan supersede operation ticket',
        description: 'Freezes a supersede of an FMN-PLAN version (DRAFT or LOCKED) on the active chain, plus its `reason`, ' +
            'into an operation ticket. Auto-supersedes any linked non-final DEV-EXEC — listed in `effects[]`. Does ' +
            'not supersede anything. The ticket grants no authority by itself: a Director must record an approval ' +
            'via the trusted local CLI (`sigma control approve <ticket_id>`) before sigma_commit_plan_supersede ' +
            'can use it. Tickets expire after 30 minutes. FMN role only.',
        inputSchema: {
            version: zod_1.z.string().min(1),
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
            tool: 'sigma_prepare_plan_supersede',
            operationId: 'plan_supersede_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: { reason: args.reason },
            allowedRoles: ['FMN'],
            checkPreconditions: () => (0, planSupersedeService_1.assertValidPlanSupersedeReason)(args.reason),
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            const entry = chain.plan.versions.find(v => v.version === args.version);
            if (!entry) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `FMN-PLAN ${args.version} not found.`);
            }
            if (entry.state === 'SUPERSEDED') {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `FMN-PLAN ${args.version} is already SUPERSEDED.`);
            }
            if (!entry.file) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, `FMN-PLAN ${args.version} has no registered file.`);
            }
            const doc = (0, artifactPath_1.readCanonicalArtifactFile)(root, 'plan', args.version, entry.file);
            if (!doc.present || !doc.sha256) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The target FMN-PLAN file is not present on disk.');
            }
            const { revision } = (0, contract_1.computeStateRevision)(root);
            if (!revision) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
            }
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'plan_supersede',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({ reason: args.reason }),
                target: { artifact: 'plan', version: args.version, sha256: doc.sha256 },
                expected_state_revision: revision,
                effects: (0, planSupersedeService_1.describePlanSupersedeCascadeEffects)(chain, args.version),
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
//# sourceMappingURL=preparePlanSupersede.js.map