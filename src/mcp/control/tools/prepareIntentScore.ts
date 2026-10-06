// Stage F (W2 batch) — sigma_prepare_intent_score. Same two-stage shape as
// prepareIntentAmendment.ts, including the "business args must be
// re-supplied and hash-matched at commit" discipline (see that file's
// header) — `score`/`notes` are not stored raw on the ticket.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain } from '../../../engine/chain';
import { readCanonicalArtifactFile } from '../../artifactPath';
import { generateId, writeTicket, ticketPath, OperationTicket, TICKET_TTL_MS } from '../../../engine/controlStore';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';

function assertValidScoreArgs(score: number, notes: string): void {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'score must be an integer between 0 and 100.');
  }
  if (/[|\n\r]/.test(notes)) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'notes cannot contain "|" or a newline (breaks the intent-history.md table).');
  }
}

export function registerPrepareIntentScoreTool(server: McpServer): void {
  server.registerTool(
    'sigma_prepare_intent_score',
    {
      title: 'Prepare an intent ARC-score operation ticket',
      description:
        'Freezes an ARC Satisfaction Score (`score` 0-100, `notes`) against the active chain\'s RATIFIED ' +
        'DIR-INTENT into an operation ticket. Gate 3.5 precondition for `sigma close new`. Does not record ' +
        'anything. The ticket grants no authority by itself: a Director must record an approval via the ' +
        'trusted local CLI (`sigma control approve <ticket_id>`) before sigma_commit_intent_score can use it. ' +
        'Tickets expire after 30 minutes. ARC role only.',
      inputSchema: {
        score: z.number().int().min(0).max(100),
        notes: z.string().min(1),
        idempotency_key: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: { score: number; notes: string; idempotency_key: string }) => {
      const operationTicketId = generateId('opt');
      return respondControlWrite(
        {
          tool: 'sigma_prepare_intent_score',
          operationId: 'intent_score_prepare',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { score: args.score, notes: args.notes },
          allowedRoles: ['ARC'],
          checkPreconditions: () => assertValidScoreArgs(args.score, args.notes),
          transactionFiles: (root) => [ticketPath(root, operationTicketId)],
        },
        (root) => {
          const { data: chain } = readActiveChain(root);
          if (chain.intent.state !== 'RATIFIED') {
            throw new McpQueryError(
              ERROR_CODES.INVALID_OPERATION,
              `Active DIR-INTENT is "${chain.intent.state}", not RATIFIED. ARC score requires RATIFIED.`
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

          const binding = getBinding();
          const now = new Date();
          const ticket: OperationTicket = {
            operation_ticket_id: operationTicketId,
            operation_id: 'intent_score',
            project_id: binding.projectId ?? '',
            bound_role: binding.role ?? '',
            arguments_hash: stableHash({ score: args.score, notes: args.notes }),
            target: { artifact: 'intent', version: chain.intent.version, sha256: doc.sha256 },
            expected_state_revision: revision,
            effects: [
              `intent.arc_score: ${chain.intent.arc_score ?? '(unset)'} -> ${args.score}`,
              `gates.gate_3_5 (close new precondition): ${args.score >= 50 ? 'OPEN' : 'BLOCKED'}`,
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
