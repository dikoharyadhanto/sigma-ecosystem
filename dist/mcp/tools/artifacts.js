"use strict";
// PLAN-IMPL-01 §3.3 — sigma_list_artifacts
//
// Read-only. Projects the ChainState artifact trackers. Deliberately returns
// counts, not the full versions[] arrays (those can be large; the full history
// is a future sigma_read_artifact concern).
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeArtifacts = computeArtifacts;
exports.registerArtifactsTool = registerArtifactsTool;
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
// Pure core (PLAN-IMPL-01 §4-A).
function computeArtifacts(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    const { chainVersion, data } = (0, chain_1.readActiveChain)(root);
    return {
        active: true,
        active_chain: chainVersion,
        intent: {
            version: data.intent.version,
            state: data.intent.state,
            title: data.intent.title ?? null,
            focus: data.intent.focus ?? null,
        },
        roadmap: data.roadmap
            ? { version: data.roadmap.version, state: data.roadmap.state }
            : null,
        plan: {
            active_version: data.plan.active_version,
            active_state: data.plan.active_state,
            versions_count: data.plan.versions.length,
            pending_count: data.plan.pending.length,
        },
        exec: {
            active_version: data.exec.active_version,
            active_state: data.exec.active_state,
            versions_count: data.exec.versions.length,
        },
        close: data.close
            ? { version: data.close.version, state: data.close.state }
            : null,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerArtifactsTool(server) {
    server.registerTool('sigma_list_artifacts', {
        title: 'List Sigma Artifacts',
        description: 'Return the artifact tracker summary for the active chain: intent, roadmap, plan, exec, and close, each with version and state (counts for plan/exec history, not the full version arrays). Read-only; takes no arguments. Returns { active, active_chain, intent, roadmap, plan, exec, close, source }. roadmap and close are null until created. Returns { active: false, ... } when no chain exists.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, shared_1.okText)(computeArtifacts((0, shared_1.resolveRoot)())));
}
//# sourceMappingURL=artifacts.js.map