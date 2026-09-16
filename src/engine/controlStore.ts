// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §10, §11, Stage C/D — idempotency
// ticket store, operation ticket + approval record store (§10), a
// cross-process project lock, and append-only control audit log for
// sigma-control.
//
// Location decision (Director, 2026-09-15, answering plan §21.1 Q6 which had
// only frozen *that* this store is excluded from state_revision, not
// *where* it lives): project-scoped, under Sigma/.mcp-control/ — same
// atomic tmp+rename discipline as writeChain()/writeActivateStatus()
// (src/engine/chain.ts), consistent with "one binding, one project" rather
// than inventing a second, host-scoped state directory. Stage D's ticket and
// approval stores inherit the same location and discipline rather than
// opening a second question already settled for Stage C.
//
// contract.ts's computeStateRevision() does not read this directory. That is
// the property this store depends on: a commit must not invalidate the very
// ticket that authorised it.
//
// Codex combined review of Stage C/D (2026-09-16) found this module's first
// version trusted caller-supplied ticket/approval ids as filename components
// with no format check — `readTicket(root, "../../../outside")` read a file
// outside the project entirely, reproduced independently before this fix.
// assertValidId() below closes that: every id this module ever writes comes
// from generateId() (a fixed prefix + crypto.randomUUID()), so any id that
// does not match that exact shape cannot be a real record and is rejected
// before it ever reaches the filesystem — the same "derive the path, never
// trust the caller's spelling of it" posture Batch 1's artifactPath.ts uses
// for governance artifacts (R-01/R-10).

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import lockfile from 'proper-lockfile';
import { PROJECT_SIGMA_DIR } from '../config';

const CONTROL_DIR = path.join(PROJECT_SIGMA_DIR, '.mcp-control');
const IDEMPOTENCY_DIR = path.join(CONTROL_DIR, 'idempotency');
const TICKET_DIR = path.join(CONTROL_DIR, 'tickets');
const APPROVAL_DIR = path.join(CONTROL_DIR, 'approvals');
const JOURNAL_DIR = path.join(CONTROL_DIR, 'journal');
const AUDIT_ENTRY_DIR = path.join(CONTROL_DIR, 'audit-entries');
export const AUDIT_FILE_REL = path.join(CONTROL_DIR, 'audit.jsonl');
const LOCK_TARGET_REL = path.join(CONTROL_DIR, 'project-write');
const LOCK_DIR_REL = `${LOCK_TARGET_REL}.lock`;

// proper-lockfile is a filesystem lease (atomic mkdir + mtime heartbeat),
// not a kernel-held mutex. Successful control mutations are synchronously
// bounded far below one heartbeat so the event loop cannot starve renewal
// long enough for a live holder to become stale during a valid commit.
export const CONTROL_LOCK_STALE_MS = 5_000;
export const CONTROL_LOCK_UPDATE_MS = 1_000;
export const CONTROL_MUTATION_MAX_MS = 250;

// Pilot defaults (plan §10.2 leaves retention/expiry as a design decision
// outside Batch 1/Stage C scope; Stage D needs *some* value to be safe by
// default, chosen here rather than left unbounded). Not yet configurable —
// Stage E territory if a real need to tune it shows up.
export const TICKET_TTL_MS = 30 * 60 * 1000; // 30 minutes to get an approval recorded
export const APPROVAL_TTL_MS = 30 * 60 * 1000; // 30 minutes to consume the approval in a commit

// ── ID validation ────────────────────────────────────────────────────────
//
// Every real id is `<prefix>_<uuid-v4>`, exactly what generateId() produces.
// The pattern is deliberately narrow (lowercase hex + hyphens only after the
// prefix) so no path separator, dot, or drive letter can ever appear in a
// value this module accepts — there is no traversal-capable character left
// to sanitize around, rather than a blocklist trying to catch all of them.

