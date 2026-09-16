// Stage E W1 — sigma_close_humanize. Control-plane only. Mirrors the
// createXDraft.ts wiring shape. See closeHumanizeService.ts for what
// differs about the use case itself (no --v selector at all — always the
// active chain's own close).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { humanizeClose, humanizeCloseTransactionFiles } from '../../../services/closeHumanizeService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerCloseHumanizeTool(server: McpServer): void {
  server.registerTool(
    'sigma_close_humanize',
    {
      title: 'Generate DIR-CLOSE human projection',
      description:
        'Scaffolds a human-readable Notion projection (and its internal, never-published Fidelity Ledger) ' +
        'from a LOCKED DIR-CLOSE — the MCP control-plane equivalent of `sigma close humanize`. AUD role only. ' +
        'Always targets the active chain\'s own DIR-CLOSE (no version selector). Refuses to overwrite an ' +
        'existing projection unless force:true. Requires idempotency_key and expected_state_revision (from a ' +
        'prior sigma_get_state call on this binding).',
      inputSchema: {
        force: z.boolean().optional().describe('Overwrite an already-generated human projection for this version.'),
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
    async (args: {
      force?: boolean;
      idempotency_key: string;
      expected_state_revision: string;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_close_humanize',
          operationId: 'close_humanize',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { force: Boolean(args.force) },
          allowedRoles: ['AUD'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: humanizeCloseTransactionFiles,
        },
        (root) => humanizeClose({ projectRoot: root, force: args.force })
      )
  );
}
