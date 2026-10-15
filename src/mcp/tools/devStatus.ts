// sigma_dev_status — query-plane equivalent of `sigma dev status`.
// Reads the DEV workspace state from the identity record, the dev/ folder, and
// its marker. Creating a workspace is `dev create-workspace`, CLI only.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describeDevWorkspace, getDevWorkspaceStatus } from '../../engine/devWorkspace';
import { respond } from '../contract';
import { noProject, SOURCE_ENGINE } from '../shared';
import { asPrecondition } from './queryHelpers';

export function computeDevStatus(root: string | null): unknown {
  if (!root) return noProject();
  try {
    const status = getDevWorkspaceStatus(root);
    return {
      active: true,
      state: status.state,
      degraded_reason: status.degradedReason,
      unregistered_folder: status.unregisteredFolder,
      guidance: describeDevWorkspace(status),
      source: SOURCE_ENGINE,
    };
  } catch (e) {
    return asPrecondition(e, [root]);
  }
}

export function registerDevStatusTool(server: McpServer): void {
  server.registerTool(
    'sigma_dev_status',
    {
      title: 'Get the DEV workspace status',
      description:
        'Report whether the DEV workspace is INACTIVE, ACTIVE, or ACTIVE_DEGRADED — the query-plane equivalent of ' +
        '`sigma dev status`. Read-only; creating or repairing a workspace stays CLI-only. ' +
        'Returns { active, state, degraded_reason, unregistered_folder, guidance[], source }.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => respond('sigma_dev_status', undefined, (root) => computeDevStatus(root)),
  );
}
