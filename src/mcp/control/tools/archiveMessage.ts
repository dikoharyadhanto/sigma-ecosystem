// Stage E W1 — sigma_inbox_archive. Control-plane tool wrapping the shared
// service src/services/inboxArchiveService.ts (moved there 2026-09-16,
// Codex finding H-02, to satisfy the CLI/MCP shared-service invariant —
// see that file's header for the ownership-check design).
//
// Role gating here is two-layer, unlike every other primitive so far:
// `allowedRoles` admits all four AI roles (matrix: "semua"), and the
// per-message ownership check (bound role must equal the message's `to`)
// happens inside mutate(), not at the coarse role gate.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { archiveMessage, archiveMessageTransactionFiles } from '../../../services/inboxArchiveService';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerArchiveMessageTool(server: McpServer): void {
  server.registerTool(
    'sigma_inbox_archive',
    {
      title: 'Archive a mailbox message',
      description:
        'Marks a mailbox message ARCHIVED in Sigma/messages/index.json — the MCP control-plane equivalent of ' +
        '`sigma inbox archive <id>`, with one deliberate addition: a bound role may only archive a message ' +
        'addressed to itself (rejected with ROLE_NOT_AUTHORIZED otherwise). The CLI command has no such ' +
        'check; this is new MCP-only behavior, not a straight port. Never reads or returns message content — ' +
        'only flips a status field. Requires idempotency_key and expected_state_revision (from a prior ' +
        'sigma_get_state call on this binding).',
      inputSchema: {
        message_id: z.string().min(1),
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
      message_id: string;
      idempotency_key: string;
      expected_state_revision: string;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_inbox_archive',
          operationId: 'inbox_archive',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: { message_id: args.message_id },
          allowedRoles: ['ARC', 'FMN', 'DEV', 'AUD'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: archiveMessageTransactionFiles,
        },
        (root, role) => archiveMessage({ projectRoot: root, actorRole: role, messageId: args.message_id })
      )
  );
}