const ID_RE = /^[a-z]+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidStoreId(id: string): boolean {
  return typeof id === 'string' && ID_RE.test(id);
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  fs.ensureDirSync(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeJsonSync(tmpPath, value, { spaces: 2 });
  fs.moveSync(tmpPath, filePath, { overwrite: true });
}

/** Test-only crash injection used by out-of-process recovery tests. */
export function controlTestFailpoint(name: string): void {
  if (process.env.SIGMA_CONTROL_TEST_FAILPOINT !== name) return;
  process.kill(process.pid, 'SIGKILL');
  // Some platforms type process.kill() as returning even for self-SIGKILL.
  // This fallback must not let the mutation continue if termination is delayed.
  process.exit(86);
}

// ── Idempotency record ───────────────────────────────────────────────────
//
// A pending record is paired with a durable transaction journal. Recovery
// rolls pre-commit attempts back or commit-pending attempts forward before
// the next writer checks idempotency. Orphan pending records fail closed.
export type IdempotencyStatus = 'pending' | 'completed' | 'failed';

export interface IdempotencyRecord {
  project_id: string;
  operation_id: string;
  bound_role: string;
  idempotency_key: string;
  arguments_hash: string;
  status: IdempotencyStatus;
  /** PID of the process that wrote this record — used the same way the
   *  project lock uses one (see acquireProjectLock): a "pending" record's
   *  age alone is not proof its writer is dead. */
  pid: number;
  result: unknown;
  /** Set only when status is "failed" — mutate()'s error message. Codex
   *  review round 2: deleting the pending reservation on a synchronous
   *  mutate() throw erased the only evidence that an attempt happened at
   *  all. A "failed" record replaces "pending" instead of vanishing — a
   *  retry with the same key is still free to proceed (this status is not
   *  a block, only a history), but the attempt is no longer invisible. */
  error: string | null;
  created_at: string;
  committed_at: string | null;
}

/**
 * Runtime shape check, not just "did JSON.parse succeed" — Codex review
 * finding (second round): a syntactically valid JSON file with
 * `status:"bogus"` or a garbage `created_at` passed the first fix's
 * try/catch untouched, because JSON.parse doesn't know this file is
 * supposed to be an IdempotencyRecord. Every field this module's own logic
 * actually branches on (status, created_at, pid, arguments_hash) is checked
 * here; a record failing this is exactly as untrustworthy as one that
 * failed to parse at all, and is treated identically (see
 * readIdempotencyRecord below — both throw, neither is treated as absent).
 */
function isWellFormedIdempotencyRecord(value: unknown): value is IdempotencyRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.project_id === 'string' &&
    typeof r.operation_id === 'string' &&
    typeof r.bound_role === 'string' &&
    typeof r.idempotency_key === 'string' &&
    typeof r.arguments_hash === 'string' &&
    (r.status === 'pending' || r.status === 'completed' || r.status === 'failed') &&
    typeof r.pid === 'number' &&
    typeof r.created_at === 'string' &&
    !Number.isNaN(new Date(r.created_at as string).getTime()) &&
    (r.committed_at === null || typeof r.committed_at === 'string') &&
    (r.error === undefined || r.error === null || typeof r.error === 'string')
  );
}

function recordKey(operationId: string, boundRole: string, idempotencyKey: string): string {
  return crypto
    .createHash('sha256')
    .update(`${operationId} ${boundRole} ${idempotencyKey}`)
    .digest('hex');
}

function recordPath(root: string, operationId: string, boundRole: string, idempotencyKey: string): string {
  return path.join(root, IDEMPOTENCY_DIR, `${recordKey(operationId, boundRole, idempotencyKey)}.json`);
}

/**
 * "Absent" (no file at this path) and "present but unreadable" are NOT the
 * same thing and must not be collapsed into the same null return — Codex
 * review finding C-R03. A missing file safely means "no attempt yet, proceed
 * to mutate". A present-but-corrupt file means something *was* recorded and
 * cannot be trusted to say what — treating that as "absent" is fail-open: a
 * retry would blindly re-run a mutation whose original outcome is unknown,
 * exactly the exactly-once guarantee this store exists to provide. So only
 * true absence returns null here; a read/parse failure on a file that does
 * exist throws, and the caller (src/mcp/control/shared.ts) surfaces that as
 * a typed failure rather than silently proceeding.
 */
/**
 * Codex review round 3 finding: shape validation alone let through a
 * record whose *content* belonged to a different project/operation/role/key
 * than the one it was looked up under (reproduced independently: a
 * `completed` record for project "FOREIGN"/operation "other_operation" was
 * accepted and replayed at the path THIS project/operation/role/key
 * resolves to). The path being correct was never proof the content was —
 * this checks both now, plus that each status carries internally
 * consistent fields (a `completed` record must have a `committed_at` and no
 * `error`; a `failed` one must have both `committed_at` and a non-empty
 * `error`; a `pending` one must have neither).
 */
