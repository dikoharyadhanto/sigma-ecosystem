import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { MessageIndex, readIndex, writeIndex, checkMailboxIntegrity, validateMailboxIndexData } from './mailbox';
import { assertMailboxPath, mailboxDiskFiles, MIGRATION_REQUIRED } from './mailboxContext';
import { acquireProjectLock } from './controlStore';
import { atomicReplaceFileSync } from '../utils/fs';
import { MESSAGING_ROLES, VALID_ACTIONS, VALID_MESSAGE_TYPES, ActionRequired, MessageType, SigmaRole } from '../config';
import type { MessageEntry } from './mailbox';

const JOURNAL = 'Sigma/messages/migrations/v2/journal.json';
const INDEX = 'Sigma/messages/index.json';
interface Move { id: string; source: string; destination: string; hash: string }
interface Journal {
  format: 1;
  stage: 'prepared' | 'committed' | 'completed';
  before: string | null;
  after: MessageIndex;
  moves: Move[];
  migrated_at: string;
}
const hash = (content: Buffer): string => crypto.createHash('sha256').update(content).digest('hex');

// ── Orphan adoption ──────────────────────────────────────────────────────────
//
// A legacy message file that exists on disk but has no index entry blocks the
// migration (F03). Adoption registers such files as ordinary legacy entries
// first, so the existing transactional migration then moves them like any
// other. Only files whose metadata parses completely are adopted; anything
// else is reported and the migration still refuses. An adopted entry is READ:
// no recipient ever saw it through the index, so it must not raise a sender gate.

const ORPHAN_LOG = 'Sigma/messages/migrations/v2/adopted-orphans.json';
const ORPHAN_PATH = /^Sigma\/messages\/(ARC|FMN|DEV|AUD)\/[^/]+\.md$/;

// Message files written by the earliest Sigma format name two fields differently
// and use two message types that no longer exist. The field names map one to
// one. The two retired types are indexed as NOTE, the neutral type; the file is
// untouched and the original type is kept in the adoption log.
const LEGACY_FIELD_ALIASES: Record<string, string> = { 'From Role': 'From', 'To Role': 'To', 'Ref Message': 'In Reply To' };
const RETIRED_TYPES = new Set(['REPLY', 'REQUEST']);

export interface OrphanCandidate { file: string; entry?: MessageEntry; error?: string; original_type?: string }

function legacyMetadata(markdown: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inside = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^##\s+Metadata\s*$/.test(line)) { inside = true; continue; }
    if (!inside) continue;
    if (/^---\s*$/.test(line)) break;
    const m = /^\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!m || m[1] === 'Field' || /^:?-+:?$/.test(m[1])) continue;
    out[m[1]] = m[2];
  }
  for (const [alias, canonical] of Object.entries(LEGACY_FIELD_ALIASES)) {
    if (alias in out && !(canonical in out)) out[canonical] = out[alias];
  }
  return out;
}

function parseOrphan(root: string, file: string, takenIds: Set<string>): OrphanCandidate {
  const reject = (error: string): OrphanCandidate => ({ file, error });
  const match = ORPHAN_PATH.exec(file);
  if (!match) return reject('not a role message file under Sigma/messages/<ROLE>/');
  const markdown = fs.readFileSync(assertMailboxPath(root, file, true), 'utf8');
  const meta = legacyMetadata(markdown);
  const id = meta['Message ID'], type = meta['Type'], from = meta['From'], to = meta['To'], created = meta['Created At'];
  if (!id || !/^MSG-[A-Za-z0-9-]+$/.test(id)) return reject('missing or malformed Message ID');
  if (takenIds.has(id)) return reject(`duplicate Message ID ${id}`);
  const retired = RETIRED_TYPES.has(type ?? '');
  if (!retired && !(VALID_MESSAGE_TYPES as readonly string[]).includes(type ?? '')) return reject(`unknown type "${type}"`);
  if (!(MESSAGING_ROLES as readonly string[]).includes(from ?? '') || !(MESSAGING_ROLES as readonly string[]).includes(to ?? '')) return reject('From or To is not a messaging role');
  if (type === 'MEMO' && from !== to) return reject('MEMO whose From and To differ');
  const indexedType = (retired ? 'NOTE' : type) as MessageType;
  if (to !== match[1]) return reject(`stored under ${match[1]} but addressed to ${to}`);
  if (!created || Number.isNaN(Date.parse(created))) return reject('missing or invalid Created At');
  const attachmentCell = meta['Attachments'] ?? '';
  const attachments: string[] = [];
  if (!/^[—–-]*$/.test(attachmentCell)) {
    for (const raw of attachmentCell.split(/[;,]/).map(a => a.trim()).filter(Boolean)) {
      const rel = raw.replace(/\\/g, '/');
      // The earliest format used this cell for free text as well. A value that is
      // not a Sigma path is a description and stays in the message file only.
      if (!rel.startsWith('Sigma/')) continue;
      if (!/^Sigma\/messages\/attachments\/[^/]+$/.test(rel) || rel.includes('..')) return reject(`attachment outside Sigma/messages/attachments/: ${raw}`);
      try { assertMailboxPath(root, rel, true); } catch { return reject(`attachment does not exist: ${raw}`); }
      attachments.push(rel);
    }
  }
  const checked = /^\s*-\s*\[[xX]\]\s*(FYI|RESPOND|REVIEW|UNBLOCK|OTHER)\b/m.exec(markdown);
  const action = (checked ? checked[1] : 'FYI') as ActionRequired;
  if (!(VALID_ACTIONS as readonly string[]).includes(action)) return reject('invalid action');
  const entry: MessageEntry = {
    id, from: from as SigmaRole, to: to as SigmaRole, type: indexedType,
    subject: meta['Subject'] || path.basename(file, '.md'), file, status: 'READ', created_at: created,
    attachments, action,
  };
  const reply = meta['In Reply To'];
  if (reply && /^MSG-[A-Za-z0-9-]+$/.test(reply)) entry.reply_to = reply;
  const related = meta['Related Artifact'];
  if (related && !/^[—–-]+$/.test(related)) entry.related_artifact = related;
  takenIds.add(id);
  return retired ? { file, entry, original_type: type } : { file, entry };
}

