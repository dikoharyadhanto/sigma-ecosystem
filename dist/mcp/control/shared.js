"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlMutationTimingSnapshot = controlMutationTimingSnapshot;
exports.resetControlMutationTimings = resetControlMutationTimings;
exports.requireRole = requireRole;
exports.stableHash = stableHash;
exports.staleStateCheck = staleStateCheck;
exports.respondControlWrite = respondControlWrite;
// Stage C/D control write wrapper. Every write uses a project-scoped
// proper-lockfile filesystem lease, a durable before-image journal,
// idempotency reconciliation, and recoverable audit outcomes. Governance
// mutations remain synchronous and are bounded below the heartbeat interval.
const crypto_1 = __importDefault(require("crypto"));
const shared_1 = require("../shared");
const binding_1 = require("../binding");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const controlStore_1 = require("../../engine/controlStore");
const AUDIT_CHANNEL = 'mcp-control';
async function withControlLock(root, fn) {
    const lock = await (0, controlStore_1.acquireProjectLock)(root);
    try {
        lock.assertOwned();
        return fn(lock);
    }
    finally {
        await lock.release();
    }
}
const mutationTimings = new Map();
function recordMutationTiming(tool, durationMs) {
    const previous = mutationTimings.get(tool);
    mutationTimings.set(tool, {
        count: (previous?.count ?? 0) + 1,
        last_ms: durationMs,
        max_ms: Math.max(previous?.max_ms ?? 0, durationMs),
    });
}
/** Test evidence only; not registered as an MCP tool or public CLI API. */
function controlMutationTimingSnapshot() {
    return Object.fromEntries(mutationTimings.entries());
}
function resetControlMutationTimings() {
    mutationTimings.clear();
}
// ── Binding / role ───────────────────────────────────────────────────────
function requireRole(binding, allowed) {
    if (!binding.role || !allowed.includes(binding.role)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.ROLE_NOT_AUTHORIZED, `This operation requires role ${allowed.join(' or ')}.`);
    }
    return binding.role;
}
function stableHash(value) {
    return 'sha256:' + crypto_1.default.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function codeOf(err) {
    const candidate = err?.code;
    if (typeof candidate === 'string' && candidate in contract_1.ERROR_CODES)
        return candidate;
    return null;
}
/** Structural, not type-specific: several mutation results (e.g.
 *  updateArtifactDraft's) carry a `sha256` field naming the artifact's new
 *  content hash. Used only for the audit trail's artifact_hash_after. */
function sha256Of(value) {
    if (value && typeof value === 'object' && 'sha256' in value) {
        const v = value.sha256;
        return typeof v === 'string' ? v : null;
    }
    return null;
}
function isThenable(value) {
    return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
}
/**
 * The Stage C precondition shape: the caller's expected_state_revision must
 * still match the live one. Factored out so both pilot tools build the same
 * closure instead of two copies of the same three lines.
 */
function staleStateCheck(expectedStateRevision) {
    return (root) => {
        const { revision } = (0, contract_1.computeStateRevision)(root);
        if (revision !== expectedStateRevision) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_STATE, 'Project state has changed since expected_state_revision was read.');
        }
    };
}
/**
 * Runs `mutate` under role authorization, idempotency, and precondition
 * protection, and returns the same envelope shape contract.ts's query tools
 * use (ok()/fail()) so control and query responses are structurally
 * indistinguishable to a client that only cares about the envelope.
 *
 * INVARIANT `mutate` must be synchronous. Every safety argument in this
 * module (most importantly "a pending idempotency record found under the
 * lock always belongs to a dead writer", see below) depends on there being
 * no `await` point between the idempotency check and the completed write —
 * enforced at runtime just below, not only documented.
 */
