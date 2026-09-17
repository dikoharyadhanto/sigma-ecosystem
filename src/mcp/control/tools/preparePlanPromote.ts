// Stage F (W2 batch, continued) — sigma_prepare_plan_promote. Same
// re-supply-and-hash-match shape as prepareIntentAmendment.ts, applied to
// all three business arguments (`id`, `title`, `focus`) together — Director's
// approval must be bound to the exact title/focus that will be written, not
// just permission to promote "id X" with whatever text the caller chooses
// at commit time. Owner role: FMN mechanically, DIRECTOR via approval
// record — see planPromoteService.ts's header.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain, nextPlanVersion } from '../../../engine/chain';
import { readCanonicalPendingPlanFile } from '../../artifactPath';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { assertValidPromoteArgs, assertPlanPromoteGatesOpen, findPendingPlan, PlanPromoteError } from '../../../services/planPromoteService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerPreparePlanPromoteTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_plan_promote',
    {
      title: 'Prepare a plan promote operation ticket',
      description:
        'Freezes the promotion of a pending plan (`id`, `title`, `focus`) into the official FMN-PLAN DRAFT ' +
        'queue with an assigned version into an operation ticket. Does not promote anything. The ticket ' +
        'grants no authority by itself: a Director must record an approval via the trusted local CLI ' +
        '(`sigma control approve <ticket_id>`) before sigma_commit_plan_promote can use it. Tickets expire ' +
        'after 30 minutes. FMN role only.',
      inputSchema: {
        id: z.string().min(1),
        title: z.string().min(1),
        focus: z.string().min(1),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { id: string; title: string; focus: string; idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      return respondControlWrite(
        {
          tool: 'sigma_prepare_plan_promote',
          operationId: 'plan_promote_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { id: args.id, title: args.title, focus: args.focus },
          allowedRoles: ['FMN'],
          checkPreconditions: () => assertValidPromoteArgs(args.title, args.focus),
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);
          assertPlanPromoteGatesOpen(chain);

          let pending;
          try {
            pending = findPendingPlan(chain, args.id);
          } catch (e) {
            if (e instanceof PlanPromoteError) throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, e.message);
            throw e;
          }
          if (!chain.roadmap || chain.roadmap.state === 'SUPERSEDED') {
            throw new McpQueryError(ERROR_CODES.GATE_BLOCKED, 'Gate 1.5 blocked: A ROADMAP must exist for this chain to promote a plan. Run: sigma roadmap new');
          }

          const doc = readCanonicalPendingPlanFile(root, args.id, pending.file);
          if (!doc.present || !doc.sha256) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'The pending plan file is not present on disk.');
          }

          const { revision } = computeStateRevision(root);
          if (!revision) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
          }

          const projectedVersion = nextPlanVersion(chain, chain.intent.version);
          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'plan_promote',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({ id: args.id, title: args.title, focus: args.focus }),
            // "plan_pending" (not "plan"): this target has no version yet —
            // `version` here is the pending queue id, not an ArtifactVersion.
            target: { artifact: 'plan_pending', version: args.id, sha256: doc.sha256 },
            expected_state_revision: revision,
            effects: [
              `plan.pending: -1 entry (id: ${args.id})`,
              `plan.${projectedVersion}: created (DRAFT, title: "${args.title}")`,
              `roadmap.${chain.roadmap.version}: Stage Overview re-rendered`,
            ],
            authority: 'director',
            issued_at: now.toISOString(),
            expires_at: new Date(now.getTime() + TICKET_TTL_MS).toISOString(),
            consumed_at: null,
          };
          writeTicket(root, ticket);

          return {
            operation_ticket_id: ticket.operation_ticket_id,
            operation_id: ticket.operation_id,
            target: ticket.target,
            effects: ticket.effects,
            projected_version: projectedVersion,
            expected_state_revision: ticket.expected_state_revision,
            expires_at: ticket.expires_at,
          };
        }
      );
    }
  );
}
