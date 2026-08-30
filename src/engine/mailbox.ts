import fs from 'fs-extra';
import path from 'path';
import {
  MESSAGES_DIR,
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
}

export interface MessageIndex {
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

function validateIndexData(data: unknown): MessageIndex {
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
    if (!Array.isArray(entry.attachments)) {
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
  }

  return data as MessageIndex;
}

export function readIndex(projectRoot: string): MessageIndex {
  const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
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
  return validateIndexData(raw);
}

export function writeIndex(projectRoot: string, index: MessageIndex): void {
  const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
  fs.writeJsonSync(indexPath, index, { spaces: 2 });
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
| Attachments    | ${attachmentCell} |

---

## Action Required

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe in the message body.

${actionChecklist}

---

## Message

${body}
`;
}

export function getUnreadForRole(index: MessageIndex, role: SigmaRole): MessageEntry[] {
  return index.messages.filter(m => m.to === role && m.status === 'UNREAD');
}

// Inbox listing tiers (Phase 6):
//   'unread'   — UNREAD only (the default `sigma inbox --role X`)
//   'all'      — everything EXCEPT OUTDATED (`--all`)
//   'outdated' — OUTDATED only (`--outdated`)
export type InboxView = 'unread' | 'all' | 'outdated';

export function selectInboxMessages(index: MessageIndex, role: SigmaRole, view: InboxView): MessageEntry[] {
  return index.messages.filter(m => {
    if (m.to !== role) return false;
    if (view === 'unread') return m.status === 'UNREAD';
    if (view === 'outdated') return m.status === 'OUTDATED';
    return m.status !== 'OUTDATED';
  });
}

// READ messages addressed to `role`, oldest-first, beyond the `keep` most
// recent by created_at — the ones `sigma inbox clear` and the `inbox read`
// auto-sweep flip to OUTDATED. keep <= 0 selects every READ message.
export function selectSurplusRead(index: MessageIndex, role: SigmaRole, keep: number): MessageEntry[] {
  const read = index.messages
    .filter(m => m.to === role && m.status === 'READ')
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

export function resolveInboxDir(projectRoot: string, role: SigmaRole): string {
  return path.join(projectRoot, MESSAGES_DIR, role);
}