async function respondControlWrite(opts, mutate) {
    const binding = (0, shared_1.getBinding)();
    const root = binding.root;
    // Control mode cannot start unbound (binding.ts) — root is null here only
    // if this function is ever reached from a query-mode server, which no
    // control tool is registered on. Defensive, not reachable in practice.
    if (!root) {
        return (0, contract_1.fail)(opts.tool, null, contract_1.ERROR_CODES.BINDING_REQUIRED, 'This tool requires a verified control-mode binding.');
    }
    const initialRevision = (0, contract_1.computeStateRevision)(root).revision;
    // The role this server is bound to, known from startup regardless of
    // whether it turns out to be authorized for this operation. A denied call
    // must still be auditable as "role X attempted Y and was refused" — using
    // a variable that only gets set on successful authorization would audit
    // every ROLE_NOT_AUTHORIZED deny as bound_role:null, which is the one case
    // an audit trail most needs to attribute correctly.
    const boundRole = binding.role;
    const makeAuditEntry = (outcome, errorCode, revisionBefore, revisionAfter, artifactHashAfter, correlationId = crypto_1.default.randomUUID()) => ({
        timestamp: new Date().toISOString(),
        correlation_id: correlationId,
        project_id: binding.projectId,
        binding_fingerprint: binding.rootFingerprint,
        bound_role: boundRole,
        channel: AUDIT_CHANNEL,
        operation_id: opts.operationId,
        operation_ticket_id: opts.operationTicketId ?? null,
        approval_id: opts.approvalId ?? null,
        idempotency_key_hash: stableHash(opts.idempotencyKey),
        state_revision_before: revisionBefore,
        state_revision_after: revisionAfter,
        artifact_hash_before: opts.artifactHashBefore ?? null,
        artifact_hash_after: artifactHashAfter,
        outcome,
        ...(errorCode ? { error_code: errorCode } : {}),
    });
    // This best-effort path is limited to denials that occur before a durable
    // transaction exists. Commit/rollback outcomes and idempotent replays use
    // durable audit entries and fail closed if they cannot be persisted.
    const auditBestEffort = (outcome, errorCode, revisionBefore, revisionAfter, artifactHashAfter) => {
        try {
            (0, controlStore_1.appendAuditEntry)(root, makeAuditEntry(outcome, errorCode, revisionBefore, revisionAfter, artifactHashAfter));
        }
        catch (auditErr) {
            // The operation's own outcome must never be masked by an audit
            // failure — but a failed audit write is a real event for a system
            // whose whole point is auditability, so it goes to stderr (never
            // stdout — reserved for JSON-RPC frames) instead of disappearing.
            //
            console.error(`sigma-control: failed to write audit entry for ${opts.operationId} (outcome=${outcome}):`, auditErr.message);
        }
    };
    try {
        (0, binding_1.assertCallRootAllowed)(binding, undefined);
        (0, binding_1.assertIdentityUnchanged)(binding);
        if (binding.mode !== 'control' || !binding.verified) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.BINDING_REQUIRED, 'This tool requires a verified control-mode binding.');
        }
        const authorizedRole = requireRole(binding, opts.allowedRoles);
        const argumentsHash = stableHash(opts.argumentsForHash);
        const { result, replayed, revisionBefore, revisionAfter } = await withControlLock(root, (lock) => {
            lock.assertOwned();
            (0, controlStore_1.recoverControlTransactions)(root);
            lock.assertOwned();
            const existing = (0, controlStore_1.readIdempotencyRecord)(root, binding.projectId ?? '', opts.operationId, authorizedRole, opts.idempotencyKey);
            if (existing) {
                if (existing.arguments_hash !== argumentsHash) {
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.IDEMPOTENCY_CONFLICT, 'idempotency_key was already used with different arguments.');
                }
                if (existing.status === 'completed') {
                    const revision = (0, contract_1.computeStateRevision)(root).revision;
                    return { result: existing.result, replayed: true, revisionBefore: revision, revisionAfter: revision };
                }
                if (existing.status === 'pending') {
                    // recoverControlTransactions() ran immediately above. A pending
                    // record backed by a journal would therefore already have become
                    // completed (roll-forward) or failed (rollback). What remains has
                    // no recoverable evidence and must not be guessed safe to rerun.
                    throw new errors_1.McpQueryError(contract_1.ERROR_CODES.IDEMPOTENCY_CONFLICT, 'A pending idempotency record has no recoverable transaction journal; refusing to guess its outcome.');
                }
                // A failed attempt has been durably rolled back, so the identical
                // request may make a new journaled attempt with the same key.
            }
            opts.checkPreconditions(root);
            const revisionBeforeLocked = (0, contract_1.computeStateRevision)(root).revision;
            if (!revisionBeforeLocked)
                throw new Error('Cannot begin a control transaction without a state revision.');
            const correlationId = crypto_1.default.randomUUID();
            const pendingAudit = makeAuditEntry('pending', null, revisionBeforeLocked, null, null, correlationId);
            let journal = (0, controlStore_1.beginControlTransaction)({
                root,
                projectId: binding.projectId ?? '',
                operationId: opts.operationId,
                boundRole: authorizedRole,
                idempotencyKey: opts.idempotencyKey,
                argumentsHash,
                revisionBefore: revisionBeforeLocked,
                files: opts.transactionFiles(root),
                auditEntry: pendingAudit,
            });
            (0, controlStore_1.controlTestFailpoint)('after_journal_prepared');
            const createdAt = new Date().toISOString();
            try {
                (0, controlStore_1.writeIdempotencyRecord)(root, {
                    project_id: binding.projectId ?? '',
                    operation_id: opts.operationId,
                    bound_role: authorizedRole,
                    idempotency_key: opts.idempotencyKey,
                    arguments_hash: argumentsHash,
                    status: 'pending',
                    pid: process.pid,
                    result: null,
                    error: null,
                    created_at: createdAt,
                    committed_at: null,
                });
                (0, controlStore_1.controlTestFailpoint)('after_idempotency_pending');
                lock.assertOwned();
                const mutationStarted = process.hrtime.bigint();
                let mutationResult;
                let mutationDurationMs = 0;
                try {
                    mutationResult = mutate(root, authorizedRole);
                }
                finally {
                    mutationDurationMs = Number(process.hrtime.bigint() - mutationStarted) / 1000000;
                    recordMutationTiming(opts.tool, mutationDurationMs);
                }
                if (isThenable(mutationResult)) {
                    throw new Error('Internal error: mutate() returned a thenable — control mutations must be synchronous.');
                }
                if (mutationDurationMs > controlStore_1.CONTROL_MUTATION_MAX_MS) {
                    throw new Error(`Control mutation exceeded its ${controlStore_1.CONTROL_MUTATION_MAX_MS}ms lease-safety budget ` +
                        `(${mutationDurationMs.toFixed(3)}ms); transaction rolled back.`);
                }
                lock.assertOwned();
                (0, controlStore_1.controlTestFailpoint)('after_mutation_before_commit_marker');
                const revisionAfterLocked = (0, contract_1.computeStateRevision)(root).revision;
                if (!revisionAfterLocked)
                    throw new Error('Control mutation produced no state revision.');
                const commitAudit = makeAuditEntry('commit', null, revisionBeforeLocked, revisionAfterLocked, sha256Of(mutationResult), correlationId);
                (0, controlStore_1.markControlTransactionCommitPending)(root, journal, mutationResult, revisionAfterLocked, commitAudit);
                (0, controlStore_1.controlTestFailpoint)('after_commit_marker');
                (0, controlStore_1.finalizeControlTransaction)(root, journal);
                return {
                    result: mutationResult,
                    replayed: false,
                    revisionBefore: revisionBeforeLocked,
                    revisionAfter: revisionAfterLocked,
                };
            }
            catch (transactionErr) {
                if (journal.status === 'prepared') {
                    const message = transactionErr.message ?? String(transactionErr);
                    const denyAudit = makeAuditEntry('deny', codeOf(transactionErr) ?? contract_1.ERROR_CODES.INTERNAL_ERROR, revisionBeforeLocked, revisionBeforeLocked, opts.artifactHashBefore ?? null, correlationId);
                    (0, controlStore_1.markControlTransactionRollbackPending)(root, journal, message, denyAudit);
                    (0, controlStore_1.finalizeControlTransaction)(root, journal);
                }
                if (transactionErr && typeof transactionErr === 'object') {
                    transactionErr.controlTransactionRecorded = true;
                }
                throw transactionErr;
            }
        });
        if (replayed) {
            (0, controlStore_1.appendAuditEntry)(root, makeAuditEntry('idempotent_replay', null, revisionBefore, revisionAfter, sha256Of(result)));
        }
        return (0, contract_1.ok)(opts.tool, root, result);
    }
    catch (err) {
        const code = codeOf(err);
        if (!(err && typeof err === 'object' && err.controlTransactionRecorded)) {
            auditBestEffort('deny', code ?? contract_1.ERROR_CODES.INTERNAL_ERROR, initialRevision, null, null);
        }
        if (code)
            return (0, contract_1.fail)(opts.tool, root, code, err.message);
        return (0, contract_1.fail)(opts.tool, root, contract_1.ERROR_CODES.INTERNAL_ERROR, 'Internal error while executing this control operation.');
    }
}
//# sourceMappingURL=shared.js.map