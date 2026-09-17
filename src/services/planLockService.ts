// Stage F (W2 batch) — the use-case shared by `sigma plan lock` (CLI) and
// sigma_commit_plan_lock's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/plan.ts keeps printing).

import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  chainFilePath,
  lockPlanVersion,
  resolveTargetVersion,
  assertChainCanMutate,
} from '../engine/chain';
import { validateSigmaDocFile, ensureSigmaDocEligible, SigmaDocCheckReport } from '../utils/docCheck';

export class PlanLockError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PlanLockError';
  }
}

function planDocPath(projectRoot: string, chain: ChainState, version: string): string {
  const entry = chain.plan.versions.find(v => v.version === version);
  if (!entry) throw new PlanLockError('INVALID_OPERATION', `FMN-PLAN ${version} not found.`);
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'contract', `FMN-PLAN-${entry.version}.md`));
}

/**
 * Resolves which DRAFT FMN-PLAN version a lock should target, mirroring the
 * CLI's `resolveTargetVersion()` disambiguation: explicit version wins, then
 * the sole open DRAFT, otherwise an actionable error (none open, or more
 * than one and no version was given).
 */
export function resolvePlanLockTarget(chain: ChainState, explicitVersion?: string): string {
  const resolution = resolveTargetVersion(chain.plan.versions, explicitVersion);
  if (resolution.kind === 'empty') {
    throw new PlanLockError('INVALID_OPERATION', 'No DRAFT FMN-PLAN to lock. Run: sigma plan new');
  }
  if (resolution.kind === 'ambiguous') {
    throw new PlanLockError(
      'INVALID_OPERATION',
      `${resolution.candidates.length} DRAFT FMN-PLANs are open: ${resolution.candidates.join(', ')}. Specify which one to lock.`
    );
  }
  return resolution.version;
}

export interface LockPlanDraftResult {
  chainVersion: string;
  version: string;
  docReport: SigmaDocCheckReport;
}

export function lockPlanDraftTransactionFiles(projectRoot: string): string[] {
  const { chainVersion } = readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion)];
}

/**
 * Locks the active chain's DRAFT FMN-PLAN identified by `version` (or the
 * sole open DRAFT when omitted), opening Gate 2. Throws PlanLockError
 * (INVALID_OPERATION) for every business-rule rejection — ambiguous/missing
 * target, or the doc fails structural/eligibility validation.
 */
export function lockPlanDraftUseCase(projectRoot: string, version?: string): LockPlanDraftResult {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);

  const targetVersion = resolvePlanLockTarget(chain, version);
  const absPath = planDocPath(projectRoot, chain, targetVersion);
  const report = validateSigmaDocFile(absPath, 'plan');
  try {
    ensureSigmaDocEligible(report, 'plan');
  } catch (e) {
    throw new PlanLockError('INVALID_OPERATION', (e as Error).message);
  }

  const lockedVersion = lockPlanVersion(chain, targetVersion);
  writeChain(projectRoot, chainVersion, chain);

  return { chainVersion, version: lockedVersion, docReport: report };
}