export function inspectOrphans(root: string, index: MessageIndex): OrphanCandidate[] {
  const indexed = new Set(index.messages.map(m => m.file));
  const ids = new Set(index.messages.map(m => m.id));
  return mailboxDiskFiles(root).filter(file => !indexed.has(file)).sort().map(file => parseOrphan(root, file, ids));
}

function readJournal(root: string): Journal | null {
  const file = assertMailboxPath(root, JOURNAL);
  if (!fs.existsSync(file)) return null;
  const j = fs.readJsonSync(file) as Journal;
  if (j.format !== 1 || !['prepared', 'committed', 'completed'].includes(j.stage) || !Array.isArray(j.moves) || !(j.before === null || typeof j.before === 'string') || j.after?.mailbox_format !== 2 || typeof j.migrated_at !== 'string') throw new Error('Corrupt mailbox migration journal; manual recovery required.');
  const ids = new Set<string>();
  validateMailboxIndexData(j.after);
  let before: MessageIndex = { messages: [] };
  if (j.before !== null) {
    const decoded = Buffer.from(j.before, 'base64');
    if (decoded.toString('base64') !== j.before) throw new Error('Invalid migration index snapshot.');
    before = validateMailboxIndexData(JSON.parse(decoded.toString('utf8')));
    if (before.mailbox_format !== undefined) throw new Error('Migration snapshot is not legacy.');
  }
  if (before.messages.length !== j.moves.length || j.after.messages.length !== j.moves.length) throw new Error('Migration journal entry count mismatch.');
  for (const m of j.moves) {
    if (typeof m.id !== 'string' || !/^[a-f0-9]{64}$/.test(m.hash) || !/^Sigma\/messages\/(ARC|FMN|DEV|AUD)\/[^/]+\.md$/.test(m.source) || !/^Sigma\/(messages|memo)\/(ARC|FMN|DEV|AUD)\/LEGACY\/[^/]+\.md$/.test(m.destination) || ids.has(m.id)) throw new Error('Invalid mailbox migration move; manual recovery required.');
    ids.add(m.id); assertMailboxPath(root, m.source); assertMailboxPath(root, m.destination);
    const entry = j.after.messages.find(e => e.id === m.id);
    const original = before.messages.find(e => e.id === m.id);
    if (!entry || !original || original.file !== m.source || entry.to !== original.to || entry.from !== original.from || entry.type !== original.type || entry.file !== m.destination || entry.context !== 'LEGACY' || entry.migration?.original_file !== m.source || entry.migration?.original_status !== original.status || entry.status !== (original.status === 'UNREAD' ? 'READ' : original.status)) throw new Error('Mailbox migration journal identity mismatch.');
  }
  return j;
}

function saveJournal(root: string, j: Journal): void {
  const absolute = assertMailboxPath(root, JOURNAL);
  fs.ensureDirSync(path.dirname(absolute));
  const tmp = `${absolute}.${process.pid}.tmp`;
  fs.writeJsonSync(tmp, j, { spaces: 2 });
  atomicReplaceFileSync(tmp, absolute);
}

