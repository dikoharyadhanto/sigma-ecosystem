"use strict";
// Stage F (W2 batch, continued) — the use-case shared by `sigma plan
// supersede` (CLI) and sigma_commit_plan_supersede's mutate step (MCP
// control tool). Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split. Unlike intent_supersede, this operation
// already only ever targets the active chain in the CLI (no cross-chain
// `--v`), so there is no MCP scope-narrowing decision to make here.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanSupersedeError = void 0;
exports.assertValidPlanSupersedeReason = assertValidPlanSupersedeReason;
exports.planDocPath = planDocPath;
exports.describePlanSupersedeCascadeEffects = describePlanSupersedeCascadeEffects;
exports.planSupersedeTransactionFiles = planSupersedeTransactionFiles;
exports.supersedePlanUseCase = supersedePlanUseCase;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chain_1 = require("../engine/chain");
const roadmap_1 = require("../utils/roadmap");
class PlanSupersedeError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'PlanSupersedeError';
    }
}
exports.PlanSupersedeError = PlanSupersedeError;
const MAX_REASON_LENGTH = 2000;
function assertValidPlanSupersedeReason(reason) {
    const trimmed = reason.trim();
    if (!trimmed) {
        throw new PlanSupersedeError('INVALID_OPERATION', '--reason cannot be empty.');
    }
    if (reason.length > MAX_REASON_LENGTH) {
        throw new PlanSupersedeError('INVALID_OPERATION', `--reason exceeds ${MAX_REASON_LENGTH} characters.`);
    }
}
function planDocPath(projectRoot, chain, version) {
    const entry = chain.plan.versions.find(v => v.version === version);
    if (!entry)
        throw new PlanSupersedeError('INVALID_OPERATION', `FMN-PLAN ${version} not found.`);
    return path_1.default.join(projectRoot, entry.file ?? path_1.default.join('Sigma', 'contract', `FMN-PLAN-${entry.version}.md`));
}
function describePlanSupersedeCascadeEffects(chain, version) {
    const target = chain.plan.versions.find(v => v.version === version);
    const effects = [`plan.${version}.state: ${target?.state ?? '?'} -> SUPERSEDED`];
    for (const exec of chain.exec.versions) {
        if (exec.plan_version_ref === version && exec.state !== 'SUPERSEDED') {
            effects.push(`exec.${exec.version}.state: ${exec.state} -> SUPERSEDED (cascade)`);
        }
    }
    if (chain.roadmap) {
        effects.push(`roadmap.${chain.roadmap.version}: re-rendered with SUPERSEDED status`);
    }
    return effects;
}
function planSupersedeTransactionFiles(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const files = [(0, chain_1.chainFilePath)(projectRoot, chainVersion)];
    if (chain.roadmap) {
        files.push(path_1.default.join(projectRoot, chain.roadmap.file ?? path_1.default.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`)));
    }
    return files;
}
/**
 * Supersedes an FMN-PLAN version (DRAFT or LOCKED) on the active chain,
 * auto-superseding any linked non-final DEV-EXEC. Throws PlanSupersedeError
 * (INVALID_OPERATION) for every business-rule rejection (not found, already
 * SUPERSEDED, malformed reason).
 */
function supersedePlanUseCase(projectRoot, version, reason) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    assertValidPlanSupersedeReason(reason);
    const cascadedExecs = chain.exec.versions
        .filter(v => v.plan_version_ref === version && v.state !== 'SUPERSEDED')
        .map(v => v.version);
    try {
        (0, chain_1.supersedePlanVersion)(chain, version, reason);
    }
    catch (e) {
        throw new PlanSupersedeError('INVALID_OPERATION', e.message);
    }
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    if (chain.roadmap) {
        const roadmapPath = path_1.default.join(projectRoot, chain.roadmap.file ?? path_1.default.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
        if (fs_extra_1.default.existsSync(roadmapPath)) {
            (0, roadmap_1.renderRoadmapFile)(roadmapPath, chain);
        }
    }
    return { chainVersion, version, cascadedExecs };
}
//# sourceMappingURL=planSupersedeService.js.map