import { effectiveLifecycleGates } from '../engine/lifecycleView';
import { resolveLifecycleModel } from '../engine/lifecycle';
// Stage F (W2 batch, continued) — the use-case shared by `sigma close lock`
// (CLI) and sigma_commit_close_lock's mutate step (MCP control tool).
// Transport-agnostic: no Commander, no console.log, no interactive prompt —
// mirrors intentRatifyService.ts's split. The CLI's interactive
// `promptApprove()`/`--yes` gate has no MCP equivalent: the Director
// approval record IS the explicit confirmation for this transition, same as
// every other W2 tool in this batch.

import path from 'path';
import {
  ChainState,
  readActiveChain,
  assertChainCanMutate,
  hasCleanGate3Chain,
  describeGate3Blockers,
  lockActiveClose,
  lockActiveRoadmap,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { validateSigmaDocFile, SigmaDocCheckReport } from '../utils/docCheck';
import { defaultArtifactRel } from '../engine/artifactNames';

export class CloseLockError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CloseLockError';
  }
}

export function closeDocPath(projectRoot: string, chain: ChainState): string {
  if (!chain.close) throw new CloseLockError('INVALID_OPERATION', 'No active DIR-CLOSE found. Run: sigma close new');
  return path.join(projectRoot, chain.close.file ?? defaultArtifactRel(projectRoot, 'close', 'close', chain.close.version));
}

/**
 * A CLOSE does not stop new work, but it can only be locked once nothing is
 * left open: every LOCKED PLAN paired with exactly one LOCKED EXEC and nothing
 * in DRAFT or APPROVED. Applies to every lifecycle model; the paired lifecycle
 * also needs its contract evidence to verify. Shared by the CLI, the use case,
 * and the MCP prepare step so they cannot disagree.
 */
export function assertCloseLockGate3(projectRoot: string, chain: ChainState): void {
  const paired = resolveLifecycleModel(chain) === 'paired_approval';
  const clean = hasCleanGate3Chain(chain) && (!paired || effectiveLifecycleGates(projectRoot, chain).gate_3_satisfied);
  if (clean) return;
  const open = describeGate3Blockers(chain);
  const lines = ['GATE 3 BLOCKED: the chain still has open work, so the CLOSE cannot be locked.', ...open.map(r => `  ${r}`)];
  lines.push('Every locked plan needs exactly one locked exec with valid contract evidence, and nothing may be left in DRAFT/APPROVED.');
  lines.push('A CLOSE does not prevent new work: finish it, or abandon what is no longer wanted (sigma plan supersede), then lock.');
  throw new CloseLockError('GATE_BLOCKED', lines.join('\n'));
}

export interface LockCloseResult {
  chainVersion: string;
  version: string;
  docReport: SigmaDocCheckReport;
  roadmapLocked: string | null;
}

export function closeLockTransactionFiles(projectRoot: string): string[] {
  const { chainVersion } = readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion)];
}

/**
 * Locks the active chain's DRAFT DIR-CLOSE (lifecycle -> CLOSED), auto-
 * locking a still-DRAFT ROADMAP as a side effect. Throws CloseLockError
 * (INVALID_OPERATION) for every business-rule rejection — no active DRAFT
 * close, or the doc fails structural/eligibility validation.
 */
export function lockCloseUseCase(projectRoot: string): LockCloseResult {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);
  assertCloseLockGate3(projectRoot, chain);

  if (!chain.close || chain.close.state !== 'DRAFT') {
    throw new CloseLockError('INVALID_OPERATION', 'Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
  }
  const closeVersion = chain.close.version;
  const roadmapToLock = chain.roadmap && chain.roadmap.state === 'DRAFT' ? chain.roadmap.version : null;

  // Locking is a stamp that the mandate is finished. The gate sits before
  // `close new` (Gate 3 and the PRODUCT REVIEW verdicts), so the document report
  // is returned for information and never blocks the lock.
  const absPath = closeDocPath(projectRoot, chain);
  const report = validateSigmaDocFile(absPath, 'close');

  if (roadmapToLock) {
    lockActiveRoadmap(chain);
  }
  lockActiveClose(chain);
  writeChain(projectRoot, chainVersion, chain);

  return { chainVersion, version: closeVersion, docReport: report, roadmapLocked: roadmapToLock };
}
