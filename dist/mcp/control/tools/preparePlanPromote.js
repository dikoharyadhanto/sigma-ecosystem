"use strict";
// Stage F (W2 batch, continued) — sigma_prepare_plan_promote. Same
// re-supply-and-hash-match shape as prepareIntentAmendment.ts, applied to
// all three business arguments (`id`, `title`, `focus`) together — Director's
// approval must be bound to the exact title/focus that will be written, not
// just permission to promote "id X" with whatever text the caller chooses
// at commit time. Owner role: FMN mechanically, DIRECTOR via approval
// record — see planPromoteService.ts's header.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPreparePlanPromoteTool = registerPreparePlanPromoteTool;
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const planPromoteService_1 = require("../../../services/planPromoteService");
const docCheck_1 = require("../../../utils/docCheck");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerPreparePlanPromoteTool(server) {
    server.registerTool('sigma_prepare_plan_promote', {
        title: 'Prepare a plan promote operation ticket',
        description: 'Freezes the promotion of a pending plan (`id`, `title`, `focus`) into the official FMN-PLAN DRAFT ' +
            'queue with an assigned version into an operation ticket. Does not promote anything. The ticket ' +
            'grants no authority by itself: a Director must record an approval via the trusted local CLI ' +
            '(`sigma control approve <ticket_id>`) before sigma_commit_plan_promote can use it. Tickets expire ' +
            'after 30 minutes. FMN role only.',
        inputSchema: {
            id: zod_1.z.string().min(1),
            title: zod_1.z.string().min(1),
            focus: zod_1.z.string().min(1),
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
            tool: 'sigma_prepare_plan_promote',
            operationId: 'plan_promote_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: { id: args.id, title: args.title, focus: args.focus },
            allowedRoles: ['FMN'],
            checkPreconditions: () => (0, planPromoteService_1.assertValidPromoteArgs)(args.title, args.focus),
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            (0, planPromoteService_1.assertPlanPromoteGatesOpen)(chain);
            let pending;
            try {
                pending = (0, planPromoteService_1.findPendingPlan)(chain, args.id);
            }
            catch (e) {
                if (e instanceof planPromoteService_1.PlanPromoteError)
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, e.message);
                throw e;
            }
            if (!chain.roadmap || chain.roadmap.state === 'SUPERSEDED') {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.GATE_BLOCKED, 'Gate 1.5 blocked: A ROADMAP must exist for this chain to promote a plan. Run: sigma roadmap new');
            }
            const doc = (0, artifactPath_1.readCanonicalPendingPlanFile)(root, args.id, pending.file);
            if (!doc.present || !doc.sha256) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The pending plan file is not present on disk.');
            }
            // Informational only — a structurally malformed pending doc is
            // still promotable (a DRAFT is not required to be lock-eligible),
            // but Director should see this before approving. Re-validated
            // again after the actual promotion in commit's mutate() —
            // content can drift between prepare and commit like anything
            // else this ticket freezes.
            const docReport = (0, docCheck_1.validateSigmaDocFile)(path_1.default.resolve(root, doc.path), 'plan');
            const { revision } = (0, contract_1.computeStateRevision)(root);
            if (!revision) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
            }
            const projectedVersion = (0, chain_1.nextPlanVersion)(chain, chain.intent.version);
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'plan_promote',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({ id: args.id, title: args.title, focus: args.focus }),
                // "plan_pending" (not "plan"): this target has no version yet —
                // `version` here is the pending queue id, not an ArtifactVersion.
                target: { artifact: 'plan_pending', version: args.id, sha256: doc.sha256 },
                expected_state_revision: revision,
                effects: [
                    `plan.pending: -1 entry (id: ${args.id})`,
                    `plan.${projectedVersion}: created (DRAFT, title: "${args.title}")`,
                    `roadmap.${chain.roadmap.version}: Stage Overview re-rendered`,
                    `pending doc structure: ${docReport.ok ? 'valid' : 'INVALID — will promote a malformed DRAFT, see doc_report'}`,
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
                projected_version: projectedVersion,
                doc_report: docReport,
                expected_state_revision: ticket.expected_state_revision,
                expires_at: ticket.expires_at,
            };
        });
    });
}
//# sourceMappingURL=preparePlanPromote.js.map