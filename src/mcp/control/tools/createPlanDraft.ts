// Stage E W1 — sigma_create_plan_draft. Control-plane only; never registered
// on the query server (src/mcp/index.ts does not import this file or
// anything under src/mcp/control/). Mirrors createIntentDraft.ts's wiring
// exactly — see planDraftService.ts for what differs in the shared use case
// itself (RATIFIED-intent + ROADMAP preconditions, array-of-versions target).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createPlanDraft, createPlanDraftTransactionFiles } from '../../../services/planDraftService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerCreatePlanDraftTool(server: McpServer): void {
  server.registerTool(
    'sigma_create_plan_draft',
    {
      title: 'Create FMN-PLAN draft',
      description:
        'Creates a new FMN-PLAN DRAFT under the active chain — the MCP control-plane equivalent of ' +
        '`sigma plan new` (non-pending path only; pending-queue staging is not exposed here). FMN role ' +
        'only. Requires Gate 1 (a RATIFIED DIR-INTENT) and an eligible ROADMAP (exists, not SUPERSEDED); ' +
        'also enforced if the project has notion_humanize_gate enabled. Requires idempotency_key (retried ' +
        'calls with the same key and the same arguments return the original result; same key with ' +
        'different arguments is rejected) and expected_state_revision read from a prior sigma_get_state ' +
        'call on this binding.',
      inputSchema: {
        title: z.string().min(1).describe('Stage title written into the ROADMAP Stage Overview table.'),
        focus: z.string().min(1).describe('Stage focus summary written into the ROADMAP Stage Overview table.'),
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
      title: string;
      focus: string;
      idempotency_key: string;
      expected_state_revision: string;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_create_plan_draft',
          operationId: 'plan_create_draft',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            title: args.title,
            focus: args.focus,
          },
          allowedRoles: ['FMN'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: createPlanDraftTransactionFiles,
        },
        // createPlanDraft() throws PlanDraftError, which carries a frozen
        // ERROR_CODES value in .code — respondControlWrite()'s codeOf()
        // unwraps it structurally, same as IntentDraftError/McpQueryError.
        (root) =>
          createPlanDraft({
            projectRoot: root,
            title: args.title,
            focus: args.focus,
          })
      )
  );
}
