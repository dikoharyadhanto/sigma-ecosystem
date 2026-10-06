// Stage F (W2 batch) — sigma_prepare_plan_lock. Same two-stage shape as
// Stage D's prepareIntentRatify.ts. Unlike intent_amendment/intent_score,
// `version` needs no re-supply-and-hash-match discipline at commit: it is a
// structural selector (which DRAFT to lock), fully captured by the ticket's
// own `target.version` once resolved — there is no free-text content to
// bind separately.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { readCanonicalArtifactFile } from '../../artifactPath';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { validateSigmaDocFile, ensureSigmaDocEligible } from '../../../utils/docCheck';
import { resolvePlanLockTarget, PlanLockError } from '../../../services/planLockService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerPreparePlanLockTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_plan_lock',
    {
      title: 'Prepare a plan lock operation ticket',
      description:
        'Freezes the active chain\'s DRAFT FMN-PLAN (version, document hash, state_revision) into an operation ' +
        'ticket. `version` is required when more than one DRAFT FMN-PLAN is open, optional otherwise. Does not ' +
        'lock anything. The ticket grants no authority by itself: a Director must record an approval via the ' +
        'trusted local CLI (`sigma control approve <ticket_id>`) before sigma_commit_plan_lock can use it. ' +
        'Tickets expire after 30 minutes. FMN role only.',
      inputSchema: {
        version: z.string().min(1).optional(),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { version?: string; idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      return respondControlWrite(
        {
          tool: 'sigma_prepare_plan_lock',
          operationId: 'plan_lock_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {},
          allowedRoles: ['FMN'],
          checkPreconditions: () => {},
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);

          let targetVersion: string;
          try {
            targetVersion = resolvePlanLockTarget(chain, args.version);
          } catch (e) {
            if (e instanceof PlanLockError) throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, e.message);
            throw e;
          }

          const entry = chain.plan.versions.find(v => v.version === targetVersion);
          if (!entry?.file) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, `FMN-PLAN ${targetVersion} has no registered file.`);
          }

          const doc = readCanonicalArtifactFile(root, 'plan', targetVersion, entry.file);
          if (!doc.present || !doc.sha256) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'The DRAFT FMN-PLAN file is not present on disk — nothing to lock.');
          }

          const report = validateSigmaDocFile(path.join(root, entry.file), 'plan');
          try {
            ensureSigmaDocEligible(report, 'plan');
          } catch (e) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, (e as Error).message);
          }

          const { revision } = computeStateRevision(root);
          if (!revision) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
          }

          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'plan_lock',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({}),
            target: { artifact: 'plan', version: targetVersion, sha256: doc.sha256 },
            expected_state_revision: revision,
            effects: [
              `plan.${targetVersion}.state: DRAFT -> LOCKED`,
              'gates.gate_2_open: -> true',
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
            expected_state_revision: ticket.expected_state_revision,
            expires_at: ticket.expires_at,
          };
        }
      );
    }
  );
}
