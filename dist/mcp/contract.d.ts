import { Binding } from './binding';
export declare const CONTRACT_VERSION = "1.0";
export declare const ERROR_CODES: {
    readonly NO_PROJECT: "NO_PROJECT";
    readonly BINDING_REQUIRED: "BINDING_REQUIRED";
    readonly BOUNDARY_VIOLATION: "BOUNDARY_VIOLATION";
    readonly PROJECT_ID_MISMATCH: "PROJECT_ID_MISMATCH";
    readonly ROLE_NOT_AUTHORIZED: "ROLE_NOT_AUTHORIZED";
    readonly GATE_BLOCKED: "GATE_BLOCKED";
    readonly APPROVAL_REQUIRED: "APPROVAL_REQUIRED";
    readonly APPROVAL_MISMATCH: "APPROVAL_MISMATCH";
    readonly STALE_STATE: "STALE_STATE";
    readonly STALE_ARTIFACT: "STALE_ARTIFACT";
    readonly IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT";
    readonly PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
    readonly INVALID_OPERATION: "INVALID_OPERATION";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export interface Snapshot {
    active_chain: string | null;
    state_revision: string | null;
    observed_at: string;
}
/**
 * Deterministic over the bytes of exactly three files:
 *   .sigma-identity.json, Sigma/activate_status.json, Sigma/progress-v<N>.json
 *
 * Deliberately excluded: operations.jsonl, overrides.jsonl, the mailbox index,
 * and (§7.3, decision Q6) wherever the Stage C/D idempotency and approval store
 * eventually lives. A write must not invalidate the very ticket that authorised
 * it.
 */
export declare function computeStateRevision(root: string | null): {
    activeChain: string | null;
    revision: string | null;
};
export declare function snapshot(root: string | null): Snapshot;
export interface BindingMeta {
    verified: boolean;
    mode: string;
    kind: string;
    project_id: string | null;
    root_fingerprint: string | null;
}
export declare function bindingMeta(b: Binding): BindingMeta;
/**
 * §8.1 — host path redaction is tied to binding state, not to binary version.
 * On an unverified binding the old absolute path is preserved verbatim so that
 * clients installed before Stage A see no behavioural change at all.
 */
export declare function redactPath(binding: Binding, absPath: string | null | undefined): string | null;
/**
 * Fingerprint of a caller-supplied path, in the same form the binding uses, so
 * sigma_verify_binding can compare without ever echoing a host path back. The
 * comparison is the only consumer — a non-existent path still fingerprints
 * (canonicalize falls back to plain resolution), so this reveals nothing about
 * what exists on disk.
 */
export declare function fingerprintOfExpectedRoot(candidate: string): string;
export declare function pathFingerprint(absPath: string): string;
export declare function ok(tool: string, root: string | null, payload: unknown): {
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
};
export declare function fail(tool: string, root: string | null, code: ErrorCode, message: string): {
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
};
/**
 * The single entry point every query tool goes through.
 *
 * Resolves the request's root under the binding rules, runs the tool's pure
 * compute function, and wraps the result. A BindingError becomes a typed error
 * envelope; an unexpected throw becomes INTERNAL_ERROR with its message
 * dropped, so engine internals and host paths never reach the model (§8 rule 5).
 */
export declare function respond(tool: string, requestedRoot: string | undefined, compute: (root: string | null) => unknown): {
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
};
//# sourceMappingURL=contract.d.ts.map