function failpoint(name: string): void {
  if (process.env.SIGMA_TEST_MAILBOX_MIGRATION_CRASH_AT === name && process.env.NODE_ENV === 'test') process.exit(91);
  if (process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT === name && process.env.NODE_ENV === 'test') throw new Error(`Mailbox migration failpoint: ${name}`);
}

function verifyFile(root: string, rel: string, expected: string): void {
  const absolute = assertMailboxPath(root, rel, true);
  if (hash(fs.readFileSync(absolute)) !== expected) throw new Error(`Mailbox migration hash conflict: ${rel}. No overwrite; manual recovery required.`);
}

function indexMatches(root: string, j: Journal): 'before' | 'after' {
  const file = assertMailboxPath(root, INDEX);
  const current = fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (current === null && j.before === null || current !== null && j.before !== null && current.equals(Buffer.from(j.before, 'base64'))) return 'before';
  if (current && current.equals(Buffer.from(JSON.stringify(j.after, null, 2) + '\n'))) return 'after';
  throw new Error('Mailbox migration index changed outside transaction; manual recovery required.');
}

async function recover(root: string, j: Journal, assertOwned: () => void): Promise<void> {
  if (j.stage === 'completed') return;
  const state = indexMatches(root, j);
  if (j.stage === 'prepared') {
    for (const m of j.moves) {
      verifyFile(root, m.source, m.hash);
      if (fs.existsSync(assertMailboxPath(root, m.destination))) verifyFile(root, m.destination, m.hash);
    }
    assertOwned();
    if (state === 'after') {
      const indexFile = assertMailboxPath(root, INDEX);
      if (j.before === null) fs.unlinkSync(indexFile);
      else {
        const tmp = `${indexFile}.${process.pid}.rollback`;
        fs.writeFileSync(tmp, Buffer.from(j.before, 'base64'));
        atomicReplaceFileSync(tmp, indexFile);
      }
    }
    for (const m of j.moves) {
      const destination = assertMailboxPath(root, m.destination);
      if (fs.existsSync(destination)) { assertOwned(); await fs.remove(destination); }
    }
    // Sources were never removed before commit; a retry can preflight again.
    assertOwned(); fs.unlinkSync(assertMailboxPath(root, JOURNAL));
    return;
  }
  if (state !== 'after') throw new Error('Committed mailbox migration index was replaced; manual recovery required.');
  for (const m of j.moves) {
    verifyFile(root, m.destination, m.hash);
    if (fs.existsSync(assertMailboxPath(root, m.source))) verifyFile(root, m.source, m.hash);
  }
  for (const m of j.moves) {
    const source = assertMailboxPath(root, m.source);
    if (fs.existsSync(source)) { assertOwned(); await fs.remove(source); }
  }
  assertOwned(); j.stage = 'completed'; saveJournal(root, j);
}

export function mailboxMigrationDiagnosis(root: string) {
  const journal = readJournal(root);
  const index = readIndex(root);
  const disk = mailboxDiskFiles(root);
  const pending = journal !== null && journal.stage !== 'completed';
  const required = pending || index.mailbox_format !== 2 && (index.messages.length > 0 || disk.length > 0);
  const integrity = checkMailboxIntegrity(root);
  return { required, interrupted: pending, stage: journal?.stage ?? null, move_count: index.mailbox_format === 2 ? 0 : index.messages.length, reset_unread_count: index.mailbox_format === 2 ? 0 : index.messages.filter(m => m.status === 'UNREAD').length, integrity, warnings: [...(required ? [MIGRATION_REQUIRED] : []), ...(integrity.failures || integrity.warnings ? [`Mailbox integrity: ${integrity.failures} failure(s), ${integrity.warnings} orphan file(s). Run sigma inbox check.`] : [])] };
}

export { withMailboxLock } from './mailboxLock';

