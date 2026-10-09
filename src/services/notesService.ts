// F06 — sigma notes. Transport-agnostic use-cases for `sigma notes new|list|update`
// (no Commander, no console.log): the CLI formats whatever this module returns.
//
// Model (Director decisions K-1..K-12, Implementation/sigmav2_implementation/F06_sigma-notes.md):
//   - A note is a free-form, independent Markdown file. Only `new` registers one.
//   - The registry (Sigma/notes-registry.json) is the source of truth for identity.
//   - Sigma/notes/note-list.md is a fully generated view of the registry
//     (ID | Nama file | Title); manual edits are overwritten and never register
//     or deregister anything.
//   - `update` rejects any non-Markdown file in the notes tree (whole run
//     refuses) and moves every Markdown file that is not a registered note to
//     Sigma/notes/unregistered-notes/. It never deletes or overwrites.
//   - Notes never reference an artifact; artifacts may reference notes.
//
// Not tracked in progress-v<N>.json: no gate, no lock state, no chain.

import fs from 'fs-extra';
import path from 'path';
import {
  PROJECT_SIGMA_DIR,
  NOTES_DIR,
  NOTES_REGISTERED_DIR,
  NOTES_UNREGISTERED_DIR,
  NOTES_CATALOG_FILE,
  NOTES_REGISTRY_FILE,
  VALID_ROLES,
} from '../config';
import { atomicReplaceFileSync, toPosix } from '../utils/fs';

export class NotesError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'NotesError';
  }
}

export const NOTES_FORMAT = 1;
const MAX_SLUG_LENGTH = 60;
const REGISTERED_SEGMENT = 'note-list';
const UNREGISTERED_SEGMENT = 'unregistered-notes';
const CATALOG_NAME = 'note-list.md';
// Placeholders written by the OS or Git; never a note and never a violation (F06 O-13).
const SYSTEM_FILES = new Set(['.gitkeep', 'desktop.ini', 'thumbs.db', '.ds_store']);
const NOTE_FILE_PATTERN = /^NOTE-(\d{10})-[a-z0-9-]+\.md$/;

export interface NoteEntry {
  id: string;
  file: string;
  title: string;
  /** Posix path relative to Sigma/, e.g. notes/note-list/NOTE-2610091530-x.md */
  path: string;
  created_at: string;
  created_by_role?: string;
  /** Set only on entries restored by `update --rebuild-registry`. */
  recovered?: boolean;
}

export interface NotesRegistry {
  notes_format: number;
  /** Highest numeric ID ever issued — IDs are never reused. */
  last_id: number;
  notes: NoteEntry[];
}

// ── Paths ────────────────────────────────────────────────────────────────────

interface NotesPaths {
  sigmaDir: string;
  notesDir: string;
  registeredDir: string;
  unregisteredDir: string;
  catalogFile: string;
  registryFile: string;
}

function notesPaths(root: string): NotesPaths {
  return {
    sigmaDir: path.join(root, PROJECT_SIGMA_DIR),
    notesDir: path.join(root, NOTES_DIR),
    registeredDir: path.join(root, NOTES_REGISTERED_DIR),
    unregisteredDir: path.join(root, NOTES_UNREGISTERED_DIR),
    catalogFile: path.join(root, NOTES_CATALOG_FILE),
    registryFile: path.join(root, NOTES_REGISTRY_FILE),
  };
}

/** Creates the notes folders (idempotent). */
export function ensureNotesDirs(root: string): void {
  const p = notesPaths(root);
  fs.ensureDirSync(p.registeredDir);
  fs.ensureDirSync(p.unregisteredDir);
}

// ── Title / slug / naming ────────────────────────────────────────────────────

export function validateTitle(title: string): string {
  const trimmed = (title ?? '').trim();
  if (!trimmed) throw new NotesError('INVALID_TITLE', '--title is required and cannot be empty.');
  if (/[\r\n]/.test(trimmed)) {
    throw new NotesError('INVALID_TITLE', '--title cannot contain a newline (it would break the note-list.md table).');
  }
  return trimmed;
}

