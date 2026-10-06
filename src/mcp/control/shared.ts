// Stage C/D control write wrapper. Every write uses a project-scoped
// proper-lockfile filesystem lease, a durable before-image journal,
// idempotency reconciliation, and recoverable audit outcomes. Governance
// mutations remain synchronous and are bounded below the heartbeat interval.
import crypto from 'crypto';
import { getBinding } from '../shared';
import { Binding, assertCallRootAllowed, assertIdentityUnchanged } from '../binding';
import { ok, fail, ERROR_CODES, ErrorCode, computeStateRevision } from '../contract';
import { McpQueryError } from '../errors';
import {
  readIdempotencyRecord,
  writeIdempotencyRecord,
  appendAuditEntry,
  acquireProjectLock,
  AuditEntry,
  ControlTransactionJournal,
  beginControlTransaction,
  markControlTransactionCommitPending,
  markControlTransactionRollbackPending,
  finalizeControlTransaction,
  recoverControlTransactions,
  controlTestFailpoint,
  CONTROL_MUTATION_MAX_MS,
  ProjectLockHandle,
} from '../../engine/controlStore';

const AUDIT_CHANNEL = 'mcp-control';

async function withControlLock<T>(root: string, fn: (lock: ProjectLockHandle) => T): Promise<T> {
  const lock = await acquireProjectLock(root);
  try {
    lock.assertOwned();
    return fn(lock);
  } finally {
    await lock.release();
  }
}

export interface ControlMutationTiming {
  count: number;
  last_ms: number;
  max_ms: number;
}

const mutationTimings = new Map<string, ControlMutationTiming>();

function recordMutationTiming(tool: string, durationMs: number): void {
  const previous = mutationTimings.get(tool);
  mutationTimings.set(tool, {
    count: (previous?.count ?? 0) + 1,
    last_ms: durationMs,
    max_ms: Math.max(previous?.max_ms ?? 0, durationMs),
  });
}

/** Test evidence only; not registered as an MCP tool or public CLI API. */
export function controlMutationTimingSnapshot(): Record<string, ControlMutationTiming> {
  return Object.fromEntries(mutationTimings.entries());
}

export function resetControlMutationTimings(): void {
  mutationTimings.clear();
}

// ── Binding / role ───────────────────────────────────────────────────────

export function requireRole(binding: Binding, allowed: string[]): string {
  if (!binding.role || !allowed.includes(binding.role)) {
    throw new McpQueryError(
      ERROR_CODES.ROLE_NOT_AUTHORIZED,
      `This operation requires role ${allowed.join(' or ')}.`
    );
  }
  return binding.role;
}

