import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { journaledWriteIfActive } from './controlStore';
import { assertMailboxLease } from './mailboxLock';
import { atomicReplaceFileSync } from '../utils/fs';
import { MailboxScope, matchesMailboxScope, validateMailboxContext, assertMailboxPath, mailboxDiskFiles, validateEntryMembership } from './mailboxContext';
import { VALID_ROLES, VALID_MESSAGE_TYPES } from '../config';
import {
  MESSAGES_INDEX_FILE,
  SigmaRole,
  MessageType,
  ActionRequired,
  VALID_ACTIONS,
} from '../config';

export interface MessageEntry {
  id: string;
  from: SigmaRole;
  to: SigmaRole;
  type: MessageType;
  subject: string;
  file: string;
  // OUTDATED (bug-report follow-up 2026-08-30, Phase 6): a READ message aged
  // out of the recent window by `sigma inbox clear` or the auto-sweep in
  // `sigma inbox read`. Hidden from every default/`--all` listing; still
  // readable by id and via `--outdated`. Non-destructive.
  status: 'UNREAD' | 'READ' | 'ARCHIVED' | 'OUTDATED';
  created_at: string;
  attachments: string[];
  reply_to?: string;
  related_artifact?: string;
  action?: ActionRequired;
  intent_version?: string | null;
  context?: string;
  contract_change?: { plan: string; revision: number; revision_id: string; contract_sha256: string };
  migration?: { original_file: string; original_status: string; migrated_at: string };
}

export interface MessageIndex {
  mailbox_format?: 2;
  messages: MessageEntry[];
}

export const VALID_STATUSES: ReadonlyArray<string> = ['UNREAD', 'READ', 'ARCHIVED', 'OUTDATED'];
const REQUIRED_ENTRY_FIELDS = ['id', 'from', 'to', 'type', 'subject', 'file', 'status', 'created_at'] as const;

function corruptionError(detail: string): Error {
  return new Error(
    `Mailbox index corruption detected in ${MESSAGES_INDEX_FILE}: ${detail}\n` +
    `Inspect Sigma/messages/index.json manually. Do not delete it — message history may be recoverable from files in Sigma/messages/.\n` +
    `To repair duplicate-ID entries from older builds: remove the duplicate entry from the "messages" array in index.json, then re-run the command.`
  );
}

export function validateMailboxIndexData(data: unknown): MessageIndex {
  if (typeof data !== 'object' || data === null) {
    throw corruptionError('root value is not an object');
  }
  const d = data as Record<string, unknown>;
  if (!('messages' in d) || !Array.isArray(d.messages)) {
    throw corruptionError('"messages" field is missing or not an array');
  }

  // Bug report 2026-08-30 (BUG B): entries written on Windows store `file`
  // with backslash separators (e.g. "Sigma\messages\DEV\...md"). On POSIX,
  // path.join() treats "\" as a literal filename character, so `sigma inbox
  // read`/`inbox check` look for a single file with backslashes in its name
  // and fail ENOENT even though the real forward-slash file exists. Normalize
  // to "/" on every read, before the duplicate-path check below so two
  // entries differing only by separator collapse. In-memory only — index.json
  // is not rewritten (mirrors normalizeFilePathsOnRead() in chain.ts).
  for (const m of d.messages) {
    if (m && typeof m === 'object') {
      const entry = m as Record<string, unknown>;
      if (typeof entry.file === 'string' && entry.file.includes('\\')) {
        entry.file = entry.file.replace(/\\/g, '/');
      }
      if (Array.isArray(entry.attachments)) {
        entry.attachments = entry.attachments.map(a =>
          typeof a === 'string' && a.includes('\\') ? a.replace(/\\/g, '/') : a
        );
      }
    }
  }

  if (d.mailbox_format !== undefined && d.mailbox_format !== 2) throw corruptionError('unsupported mailbox_format');
  const ids = new Set<string>();
  const files = new Set<string>();

  for (let i = 0; i < d.messages.length; i++) {
    const m = d.messages[i];
    if (typeof m !== 'object' || m === null) {
      throw corruptionError(`entry at index ${i} is not an object`);
    }
    const entry = m as Record<string, unknown>;
    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (typeof entry[field] !== 'string' || (entry[field] as string).length === 0) {
        throw corruptionError(`entry at index ${i} has missing or invalid field "${field}"`);
      }
    }
    if (!Array.isArray(entry.attachments) || entry.attachments.some(a => typeof a !== 'string')) {
      throw corruptionError(`entry at index ${i} has invalid "attachments" field (must be an array)`);
    }
    if (!VALID_STATUSES.includes(entry.status as string)) {
      throw corruptionError(`entry at index ${i} has invalid status "${entry.status}"`);
    }
    const id = entry.id as string;
    if (ids.has(id)) {
      throw corruptionError(`duplicate message ID "${id}" at index ${i} — this can occur from same-second sends in older builds`);
    }
    ids.add(id);
    const file = entry.file as string;
    if (files.has(file)) {
      throw corruptionError(`duplicate file path "${file}" at index ${i}`);
    }
    files.add(file);
    validateMailboxContext(entry as unknown as MessageEntry, d.mailbox_format as number | undefined);
  }

  return data as MessageIndex;
}

