// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §7 — startup project binding.
//
// Before this module, the server had no notion of "which project am I".
// resolveRoot() in shared.ts accepted a root from five sources — tool
// argument, environment, argv, MCP client roots, cwd — and took the first one
// that happened to contain a Sigma project. A model that could pass
// project_root could therefore read any Sigma project on the host.
//
// Binding is resolved exactly once, at startup, from trusted process
// arguments only. Never from a tool call, never from the environment, never
// from client roots. Three outcomes (§7.1):
//
//   verified  — root + matching project_id      → binding_verified: true
//   bound     — root, no project_id to check    → binding_verified: false
//   discovery — no root at all; legacy fallback → binding_verified: false
//
// HARD CONSTRAINT: nothing here may write to stdout (stdio transport).

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { PROJECT_IDENTITY_FILE, ACTIVATE_STATUS_FILE } from '../config';

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
  /**
   * Server-bound role. Never settable from a tool argument — the only writer
   * is resolveBinding(), from trusted process argv, and only in control mode.
   * Query mode has no role-scoped tool (the Stage B2 mailbox tools that would
   * have used it were withdrawn by Director decision after review — see
   * RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md §9), so query-mode role stays
   * unset.
   */
  role: string | null;
  verified: boolean;
}

export interface ParsedBindingArgs {
  mode: BindingMode;
  projectRoot?: string;
  projectId?: string;
  role?: string;
}

export class BindingError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'BindingError';
  }
}

// ── Canonicalization ─────────────────────────────────────────────────────────

/**
 * Real, absolute path with junctions/symlinks resolved.
 *
 * realpathSync.native is what actually resolves a Windows junction and
 * restores the on-disk casing of each path segment; the JS realpathSync does
 * not do the latter. A path that does not exist yet cannot be realpath'd at
 * all, so we fall back to plain resolution and let the caller's existence
 * checks produce the error.
 */
export function canonicalize(p: string): string {
  const resolved = path.resolve(p);
  try {
    const native = (fs.realpathSync as unknown as { native?: (x: string) => string }).native;
    if (typeof native === 'function') return native(resolved);
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

/**
 * Comparison form. Windows paths are case-insensitive, so two spellings of
 * the same directory must compare equal; POSIX paths must not.
 */
export function normalizeForCompare(p: string): string {
  const c = canonicalize(p);
  return process.platform === 'win32' ? c.toLowerCase() : c;
}

export function sameRoot(a: string, b: string): boolean {
  return normalizeForCompare(a) === normalizeForCompare(b);
}

/**
 * sha256 over the comparison form. §7.2: the absolute root is not sent to the
 * model by default — this is enough to correlate sessions and logs without
 * handing out a host path.
 */
export function fingerprintRoot(root: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(normalizeForCompare(root)).digest('hex');
}

// ── Argument parsing ─────────────────────────────────────────────────────────

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
export function parseBindingArgs(argv: string[]): ParsedBindingArgs {
  const out: ParsedBindingArgs = { mode: 'query' };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--mode': {
        const v = argv[++i];
        if (v === 'query' || v === 'control') out.mode = v;
        else if (v !== undefined) {
          throw new BindingError('INVALID_OPERATION', `Unknown --mode "${v}" (expected query|control)`);
        }
        break;
      }
      case '--project-root':
      case '--cwd': {
        const v = argv[++i];
        if (v) out.projectRoot = v;
        break;
      }
      case '--project-id': {
        const v = argv[++i];
        if (v) out.projectId = v;
        break;
      }
      case '--role': {
        const v = argv[++i];
        if (v) out.role = v;
        break;
      }
      default:
        // Bare positional → root. Unknown flags are ignored rather than
        // fatal: an older binary must survive a config written by a newer
        // CLI (§7.4, bottom-left cell of the compatibility matrix).
        if (!arg.startsWith('-') && !out.projectRoot) out.projectRoot = arg;
        break;
    }
  }

  return out;
}