export function stableHash(value: unknown): string {
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function codeOf(err: unknown): ErrorCode | null {
  const candidate = (err as { code?: unknown })?.code;
  if (typeof candidate === 'string' && candidate in ERROR_CODES) return candidate as ErrorCode;
  return null;
}

/** Structural, not type-specific: several mutation results (e.g.
 *  updateArtifactDraft's) carry a `sha256` field naming the artifact's new
 *  content hash. Used only for the audit trail's artifact_hash_after. */
function sha256Of(value: unknown): string | null {
  if (value && typeof value === 'object' && 'sha256' in value) {
    const v = (value as { sha256?: unknown }).sha256;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

function isThenable(value: unknown): boolean {
  return !!value && (typeof value === 'object' || typeof value === 'function') && typeof (value as { then?: unknown }).then === 'function';
}

// ── Commit wrapper ───────────────────────────────────────────────────────

export interface ControlWriteOptions {
  tool: string;
  operationId: string;
  idempotencyKey: string;
  /** Business-meaningful input only — never includes idempotency_key itself. */
  argumentsForHash: unknown;
  allowedRoles: string[];
  /**
   * Runs inside the lock, after the idempotency lookup finds no cached
   * result and before `mutate`. Must throw a typed error (one of
   * ERROR_CODES) to refuse the commit. Stage C's two tools pass
   * staleStateCheck(expected_state_revision); Stage D's commit tool passes a
   * closure that validates the operation ticket and approval record instead
   * (plan §10) — one wrapper, two precondition shapes, so the
   * idempotency/lock/audit machinery below is written exactly once.
   */
  checkPreconditions: (root: string) => void;
  /** Audit correlation — Stage D's commit tool passes both; Stage C's tools
   *  pass neither (there is no ticket/approval concept for a bounded DRAFT
   *  write). */
  operationTicketId?: string;
  approvalId?: string;
  /** Audit correlation — the artifact hash the caller believed was current
   *  before this write (e.g. sigma_update_artifact_draft's
   *  expected_artifact_sha256, or sigma_commit_intent_ratify's ticket target
   *  hash). Omitted for writes with no artifact precondition of their own. */
  artifactHashBefore?: string;
  /** Exact files the mutation may change. Their before-images are persisted
   *  before mutate() starts so an interrupted multi-file write can be
   *  rolled back deterministically on the next lock acquisition. */
  transactionFiles: (root: string) => string[];
}

/**
 * The Stage C precondition shape: the caller's expected_state_revision must
 * still match the live one. Factored out so both pilot tools build the same
 * closure instead of two copies of the same three lines.
 */
export function staleStateCheck(expectedStateRevision: string): (root: string) => void {
  return (root: string) => {
    const { revision } = computeStateRevision(root);
    if (revision !== expectedStateRevision) {
      throw new McpQueryError(
        ERROR_CODES.STALE_STATE,
        'Project state has changed since expected_state_revision was read.'
      );
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
export async function respondControlWrite(
  opts: ControlWriteOptions,
  mutate: (root: string, role: string) => unknown
) {
  const binding = getBinding();
  const root = binding.root;

  // Control mode cannot start unbound (binding.ts) — root is null here only
  // if this function is ever reached from a query-mode server, which no
  // control tool is registered on. Defensive, not reachable in practice.
  if (!root) {
    return fail(opts.tool, null, ERROR_CODES.BINDING_REQUIRED, 'This tool requires a verified control-mode binding.');
  }

  const initialRevision = computeStateRevision(root).revision;
  // The role this server is bound to, known from startup regardless of
  // whether it turns out to be authorized for this operation. A denied call
  // must still be auditable as "role X attempted Y and was refused" — using
  // a variable that only gets set on successful authorization would audit
  // every ROLE_NOT_AUTHORIZED deny as bound_role:null, which is the one case
  // an audit trail most needs to attribute correctly.
  const boundRole: string | null = binding.role;

  const makeAuditEntry = (
    outcome: string,
    errorCode: ErrorCode | null,
    revisionBefore: string | null,
    revisionAfter: string | null,
    artifactHashAfter: string | null,
    correlationId = crypto.randomUUID()
  ): AuditEntry => ({
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
  const auditBestEffort = (
    outcome: string,
    errorCode: ErrorCode | null,
    revisionBefore: string | null,
    revisionAfter: string | null,
    artifactHashAfter: string | null
  ): void => {
    try {
      appendAuditEntry(root, makeAuditEntry(outcome, errorCode, revisionBefore, revisionAfter, artifactHashAfter));
    } catch (auditErr) {
      // The operation's own outcome must never be masked by an audit
      // failure — but a failed audit write is a real event for a system
      // whose whole point is auditability, so it goes to stderr (never
      // stdout — reserved for JSON-RPC frames) instead of disappearing.
      //
      console.error(
        `sigma-control: failed to write audit entry for ${opts.operationId} (outcome=${outcome}):`,
        (auditErr as Error).message
      );
    }
  };

  try {
    assertCallRootAllowed(binding, undefined);
    assertIdentityUnchanged(binding);
    if (binding.mode !== 'control' || !binding.verified) {
      throw new McpQueryError(ERROR_CODES.BINDING_REQUIRED, 'This tool requires a verified control-mode binding.');
    }
    const authorizedRole = requireRole(binding, opts.allowedRoles);
    const argumentsHash = stableHash(opts.argumentsForHash);

    const { result, replayed, revisionBefore, revisionAfter } = await withControlLock(root, (lock) => {
      lock.assertOwned();
      recoverControlTransactions(root);
      lock.assertOwned();
      const existing = readIdempotencyRecord(root, binding.projectId ?? '', opts.operationId, authorizedRole, opts.idempotencyKey);
      if (existing) {
        if (existing.arguments_hash !== argumentsHash) {
          throw new McpQueryError(
            ERROR_CODES.IDEMPOTENCY_CONFLICT,
            'idempotency_key was already used with different arguments.'
          );
        }
        if (existing.status === 'completed') {
          const revision = computeStateRevision(root).revision;
          return { result: existing.result, replayed: true, revisionBefore: revision, revisionAfter: revision };
        }
        if (existing.status === 'pending') {
          // recoverControlTransactions() ran immediately above. A pending
          // record backed by a journal would therefore already have become
          // completed (roll-forward) or failed (rollback). What remains has
          // no recoverable evidence and must not be guessed safe to rerun.
          throw new McpQueryError(
            ERROR_CODES.IDEMPOTENCY_CONFLICT,
            'A pending idempotency record has no recoverable transaction journal; refusing to guess its outcome.'
          );
        }
        // A failed attempt has been durably rolled back, so the identical
        // request may make a new journaled attempt with the same key.
      }

      opts.checkPreconditions(root);
      const revisionBeforeLocked = computeStateRevision(root).revision;
      if (!revisionBeforeLocked) throw new Error('Cannot begin a control transaction without a state revision.');
      const correlationId = crypto.randomUUID();
      const pendingAudit = makeAuditEntry('pending', null, revisionBeforeLocked, null, null, correlationId);
      let journal: ControlTransactionJournal = beginControlTransaction({
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
      controlTestFailpoint('after_journal_prepared');

      const createdAt = new Date().toISOString();
      try {
        writeIdempotencyRecord(root, {
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
        controlTestFailpoint('after_idempotency_pending');

        lock.assertOwned();
        const mutationStarted = process.hrtime.bigint();
        let mutationResult: unknown;
        let mutationDurationMs = 0;
        try {
          mutationResult = mutate(root, authorizedRole);
        } finally {
          mutationDurationMs = Number(process.hrtime.bigint() - mutationStarted) / 1_000_000;
          recordMutationTiming(opts.tool, mutationDurationMs);
        }
        if (isThenable(mutationResult)) {
          throw new Error('Internal error: mutate() returned a thenable — control mutations must be synchronous.');
        }
        if (mutationDurationMs > CONTROL_MUTATION_MAX_MS) {
          throw new Error(
            `Control mutation exceeded its ${CONTROL_MUTATION_MAX_MS}ms lease-safety budget ` +
            `(${mutationDurationMs.toFixed(3)}ms); transaction rolled back.`
          );
        }
        lock.assertOwned();
        controlTestFailpoint('after_mutation_before_commit_marker');

        const revisionAfterLocked = computeStateRevision(root).revision;
        if (!revisionAfterLocked) throw new Error('Control mutation produced no state revision.');
        const commitAudit = makeAuditEntry(
          'commit',
          null,
          revisionBeforeLocked,
          revisionAfterLocked,
          sha256Of(mutationResult),
          correlationId
        );
        markControlTransactionCommitPending(root, journal, mutationResult, revisionAfterLocked, commitAudit);
        controlTestFailpoint('after_commit_marker');
        finalizeControlTransaction(root, journal);
        return {
          result: mutationResult,
          replayed: false,
          revisionBefore: revisionBeforeLocked,
          revisionAfter: revisionAfterLocked,
        };
      } catch (transactionErr) {
        if (journal.status === 'prepared') {
          const message = (transactionErr as Error).message ?? String(transactionErr);
          const denyAudit = makeAuditEntry(
            'deny',
            codeOf(transactionErr) ?? ERROR_CODES.INTERNAL_ERROR,
            revisionBeforeLocked,
            revisionBeforeLocked,
            opts.artifactHashBefore ?? null,
            correlationId
          );
          markControlTransactionRollbackPending(root, journal, message, denyAudit);
          finalizeControlTransaction(root, journal);
        }
        if (transactionErr && typeof transactionErr === 'object') {
          (transactionErr as { controlTransactionRecorded?: boolean }).controlTransactionRecorded = true;
        }
        throw transactionErr;
      }
    });

    if (replayed) {
      appendAuditEntry(root, makeAuditEntry('idempotent_replay', null, revisionBefore, revisionAfter, sha256Of(result)));
    }
    return ok(opts.tool, root, result);
  } catch (err) {
    const code = codeOf(err);
    if (!(err && typeof err === 'object' && (err as { controlTransactionRecorded?: boolean }).controlTransactionRecorded)) {
      auditBestEffort('deny', code ?? ERROR_CODES.INTERNAL_ERROR, initialRevision, null, null);
    }
    if (code) return fail(opts.tool, root, code, (err as Error).message);
    return fail(opts.tool, root, ERROR_CODES.INTERNAL_ERROR, 'Internal error while executing this control operation.');
  }
}
