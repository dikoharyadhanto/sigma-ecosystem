"use strict";
// Stage E W1 — sigma_create_roadmap_draft. Control-plane only. Mirrors
// createPlanDraft.ts's wiring; see roadmapService.ts for what differs about
// the use case itself (chain.roadmap is a single object with no independent
// version counter — always chain.chain_version, unlike plan/exec).
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCreateRoadmapDraftTool = registerCreateRoadmapDraftTool;
const zod_1 = require("zod");
const roadmapService_1 = require("../../../services/roadmapService");
const shared_1 = require("../shared");
function registerCreateRoadmapDraftTool(server) {
    server.registerTool('sigma_create_roadmap_draft', {
        title: 'Create ROADMAP draft',
        description: 'Creates the ROADMAP for the active chain — the MCP control-plane equivalent of `sigma roadmap new`. ' +
            'FMN role only. Requires a RATIFIED DIR-INTENT. Exactly one ROADMAP per chain (non-SUPERSEDED); a ' +
            'DRAFT or LOCKED ROADMAP already existing is rejected. Requires idempotency_key (retried calls with ' +
            'the same key and the same arguments return the original result) and expected_state_revision (from a ' +
            'prior sigma_get_state call on this binding).',
        inputSchema: {
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
        tool: 'sigma_create_roadmap_draft',
        operationId: 'roadmap_create_draft',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: {},
        allowedRoles: ['FMN'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        transactionFiles: roadmapService_1.createRoadmapDraftTransactionFiles,
    }, (root) => (0, roadmapService_1.createRoadmapDraft)({ projectRoot: root })));
}
//# sourceMappingURL=createRoadmapDraft.js.map