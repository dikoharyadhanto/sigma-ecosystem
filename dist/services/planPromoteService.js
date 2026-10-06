"use strict";
// Stage F (W2 batch, continued) — the use-case shared by `sigma plan
// promote` (CLI) and sigma_commit_plan_promote's mutate step (MCP control
// tool). Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split.
//
// Owner role decision (2026-09-17, Director): the capability matrix lists
// this operation's owner role as "FMN + DIRECTOR" — read the same way as
// intent_ratify's "DIRECTOR" (§3.3's clarification): binding.role === 'FMN'
// gates the mechanical call (FMN owns FMN-PLAN), DIRECTOR authority is
// enforced through the separate approval record, exactly like every other
// W2 tool in this batch. No new dual-role binding mechanism was needed.
//
// Codex review 2026-09-17 (R-01/R-02) — this is the only W2 operation that
// renames a file rather than editing one in place. Two fixes below:
//   - assertPendingPlanCanonicalPath() re-verifies the pending file's
//     canonical location (declared path + realpath containment,
//     symlink-escape-safe) immediately before fs.moveSync(), not just at
//     the MCP commit tool's earlier hash check — a cooperating-writer lock
//     alone does not stop another local process from swapping the file
//     between that check and the move. Same discipline already used by
//     readCanonicalArtifactFile()'s post-open recheck (residual TOCTOU
//     window, not claimed to be zero, only re-verified). Implemented here
//     rather than imported from src/mcp/artifactPath.ts on purpose: this
//     service is shared with the CLI and the codebase keeps services/ free
//     of mcp/-layer dependencies (McpQueryError, ERROR_CODES) — see
//     PlanPromoteError below, which every caller (CLI and MCP) already maps
//     through its own error-code vocabulary.
//   - promotePlanUseCase() now validates the promoted document's structure
//     after the move (same check the CLI already runs) and returns the
//     report instead of silently claiming success for a malformed doc —
//     matching CLI parity: the promotion itself still commits (a DRAFT plan
//     is not required to be lock-eligible), but the caller can see it needs
//     fixing before `plan lock`.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanPromoteError = void 0;
exports.assertPendingPlanCanonicalPath = assertPendingPlanCanonicalPath;
exports.assertValidPromoteArgs = assertValidPromoteArgs;
exports.assertPlanPromoteGatesOpen = assertPlanPromoteGatesOpen;
exports.findPendingPlan = findPendingPlan;
exports.planPromoteTransactionFiles = planPromoteTransactionFiles;
exports.promotePlanUseCase = promotePlanUseCase;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const roadmap_1 = require("../utils/roadmap");
const docCheck_1 = require("../utils/docCheck");
const config_1 = require("../config");
class PlanPromoteError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'PlanPromoteError';
    }
}
exports.PlanPromoteError = PlanPromoteError;
/** Local equivalent of src/mcp/binding.ts's canonicalize() — duplicated
 *  rather than imported to keep this service free of the mcp/ layer (see
 *  header). Behavior is the one that matters here (fs.realpathSync,
 *  resolved-path fallback on failure); the native-binding fast path in the
 *  mcp/ original is a performance nicety, not a correctness difference. */
function canonicalize(p) {
    try {
        return fs_extra_1.default.realpathSync(p);
    }
    catch {
        return path_1.default.resolve(p);
    }
}
/**
 * Re-derives the one location a pending plan `id` may occupy
 * (`Sigma/pending/FMN-PLAN-<id>.md`) and verifies `trackerFile` both
 * declares that exact path and still resolves there after symlinks/
 * junctions are followed — the same posture assertCanonicalLocation() uses
 * for versioned artifacts, applied to the one fixed pending-plan path.
 * Returns the verified absolute path. Call this immediately before the
 * operation it guards (open or move) — see header.
 */
