// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one
// use-case shared by `sigma exec humanize` (CLI) and `sigma_exec_humanize`
// (MCP control tool). Transport-agnostic on purpose.
//
// Kept separate from intentHumanizeService.ts/closeHumanizeService.ts — see
// that file's header for why. Here: `--v` selects an exec VERSION WITHIN
// the active chain's array (chain.exec.versions[]), not a different chain
// entirely like intent's `--v`. execEntry.human lives on the array entry,
// not on a top-level chain.exec.human.

import path from 'path';
import { ChainState, readActiveChain, writeChain, chainFilePath, normalizeVersionArg } from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { controlTestFailpoint } from '../engine/controlStore';

export class ExecHumanizeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ExecHumanizeError';
  }
}

export interface HumanizeExecInput {
  projectRoot: string;
  /** DEV-EXEC version to humanize instead of the active one — a version
   *  within the active chain's chain.exec.versions[], not a different
   *  chain. */
  version?: string;
  force?: boolean;
}

export interface HumanizeExecResult {
  chainVersion: string;
  version: string;
  planVersionRef: string;
  humanRelPath: string;
  ledgerRelPath: string;
}

function resolveExecEntry(chain: ChainState, version?: string) {
  const normalized = normalizeVersionArg(version);
  const execEntry = normalized
    ? chain.exec.versions.find(v => v.version === normalized)
    : chain.exec.versions.find(v => v.version === chain.exec.active_version);
  if (!execEntry) {
    throw new ExecHumanizeError('INVALID_OPERATION', normalized ? `DEV-EXEC ${normalized} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
  }
  return execEntry;
}

export function humanizeExecTransactionFiles(projectRoot: string, version?: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const execEntry = resolveExecEntry(chain, version);
  return [
    path.join(projectRoot, 'Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.md`),
    path.join(projectRoot, 'Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.fidelity.md`),
    chainFilePath(projectRoot, chainVersion),
  ];
}

export function humanizeExec(input: HumanizeExecInput): HumanizeExecResult {
  const { projectRoot, version, force = false } = input;
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const execEntry = resolveExecEntry(chain, version);

  if (execEntry.state !== 'LOCKED') {
    throw new ExecHumanizeError(
      'INVALID_OPERATION',
      `DEV-EXEC ${execEntry.version} is in state "${execEntry.state}"; humanize requires LOCKED.\n` +
      `Run: sigma exec lock --v ${execEntry.version}`
    );
  }
  const planEntry = execEntry.plan_version_ref
    ? chain.plan.versions.find(v => v.version === execEntry.plan_version_ref)
    : undefined;
  if (!planEntry || planEntry.state !== 'LOCKED') {
    throw new ExecHumanizeError(
      'INVALID_OPERATION',
      `DEV-EXEC ${execEntry.version}'s referenced FMN-PLAN (${execEntry.plan_version_ref ?? 'none'}) ` +
      `is not LOCKED. A plan+exec pair must both be LOCKED before humanize can run.`
    );
  }

  if (execEntry.human && !force) {
    throw new ExecHumanizeError(
      'INVALID_OPERATION',
      `A human projection for DEV-EXEC ${execEntry.version} already exists ` +
      `(generated ${execEntry.human.generated_at}).\n` +
      'Re-running would overwrite any content already written into it. Pass --force to proceed anyway.'
    );
  }

  const humanRelPath = toPosix(path.join('Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.md`));
  const ledgerRelPath = toPosix(path.join('Sigma', 'human', `PLAN-EXEC-HUMAN-${execEntry.version}.fidelity.md`));
  copyTemplateToArtifact('PLAN-EXEC-HUMAN-TEMPLATE.md', path.join(projectRoot, humanRelPath));
  controlTestFailpoint('exec_humanize_after_template');
  copyTemplateToArtifact('HUMAN-FIDELITY-LEDGER-TEMPLATE.md', path.join(projectRoot, ledgerRelPath));
  controlTestFailpoint('exec_humanize_after_ledger');

  execEntry.human = {
    version: execEntry.version,
    generated_at: new Date().toISOString(),
  };
  writeChain(projectRoot, chainVersion, chain);
  controlTestFailpoint('exec_humanize_after_chain');

  return { chainVersion, version: execEntry.version, planVersionRef: planEntry.version, humanRelPath, ledgerRelPath };
}