function matchesLookupScope(
  r: IdempotencyRecord,
  projectId: string,
  operationId: string,
  boundRole: string,
  idempotencyKey: string
): boolean {
  return (
    r.project_id === projectId &&
    r.operation_id === operationId &&
    r.bound_role === boundRole &&
    r.idempotency_key === idempotencyKey
  );
}

function hasConsistentStatusInvariants(r: IdempotencyRecord): boolean {
  const committedAtValid = r.committed_at !== null && !Number.isNaN(new Date(r.committed_at).getTime());
  if (r.status === 'pending') {
    return r.committed_at === null && r.error === null;
  }
  if (r.status === 'completed') {
    return committedAtValid && r.error === null;
  }
  // 'failed'
  return committedAtValid && typeof r.error === 'string' && r.error.length > 0;
}

export function readIdempotencyRecord(
  root: string,
  projectId: string,
  operationId: string,
  boundRole: string,
  idempotencyKey: string
): IdempotencyRecord | null {
  const filePath = recordPath(root, operationId, boundRole, idempotencyKey);
  if (!fs.existsSync(filePath)) return null;
  let parsed: unknown;
  try {
    parsed = fs.readJsonSync(filePath);
  } catch (err) {
    throw new Error(
      `Idempotency record at ${filePath} exists but could not be read: ${(err as Error).message}. ` +
      'Refusing to treat it as absent — its outcome is unknown, not empty.'
    );
  }
  if (!isWellFormedIdempotencyRecord(parsed)) {
    throw new Error(
      `Idempotency record at ${filePath} is valid JSON but not a well-formed IdempotencyRecord ` +
      '(unexpected status/timestamp/field shape). Refusing to trust it — its outcome is unknown, not empty.'
    );
  }
  if (!matchesLookupScope(parsed, projectId, operationId, boundRole, idempotencyKey)) {
    throw new Error(
      `Idempotency record at ${filePath} does not match the scope it was looked up under ` +
      '(project_id/operation_id/bound_role/idempotency_key). Refusing to trust it.'
    );
  }
  if (!hasConsistentStatusInvariants(parsed)) {
    throw new Error(
      `Idempotency record at ${filePath} has an internally inconsistent status/committed_at/error combination. ` +
      'Refusing to trust it.'
    );
  }
  return parsed;
}

export function writeIdempotencyRecord(root: string, record: IdempotencyRecord): void {
  const filePath = recordPath(root, record.operation_id, record.bound_role, record.idempotency_key);
  writeJsonAtomic(filePath, record);
}

/**
 * Removes a "pending" reservation after mutate() itself threw synchronously
 * — a normal business-rule rejection (bad input, doc not eligible, etc.),
 * not a crash. Without this, a caller who fixes the underlying problem and
 * retries with the SAME idempotency_key would find their own failed
 * attempt's leftover reservation blocking them. A genuine crash (the
 * process dies before this runs at all) leaves the "pending" record in
 * place — src/mcp/control/shared.ts's respondControlWrite() is what
 * recovers from that case, unconditionally (see its comment on why no
 * staleness timer is needed: this function's own lock already proves the
 * previous writer is gone by the time anyone else can observe "pending").
 */
export function deleteIdempotencyRecord(root: string, operationId: string, boundRole: string, idempotencyKey: string): void {
  const filePath = recordPath(root, operationId, boundRole, idempotencyKey);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Already gone — fine, that's the desired end state either way.
  }
}


export interface AuditEntry {
  timestamp: string;
  correlation_id: string;
  project_id: string | null;
  binding_fingerprint: string | null;
  bound_role: string | null;
  channel: string;
  operation_id: string;
  operation_ticket_id: string | null;
  approval_id: string | null;
  idempotency_key_hash: string;
  state_revision_before: string | null;
  state_revision_after: string | null;
  artifact_hash_before: string | null;
  artifact_hash_after: string | null;
  outcome: string;
  error_code?: string;
}

/**
 * Append-only, one JSON object per line — §17. Never carries credential,
 * raw approval secret, prompt text, or artifact body; callers pass only the
 * typed fields above. Throws on failure — callers decide how to react (see
 * src/mcp/control/shared.ts: a failed audit write is now surfaced to
 * stderr, not swallowed, per Codex review R-D-03).
 */
