// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §7.2, §7.3, §8 — response contract.
//
// Every tool answers with the same envelope: who is bound, what snapshot the
// answer was taken from, and which contract version produced it. Consumers can
// then tell "no active chain" apart from "wrong project" apart from "stale
// read" without parsing prose.
//
// Shape (§7.2), additive over the payload each tool already returned:
//
//   { contract_version, tool, binding{...}, snapshot{...}, ...payload }
//
// structuredContent carries the same object as the text JSON. It is emitted
// WITHOUT declaring outputSchema on the tools: the SDK only validates
// structured output when a tool declares a schema (server/mcp.js
// validateToolOutput, client/index.js getToolOutputValidator), so declaring one
// would freeze every payload shape into a hard client-side error on any drift.
// Batch 1 buys the structured representation without buying that coupling.

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { PROJECT_IDENTITY_FILE, ACTIVATE_STATUS_FILE, PROJECT_SIGMA_DIR } from '../config';
import { Binding, BindingError, assertCallRootAllowed, fingerprintRoot } from './binding';
import { getBinding, resolveRoot } from './shared';

export const CONTRACT_VERSION = '1.0';

// §8 — stable error codes. Batch 1 can only raise the binding/query subset;
// the write codes are declared here so the vocabulary is frozen in one place
// and Stage C/D cannot quietly invent variants.
export const ERROR_CODES = {
  NO_PROJECT: 'NO_PROJECT',
  BINDING_REQUIRED: 'BINDING_REQUIRED',
  BOUNDARY_VIOLATION: 'BOUNDARY_VIOLATION',
  PROJECT_ID_MISMATCH: 'PROJECT_ID_MISMATCH',
  ROLE_NOT_AUTHORIZED: 'ROLE_NOT_AUTHORIZED',
  GATE_BLOCKED: 'GATE_BLOCKED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVAL_MISMATCH: 'APPROVAL_MISMATCH',
  STALE_STATE: 'STALE_STATE',
  STALE_ARTIFACT: 'STALE_ARTIFACT',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INVALID_OPERATION: 'INVALID_OPERATION',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ── Snapshot / state revision (§7.3) ─────────────────────────────────────────

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
export function computeStateRevision(root: string | null): { activeChain: string | null; revision: string | null } {
  if (!root) return { activeChain: null, revision: null };

  const hash = crypto.createHash('sha256');
  let sawAnything = false;
  let activeChain: string | null = null;

  const absorb = (abs: string, label: string): void => {
    try {
      const buf = fs.readFileSync(abs);
      hash.update(label);
      hash.update(buf);
      sawAnything = true;
    } catch {
      // Absent input contributes its label only, so "file missing" and "file
      // empty" do not collide into the same revision.
      hash.update(label + ':absent');
    }
  };

  absorb(path.join(root, PROJECT_IDENTITY_FILE), 'identity');

  const activatePath = path.join(root, ACTIVATE_STATUS_FILE);
  absorb(activatePath, 'activate');
  try {
    const raw = fs.readJsonSync(activatePath) as { active_chain?: unknown };
    if (typeof raw.active_chain === 'string') activeChain = raw.active_chain;
  } catch {
    /* handled by absorb */
  }

  if (activeChain) {
    absorb(path.join(root, PROJECT_SIGMA_DIR, `progress-${activeChain}.json`), 'chain');
  } else {
    hash.update('chain:none');
  }

  if (!sawAnything) return { activeChain: null, revision: null };
  return { activeChain, revision: 'sha256:' + hash.digest('hex') };
}

export function snapshot(root: string | null): Snapshot {
  const { activeChain, revision } = computeStateRevision(root);
  return {
    active_chain: activeChain,
    state_revision: revision,
    observed_at: new Date().toISOString(),
  };
}

// ── Binding metadata (§7.2) ──────────────────────────────────────────────────

export interface BindingMeta {
  verified: boolean;
  mode: string;
  kind: string;
  project_id: string | null;
  root_fingerprint: string | null;
}

export function bindingMeta(b: Binding): BindingMeta {
  return {
    verified: b.verified,
    mode: b.mode,
    kind: b.kind,
    project_id: b.projectId,
    // §7.2 — the absolute root is not sent to the model by default.
    root_fingerprint: b.rootFingerprint,
  };
}

/**
 * §8.1 — host path redaction is tied to binding state, not to binary version.
 * On an unverified binding the old absolute path is preserved verbatim so that
 * clients installed before Stage A see no behavioural change at all.
 */
export function redactPath(binding: Binding, absPath: string | null | undefined): string | null {
  if (!absPath) return null;
  if (!binding.verified || !binding.root) return absPath;
  const rel = path.relative(binding.root, absPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

/**
 * Fingerprint of a caller-supplied path, in the same form the binding uses, so
 * sigma_verify_binding can compare without ever echoing a host path back. The
 * comparison is the only consumer — a non-existent path still fingerprints
 * (canonicalize falls back to plain resolution), so this reveals nothing about
 * what exists on disk.
 */
export function fingerprintOfExpectedRoot(candidate: string): string {
  return fingerprintRoot(candidate);
}

export function pathFingerprint(absPath: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(absPath).digest('hex');
}

// ── Envelopes ────────────────────────────────────────────────────────────────

function withMeta(tool: string, root: string | null, payload: unknown): Record<string, unknown> {
  const body = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : { value: payload };
  return {
    contract_version: CONTRACT_VERSION,
    tool,
    binding: bindingMeta(getBinding()),
    snapshot: snapshot(root),
    ...body,
  };
}

function frame(obj: Record<string, unknown>, isError = false) {
  const base = {
    content: [{ type: 'text' as const, text: JSON.stringify(obj) }],
    structuredContent: obj,
  };
  return isError ? { ...base, isError: true as const } : base;
}

export function ok(tool: string, root: string | null, payload: unknown) {
  return frame(withMeta(tool, root, payload));
}

export function fail(tool: string, root: string | null, code: ErrorCode, message: string) {
  return frame(withMeta(tool, root, { active: false, error: { code, message } }), true);
}

/**
 * A thrown error is only allowed to keep its message if it carries one of the
 * frozen error codes. Everything else is anonymised. This is what lets a tool
 * signal PAYLOAD_TOO_LARGE or BOUNDARY_VIOLATION precisely without opening a
 * channel for arbitrary engine text to reach the model.
 */
function codeOf(err: unknown): ErrorCode | null {
  if (err instanceof BindingError) return err.code as ErrorCode;
  const candidate = (err as { code?: unknown })?.code;
  if (typeof candidate === 'string' && candidate in ERROR_CODES) return candidate as ErrorCode;
  return null;
}

/**
 * The single entry point every query tool goes through.
 *
 * Resolves the request's root under the binding rules, runs the tool's pure
 * compute function, and wraps the result. A BindingError becomes a typed error
 * envelope; an unexpected throw becomes INTERNAL_ERROR with its message
 * dropped, so engine internals and host paths never reach the model (§8 rule 5).
 */
export function respond(
  tool: string,
  requestedRoot: string | undefined,
  compute: (root: string | null) => unknown
) {
  const binding = getBinding();
  let root: string | null = null;
  try {
    assertCallRootAllowed(binding, requestedRoot);
    root = binding.root ?? resolveRoot(requestedRoot);
    return ok(tool, root, compute(root));
  } catch (err) {
    const code = codeOf(err);
    if (code) return fail(tool, root, code, (err as Error).message);
    // Anything untyped is an engine or filesystem error. Its message can carry
    // host paths and stack detail, so it is dropped rather than forwarded.
    return fail(tool, root, ERROR_CODES.INTERNAL_ERROR, 'Internal error while serving this tool.');
  }
}
