// Stage F (W2 batch) — the use-case shared by `sigma intent amendment` (CLI)
// and sigma_commit_intent_amendment's mutate step (MCP control tool).
// Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split (src/commands/intent.ts keeps printing).
//
// F05 — Git-based amendment (option B of F05 §4.3): the Director approves the
// reviewed content, the content is committed, and this use-case is the single
// effective point. It verifies the result commit, creates the annotated tag,
// and only then writes the chain. The INTENT document is never written here:
// the bytes reviewed, committed and certified are the same bytes.
//
// Two phases because MCP control mutations have a short lease-safety budget
// (CONTROL_MUTATION_MAX_MS) that spawning Git cannot meet:
//   1. verifyAndTagAmendment — every Git call (verification, diff stat, tag).
//      The MCP tool runs it in checkPreconditions, still under the project lock.
//   2. applyVerifiedAmendment — chain mutation, certification and log only.
// recordIntentAmendmentUseCase runs both for the CLI.

import path from 'path';
import fs from 'fs-extra';
import {
  AmendmentEntry,
  readActiveChain,
  readChain,
  assertChainCanMutate,
  recordIntentAmendment,
  certifyIntentDoc,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { INTENT_AMENDMENT_LOG_FILE } from '../config';
import { diffAgainstWorktree, lfSha256 } from '../engine/gitRepo';
import { ensureAnnotatedTag, intentAbsPath, intentTagName, nextAmendmentIdOf, verifyResultCommit, VerifiedResultCommit } from '../engine/intentGit';

export class IntentAmendmentError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentAmendmentError';
  }
}

export interface AmendmentRequest {
  change: string;
  purposeChanged: boolean;
  /** Explicit commit reference holding the approved content (F05 §4.5). */
  commit: string;
  /** Raw-byte SHA-256 of the INTENT file the Director reviewed (from `amendment preview`). */
  docSha256?: string;
}

export interface VerifiedAmendment {
  chainVersion: string;
  verified: VerifiedResultCommit;
  tag: string;
  tagCreated: boolean;
  diffStat: string;
  amendmentId: string;
}

export interface RecordIntentAmendmentResult {
  chainVersion: string;
  version: string;
  entry: AmendmentEntry;
  certifiedDocSha256: string | undefined;
  tag: string;
  tagCreated: boolean;
  commit: string;
}

export function intentAmendmentTransactionFiles(projectRoot: string, targetChainVersion?: string): string[] {
  const chainVersion = targetChainVersion ?? readActiveChain(projectRoot).chainVersion;
  return [chainFilePath(projectRoot, chainVersion), path.join(projectRoot, INTENT_AMENDMENT_LOG_FILE)];
}

export function appendIntentLog(projectRoot: string, record: Record<string, unknown>): void {
  const logPath = path.join(projectRoot, INTENT_AMENDMENT_LOG_FILE);
  fs.ensureFileSync(logPath);
  fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
}

function loadChain(projectRoot: string, targetChainVersion?: string) {
  return targetChainVersion
    ? { chainVersion: targetChainVersion, data: readChain(projectRoot, targetChainVersion) }
    : readActiveChain(projectRoot);
}

/**
 * Phase 1 — every Git step. Throws IntentAmendmentError (INVALID_OPERATION) for each
 * business-rule rejection (not RATIFIED, empty/malformed --change, any unfinished Git
 * step) so the caller gets an actionable message. The tag is created last, after all
 * verification; a rerun adopts a tag left by an interrupted attempt (same commit only)
 * and a tag on any other commit is never moved or overwritten.
 */
