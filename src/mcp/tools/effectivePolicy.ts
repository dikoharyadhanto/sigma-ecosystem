// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 / §12 — sigma_get_effective_policy
//
// Read-only projection of what the governance layer would currently allow.
// Advisory: the payload says so in its own fields, because a model that reads
// `availability: "role_action"` must not treat that as authorisation.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computeEffectivePolicy } from '../policy';
import { respond } from '../contract';

export { computeEffectivePolicy };

export function registerEffectivePolicyTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_effective_policy',
    {
      title: 'Get Sigma Effective Policy',
      description:
        'Classify every Sigma operation for the bound project as observe, role_action, director_required, gate_blocked, or forbidden, given the current lifecycle and gates. Read-only and ADVISORY — enforcement is re-applied server-side on every command, and this output grants nothing. Each row also reports tier (Q/W1/W2/W3), owner_role (derived, not ratified), the registry role/level, and mcp_status (implemented | deferred | not_admissible). Optional role filters rows to one governance role. Returns { active, registry_available, gates_evaluated, counts, operations[], advisory, enforcement, source }.',
      inputSchema: {
        role: z
          .enum(['ARC', 'FMN', 'DEV', 'AUD'])
          .optional()
          .describe('Filter to operations owned by this role, plus role-neutral ones.'),
      },
    },
    async ({ role }: { role?: string }) =>
      respond('sigma_get_effective_policy', undefined, (root) => computeEffectivePolicy(root, role))
  );
}
