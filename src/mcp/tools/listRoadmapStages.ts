// Stage B2 — sigma_list_roadmap_stages. Query-plane equivalent of `sigma
// roadmap list`.
//
// Named deliberately NOT sigma_list_roadmaps: `Sigma/SIGMA-OPERATION-
// REGISTRY.json`'s `roadmap_list` entry describes its output as "Table of
// ROADMAP versions: version, state, file path" — that description does not
// match the actual CLI implementation, confirmed by reading
// src/commands/roadmap.ts directly. A chain has at most one ROADMAP (single
// object, not an array like plan/exec); `roadmap list` actually lists
// STAGES — the plans registered against the active chain's intent, via
// getStagePlansForRoadmap() (src/utils/roadmap.ts), which is what backs
// the ROADMAP's own Stage Overview table. This tool mirrors the real
// behaviour; the registry description is stale and should be corrected
// separately (capability matrix §5 mismatch-tracking, not fixed here).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain, listChainVersions } from '../../engine/chain';
import { getStagePlansForRoadmap } from '../../utils/roadmap';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond, ERROR_CODES } from '../contract';
import { McpQueryError } from '../errors';

export function computeListRoadmapStages(root: string | null): unknown {
  if (!root) return noProject({ stages: [] });
  if (listChainVersions(root).length === 0) return { stages: [], source: SOURCE_ENGINE };

  const { chainVersion, data: chain } = readActiveChain(root);
  if (!chain.roadmap) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'No ROADMAP found for the active chain.');
  }

  const stagePlans = getStagePlansForRoadmap(chain);

  return {
    active_chain: chainVersion,
    roadmap_version: chain.roadmap.version,
    stages: stagePlans.map((p) => ({
      version: p.version,
      state: p.state,
      title: p.title ?? null,
      focus: p.focus ?? null,
    })),
    source: SOURCE_ENGINE,
  };
}

export function registerListRoadmapStagesTool(server: McpServer): void {
  server.registerTool(
    'sigma_list_roadmap_stages',
    {
      title: 'List ROADMAP stages',
      description:
        'List every stage (plan) registered against the active chain\'s ROADMAP — the query-plane equivalent of ' +
        '`sigma roadmap list`. A chain has at most one ROADMAP; this lists the stages within it, not multiple ' +
        'ROADMAP versions. Read-only. Returns { active_chain, roadmap_version, stages: [{ version, state, title, ' +
        'focus }], source }.',
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
      respond('sigma_list_roadmap_stages', project_root, (root) => computeListRoadmapStages(root))
  );
}