/** Lowercase ASCII slug: diacritics stripped, non-alphanumerics become "-", max 60 chars. */
export function slugify(title: string): string {
  const base = title.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '');
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** YYMMDDHHMM in local time. */
export function noteStamp(d: Date): string {
  return `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function displayDateTime(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatNoteId(n: number): string {
  return `N${pad(n)}`;
}

function parseNoteIdNumber(id: string): number | null {
  const m = /^N(\d+)$/i.exec(id.trim());
  return m ? parseInt(m[1], 10) : null;
}

function emptyRegistry(): NotesRegistry {
  return { notes_format: NOTES_FORMAT, last_id: 0, notes: [] };
}

// ── Registry I/O ─────────────────────────────────────────────────────────────

export type RegistryState =
  | { state: 'missing' }
  | { state: 'ok'; registry: NotesRegistry }
  | { state: 'unreadable'; reason: string };

function isNoteEntry(v: unknown): v is NoteEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.file === 'string' &&
    typeof e.title === 'string' &&
    typeof e.path === 'string' &&
    typeof e.created_at === 'string' &&
    (e.created_by_role === undefined || typeof e.created_by_role === 'string') &&
    (e.recovered === undefined || typeof e.recovered === 'boolean')
  );
}

export function loadRegistry(root: string): RegistryState {
  const file = notesPaths(root).registryFile;
  if (!fs.existsSync(file)) return { state: 'missing' };
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { state: 'unreadable', reason: `not valid JSON (${(e as Error).message})` };
  }
  if (!data || typeof data !== 'object') return { state: 'unreadable', reason: 'not a JSON object' };
  const r = data as Record<string, unknown>;
  if (typeof r.notes_format !== 'number') return { state: 'unreadable', reason: 'missing notes_format' };
  if (r.notes_format > NOTES_FORMAT) {
    return { state: 'unreadable', reason: `notes_format ${r.notes_format} is newer than this Sigma supports (${NOTES_FORMAT})` };
  }
  if (typeof r.last_id !== 'number' || !Array.isArray(r.notes) || !r.notes.every(isNoteEntry)) {
    return { state: 'unreadable', reason: 'unexpected shape (last_id/notes)' };
  }
  return { state: 'ok', registry: r as unknown as NotesRegistry };
}

function writeTextAtomic(file: string, text: string): void {
  fs.ensureDirSync(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, text, 'utf8');
    atomicReplaceFileSync(tmp, file);
  } catch (e) {
    fs.removeSync(tmp);
    throw e;
  }
}

function writeRegistry(root: string, registry: NotesRegistry): void {
  writeTextAtomic(notesPaths(root).registryFile, JSON.stringify(registry, null, 2) + '\n');
}

// ── Catalog (note-list.md) ───────────────────────────────────────────────────

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

/** Splits a table row into cells; "\|" inside a cell is an escaped pipe. */
function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '|') {
      cur += '|';
      i += 1;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

interface CatalogRow {
  id: string;
  fileText: string;
  title: string;
}

/** Data rows only: the header and the separator are skipped. */
function parseCatalogRows(text: string): CatalogRow[] {
  const rows: CatalogRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = splitRow(line);
    if (cells.length < 3) continue;
    if (cells[0].toLowerCase() === 'id') continue;
    if (cells.every(c => /^:?-+:?$/.test(c))) continue;
    const link = /^\[([^\]]+)\]\([^)]*\)$/.exec(cells[1]);
    rows.push({ id: cells[0], fileText: link ? link[1] : cells[1], title: cells[2] });
  }
  return rows;
}

function catalogHasRows(root: string): boolean {
  const file = notesPaths(root).catalogFile;
  if (!fs.existsSync(file)) return false;
  return parseCatalogRows(fs.readFileSync(file, 'utf8')).some(r => parseNoteIdNumber(r.id) !== null);
}

function entryFileExists(root: string, entry: NoteEntry): boolean {
  return fs.existsSync(path.join(notesPaths(root).sigmaDir, entry.path));
}

/** Catalog text built purely from the registry. Rows whose file is missing are not shown (K-6). */
export function renderCatalog(root: string, registry: NotesRegistry): string {
  const entries = registry.notes
    .filter(e => entryFileExists(root, e))
    .sort((a, b) => (parseNoteIdNumber(a.id) ?? 0) - (parseNoteIdNumber(b.id) ?? 0));
  const lines = [
    '# Note List',
    '',
    'Dihasilkan otomatis oleh `sigma notes`. Jangan disunting; perubahan manual akan ditimpa dan tidak mengubah registrasi catatan.',
    '',
    '| ID | Nama file | Title |',
    '|---|---|---|',
    ...entries.map(e => `| ${e.id} | [${e.file}](${REGISTERED_SEGMENT}/${e.file}) | ${escapeCell(e.title)} |`),
  ];
  return lines.join('\n') + '\n';
}

/** Rewrites note-list.md from the registry. Returns true when the file changed. */
export function syncCatalog(root: string, registry: NotesRegistry): boolean {
  const file = notesPaths(root).catalogFile;
  const text = renderCatalog(root, registry);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
  writeTextAtomic(file, text);
  return true;
}

// ── Preconditions shared by new / update ─────────────────────────────────────

const REBUILD_HINT = 'Restore Sigma/notes-registry.json from Git or a backup, or run `sigma notes update --rebuild-registry`.';

/** Registry for a mutating command: refuses unreadable, and refuses missing-with-catalog (K-7). */
function registryForWrite(root: string): { registry: NotesRegistry; created: boolean } {
  const st = loadRegistry(root);
  if (st.state === 'unreadable') {
    throw new NotesError('REGISTRY_UNREADABLE', `Sigma/notes-registry.json is unreadable: ${st.reason}. It was not modified. ${REBUILD_HINT}`);
  }
  if (st.state === 'ok') return { registry: st.registry, created: false };
  if (catalogHasRows(root)) {
    throw new NotesError(
      'REGISTRY_MISSING',
      `Sigma/notes-registry.json is missing but ${NOTES_CATALOG_FILE.replace(/\\/g, '/')} lists notes, so this project used notes before. Nothing was changed. ${REBUILD_HINT}`
    );
  }
  return { registry: emptyRegistry(), created: true };
}

/**
 * `sigma project start` / `--reinit`: creates the folders, an empty registry and the
 * initial catalog. Never overwrites an existing, unreadable, or previously-used registry.
 */
export function initNotes(root: string): void {
  ensureNotesDirs(root);
  const st = loadRegistry(root);
  if (st.state !== 'missing' || catalogHasRows(root)) return;
  const registry = emptyRegistry();
  writeRegistry(root, registry);
  syncCatalog(root, registry);
}

// ── new ──────────────────────────────────────────────────────────────────────

export interface NewNoteResult {
  entry: NoteEntry;
  /** Project-root-relative posix path of the created file. */
  relPath: string;
  catalogUpdated: boolean;
  catalogError: string | null;
}

export function normalizeRole(role: string | undefined): string | undefined {
  if (!role) return undefined;
  const r = role.toUpperCase();
  if (!(VALID_ROLES as readonly string[]).includes(r)) {
    throw new NotesError('INVALID_ROLE', `Invalid role "${role}". Valid roles: ${VALID_ROLES.map(x => x.toLowerCase()).join(', ')}.`);
  }
  return r;
}

export function createNote(root: string, rawTitle: string, opts: { role?: string; now?: Date } = {}): NewNoteResult {
  const title = validateTitle(rawTitle);
  const slug = slugify(title);
  if (!slug) {
    throw new NotesError('INVALID_TITLE', `The title "${title}" has no letters or digits to build a file name from. Use a title with at least one letter or digit.`);
  }
  const role = normalizeRole(opts.role);
  const now = opts.now ?? new Date();

  const { registry } = registryForWrite(root);
  ensureNotesDirs(root);
  const p = notesPaths(root);

  const taken = new Set(registry.notes.map(e => e.file.toLowerCase()));
  const baseName = `NOTE-${noteStamp(now)}-${slug}`;
  let fileName = `${baseName}.md`;
  for (let n = 2; taken.has(fileName.toLowerCase()) || fs.existsSync(path.join(p.registeredDir, fileName)); n += 1) {
    fileName = `${baseName}-${n}.md`;
  }

  const filePath = path.join(p.registeredDir, fileName);
  fs.writeFileSync(filePath, `# ${title}\n\nDibuat: ${displayDateTime(now)}\n`, { encoding: 'utf8', flag: 'wx' });

  const nextNumber = Math.max(registry.last_id, ...registry.notes.map(e => parseNoteIdNumber(e.id) ?? 0)) + 1;
  const entry: NoteEntry = {
    id: formatNoteId(nextNumber),
    file: fileName,
    title,
    path: toPosix(path.relative(p.sigmaDir, filePath)),
    created_at: now.toISOString(),
    ...(role ? { created_by_role: role } : {}),
  };
  registry.notes.push(entry);
  registry.last_id = nextNumber;
  try {
    writeRegistry(root, registry);
  } catch (e) {
    throw new NotesError(
      'REGISTRY_WRITE_FAILED',
      `The note file was created at ${toPosix(path.relative(root, filePath))} but could not be registered: ${(e as Error).message}. ` +
        'The file will be treated as unregistered by `sigma notes update`.'
    );
  }

  let catalogUpdated = false;
  let catalogError: string | null = null;
  try {
    catalogUpdated = syncCatalog(root, registry);
  } catch (e) {
    catalogError = (e as Error).message;
  }
  return { entry, relPath: toPosix(path.relative(root, filePath)), catalogUpdated, catalogError };
}

