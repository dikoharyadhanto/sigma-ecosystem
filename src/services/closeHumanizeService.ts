// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one
// use-case shared by `sigma close humanize` (CLI) and `sigma_close_humanize`
// (MCP control tool). Transport-agnostic on purpose.
//
// Kept separate from intentHumanizeService.ts/execHumanizeService.ts — see
// intentHumanizeService.ts's header for why. Here: chain.close is a single
// object (SingleCloseState | null), like chain.intent — but with no `--v`
// selector at all (the CLI command never had one; always the active
// chain's own close).

import path from 'path';
import { readActiveChain, writeChain, chainFilePath } from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { controlTestFailpoint } from '../engine/controlStore';

export class CloseHumanizeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CloseHumanizeError';
  }
}

export interface HumanizeCloseInput {
  projectRoot: string;
  force?: boolean;
}

export interface HumanizeCloseResult {
  chainVersion: string;
  version: string;
  humanRelPath: string;
  ledgerRelPath: string;
}

export function humanizeCloseTransactionFiles(projectRoot: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  if (!chain.close) {
    throw new CloseHumanizeError('INVALID_OPERATION', 'No active DIR-CLOSE found. Run: sigma close new');
  }
  const v = chain.close.version;
  return [
    path.join(projectRoot, 'Sigma', 'human', `DIR-CLOSE-HUMAN-${v}.md`),
    path.join(projectRoot, 'Sigma', 'human', `DIR-CLOSE-HUMAN-${v}.fidelity.md`),
    chainFilePath(projectRoot, chainVersion),
  ];
}

export function humanizeClose(input: HumanizeCloseInput): HumanizeCloseResult {
  const { projectRoot, force = false } = input;
  const { chainVersion, data: chain } = readActiveChain(projectRoot);

  if (!chain.close) {
    throw new CloseHumanizeError('INVALID_OPERATION', 'No active DIR-CLOSE found. Run: sigma close new');
  }
  if (chain.close.state !== 'LOCKED') {
    throw new CloseHumanizeError(
      'INVALID_OPERATION',
      `DIR-CLOSE ${chain.close.version} is in state "${chain.close.state}"; humanize requires LOCKED.\n` +
      'Run: sigma close lock'
    );
  }
  if (chain.close.human && !force) {
    throw new CloseHumanizeError(
      'INVALID_OPERATION',
      `A human projection for DIR-CLOSE ${chain.close.version} already exists ` +
      `(generated ${chain.close.human.generated_at}).\n` +
      'Re-running would overwrite any content already written into it. Pass --force to proceed anyway.'
    );
  }

  const humanRelPath = toPosix(path.join('Sigma', 'human', `DIR-CLOSE-HUMAN-${chain.close.version}.md`));
  const ledgerRelPath = toPosix(path.join('Sigma', 'human', `DIR-CLOSE-HUMAN-${chain.close.version}.fidelity.md`));
  copyTemplateToArtifact('DIR-CLOSE-HUMAN-TEMPLATE.md', path.join(projectRoot, humanRelPath));
  controlTestFailpoint('close_humanize_after_template');
  copyTemplateToArtifact('HUMAN-FIDELITY-LEDGER-TEMPLATE.md', path.join(projectRoot, ledgerRelPath));
  controlTestFailpoint('close_humanize_after_ledger');

  chain.close.human = {
    version: chain.close.version,
    generated_at: new Date().toISOString(),
  };
  writeChain(projectRoot, chainVersion, chain);
  controlTestFailpoint('close_humanize_after_chain');

  return { chainVersion, version: chain.close.version, humanRelPath, ledgerRelPath };
}
