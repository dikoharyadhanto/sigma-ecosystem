// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, Stage E W1 — the one
// use-case shared by `sigma intent humanize` (CLI) and `sigma_intent_humanize`
// (MCP control tool). Transport-agnostic on purpose: no Commander, no
// console.log.
//
// chain.intent.human is a bookkeeping record, not a gate transition — this
// precondition ("requires RATIFIED") and the already-exists guard are both
// artifact-readiness checks, not registry gate checks (chain.gates.* is
// never read here), so both use INVALID_OPERATION, not GATE_BLOCKED.
//
// Kept separate from execHumanizeService.ts/closeHumanizeService.ts rather
// than one generic function — intent's --v selects a DIFFERENT CHAIN
// entirely (readChain(root, v) vs the active one), structurally unlike
// exec's --v (selects a version within the active chain's array) or close
// (no selector at all). Forcing one shape would hide that difference, not
// simplify it — see planDraftService.ts/execDraftService.ts precedent for
// the same reasoning applied to draft creation.

import path from 'path';
import { ChainState, readActiveChain, readChain, writeChain, chainFilePath, normalizeVersionArg } from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { controlTestFailpoint } from '../engine/controlStore';

export class IntentHumanizeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentHumanizeError';
  }
}

export interface HumanizeIntentInput {
  projectRoot: string;
  /** Chain version to humanize instead of the active one — mirrors CLI's
   *  `--v`. Selects an entirely different chain file, not a version within
   *  the active one. */
  version?: string;
  force?: boolean;
}

export interface HumanizeIntentResult {
  chainVersion: string;
  version: string;
  humanRelPath: string;
  ledgerRelPath: string;
}

function resolveChain(projectRoot: string, version?: string): { chainVersion: string; data: ChainState } {
  const normalized = normalizeVersionArg(version);
  return normalized ? { chainVersion: normalized, data: readChain(projectRoot, normalized) } : readActiveChain(projectRoot);
}

export function humanizeIntentTransactionFiles(projectRoot: string, version?: string): string[] {
  const { chainVersion, data: chain } = resolveChain(projectRoot, version);
  const v = chain.intent.version;
  return [
    path.join(projectRoot, 'Sigma', 'human', `DIR-INTENT-HUMAN-${v}.md`),
    path.join(projectRoot, 'Sigma', 'human', `DIR-INTENT-HUMAN-${v}.fidelity.md`),
    chainFilePath(projectRoot, chainVersion),
  ];
}

export function humanizeIntent(input: HumanizeIntentInput): HumanizeIntentResult {
  const { projectRoot, version, force = false } = input;
  const { chainVersion, data: chain } = resolveChain(projectRoot, version);

  if (chain.intent.state !== 'RATIFIED') {
    throw new IntentHumanizeError(
      'INVALID_OPERATION',
      `INTENT ${chain.intent.version} is in state "${chain.intent.state}"; humanize requires RATIFIED.\n` +
      'Run: sigma intent ratify'
    );
  }
  if (chain.intent.human && !force) {
    throw new IntentHumanizeError(
      'INVALID_OPERATION',
      `A human projection for INTENT ${chain.intent.version} already exists ` +
      `(generated ${chain.intent.human.generated_at}).\n` +
      'Re-running would overwrite any content already written into it. Pass --force to proceed anyway.'
    );
  }

  const humanRelPath = toPosix(path.join('Sigma', 'human', `DIR-INTENT-HUMAN-${chain.intent.version}.md`));
  const ledgerRelPath = toPosix(path.join('Sigma', 'human', `DIR-INTENT-HUMAN-${chain.intent.version}.fidelity.md`));
  copyTemplateToArtifact('DIR-INTENT-HUMAN-TEMPLATE.md', path.join(projectRoot, humanRelPath));
  controlTestFailpoint('intent_humanize_after_template');
  copyTemplateToArtifact('HUMAN-FIDELITY-LEDGER-TEMPLATE.md', path.join(projectRoot, ledgerRelPath));
  controlTestFailpoint('intent_humanize_after_ledger');

  chain.intent.human = {
    version: chain.intent.version,
    generated_at: new Date().toISOString(),
  };
  writeChain(projectRoot, chainVersion, chain);
  controlTestFailpoint('intent_humanize_after_chain');

  return { chainVersion, version: chain.intent.version, humanRelPath, ledgerRelPath };
}