// ── scan / list ──────────────────────────────────────────────────────────────

export interface NotesScan {
  /** Notes-relative posix paths of non-Markdown files (violations). */
  nonMarkdown: string[];
  /** Notes-relative posix paths of Markdown files that are not registered notes. */
  unregistered: string[];
}

function walkFiles(dir: string, base: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, base, out);
    } else if (entry.isFile()) {
      out.push(toPosix(path.relative(base, abs)));
    }
  }
}

export function scanNotes(root: string, registry: NotesRegistry | null): NotesScan {
  const p = notesPaths(root);
  const files: string[] = [];
  walkFiles(p.notesDir, p.notesDir, files);
  const registered = new Set((registry?.notes ?? []).map(e => e.path));
  const scan: NotesScan = { nonMarkdown: [], unregistered: [] };
  for (const rel of files.sort()) {
    const name = path.posix.basename(rel);
    if (SYSTEM_FILES.has(name.toLowerCase())) continue;
    if (path.posix.extname(name).toLowerCase() !== '.md') {
      scan.nonMarkdown.push(rel);
      continue;
    }
    if (rel === CATALOG_NAME) continue;
    if (rel.startsWith(`${UNREGISTERED_SEGMENT}/`)) continue;
    if (registered.has(`notes/${rel}`)) continue;
    scan.unregistered.push(rel);
  }
  return scan;
}

