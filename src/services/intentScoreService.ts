// Stage F (W2 batch) — the use-case shared by `sigma intent score` (CLI) and
// sigma_commit_intent_score's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/intent.ts keeps printing).

import {
  readActiveChain,
  readChain,
  assertChainCanMutate,
  recordArcScore,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { renderIntentHistoryFile, intentHistoryPath } from '../utils/intentHistory';

export class IntentScoreError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentScoreError';
  }
}

export interface RecordArcScoreResult {
  chainVersion: string;
  version: string;
  score: number;
  notes: string;
}

export function intentScoreTransactionFiles(projectRoot: string, targetChainVersion?: string): string[] {
  const { chainVersion } = targetChainVersion
    ? { chainVersion: targetChainVersion }
    : readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion), intentHistoryPath(projectRoot)];
}

/**
 * Records an ARC Satisfaction Score against a RATIFIED DIR-INTENT — the
 * active chain by default, or `targetChainVersion` (mirrors CLI's `--v`).
 * Throws IntentScoreError (INVALID_OPERATION) for every business-rule
 * rejection (not RATIFIED, score out of range, notes containing `|`/newline)
 * so the caller gets an actionable message.
 */
export function recordArcScoreUseCase(projectRoot: string, score: number, notes: string, targetChainVersion?: string): RecordArcScoreResult {
  const { chainVersion, data: chain } = targetChainVersion
    ? { chainVersion: targetChainVersion, data: readChain(projectRoot, targetChainVersion) }
    : readActiveChain(projectRoot);
  assertChainCanMutate(chain);

  try {
    recordArcScore(chain, score, notes);
  } catch (e) {
    throw new IntentScoreError('INVALID_OPERATION', (e as Error).message);
  }

  writeChain(projectRoot, chainVersion, chain);
  renderIntentHistoryFile(projectRoot);

  return { chainVersion, version: chain.intent.version, score, notes };
}
