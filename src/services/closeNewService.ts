// Stage F (W2 batch) — the use-case shared by `sigma close new` (CLI) and
// sigma_commit_close_new's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/close.ts keeps printing).
//
// Unlike the other four W2 pilots in this batch, this operation creates a
// DIR-CLOSE artifact that does not exist yet — there is nothing to freeze a
// pre-existing sha256 against. The MCP control tool's operation ticket
// therefore carries `target: null` and relies on `expected_state_revision`
// alone for drift detection. The PRODUCT REVIEW verdicts live in their own file
// and are not covered by state_revision, so createCloseDraftUseCase() re-runs
// every precondition (Gate 3, PRODUCT REVIEW verdicts) before writing anything.

import path from 'path';
import { effectiveLifecycleGates } from '../engine/lifecycleView';
import {
  ChainState,
  readActiveChain,
  assertChainCanMutate,
  hasCleanGate3Chain,
  describeGate3Blockers,
  registerCloseDraft,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import {
  validateSigmaDocFile,
  evaluateProductReview,
  SigmaDocCheckReport,
  ReviewVerdictState,
  ReviewRiskNote,
} from '../utils/docCheck';
import { artifactFileName, existingArtifactNames } from '../engine/artifactNames';

export class CloseNewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CloseNewError';
  }
}

function closeDraftRelPath(chain: ChainState): string {
  return toPosix(path.join('Sigma', 'close', artifactFileName('close', chain.chain_version)));
}

export interface CloseEligibilityBlocker {
  code: 'GATE_BLOCKED' | 'INVALID_OPERATION';
  message: string;
}

export interface CloseEligibility {
  eligible: boolean;
  /** Ordered reasons `close new` cannot run yet; empty when eligible. */
  blockers: CloseEligibilityBlocker[];
  gate3Satisfied: boolean;
  /** Project-relative path of the PRODUCT REVIEW, or null when it does not exist. */
  reviewFile: string | null;
  review: ReviewVerdictState | null;
}

/** Project-relative path of this chain's PRODUCT REVIEW, or null when no file exists. */
export function findProductReviewRel(projectRoot: string, chain: ChainState): string | null {
  const [existing] = existingArtifactNames(projectRoot, 'review', 'review', chain.chain_version);
  return existing ? toPosix(path.join('Sigma', 'review', existing)) : null;
}

/**
 * Reports every `close new` precondition against a live chain without writing
 * anything or throwing. Used by `sigma close check`, by prepare (freeze the
 * ticket only if this would currently succeed), and by `close new` itself.
 * Order: Gate 3, then the PRODUCT REVIEW exists, then its verdicts, then an
 * existing CLOSE.
 */
export function assessCloseNewEligibility(chain: ChainState, projectRoot: string): CloseEligibility {
  const blockers: CloseEligibilityBlocker[] = [];

  const gate3Satisfied = hasCleanGate3Chain(chain) && effectiveLifecycleGates(projectRoot, chain).gate_3_satisfied;
  if (!gate3Satisfied) {
    const open = describeGate3Blockers(chain);
    const lines = ['GATE 3 BLOCKED: the chain still has open work.', ...open.map(r => `  ${r}`)];
    lines.push('Every locked plan needs exactly one locked exec with valid contract evidence, and nothing may be left in DRAFT/APPROVED.');
    if (open.some(r => r.startsWith('DRAFT FMN-PLAN'))) {
      lines.push('Abandon what is no longer wanted: sigma plan supersede --v <version> --reason "..."');
    }
    if (open.some(r => r.includes('has no LOCKED DEV-EXEC'))) {
      lines.push('Run: sigma exec new / sigma exec approve --director-confirm to finish an unpaired plan.');
    }
    blockers.push({ code: 'GATE_BLOCKED', message: lines.join('\n') });
  }

  const reviewFile = findProductReviewRel(projectRoot, chain);
  let review: ReviewVerdictState | null = null;
  if (!reviewFile) {
    blockers.push({
      code: 'GATE_BLOCKED',
      message:
        'PRODUCT REVIEW MISSING: closure cannot be created because the PRODUCT REVIEW does not exist. ' +
        'Create it with: sigma review new',
    });
  } else {
    review = evaluateProductReview(path.join(projectRoot, reviewFile));
    if (!review.accepted) {
      blockers.push({
        code: 'GATE_BLOCKED',
        message:
          `PRODUCT REVIEW NOT ACCEPTED (${reviewFile}): closure needs every required verdict to be PASS or PASS_WITH_RISK.\n` +
          review.blockers.map(b => `  ${b}`).join('\n'),
      });
    }
  }

  if (chain.close !== null && chain.close.state !== 'SUPERSEDED') {
    blockers.push({
      code: 'INVALID_OPERATION',
      message: `DIR-CLOSE already exists for this chain (${chain.close.version}, ${chain.close.state}). Resolve or lock the existing DIR-CLOSE first.`,
    });
  }

  return { eligible: blockers.length === 0, blockers, gate3Satisfied, reviewFile, review };
}

/** Throws CloseNewError for the first unmet `close new` precondition. */
export function assertCloseNewEligible(chain: ChainState, projectRoot: string): void {
  const result = assessCloseNewEligibility(chain, projectRoot);
  const first = result.blockers[0];
  if (first) throw new CloseNewError(first.code, first.message);
}

export interface CreateCloseDraftResult {
  chainVersion: string;
  version: string;
  relPath: string;
  docReport: SigmaDocCheckReport;
  /** Parties whose PRODUCT REVIEW verdict is PASS_WITH_RISK, with their listed risks. */
  riskNotes: ReviewRiskNote[];
}

export function closeNewTransactionFiles(projectRoot: string): string[] {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion), path.join(projectRoot, closeDraftRelPath(chain))];
}

/**
 * Creates a new DIR-CLOSE draft against the active chain (Gate 3). Throws
 * CloseNewError (GATE_BLOCKED / INVALID_OPERATION) for every business-rule
 * rejection so the caller gets an actionable message.
 */
export function createCloseDraftUseCase(projectRoot: string): CreateCloseDraftResult {
  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  assertChainCanMutate(chain);
  assertCloseNewEligible(chain, projectRoot);
  const riskNotesBefore = assessCloseNewEligibility(chain, projectRoot).review?.riskNotes ?? [];

  const version = chain.chain_version;
  const relPath = closeDraftRelPath(chain);
  const absPath = path.join(projectRoot, relPath);
  // Either name form counts (F10): never put a second file beside an existing one.
  const [existingClose] = existingArtifactNames(projectRoot, 'close', 'close', version);
  if (existingClose) throw new CloseNewError('INVALID_OPERATION', `CLOSE FILE CONFLICT: Sigma/close/${existingClose} already exists.`);
  copyTemplateToArtifact('DIR-CLOSE-TEMPLATE.md', absPath);

  try {
    registerCloseDraft(chain, relPath);
  } catch (e) {
    throw new CloseNewError('INVALID_OPERATION', (e as Error).message);
  }
  writeChain(projectRoot, chainVersion, chain);

  const report = validateSigmaDocFile(absPath, 'close');
  if (!report.ok) {
    // Should never happen from the fixed template alone — defensive only.
    // Throwing here (rather than returning a failing report, as the CLI
    // does) lets the MCP transaction wrapper roll the scaffold back instead
    // of leaving a broken DRAFT registered against the chain.
    throw new CloseNewError('INTERNAL_ERROR', `${report.heading} failed immediately after scaffold.`);
  }

  return { chainVersion, version, relPath, docReport: report, riskNotes: riskNotesBefore };
}
