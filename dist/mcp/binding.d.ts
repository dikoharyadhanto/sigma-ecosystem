export type BindingMode = 'query' | 'control';
export type BindingKind = 'verified' | 'bound' | 'discovery';
export interface Binding {
    mode: BindingMode;
    kind: BindingKind;
    /** Canonical absolute root, or null in discovery mode. */
    root: string | null;
    /** project_id read from .sigma-identity.json at bind time. */
    projectId: string | null;
    /** Non-reversible correlation handle for the root. Safe to send to a model. */
    rootFingerprint: string | null;
    /** Server-bound role. Never settable from a tool argument. */
    role: string | null;
    verified: boolean;
}
export interface ParsedBindingArgs {
    mode: BindingMode;
    projectRoot?: string;
    projectId?: string;
    role?: string;
}
export declare class BindingError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Real, absolute path with junctions/symlinks resolved.
 *
 * realpathSync.native is what actually resolves a Windows junction and
 * restores the on-disk casing of each path segment; the JS realpathSync does
 * not do the latter. A path that does not exist yet cannot be realpath'd at
 * all, so we fall back to plain resolution and let the caller's existence
 * checks produce the error.
 */
export declare function canonicalize(p: string): string;
/**
 * Comparison form. Windows paths are case-insensitive, so two spellings of
 * the same directory must compare equal; POSIX paths must not.
 */
export declare function normalizeForCompare(p: string): string;
export declare function sameRoot(a: string, b: string): boolean;
/**
 * sha256 over the comparison form. §7.2: the absolute root is not sent to the
 * model by default — this is enough to correlate sessions and logs without
 * handing out a host path.
 */
export declare function fingerprintRoot(root: string): string;
/**
 * Both argument forms are accepted (§7.1, Director decision Q1).
 *
 *   sigma-mcp <ABS_ROOT>                                   ← legacy, what every
 *                                                            installed config
 *                                                            currently writes
 *   sigma-mcp --mode query --project-root R --project-id P ← verified binding
 *
 * A bare positional is treated as a root. --cwd is accepted as a historical
 * alias of --project-root because resolveRoot() used to honour it.
 */
export declare function parseBindingArgs(argv: string[]): ParsedBindingArgs;
export declare function discoveryBinding(): Binding;
/**
 * Resolves the startup binding. Throws BindingError when the process must not
 * start at all — a control server without a full binding, a root that is not a
 * Sigma project, or a project_id that does not match what the caller expected.
 */
export declare function resolveBinding(parsed: ParsedBindingArgs): Binding;
/**
 * Re-reads the bound project's identity and fails closed if it no longer
 * matches what was verified at startup.
 *
 * Reviewer finding R-04: the binding was attested once and then trusted for the
 * process lifetime. Swapping .sigma-identity.json's project_id after startup
 * left the server reporting binding_verified:true for the old id while every
 * payload described the new project. For an orchestrator process that outlives
 * a single task, that is the failure mode the binding exists to prevent.
 *
 * Only a verified binding is re-attested: an unverified one never made a claim
 * about identity, so there is nothing to contradict.
 */
export declare function assertIdentityUnchanged(binding: Binding): void;
/**
 * Per-call guard for the six legacy tools, which still accept project_root for
 * compatibility (§7.1 rule 4). Once bound, the only accepted values are absent,
 * empty, or a spelling of the bound root itself.
 */
export declare function assertCallRootAllowed(binding: Binding, requested?: string): void;
//# sourceMappingURL=binding.d.ts.map