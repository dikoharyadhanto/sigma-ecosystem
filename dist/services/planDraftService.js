"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 pilot — the one
// use-case shared by `sigma plan new` (CLI, non-pending path) and
// `sigma_create_plan_draft` (MCP control tool). Transport-agnostic on
// purpose: no Commander, no console.log, no prompt.
//
// Deliberately mirrors src/services/intentDraftService.ts's shape (single
// exported create function + a matching *TransactionFiles(root) helper), but
// the two are not structurally identical: chain.intent is a single object,
// chain.plan is an array of versions (ArtifactVersion[]), so this service
// must select/compute a version and append to that array (registerPlanDraft)
// rather than replace a single field. It also references a RATIFIED intent
// and an existing ROADMAP, neither of which intent_draft has to check.
//
// Only the "new plan under an active chain" path is ported here — `sigma
// plan new --pending` stages a plan with no version/gate requirement at all
// and stays CLI-only for now (not part of the Stage E W1 primitive list).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanDraftError = void 0;
exports.createPlanDraftTransactionFiles = createPlanDraftTransactionFiles;
exports.createPlanDraft = createPlanDraft;
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const roadmap_1 = require("../utils/roadmap");
const projectConfig_1 = require("../engine/projectConfig");
const controlStore_1 = require("../engine/controlStore");
class PlanDraftError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'PlanDraftError';
    }
}
exports.PlanDraftError = PlanDraftError;
// PLAN-EVAL-06 §6.2-equivalent for ROADMAP: generateStageOverview()
// (src/utils/roadmap.ts) renders title/focus into an unescaped
// `| ${stage} | ${title} | ${focus} | ... |` row. "|"/newlines would corrupt
// that table exactly the way they'd corrupt intent-history.md. The CLI
// command this service replaces never enforced this (only non-empty) — this
// closes that gap for both callers, not just MCP.
function assertRequiredMetadata(title, focus) {
    if (!title?.trim())
        throw new PlanDraftError('INVALID_OPERATION', 'title is required.');
    if (!focus?.trim())
        throw new PlanDraftError('INVALID_OPERATION', 'focus is required.');
    if (/[|\n\r]/.test(title)) {
        throw new PlanDraftError('INVALID_OPERATION', 'title cannot contain "|" or a newline (breaks the ROADMAP Stage Overview table).');
    }
    if (/[|\n\r]/.test(focus)) {
        throw new PlanDraftError('INVALID_OPERATION', 'focus cannot contain "|" or a newline (breaks the ROADMAP Stage Overview table).');
    }
}
// PLAN-EVAL-01 §3.5 — a chain's ROADMAP unblocks `plan new` once it exists
// and hasn't been cascaded to SUPERSEDED. Mirrors
// src/commands/plan.ts's getRoadmapPathIfEligible() exactly (not imported
// from there — that module is CLI/Commander-bound and this service must stay
// transport-agnostic; duplication here is one small pure function, not
// mutation logic).
function getRoadmapPathIfEligible(projectRoot, chain) {
    if (!chain.roadmap || chain.roadmap.state === 'SUPERSEDED')
        return null;
    return path_1.default.join(projectRoot, chain.roadmap.file ?? path_1.default.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
}
function assertGatesOpen(projectRoot, chain) {
    if (!(0, chain_1.getOperationalGate)(chain, 'gate_1_open') || chain.intent.state !== 'RATIFIED') {
        throw new PlanDraftError('GATE_BLOCKED', 'GATE 1 BLOCKED: No ratified DIR-INTENT. Run: sigma intent ratify');
    }
    if (!getRoadmapPathIfEligible(projectRoot, chain)) {
        throw new PlanDraftError('GATE_BLOCKED', 'Gate 1.5 blocked: A ROADMAP must exist for this chain before FMN-PLAN can be created. Run: sigma roadmap new');
    }
    // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §3.4/§4 Fase 6 (CR-01) — project-config
    // driven, optional. Enforced here (not at intent ratify/exec lock) so it
    // applies identically to both callers of this service, exactly as it does
    // for the CLI command being replaced.
    const humanizeGate = (0, projectConfig_1.readProjectConfig)(projectRoot).notion_humanize_gate;
    if (humanizeGate?.enabled) {
        const blockers = [];
        if (!chain.intent.human?.pushed_to_notion_at) {
            blockers.push(`DIR-INTENT ${chain.intent.version} has no human projection pushed to Notion yet. ` +
                'Run: sigma intent humanize (then) sigma notion push');
        }
        const latestLockedExec = chain.exec.versions
            .filter(v => v.state === 'LOCKED')
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        if (latestLockedExec && !latestLockedExec.human?.pushed_to_notion_at) {
            blockers.push(`DEV-EXEC ${latestLockedExec.version} has no human projection pushed to Notion yet. ` +
                `Run: sigma exec humanize --v ${latestLockedExec.version} (then) sigma notion push`);
        }
        if (blockers.length > 0) {
            throw new PlanDraftError('GATE_BLOCKED', 'HUMANIZE GATE BLOCKED (notion_humanize_gate.enabled): ' + blockers.join(' | '));
        }
    }
    return chain.intent.version;
}
function createPlanDraftTransactionFiles(projectRoot) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const intentVersionRef = chain.intent.version;
    const version = (0, chain_1.nextPlanVersion)(chain, intentVersionRef);
    const files = [
        path_1.default.join(projectRoot, 'Sigma', 'contract', `FMN-PLAN-${version}.md`),
        (0, chain_1.chainFilePath)(projectRoot, chainVersion),
    ];
    const roadmapAbsPath = getRoadmapPathIfEligible(projectRoot, chain);
    if (roadmapAbsPath)
        files.push(roadmapAbsPath);
    return files;
}
function createPlanDraft(input) {
    const { projectRoot, title, focus } = input;
    assertRequiredMetadata(title, focus);
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    const intentVersionRef = assertGatesOpen(projectRoot, chain);
    const version = (0, chain_1.nextPlanVersion)(chain, intentVersionRef);
    const relPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'contract', `FMN-PLAN-${version}.md`));
    const absPath = path_1.default.join(projectRoot, relPath);
    // Artifact write first, chain last — same order intentDraftService uses,
    // same rationale (a half-written artifact with no chain entry is an
    // orphan file, recoverable; a chain entry pointing at a missing artifact
    // is not).
    (0, artifacts_1.copyTemplateToArtifact)('FMN-PLAN-TEMPLATE.md', absPath);
    (0, controlStore_1.controlTestFailpoint)('plan_create_after_artifact');
    (0, chain_1.registerPlanDraft)(chain, version, relPath, intentVersionRef, title, focus);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('plan_create_after_chain');
    // Render after state is written (idempotent re-sync), same order the CLI
    // command used.
    const roadmapAbsPath = getRoadmapPathIfEligible(projectRoot, chain);
    if (roadmapAbsPath) {
        (0, roadmap_1.renderRoadmapFile)(roadmapAbsPath, chain);
    }
    (0, controlStore_1.controlTestFailpoint)('plan_create_after_roadmap');
    return { chainVersion, version, relPath, intentVersionRef, title, focus };
}
//# sourceMappingURL=planDraftService.js.map