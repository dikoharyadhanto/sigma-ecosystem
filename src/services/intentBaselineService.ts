// F05 §4.6 — `sigma intent baseline adopt`: binds the certified INTENT content
// of an already RATIFIED chain to a Git commit and a local annotated tag.
// ratify itself stays Git-independent (O-2). Must run inside the governance
// transaction, like the amendment use-case.

import path from 'path';
import {
  IntentGitBaseline,
  readActiveChain,
  readChain,
  assertChainCanMutate,
  certifyIntentDoc,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { INTENT_AMENDMENT_LOG_FILE } from '../config';
import * as git from '../engine/gitRepo';
import { ensureAnnotatedTag, intentTagName, locateIntentInRepo } from '../engine/intentGit';
import { appendIntentLog } from './intentAmendmentService';

export class IntentBaselineError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentBaselineError';
  }
}

export interface AdoptBaselineOptions {
  commit: string;
  /** Director-reviewed fallback when the certified content cannot be recovered from Git (F05 §4.6). */
  importCurrent?: boolean;
}

export interface AdoptBaselineResult {
  chainVersion: string;
  baseline: IntentGitBaseline;
  tagCreated: boolean;
  alreadyRecorded: boolean;
}

export function adoptIntentBaselineTransactionFiles(projectRoot: string, targetChainVersion?: string): string[] {
  const chainVersion = targetChainVersion ?? readActiveChain(projectRoot).chainVersion;
  return [chainFilePath(projectRoot, chainVersion), path.join(projectRoot, INTENT_AMENDMENT_LOG_FILE)];
}

export function adoptIntentBaselineUseCase(projectRoot: string, options: AdoptBaselineOptions, targetChainVersion?: string): AdoptBaselineResult {
  const { chainVersion, data: chain } = targetChainVersion
    ? { chainVersion: targetChainVersion, data: readChain(projectRoot, targetChainVersion) }
    : readActiveChain(projectRoot);
  assertChainCanMutate(chain);
  const fail = (m: string): never => { throw new IntentBaselineError('INVALID_OPERATION', m); };
  if (chain.intent.state !== 'RATIFIED') fail(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; a baseline requires RATIFIED`);

  const resolved = git.resolveCommit(projectRoot, options.commit);
  if (!resolved.ok) return fail(resolved.error);
  const existing = chain.intent.git_baseline;
  if (existing) {
    if (existing.commit === resolved.sha) return { chainVersion, baseline: existing, tagCreated: false, alreadyRecorded: true };
    return fail(`A baseline is already recorded at ${existing.commit.slice(0, 12)}; amendments advance it, adopt does not replace it`);
  }

  let located;
  try {
    located = locateIntentInRepo(projectRoot, chain);
  } catch (e) {
    return fail((e as Error).message);
  }
  const { repoRoot, rel, abs, bytes } = located;
  if (!git.isAncestor(projectRoot, resolved.sha, 'HEAD')) fail(`Commit ${resolved.sha.slice(0, 12)} is not reachable from HEAD`);
  const blob = git.blobAt(projectRoot, resolved.sha, rel);
  if (!blob) fail(`${rel} does not exist at ${resolved.sha.slice(0, 12)}`);
  const committedLf = git.lfSha256(blob!);
  const workingLf = git.lfSha256(bytes);
  const workingSha = git.sha256Hex(bytes);
  if (committedLf !== workingLf) fail(`INTENT at ${resolved.sha.slice(0, 12)} differs from the working-tree file; the baseline commit must hold exactly the current content`);
  if (git.pathStatus(repoRoot, rel) !== '') fail(`${rel} has uncommitted changes`);

  const certifiedMatches = !!chain.intent.certified_doc_sha256 && chain.intent.certified_doc_sha256 === workingSha;
  let provenance: IntentGitBaseline['provenance'] = 'ratified_commit';
  if (!certifiedMatches) {
    if (!options.importCurrent) {
      fail(
        chain.intent.certified_doc_sha256
          ? 'UNCERTIFIED_EDIT: the INTENT file differs from its certified content and no Git baseline can prove the certified content. ' +
            'Review the current content, then re-run with --import-current to adopt it as the baseline (no amendment is invented, nothing is retroactive).'
          : 'The INTENT has no certified hash. Review the current content, then re-run with --import-current to certify it as the baseline.'
      );
    }
    certifyIntentDoc(chain, abs);
    chain.intent.revision_provenance = 'imported_current_certification';
    provenance = 'imported_current';
  }

  const tag = intentTagName(chainVersion, 'base');
  let tagCreated: boolean;
  try {
    tagCreated = ensureAnnotatedTag(projectRoot, tag, resolved.sha, [
      `Sigma INTENT baseline (${provenance})`,
      `chain: ${chainVersion}`,
      `intent_revision: ${chain.intent.revision ?? 1}`,
      `doc_sha256: ${workingSha}`,
    ].join('\n')).created;
  } catch (e) {
    return fail((e as Error).message);
  }

  const baseline: IntentGitBaseline = {
    commit: resolved.sha,
    tag,
    doc_sha256: workingSha,
    doc_sha256_lf: workingLf,
    revision: chain.intent.revision ?? 1,
    provenance,
    recorded_at: new Date().toISOString(),
  };
  chain.intent.git_baseline = baseline;
  writeChain(projectRoot, chainVersion, chain);
  appendIntentLog(projectRoot, { event: 'baseline', chain: chainVersion, recorded_at: baseline.recorded_at, provenance, commit: baseline.commit, tag, doc_sha256: workingSha });
  return { chainVersion, baseline, tagCreated, alreadyRecorded: false };
}
