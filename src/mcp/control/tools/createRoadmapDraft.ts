// Stage E W1 — sigma_create_roadmap_draft. Control-plane only. Mirrors
// createPlanDraft.ts's wiring; see roadmapService.ts for what differs about
// the use case itself (chain.roadmap is a single object with no independent
// version counter — always chain.chain_version, unlike plan/exec).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createRoadmapDraft, createRoadmapDraftTransactionFiles } from '../../../services/roadmapService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerCreateRoadmapDraftTool(server: McpServer): void {
  server.registerTool(
    'sigma_create_roadmap_draft',
    {
      title: 'Create ROADMAP draft',
      description:
        'Creates the ROADMAP for the active chain — the MCP control-plane equivalent of `sigma roadmap new`. ' +
        'FMN role only. Requires a RATIFIED DIR-INTENT. Exactly one ROADMAP per chain (non-SUPERSEDED); a ' +
        'DRAFT or LOCKED ROADMAP already existing is rejected. Requires idempotency_key (retried calls with ' +
        'the same key and the same arguments return the original result) and expected_state_revision (from a ' +
        'prior sigma_get_state call on this binding).',
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
          tool: 'sigma_create_roadmap_draft',
          operationId: 'roadmap_create_draft',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {},
          allowedRoles: ['FMN'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: createRoadmapDraftTransactionFiles,
        },
        (root) => createRoadmapDraft({ projectRoot: root })
      )
  );
}
