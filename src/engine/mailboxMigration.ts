import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { MessageIndex, readIndex, writeIndex, checkMailboxIntegrity, validateMailboxIndexData } from './mailbox';
import { assertMailboxPath, mailboxDiskFiles, MIGRATION_REQUIRED } from './mailboxContext';
import { acquireProjectLock } from './controlStore';
import { atomicReplaceFileSync } from '../utils/fs';
import { MESSAGING_ROLES } from '../config';

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

export async function migrateMailbox(root: string, dryRun = false) {
  if (dryRun) return { ...mailboxMigrationDiagnosis(root), applied: false };
  const lock = await acquireProjectLock(root);
  try {
    lock.assertOwned();
    const interrupted = readJournal(root);
    if (interrupted?.stage !== 'completed' && interrupted) await recover(root, interrupted, lock.assertOwned);
    const index = readIndex(root);
    if (index.mailbox_format === 2) return { applied: false, moved: 0, reset_unread: 0, recovered: !!interrupted && interrupted.stage !== 'prepared' };
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
    return { applied: true, moved: moves.length, reset_unread: reset, warnings: integrity.findings.missing_attachments };
  } finally { await lock.release(); }
}
