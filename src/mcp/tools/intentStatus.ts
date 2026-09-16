// Stage B2 — sigma_intent_status. Query-plane equivalent of `sigma intent
// status` — the active chain's DIR-INTENT: version, state, ratification
// timestamp, doc-uncertified flag (edited after ratification/amendment —
// isIntentDocUncertified(), same engine function the CLI calls), and Gate 1.
// `chain.intent.file` is already project-relative in chain.ts (unlike
// SigmaDocCheckReport.file, no redaction needed).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import { readActiveChain, listChainVersions, isIntentDocUncertified, ChainState } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

function intentDocPath(root: string, chain: ChainState): string {
  return path.join(root, chain.intent.file ?? path.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
}

export function computeIntentStatus(root: string | null): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) {
    return { active: false, gate_1_open: false, source: SOURCE_ENGINE };
  }

  const { chainVersion, data: chain } = readActiveChain(root);
  const uncertified = isIntentDocUncertified(chain, intentDocPath(root, chain));

  return {
    active: true,
    active_chain: chainVersion,
    version: chain.intent.version,
    state: chain.intent.state,
    ratified_at: chain.intent.ratified_at ?? null,
    file: chain.intent.file ?? null,
    doc_uncertified: uncertified,
    doc_uncertified_since: uncertified ? (chain.intent.effective_amendment ?? 'ratification') : null,
    gate_1_open: chain.gates.gate_1_open,
    source: SOURCE_ENGINE,
  };
}

export function registerIntentStatusTool(server: McpServer): void {
  server.registerTool(
    'sigma_intent_status',
    {
      title: 'Get DIR-INTENT status',
      description:
        'Return the active chain\'s DIR-INTENT status — the query-plane equivalent of `sigma intent status`: ' +
        'version, state, ratification timestamp, whether the document was edited since it was last ' +
        'certified/ratified, and Gate 1. Read-only. Returns { active, active_chain, version, state, ratified_at, ' +
        'file, doc_uncertified, doc_uncertified_since, gate_1_open, source }, or { active: false, gate_1_open: ' +
        'false, source } when no chain exists yet.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      respond('sigma_intent_status', undefined, (root) => computeIntentStatus(root))
  );
}