export function readIndex(projectRoot: string): MessageIndex {
  const indexPath = assertMailboxPath(projectRoot, MESSAGES_INDEX_FILE.replace(/\\/g, '/'));
  if (!fs.existsSync(indexPath)) return { messages: [] };
  let raw: unknown;
  try {
    raw = fs.readJsonSync(indexPath);
  } catch {
    throw new Error(
      `Mailbox index is not valid JSON: ${MESSAGES_INDEX_FILE}.\n` +
      `Inspect Sigma/messages/index.json manually and restore or repair it.\n` +
      `Do not delete the file — message history may be recoverable from files in Sigma/messages/.`
    );
  }
  return validateMailboxIndexData(raw);
}

export function writeIndex(projectRoot: string, index: MessageIndex): void {
  const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
  validateMailboxIndexData(index);
  assertMailboxPath(projectRoot, MESSAGES_INDEX_FILE.replace(/\\/g, '/'));
  assertMailboxLease(projectRoot);
  fs.ensureDirSync(path.dirname(indexPath));
  if (journaledWriteIfActive(projectRoot, indexPath, JSON.stringify(index, null, 2) + "\n")) return;
  const tmp = `${indexPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeJsonSync(tmp, index, { spaces: 2 });
  atomicReplaceFileSync(tmp, indexPath);
}

export function generateTimestamp(): string {
  return new Date().toISOString();
}

export function formatTimestampForId(iso: string): string {
  // YYYYMMDD-HHMMSSmmm — millisecond precision for collision resistance
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (!m) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}${m[6]}${m[7]}`;
}

export function generateRandomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function generateMessageId(from: SigmaRole, to: SigmaRole, ts: string, suffix: string): string {
  return `MSG-${formatTimestampForId(ts)}-${suffix}-${from}-${to}`;
}

export function generateFilename(type: MessageType, from: SigmaRole, to: SigmaRole, ts: string, suffix: string): string {
  // MEMO is always from === to; the generic "<TYPE>-<FROM>-to-<TO>" pattern
  // would render as "MEMO-DEV-to-DEV", a redundant role mention. Special-case
  // to a role-once form instead.
  if (type === 'MEMO') {
    return `MEMO-${from}-${formatTimestampForId(ts)}-${suffix}.md`;
  }
  return `${formatTimestampForId(ts)}-${suffix}-${type}-${from}-to-${to}.md`;
}

export function buildMessageMarkdown(entry: MessageEntry, body: string): string {
  const attachmentCell = entry.attachments.length > 0
    ? entry.attachments.join(', ')
    : '—';
  const replyToRow = entry.reply_to ? `| Reply To       | ${entry.reply_to} |\n` : '';
  const relatedArtifact = entry.related_artifact || 'N/A';
  const selectedAction: ActionRequired = entry.action || 'FYI';
  const actionChecklist = (VALID_ACTIONS as ReadonlyArray<ActionRequired>)
    .map(a => `- [${a === selectedAction ? 'x' : ' '}] ${a}`)
    .join('\n');

  return `# MSG-${entry.id}

## Metadata

| Field          | Value |
| :---           | :---  |
| Message ID     | ${entry.id} |
| Type           | ${entry.type} |
| From           | ${entry.from} |
| To             | ${entry.to} |
| Subject        | ${entry.subject} |
| Status         | ${entry.status} |
| Created At     | ${entry.created_at} |
${replyToRow}| Related Artifact | ${relatedArtifact} |
| Mailbox Context | ${entry.context ?? 'LEGACY'} |
| Owning INTENT | ${entry.intent_version ?? '—'} |
| Attachments    | ${attachmentCell} |
${entry.contract_change ? "| Revision ID | " + entry.contract_change.revision_id + " |\n| Contract SHA256 | " + entry.contract_change.contract_sha256 + " |" : ""}

---

## Action Required

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe in the message body.

${actionChecklist}

---

## Message

${body}
`;
}

export function getUnreadForRole(
  index: MessageIndex,
  role: SigmaRole,
  opts: { excludeMemo?: boolean; scope?: MailboxScope } = {}
): MessageEntry[] {
  return index.messages.filter(m =>
    m.to === role && m.status === 'UNREAD' && (!opts.excludeMemo || m.type !== 'MEMO') && matchesMailboxScope(m, opts.scope)
  );
}

