"use strict";
// Stage F (W2 batch) — sigma_prepare_plan_lock. Same two-stage shape as
// Stage D's prepareIntentRatify.ts. Unlike intent_amendment/intent_score,
// `version` needs no re-supply-and-hash-match discipline at commit: it is a
// structural selector (which DRAFT to lock), fully captured by the ticket's
// own `target.version` once resolved — there is no free-text content to
// bind separately.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPreparePlanLockTool = registerPreparePlanLockTool;
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const docCheck_1 = require("../../../utils/docCheck");
const planLockService_1 = require("../../../services/planLockService");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerPreparePlanLockTool(server) {
    server.registerTool('sigma_prepare_plan_lock', {
        title: 'Prepare a plan lock operation ticket',
        description: 'Freezes the active chain\'s DRAFT FMN-PLAN (version, document hash, state_revision) into an operation ' +
            'ticket. `version` is required when more than one DRAFT FMN-PLAN is open, optional otherwise. Does not ' +
            'lock anything. The ticket grants no authority by itself: a Director must record an approval via the ' +
            'trusted local CLI (`sigma control approve <ticket_id>`) before sigma_commit_plan_lock can use it. ' +
            'Tickets expire after 30 minutes. FMN role only.',
        inputSchema: {
            version: zod_1.z.string().min(1).optional(),
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
            tool: 'sigma_prepare_plan_lock',
            operationId: 'plan_lock_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: {},
            allowedRoles: ['FMN'],
            checkPreconditions: () => { },
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            let targetVersion;
            try {
                targetVersion = (0, planLockService_1.resolvePlanLockTarget)(chain, args.version);
            }
            catch (e) {
                if (e instanceof planLockService_1.PlanLockError)
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, e.message);
                throw e;
            }
            const entry = chain.plan.versions.find(v => v.version === targetVersion);
            if (!entry?.file) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, `FMN-PLAN ${targetVersion} has no registered file.`);
            }
            const doc = (0, artifactPath_1.readCanonicalArtifactFile)(root, 'plan', targetVersion, entry.file);
            if (!doc.present || !doc.sha256) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The DRAFT FMN-PLAN file is not present on disk — nothing to lock.');
            }
            const report = (0, docCheck_1.validateSigmaDocFile)(path_1.default.join(root, entry.file), 'plan');
            try {
                (0, docCheck_1.ensureSigmaDocEligible)(report, 'plan');
            }
            catch (e) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, e.message);
            }
            const { revision } = (0, contract_1.computeStateRevision)(root);
            if (!revision) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
            }
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'plan_lock',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({}),
                target: { artifact: 'plan', version: targetVersion, sha256: doc.sha256 },
                expected_state_revision: revision,
                effects: [
                    `plan.${targetVersion}.state: DRAFT -> LOCKED`,
                    'gates.gate_2_open: -> true',
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
//# sourceMappingURL=preparePlanLock.js.map