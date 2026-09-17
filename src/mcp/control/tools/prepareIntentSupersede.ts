// Stage F (W2 batch, continued) — sigma_prepare_intent_supersede. Same
// re-supply-and-hash-match shape as prepareIntentAmendment.ts for the
// `reason` business argument. Scoped to the active chain only — see
// intentSupersedeService.ts's header for why the MCP surface does not
// expose the CLI's cross-chain `--v`.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain, previewIntentSupersedeCascade } from '../../../engine/chain';
import { readCanonicalArtifactFile } from '../../artifactPath';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { assertValidSupersedeReason, describeSupersedeCascadeEffects } from '../../../services/intentSupersedeService';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerPrepareIntentSupersedeTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_intent_supersede',
    {
      title: 'Prepare an intent supersede operation ticket',
      description:
        'Freezes a supersede of the active chain\'s RATIFIED DIR-INTENT (`reason`) into an operation ticket. ' +
        'Retires the entire chain — cascades SUPERSEDED to its ROADMAP/PLAN/EXEC/CLOSE, listed in `effects[]`. ' +
        'Only the active chain can be targeted (unlike `sigma intent supersede --v`, which is human/CLI-only). ' +
        'Does not supersede anything. The ticket grants no authority by itself: a Director must record an ' +
        'approval via the trusted local CLI (`sigma control approve <ticket_id>`) before ' +
        'sigma_commit_intent_supersede can use it. Tickets expire after 30 minutes. ARC role only.',
      inputSchema: {
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
    async (args: { reason: string; idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      return respondControlWrite(
        {
          tool: 'sigma_prepare_intent_supersede',
          operationId: 'intent_supersede_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { reason: args.reason },
          allowedRoles: ['ARC'],
          checkPreconditions: () => assertValidSupersedeReason(args.reason),
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);
          if (chain.intent.state !== 'RATIFIED') {
            throw new McpQueryError(
              ERROR_CODES.INVALID_OPERATION,
              `Active DIR-INTENT is "${chain.intent.state}", not RATIFIED. Supersede requires RATIFIED.`
            );
          }
          if (!chain.intent.file) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
          }
          const doc = readCanonicalArtifactFile(root, 'intent', chain.intent.version, chain.intent.file);
          if (!doc.present || !doc.sha256) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'The RATIFIED DIR-INTENT file is not present on disk.');
          }

          const { revision } = computeStateRevision(root);
          if (!revision) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
          }

          const cascade = previewIntentSupersedeCascade(chain);
          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'intent_supersede',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({ reason: args.reason }),
            target: { artifact: 'intent', version: chain.intent.version, sha256: doc.sha256 },
            expected_state_revision: revision,
            effects: describeSupersedeCascadeEffects(chain, cascade),
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
