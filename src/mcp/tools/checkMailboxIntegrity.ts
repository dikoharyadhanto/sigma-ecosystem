// Stage B2 — sigma_check_mailbox_integrity. Query-plane equivalent of
// `sigma inbox check`.
//
// Despite the "*_check" name, structurally NOT the same family as
// sigma_check_document (SigmaDocCheckReport): this validates the mailbox
// index against disk (missing files, orphan files, missing attachments,
// duplicate IDs, invalid role/type/status fields), a symmetric report
// available to every role — no --role concept, no per-message content, no
// existence-oracle risk across roles the way sigma_write_memo/sigma_send_
// message's withdrawn siblings had (R-B2-01/02, capability matrix §3.6).
// It reports structural counts and ids/paths, never subject lines or
// message bodies.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkMailboxIntegrity } from '../../engine/mailbox';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

export function computeCheckMailboxIntegrity(root: string | null): unknown {
  if (!root) return noProject();
  return { ...checkMailboxIntegrity(root), source: SOURCE_ENGINE };
}

export function registerCheckMailboxIntegrityTool(server: McpServer): void {
  server.registerTool(
    'sigma_check_mailbox_integrity',
    {
      title: 'Check mailbox index integrity',
      description:
        'Validate Sigma/messages/index.json against disk — the query-plane equivalent of `sigma inbox check`: ' +
        'missing message/memo files, orphan .md files in role/context folders, missing attachments, duplicate IDs, and ' +
        'invalid role/type/status field values. Applies to the whole mailbox, not one role\'s inbox — never ' +
        'returns subject lines or message content. Read-only. Returns { ok, passes, warnings, failures, ' +
        'findings: { missing_files, orphan_files, missing_attachments, duplicate_ids, invalid_fields }, source }.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () =>
      respond('sigma_check_mailbox_integrity', undefined, (root) => computeCheckMailboxIntegrity(root))
  );
}
