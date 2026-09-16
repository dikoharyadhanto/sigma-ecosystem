// Stage B2 — sigma_list_intents. Query-plane equivalent of `sigma intent
// list` — the ONE B2 operation that is cross-chain: reads every
// progress-v<N>.json under the project, not just the active chain (every
// other B2/existing query tool is scoped to the active chain only). Still
// within the "one binding, one project" model — a project root can contain
// multiple chains, and this lists all of them.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readChain, listChainVersions, resolveActiveChainVersion } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

export function computeListIntents(root: string | null): unknown {
  if (!root) return noProject({ chains: [] });
  const versions = listChainVersions(root);
  if (versions.length === 0) return { chains: [], source: SOURCE_ENGINE };

  let activeChainVersion: string | null = null;
  try {
    activeChainVersion = resolveActiveChainVersion(root);
  } catch {
    // No chain is eligible to be active (e.g. every chain SUPERSEDED) —
    // still list everything, just without an `active: true` marker.
  }

  return {
    chains: versions.map((v) => {
      const chain = readChain(root, v);
      return {
        chain_version: v,
        intent_state: chain.intent.state,
        lifecycle_state: chain.lifecycle_state,
        gate_1_open: chain.gates.gate_1_open,
        gate_2_open: chain.gates.gate_2_open,
        gate_3_satisfied: chain.gates.gate_3_satisfied,
        active: v === activeChainVersion,
      };
    }),
    source: SOURCE_ENGINE,
  };
}

export function registerListIntentsTool(server: McpServer): void {
  server.registerTool(
    'sigma_list_intents',
    {
      title: 'List all chains (DIR-INTENTs)',
      description:
        'List every chain under the project root — the query-plane equivalent of `sigma intent list`. The only ' +
        'B2 tool that is cross-chain: every other tool in this project reports on the active chain only. ' +
        'Read-only. Returns { chains: [{ chain_version, intent_state, lifecycle_state, gate_1_open, gate_2_open, ' +
        'gate_3_satisfied, active }], source }.',
      inputSchema: {
        project_root: z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ project_root }: { project_root?: string }) =>
      respond('sigma_list_intents', project_root, (root) => computeListIntents(root))
  );
}
