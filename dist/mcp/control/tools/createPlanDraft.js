"use strict";
// Stage E W1 — sigma_create_plan_draft. Control-plane only; never registered
// on the query server (src/mcp/index.ts does not import this file or
// anything under src/mcp/control/). Mirrors createIntentDraft.ts's wiring
// exactly — see planDraftService.ts for what differs in the shared use case
// itself (RATIFIED-intent + ROADMAP preconditions, array-of-versions target).
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCreatePlanDraftTool = registerCreatePlanDraftTool;
const zod_1 = require("zod");
const planDraftService_1 = require("../../../services/planDraftService");
const shared_1 = require("../shared");
function registerCreatePlanDraftTool(server) {
    server.registerTool('sigma_create_plan_draft', {
        title: 'Create FMN-PLAN draft',
        description: 'Creates a new FMN-PLAN DRAFT under the active chain — the MCP control-plane equivalent of ' +
            '`sigma plan new` (non-pending path only; pending-queue staging is not exposed here). FMN role ' +
            'only. Requires Gate 1 (a RATIFIED DIR-INTENT) and an eligible ROADMAP (exists, not SUPERSEDED); ' +
            'also enforced if the project has notion_humanize_gate enabled. Requires idempotency_key (retried ' +
            'calls with the same key and the same arguments return the original result; same key with ' +
            'different arguments is rejected) and expected_state_revision read from a prior sigma_get_state ' +
            'call on this binding.',
        inputSchema: {
            title: zod_1.z.string().min(1).describe('Stage title written into the ROADMAP Stage Overview table.'),
            focus: zod_1.z.string().min(1).describe('Stage focus summary written into the ROADMAP Stage Overview table.'),
            idempotency_key: zod_1.z.string().min(1),
            expected_state_revision: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => (0, shared_1.respondControlWrite)({
        tool: 'sigma_create_plan_draft',
        operationId: 'plan_create_draft',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: {
            title: args.title,
            focus: args.focus,
        },
        allowedRoles: ['FMN'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        transactionFiles: planDraftService_1.createPlanDraftTransactionFiles,
    }, 
    // createPlanDraft() throws PlanDraftError, which carries a frozen
    // ERROR_CODES value in .code — respondControlWrite()'s codeOf()
    // unwraps it structurally, same as IntentDraftError/McpQueryError.
    (root) => (0, planDraftService_1.createPlanDraft)({
        projectRoot: root,
        title: args.title,
        focus: args.focus,
    })));
}
//# sourceMappingURL=createPlanDraft.js.map