export async function migrateMailbox(root: string, dryRun = false, adoptOrphans = false) {
  if (dryRun) {
    const base = { ...mailboxMigrationDiagnosis(root), applied: false };
    if (!adoptOrphans) return base;
    const candidates = inspectOrphans(root, readIndex(root));
    return { ...base, adopt_orphans: {
      adoptable: candidates.filter(c => c.entry).length,
      rejected: candidates.filter(c => c.error).map(c => ({ file: c.file, reason: c.error })),
    } };
  }
  const lock = await acquireProjectLock(root);
  try {
    lock.assertOwned();
    const interrupted = readJournal(root);
    if (interrupted?.stage !== 'completed' && interrupted) await recover(root, interrupted, lock.assertOwned);
    const index = readIndex(root);
    if (index.mailbox_format === 2) return { applied: false, moved: 0, reset_unread: 0, recovered: !!interrupted && interrupted.stage !== 'prepared' };
    let adopted: string[] = [];
    if (adoptOrphans) {
      const pre = checkMailboxIntegrity(root);
      if (pre.findings.missing_files.length || pre.findings.invalid_fields.length) throw new Error('Mailbox migration preflight failed: missing source or invalid metadata. Nothing moved.');
      const candidates = inspectOrphans(root, index);
      const rejected = candidates.filter(c => c.error);
      if (rejected.length) throw new Error(`Orphan adoption refused: ${rejected.length} file(s) cannot be adopted. Nothing changed.\n` + rejected.slice(0, 10).map(c => `  ${c.file}: ${c.error}`).join('\n'));
      const entries = candidates.map(c => c.entry!);
      if (entries.length) {
        const originalTypes = new Map(candidates.filter(c => c.original_type).map(c => [c.entry!.id, c.original_type!]));
        const record = entries.map(e => ({
          id: e.id, file: e.file, sha256: hash(fs.readFileSync(assertMailboxPath(root, e.file, true))),
          ...(originalTypes.has(e.id) ? { original_type: originalTypes.get(e.id), indexed_type: e.type } : {}),
        }));
        const logFile = assertMailboxPath(root, ORPHAN_LOG);
        fs.ensureDirSync(path.dirname(logFile));
        const tmp = `${logFile}.${process.pid}.tmp`;
        fs.writeJsonSync(tmp, { adopted_at: new Date().toISOString(), files: record }, { spaces: 2 });
        atomicReplaceFileSync(tmp, logFile);
        lock.assertOwned();
        index.messages.push(...entries);
        writeIndex(root, index);
        adopted = entries.map(e => e.id);
      }
    }
    const integrity = checkMailboxIntegrity(root);
    if (integrity.findings.missing_files.length || integrity.findings.orphan_files.length || integrity.findings.invalid_fields.length) throw new Error('Mailbox migration preflight failed: missing source, orphan file, or invalid metadata. Nothing moved.');
    const beforeFile = assertMailboxPath(root, INDEX);
    const before = fs.existsSync(beforeFile) ? fs.readFileSync(beforeFile).toString('base64') : null;
    const after: MessageIndex = JSON.parse(JSON.stringify(index));
    after.mailbox_format = 2;
    const timestamp = new Date().toISOString();
    const moves: Move[] = [];
    let reset = 0;
    for (const e of after.messages) {
      if (!(MESSAGING_ROLES as readonly string[]).includes(e.from) || !(MESSAGING_ROLES as readonly string[]).includes(e.to) || e.type === 'MEMO' && e.from !== e.to) throw new Error(`Invalid legacy mailbox identity: ${e.id}`);
      const source = e.file;
      const destination = `Sigma/${e.type === 'MEMO' ? 'memo' : 'messages'}/${e.to}/LEGACY/${path.basename(source)}`;
      if (fs.existsSync(assertMailboxPath(root, destination))) throw new Error(`Mailbox migration destination collision: ${destination}. Nothing moved.`);
      moves.push({ id: e.id, source, destination, hash: hash(fs.readFileSync(assertMailboxPath(root, source, true))) });
      e.migration = { original_file: source, original_status: e.status, migrated_at: timestamp };
      if (e.status === 'UNREAD') { e.status = 'READ'; reset++; }
      e.file = destination; e.intent_version = null; e.context = 'LEGACY';
    }
    const map = new Map(moves.map(m => [m.source, m.destination]));
    for (const e of after.messages) e.attachments = e.attachments.map(a => map.get(a) ?? a);
    const journal: Journal = { format: 1, stage: 'prepared', before, after, moves, migrated_at: timestamp };
    lock.assertOwned(); saveJournal(root, journal); failpoint('after_journal');
    for (const m of moves) {
      verifyFile(root, m.source, m.hash);
      const dest = assertMailboxPath(root, m.destination);
      fs.ensureDirSync(path.dirname(dest));
      lock.assertOwned(); await fs.copyFile(assertMailboxPath(root, m.source, true), dest, fs.constants.COPYFILE_EXCL);
      verifyFile(root, m.destination, m.hash); failpoint('after_copy');
    }
    lock.assertOwned(); writeIndex(root, after); failpoint('after_index');
    journal.stage = 'committed'; saveJournal(root, journal); failpoint('after_commit');
    await recover(root, journal, lock.assertOwned); failpoint('after_cleanup');
    return { applied: true, moved: moves.length, reset_unread: reset, adopted_orphans: adopted.length, warnings: integrity.findings.missing_attachments };
  } finally { await lock.release(); }
}
