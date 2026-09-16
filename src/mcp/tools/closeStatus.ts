// Stage B2 — sigma_close_status. Query-plane equivalent of `sigma close
// status` — the active chain's DIR-CLOSE (single object, may not exist yet)
// plus the chain's overall lifecycle_state.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readActiveChain, listChainVersions } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

export function computeCloseStatus(root: string | null): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) {
    return { active: false, close: null, source: SOURCE_ENGINE };
  }

  const { chainVersion, data: chain } = readActiveChain(root);

  return {
    active: true,
    active_chain: chainVersion,
    close: chain.close
      ? {
          version: chain.close.version,
          state: chain.close.state,
          locked_at: chain.close.locked_at ?? null,
          file: chain.close.file ?? null,
        }
      : null,
    lifecycle_state: chain.lifecycle_state,
    source: SOURCE_ENGINE,
  };
}

export function registerCloseStatusTool(server: McpServer): void {
  server.registerTool(
    'sigma_close_status',
    {
      title: 'Get DIR-CLOSE status',
      description:
        'Return the active chain\'s DIR-CLOSE status — the query-plane equivalent of `sigma close status`: ' +
        'version, state, lock timestamp, and the chain\'s overall lifecycle_state. Read-only. Returns { active, ' +
        'active_chain, close, lifecycle_state, source } — close is null when no DIR-CLOSE has been created yet.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      respond('sigma_close_status', undefined, (root) => computeCloseStatus(root))
  );
}
