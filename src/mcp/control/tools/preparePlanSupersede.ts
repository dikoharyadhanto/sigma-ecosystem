// Stage F (W2 batch, continued) — sigma_prepare_plan_supersede. Same
// re-supply-and-hash-match shape as prepareIntentAmendment.ts for the
// `reason` business argument; `version` is a structural selector frozen via
// `ticket.target.version` (same reasoning as preparePlanLock.ts).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { readCanonicalArtifactFile } from '../../artifactPath';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { assertValidPlanSupersedeReason, describePlanSupersedeCascadeEffects } from '../../../services/planSupersedeService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerPreparePlanSupersedeTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_plan_supersede',
    {
      title: 'Prepare a plan supersede operation ticket',
      description:
        'Freezes a supersede of an FMN-PLAN version (DRAFT or LOCKED) on the active chain, plus its `reason`, ' +
        'into an operation ticket. Auto-supersedes any linked non-final DEV-EXEC — listed in `effects[]`. Does ' +
        'not supersede anything. The ticket grants no authority by itself: a Director must record an approval ' +
        'via the trusted local CLI (`sigma control approve <ticket_id>`) before sigma_commit_plan_supersede ' +
        'can use it. Tickets expire after 30 minutes. FMN role only.',
      inputSchema: {
        version: z.string().min(1),
        reason: z.string().min(1).max(2000),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { version: string; reason: string; idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      return respondControlWrite(
        {
          tool: 'sigma_prepare_plan_supersede',
          operationId: 'plan_supersede_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { reason: args.reason },
          allowedRoles: ['FMN'],
          checkPreconditions: () => assertValidPlanSupersedeReason(args.reason),
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);
          const entry = chain.plan.versions.find(v => v.version === args.version);
          if (!entry) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `FMN-PLAN ${args.version} not found.`);
          }
          if (entry.state === 'SUPERSEDED') {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `FMN-PLAN ${args.version} is already SUPERSEDED.`);
          }
          if (!entry.file) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, `FMN-PLAN ${args.version} has no registered file.`);
          }

          const doc = readCanonicalArtifactFile(root, 'plan', args.version, entry.file);
          if (!doc.present || !doc.sha256) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'The target FMN-PLAN file is not present on disk.');
          }

          const { revision } = computeStateRevision(root);
          if (!revision) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
          }

          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'plan_supersede',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({ reason: args.reason }),
            target: { artifact: 'plan', version: args.version, sha256: doc.sha256 },
            expected_state_revision: revision,
            effects: describePlanSupersedeCascadeEffects(chain, args.version),
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
            expected_state_revision: ticket.expected_state_revision,
            expires_at: ticket.expires_at,
          };
        }
      );
    }
  );
}
