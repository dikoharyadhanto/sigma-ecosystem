// Stage B2 — sigma_list_execs. Query-plane equivalent of `sigma exec list`
// — every chain.exec.versions[] entry regardless of state (unlike
// sigma_exec_status, which hides SUPERSEDED). No pending concept for exec.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain, listChainVersions } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

export function computeListExecs(root: string | null): unknown {
  if (!root) return noProject({ versions: [] });
  if (listChainVersions(root).length === 0) return { versions: [], source: SOURCE_ENGINE };

  const { chainVersion, data: chain } = readActiveChain(root);

  return {
    active_chain: chainVersion,
    versions: chain.exec.versions.map((v) => ({
      version: v.version,
      state: v.state,
      plan_version_ref: v.plan_version_ref ?? null,
      created_at: v.created_at,
    })),
    source: SOURCE_ENGINE,
  };
}

export function registerListExecsTool(server: McpServer): void {
  server.registerTool(
    'sigma_list_execs',
    {
      title: 'List all DEV-EXEC versions',
      description:
        'List every DEV-EXEC version in the active chain (all states — DRAFT, LOCKED, SUPERSEDED — unlike ' +
        'sigma_exec_status which hides SUPERSEDED). The query-plane equivalent of `sigma exec list`. Read-only. ' +
        'Returns { active_chain, versions: [{ version, state, plan_version_ref, created_at }], source }.',
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
      respond('sigma_list_execs', project_root, (root) => computeListExecs(root))
  );
}
