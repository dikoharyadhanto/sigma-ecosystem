// The one use case shared by `sigma review new` (CLI) and `sigma_create_review`
// (MCP control tool). Transport-agnostic: no Commander, no console output.
//
// A PRODUCT REVIEW is recognised by its file, Sigma/review/PRODUCT-REVIEW-vN.md,
// one per INTENT, with no chain state (see commands/review.ts). Creating it
// therefore writes exactly one file and nothing else.

import path from 'path';
import { ChainState, readActiveChain, assertChainCanMutate } from '../engine/chain';
import { artifactFileName, existingArtifactNames } from '../engine/artifactNames';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { validateSigmaDocFile, SigmaDocCheckReport } from '../utils/docCheck';

export class ReviewNewError extends Error {
  constructor(public readonly code: 'GATE_BLOCKED' | 'INVALID_OPERATION', message: string) {
    super(message);
    this.name = 'ReviewNewError';
  }
}

export interface ReviewNewTarget {
  chain: ChainState;
  chainVersion: string;
  /** Project-relative posix path the review will be written to. */
  relPath: string;
}

/** Every `review new` precondition, checked without writing. Throws ReviewNewError for a refusal. */
export function resolveReviewNewTarget(projectRoot: string): ReviewNewTarget {
  const { data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);
  if (chain.intent.state !== 'RATIFIED') {
    throw new ReviewNewError('GATE_BLOCKED', 'PRODUCT REVIEW requires a RATIFIED INTENT. Run: sigma intent ratify');
  }
  const version = chain.chain_version;
  const [existing] = existingArtifactNames(projectRoot, 'review', 'review', version);
  if (existing) {
    throw new ReviewNewError('INVALID_OPERATION', `PRODUCT REVIEW already exists: Sigma/review/${existing}. Only one is kept per INTENT.`);
  }
  return { chain, chainVersion: version, relPath: toPosix(path.join('Sigma', 'review', artifactFileName('review', version))) };
}

/** The single file a `review new` may create, absolute, for a control transaction. */
export function reviewNewTransactionFiles(projectRoot: string): string[] {
  return [path.join(projectRoot, resolveReviewNewTarget(projectRoot).relPath)];
}

export interface CreateReviewResult {
  chainVersion: string;
  relPath: string;
  docReport: SigmaDocCheckReport;
}

export function createReviewDraft(projectRoot: string): CreateReviewResult {
  const target = resolveReviewNewTarget(projectRoot);
  copyTemplateToArtifact('PRODUCT-REVIEW-TEMPLATE.md', path.join(projectRoot, target.relPath), projectRoot);
  const docReport = validateSigmaDocFile(path.join(projectRoot, target.relPath), 'review');
  return { chainVersion: target.chainVersion, relPath: target.relPath, docReport };
}
