// Stage B2 — sigma_list_plans. Query-plane equivalent of `sigma plan list`
// — every chain.plan.versions[] entry regardless of state (unlike
// sigma_plan_status, which hides SUPERSEDED), plus the pending (unversioned)
// queue. Unlike sigma_plan_status's readPendingTitle() fallback path, the
// title here is never a host absolute path — see planStatus.ts for the same
// concern already resolved once.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'fs-extra';
import path from 'path';
import { readActiveChain, listChainVersions } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

function safePendingTitle(root: string, relFile: string): string | null {
  const absPath = path.join(root, relFile);
  if (!fs.existsSync(absPath)) return null;
  try {
    const firstLine = fs.readFileSync(absPath, 'utf8').split('\n')[0] ?? '';
    return firstLine.startsWith('# ') ? firstLine.slice(2).trim() : null;
  } catch {
    return null;
  }
}

export function computeListPlans(root: string | null): unknown {
  if (!root) return noProject({ versions: [], pending: [] });
  if (listChainVersions(root).length === 0) return { versions: [], pending: [], source: SOURCE_ENGINE };

  const { chainVersion, data: chain } = readActiveChain(root);

  return {
    active_chain: chainVersion,
    versions: chain.plan.versions.map((v) => ({
      version: v.version,
      state: v.state,
      intent_version_ref: v.intent_version_ref ?? null,
      created_at: v.created_at,
    })),
    pending: chain.plan.pending.map((p) => ({
      id: p.id,
      title: p.title ?? safePendingTitle(root, p.file),
      created_at: p.created_at,
    })),
    source: SOURCE_ENGINE,
  };
}

export function registerListPlansTool(server: McpServer): void {
  server.registerTool(
    'sigma_list_plans',
    {
      title: 'List all FMN-PLAN versions',
      description:
        'List every FMN-PLAN version in the active chain (all states — DRAFT, LOCKED, SUPERSEDED — unlike ' +
        'sigma_plan_status which hides SUPERSEDED), plus pending (unversioned) plans. The query-plane equivalent ' +
        'of `sigma plan list`. Read-only. Returns { active_chain, versions: [{ version, state, ' +
        'intent_version_ref, created_at }], pending: [{ id, title, created_at }], source }.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      respond('sigma_list_plans', undefined, (root) => computeListPlans(root))
  );
}
