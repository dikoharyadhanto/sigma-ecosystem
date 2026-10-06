// Stage F (W2 batch, continued) — sigma_prepare_close_lock. Same two-stage
// shape as Stage D's prepareIntentRatify.ts. No business argument — the
// Director approval record replaces the CLI's interactive
// promptApprove()/--yes gate entirely (see closeLockService.ts's header).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { readCanonicalArtifactFile } from '../../artifactPath';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { validateSigmaDocFile, ensureSigmaDocEligible } from '../../../utils/docCheck';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

export function registerPrepareCloseLockTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_close_lock',
    {
      title: 'Prepare a close-lock operation ticket',
      description:
        'Freezes the active chain\'s DRAFT DIR-CLOSE (version, document hash, state_revision) into an ' +
        'operation ticket. Locking closes the project lifecycle and auto-locks a still-DRAFT ROADMAP as a ' +
        'side effect — listed in `effects[]`. Does not lock anything. The ticket grants no authority by ' +
        'itself: a Director must record an approval via the trusted local CLI (`sigma control approve ' +
        '<ticket_id>`) before sigma_commit_close_lock can use it. Tickets expire after 30 minutes. AUD role only.',
      inputSchema: {
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      return respondControlWrite(
        {
          tool: 'sigma_prepare_close_lock',
          operationId: 'close_lock_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {},
          allowedRoles: ['AUD'],
          checkPreconditions: () => {},
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);
          if (!chain.close || chain.close.state !== 'DRAFT') {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
          }
          if (!chain.close.file) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Active DIR-CLOSE has no registered file.');
          }

          const doc = readCanonicalArtifactFile(root, 'close', chain.close.version, chain.close.file);
          if (!doc.present || !doc.sha256) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'The DRAFT DIR-CLOSE file is not present on disk.');
          }

          const report = validateSigmaDocFile(path.join(root, chain.close.file), 'close');
          try {
            ensureSigmaDocEligible(report, 'close');
          } catch (e) {
            throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, (e as Error).message);
          }

          const { revision } = computeStateRevision(root);
          if (!revision) {
            throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
          }

          const roadmapToLock = chain.roadmap && chain.roadmap.state === 'DRAFT' ? chain.roadmap.version : null;
          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'close_lock',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({}),
            target: { artifact: 'close', version: chain.close.version, sha256: doc.sha256 },
            expected_state_revision: revision,
            effects: [
              `close.${chain.close.version}.state: DRAFT -> LOCKED`,
              'lifecycle_state: -> CLOSED',
              ...(roadmapToLock ? [`roadmap.${roadmapToLock}.state: DRAFT -> LOCKED (cascade)`] : []),
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
