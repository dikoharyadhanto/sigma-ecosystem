"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the two use-cases
// shared by `sigma roadmap new`/`sigma roadmap render` (CLI) and
// `sigma_create_roadmap_draft`/`sigma_render_roadmap` (MCP control tools).
// Transport-agnostic on purpose: no Commander, no console.log.
//
// chain.roadmap is a single object (SingleRoadmapState | null), like
// chain.intent — not an array like chain.plan.versions[]/chain.exec.versions[].
// There is no independent roadmap version counter: a chain's roadmap always
// carries chain.chain_version.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoadmapServiceError = void 0;
exports.createRoadmapDraftTransactionFiles = createRoadmapDraftTransactionFiles;
exports.createRoadmapDraft = createRoadmapDraft;
exports.renderActiveRoadmapTransactionFiles = renderActiveRoadmapTransactionFiles;
exports.renderActiveRoadmap = renderActiveRoadmap;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const roadmap_1 = require("../utils/roadmap");
const controlStore_1 = require("../engine/controlStore");
class RoadmapServiceError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'RoadmapServiceError';
    }
}
exports.RoadmapServiceError = RoadmapServiceError;
function roadmapAbsPath(projectRoot, chain) {
    if (!chain.roadmap) {
        throw new RoadmapServiceError('INVALID_OPERATION', 'No ROADMAP found for this chain. Run: sigma roadmap new');
    }
    return path_1.default.join(projectRoot, chain.roadmap.file ?? path_1.default.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
}
function createRoadmapDraftTransactionFiles(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const version = chain.chain_version;
    return [
        path_1.default.join(projectRoot, 'Sigma', 'roadmap', `ROADMAP-${version}.md`),
        (0, chain_1.chainFilePath)(projectRoot, chainVersion),
    ];
}
function createRoadmapDraft(input) {
    const { projectRoot } = input;
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    if (chain.intent.state !== 'RATIFIED') {
        throw new RoadmapServiceError('GATE_BLOCKED', 'ROADMAP requires a ratified DIR-INTENT. Run: sigma intent ratify');
    }
    // registerRoadmapDraft() below enforces this same 1:1 guard, but only
    // with a plain Error (no typed .code) — checked here first, with the
    // identical message, so a real conflict surfaces as INVALID_OPERATION
    // instead of falling through to INTERNAL_ERROR. registerRoadmapDraft()'s
    // own check stays in place as the defensive backstop it already is for
    // every other *Draft chain.ts mutator (e.g. registerPlanDraft's version
    // sync check).
    if (chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED') {
        throw new RoadmapServiceError('INVALID_OPERATION', `ROADMAP already exists for this chain (${chain.roadmap.version}, ${chain.roadmap.state}). ` +
            'To create a new roadmap, create a new INTENT (chain) first.');
    }
    const version = chain.chain_version;
    const relPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'roadmap', `ROADMAP-${version}.md`));
    const absPath = path_1.default.join(projectRoot, relPath);
    // Artifact write first, chain last — same order/rationale as
    // intent/plan/exec draft services: a half-written artifact with no chain
    // entry is an orphan file, recoverable; a chain entry pointing at a
    // missing artifact is not.
    (0, artifacts_1.copyTemplateToArtifact)('ROADMAP-TEMPLATE.md', absPath);
    (0, controlStore_1.controlTestFailpoint)('roadmap_create_after_artifact');
    // registerRoadmapDraft() itself re-enforces the 1:1 guard (rejects unless
    // chain.roadmap is null or SUPERSEDED) — not duplicated logic, a backstop.
    (0, chain_1.registerRoadmapDraft)(chain, relPath);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('roadmap_create_after_chain');
    return { chainVersion, version, relPath };
}
function renderActiveRoadmapTransactionFiles(projectRoot) {
    const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    return [roadmapAbsPath(projectRoot, chain)];
}
// No assertChainCanMutate() here — matches the existing CLI `roadmap
// render`, which never called it either (render has no DRAFT/LOCKED
// state concern; it re-derives a table from chain.plan.versions[] and
// never touches progress-v<N>.json at all).
function renderActiveRoadmap(projectRoot) {
    const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const absPath = roadmapAbsPath(projectRoot, chain);
    (0, roadmap_1.renderRoadmapFile)(absPath, chain);
    (0, controlStore_1.controlTestFailpoint)('roadmap_render_after_write');
    return { version: chain.roadmap.version, relPath: chain.roadmap.file ?? (0, fs_1.toPosix)(path_1.default.relative(projectRoot, absPath)) };
}
//# sourceMappingURL=roadmapService.js.map