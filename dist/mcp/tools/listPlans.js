"use strict";
// Stage B2 — sigma_list_plans. Query-plane equivalent of `sigma plan list`
// — every chain.plan.versions[] entry regardless of state (unlike
// sigma_plan_status, which hides SUPERSEDED), plus the pending (unversioned)
// queue. Unlike sigma_plan_status's readPendingTitle() fallback path, the
// title here is never a host absolute path — see planStatus.ts for the same
// concern already resolved once.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeListPlans = computeListPlans;
exports.registerListPlansTool = registerListPlansTool;
const zod_1 = require("zod");
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
function computeListPlans(root) {
    if (!root)
        return (0, shared_1.noProject)({ versions: [], pending: [] });
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return { versions: [], pending: [], source: shared_1.SOURCE_ENGINE };
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    return {
        active_chain: chainVersion,
        versions: chain.plan.versions.map((v) => ({
            version: v.version,
            state: v.state,
            intent_version_ref: v.intent_version_ref ?? null,
            created_at: v.created_at,
        })),
        pending: chain.plan.pending.map((p) => ({
            id: p.id,
            title: p.title ?? safePendingTitle(root, p.file),
            created_at: p.created_at,
        })),
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerListPlansTool(server) {
    server.registerTool('sigma_list_plans', {
        title: 'List all FMN-PLAN versions',
        description: 'List every FMN-PLAN version in the active chain (all states — DRAFT, LOCKED, SUPERSEDED — unlike ' +
            'sigma_plan_status which hides SUPERSEDED), plus pending (unversioned) plans. The query-plane equivalent ' +
            'of `sigma plan list`. Read-only. Returns { active_chain, versions: [{ version, state, ' +
            'intent_version_ref, created_at }], pending: [{ id, title, created_at }], source }.',
        inputSchema: {
            project_root: zod_1.z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, contract_1.respond)('sigma_list_plans', project_root, (root) => computeListPlans(root)));
}
//# sourceMappingURL=listPlans.js.map