export function appendAuditEntry(root: string, entry: AuditEntry): void {
  const auditFile = path.join(root, AUDIT_FILE_REL);
  const entryDir = path.join(root, AUDIT_ENTRY_DIR);
  fs.ensureDirSync(entryDir);
  const migrationMarker = path.join(entryDir, '.legacy-imported');

  // Import pre-journal JSONL history once into the durable per-entry store.
  // The JSONL file remains the public projection, while immutable entry
  // files make append idempotent and recoverable after process death.
  if (!fs.existsSync(migrationMarker) && fs.existsSync(auditFile)) {
    const lines = fs.readFileSync(auditFile, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const legacy = JSON.parse(line) as AuditEntry;
      if (!legacy || typeof legacy.correlation_id !== 'string') {
        throw new Error(`Malformed audit entry in ${auditFile}; refusing to rebuild over unknown history.`);
      }
      const legacyName = crypto.createHash('sha256').update(legacy.correlation_id).digest('hex') + '.json';
      const legacyPath = path.join(entryDir, legacyName);
      if (!fs.existsSync(legacyPath)) writeJsonAtomic(legacyPath, legacy);
    }
  }
  if (!fs.existsSync(migrationMarker)) {
    const markerTmp = `${migrationMarker}.tmp-${process.pid}-${crypto.randomUUID()}`;
    fs.writeFileSync(markerTmp, '1\n', 'utf8');
    fs.moveSync(markerTmp, migrationMarker, { overwrite: true });
  }

  const entryName = crypto.createHash('sha256').update(entry.correlation_id).digest('hex') + '.json';
  const entryPath = path.join(entryDir, entryName);
  if (fs.existsSync(entryPath)) {
    const existing = fs.readJsonSync(entryPath) as AuditEntry;
    if (JSON.stringify(existing) !== JSON.stringify(entry)) {
      throw new Error(`Audit correlation ${entry.correlation_id} already exists with different content.`);
    }
  } else {
    writeJsonAtomic(entryPath, entry);
  }

  const entries = fs.readdirSync(entryDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => fs.readJsonSync(path.join(entryDir, name)) as AuditEntry)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.correlation_id.localeCompare(b.correlation_id));
  const projection = entries.map((item) => JSON.stringify(item)).join('\n') + (entries.length ? '\n' : '');
  const projectionTmp = `${auditFile}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(projectionTmp, projection, 'utf8');
  fs.moveSync(projectionTmp, auditFile, { overwrite: true });
}

// ── Durable control transaction journal ─────────────────────────────────

export interface ControlFileSnapshot {
  path: string;
  existed: boolean;
  content_base64: string | null;
}

export type ControlTransactionStatus =
  | 'prepared'
  | 'rollback_pending'
  | 'commit_pending'
  | 'rolled_back'
  | 'completed';

export interface ControlTransactionJournal {
  schema_version: 1;
  transaction_id: string;
  project_id: string;
  operation_id: string;
  bound_role: string;
  idempotency_key: string;
  arguments_hash: string;
  status: ControlTransactionStatus;
  pid: number;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
  revision_before: string;
  revision_after: string | null;
  files: ControlFileSnapshot[];
  result: unknown;
  error: string | null;
  audit_entry: AuditEntry;
}

function transactionPath(root: string, transactionId: string): string {
  return path.join(root, JOURNAL_DIR, `${transactionId}.json`);
}

function transactionRelativePath(root: string, absolutePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(absolutePath);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Control transaction path escapes or equals the project root: ${absolutePath}`);
  }
  return relative;
}

function snapshotFiles(root: string, absolutePaths: string[]): ControlFileSnapshot[] {
  const unique = new Map<string, string>();
  for (const absolutePath of absolutePaths) {
    const relative = transactionRelativePath(root, absolutePath);
    unique.set(relative.toLowerCase(), relative);
  }
  return [...unique.values()].sort().map((relative) => {
    const absolute = path.join(root, relative);
    const existed = fs.existsSync(absolute);
    if (existed && !fs.statSync(absolute).isFile()) {
      throw new Error(`Control transaction target is not a regular file: ${absolute}`);
    }
    return {
      path: relative,
      existed,
      content_base64: existed ? fs.readFileSync(absolute).toString('base64') : null,
    };
  });
}

