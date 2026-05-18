import fs from 'fs-extra';
import path from 'path';
import {
  MESSAGES_DIR,
  MESSAGES_INDEX_FILE,
  SigmaRole,
  MessageType,
} from '../config';

export interface MessageEntry {
  id: string;
  from: SigmaRole;
  to: SigmaRole;
  type: MessageType;
  subject: string;
  file: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  created_at: string;
  attachments: string[];
}

export interface MessageIndex {
  messages: MessageEntry[];
}

const VALID_STATUSES: ReadonlyArray<string> = ['UNREAD', 'READ', 'ARCHIVED'];
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

  return `# Sigma Role Message

## Metadata

| Field | Value |
| :--- | :--- |
| Message ID | ${entry.id} |
| Type | ${entry.type} |
| From Role | ${entry.from} |
| To Role | ${entry.to} |
| Subject | ${entry.subject} |
| Status | ${entry.status} |
| Created At | ${entry.created_at} |
| Authority Level | Context Only |
| Attachments | ${attachmentCell} |

---

## Message

${body}
`;
}

export function getUnreadForRole(index: MessageIndex, role: SigmaRole): MessageEntry[] {
  return index.messages.filter(m => m.to === role && m.status === 'UNREAD');
}

export function getMessagesForRole(index: MessageIndex, role: SigmaRole, includeAll = false): MessageEntry[] {
  return index.messages.filter(m => {
    if (m.to !== role) return false;
    if (includeAll) return true;
    return m.status === 'UNREAD';
  });
}

export function updateMessageStatus(
  index: MessageIndex,
  id: string,
  status: 'READ' | 'ARCHIVED'
): MessageEntry {
  const entry = index.messages.find(m => m.id === id);
  if (!entry) throw new Error(`Message not found: ${id}`);
  entry.status = status;
  return entry;
}

export function resolveInboxDir(projectRoot: string, role: SigmaRole): string {
  return path.join(projectRoot, MESSAGES_DIR, role);
}
