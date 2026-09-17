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

export class PlanPromoteError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PlanPromoteError';
  }
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
}

export function planPromoteTransactionFiles(projectRoot: string, id: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const files = [chainFilePath(projectRoot, chainVersion)];
  const pending = chain.plan.pending.find(p => p.id === id);
  if (pending) files.push(path.join(projectRoot, pending.file));
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
 * Overview. Throws PlanPromoteError (GATE_BLOCKED / INVALID_OPERATION) for
 * every business-rule rejection.
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
  const oldAbsPath = path.join(projectRoot, pending.file);
  const newRelPath = toPosix(path.join('Sigma', 'contract', `FMN-PLAN-${newVersion}.md`));
  const newAbsPath = path.join(projectRoot, newRelPath);

  fs.ensureDirSync(path.dirname(newAbsPath));
  fs.moveSync(oldAbsPath, newAbsPath);

  promotePendingPlan(chain, id, newVersion, newRelPath, chain.intent.version, title, focus);
  writeChain(projectRoot, chainVersion, chain);
  renderRoadmapFile(roadmapAbsPath, chain);

  return { chainVersion, version: newVersion, oldRelPath: pending.file, newRelPath };
}
