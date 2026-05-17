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

export function readIndex(projectRoot: string): MessageIndex {
  const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
  if (!fs.existsSync(indexPath)) return { messages: [] };
  try {
    return fs.readJsonSync(indexPath) as MessageIndex;
  } catch {
    return { messages: [] };
  }
}

export function writeIndex(projectRoot: string, index: MessageIndex): void {
  const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
  fs.writeJsonSync(indexPath, index, { spaces: 2 });
}

export function generateTimestamp(): string {
  return new Date().toISOString();
}

export function formatTimestampForId(iso: string): string {
  // YYYYMMDD-HHMMSS from ISO string
  return iso.replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6}).*/, '$1-$2');
}

export function generateMessageId(from: SigmaRole, to: SigmaRole, ts: string): string {
  return `MSG-${formatTimestampForId(ts)}-${from}-${to}`;
}

export function generateFilename(type: MessageType, from: SigmaRole, to: SigmaRole, ts: string): string {
  return `${formatTimestampForId(ts)}-${type}-${from}-to-${to}.md`;
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