export function verifyAndTagAmendment(projectRoot: string, request: AmendmentRequest, targetChainVersion?: string): VerifiedAmendment {
  const { chainVersion, data: chain } = loadChain(projectRoot, targetChainVersion);
  assertChainCanMutate(chain);
  if (chain.intent.state !== 'RATIFIED') {
    throw new IntentAmendmentError('INVALID_OPERATION', `INTENT ${chain.intent.version} is in state "${chain.intent.state}"; amendment requires RATIFIED`);
  }
  if (typeof request.purposeChanged !== 'boolean') {
    throw new IntentAmendmentError('INVALID_OPERATION', 'purpose_changed must be declared explicitly (yes or no).');
  }
  // Validate the summary before any Git step so a bad --change never leaves a tag behind.
  if (!request.change.trim()) throw new IntentAmendmentError('INVALID_OPERATION', '--change cannot be empty');
  if (/[|\n\r]/.test(request.change)) {
    throw new IntentAmendmentError('INVALID_OPERATION', '--change cannot contain "|" or a newline (single-line amendment summary)');
  }

  let verified: VerifiedResultCommit;
  try {
    verified = verifyResultCommit(projectRoot, chainVersion, chain, request.commit, request.docSha256);
  } catch (e) {
    throw new IntentAmendmentError('INVALID_OPERATION', (e as Error).message);
  }
  const baseline = chain.intent.git_baseline!;
  const amendmentId = nextAmendmentIdOf(chain);
  const tag = intentTagName(chainVersion, amendmentId);
  const diffStat = diffAgainstWorktree(verified.repo_root, baseline.commit, verified.repo_path).stat;
  const message = [
    `Sigma INTENT amendment ${amendmentId}`,
    `chain: ${chainVersion}`,
    `intent_revision: ${(chain.intent.revision ?? 0) + 1}`,
    `doc_sha256: ${verified.working_sha256}`,
    `baseline_commit: ${baseline.commit}`,
    `purpose_changed: ${request.purposeChanged ? 'yes' : 'no'}`,
    `change: ${request.change.trim()}`,
  ].join('\n');

  let tagCreated: boolean;
  try {
    // Order matters (F05 §4.3): tag first, chain second. A chain that claims
    // completion without its tag is never written.
    tagCreated = ensureAnnotatedTag(projectRoot, tag, verified.commit, message).created;
  } catch (e) {
    throw new IntentAmendmentError('INVALID_OPERATION', (e as Error).message);
  }
  return { chainVersion, verified, tag, tagCreated, diffStat, amendmentId };
}

/** Phase 2 — no Git subprocess: records the entry, certifies the file bytes, writes chain and log. */
export function applyVerifiedAmendment(projectRoot: string, request: AmendmentRequest, v: VerifiedAmendment, targetChainVersion?: string): RecordIntentAmendmentResult {
  const { chainVersion, data: chain } = loadChain(projectRoot, targetChainVersion ?? v.chainVersion);
  assertChainCanMutate(chain);
  const baseline = chain.intent.git_baseline;
  if (!baseline || nextAmendmentIdOf(chain) !== v.amendmentId) {
    throw new IntentAmendmentError('STALE_ARTIFACT', 'The chain changed since the commit was verified; preview and approve again.');
  }

  let entry: AmendmentEntry;
  try {
    entry = recordIntentAmendment(chain, request.change, {
      purpose_changed: request.purposeChanged,
      baseline_commit: baseline.commit,
      result_commit: v.verified.commit,
      result_tag: v.tag,
      doc_sha256: v.verified.working_sha256,
      doc_sha256_lf: v.verified.working_sha256_lf,
      ...(v.diffStat ? { diff_stat: v.diffStat } : {}),
    });
  } catch (e) {
    throw new IntentAmendmentError('INVALID_OPERATION', (e as Error).message);
  }

  const absPath = intentAbsPath(projectRoot, chain);
  if (lfSha256(fs.readFileSync(absPath)) !== v.verified.working_sha256_lf) {
    throw new IntentAmendmentError('STALE_ARTIFACT', 'The INTENT file changed during the transaction; preview and approve again.');
  }
  certifyIntentDoc(chain, absPath);
  if (chain.intent.certified_doc_sha256 !== v.verified.working_sha256) {
    throw new IntentAmendmentError('STALE_ARTIFACT', 'The INTENT file changed during the transaction; preview and approve again.');
  }
  chain.intent.git_baseline = {
    commit: v.verified.commit,
    tag: v.tag,
    doc_sha256: v.verified.working_sha256,
    doc_sha256_lf: v.verified.working_sha256_lf,
    revision: chain.intent.revision ?? (baseline.revision + 1),
    provenance: 'amendment',
    recorded_at: entry.created_at,
    amendment: entry.id,
  };
  writeChain(projectRoot, chainVersion, chain);

  appendIntentLog(projectRoot, {
    event: 'amendment',
    chain: chainVersion,
    id: entry.id,
    created_at: entry.created_at,
    director_approved_at: entry.director_approved_at,
    change: entry.change,
    purpose_changed: request.purposeChanged,
    baseline_commit: baseline.commit,
    result_commit: v.verified.commit,
    result_tag: v.tag,
    doc_sha256: chain.intent.certified_doc_sha256,
  });

  return { chainVersion, version: chain.intent.version, entry, certifiedDocSha256: chain.intent.certified_doc_sha256, tag: v.tag, tagCreated: v.tagCreated, commit: v.verified.commit };
}

/**
 * Both phases, for the CLI (runs inside withGovernanceTransaction, which has no
 * mutation-time budget). Must run inside the project's governance transaction.
 */
export function recordIntentAmendmentUseCase(projectRoot: string, request: AmendmentRequest, targetChainVersion?: string): RecordIntentAmendmentResult {
  const verified = verifyAndTagAmendment(projectRoot, request, targetChainVersion);
  return applyVerifiedAmendment(projectRoot, request, verified, targetChainVersion);
}