export interface ListedNote {
  entry: NoteEntry;
  missing: boolean;
}

export interface ListNotesResult {
  notes: ListedNote[];
  scan: NotesScan;
  registryPresent: boolean;
}

export function listNotes(root: string, search?: string): ListNotesResult {
  const st = loadRegistry(root);
  if (st.state === 'unreadable') {
    throw new NotesError('REGISTRY_UNREADABLE', `Sigma/notes-registry.json is unreadable: ${st.reason}. ${REBUILD_HINT}`);
  }
  if (st.state === 'missing' && catalogHasRows(root)) {
    throw new NotesError('REGISTRY_MISSING', `Sigma/notes-registry.json is missing but the catalog lists notes. ${REBUILD_HINT}`);
  }
  const registry = st.state === 'ok' ? st.registry : null;
  const needle = search?.trim().toLowerCase();
  const notes = (registry?.notes ?? [])
    .filter(e => !needle || e.title.toLowerCase().includes(needle))
    .sort((a, b) => {
      const byTime = b.created_at.localeCompare(a.created_at);
      return byTime !== 0 ? byTime : (parseNoteIdNumber(b.id) ?? 0) - (parseNoteIdNumber(a.id) ?? 0);
    })
    .map(entry => ({ entry, missing: !entryFileExists(root, entry) }));
  return { notes, scan: scanNotes(root, registry), registryPresent: st.state === 'ok' };
}