// Inbox listing tiers (Phase 6):
//   'unread'   — UNREAD only (the default `sigma inbox --role X`)
//   'all'      — everything EXCEPT OUTDATED (`--all`)
//   'outdated' — OUTDATED only (`--outdated`)
export type InboxView = 'unread' | 'all' | 'outdated';

// MEMO is self-to-self and has its own listing (`sigma memo list`) — never
// shown in the cross-role `sigma inbox` view, in any tier.
export function selectInboxMessages(index: MessageIndex, role: SigmaRole, view: InboxView, scope?: MailboxScope): MessageEntry[] {
  return index.messages.filter(m => {
    if (m.to !== role || !matchesMailboxScope(m, scope)) return false;
    if (m.type === 'MEMO') return false;
    if (view === 'unread') return m.status === 'UNREAD';
    if (view === 'outdated') return m.status === 'OUTDATED';
    return m.status !== 'OUTDATED';
  });
}

export function getUnreadMemosForRole(index: MessageIndex, role: SigmaRole, scope?: MailboxScope): MessageEntry[] {
  return index.messages.filter(m => m.to === role && m.type === 'MEMO' && m.status === 'UNREAD' && matchesMailboxScope(m, scope));
}

export function countUnreadMemos(index: MessageIndex, role: SigmaRole, scope?: MailboxScope): number {
  return getUnreadMemosForRole(index, role, scope).length;
}

// READ messages addressed to `role`, oldest-first, beyond the `keep` most
// recent by created_at — the ones `sigma inbox clear` and the `inbox read`
// auto-sweep flip to OUTDATED. keep <= 0 selects every READ message.
export function selectSurplusRead(index: MessageIndex, role: SigmaRole, keep: number, scope?: MailboxScope, memo?: boolean): MessageEntry[] {
  const read = index.messages
    .filter(m => m.to === role && m.status === 'READ' && matchesMailboxScope(m, scope) && (memo === undefined || (m.type === 'MEMO') === memo))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (keep <= 0) return read;
  if (read.length <= keep) return [];
  return read.slice(0, read.length - keep);
}

export function updateMessageStatus(
  index: MessageIndex,
  id: string,
  status: 'READ' | 'ARCHIVED' | 'OUTDATED'
): MessageEntry {
  const entry = index.messages.find(m => m.id === id);
  if (!entry) throw new Error(`Message not found: ${id}`);
  entry.status = status;
  return entry;
}

export function resolveInboxDir(projectRoot: string, role: SigmaRole, context = 'GENERAL', memo = false): string {
  return assertMailboxPath(projectRoot, `Sigma/${memo ? 'memo' : 'messages'}/${role}/${context}`);
}

export function checkMailboxIntegrity(root: string) {
  const index = readIndex(root);
  const missingFiles: Array<{ id: string; file: string }> = [];
  const missingAttachments: Array<{ id: string; path: string }> = [];
  const invalidFields: Array<{ id: string; field: string; value: string }> = [];
  let passes = 0;
  const membershipCache = new Map();
  for (const entry of index.messages) {
    try { assertMailboxPath(root, entry.file, true); passes++; }
    catch { missingFiles.push({ id: entry.id, file: entry.file }); }
    for (const att of entry.attachments) {
      try { assertMailboxPath(root, att, true); passes++; }
      catch { missingAttachments.push({ id: entry.id, path: att }); }
    }
    for (const field of ['from', 'to'] as const) if (!(VALID_ROLES as readonly string[]).includes(entry[field])) invalidFields.push({ id: entry.id, field, value: entry[field] });
    if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(entry.type)) invalidFields.push({ id: entry.id, field: 'type', value: entry.type });
    try { validateMailboxContext(entry, index.mailbox_format); if (index.mailbox_format === 2) validateEntryMembership(root, entry, membershipCache); }
    catch (err) { invalidFields.push({ id: entry.id, field: 'context', value: (err as Error).message }); }
  }
  const indexed = new Set(index.messages.map(m => m.file));
  const orphanFiles = mailboxDiskFiles(root).filter(file => {
    if (indexed.has(file)) { passes++; return false; }
    return true;
  });
  const failures = missingFiles.length + missingAttachments.length + invalidFields.length;
  return {
    ok: failures === 0, passes, warnings: orphanFiles.length, failures,
    findings: { missing_files: missingFiles, orphan_files: orphanFiles, missing_attachments: missingAttachments, duplicate_ids: [] as string[], invalid_fields: invalidFields },
  };
}
