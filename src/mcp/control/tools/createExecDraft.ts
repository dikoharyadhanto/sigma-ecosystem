// Stage E W1 — sigma_create_exec_draft. Control-plane only; never registered
// on the query server. Mirrors createPlanDraft.ts's wiring — see
// execDraftService.ts for what differs about the shared use case itself
// (version = referenced PLAN's own version, no independent counter;
// target-PLAN selection is real business logic, not a formality).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createExecDraft, createExecDraftTransactionFiles } from '../../../services/execDraftService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerCreateExecDraftTool(server: McpServer): void {
  server.registerTool(
    'sigma_create_exec_draft',
    {
      title: 'Create DEV-EXEC draft',
      description:
        'Creates a new DEV-EXEC DRAFT for a LOCKED FMN-PLAN — the MCP control-plane equivalent of `sigma exec ' +
        'new`. DEV role only. Requires Gate 2 (at least one LOCKED FMN-PLAN). A plan has at most one open ' +
        '(non-SUPERSEDED) exec at a time: pass plan_version to target a specific LOCKED plan (required when ' +
        'more than one LOCKED plan has no open exec yet, rejected if that plan already has one); omit it to ' +
        'auto-resolve when exactly one such plan exists. The resulting DEV-EXEC version always equals the ' +
        'referenced FMN-PLAN version — it is not an independent counter. Requires idempotency_key (retried ' +
        'calls with the same key and the same arguments return the original result; same key with different ' +
        'arguments, including a different plan_version, is rejected) and expected_state_revision read from a ' +
        'prior sigma_get_state call on this binding.',
      inputSchema: {
        plan_version: z
          .string()
          .regex(/^v\d+\.\d+$/, 'Expected a plan version like "v1.1".')
          .optional()
          .describe('Which LOCKED FMN-PLAN to execute. Optional when exactly one LOCKED plan has no open exec.'),
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
      plan_version?: string;
      idempotency_key: string;
      expected_state_revision: string;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_create_exec_draft',
          operationId: 'exec_create_draft',
          idempotencyKey: args.idempotency_key,
          // Explicit null for "omitted" — a retry that supplies a different
          // plan_version (including omitted vs. given) must be seen as a
          // different request (IDEMPOTENCY_CONFLICT), not silently coalesced
          // with `undefined` hashing the same as a prior omission would.
          argumentsForHash: { plan_version: args.plan_version ?? null },
          allowedRoles: ['DEV'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: (root) => createExecDraftTransactionFiles(root, args.plan_version),
        },
        // createExecDraft() throws ExecDraftError, which carries a frozen
        // ERROR_CODES value in .code — respondControlWrite()'s codeOf()
        // unwraps it structurally, same as PlanDraftError/IntentDraftError.
        (root) =>
          createExecDraft({
            projectRoot: root,
            planVersion: args.plan_version,
          })
      )
  );
}
