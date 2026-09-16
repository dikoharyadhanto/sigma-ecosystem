// Stage E W1 — sigma_render_roadmap. Control-plane only. Unlike every other
// control tool so far, this mutation never touches progress-v<N>.json — it
// only rewrites the derived Stage Overview table inside the ROADMAP
// markdown file itself, deterministically, from chain.plan.versions[]. See
// roadmapService.ts's renderActiveRoadmap() header.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { renderActiveRoadmap, renderActiveRoadmapTransactionFiles } from '../../../services/roadmapService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerRenderRoadmapTool(server: McpServer): void {
  server.registerTool(
    'sigma_render_roadmap',
    {
      title: 'Regenerate ROADMAP Stage Overview',
      description:
        'Regenerates the derived Stage Overview table inside the active chain\'s ROADMAP file — the MCP ' +
        'control-plane equivalent of `sigma roadmap render`. FMN role only. Deterministic re-derivation from ' +
        'chain.plan.versions[]; does not touch progress-v<N>.json and does not require the ROADMAP to be in ' +
        'any particular lock state. Requires idempotency_key and expected_state_revision (from a prior ' +
        'sigma_get_state call on this binding).',
      inputSchema: {
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { idempotency_key: string; expected_state_revision: string }) =>
      respondControlWrite(
        {
          tool: 'sigma_render_roadmap',
          operationId: 'roadmap_render',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {},
          allowedRoles: ['FMN'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: renderActiveRoadmapTransactionFiles,
        },
        (root) => renderActiveRoadmap(root)
      )
  );
}
