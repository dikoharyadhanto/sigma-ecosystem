// Stage E W1 — sigma_update_reference. Control-plane only. Unlike every
// other control tool, this mutation never touches progress-v<N>.json at
// all — see referenceUpdateService.ts's header. Role "any" per the
// capability matrix; all four AI roles are allowed.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { updateReferenceList, referenceUpdateTransactionFiles } from '../../../services/referenceUpdateService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerUpdateReferenceTool(server: McpServer): void {
  server.registerTool(
    'sigma_update_reference',
    {
      title: 'Sync reference list from local data files',
      description:
        'Syncs the Local Artifact table in Sigma/reference/reference-list.md from files found in ' +
        'Sigma/reference/data/ — the MCP control-plane equivalent of `sigma reference update`. Any role. ' +
        'Top-level only (a data/ subfolder is one row, not walked recursively); auto-assigns the next ' +
        'sequential LA id; never modifies existing rows (Category/Notes stay manual); flags but never deletes ' +
        'rows whose file no longer exists. Self-heals a missing reference-list.md from its template. Not ' +
        'tracked in progress-v<N>.json — no gate, no lock state. Requires idempotency_key and ' +
        'expected_state_revision (from a prior sigma_get_state call on this binding).',
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
          tool: 'sigma_update_reference',
          operationId: 'reference_update',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {},
          allowedRoles: ['ARC', 'FMN', 'DEV', 'AUD'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: referenceUpdateTransactionFiles,
        },
        (root) => updateReferenceList(root)
      )
  );
}
