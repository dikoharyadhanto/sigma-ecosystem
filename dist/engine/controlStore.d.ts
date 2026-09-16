export declare const AUDIT_FILE_REL: string;
export declare const CONTROL_LOCK_STALE_MS = 5000;
export declare const CONTROL_LOCK_UPDATE_MS = 1000;
export declare const CONTROL_MUTATION_MAX_MS = 250;
export declare const TICKET_TTL_MS: number;
export declare const APPROVAL_TTL_MS: number;
export declare function isValidStoreId(id: string): boolean;
export declare function generateId(prefix: string): string;
/** Test-only crash injection used by out-of-process recovery tests. */
export declare function controlTestFailpoint(name: string): void;
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
export declare function readIdempotencyRecord(root: string, projectId: string, operationId: string, boundRole: string, idempotencyKey: string): IdempotencyRecord | null;
export declare function writeIdempotencyRecord(root: string, record: IdempotencyRecord): void;
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
export declare function deleteIdempotencyRecord(root: string, operationId: string, boundRole: string, idempotencyKey: string): void;
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
export declare function appendAuditEntry(root: string, entry: AuditEntry): void;
export interface ControlFileSnapshot {
    path: string;
    existed: boolean;
    content_base64: string | null;
}
export type ControlTransactionStatus = 'prepared' | 'rollback_pending' | 'commit_pending' | 'rolled_back' | 'completed';
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
export declare function beginControlTransaction(args: {
    root: string;
    projectId: string;
    operationId: string;
    boundRole: string;
    idempotencyKey: string;
    argumentsHash: string;
    revisionBefore: string;
    files: string[];
    auditEntry: AuditEntry;
}): ControlTransactionJournal;
export declare function markControlTransactionCommitPending(root: string, journal: ControlTransactionJournal, result: unknown, revisionAfter: string, auditEntry: AuditEntry): void;
export declare function markControlTransactionRollbackPending(root: string, journal: ControlTransactionJournal, error: string, auditEntry: AuditEntry): void;
export declare function finalizeControlTransaction(root: string, journal: ControlTransactionJournal): void;
export declare function recoverControlTransactions(root: string): void;
export interface OperationTicket {
    operation_ticket_id: string;
    operation_id: string;
    project_id: string;
    bound_role: string;
    arguments_hash: string;
    target: {
        artifact: string;
        version: string;
        sha256: string;
    } | null;
    expected_state_revision: string;
    /** Human-readable effect summary shown by `sigma control show`, e.g.
     *  "intent.state: DRAFT -> RATIFIED" — plan §10.1's `effects[]`. */
    effects: string[];
    authority: 'director';
    issued_at: string;
    expires_at: string;
    consumed_at: string | null;
}
export declare function ticketPath(root: string, ticketId: string): string;
export declare function writeTicket(root: string, ticket: OperationTicket): void;
/**
 * A caller-supplied id that does not match generateId()'s exact shape can
 * never be a real ticket — treated as not-found rather than reaching the
 * filesystem at all. This is the fix for the path-traversal finding: no
 * ticket/approval id this module accepts can contain `.`, `/`, `\`, or a
 * drive letter, so there is no traversal-capable input left once this check
 * passes.
 */
export declare function readTicket(root: string, ticketId: string): OperationTicket | null;
export declare function markTicketConsumed(root: string, ticketId: string, consumedAt: string): void;
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
export declare function approvalPath(root: string, approvalId: string): string;
export declare function writeApproval(root: string, approval: ApprovalRecord): void;
export declare function readApproval(root: string, approvalId: string): ApprovalRecord | null;
export declare function markApprovalConsumed(root: string, approvalId: string, consumedAt: string): void;
export interface ProjectLockHandle {
    assertOwned: () => void;
    release: () => Promise<void>;
}
export declare function acquireProjectLock(root: string): Promise<ProjectLockHandle>;
//# sourceMappingURL=controlStore.d.ts.map