function restoreSnapshots(root: string, snapshots: ControlFileSnapshot[]): void {
  for (const snapshot of snapshots) {
    const absolute = path.join(root, transactionRelativePath(root, path.join(root, snapshot.path)));
    if (!snapshot.existed) {
      try {
        fs.unlinkSync(absolute);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
      continue;
    }
    if (snapshot.content_base64 === null) throw new Error(`Missing before-image for ${snapshot.path}.`);
    fs.ensureDirSync(path.dirname(absolute));
    const tmpPath = `${absolute}.rollback-${process.pid}-${crypto.randomUUID()}`;
    fs.writeFileSync(tmpPath, Buffer.from(snapshot.content_base64, 'base64'));
    fs.moveSync(tmpPath, absolute, { overwrite: true });
  }
}

function writeControlTransaction(root: string, journal: ControlTransactionJournal): void {
  journal.updated_at = new Date().toISOString();
  writeJsonAtomic(transactionPath(root, journal.transaction_id), journal);
}

export function beginControlTransaction(args: {
  root: string;
  projectId: string;
  operationId: string;
  boundRole: string;
  idempotencyKey: string;
  argumentsHash: string;
  revisionBefore: string;
  files: string[];
  auditEntry: AuditEntry;
}): ControlTransactionJournal {
  const now = new Date().toISOString();
  const journal: ControlTransactionJournal = {
    schema_version: 1,
    transaction_id: crypto.randomUUID(),
    project_id: args.projectId,
    operation_id: args.operationId,
    bound_role: args.boundRole,
    idempotency_key: args.idempotencyKey,
    arguments_hash: args.argumentsHash,
    status: 'prepared',
    pid: process.pid,
    created_at: now,
    updated_at: now,
    terminal_at: null,
    revision_before: args.revisionBefore,
    revision_after: null,
    files: snapshotFiles(args.root, args.files),
    result: null,
    error: null,
    audit_entry: args.auditEntry,
  };
  writeControlTransaction(args.root, journal);
  return journal;
}

export function markControlTransactionCommitPending(
  root: string,
  journal: ControlTransactionJournal,
  result: unknown,
  revisionAfter: string,
  auditEntry: AuditEntry
): void {
  journal.status = 'commit_pending';
  journal.terminal_at = journal.terminal_at ?? new Date().toISOString();
  journal.result = result;
  journal.revision_after = revisionAfter;
  journal.audit_entry = auditEntry;
  writeControlTransaction(root, journal);
}

export function markControlTransactionRollbackPending(
  root: string,
  journal: ControlTransactionJournal,
  error: string,
  auditEntry: AuditEntry
): void {
  journal.status = 'rollback_pending';
  journal.terminal_at = journal.terminal_at ?? new Date().toISOString();
  journal.error = error;
  journal.audit_entry = auditEntry;
  writeControlTransaction(root, journal);
}

function terminalIdempotencyRecord(
  journal: ControlTransactionJournal,
  status: 'completed' | 'failed'
): IdempotencyRecord {
  return {
    project_id: journal.project_id,
    operation_id: journal.operation_id,
    bound_role: journal.bound_role,
    idempotency_key: journal.idempotency_key,
    arguments_hash: journal.arguments_hash,
    status,
    pid: journal.pid,
    result: status === 'completed' ? journal.result : null,
    error: status === 'failed' ? (journal.error ?? 'Interrupted operation rolled back during recovery.') : null,
    created_at: journal.created_at,
    committed_at: journal.terminal_at ?? journal.updated_at,
  };
}

export function finalizeControlTransaction(root: string, journal: ControlTransactionJournal): void {
  if (journal.status === 'rollback_pending') {
    restoreSnapshots(root, journal.files);
    controlTestFailpoint('after_rollback_restore');
    writeIdempotencyRecord(root, terminalIdempotencyRecord(journal, 'failed'));
    controlTestFailpoint('after_rollback_idempotency');
    appendAuditEntry(root, journal.audit_entry);
    controlTestFailpoint('after_rollback_audit');
    journal.status = 'rolled_back';
    writeControlTransaction(root, journal);
    return;
  }
  if (journal.status === 'commit_pending') {
    writeIdempotencyRecord(root, terminalIdempotencyRecord(journal, 'completed'));
    controlTestFailpoint('after_commit_idempotency');
    appendAuditEntry(root, journal.audit_entry);
    controlTestFailpoint('after_commit_audit');
    journal.status = 'completed';
    writeControlTransaction(root, journal);
    return;
  }
  throw new Error(`Cannot finalize control transaction ${journal.transaction_id} from status ${journal.status}.`);
}

export function recoverControlTransactions(root: string): void {
  const dir = path.join(root, JOURNAL_DIR);
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((name) => /^[0-9a-f-]+\.json$/.test(name)).sort();
  for (const name of files) {
    const journal = fs.readJsonSync(path.join(dir, name)) as ControlTransactionJournal;
    if (!journal || journal.schema_version !== 1 || typeof journal.transaction_id !== 'string') {
      throw new Error(`Malformed control transaction journal: ${path.join(dir, name)}.`);
    }
    if (journal.status === 'prepared') {
      const now = new Date().toISOString();
      journal.status = 'rollback_pending';
      journal.terminal_at = journal.terminal_at ?? now;
      journal.error = 'Interrupted before commit marker; before-images restored by recovery.';
      journal.audit_entry = {
        ...journal.audit_entry,
        timestamp: now,
        state_revision_after: journal.revision_before,
        artifact_hash_after: journal.audit_entry.artifact_hash_before,
        outcome: 'recovered_rollback',
        error_code: 'INTERNAL_ERROR',
      };
      writeControlTransaction(root, journal);
    }
    if (journal.status === 'rollback_pending' || journal.status === 'commit_pending') {
      finalizeControlTransaction(root, journal);
    } else if (journal.status === 'completed' || journal.status === 'rolled_back') {
      // Rebuild/repair the projection idempotently from its durable entry.
      appendAuditEntry(root, journal.audit_entry);
    }
  }
}

// ── Operation ticket (§10.1) ─────────────────────────────────────────────
//
// Produced by a `prepare` tool, consumed by exactly one `commit`. Freezes
// the operation's identity and starting conditions; grants no authority by
// itself (plan §10.1: "Ticket tidak memberikan authority").

export interface OperationTicket {
  operation_ticket_id: string;
  operation_id: string;
  project_id: string;
  bound_role: string;
  arguments_hash: string;
  target: { artifact: string; version: string; sha256: string } | null;
  expected_state_revision: string;
  /** Human-readable effect summary shown by `sigma control show`, e.g.
   *  "intent.state: DRAFT -> RATIFIED" — plan §10.1's `effects[]`. */
  effects: string[];
  authority: 'director';
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export function ticketPath(root: string, ticketId: string): string {
  return path.join(root, TICKET_DIR, `${ticketId}.json`);
}

export function writeTicket(root: string, ticket: OperationTicket): void {
  if (!isValidStoreId(ticket.operation_ticket_id)) {
    throw new Error(`Internal error: refusing to write a malformed ticket id "${ticket.operation_ticket_id}".`);
  }
  const filePath = ticketPath(root, ticket.operation_ticket_id);
  writeJsonAtomic(filePath, ticket);
}

/**
 * A caller-supplied id that does not match generateId()'s exact shape can
 * never be a real ticket — treated as not-found rather than reaching the
 * filesystem at all. This is the fix for the path-traversal finding: no
 * ticket/approval id this module accepts can contain `.`, `/`, `\`, or a
 * drive letter, so there is no traversal-capable input left once this check
 * passes.
 */
export function readTicket(root: string, ticketId: string): OperationTicket | null {
  if (!isValidStoreId(ticketId)) return null;
  const filePath = ticketPath(root, ticketId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readJsonSync(filePath) as OperationTicket;
  } catch {
    return null;
  }
}

export function markTicketConsumed(root: string, ticketId: string, consumedAt: string): void {
  const ticket = readTicket(root, ticketId);
  if (!ticket) return; // caller already validated presence before reaching here
  ticket.consumed_at = consumedAt;
  writeTicket(root, ticket);
}

// ── Approval record (§10.2) ──────────────────────────────────────────────
//
// Recorded only via the trusted local Director CLI (`sigma control
// approve`/`sigma control reject` — src/commands/control.ts), never from an
// MCP tool call. No MCP tool in this codebase writes an approval file; the
// commit tool only ever reads one.

export interface ApprovalRecord {
  approval_id: string;
  project_id: string;
  operation_ticket_id: string;
  operation_id: string;
  arguments_hash: string;
  target_artifact: string | null;
  target_version: string | null;
  target_sha256: string | null;
  expected_state_revision: string;
  decision: 'approve' | 'reject';
  reason: string | null;
  director_identity: string;
  authentication_method: string;
  channel: string;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export function approvalPath(root: string, approvalId: string): string {
  return path.join(root, APPROVAL_DIR, `${approvalId}.json`);
}

export function writeApproval(root: string, approval: ApprovalRecord): void {
  if (!isValidStoreId(approval.approval_id)) {
    throw new Error(`Internal error: refusing to write a malformed approval id "${approval.approval_id}".`);
  }
  const filePath = approvalPath(root, approval.approval_id);
  writeJsonAtomic(filePath, approval);
}

export function readApproval(root: string, approvalId: string): ApprovalRecord | null {
  if (!isValidStoreId(approvalId)) return null;
  const filePath = approvalPath(root, approvalId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readJsonSync(filePath) as ApprovalRecord;
  } catch {
    return null;
  }
}

export function markApprovalConsumed(root: string, approvalId: string, consumedAt: string): void {
  const approval = readApproval(root, approvalId);
  if (!approval) return;
  approval.consumed_at = consumedAt;
  writeApproval(root, approval);
}

// ── Cross-process project lock ───────────────────────────────────────────
//
// CURRENT: proper-lockfile admits contenders through one atomic mkdir on a
// fixed path. This is a filesystem lease with heartbeat and stale recovery,
// not a kernel-held mutex. Identity checks detect replacement before commit.
interface ProperLockIdentity {
  dev: number;
  ino: number;
  birthtimeMs: number;
}

export interface ProjectLockHandle {
  assertOwned: () => void;
  release: () => Promise<void>;
}

function properLockIdentity(lockDir: string): ProperLockIdentity {
  const stat = fs.statSync(lockDir);
  return { dev: stat.dev, ino: stat.ino, birthtimeMs: stat.birthtimeMs };
}

function sameProperLockIdentity(a: ProperLockIdentity, b: ProperLockIdentity): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
}

export async function acquireProjectLock(root: string): Promise<ProjectLockHandle> {
  const lockTarget = path.join(root, LOCK_TARGET_REL);
  const lockDir = path.join(root, LOCK_DIR_REL);
  const legacyLockDir = path.join(root, CONTROL_DIR, 'lock');
  fs.ensureDirSync(path.dirname(lockTarget));

  if (fs.existsSync(legacyLockDir)) {
    throw new Error(
      `Legacy sigma-control lock path found at ${legacyLockDir}. Stop every older sigma-control process, ` +
      'then remove that legacy lock path before starting this version.'
    );
  }

  let compromisedError: Error | null = null;
  const releaseLease = await lockfile.lock(lockTarget, {
    realpath: false,
    lockfilePath: lockDir,
    stale: CONTROL_LOCK_STALE_MS,
    update: CONTROL_LOCK_UPDATE_MS,
    retries: {
      retries: 100,
      factor: 1,
      minTimeout: 100,
      maxTimeout: 100,
      randomize: false,
    },
    onCompromised: (err) => {
      compromisedError = new Error(`Sigma control project lock was compromised: ${err.message}`);
      (compromisedError as NodeJS.ErrnoException).code = 'ECOMPROMISED';
      throw compromisedError;
    },
  });

  const acquiredIdentity = properLockIdentity(lockDir);
  let released = false;

  const assertOwned = (): void => {
    if (released) throw new Error('Sigma control project lock is already released.');
    if (compromisedError) throw compromisedError;

    let currentIdentity: ProperLockIdentity;
    try {
      currentIdentity = properLockIdentity(lockDir);
    } catch (err) {
      throw new Error(`Sigma control project lock disappeared while held: ${(err as Error).message}`);
    }
    if (!sameProperLockIdentity(acquiredIdentity, currentIdentity)) {
      throw new Error('Sigma control project lock ownership changed while held.');
    }
    if (!lockfile.checkSync(lockTarget, {
      realpath: false,
      lockfilePath: lockDir,
      stale: CONTROL_LOCK_STALE_MS,
    })) {
      throw new Error('Sigma control project lock is no longer valid.');
    }
  };

  return {
    assertOwned,
    release: async () => {
      if (released) return;
      assertOwned();
      released = true;
      await releaseLease();
    },
  };
}
