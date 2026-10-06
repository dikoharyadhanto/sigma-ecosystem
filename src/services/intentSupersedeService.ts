// Stage F (W2 batch, continued) — the use-case shared by `sigma intent
// supersede` (CLI) and sigma_commit_intent_supersede's mutate step (MCP
// control tool). Transport-agnostic: no Commander, no console.log — mirrors
// intentRatifyService.ts's split.
//
// Scope decision (2026-09-16, Director): the CLI's `--v <version>` lets a
// human target ANY chain, not just the active one — useful for a human
// cleaning up history. The MCP primitive does NOT expose this: `state_
// revision` (contract.ts's computeStateRevision()) hashes only the ACTIVE
// chain's progress-v<N>.json, so mutating a non-active chain would never
// move it — the entire prepare/commit staleness contract this batch relies
// on would silently stop protecting a cross-chain supersede. Scoping to the
// active chain keeps this operation inside the same guarantee every other
// W2 tool in this batch already depends on. The CLI keeps full cross-chain
// capability; only the MCP surface is narrower.

import {
  ChainState,
  readActiveChain,
  readChain,
  assertChainCanMutate,
  previewIntentSupersedeCascade,
  supersedeIntentVersion,
  writeChain,
  chainFilePath,
  IntentCascadeTargets,
} from '../engine/chain';
import { renderIntentHistoryFile, intentHistoryPath } from '../utils/intentHistory';

export class IntentSupersedeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'IntentSupersedeError';
  }
}

const MAX_REASON_LENGTH = 2000;

export function assertValidSupersedeReason(reason: string): void {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new IntentSupersedeError('INVALID_OPERATION', '--reason cannot be empty.');
  }
  if (/[|\n\r]/.test(reason)) {
    throw new IntentSupersedeError('INVALID_OPERATION', '--reason cannot contain "|" or a newline (breaks the intent-history.md table).');
  }
  if (reason.length > MAX_REASON_LENGTH) {
    throw new IntentSupersedeError('INVALID_OPERATION', `--reason exceeds ${MAX_REASON_LENGTH} characters.`);
  }
}

export function describeSupersedeCascadeEffects(chain: ChainState, cascade: IntentCascadeTargets): string[] {
  const effects = [`intent.state: RATIFIED -> SUPERSEDED (${chain.intent.version})`];
  if (cascade.roadmap) effects.push(`roadmap.${cascade.roadmap.version}: ${cascade.roadmap.state} -> SUPERSEDED`);
  for (const p of cascade.plan) effects.push(`plan.${p.version}: ${p.state} -> SUPERSEDED`);
  for (const e of cascade.exec) effects.push(`exec.${e.version}: ${e.state} -> SUPERSEDED`);
  if (cascade.close) effects.push(`close.${cascade.close.version}: ${cascade.close.state} -> SUPERSEDED`);
  return effects;
}

export interface SupersedeIntentResult {
  chainVersion: string;
  version: string;
  cascade: IntentCascadeTargets;
}

export function intentSupersedeTransactionFiles(projectRoot: string, targetChainVersion?: string): string[] {
  const { chainVersion } = targetChainVersion
    ? { chainVersion: targetChainVersion }
    : readActiveChain(projectRoot);
  return [chainFilePath(projectRoot, chainVersion), intentHistoryPath(projectRoot)];
}

/**
 * Supersedes a RATIFIED DIR-INTENT — the active chain by default, or
 * `targetChainVersion` (mirrors CLI's `--v`, human-only; see this file's
 * header for why the MCP tool never passes it). Cascades SUPERSEDED to its
 * ROADMAP/PLAN/EXEC/CLOSE. Throws IntentSupersedeError (INVALID_OPERATION)
 * for every business-rule rejection (not RATIFIED, malformed reason).
 */
export function supersedeIntentUseCase(projectRoot: string, reason: string, targetChainVersion?: string): SupersedeIntentResult {
  const { chainVersion, data: chain } = targetChainVersion
    ? { chainVersion: targetChainVersion, data: readChain(projectRoot, targetChainVersion) }
    : readActiveChain(projectRoot);
  assertChainCanMutate(chain);

  if (chain.intent.state !== 'RATIFIED') {
    throw new IntentSupersedeError('INVALID_OPERATION', `INTENT ${chain.intent.version} is in state "${chain.intent.state}"; supersede requires RATIFIED.`);
  }
  assertValidSupersedeReason(reason);

  const cascade = previewIntentSupersedeCascade(chain);
  supersedeIntentVersion(chain, reason);
  writeChain(projectRoot, chainVersion, chain);
  renderIntentHistoryFile(projectRoot); // PLAN-EVAL-06 — trigger 3/4, same as CLI

  return { chainVersion, version: chain.intent.version, cascade };
}
