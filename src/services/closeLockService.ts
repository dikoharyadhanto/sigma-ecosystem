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
  lockActiveClose,
  lockActiveRoadmap,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { validateSigmaDocFile, ensureSigmaDocEligible, SigmaDocCheckReport } from '../utils/docCheck';

export class CloseLockError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CloseLockError';
  }
}

export function closeDocPath(projectRoot: string, chain: ChainState): string {
  if (!chain.close) throw new CloseLockError('INVALID_OPERATION', 'No active DIR-CLOSE found. Run: sigma close new');
  return path.join(projectRoot, chain.close.file ?? path.join('Sigma', 'close', `DIR-CLOSE-${chain.close.version}.md`));
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

  if (!chain.close || chain.close.state !== 'DRAFT') {
    throw new CloseLockError('INVALID_OPERATION', 'Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
  }
  const closeVersion = chain.close.version;
  const roadmapToLock = chain.roadmap && chain.roadmap.state === 'DRAFT' ? chain.roadmap.version : null;

  const absPath = closeDocPath(projectRoot, chain);
  const report = validateSigmaDocFile(absPath, 'close');
  try {
    ensureSigmaDocEligible(report, 'close');
  } catch (e) {
    throw new CloseLockError('INVALID_OPERATION', (e as Error).message);
  }

  if (roadmapToLock) {
    lockActiveRoadmap(chain);
  }
  lockActiveClose(chain);
  writeChain(projectRoot, chainVersion, chain);

  return { chainVersion, version: closeVersion, docReport: report, roadmapLocked: roadmapToLock };
}
