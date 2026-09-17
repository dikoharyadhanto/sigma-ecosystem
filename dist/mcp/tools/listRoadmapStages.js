"use strict";
// Stage B2 — sigma_list_roadmap_stages. Query-plane equivalent of `sigma
// roadmap list`.
//
// Named deliberately NOT sigma_list_roadmaps: `Sigma/SIGMA-OPERATION-
// REGISTRY.json`'s `roadmap_list` entry describes its output as "Table of
// ROADMAP versions: version, state, file path" — that description does not
// match the actual CLI implementation, confirmed by reading
// src/commands/roadmap.ts directly. A chain has at most one ROADMAP (single
// object, not an array like plan/exec); `roadmap list` actually lists
// STAGES — the plans registered against the active chain's intent, via
// getStagePlansForRoadmap() (src/utils/roadmap.ts), which is what backs
// the ROADMAP's own Stage Overview table. This tool mirrors the real
// behaviour; the registry description is stale and should be corrected
// separately (capability matrix §5 mismatch-tracking, not fixed here).
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeListRoadmapStages = computeListRoadmapStages;
exports.registerListRoadmapStagesTool = registerListRoadmapStagesTool;
const chain_1 = require("../../engine/chain");
const roadmap_1 = require("../../utils/roadmap");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
function computeListRoadmapStages(root) {
    if (!root)
        return (0, shared_1.noProject)({ stages: [] });
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return { stages: [], source: shared_1.SOURCE_ENGINE };
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    if (!chain.roadmap) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'No ROADMAP found for the active chain.');
    }
    const stagePlans = (0, roadmap_1.getStagePlansForRoadmap)(chain);
    return {
        active_chain: chainVersion,
        roadmap_version: chain.roadmap.version,
        stages: stagePlans.map((p) => ({
            version: p.version,
            state: p.state,
            title: p.title ?? null,
            focus: p.focus ?? null,
        })),
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerListRoadmapStagesTool(server) {
    server.registerTool('sigma_list_roadmap_stages', {
        title: 'List ROADMAP stages',
        description: 'List every stage (plan) registered against the active chain\'s ROADMAP — the query-plane equivalent of ' +
            '`sigma roadmap list`. A chain has at most one ROADMAP; this lists the stages within it, not multiple ' +
            'ROADMAP versions. Read-only. Returns { active_chain, roadmap_version, stages: [{ version, state, title, ' +
            'focus }], source }.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, contract_1.respond)('sigma_list_roadmap_stages', undefined, (root) => computeListRoadmapStages(root)));
}
//# sourceMappingURL=listRoadmapStages.js.map