// ── update ───────────────────────────────────────────────────────────────────

export interface PlannedMove {
  /** Notes-relative posix paths. */
  from: string;
  to: string;
}

function withSuffix(rel: string, n: number): string {
  const ext = path.posix.extname(rel);
  return `${rel.slice(0, rel.length - ext.length)}-${n}${ext}`;
}

/** Deterministic plan; never overwrites an existing or already-planned target. */
export function planMoves(root: string, unregistered: string[]): PlannedMove[] {
  const p = notesPaths(root);
  const planned = new Set<string>();
  const moves: PlannedMove[] = [];
  for (const from of unregistered) {
    const rest = from.startsWith(`${REGISTERED_SEGMENT}/`) ? from.slice(REGISTERED_SEGMENT.length + 1) : from;
    const base = `${UNREGISTERED_SEGMENT}/${rest}`;
    let to = base;
    for (let n = 2; planned.has(to.toLowerCase()) || fs.existsSync(path.join(p.notesDir, to)); n += 1) {
      to = withSuffix(base, n);
    }
    planned.add(to.toLowerCase());
    moves.push({ from, to });
  }
  return moves;
}

export interface UpdateNotesResult {
  dryRun: boolean;
  /** Non-empty means the run was refused and nothing was changed. */
  violations: string[];
  moves: PlannedMove[];
  registryCreated: boolean;
  catalogUpdated: boolean;
  registered: number;
  missing: string[];
}

export function updateNotes(root: string, opts: { dryRun?: boolean } = {}): UpdateNotesResult {
  const dryRun = Boolean(opts.dryRun);
  const st = loadRegistry(root);
  const { registry, created } = registryForWrite(root);
  const scan = scanNotes(root, st.state === 'ok' ? st.registry : registry);

  const result: UpdateNotesResult = {
    dryRun,
    violations: scan.nonMarkdown,
    moves: [],
    registryCreated: false,
    catalogUpdated: false,
    registered: registry.notes.length,
    missing: registry.notes.filter(e => !entryFileExists(root, e)).map(e => `${e.id} ${e.path}`),
  };
  if (scan.nonMarkdown.length > 0) return result;

  result.moves = planMoves(root, scan.unregistered);
  if (dryRun) return result;

  const p = notesPaths(root);
  ensureNotesDirs(root);
  const done: string[] = [];
  try {
    for (const move of result.moves) {
      const dest = path.join(p.notesDir, move.to);
      fs.ensureDirSync(path.dirname(dest));
      fs.renameSync(path.join(p.notesDir, move.from), dest);
      done.push(move.from);
    }
  } catch (e) {
    throw new NotesError(
      'MOVE_FAILED',
      `Moving notes stopped after ${done.length} of ${result.moves.length} file(s): ${(e as Error).message}. ` +
        'Nothing was deleted; run `sigma notes update` again to continue.'
    );
  }

  if (created) {
    writeRegistry(root, registry);
    result.registryCreated = true;
  }
  result.catalogUpdated = syncCatalog(root, registry);
  return result;
}

// ── rebuild-registry ─────────────────────────────────────────────────────────

export interface RebuildReport {
  confirmed: boolean;
  accepted: NoteEntry[];
  rejected: { row: string; reason: string }[];
  lastId: number;
  corruptBackup: string | null;
}

