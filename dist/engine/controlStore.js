"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPROVAL_TTL_MS = exports.TICKET_TTL_MS = exports.CONTROL_MUTATION_MAX_MS = exports.CONTROL_LOCK_UPDATE_MS = exports.CONTROL_LOCK_STALE_MS = exports.AUDIT_FILE_REL = void 0;
exports.isValidStoreId = isValidStoreId;
exports.generateId = generateId;
exports.controlTestFailpoint = controlTestFailpoint;
exports.readIdempotencyRecord = readIdempotencyRecord;
exports.writeIdempotencyRecord = writeIdempotencyRecord;
exports.deleteIdempotencyRecord = deleteIdempotencyRecord;
exports.appendAuditEntry = appendAuditEntry;
exports.beginControlTransaction = beginControlTransaction;
exports.markControlTransactionCommitPending = markControlTransactionCommitPending;
exports.markControlTransactionRollbackPending = markControlTransactionRollbackPending;
exports.finalizeControlTransaction = finalizeControlTransaction;
exports.recoverControlTransactions = recoverControlTransactions;
exports.ticketPath = ticketPath;
exports.writeTicket = writeTicket;
exports.readTicket = readTicket;
exports.markTicketConsumed = markTicketConsumed;
exports.approvalPath = approvalPath;
exports.writeApproval = writeApproval;
exports.readApproval = readApproval;
exports.markApprovalConsumed = markApprovalConsumed;
exports.acquireProjectLock = acquireProjectLock;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const proper_lockfile_1 = __importDefault(require("proper-lockfile"));
const config_1 = require("../config");
const CONTROL_DIR = path_1.default.join(config_1.PROJECT_SIGMA_DIR, '.mcp-control');
const IDEMPOTENCY_DIR = path_1.default.join(CONTROL_DIR, 'idempotency');
const TICKET_DIR = path_1.default.join(CONTROL_DIR, 'tickets');
const APPROVAL_DIR = path_1.default.join(CONTROL_DIR, 'approvals');
const JOURNAL_DIR = path_1.default.join(CONTROL_DIR, 'journal');
const AUDIT_ENTRY_DIR = path_1.default.join(CONTROL_DIR, 'audit-entries');
exports.AUDIT_FILE_REL = path_1.default.join(CONTROL_DIR, 'audit.jsonl');
const LOCK_TARGET_REL = path_1.default.join(CONTROL_DIR, 'project-write');
const LOCK_DIR_REL = `${LOCK_TARGET_REL}.lock`;
// proper-lockfile is a filesystem lease (atomic mkdir + mtime heartbeat),
// not a kernel-held mutex. Successful control mutations are synchronously
// bounded far below one heartbeat so the event loop cannot starve renewal
// long enough for a live holder to become stale during a valid commit.
exports.CONTROL_LOCK_STALE_MS = 5000;
exports.CONTROL_LOCK_UPDATE_MS = 1000;
exports.CONTROL_MUTATION_MAX_MS = 250;
// Pilot defaults (plan §10.2 leaves retention/expiry as a design decision
// outside Batch 1/Stage C scope; Stage D needs *some* value to be safe by
// default, chosen here rather than left unbounded). Not yet configurable —
// Stage E territory if a real need to tune it shows up.
exports.TICKET_TTL_MS = 30 * 60 * 1000; // 30 minutes to get an approval recorded
exports.APPROVAL_TTL_MS = 30 * 60 * 1000; // 30 minutes to consume the approval in a commit
// ── ID validation ────────────────────────────────────────────────────────
//
// Every real id is `<prefix>_<uuid-v4>`, exactly what generateId() produces.
// The pattern is deliberately narrow (lowercase hex + hyphens only after the
// prefix) so no path separator, dot, or drive letter can ever appear in a
// value this module accepts — there is no traversal-capable character left
// to sanitize around, rather than a blocklist trying to catch all of them.
const ID_RE = /^[a-z]+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function isValidStoreId(id) {
    return typeof id === 'string' && ID_RE.test(id);
}
function generateId(prefix) {
    return `${prefix}_${crypto_1.default.randomUUID()}`;
}
function writeJsonAtomic(filePath, value) {
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
    const tmpPath = `${filePath}.tmp-${process.pid}-${crypto_1.default.randomUUID()}`;
    fs_extra_1.default.writeJsonSync(tmpPath, value, { spaces: 2 });
    fs_extra_1.default.moveSync(tmpPath, filePath, { overwrite: true });
}
/** Test-only crash injection used by out-of-process recovery tests. */
function controlTestFailpoint(name) {
    if (process.env.SIGMA_CONTROL_TEST_FAILPOINT !== name)
        return;
    process.kill(process.pid, 'SIGKILL');
    // Some platforms type process.kill() as returning even for self-SIGKILL.
    // This fallback must not let the mutation continue if termination is delayed.
    process.exit(86);
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
function isWellFormedIdempotencyRecord(value) {
    if (!value || typeof value !== 'object')
        return false;
    const r = value;
    return (typeof r.project_id === 'string' &&
        typeof r.operation_id === 'string' &&
        typeof r.bound_role === 'string' &&
        typeof r.idempotency_key === 'string' &&
        typeof r.arguments_hash === 'string' &&
        (r.status === 'pending' || r.status === 'completed' || r.status === 'failed') &&
        typeof r.pid === 'number' &&
        typeof r.created_at === 'string' &&
        !Number.isNaN(new Date(r.created_at).getTime()) &&
        (r.committed_at === null || typeof r.committed_at === 'string') &&
        (r.error === undefined || r.error === null || typeof r.error === 'string'));
}
function recordKey(operationId, boundRole, idempotencyKey) {
    return crypto_1.default
        .createHash('sha256')
        .update(`${operationId} ${boundRole} ${idempotencyKey}`)
        .digest('hex');
}
function recordPath(root, operationId, boundRole, idempotencyKey) {
    return path_1.default.join(root, IDEMPOTENCY_DIR, `${recordKey(operationId, boundRole, idempotencyKey)}.json`);
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
function matchesLookupScope(r, projectId, operationId, boundRole, idempotencyKey) {
    return (r.project_id === projectId &&
        r.operation_id === operationId &&
        r.bound_role === boundRole &&
        r.idempotency_key === idempotencyKey);
}
function hasConsistentStatusInvariants(r) {
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
function readIdempotencyRecord(root, projectId, operationId, boundRole, idempotencyKey) {
    const filePath = recordPath(root, operationId, boundRole, idempotencyKey);
    if (!fs_extra_1.default.existsSync(filePath))
        return null;
    let parsed;
    try {
        parsed = fs_extra_1.default.readJsonSync(filePath);
    }
    catch (err) {
        throw new Error(`Idempotency record at ${filePath} exists but could not be read: ${err.message}. ` +
            'Refusing to treat it as absent — its outcome is unknown, not empty.');
    }
    if (!isWellFormedIdempotencyRecord(parsed)) {
        throw new Error(`Idempotency record at ${filePath} is valid JSON but not a well-formed IdempotencyRecord ` +
            '(unexpected status/timestamp/field shape). Refusing to trust it — its outcome is unknown, not empty.');
    }
    if (!matchesLookupScope(parsed, projectId, operationId, boundRole, idempotencyKey)) {
        throw new Error(`Idempotency record at ${filePath} does not match the scope it was looked up under ` +
            '(project_id/operation_id/bound_role/idempotency_key). Refusing to trust it.');
    }
    if (!hasConsistentStatusInvariants(parsed)) {
        throw new Error(`Idempotency record at ${filePath} has an internally inconsistent status/committed_at/error combination. ` +
            'Refusing to trust it.');
    }
    return parsed;
}
function writeIdempotencyRecord(root, record) {
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
function deleteIdempotencyRecord(root, operationId, boundRole, idempotencyKey) {
    const filePath = recordPath(root, operationId, boundRole, idempotencyKey);
    try {
        fs_extra_1.default.unlinkSync(filePath);
    }
    catch {
        // Already gone — fine, that's the desired end state either way.
    }
}
/**
 * Append-only, one JSON object per line — §17. Never carries credential,
 * raw approval secret, prompt text, or artifact body; callers pass only the
 * typed fields above. Throws on failure — callers decide how to react (see
 * src/mcp/control/shared.ts: a failed audit write is now surfaced to
 * stderr, not swallowed, per Codex review R-D-03).
 */
function appendAuditEntry(root, entry) {
    const auditFile = path_1.default.join(root, exports.AUDIT_FILE_REL);
    const entryDir = path_1.default.join(root, AUDIT_ENTRY_DIR);
    fs_extra_1.default.ensureDirSync(entryDir);
    const migrationMarker = path_1.default.join(entryDir, '.legacy-imported');
    // Import pre-journal JSONL history once into the durable per-entry store.
    // The JSONL file remains the public projection, while immutable entry
    // files make append idempotent and recoverable after process death.
    if (!fs_extra_1.default.existsSync(migrationMarker) && fs_extra_1.default.existsSync(auditFile)) {
        const lines = fs_extra_1.default.readFileSync(auditFile, 'utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
            const legacy = JSON.parse(line);
            if (!legacy || typeof legacy.correlation_id !== 'string') {
                throw new Error(`Malformed audit entry in ${auditFile}; refusing to rebuild over unknown history.`);
            }
            const legacyName = crypto_1.default.createHash('sha256').update(legacy.correlation_id).digest('hex') + '.json';
            const legacyPath = path_1.default.join(entryDir, legacyName);
            if (!fs_extra_1.default.existsSync(legacyPath))
                writeJsonAtomic(legacyPath, legacy);
        }
    }
    if (!fs_extra_1.default.existsSync(migrationMarker)) {
        const markerTmp = `${migrationMarker}.tmp-${process.pid}-${crypto_1.default.randomUUID()}`;
        fs_extra_1.default.writeFileSync(markerTmp, '1\n', 'utf8');
        fs_extra_1.default.moveSync(markerTmp, migrationMarker, { overwrite: true });
    }
    const entryName = crypto_1.default.createHash('sha256').update(entry.correlation_id).digest('hex') + '.json';
    const entryPath = path_1.default.join(entryDir, entryName);
    if (fs_extra_1.default.existsSync(entryPath)) {
        const existing = fs_extra_1.default.readJsonSync(entryPath);
        if (JSON.stringify(existing) !== JSON.stringify(entry)) {
            throw new Error(`Audit correlation ${entry.correlation_id} already exists with different content.`);
        }
    }
    else {
        writeJsonAtomic(entryPath, entry);
    }
    const entries = fs_extra_1.default.readdirSync(entryDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => fs_extra_1.default.readJsonSync(path_1.default.join(entryDir, name)))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.correlation_id.localeCompare(b.correlation_id));
    const projection = entries.map((item) => JSON.stringify(item)).join('\n') + (entries.length ? '\n' : '');
    const projectionTmp = `${auditFile}.tmp-${process.pid}-${crypto_1.default.randomUUID()}`;
    fs_extra_1.default.writeFileSync(projectionTmp, projection, 'utf8');
    fs_extra_1.default.moveSync(projectionTmp, auditFile, { overwrite: true });
}
function transactionPath(root, transactionId) {
    return path_1.default.join(root, JOURNAL_DIR, `${transactionId}.json`);
}
function transactionRelativePath(root, absolutePath) {
    const resolvedRoot = path_1.default.resolve(root);
    const resolved = path_1.default.resolve(absolutePath);
    const relative = path_1.default.relative(resolvedRoot, resolved);
    if (!relative || relative.startsWith(`..${path_1.default.sep}`) || relative === '..' || path_1.default.isAbsolute(relative)) {
        throw new Error(`Control transaction path escapes or equals the project root: ${absolutePath}`);
    }
    return relative;
}
function snapshotFiles(root, absolutePaths) {
    const unique = new Map();
    for (const absolutePath of absolutePaths) {
        const relative = transactionRelativePath(root, absolutePath);
        unique.set(relative.toLowerCase(), relative);
    }
    return [...unique.values()].sort().map((relative) => {
        const absolute = path_1.default.join(root, relative);
        const existed = fs_extra_1.default.existsSync(absolute);
        if (existed && !fs_extra_1.default.statSync(absolute).isFile()) {
            throw new Error(`Control transaction target is not a regular file: ${absolute}`);
        }
        return {
            path: relative,
            existed,
            content_base64: existed ? fs_extra_1.default.readFileSync(absolute).toString('base64') : null,
        };
    });
}
function restoreSnapshots(root, snapshots) {
    for (const snapshot of snapshots) {
        const absolute = path_1.default.join(root, transactionRelativePath(root, path_1.default.join(root, snapshot.path)));
        if (!snapshot.existed) {
            try {
                fs_extra_1.default.unlinkSync(absolute);
            }
            catch (err) {
                if (err.code !== 'ENOENT')
                    throw err;
            }
            continue;
        }
        if (snapshot.content_base64 === null)
            throw new Error(`Missing before-image for ${snapshot.path}.`);
        fs_extra_1.default.ensureDirSync(path_1.default.dirname(absolute));
        const tmpPath = `${absolute}.rollback-${process.pid}-${crypto_1.default.randomUUID()}`;
        fs_extra_1.default.writeFileSync(tmpPath, Buffer.from(snapshot.content_base64, 'base64'));
        fs_extra_1.default.moveSync(tmpPath, absolute, { overwrite: true });
    }
}
function writeControlTransaction(root, journal) {
    journal.updated_at = new Date().toISOString();
    writeJsonAtomic(transactionPath(root, journal.transaction_id), journal);
}
function beginControlTransaction(args) {
    const now = new Date().toISOString();
    const journal = {
        schema_version: 1,
        transaction_id: crypto_1.default.randomUUID(),
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
function markControlTransactionCommitPending(root, journal, result, revisionAfter, auditEntry) {
    journal.status = 'commit_pending';
    journal.terminal_at = journal.terminal_at ?? new Date().toISOString();
    journal.result = result;
    journal.revision_after = revisionAfter;
    journal.audit_entry = auditEntry;
    writeControlTransaction(root, journal);
}
function markControlTransactionRollbackPending(root, journal, error, auditEntry) {
    journal.status = 'rollback_pending';
    journal.terminal_at = journal.terminal_at ?? new Date().toISOString();
    journal.error = error;
    journal.audit_entry = auditEntry;
    writeControlTransaction(root, journal);
}
function terminalIdempotencyRecord(journal, status) {
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
function finalizeControlTransaction(root, journal) {
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
function recoverControlTransactions(root) {
    const dir = path_1.default.join(root, JOURNAL_DIR);
    if (!fs_extra_1.default.existsSync(dir))
        return;
    const files = fs_extra_1.default.readdirSync(dir).filter((name) => /^[0-9a-f-]+\.json$/.test(name)).sort();
    for (const name of files) {
        const journal = fs_extra_1.default.readJsonSync(path_1.default.join(dir, name));
        if (!journal || journal.schema_version !== 1 || typeof journal.transaction_id !== 'string') {
            throw new Error(`Malformed control transaction journal: ${path_1.default.join(dir, name)}.`);
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
        }
        else if (journal.status === 'completed' || journal.status === 'rolled_back') {
            // Rebuild/repair the projection idempotently from its durable entry.
            appendAuditEntry(root, journal.audit_entry);
        }
    }
}
function ticketPath(root, ticketId) {
    return path_1.default.join(root, TICKET_DIR, `${ticketId}.json`);
}
function writeTicket(root, ticket) {
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
function readTicket(root, ticketId) {
    if (!isValidStoreId(ticketId))
        return null;
    const filePath = ticketPath(root, ticketId);
    if (!fs_extra_1.default.existsSync(filePath))
        return null;
    try {
        return fs_extra_1.default.readJsonSync(filePath);
    }
    catch {
        return null;
    }
}
function markTicketConsumed(root, ticketId, consumedAt) {
    const ticket = readTicket(root, ticketId);
    if (!ticket)
        return; // caller already validated presence before reaching here
    ticket.consumed_at = consumedAt;
    writeTicket(root, ticket);
}
function approvalPath(root, approvalId) {
    return path_1.default.join(root, APPROVAL_DIR, `${approvalId}.json`);
}
function writeApproval(root, approval) {
    if (!isValidStoreId(approval.approval_id)) {
        throw new Error(`Internal error: refusing to write a malformed approval id "${approval.approval_id}".`);
    }
    const filePath = approvalPath(root, approval.approval_id);
    writeJsonAtomic(filePath, approval);
}
function readApproval(root, approvalId) {
    if (!isValidStoreId(approvalId))
        return null;
    const filePath = approvalPath(root, approvalId);
    if (!fs_extra_1.default.existsSync(filePath))
        return null;
    try {
        return fs_extra_1.default.readJsonSync(filePath);
    }
    catch {
        return null;
    }
}
function markApprovalConsumed(root, approvalId, consumedAt) {
    const approval = readApproval(root, approvalId);
    if (!approval)
        return;
    approval.consumed_at = consumedAt;
    writeApproval(root, approval);
}
function properLockIdentity(lockDir) {
    const stat = fs_extra_1.default.statSync(lockDir);
    return { dev: stat.dev, ino: stat.ino, birthtimeMs: stat.birthtimeMs };
}
function sameProperLockIdentity(a, b) {
    return a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
}
async function acquireProjectLock(root) {
    const lockTarget = path_1.default.join(root, LOCK_TARGET_REL);
    const lockDir = path_1.default.join(root, LOCK_DIR_REL);
    const legacyLockDir = path_1.default.join(root, CONTROL_DIR, 'lock');
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(lockTarget));
    if (fs_extra_1.default.existsSync(legacyLockDir)) {
        throw new Error(`Legacy sigma-control lock path found at ${legacyLockDir}. Stop every older sigma-control process, ` +
            'then remove that legacy lock path before starting this version.');
    }
    let compromisedError = null;
    const releaseLease = await proper_lockfile_1.default.lock(lockTarget, {
        realpath: false,
        lockfilePath: lockDir,
        stale: exports.CONTROL_LOCK_STALE_MS,
        update: exports.CONTROL_LOCK_UPDATE_MS,
        retries: {
            retries: 100,
            factor: 1,
            minTimeout: 100,
            maxTimeout: 100,
            randomize: false,
        },
        onCompromised: (err) => {
            compromisedError = new Error(`Sigma control project lock was compromised: ${err.message}`);
            compromisedError.code = 'ECOMPROMISED';
            throw compromisedError;
        },
    });
    const acquiredIdentity = properLockIdentity(lockDir);
    let released = false;
    const assertOwned = () => {
        if (released)
            throw new Error('Sigma control project lock is already released.');
        if (compromisedError)
            throw compromisedError;
        let currentIdentity;
        try {
            currentIdentity = properLockIdentity(lockDir);
        }
        catch (err) {
            throw new Error(`Sigma control project lock disappeared while held: ${err.message}`);
        }
        if (!sameProperLockIdentity(acquiredIdentity, currentIdentity)) {
            throw new Error('Sigma control project lock ownership changed while held.');
        }
        if (!proper_lockfile_1.default.checkSync(lockTarget, {
            realpath: false,
            lockfilePath: lockDir,
            stale: exports.CONTROL_LOCK_STALE_MS,
        })) {
            throw new Error('Sigma control project lock is no longer valid.');
        }
    };
    return {
        assertOwned,
        release: async () => {
            if (released)
                return;
            assertOwned();
            released = true;
            await releaseLease();
        },
    };
}
//# sourceMappingURL=controlStore.js.map