function assertPendingPlanCanonicalPath(projectRoot, id, trackerFile) {
    const expected = `${config_1.PROJECT_SIGMA_DIR}/pending/FMN-PLAN-${id}.md`;
    const declared = trackerFile.split('\\').join('/');
    if (declared !== expected) {
        throw new PlanPromoteError('BOUNDARY_VIOLATION', 'Pending plan tracker entry does not point at the canonical location for this id.');
    }
    const abs = path_1.default.resolve(projectRoot, declared);
    const realRoot = canonicalize(projectRoot);
    const realAbs = canonicalize(abs);
    const rel = path_1.default.relative(realRoot, realAbs).split(path_1.default.sep).join('/');
    if (rel !== declared) {
        throw new PlanPromoteError('BOUNDARY_VIOLATION', 'Pending plan path does not resolve to its canonical location.');
    }
    return abs;
}
function assertNoPipeOrNewline(field, label) {
    if (/[|\n\r]/.test(field)) {
        throw new PlanPromoteError('INVALID_OPERATION', `--${label} cannot contain "|" or a newline (breaks the ROADMAP Stage Overview table).`);
    }
}
function assertValidPromoteArgs(title, focus) {
    if (!title.trim())
        throw new PlanPromoteError('INVALID_OPERATION', '--title cannot be empty.');
    if (!focus.trim())
        throw new PlanPromoteError('INVALID_OPERATION', '--focus cannot be empty.');
    assertNoPipeOrNewline(title, 'title');
    assertNoPipeOrNewline(focus, 'focus');
}
function roadmapPathIfEligible(projectRoot, chain) {
    if (!chain.roadmap || chain.roadmap.state === 'SUPERSEDED')
        return null;
    return path_1.default.join(projectRoot, chain.roadmap.file ?? path_1.default.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
}
/** Re-runs every plan_promote precondition (short of the pending entry's
 *  own presence, checked by the caller) against a live chain — used by both
 *  prepare and the MCP-scope preview. Throws PlanPromoteError. */
function assertPlanPromoteGatesOpen(chain) {
    if (!(0, chain_1.getOperationalGate)(chain, 'gate_1_open') || chain.intent.state !== 'RATIFIED') {
        throw new PlanPromoteError('GATE_BLOCKED', 'GATE 1 BLOCKED: No ratified DIR-INTENT. Run: sigma intent ratify');
    }
}
function findPendingPlan(chain, id) {
    const pending = chain.plan.pending.find(p => p.id === id);
    if (!pending) {
        throw new PlanPromoteError('INVALID_OPERATION', `Pending plan ID "${id}" not found. Run: sigma plan status to list pending plans`);
    }
    return pending;
}
function planPromoteTransactionFiles(projectRoot, id) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const files = [(0, chain_1.chainFilePath)(projectRoot, chainVersion)];
    const pending = chain.plan.pending.find(p => p.id === id);
    if (pending) {
        // Canonical derivation, not the raw tracker value — a corrupted/stale
        // pending.file must not end up in the journal's file list either (see
        // header). Non-canonical entries are simply excluded here; the actual
        // rejection happens where it must be authoritative — checkPreconditions
        // and the move itself, both of which call
        // assertPendingPlanCanonicalPath() and throw before anything happens.
        try {
            files.push(assertPendingPlanCanonicalPath(projectRoot, id, pending.file));
        }
        catch {
            // Left out of the journal; the throw surfaces properly downstream.
        }
    }
    const roadmapPath = roadmapPathIfEligible(projectRoot, chain);
    if (roadmapPath)
        files.push(roadmapPath);
    // The promoted file's destination path cannot be computed without
    // allocating a version, which nextPlanVersion() derives deterministically
    // from chain state alone — safe to compute a second time here without
    // mutating anything.
    if (pending) {
        const newVersion = (0, chain_1.nextPlanVersion)(chain, chain.intent.version);
        files.push(path_1.default.join(projectRoot, 'Sigma', 'contract', `FMN-PLAN-${newVersion}.md`));
    }
    return files;
}
/**
 * Promotes a pending plan (`id`) into the official DRAFT queue with an
 * assigned version, renaming its file and re-rendering the ROADMAP Stage
 * Overview. Throws PlanPromoteError (GATE_BLOCKED / INVALID_OPERATION /
 * BOUNDARY_VIOLATION) for every business-rule rejection.
 *
 * The promoted document is validated after the move and its report
 * returned rather than trusted silently — mirrors what `sigma plan
 * promote` (CLI) already does. Like the CLI, an invalid result still
 * commits (a promoted plan is a DRAFT, not required to be lock-eligible);
 * `docReport.ok` tells the caller whether it needs fixing before `plan
 * lock`.
 */
function promotePlanUseCase(projectRoot, id, title, focus) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    assertValidPromoteArgs(title, focus);
    assertPlanPromoteGatesOpen(chain);
    const pending = findPendingPlan(chain, id);
    const roadmapAbsPath = roadmapPathIfEligible(projectRoot, chain);
    if (!roadmapAbsPath) {
        throw new PlanPromoteError('GATE_BLOCKED', 'Gate 1.5 blocked: A ROADMAP must exist for this chain to promote a plan. Run: sigma roadmap new');
    }
    const newVersion = (0, chain_1.nextPlanVersion)(chain, chain.intent.version);
    // Re-verified immediately before the move — see header (R-02).
    const oldAbsPath = assertPendingPlanCanonicalPath(projectRoot, id, pending.file);
    const newRelPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'contract', `FMN-PLAN-${newVersion}.md`));
    const newAbsPath = path_1.default.join(projectRoot, newRelPath);
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(newAbsPath));
    fs_extra_1.default.moveSync(oldAbsPath, newAbsPath);
    (0, chain_1.promotePendingPlan)(chain, id, newVersion, newRelPath, chain.intent.version, title, focus);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, roadmap_1.renderRoadmapFile)(roadmapAbsPath, chain);
    const docReport = (0, docCheck_1.validateSigmaDocFile)(newAbsPath, 'plan');
    return { chainVersion, version: newVersion, oldRelPath: pending.file, newRelPath, docReport };
}
//# sourceMappingURL=planPromoteService.js.map