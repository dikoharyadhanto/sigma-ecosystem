// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §13, §14 Stage D — the use-case
// shared by `sigma intent ratify` (CLI) and sigma_commit_intent_ratify's
// mutate step (MCP control tool). Transport-agnostic: no Commander, no
// console.log — the CLI keeps printing the doc report itself (see
// src/commands/intent.ts), this only returns it.

import path from 'path';
import {
  ChainState,
  readActiveChain,
  assertChainCanMutate,
  ratifyIntent,
  certifyIntentDoc,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { validateSigmaDocFile, ensureSigmaDocEligible, SigmaDocCheckReport } from '../utils/docCheck';
import { intentHistoryPath, renderIntentHistoryFile } from '../utils/intentHistory';
import { controlTestFailpoint } from '../engine/controlStore';

export class IntentRatifyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentRatifyError';
  }
}

function intentDocPath(projectRoot: string, chain: ChainState): string {
  return path.join(projectRoot, chain.intent.file ?? path.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
}

export interface RatifyIntentDraftResult {
  chainVersion: string;
  version: string;
  docReport: SigmaDocCheckReport;
}

export function ratifyIntentDraftTransactionFiles(projectRoot: string): string[] {
  const { chainVersion } = readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion), intentHistoryPath(projectRoot)];
}

/**
 * Ratifies the active chain's DRAFT intent. Throws IntentRatifyError
 * (INVALID_OPERATION) for every business-rule rejection — not DRAFT, or the
 * doc fails structural/lock-requirement validation — so the caller (CLI or
 * MCP) gets an actionable message rather than an anonymised internal error.
 * Anything assertChainCanMutate() throws for corrupted/invalid chain state is
 * left untyped on purpose — that is not a normal, caller-fixable rejection.
 */
export function ratifyIntentDraft(projectRoot: string): RatifyIntentDraftResult {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);

  if (chain.intent.state !== 'DRAFT') {
    throw new IntentRatifyError('INVALID_OPERATION', 'Active DIR-INTENT is not in DRAFT state. Cannot ratify.');
  }

  const absPath = intentDocPath(projectRoot, chain);
  const report = validateSigmaDocFile(absPath, 'intent');
  try {
    ensureSigmaDocEligible(report, 'intent');
  } catch (e) {
    throw new IntentRatifyError('INVALID_OPERATION', (e as Error).message);
  }

  const version = chain.intent.version;
  ratifyIntent(chain);
  certifyIntentDoc(chain, absPath);
  writeChain(projectRoot, chainVersion, chain);
  controlTestFailpoint('ratify_after_chain');
  renderIntentHistoryFile(projectRoot);
  controlTestFailpoint('ratify_after_history');

  return { chainVersion, version, docReport: report };
}
