// Stage F (W2 batch) — the use-case shared by `sigma intent amendment` (CLI)
// and sigma_commit_intent_amendment's mutate step (MCP control tool).
// Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split (src/commands/intent.ts keeps printing).

import path from 'path';
import fs from 'fs-extra';
import {
  ChainState,
  AmendmentEntry,
  readActiveChain,
  readChain,
  assertChainCanMutate,
  recordIntentAmendment,
  certifyIntentDoc,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { renderAmendmentHistory } from '../utils/amendmentHistory';
import { INTENT_AMENDMENT_LOG_FILE } from '../config';

export class IntentAmendmentError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentAmendmentError';
  }
}

function intentDocPath(projectRoot: string, chain: ChainState): string {
  return path.join(projectRoot, chain.intent.file ?? path.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
}

export interface RecordIntentAmendmentResult {
  chainVersion: string;
  version: string;
  entry: AmendmentEntry;
  certifiedDocSha256: string | undefined;
}

export function intentAmendmentTransactionFiles(projectRoot: string, targetChainVersion?: string): string[] {
  const { chainVersion, data: chain } = targetChainVersion
    ? { chainVersion: targetChainVersion, data: readChain(projectRoot, targetChainVersion) }
    : readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion), intentDocPath(projectRoot, chain), path.join(projectRoot, INTENT_AMENDMENT_LOG_FILE)];
}

/**
 * Records a Director-approved Amendment against a RATIFIED DIR-INTENT —
 * the active chain by default, or `targetChainVersion` (mirrors CLI's
 * `--v`). Throws IntentAmendmentError (INVALID_OPERATION) for every
 * business-rule rejection (not RATIFIED, empty/malformed --change) so the
 * caller gets an actionable message. Chain-corruption errors from
 * assertChainCanMutate() are left untyped on purpose, same discipline as
 * ratifyIntentDraft().
 */
export function recordIntentAmendmentUseCase(projectRoot: string, change: string, targetChainVersion?: string): RecordIntentAmendmentResult {
  const { chainVersion, data: chain } = targetChainVersion
    ? { chainVersion: targetChainVersion, data: readChain(projectRoot, targetChainVersion) }
    : readActiveChain(projectRoot);
  assertChainCanMutate(chain);

  let entry: AmendmentEntry;
  try {
    entry = recordIntentAmendment(chain, change);
  } catch (e) {
    throw new IntentAmendmentError('INVALID_OPERATION', (e as Error).message);
  }

  const absPath = intentDocPath(projectRoot, chain);
  renderAmendmentHistory(absPath, chain);
  certifyIntentDoc(chain, absPath);
  writeChain(projectRoot, chainVersion, chain);

  const logPath = path.join(projectRoot, INTENT_AMENDMENT_LOG_FILE);
  fs.ensureFileSync(logPath);
  fs.appendFileSync(
    logPath,
    JSON.stringify({
      chain: chainVersion,
      id: entry.id,
      created_at: entry.created_at,
      director_approved_at: entry.director_approved_at,
      change: entry.change,
      doc_sha256: chain.intent.certified_doc_sha256,
    }) + '\n',
  );

  return { chainVersion, version: chain.intent.version, entry, certifiedDocSha256: chain.intent.certified_doc_sha256 };
}
