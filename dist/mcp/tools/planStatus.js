"use strict";
// Stage B2 — sigma_plan_status. Query-plane equivalent of `sigma plan
// status` — categorizes chain.plan.versions[] into DRAFT/LOCKED (computing
// the same plan<->exec pairing `plan status` derives at runtime via
// .find()), plus pending plans and Gate 2. Mirrors the CLI's categorization
// logic exactly, not a generic list — see sigma_check_document's header for
// why STATUS/LIST stay per-type instead of one generic tool.
//
// Deviates from the CLI's readPendingTitle() fallback on purpose: that
// helper falls back to the pending plan's ABSOLUTE host path as a "title"
// when the file is missing a "# " heading or unreadable — safe in a
// terminal, not safe to return through MCP. This tool falls back to null
// instead of ever putting a host path in a title field.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePlanStatus = computePlanStatus;
exports.registerPlanStatusTool = registerPlanStatusTool;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function safePendingTitle(root, relFile) {
    const absPath = path_1.default.join(root, relFile);
    if (!fs_extra_1.default.existsSync(absPath))
        return null;
    try {
        const firstLine = fs_extra_1.default.readFileSync(absPath, 'utf8').split('\n')[0] ?? '';
        return firstLine.startsWith('# ') ? firstLine.slice(2).trim() : null;
    }
    catch {
        return null;
    }
}
function computePlanStatus(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0) {
        return { active: false, gate_2_open: false, source: shared_1.SOURCE_ENGINE };
    }
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const byCreatedAt = (a, b) => a.created_at.localeCompare(b.created_at);
    const drafts = chain.plan.versions.filter((v) => v.state === 'DRAFT').sort(byCreatedAt);
    const locked = chain.plan.versions.filter((v) => v.state === 'LOCKED').sort(byCreatedAt);
    const supersededCount = chain.plan.versions.filter((v) => v.state === 'SUPERSEDED').length;
    return {
        active: true,
        active_chain: chainVersion,
        drafts: drafts.map((d) => ({ version: d.version, title: d.title ?? null, created_at: d.created_at })),
        locked: locked.map((p) => {
            const lockedExec = chain.exec.versions.find((e) => e.plan_version_ref === p.version && e.state === 'LOCKED');
            const openExec = chain.exec.versions.find((e) => e.plan_version_ref === p.version && e.state !== 'LOCKED' && e.state !== 'SUPERSEDED');
            return {
                version: p.version,
                title: p.title ?? null,
                exec_pairing: lockedExec
                    ? { status: 'locked', exec_version: lockedExec.version }
                    : openExec
                        ? { status: 'open', exec_version: openExec.version, exec_state: openExec.state }
                        : { status: 'none' },
            };
        }),
        pending: chain.plan.pending.map((p) => ({
            id: p.id,
            title: p.title ?? safePendingTitle(root, p.file),
            focus: p.focus ?? null,
            created_at: p.created_at,
        })),
        superseded_count: supersededCount,
        gate_2_open: chain.gates.gate_2_open,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerPlanStatusTool(server) {
    server.registerTool('sigma_plan_status', {
        title: 'Get FMN-PLAN status',
        description: 'Return the active chain\'s FMN-PLAN status — the query-plane equivalent of `sigma plan status`: open ' +
            'DRAFTs, LOCKED plans with their DEV-EXEC pairing, pending (unversioned) plans, a count of SUPERSEDED ' +
            'plans not otherwise listed, and Gate 2. Read-only. Returns { active, active_chain, drafts, locked, ' +
            'pending, superseded_count, gate_2_open, source }.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, contract_1.respond)('sigma_plan_status', undefined, (root) => computePlanStatus(root)));
}
//# sourceMappingURL=planStatus.js.map