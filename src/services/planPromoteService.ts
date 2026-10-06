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

import path from 'path';
import fs from 'fs-extra';
import {
  ChainState,
  readActiveChain,
  assertChainCanMutate,
  getOperationalGate,
  nextPlanVersion,
  promotePendingPlan,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { toPosix } from '../utils/fs';
import { renderRoadmapFile } from '../utils/roadmap';
import { validateSigmaDocFile, SigmaDocCheckReport } from '../utils/docCheck';
import { PROJECT_SIGMA_DIR } from '../config';

export class PlanPromoteError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PlanPromoteError';
  }
}

/** Local equivalent of src/mcp/binding.ts's canonicalize() — duplicated
 *  rather than imported to keep this service free of the mcp/ layer (see
 *  header). Behavior is the one that matters here (fs.realpathSync,
 *  resolved-path fallback on failure); the native-binding fast path in the
 *  mcp/ original is a performance nicety, not a correctness difference. */
function canonicalize(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
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
export function assertPendingPlanCanonicalPath(projectRoot: string, id: string, trackerFile: string): string {
  const expected = `${PROJECT_SIGMA_DIR}/pending/FMN-PLAN-${id}.md`;
  const declared = trackerFile.split('\\').join('/');
  if (declared !== expected) {
    throw new PlanPromoteError('BOUNDARY_VIOLATION', 'Pending plan tracker entry does not point at the canonical location for this id.');
  }

  const abs = path.resolve(projectRoot, declared);
  const realRoot = canonicalize(projectRoot);
  const realAbs = canonicalize(abs);
  const rel = path.relative(realRoot, realAbs).split(path.sep).join('/');

  if (rel !== declared) {
    throw new PlanPromoteError('BOUNDARY_VIOLATION', 'Pending plan path does not resolve to its canonical location.');
  }
  return abs;
}

function assertNoPipeOrNewline(field: string, label: string): void {
  if (/[|\n\r]/.test(field)) {
    throw new PlanPromoteError('INVALID_OPERATION', `--${label} cannot contain "|" or a newline (breaks the ROADMAP Stage Overview table).`);
  }
}

export function assertValidPromoteArgs(title: string, focus: string): void {
  if (!title.trim()) throw new PlanPromoteError('INVALID_OPERATION', '--title cannot be empty.');
  if (!focus.trim()) throw new PlanPromoteError('INVALID_OPERATION', '--focus cannot be empty.');
  assertNoPipeOrNewline(title, 'title');
  assertNoPipeOrNewline(focus, 'focus');
}

function roadmapPathIfEligible(projectRoot: string, chain: ChainState): string | null {
  if (!chain.roadmap || chain.roadmap.state === 'SUPERSEDED') return null;
  return path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
}

/** Re-runs every plan_promote precondition (short of the pending entry's
 *  own presence, checked by the caller) against a live chain — used by both
 *  prepare and the MCP-scope preview. Throws PlanPromoteError. */
export function assertPlanPromoteGatesOpen(chain: ChainState): void {
  if (!getOperationalGate(chain, 'gate_1_open') || chain.intent.state !== 'RATIFIED') {
    throw new PlanPromoteError('GATE_BLOCKED', 'GATE 1 BLOCKED: No ratified DIR-INTENT. Run: sigma intent ratify');
  }
}

export function findPendingPlan(chain: ChainState, id: string) {
  const pending = chain.plan.pending.find(p => p.id === id);
  if (!pending) {
    throw new PlanPromoteError('INVALID_OPERATION', `Pending plan ID "${id}" not found. Run: sigma plan status to list pending plans`);
  }
  return pending;
}

export interface PromotePlanResult {
  chainVersion: string;
  version: string;
  oldRelPath: string;
  newRelPath: string;
  docReport: SigmaDocCheckReport;
}

export function planPromoteTransactionFiles(projectRoot: string, id: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const files = [chainFilePath(projectRoot, chainVersion)];
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
    } catch {
      // Left out of the journal; the throw surfaces properly downstream.
    }
  }
  const roadmapPath = roadmapPathIfEligible(projectRoot, chain);
  if (roadmapPath) files.push(roadmapPath);
  // The promoted file's destination path cannot be computed without
  // allocating a version, which nextPlanVersion() derives deterministically
  // from chain state alone — safe to compute a second time here without
  // mutating anything.
  if (pending) {
    const newVersion = nextPlanVersion(chain, chain.intent.version);
    files.push(path.join(projectRoot, 'Sigma', 'contract', `FMN-PLAN-${newVersion}.md`));
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
export function promotePlanUseCase(projectRoot: string, id: string, title: string, focus: string): PromotePlanResult {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);
  assertValidPromoteArgs(title, focus);
  assertPlanPromoteGatesOpen(chain);

  const pending = findPendingPlan(chain, id);
  const roadmapAbsPath = roadmapPathIfEligible(projectRoot, chain);
  if (!roadmapAbsPath) {
    throw new PlanPromoteError('GATE_BLOCKED', 'Gate 1.5 blocked: A ROADMAP must exist for this chain to promote a plan. Run: sigma roadmap new');
  }

  const newVersion = nextPlanVersion(chain, chain.intent.version);
  // Re-verified immediately before the move — see header (R-02).
  const oldAbsPath = assertPendingPlanCanonicalPath(projectRoot, id, pending.file);
  const newRelPath = toPosix(path.join('Sigma', 'contract', `FMN-PLAN-${newVersion}.md`));
  const newAbsPath = path.join(projectRoot, newRelPath);

  fs.ensureDirSync(path.dirname(newAbsPath));
  fs.moveSync(oldAbsPath, newAbsPath);

  promotePendingPlan(chain, id, newVersion, newRelPath, chain.intent.version, title, focus);
  writeChain(projectRoot, chainVersion, chain);
  renderRoadmapFile(roadmapAbsPath, chain);

  const docReport = validateSigmaDocFile(newAbsPath, 'plan');

  return { chainVersion, version: newVersion, oldRelPath: pending.file, newRelPath, docReport };
}
