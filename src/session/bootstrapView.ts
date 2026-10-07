// PLAN-IMPL-01 Stage 1 — console-free assembly of the data that
// `sigma session bootstrap` prints. Extracted from runBootstrap so that both
// the CLI printer (src/commands/session.ts) and the MCP orientation tool
// (src/mcp/tools/*) consume the same source without any console output.
//
// HARD CONSTRAINT: nothing in this file may write to stdout/stderr. The MCP
// stdio transport reserves stdout for JSON-RPC frames; any console.log reached
// from an MCP tool corrupts the stream. This function only reads.

import {
  readActiveChain,
  readProjectIdentity,
  listChainVersions,
  getGateStatus,
  getNextValidOperations,
  ChainState,
  Gates,
  ProjectIdentity,
} from '../engine/chain';
import { effectiveLifecycleGates } from '../engine/lifecycleView';
import { lifecycleWarnings } from '../engine/lifecycle';
import { findProjectRoot } from '../utils/fs';
import { VersioningScheme, resolveVersioningScheme, planMajorForChain } from '../engine/numbering';

export interface BootstrapView {
  projectRoot: string;
  identity: ProjectIdentity;
  chainVersion: string | null;
  chain: ChainState | null;
  gates: Gates | null;
  nextOps: string[];
  numbering: { scheme: VersioningScheme; intent_version: string; plan_major: number; source: 'chain' | 'legacy_fallback' } | null;
  compatibilityWarnings: string[];
}

// Pure reads only — mirrors the data-gathering prologue of runBootstrap.
// A fresh project (before the first `intent new`) has no chain yet; that is a
// valid state, represented as chain: null / chainVersion: null, matching the
// CLI's graceful "none" display.
export function buildBootstrapView(projectRoot: string = findProjectRoot()): BootstrapView {
  const identity = readProjectIdentity(projectRoot);

  const hasChain = listChainVersions(projectRoot).length > 0;
  const { chainVersion, data: chain } = hasChain
    ? readActiveChain(projectRoot)
    : { chainVersion: null, data: null as ChainState | null };

  const gates = chain ? getGateStatus({...chain,gates:effectiveLifecycleGates(projectRoot,chain)}) : null;
  const nextOps = chain ? getNextValidOperations(chain).filter(op=>gates?.gate_2_open || !op.startsWith('exec new')) : ['intent new'];

  const numbering = chain ? {
    scheme: resolveVersioningScheme(chain), intent_version: chain.intent.version,
    plan_major: planMajorForChain(chain), source: chain.versioning_scheme === undefined ? 'legacy_fallback' as const : 'chain' as const,
  } : null;
  const compatibilityWarnings = numbering?.scheme === 'legacy_offset' ? [
    `[COMPATIBILITY] INTENT ${numbering.intent_version} uses the legacy numbering: PLAN/EXEC v${numbering.plan_major}.x (PLAN major = INTENT major - 1). This pattern is kept for compatibility with older chains. Use it for as long as you work on this chain.`,
  ] : [];
  if(chain)compatibilityWarnings.push(...lifecycleWarnings(chain));
  return { projectRoot, identity, chainVersion, chain, gates, nextOps, numbering, compatibilityWarnings };
}
