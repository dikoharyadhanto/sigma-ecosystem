"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = exports.CONTRACT_VERSION = void 0;
exports.computeStateRevision = computeStateRevision;
exports.snapshot = snapshot;
exports.bindingMeta = bindingMeta;
exports.redactPath = redactPath;
exports.fingerprintOfExpectedRoot = fingerprintOfExpectedRoot;
exports.pathFingerprint = pathFingerprint;
exports.ok = ok;
exports.fail = fail;
exports.respond = respond;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const binding_1 = require("./binding");
const shared_1 = require("./shared");
exports.CONTRACT_VERSION = '1.0';
// §8 — stable error codes. Batch 1 can only raise the binding/query subset;
// the write codes are declared here so the vocabulary is frozen in one place
// and Stage C/D cannot quietly invent variants.
exports.ERROR_CODES = {
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
};
/**
 * Deterministic over the bytes of exactly three files:
 *   .sigma-identity.json, Sigma/activate_status.json, Sigma/progress-v<N>.json
 *
 * Deliberately excluded: operations.jsonl, overrides.jsonl, the mailbox index,
 * and (§7.3, decision Q6) wherever the Stage C/D idempotency and approval store
 * eventually lives. A write must not invalidate the very ticket that authorised
 * it.
 */
function computeStateRevision(root) {
    if (!root)
        return { activeChain: null, revision: null };
    const hash = crypto_1.default.createHash('sha256');
    let sawAnything = false;
    let activeChain = null;
    const absorb = (abs, label) => {
        try {
            const buf = fs_extra_1.default.readFileSync(abs);
            hash.update(label);
            hash.update(buf);
            sawAnything = true;
        }
        catch {
            // Absent input contributes its label only, so "file missing" and "file
            // empty" do not collide into the same revision.
            hash.update(label + ':absent');
        }
    };
    absorb(path_1.default.join(root, config_1.PROJECT_IDENTITY_FILE), 'identity');
    const activatePath = path_1.default.join(root, config_1.ACTIVATE_STATUS_FILE);
    absorb(activatePath, 'activate');
    try {
        const raw = fs_extra_1.default.readJsonSync(activatePath);
        if (typeof raw.active_chain === 'string')
            activeChain = raw.active_chain;
    }
    catch {
        /* handled by absorb */
    }
    if (activeChain) {
        absorb(path_1.default.join(root, config_1.PROJECT_SIGMA_DIR, `progress-${activeChain}.json`), 'chain');
    }
    else {
        hash.update('chain:none');
    }
    if (!sawAnything)
        return { activeChain: null, revision: null };
    return { activeChain, revision: 'sha256:' + hash.digest('hex') };
}
function snapshot(root) {
    const { activeChain, revision } = computeStateRevision(root);
    return {
        active_chain: activeChain,
        state_revision: revision,
        observed_at: new Date().toISOString(),
    };
}
function bindingMeta(b) {
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
function redactPath(binding, absPath) {
    if (!absPath)
        return null;
    if (!binding.verified || !binding.root)
        return absPath;
    const rel = path_1.default.relative(binding.root, absPath);
    if (rel.startsWith('..') || path_1.default.isAbsolute(rel))
        return null;
    return rel.split(path_1.default.sep).join('/');
}
/**
 * Fingerprint of a caller-supplied path, in the same form the binding uses, so
 * sigma_verify_binding can compare without ever echoing a host path back. The
 * comparison is the only consumer — a non-existent path still fingerprints
 * (canonicalize falls back to plain resolution), so this reveals nothing about
 * what exists on disk.
 */
function fingerprintOfExpectedRoot(candidate) {
    return (0, binding_1.fingerprintRoot)(candidate);
}
function pathFingerprint(absPath) {
    return 'sha256:' + crypto_1.default.createHash('sha256').update(absPath).digest('hex');
}
// ── Envelopes ────────────────────────────────────────────────────────────────
function withMeta(tool, root, payload) {
    const body = (payload && typeof payload === 'object') ? payload : { value: payload };
    return {
        contract_version: exports.CONTRACT_VERSION,
        tool,
        binding: bindingMeta((0, shared_1.getBinding)()),
        snapshot: snapshot(root),
        ...body,
    };
}
function frame(obj, isError = false) {
    const base = {
        content: [{ type: 'text', text: JSON.stringify(obj) }],
        structuredContent: obj,
    };
    return isError ? { ...base, isError: true } : base;
}
function ok(tool, root, payload) {
    return frame(withMeta(tool, root, payload));
}
function fail(tool, root, code, message) {
    return frame(withMeta(tool, root, { active: false, error: { code, message } }), true);
}
/**
 * A thrown error is only allowed to keep its message if it carries one of the
 * frozen error codes. Everything else is anonymised. This is what lets a tool
 * signal PAYLOAD_TOO_LARGE or BOUNDARY_VIOLATION precisely without opening a
 * channel for arbitrary engine text to reach the model.
 */
function codeOf(err) {
    if (err instanceof binding_1.BindingError)
        return err.code;
    const candidate = err?.code;
    if (typeof candidate === 'string' && candidate in exports.ERROR_CODES)
        return candidate;
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
function respond(tool, requestedRoot, compute) {
    const binding = (0, shared_1.getBinding)();
    let root = null;
    try {
        (0, binding_1.assertCallRootAllowed)(binding, requestedRoot);
        root = binding.root ?? (0, shared_1.resolveRoot)(requestedRoot);
        return ok(tool, root, compute(root));
    }
    catch (err) {
        const code = codeOf(err);
        if (code)
            return fail(tool, root, code, err.message);
        // Anything untyped is an engine or filesystem error. Its message can carry
        // host paths and stack detail, so it is dropped rather than forwarded.
        return fail(tool, root, exports.ERROR_CODES.INTERNAL_ERROR, 'Internal error while serving this tool.');
    }
}
//# sourceMappingURL=contract.js.map