"use strict";
// Stage B2 — sigma_list_execs. Query-plane equivalent of `sigma exec list`
// — every chain.exec.versions[] entry regardless of state (unlike
// sigma_exec_status, which hides SUPERSEDED). No pending concept for exec.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeListExecs = computeListExecs;
exports.registerListExecsTool = registerListExecsTool;
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeListExecs(root) {
    if (!root)
        return (0, shared_1.noProject)({ versions: [] });
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return { versions: [], source: shared_1.SOURCE_ENGINE };
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    return {
        active_chain: chainVersion,
        versions: chain.exec.versions.map((v) => ({
            version: v.version,
            state: v.state,
            plan_version_ref: v.plan_version_ref ?? null,
            created_at: v.created_at,
        })),
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerListExecsTool(server) {
    server.registerTool('sigma_list_execs', {
        title: 'List all DEV-EXEC versions',
        description: 'List every DEV-EXEC version in the active chain (all states — DRAFT, LOCKED, SUPERSEDED — unlike ' +
            'sigma_exec_status which hides SUPERSEDED). The query-plane equivalent of `sigma exec list`. Read-only. ' +
            'Returns { active_chain, versions: [{ version, state, plan_version_ref, created_at }], source }.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, contract_1.respond)('sigma_list_execs', undefined, (root) => computeListExecs(root)));
}
//# sourceMappingURL=listExecs.js.map