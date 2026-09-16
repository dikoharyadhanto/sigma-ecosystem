"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one use-case
// shared by `sigma exec new` (CLI) and `sigma_create_exec_draft` (MCP control
// tool). Transport-agnostic on purpose: no Commander, no console.log.
//
// Mirrors src/services/planDraftService.ts's shape, but two things differ
// structurally: (1) there is no independent version counter — nextExecVersion()
// (src/engine/chain.ts) always returns the referenced PLAN's own version, so
// this service's "which version" question is really "which PLAN", and (2)
// target-PLAN selection (PLAN-IMPL-MULTIDRAFT-LOCK §4's per-PLAN exec
// cardinality guard) is real, non-trivial business logic ported from
// src/commands/exec.ts verbatim, not simplified.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecDraftError = void 0;
exports.createExecDraftTransactionFiles = createExecDraftTransactionFiles;
exports.createExecDraft = createExecDraft;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const controlStore_1 = require("../engine/controlStore");
class ExecDraftError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ExecDraftError';
    }
}
exports.ExecDraftError = ExecDraftError;
// PLAN-IMPL-MULTIDRAFT-LOCK §4 (Director-confirmed cardinality invariant) —
// at most one non-final exec per plan. Ported verbatim from
// src/commands/exec.ts's `exec new` action (the CLI command this service
// replaces) rather than re-derived, because this is exactly the logic that
// enforces that invariant; simplifying it here would reopen the gap
// MULTIDRAFT-LOCK closed. Used by both createExecDraftTransactionFiles()
// (to compute the target file path before the lock/journal begins) and
// createExecDraft() itself, so the two can never resolve differently.
function resolveTargetPlan(chain, requestedPlanVersion) {
    const lockedPlans = chain.plan.versions.filter(v => v.state === 'LOCKED');
    const plansWithOpenExec = new Set(chain.exec.versions
        .filter(v => v.state !== 'SUPERSEDED')
        .map(v => v.plan_version_ref)
        .filter((ref) => Boolean(ref)));
    const unexecutedPlans = lockedPlans.filter(p => !plansWithOpenExec.has(p.version));
    if (requestedPlanVersion) {
        const target = lockedPlans.find(p => p.version === requestedPlanVersion);
        if (!target) {
            const available = lockedPlans.map(p => p.version).join(', ') || '(none)';
            throw new ExecDraftError('INVALID_OPERATION', `FMN-PLAN ${requestedPlanVersion} is not a LOCKED plan.\nLOCKED plans: ${available}`);
        }
        const openExecForPlan = chain.exec.versions.find(v => v.plan_version_ref === requestedPlanVersion && v.state !== 'SUPERSEDED');
        if (openExecForPlan) {
            throw new ExecDraftError('INVALID_OPERATION', `EXEC CONFLICT: FMN-PLAN ${requestedPlanVersion} already has DEV-EXEC ${openExecForPlan.version} in ${openExecForPlan.state} state.\n` +
                'A plan has at most one execution — continue that DEV-EXEC instead of creating a new one:\n' +
                `  ${openExecForPlan.file ?? `Sigma/build/DEV-EXEC-${openExecForPlan.version}.md`}\n` +
                `  sigma exec check --v ${openExecForPlan.version}\n` +
                'To abandon it instead, supersede its plan and open a new plan version:\n' +
                `  sigma plan supersede --v ${requestedPlanVersion} --reason "..."`);
        }
        return requestedPlanVersion;
    }
    if (unexecutedPlans.length === 0) {
        throw new ExecDraftError('INVALID_OPERATION', 'All locked plans already have an exec.\nRun: sigma plan new   to create a new plan');
    }
    if (unexecutedPlans.length === 1) {
        return unexecutedPlans[0].version;
    }
    const versions = unexecutedPlans.map(p => p.version).join(', ');
    throw new ExecDraftError('INVALID_OPERATION', `${unexecutedPlans.length} unexecuted locked plans found: ${versions}\n` +
        `Specify which to execute: sigma exec new --plan ${unexecutedPlans[0].version}`);
}
function assertGate2Open(chain) {
    if (!(0, chain_1.getOperationalGate)(chain, 'gate_2_open')) {
        throw new ExecDraftError('GATE_BLOCKED', 'GATE 2 BLOCKED: No locked FMN-PLAN. Run: sigma plan lock');
    }
}
function createExecDraftTransactionFiles(projectRoot, planVersion) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    assertGate2Open(chain);
    const planVersionRef = resolveTargetPlan(chain, planVersion);
    const version = (0, chain_1.nextExecVersion)(chain, planVersionRef);
    return [
        path_1.default.join(projectRoot, 'Sigma', 'evidence', `DEV-EXEC-${version}.md`),
        (0, chain_1.chainFilePath)(projectRoot, chainVersion),
    ];
}
function createExecDraft(input) {
    const { projectRoot, planVersion } = input;
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    assertGate2Open(chain);
    const planVersionRef = resolveTargetPlan(chain, planVersion);
    const version = (0, chain_1.nextExecVersion)(chain, planVersionRef);
    const relPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'evidence', `DEV-EXEC-${version}.md`));
    const absPath = path_1.default.join(projectRoot, relPath);
    // Defensive checks ported from the CLI command — registerExecDraft() would
    // itself throw on the first, but failing before any artifact write is
    // written is the whole point (an orphan file with no chain entry is worse
    // than an early, clean refusal).
    if (chain.exec.versions.some(v => v.version === version)) {
        throw new ExecDraftError('INVALID_OPERATION', `EXEC CONFLICT: DEV-EXEC ${version} already exists in progress-${chainVersion}.json`);
    }
    if (fs_extra_1.default.existsSync(absPath)) {
        throw new ExecDraftError('INVALID_OPERATION', `EXEC FILE CONFLICT: ${relPath} already exists. Refusing to overwrite existing DEV-EXEC artifact.`);
    }
    (0, artifacts_1.copyTemplateToArtifact)('DEV-EXEC-TEMPLATE.md', absPath);
    (0, controlStore_1.controlTestFailpoint)('exec_create_after_artifact');
    (0, chain_1.registerExecDraft)(chain, version, relPath, planVersionRef);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('exec_create_after_chain');
    return { chainVersion, version, relPath, planVersionRef };
}
//# sourceMappingURL=execDraftService.js.map