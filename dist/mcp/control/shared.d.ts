import { Binding } from '../binding';
export interface ControlMutationTiming {
    count: number;
    last_ms: number;
    max_ms: number;
}
/** Test evidence only; not registered as an MCP tool or public CLI API. */
export declare function controlMutationTimingSnapshot(): Record<string, ControlMutationTiming>;
export declare function resetControlMutationTimings(): void;
export declare function requireRole(binding: Binding, allowed: string[]): string;
export declare function stableHash(value: unknown): string;
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
export declare function staleStateCheck(expectedStateRevision: string): (root: string) => void;
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
export declare function respondControlWrite(opts: ControlWriteOptions, mutate: (root: string, role: string) => unknown): Promise<{
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
} | {
    isError: true;
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: Record<string, unknown>;
}>;
//# sourceMappingURL=shared.d.ts.map