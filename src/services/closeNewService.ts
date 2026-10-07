// Stage F (W2 batch) — the use-case shared by `sigma close new` (CLI) and
// sigma_commit_close_new's mutate step (MCP control tool). Transport-
// agnostic: no Commander, no console.log — mirrors intentRatifyService.ts's
// split (src/commands/close.ts keeps printing).
//
// Unlike the other four W2 pilots in this batch, this operation creates a
// DIR-CLOSE artifact that does not exist yet — there is nothing to freeze a
// pre-existing sha256 against. The MCP control tool's operation ticket
// therefore carries `target: null` and relies on `expected_state_revision`
// alone for drift detection (every precondition here — Gate 3, Gate 3.5 —
// is itself a function of chain.json's own bytes, which state_revision
// already hashes).

import path from 'path';
import { effectiveLifecycleGates } from '../engine/lifecycleView';
import {
  ChainState,
  readActiveChain,
  assertChainCanMutate,
  hasCleanGate3Chain,
  describeGate3Blockers,
  hasGate35Score,
  arcScoreBand,
  registerCloseDraft,
  writeChain,
  chainFilePath,
} from '../engine/chain';
import { toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { validateSigmaDocFile, SigmaDocCheckReport } from '../utils/docCheck';

export class CloseNewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CloseNewError';
  }
}

function closeDraftRelPath(chain: ChainState): string {
  return toPosix(path.join('Sigma', 'close', `DIR-CLOSE-${chain.chain_version}.md`));
}

/** Re-runs every close_new precondition against a live chain, without
 *  writing anything — used by both prepare (freeze the ticket only if this
 *  would currently succeed) and by CLI's own preflight message. */
export function assertCloseNewEligible(chain: ChainState, projectRoot?: string): void {
  if (!hasCleanGate3Chain(chain) || projectRoot && !effectiveLifecycleGates(projectRoot,chain).gate_3_satisfied) {
    const blockers = describeGate3Blockers(chain);
    const lines = ['GATE 3 BLOCKED: the chain still has open work.', ...blockers.map(r => `  ${r}`)];
    lines.push('Every locked plan needs exactly one locked exec with valid contract evidence, and nothing may be left in DRAFT/APPROVED.');
    if (blockers.some(r => r.startsWith('DRAFT FMN-PLAN'))) {
      lines.push('Abandon what is no longer wanted: sigma plan supersede --v <version> --reason "..."');
    }
    if (blockers.some(r => r.includes('has no LOCKED DEV-EXEC'))) {
      lines.push('Run: sigma exec new / sigma exec approve --director-confirm to finish an unpaired plan.');
    }
    throw new CloseNewError('GATE_BLOCKED', lines.join('\n'));
  }
  if (!hasGate35Score(chain)) {
    throw new CloseNewError(
      'GATE_BLOCKED',
      'GATE 3.5 BLOCKED: ARC Satisfaction Score must be >= 50 before DIR-CLOSE can be created. ' +
      'Run: sigma intent score <n> --notes "..."'
    );
  }
  if (chain.close !== null && chain.close.state !== 'SUPERSEDED') {
    throw new CloseNewError(
      'INVALID_OPERATION',
      `DIR-CLOSE already exists for this chain (${chain.close.version}, ${chain.close.state}). Resolve or lock the existing DIR-CLOSE first.`
    );
  }
}

export interface CreateCloseDraftResult {
  chainVersion: string;
  version: string;
  relPath: string;
  docReport: SigmaDocCheckReport;
  arcScore: number | null;
  arcScoreBand: string | null;
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
  assertCloseNewEligible(chain,projectRoot);

  const version = chain.chain_version;
  const relPath = closeDraftRelPath(chain);
  const absPath = path.join(projectRoot, relPath);
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

  const score = chain.intent.arc_score ?? null;
  const band = score !== null ? arcScoreBand(score) : null;
  return { chainVersion, version, relPath, docReport: report, arcScore: score, arcScoreBand: band };
}
