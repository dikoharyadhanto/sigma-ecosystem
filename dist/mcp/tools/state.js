"use strict";
// PLAN-IMPL-01 §3.1 — sigma_get_state
//
// Read-only. Wraps the same engine functions the CLI uses (readActiveChain,
// getGateStatus, hasInvalidRuntime). No writer function is imported here.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeState = computeState;
exports.registerStateTool = registerStateTool;
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
// Core logic exported as a pure function so it can be unit-tested without the
// MCP transport (PLAN-IMPL-01 §4-A). registerStateTool is a thin wrapper.
function computeState(root) {
    if (!root)
        return (0, shared_1.noProject)();
    const identity = (0, chain_1.readProjectIdentity)(root);
    if ((0, chain_1.listChainVersions)(root).length === 0) {
        return (0, shared_1.noProject)({
            project_id: identity.project_id,
            project_name: identity.project_name,
        });
    }
    const { chainVersion, data } = (0, chain_1.readActiveChain)(root);
    return {
        active: true,
        phase: data.lifecycle_state,
        active_chain: chainVersion,
        project_id: identity.project_id,
        project_name: identity.project_name,
        schema_version: data.schema_version,
        gates: (0, chain_1.getGateStatus)(data),
        has_invalid_runtime: (0, chain_1.hasInvalidRuntime)(data),
        source: shared_1.SOURCE_ENGINE,
    };
}
const zod_1 = require("zod");
function registerStateTool(server) {
    server.registerTool('sigma_get_state', {
        title: 'Get Sigma Lifecycle State',
        description: 'Return the current Sigma lifecycle phase, active chain, project identity, and gate summary. Read-only; wraps the same engine code path as the CLI. Accepts optional project_root parameter. Returns { active, phase, active_chain, project_id, project_name, schema_version, gates, has_invalid_runtime, source }, or { active: false, ... } when no Sigma chain exists.',
        inputSchema: {
            project_root: zod_1.z
                .string()
                .optional()
                .describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, shared_1.okText)(computeState((0, shared_1.resolveRoot)(project_root))));
}
//# sourceMappingURL=state.js.map