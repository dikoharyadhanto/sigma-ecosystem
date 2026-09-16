"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BindingError = void 0;
exports.canonicalize = canonicalize;
exports.normalizeForCompare = normalizeForCompare;
exports.sameRoot = sameRoot;
exports.fingerprintRoot = fingerprintRoot;
exports.parseBindingArgs = parseBindingArgs;
exports.discoveryBinding = discoveryBinding;
exports.resolveBinding = resolveBinding;
exports.assertIdentityUnchanged = assertIdentityUnchanged;
exports.assertCallRootAllowed = assertCallRootAllowed;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
class BindingError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'BindingError';
    }
}
exports.BindingError = BindingError;
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
function canonicalize(p) {
    const resolved = path_1.default.resolve(p);
    try {
        const native = fs_extra_1.default.realpathSync.native;
        if (typeof native === 'function')
            return native(resolved);
        return fs_extra_1.default.realpathSync(resolved);
    }
    catch {
        return resolved;
    }
}
/**
 * Comparison form. Windows paths are case-insensitive, so two spellings of
 * the same directory must compare equal; POSIX paths must not.
 */
function normalizeForCompare(p) {
    const c = canonicalize(p);
    return process.platform === 'win32' ? c.toLowerCase() : c;
}
function sameRoot(a, b) {
    return normalizeForCompare(a) === normalizeForCompare(b);
}
/**
 * sha256 over the comparison form. §7.2: the absolute root is not sent to the
 * model by default — this is enough to correlate sessions and logs without
 * handing out a host path.
 */
function fingerprintRoot(root) {
    return 'sha256:' + crypto_1.default.createHash('sha256').update(normalizeForCompare(root)).digest('hex');
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
function parseBindingArgs(argv) {
    const out = { mode: 'query' };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--mode': {
                const v = argv[++i];
                if (v === 'query' || v === 'control')
                    out.mode = v;
                else if (v !== undefined) {
                    throw new BindingError('INVALID_OPERATION', `Unknown --mode "${v}" (expected query|control)`);
                }
                break;
            }
            case '--project-root':
            case '--cwd': {
                const v = argv[++i];
                if (v)
                    out.projectRoot = v;
                break;
            }
            case '--project-id': {
                const v = argv[++i];
                if (v)
                    out.projectId = v;
                break;
            }
            case '--role': {
                const v = argv[++i];
                if (v)
                    out.role = v;
                break;
            }
            default:
                // Bare positional → root. Unknown flags are ignored rather than
                // fatal: an older binary must survive a config written by a newer
                // CLI (§7.4, bottom-left cell of the compatibility matrix).
                if (!arg.startsWith('-') && !out.projectRoot)
                    out.projectRoot = arg;
                break;
        }
    }
    return out;
}
// ── Resolution ───────────────────────────────────────────────────────────────
const DISCOVERY = {
    mode: 'query',
    kind: 'discovery',
    root: null,
    projectId: null,
    rootFingerprint: null,
    role: null,
    verified: false,
};
function discoveryBinding() {
    return { ...DISCOVERY };
}
/**
 * Resolves the startup binding. Throws BindingError when the process must not
 * start at all — a control server without a full binding, a root that is not a
 * Sigma project, or a project_id that does not match what the caller expected.
 */
function resolveBinding(parsed) {
    if (!parsed.projectRoot) {
        // §7.1 rule 7 — control mode must never fall back to discovery.
        if (parsed.mode === 'control') {
            throw new BindingError('BINDING_REQUIRED', 'Control mode requires --project-root and --project-id. Refusing to start unbound.');
        }
        return discoveryBinding();
    }
    const root = canonicalize(parsed.projectRoot);
    if (!fs_extra_1.default.existsSync(path_1.default.join(root, config_1.ACTIVATE_STATUS_FILE))) {
        throw new BindingError('NO_PROJECT', 'Bound root is not a Sigma project (no Sigma/activate_status.json).');
    }
    let projectId = null;
    const identityPath = path_1.default.join(root, config_1.PROJECT_IDENTITY_FILE);
    if (fs_extra_1.default.existsSync(identityPath)) {
        try {
            const raw = fs_extra_1.default.readJsonSync(identityPath);
            if (typeof raw.project_id === 'string')
                projectId = raw.project_id;
        }
        catch {
            // Malformed identity is not fatal on its own — it only means the ID
            // cannot be verified, handled by the mismatch check below.
        }
    }
    if (parsed.projectId) {
        if (projectId === null) {
            throw new BindingError('PROJECT_ID_MISMATCH', 'Expected project_id was given but the project has no readable identity file.');
        }
        if (projectId !== parsed.projectId) {
            // Neither ID is echoed back: the caller already knows the one it sent,
            // and the one on disk belongs to a project it evidently is not bound to.
            throw new BindingError('PROJECT_ID_MISMATCH', 'Bound project identity does not match the expected project_id.');
        }
    }
    else if (parsed.mode === 'control') {
        throw new BindingError('BINDING_REQUIRED', 'Control mode requires --project-id. Refusing to start on an unverified binding.');
    }
    // Stage C — every control tool is role-gated (plan §9.2); a control server
    // bound with no role could never authorize a single write, so failing fast
    // here is better than starting a process that can only ever answer
    // ROLE_NOT_AUTHORIZED. Query mode is unaffected — it has no role-scoped
    // tool (see the `role` field comment above).
    if (parsed.mode === 'control' && !parsed.role) {
        throw new BindingError('BINDING_REQUIRED', 'Control mode requires --role. Refusing to start unbound to a role.');
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
function assertIdentityUnchanged(binding) {
    if (!binding.verified || !binding.root)
        return;
    let current = null;
    try {
        const raw = fs_extra_1.default.readJsonSync(path_1.default.join(binding.root, config_1.PROJECT_IDENTITY_FILE));
        if (typeof raw.project_id === 'string')
            current = raw.project_id;
    }
    catch {
        current = null;
    }
    if (current !== binding.projectId) {
        throw new BindingError('BOUNDARY_VIOLATION', 'Bound project identity changed after this server started; refusing to serve it.');
    }
}
/**
 * Per-call guard for the six legacy tools, which still accept project_root for
 * compatibility (§7.1 rule 4). Once bound, the only accepted values are absent,
 * empty, or a spelling of the bound root itself.
 */
function assertCallRootAllowed(binding, requested) {
    if (!requested || requested.trim().length === 0)
        return;
    if (!binding.root)
        return; // discovery mode — legacy resolution still applies
    if (!sameRoot(requested, binding.root)) {
        throw new BindingError('BOUNDARY_VIOLATION', 'This server is bound to a single project; project_root cannot select another one.');
    }
}
//# sourceMappingURL=binding.js.map