function createdAtFromStamp(stamp: string): string | null {
  const yy = parseInt(stamp.slice(0, 2), 10);
  const mo = parseInt(stamp.slice(2, 4), 10);
  const dd = parseInt(stamp.slice(4, 6), 10);
  const hh = parseInt(stamp.slice(6, 8), 10);
  const mi = parseInt(stamp.slice(8, 10), 10);
  const d = new Date(2000 + yy, mo - 1, dd, hh, mi, 0, 0);
  if (d.getFullYear() !== 2000 + yy || d.getMonth() !== mo - 1 || d.getDate() !== dd || d.getHours() !== hh || d.getMinutes() !== mi) {
    return null;
  }
  return d.toISOString();
}

/**
 * Restores the registry from note-list.md (F06 K-7). Allowed only when the
 * registry is missing or unreadable. A row is restored only with a valid unique
 * ID, a NOTE-<10 digits>-<slug>.md file name and a file present in note-list/.
 * Without `confirm` nothing is written.
 */
export function rebuildRegistry(root: string, opts: { confirm: boolean }): RebuildReport {
  const st = loadRegistry(root);
  if (st.state === 'ok') {
    throw new NotesError('REGISTRY_HEALTHY', 'Sigma/notes-registry.json is readable; --rebuild-registry only applies when it is missing or unreadable. Nothing was changed.');
  }
  const p = notesPaths(root);
  if (!fs.existsSync(p.catalogFile)) {
    throw new NotesError('NO_CATALOG', `${NOTES_CATALOG_FILE.replace(/\\/g, '/')} does not exist, so there is nothing to rebuild from.`);
  }

  const rows = parseCatalogRows(fs.readFileSync(p.catalogFile, 'utf8'));
  const accepted: NoteEntry[] = [];
  const rejected: { row: string; reason: string }[] = [];
  const seenIds = new Set<string>();
  const seenFiles = new Set<string>();
  let lastId = 0;

  for (const row of rows) {
    const label = `${row.id} | ${row.fileText} | ${row.title}`;
    const n = parseNoteIdNumber(row.id);
    if (n !== null) lastId = Math.max(lastId, n);
    if (n === null) {
      rejected.push({ row: label, reason: 'ID is not of the form N<number>' });
      continue;
    }
    const id = formatNoteId(n);
    if (seenIds.has(id.toLowerCase())) {
      rejected.push({ row: label, reason: 'duplicate ID' });
      continue;
    }
    seenIds.add(id.toLowerCase());
    const match = NOTE_FILE_PATTERN.exec(row.fileText);
    if (!match) {
      rejected.push({ row: label, reason: 'file name does not match NOTE-<10 digits>-<slug>.md' });
      continue;
    }
    if (seenFiles.has(row.fileText.toLowerCase())) {
      rejected.push({ row: label, reason: 'duplicate file name' });
      continue;
    }
    const abs = path.join(p.registeredDir, row.fileText);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      rejected.push({ row: label, reason: 'file is not present in Sigma/notes/note-list/' });
      continue;
    }
    const createdAt = createdAtFromStamp(match[1]);
    if (!createdAt) {
      rejected.push({ row: label, reason: 'the timestamp in the file name is not a valid date' });
      continue;
    }
    if (!row.title) {
      rejected.push({ row: label, reason: 'empty title' });
      continue;
    }
    seenFiles.add(row.fileText.toLowerCase());
    accepted.push({
      id,
      file: row.fileText,
      title: row.title,
      path: toPosix(path.relative(p.sigmaDir, abs)),
      created_at: createdAt,
      recovered: true,
    });
  }

  const report: RebuildReport = { confirmed: opts.confirm, accepted, rejected, lastId, corruptBackup: null };
  if (!opts.confirm) return report;

  if (st.state === 'unreadable') {
    const backup = `${p.registryFile}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.renameSync(p.registryFile, backup);
    report.corruptBackup = toPosix(path.relative(root, backup));
  }
  const registry: NotesRegistry = { notes_format: NOTES_FORMAT, last_id: lastId, notes: accepted };
  writeRegistry(root, registry);
  ensureNotesDirs(root);
  syncCatalog(root, registry);
  return report;
}
