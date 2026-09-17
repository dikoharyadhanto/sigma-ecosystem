// Stage F (W2 batch) — sigma_prepare_close_new. Same two-stage shape as
// Stage D's prepareIntentRatify.ts, with one structural difference: this
// operation creates a DIR-CLOSE artifact that does not exist yet, so there
// is no pre-existing document to freeze a sha256 against — `target` is
// null, and staleness is caught entirely by `expected_state_revision`
// (every precondition here is a function of chain.json's own bytes, which
// state_revision already hashes). See closeNewService.ts's header.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { assertCloseNewEligible } from '../../../services/closeNewService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerPrepareCloseNewTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_close_new',
    {
      title: 'Prepare a close-new operation ticket',
      description:
        'Freezes the active chain\'s Gate 3/3.5 readiness (state_revision) into an operation ticket for ' +
        'creating a new DIR-CLOSE draft. Does not create anything. The ticket grants no authority by itself: a ' +
        'Director must record an approval via the trusted local CLI (`sigma control approve <ticket_id>`) ' +
        'before sigma_commit_close_new can use it. Tickets expire after 30 minutes. AUD role only.',
      inputSchema: {
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      return respondControlWrite(
        {
          tool: 'sigma_prepare_close_new',
          operationId: 'close_new_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {},
          allowedRoles: ['AUD'],
          checkPreconditions: () => {},
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);
          assertCloseNewEligible(root, chain);

          const { revision } = computeStateRevision(root);
          if (!revision) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
          }

          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'close_new',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({}),
            target: null,
            expected_state_revision: revision,
            effects: [
              `Creates Sigma/close/DIR-CLOSE-${chain.chain_version}.md (DRAFT)`,
              'lifecycle_state: BUILD -> CLOSE',
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
