// Stage E W1 — sigma_exec_humanize. Control-plane only. Mirrors the
// createXDraft.ts wiring shape. See execHumanizeService.ts for what
// differs about the use case itself (--v selects a version within the
// active chain's exec array, not a different chain).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { humanizeExec, humanizeExecTransactionFiles } from '../../../services/execHumanizeService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerExecHumanizeTool(server: McpServer): void {
  server.registerTool(
    'sigma_exec_humanize',
    {
      title: 'Generate DEV-EXEC human projection',
      description:
        'Scaffolds a human-readable Notion projection (and its internal, never-published Fidelity Ledger) ' +
        'from a LOCKED DEV-EXEC + LOCKED referenced FMN-PLAN pair — the MCP control-plane equivalent of ' +
        '`sigma exec humanize`. DEV role only. Refuses to overwrite an existing projection unless force:true. ' +
        'Requires idempotency_key and expected_state_revision (from a prior sigma_get_state call on this ' +
        'binding).',
      inputSchema: {
        version: z.string().min(1).optional().describe('DEV-EXEC version to humanize instead of the active one, e.g. "v0.1".'),
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
      version?: string;
      force?: boolean;
      idempotency_key: string;
      expected_state_revision: string;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_exec_humanize',
          operationId: 'exec_humanize',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { version: args.version ?? null, force: Boolean(args.force) },
          allowedRoles: ['DEV'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: (root) => humanizeExecTransactionFiles(root, args.version),
        },
        (root) => humanizeExec({ projectRoot: root, version: args.version, force: args.force })
      )
  );
}
