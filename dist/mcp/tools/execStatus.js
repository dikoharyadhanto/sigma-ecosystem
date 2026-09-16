"use strict";
// Stage B2 — sigma_exec_status. Query-plane equivalent of `sigma exec
// status` — categorizes chain.exec.versions[] into DRAFT/LOCKED with their
// plan_version_ref, plus Gate 3. Simpler than plan_status: exec has no
// pending concept.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeExecStatus = computeExecStatus;
exports.registerExecStatusTool = registerExecStatusTool;
const zod_1 = require("zod");
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeExecStatus(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0) {
        return { active: false, gate_3_satisfied: false, source: shared_1.SOURCE_ENGINE };
    }
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const byCreatedAt = (a, b) => a.created_at.localeCompare(b.created_at);
    const drafts = chain.exec.versions.filter((v) => v.state === 'DRAFT').sort(byCreatedAt);
    const locked = chain.exec.versions.filter((v) => v.state === 'LOCKED').sort(byCreatedAt);
    const supersededCount = chain.exec.versions.filter((v) => v.state === 'SUPERSEDED').length;
    return {
        active: true,
        active_chain: chainVersion,
        drafts: drafts.map((d) => ({ version: d.version, plan_version_ref: d.plan_version_ref ?? null, created_at: d.created_at })),
        locked: locked.map((e) => ({ version: e.version, plan_version_ref: e.plan_version_ref ?? null })),
        superseded_count: supersededCount,
        gate_3_satisfied: chain.gates.gate_3_satisfied,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerExecStatusTool(server) {
    server.registerTool('sigma_exec_status', {
        title: 'Get DEV-EXEC status',
        description: 'Return the active chain\'s DEV-EXEC status — the query-plane equivalent of `sigma exec status`: open ' +
            'DRAFTs with plan pairing, LOCKED execs, a count of SUPERSEDED execs not otherwise listed, and Gate 3. ' +
            'Read-only. Returns { active, active_chain, drafts, locked, superseded_count, gate_3_satisfied, source }.',
        inputSchema: {
            project_root: zod_1.z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, contract_1.respond)('sigma_exec_status', project_root, (root) => computeExecStatus(root)));
}
//# sourceMappingURL=execStatus.js.map