// ── Resolution ───────────────────────────────────────────────────────────────

const DISCOVERY: Binding = {
  mode: 'query',
  kind: 'discovery',
  root: null,
  projectId: null,
  rootFingerprint: null,
  role: null,
  verified: false,
};

export function discoveryBinding(): Binding {
  return { ...DISCOVERY };
}

/**
 * Resolves the startup binding. Throws BindingError when the process must not
 * start at all — a control server without a full binding, a root that is not a
 * Sigma project, or a project_id that does not match what the caller expected.
 */
export function resolveBinding(parsed: ParsedBindingArgs): Binding {
  if (!parsed.projectRoot) {
    // §7.1 rule 7 — control mode must never fall back to discovery.
    if (parsed.mode === 'control') {
      throw new BindingError(
        'BINDING_REQUIRED',
        'Control mode requires --project-root and --project-id. Refusing to start unbound.'
      );
    }
    return discoveryBinding();
  }

  const root = canonicalize(parsed.projectRoot);

  if (!fs.existsSync(path.join(root, ACTIVATE_STATUS_FILE))) {
    throw new BindingError(
      'NO_PROJECT',
      'Bound root is not a Sigma project (no Sigma/activate_status.json).'
    );
  }

  let projectId: string | null = null;
  const identityPath = path.join(root, PROJECT_IDENTITY_FILE);
  if (fs.existsSync(identityPath)) {
    try {
      const raw = fs.readJsonSync(identityPath) as { project_id?: unknown };
      if (typeof raw.project_id === 'string') projectId = raw.project_id;
    } catch {
      // Malformed identity is not fatal on its own — it only means the ID
      // cannot be verified, handled by the mismatch check below.
    }
  }

  if (parsed.projectId) {
    if (projectId === null) {
      throw new BindingError(
        'PROJECT_ID_MISMATCH',
        'Expected project_id was given but the project has no readable identity file.'
      );
    }
    if (projectId !== parsed.projectId) {
      // Neither ID is echoed back: the caller already knows the one it sent,
      // and the one on disk belongs to a project it evidently is not bound to.
      throw new BindingError('PROJECT_ID_MISMATCH', 'Bound project identity does not match the expected project_id.');
    }
  } else if (parsed.mode === 'control') {
    throw new BindingError(
      'BINDING_REQUIRED',
      'Control mode requires --project-id. Refusing to start on an unverified binding.'
    );
  }

  return {
    mode: parsed.mode,
    kind: parsed.projectId ? 'verified' : 'bound',
    root,
    projectId,
    rootFingerprint: fingerprintRoot(root),
    role: parsed.mode === 'control' ? (parsed.role ?? null) : null,
    verified: Boolean(parsed.projectId),
  };
}

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
export function assertIdentityUnchanged(binding: Binding): void {
  if (!binding.verified || !binding.root) return;

  let current: string | null = null;
  try {
    const raw = fs.readJsonSync(path.join(binding.root, PROJECT_IDENTITY_FILE)) as { project_id?: unknown };
    if (typeof raw.project_id === 'string') current = raw.project_id;
  } catch {
    current = null;
  }

  if (current !== binding.projectId) {
    throw new BindingError(
      'BOUNDARY_VIOLATION',
      'Bound project identity changed after this server started; refusing to serve it.'
    );
  }
}

/**
 * Per-call guard for the six legacy tools, which still accept project_root for
 * compatibility (§7.1 rule 4). Once bound, the only accepted values are absent,
 * empty, or a spelling of the bound root itself.
 */
export function assertCallRootAllowed(binding: Binding, requested?: string): void {
  if (!requested || requested.trim().length === 0) return;
  if (!binding.root) return; // discovery mode — legacy resolution still applies
  if (!sameRoot(requested, binding.root)) {
    throw new BindingError(
      'BOUNDARY_VIOLATION',
      'This server is bound to a single project; project_root cannot select another one.'
    );
  }
}
