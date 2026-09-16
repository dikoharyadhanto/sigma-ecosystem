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
import fs from 'fs-extra';
import path from 'path';
import { MESSAGING_ROLES, VALID_ROLES, VALID_MESSAGE_TYPES } from '../../config';
import { readIndex, VALID_STATUSES } from '../../engine/mailbox';
import { toPosix } from '../../utils/fs';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond } from '../contract';

export function computeCheckMailboxIntegrity(root: string | null): unknown {
  if (!root) return noProject();

  const index = readIndex(root);
  const messagesDir = path.join(root, 'Sigma', 'messages');

  const missingFiles: Array<{ id: string; file: string }> = [];
  const orphanFiles: string[] = [];
  const missingAttachments: Array<{ id: string; path: string }> = [];
  const duplicateIds: string[] = [];
  const invalidFields: Array<{ id: string; field: string; value: string }> = [];

  let passes = 0;

  for (const entry of index.messages) {
    if (fs.existsSync(path.join(root, entry.file))) {
      passes++;
    } else {
      missingFiles.push({ id: entry.id, file: entry.file });
    }
  }

  const indexedFiles = new Set(index.messages.map((m) => m.file));
  for (const role of MESSAGING_ROLES) {
    const roleDir = path.join(messagesDir, role);
    if (!fs.existsSync(roleDir)) continue;
    const files = fs.readdirSync(roleDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const relPath = toPosix(path.join('Sigma', 'messages', role, file));
      if (indexedFiles.has(relPath)) {
        passes++;
      } else {
        orphanFiles.push(relPath);
      }
    }
  }

  for (const entry of index.messages) {
    for (const att of entry.attachments) {
      if (fs.existsSync(path.join(root, att))) {
        passes++;
      } else {
        missingAttachments.push({ id: entry.id, path: att });
      }
    }
  }

  const seenIds = new Set<string>();
  for (const entry of index.messages) {
    if (seenIds.has(entry.id)) duplicateIds.push(entry.id);
    seenIds.add(entry.id);
    if (!(VALID_ROLES as readonly string[]).includes(entry.from)) invalidFields.push({ id: entry.id, field: 'from', value: entry.from });
    if (!(VALID_ROLES as readonly string[]).includes(entry.to)) invalidFields.push({ id: entry.id, field: 'to', value: entry.to });
    if (!VALID_STATUSES.includes(entry.status)) invalidFields.push({ id: entry.id, field: 'status', value: entry.status });
    if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(entry.type)) invalidFields.push({ id: entry.id, field: 'type', value: entry.type });
  }

  const failures = missingFiles.length + missingAttachments.length + duplicateIds.length + invalidFields.length;
  const warnings = orphanFiles.length;

  return {
    ok: failures === 0,
    passes,
    warnings,
    failures,
    findings: { missing_files: missingFiles, orphan_files: orphanFiles, missing_attachments: missingAttachments, duplicate_ids: duplicateIds, invalid_fields: invalidFields },
    source: SOURCE_ENGINE,
  };
}

export function registerCheckMailboxIntegrityTool(server: McpServer): void {
  server.registerTool(
    'sigma_check_mailbox_integrity',
    {
      title: 'Check mailbox index integrity',
      description:
        'Validate Sigma/messages/index.json against disk — the query-plane equivalent of `sigma inbox check`: ' +
        'missing message files, orphan .md files not in the index, missing attachments, duplicate IDs, and ' +
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
