// Stage C pilot — sigma_create_intent_draft. Control-plane only; never
// registered on the query server (src/mcp/index.ts does not import this
// file or anything under src/mcp/control/).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createIntentDraft, createIntentDraftTransactionFiles } from '../../../services/intentDraftService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerCreateIntentDraftTool(server: McpServer): void {
  server.registerTool(
    'sigma_create_intent_draft',
    {
      title: 'Create DIR-INTENT draft',
      description:
        'Creates a new DIR-INTENT DRAFT (auto-creates and activates a new chain) — the MCP control-plane ' +
        'equivalent of `sigma intent new`. ARC role only. Requires idempotency_key (retried calls with the ' +
        'same key and the same arguments return the original result; same key with different arguments is ' +
        'rejected) and expected_state_revision read from a prior sigma_get_state call on this binding. ' +
        'If the active chain is CLOSED, pass allow_reopen_closed:true to confirm opening a new isolated ' +
        'chain — the CLOSED chain is left untouched either way.',
      inputSchema: {
        title: z.string().min(1).describe('Intent title written into Sigma/charter/intent-history.md.'),
        focus: z.string().min(1).describe('Intent focus summary written into Sigma/charter/intent-history.md.'),
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
        allow_reopen_closed: z
          .boolean()
          .optional()
          .describe('Required (true) when the active chain is CLOSED; otherwise ignored.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: {
      title: string;
      focus: string;
      idempotency_key: string;
      expected_state_revision: string;
      allow_reopen_closed?: boolean;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_create_intent_draft',
          operationId: 'intent_create_draft',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            title: args.title,
            focus: args.focus,
            allow_reopen_closed: Boolean(args.allow_reopen_closed),
          },
          allowedRoles: ['ARC'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: createIntentDraftTransactionFiles,
        },
        // createIntentDraft() throws IntentDraftError, which carries a
        // frozen ERROR_CODES value in .code — respondControlWrite()'s
        // codeOf() unwraps it structurally, the same way it unwraps
        // McpQueryError. No translation needed here.
        (root) =>
          createIntentDraft({
            projectRoot: root,
            title: args.title,
            focus: args.focus,
            allowReopenClosed: Boolean(args.allow_reopen_closed),
          })
      )
  );
}
