"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 / §12 — sigma_get_effective_policy
//
// Read-only projection of what the governance layer would currently allow.
// Advisory: the payload says so in its own fields, because a model that reads
// `availability: "role_action"` must not treat that as authorisation.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEffectivePolicy = void 0;
exports.registerEffectivePolicyTool = registerEffectivePolicyTool;
const zod_1 = require("zod");
const policy_1 = require("../policy");
Object.defineProperty(exports, "computeEffectivePolicy", { enumerable: true, get: function () { return policy_1.computeEffectivePolicy; } });
const contract_1 = require("../contract");
function registerEffectivePolicyTool(server) {
    server.registerTool('sigma_get_effective_policy', {
        title: 'Get Sigma Effective Policy',
        description: 'Classify every Sigma operation for the bound project as observe, role_action, director_required, gate_blocked, or forbidden, given the current lifecycle and gates. Read-only and ADVISORY — enforcement is re-applied server-side on every command, and this output grants nothing. Each row also reports tier (Q/W1/W2/W3), owner_role (derived, not ratified), the registry role/level, and mcp_status (implemented | deferred | not_admissible). Optional role filters rows to one governance role. Returns { active, registry_available, gates_evaluated, counts, operations[], advisory, enforcement, source }.',
        inputSchema: {
            role: zod_1.z
                .enum(['ARC', 'FMN', 'DEV', 'AUD'])
                .optional()
                .describe('Filter to operations owned by this role, plus role-neutral ones.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ role }) => (0, contract_1.respond)('sigma_get_effective_policy', undefined, (root) => (0, policy_1.computeEffectivePolicy)(root, role)));
}
//# sourceMappingURL=effectivePolicy.js.map