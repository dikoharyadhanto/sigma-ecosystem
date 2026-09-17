// Stage F (W2 batch) — the use-case shared by `sigma exec lock` (CLI) and
// sigma_commit_exec_lock's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/exec.ts keeps printing).

import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  chainFilePath,
  lockExecVersion,
  resolveTargetVersion,
  assertChainCanMutate,
} from '../engine/chain';
import { validateSigmaDocFile, ensureSigmaDocEligible, SigmaDocCheckReport } from '../utils/docCheck';

export class ExecLockError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ExecLockError';
  }
}

function execDocPath(projectRoot: string, chain: ChainState, version: string): string {
  const entry = chain.exec.versions.find(v => v.version === version);
  if (!entry) throw new ExecLockError('INVALID_OPERATION', `DEV-EXEC ${version} not found.`);
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'evidence', `DEV-EXEC-${entry.version}.md`));
}

/**
 * Resolves which DRAFT DEV-EXEC version a lock should target, mirroring the
 * CLI's `resolveTargetVersion()` disambiguation: explicit version wins, then
 * the sole open DRAFT, otherwise an actionable error (none open, or more
 * than one and no version was given).
 */
export function resolveExecLockTarget(chain: ChainState, explicitVersion?: string): string {
  const resolution = resolveTargetVersion(chain.exec.versions, explicitVersion);
  if (resolution.kind === 'empty') {
    throw new ExecLockError('INVALID_OPERATION', 'No DRAFT DEV-EXEC to lock. Run: sigma exec new');
  }
  if (resolution.kind === 'ambiguous') {
    const described = resolution.candidates
      .map(v => {
        const entry = chain.exec.versions.find(e => e.version === v);
        return entry?.plan_version_ref ? `${v} (plan ${entry.plan_version_ref})` : v;
      })
      .join(', ');
    throw new ExecLockError(
      'INVALID_OPERATION',
      `${resolution.candidates.length} DRAFT DEV-EXECs are open: ${described}\n` +
        `Specify which one to lock: sigma exec lock --v ${resolution.candidates[0]}`
    );
  }
  return resolution.version;
}

export interface LockExecDraftResult {
  chainVersion: string;
  version: string;
  docReport: SigmaDocCheckReport;
  gate3Satisfied: boolean;
}

export function lockExecDraftTransactionFiles(projectRoot: string): string[] {
  const { chainVersion } = readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion)];
}

/**
 * Locks the active chain's DRAFT DEV-EXEC identified by `version` (or the
 * sole open DRAFT when omitted), re-evaluating Gate 3. Throws ExecLockError
 * (INVALID_OPERATION) for every business-rule rejection — ambiguous/missing
 * target, or the doc fails structural/eligibility validation.
 */
export function lockExecDraftUseCase(projectRoot: string, version?: string): LockExecDraftResult {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);

  const targetVersion = resolveExecLockTarget(chain, version);
  const absPath = execDocPath(projectRoot, chain, targetVersion);
  const report = validateSigmaDocFile(absPath, 'exec');
  try {
    ensureSigmaDocEligible(report, 'exec');
  } catch (e) {
    throw new ExecLockError('INVALID_OPERATION', (e as Error).message);
  }

  lockExecVersion(chain, targetVersion);
  writeChain(projectRoot, chainVersion, chain);

  return { chainVersion, version: targetVersion, docReport: report, gate3Satisfied: chain.gates.gate_3_satisfied };
}
