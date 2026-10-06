"use strict";
// Stage E W1 — sigma_render_roadmap. Control-plane only. Unlike every other
// control tool so far, this mutation never touches progress-v<N>.json — it
// only rewrites the derived Stage Overview table inside the ROADMAP
// markdown file itself, deterministically, from chain.plan.versions[]. See
// roadmapService.ts's renderActiveRoadmap() header.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRenderRoadmapTool = registerRenderRoadmapTool;
const zod_1 = require("zod");
const roadmapService_1 = require("../../../services/roadmapService");
const shared_1 = require("../shared");
function registerRenderRoadmapTool(server) {
    server.registerTool('sigma_render_roadmap', {
        title: 'Regenerate ROADMAP Stage Overview',
        description: 'Regenerates the derived Stage Overview table inside the active chain\'s ROADMAP file — the MCP ' +
            'control-plane equivalent of `sigma roadmap render`. FMN role only. Deterministic re-derivation from ' +
            'chain.plan.versions[]; does not touch progress-v<N>.json and does not require the ROADMAP to be in ' +
            'any particular lock state. Requires idempotency_key and expected_state_revision (from a prior ' +
            'sigma_get_state call on this binding).',
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
        tool: 'sigma_render_roadmap',
        operationId: 'roadmap_render',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: {},
        allowedRoles: ['FMN'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        transactionFiles: roadmapService_1.renderActiveRoadmapTransactionFiles,
    }, (root) => (0, roadmapService_1.renderActiveRoadmap)(root)));
}
//# sourceMappingURL=renderRoadmap.js.map