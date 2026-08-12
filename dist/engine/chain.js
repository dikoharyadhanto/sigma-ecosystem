"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOverrides = readOverrides;
exports.parseMajorVersion = parseMajorVersion;
exports.parseMinorVersion = parseMinorVersion;
exports.chainFilePath = chainFilePath;
exports.activateStatusPath = activateStatusPath;
exports.listChainVersions = listChainVersions;
exports.nextChainVersion = nextChainVersion;
exports.readActivateStatus = readActivateStatus;
exports.writeActivateStatus = writeActivateStatus;
exports.resolveActiveChainVersion = resolveActiveChainVersion;
exports.readChain = readChain;
exports.writeChain = writeChain;
exports.readActiveChain = readActiveChain;
exports.readProjectIdentity = readProjectIdentity;
exports.createInitialChain = createInitialChain;
exports.hasRatifiedIntent = hasRatifiedIntent;
exports.hasCleanGate2Chain = hasCleanGate2Chain;
exports.hasCleanGate3Chain = hasCleanGate3Chain;
exports.validateChainSemantics = validateChainSemantics;
exports.hasInvalidRuntime = hasInvalidRuntime;
exports.getInvalidMarkers = getInvalidMarkers;
exports.isGateInvalid = isGateInvalid;
exports.getGateStatusLabel = getGateStatusLabel;
exports.getOperationalGate = getOperationalGate;
exports.getInvalidWarningLines = getInvalidWarningLines;
exports.assertChainCanMutate = assertChainCanMutate;
exports.getGateStatus = getGateStatus;
exports.runDoctorReconciliation = runDoctorReconciliation;
exports.nextPlanVersion = nextPlanVersion;
exports.nextExecVersion = nextExecVersion;
exports.ratifyIntent = ratifyIntent;
exports.arcScoreBand = arcScoreBand;
exports.hasGate35Score = hasGate35Score;
exports.recordArcScore = recordArcScore;
exports.previewIntentSupersedeCascade = previewIntentSupersedeCascade;
exports.supersedeIntentVersion = supersedeIntentVersion;
exports.registerRoadmapDraft = registerRoadmapDraft;
exports.lockActiveRoadmap = lockActiveRoadmap;
exports.registerPlanDraft = registerPlanDraft;
exports.updatePlanMetadata = updatePlanMetadata;
exports.lockOldestPlanDraft = lockOldestPlanDraft;
exports.registerPendingPlan = registerPendingPlan;
exports.promotePendingPlan = promotePendingPlan;
exports.supersedePlanVersion = supersedePlanVersion;
exports.activatePlanDraft = activatePlanDraft;
exports.registerExecDraft = registerExecDraft;
exports.lockActiveExec = lockActiveExec;
exports.registerCloseDraft = registerCloseDraft;
exports.lockActiveClose = lockActiveClose;
exports.getNextValidOperations = getNextValidOperations;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
// ── Overrides (read by doctor.ts / override.ts) ─────────────────────────────
function readOverrides(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.OVERRIDES_FILE);
    if (!fs_extra_1.default.existsSync(filePath))
        return [];
    const entries = [];
    for (const line of fs_extra_1.default.readFileSync(filePath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            entries.push(JSON.parse(trimmed));
        }
        catch {
            // Skip malformed lines — the log is append-only and best-effort.
        }
    }
    return entries;
}
// ── Version Helpers ──────────────────────────────────────────────────────────
function parseMajorVersion(version) {
    const match = version.match(/^v(\d+)/);
    if (!match)
        throw new Error(`Cannot parse major version from "${version}"`);
    return parseInt(match[1], 10);
}
function parseMinorVersion(version) {
    const match = version.match(/^v\d+(?:\.(\d+))?/);
    if (!match)
        throw new Error(`Cannot parse minor version from "${version}"`);
    return match[1] ? parseInt(match[1], 10) : 0;
}
// ── Path helpers ─────────────────────────────────────────────────────────────
const CHAIN_FILE_PATTERN = /^progress-v(\d+)\.json$/;
function chainFilePath(projectRoot, chainVersion) {
    return path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, `progress-${chainVersion}.json`);
}
function activateStatusPath(projectRoot) {
    return path_1.default.join(projectRoot, config_1.ACTIVATE_STATUS_FILE);
}
// ── Discovery ────────────────────────────────────────────────────────────────
// All progress-v<N>.json chain files present on disk, sorted ascending by
// major version. Does not read their contents — pure filename scan.
function listChainVersions(projectRoot) {
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    if (!fs_extra_1.default.existsSync(sigmaDir))
        return [];
    const versions = [];
    for (const filename of fs_extra_1.default.readdirSync(sigmaDir)) {
        const match = filename.match(CHAIN_FILE_PATTERN);
        if (match)
            versions.push(parseInt(match[1], 10));
    }
    return versions.sort((a, b) => a - b).map(n => `v${n}`);
}
// Replaces nextMajorVersion(data.intent.versions) — there is no single array
// left to count; the next chain version comes from what's on disk.
function nextChainVersion(projectRoot) {
    const existing = listChainVersions(projectRoot);
    if (existing.length === 0)
        return 'v1';
    const highest = Math.max(...existing.map(v => parseMajorVersion(v)));
    return `v${highest + 1}`;
}
// ── Manifest (activate_status.json) ─────────────────────────────────────────
function readActivateStatus(projectRoot) {
    const filePath = activateStatusPath(projectRoot);
    if (!fs_extra_1.default.existsSync(filePath)) {
        throw new Error(`No Sigma project found at ${projectRoot}. Run: sigma project start`);
    }
    let raw;
    try {
        raw = fs_extra_1.default.readJsonSync(filePath);
    }
    catch {
        throw new Error(`Failed to parse ${filePath} — file may be corrupted`);
    }
    const d = raw;
    if (!('active_chain' in d) || (d.active_chain !== null && typeof d.active_chain !== 'string')) {
        throw new Error(`${filePath} is malformed — expected { active_chain: string | null }`);
    }
    return { active_chain: d.active_chain };
}
function writeActivateStatus(projectRoot, activeChain) {
    const filePath = activateStatusPath(projectRoot);
    const tmpPath = `${filePath}.tmp`;
    const data = { active_chain: activeChain };
    fs_extra_1.default.writeJsonSync(tmpPath, data, { spaces: 2 });
    fs_extra_1.default.moveSync(tmpPath, filePath, { overwrite: true });
}
// ── Invariant: exactly one ACTIVE chain ─────────────────────────────────────
// PLAN-EVAL-01 §4 / DISCUSSION §12 — if active_chain is missing/invalid
// (points at a chain file that doesn't exist), auto-default to the highest
// chain_version whose intent is not SUPERSEDED, rather than hard-stopping.
// Throws only when there is truly no chain to default to (fresh project,
// before the first `intent new`).
//
// Deliberate extension beyond DISCUSSION §12's literal wording ("kosong" /
// "menunjuk ke chain yang tidak ada"): a stale pointer at an *existing but
// now-SUPERSEDED* chain is treated the same as an invalid one, not returned
// as-is. Reachable case: `intent supersede` on the currently active chain
// never touches activate_status.json (chain-file mutations don't reach into
// the manifest) — without this check, every command would keep resolving to
// a dead chain until someone ran `intent activate` manually, which
// contradicts DISCUSSION "Konsolidasi Lanjutan" bagian 6's "SUPERSEDED kebal
// permanen" being framed as a general property of SUPERSEDED chains, not
// just a constraint on the `activate` command specifically.
function resolveActiveChainVersion(projectRoot) {
    const existing = listChainVersions(projectRoot);
    if (existing.length === 0) {
        throw new Error('No DIR-INTENT exists yet. Run: sigma intent new');
    }
    let status;
    try {
        status = readActivateStatus(projectRoot);
    }
    catch {
        status = { active_chain: null };
    }
    if (status.active_chain && existing.includes(status.active_chain)) {
        const pointed = readChain(projectRoot, status.active_chain);
        if (pointed.intent.state !== 'SUPERSEDED') {
            return status.active_chain;
        }
    }
    // Auto-default: highest chain_version whose intent is not SUPERSEDED.
    // SUPERSEDED chains are permanently ineligible (PLAN-EVAL-01 §2 / DISCUSSION
    // "Konsolidasi Lanjutan" bagian 6) — reading each chain file just to check
    // its intent.state is unavoidable here since eligibility depends on content,
    // not just the filename.
    const sorted = [...existing].sort((a, b) => parseMajorVersion(b) - parseMajorVersion(a));
    for (const version of sorted) {
        const chain = readChain(projectRoot, version);
        if (chain.intent.state !== 'SUPERSEDED')
            return version;
    }
    throw new Error('All existing DIR-INTENT chains are SUPERSEDED — no chain is eligible to become active. ' +
        'Run: sigma intent new');
}
// ── Chain file read/write ───────────────────────────────────────────────────
// Backward compatibility for chain files written before the RATIFIED rename
// (Director directive 2026-08-12): normalizes intent.state "LOCKED"/"INACTIVE"
// (the latter only from very old legacy-migrated files) to "RATIFIED", and
// intent.locked_at to intent.ratified_at. This is the single choke point —
// every chain read goes through readChain(), so no second read path can miss
// it. Records what it changed on chain._migratedOnRead (in-memory only) so
// runDoctorReconciliation() can report the conversion instead of seeing an
// already-normalized chain and reporting nothing (§3.7 of the RATIFIED plan).
// The file on disk itself is only rewritten once something actually calls
// writeChain() — normalization here does not touch disk.
function normalizeIntentStateOnRead(chain) {
    const migrated = [];
    const legacyState = chain.intent.state;
    if (legacyState === 'LOCKED' || legacyState === 'INACTIVE') {
        chain.intent.state = 'RATIFIED';
        migrated.push(`intent.state "${legacyState}" → "RATIFIED"`);
    }
    const legacyLockedAt = chain.intent.locked_at;
    if (legacyLockedAt && !chain.intent.ratified_at) {
        chain.intent.ratified_at = legacyLockedAt;
        migrated.push('intent.locked_at → intent.ratified_at');
    }
    delete chain.intent.locked_at;
    if (migrated.length > 0) {
        chain._migratedOnRead = migrated;
    }
}
function readChain(projectRoot, chainVersion) {
    const filePath = chainFilePath(projectRoot, chainVersion);
    if (!fs_extra_1.default.existsSync(filePath)) {
        throw new Error(`Chain ${chainVersion} not found (no ${filePath} on disk). Run: sigma intent list`);
    }
    let raw;
    try {
        raw = fs_extra_1.default.readJsonSync(filePath);
    }
    catch {
        throw new Error(`Failed to parse ${filePath} — file may be corrupted`);
    }
    // Structural validation only (existence + required top-level shape).
    // Semantic validation equivalent to validateProgressSemantics() is
    // PLAN-EVAL-01 Fase 1 work — not ported here yet.
    const d = raw;
    const required = ['schema_version', 'chain_version', 'intent', 'plan', 'exec', 'gates'];
    for (const field of required) {
        if (!(field in d)) {
            throw new Error(`${filePath} is missing required field: "${field}"`);
        }
    }
    const chain = raw;
    normalizeIntentStateOnRead(chain);
    return chain;
}
function writeChain(projectRoot, chainVersion, data) {
    const filePath = chainFilePath(projectRoot, chainVersion);
    const tmpPath = `${filePath}.tmp`;
    data.updated_at = new Date().toISOString();
    delete data._migratedOnRead; // in-memory only — never persisted
    fs_extra_1.default.writeJsonSync(tmpPath, data, { spaces: 2 });
    fs_extra_1.default.moveSync(tmpPath, filePath, { overwrite: true });
}
// Combined helper — near drop-in replacement for readProgress() at call
// sites that operate on "whatever chain is currently active".
function readActiveChain(projectRoot) {
    const chainVersion = resolveActiveChainVersion(projectRoot);
    return { chainVersion, data: readChain(projectRoot, chainVersion) };
}
// ── Project identity (separate from chain state, PLAN-EVAL-01 §3.3) ────────
function readProjectIdentity(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
    if (!fs_extra_1.default.existsSync(filePath)) {
        throw new Error(`No Sigma project identity found at ${filePath}. Run: sigma project start`);
    }
    return fs_extra_1.default.readJsonSync(filePath);
}
// ── Seed state ───────────────────────────────────────────────────────────────
// Replaces createInitialProgress() for the chain-file world. A ChainState is
// only ever created together with its (DRAFT) intent — see PLAN-EVAL-01 §4:
// `intent new` calls this once, with the artifact path it just wrote, rather
// than creating an empty shell and registering the intent as a second step
// (intent is non-nullable on ChainState, so there is no valid intermediate
// "shell with no intent" state).
function createInitialChain(chainVersion, intentFilePath, title, focus) {
    const now = new Date().toISOString();
    return {
        schema_version: config_1.SCHEMA_VERSION,
        chain_version: chainVersion,
        created_at: now,
        updated_at: now,
        lifecycle_state: 'DESIGN',
        intent: {
            version: chainVersion,
            state: 'DRAFT',
            file: intentFilePath,
            created_at: now,
            updated_at: now,
            ...(title ? { title } : {}),
            ...(focus ? { focus } : {}),
        },
        roadmap: null,
        plan: { active_version: null, active_state: null, versions: [], pending: [] },
        exec: { active_version: null, active_state: null, versions: [] },
        close: null,
        gates: {
            gate_1_open: false,
            gate_2_open: false,
            gate_3_satisfied: false,
        },
        runtime_invalid: {
            markers: [],
            last_doctor_run_at: null,
        },
    };
}
// ── Validation ───────────────────────────────────────────────────────────────
// PLAN-EVAL-01 Fase 1 — adapted from validateProgressSemantics()/validateTracker()
// in progress.ts for the single-object intent/roadmap/close shape. plan/exec
// validation logic is otherwise unchanged (still array trackers).
function schemaVersionParts(version) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match)
        return null;
    return match.slice(1).map(Number);
}
function isNewerSchema(actual, expected) {
    const a = schemaVersionParts(actual);
    const e = schemaVersionParts(expected);
    if (!a || !e)
        return actual !== expected;
    for (let i = 0; i < 3; i += 1) {
        if (a[i] > e[i])
            return true;
        if (a[i] < e[i])
            return false;
    }
    return false;
}
function recoveryHint(chainVersion, field) {
    return (`Recovery: run \`sigma session bootstrap\`, inspect Sigma/progress-${chainVersion}.json field "${field}", ` +
        'then repair by recreating or superseding the affected artifact.');
}
function semanticError(chainVersion, field, message) {
    return new Error(`Invalid progress-${chainVersion}.json state at ${field}: ${message}. ${recoveryHint(chainVersion, field)}`);
}
function validateSingleState(chain, field, value) {
    if (value === null)
        return;
    if (!value.created_at || !value.updated_at) {
        throw semanticError(chain.chain_version, field, 'created_at and updated_at are required');
    }
    // intent uses RATIFIED/ratified_at (Director directive 2026-08-12); roadmap/close keep LOCKED/locked_at.
    if (field === 'intent') {
        if (value.state === 'RATIFIED' && !value.ratified_at) {
            throw semanticError(chain.chain_version, `${field}.ratified_at`, 'RATIFIED entries must include ratified_at');
        }
    }
    else if (value.state === 'LOCKED' && !value.locked_at) {
        throw semanticError(chain.chain_version, `${field}.locked_at`, 'LOCKED entries must include locked_at');
    }
    if (value.state === 'SUPERSEDED' && !value.supersede_reason) {
        throw semanticError(chain.chain_version, field, 'SUPERSEDED entries must include supersede_reason');
    }
}
const PLAN_EXEC_TRACKER_STATES = {
    plan: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
    exec: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
};
function validateTracker(chain, domain) {
    const tracker = chain[domain];
    const field = domain;
    if (typeof tracker !== 'object' || tracker === null) {
        throw semanticError(chain.chain_version, field, 'tracker block is malformed');
    }
    if (!Array.isArray(tracker.versions)) {
        throw semanticError(chain.chain_version, `${field}.versions`, 'versions must be an array');
    }
    if ((tracker.active_version === null) !== (tracker.active_state === null)) {
        throw semanticError(chain.chain_version, field, 'active_version and active_state must either both be set or both be null');
    }
    const seen = new Set();
    for (const v of tracker.versions) {
        if (!v.version)
            throw semanticError(chain.chain_version, `${field}.versions`, 'version entry is missing version');
        if (seen.has(v.version))
            throw semanticError(chain.chain_version, `${field}.versions`, `duplicate version "${v.version}"`);
        seen.add(v.version);
        if (!PLAN_EXEC_TRACKER_STATES[domain].includes(v.state)) {
            throw semanticError(chain.chain_version, `${field}.${v.version}.state`, `invalid state "${v.state}"`);
        }
        if (!v.created_at || !v.updated_at) {
            throw semanticError(chain.chain_version, `${field}.${v.version}`, 'created_at and updated_at are required');
        }
        if (v.state === 'LOCKED' && !v.locked_at) {
            throw semanticError(chain.chain_version, `${field}.${v.version}.locked_at`, 'LOCKED entries must include locked_at');
        }
        if (v.state === 'SUPERSEDED' && !v.supersede_reason) {
            throw semanticError(chain.chain_version, `${field}.${v.version}`, 'SUPERSEDED entries must include supersede_reason');
        }
    }
    if (tracker.active_version) {
        const matches = tracker.versions.filter(v => v.version === tracker.active_version);
        if (matches.length !== 1) {
            throw semanticError(chain.chain_version, `${field}.active_version`, `active version "${tracker.active_version}" is not present exactly once`);
        }
        if (matches[0].state !== tracker.active_state) {
            throw semanticError(chain.chain_version, `${field}.active_state`, `active_state "${tracker.active_state}" does not match active entry state "${matches[0].state}"`);
        }
    }
    else if (tracker.versions.some(v => v.state !== 'SUPERSEDED')) {
        throw semanticError(chain.chain_version, field, 'inactive tracker contains non-superseded versions');
    }
}
function hasRatifiedIntent(chain) {
    return chain.intent.state === 'RATIFIED';
}
function hasActiveLockedPlan(chain) {
    return chain.plan.versions.some(v => v.state === 'LOCKED');
}
// PLAN-EVAL-01 §3.2 — plan.intent_version_ref is always the chain's own
// intent.version now (there is nothing else in this file it could point
// to); kept as a written field for defensive validation, not because it can
// vary.
function hasCleanGate2Chain(chain) {
    return chain.intent.state === 'RATIFIED' && chain.plan.versions.some(v => v.state === 'LOCKED' && v.intent_version_ref === chain.intent.version);
}
function hasCleanGate3Chain(chain) {
    const activeExec = chain.exec.versions.find(v => v.version === chain.exec.active_version && v.state === 'LOCKED');
    if (!activeExec?.plan_version_ref)
        return false;
    const referencedPlan = chain.plan.versions.find(v => v.version === activeExec.plan_version_ref && v.state === 'LOCKED');
    if (!referencedPlan)
        return false;
    return chain.intent.state === 'RATIFIED' && referencedPlan.intent_version_ref === chain.intent.version;
}
function validateChainSemantics(chain) {
    if (chain.schema_version !== config_1.SCHEMA_VERSION && isNewerSchema(chain.schema_version, config_1.SCHEMA_VERSION)) {
        throw semanticError(chain.chain_version, 'schema_version', `schema_version "${chain.schema_version}" is newer than supported "${config_1.SCHEMA_VERSION}"`);
    }
    if (chain.intent.version !== chain.chain_version) {
        throw semanticError(chain.chain_version, 'intent.version', `must equal chain_version "${chain.chain_version}"`);
    }
    validateSingleState(chain, 'intent', chain.intent);
    validateSingleState(chain, 'roadmap', chain.roadmap);
    validateSingleState(chain, 'close', chain.close);
    validateTracker(chain, 'plan');
    validateTracker(chain, 'exec');
    for (const v of chain.plan.versions) {
        if (v.intent_version_ref && v.intent_version_ref !== chain.intent.version) {
            throw semanticError(chain.chain_version, 'plan.intent_version_ref', `PLAN ${v.version} references INTENT ${v.intent_version_ref}, but this chain's INTENT is ${chain.intent.version}`);
        }
    }
    const planVersions = new Set(chain.plan.versions.map(v => v.version));
    for (const v of chain.exec.versions) {
        if (v.plan_version_ref && !planVersions.has(v.plan_version_ref)) {
            throw semanticError(chain.chain_version, 'exec.plan_version_ref', `EXEC ${v.version} references missing PLAN ${v.plan_version_ref}`);
        }
    }
    if (chain.gates.gate_1_open && !hasRatifiedIntent(chain)) {
        throw semanticError(chain.chain_version, 'gates.gate_1_open', 'gate is open without a RATIFIED INTENT');
    }
    if (chain.gates.gate_2_open && !hasActiveLockedPlan(chain)) {
        throw semanticError(chain.chain_version, 'gates.gate_2_open', 'gate is open without a LOCKED PLAN');
    }
    if (chain.gates.gate_3_satisfied && !hasCleanGate3Chain(chain)) {
        throw semanticError(chain.chain_version, 'gates.gate_3_satisfied', 'gate is satisfied without a clean INTENT -> PLAN -> EXEC chain');
    }
}
// ── Invalid Runtime / Gate Queries ──────────────────────────────────────────
// Unchanged in spirit from progress.ts — operates on `gates` +
// `runtime_invalid`, neither of which changed shape.
function ensureRuntimeInvalid(chain) {
    if (!chain.runtime_invalid || !Array.isArray(chain.runtime_invalid.markers)) {
        chain.runtime_invalid = { markers: [], last_doctor_run_at: null };
    }
    return chain.runtime_invalid;
}
function hasInvalidRuntime(chain) {
    return ensureRuntimeInvalid(chain).markers.length > 0;
}
function getInvalidMarkers(chain) {
    return ensureRuntimeInvalid(chain).markers;
}
function isGateInvalid(chain, gate) {
    const markers = getInvalidMarkers(chain);
    if (markers.some(marker => marker.gate === gate))
        return true;
    const impactedDomains = {
        gate_1_open: ['intent', 'gates'],
        gate_2_open: ['intent', 'plan', 'gates'],
        gate_3_satisfied: ['intent', 'plan', 'exec', 'gates'],
    };
    return markers.some(marker => impactedDomains[gate].includes(marker.domain));
}
function getGateStatusLabel(chain, gate) {
    if (isGateInvalid(chain, gate))
        return 'INVALID';
    if (gate === 'gate_3_satisfied')
        return chain.gates.gate_3_satisfied ? 'SATISFIED' : 'BLOCKED';
    return chain.gates[gate] ? 'OPEN' : 'BLOCKED';
}
function getOperationalGate(chain, gate) {
    return chain.gates[gate] || isGateInvalid(chain, gate);
}
function getInvalidWarningLines(chain) {
    return getInvalidMarkers(chain).map(marker => {
        const scope = [
            marker.chain.intent_version ? `INTENT ${marker.chain.intent_version}` : null,
            marker.chain.plan_version ? `PLAN ${marker.chain.plan_version}` : null,
            marker.chain.exec_version ? `EXEC ${marker.chain.exec_version}` : null,
        ].filter(Boolean).join(' -> ');
        const scopeLabel = scope.length > 0 ? ` (${scope})` : '';
        return `${marker.domain.toUpperCase()}${scopeLabel}: ${marker.reason}`;
    });
}
function assertChainCanMutate(chain) {
    if (hasInvalidRuntime(chain)) {
        process.stderr.write(`WARNING: Sigma runtime is in INVALID recovery mode for chain ${chain.chain_version}. ` +
            'Normal gate enforcement is temporarily relaxed. Run `sigma doctor` to re-check recovery.\n');
        return;
    }
    validateChainSemantics(chain);
}
function getGateStatus(chain) {
    return {
        gate_1_open: chain.gates.gate_1_open,
        gate_2_open: chain.gates.gate_2_open,
        gate_3_satisfied: chain.gates.gate_3_satisfied,
    };
}
function markerChain(intentVersion = null, planVersion = null, execVersion = null) {
    return { intent_version: intentVersion, plan_version: planVersion, exec_version: execVersion };
}
function buildMarker(existing, now, partial) {
    const prev = existing.get(partial.id);
    return {
        ...partial,
        status: 'INVALID',
        first_detected_at: prev?.first_detected_at ?? now,
        last_detected_at: now,
    };
}
function runDoctorReconciliation(chain, overrides = []) {
    const runtimeInvalid = ensureRuntimeInvalid(chain);
    const previous = new Map(runtimeInvalid.markers.map(marker => [marker.id, marker]));
    const nextMarkers = [];
    const repaired = [];
    const now = new Date().toISOString();
    // Migrate the RATIFIED rename (Director directive 2026-08-12) from
    // in-memory-only to persisted-on-disk. readChain() already normalized
    // intent.state/locked_at before this function ever saw the chain, so
    // there is nothing left here to detect from chain.intent itself — instead
    // we read what readChain() recorded on _migratedOnRead and turn it into a
    // repaired[] line, so `doctor` actually reports the conversion instead of
    // silently writing an already-normalized chain and claiming nothing changed.
    if (chain._migratedOnRead && chain._migratedOnRead.length > 0) {
        for (const change of chain._migratedOnRead) {
            repaired.push(`Migrated to RATIFIED schema: ${change}`);
        }
    }
    // Bump schema_version forward only — never downgrades a chain written by a
    // newer binary (isNewerSchema() guard mirrors validateChainSemantics()).
    if (chain.schema_version !== config_1.SCHEMA_VERSION && !isNewerSchema(chain.schema_version, config_1.SCHEMA_VERSION)) {
        repaired.push(`schema_version migrated "${chain.schema_version}" → "${config_1.SCHEMA_VERSION}"`);
        chain.schema_version = config_1.SCHEMA_VERSION;
    }
    // Auto-repair the known exec-new corruption pattern: a LOCKED exec and a
    // later DRAFT exec share the same version key. Unchanged from progress.ts.
    const execVersionsByKey = new Map();
    for (const version of chain.exec.versions) {
        const versions = execVersionsByKey.get(version.version) ?? [];
        versions.push(version);
        execVersionsByKey.set(version.version, versions);
    }
    for (const [version, versions] of execVersionsByKey) {
        if (versions.some(v => v.state === 'LOCKED') && versions.some(v => v.state === 'DRAFT')) {
            const before = chain.exec.versions.length;
            chain.exec.versions = chain.exec.versions.filter(v => !(v.version === version && v.state === 'DRAFT'));
            const removed = before - chain.exec.versions.length;
            if (removed > 0) {
                repaired.push(`exec.versions removed ${removed} duplicate DRAFT entr${removed === 1 ? 'y' : 'ies'} for "${version}" because a LOCKED entry exists`);
                if (chain.exec.active_version === version) {
                    chain.exec.active_state = 'LOCKED';
                }
            }
        }
    }
    // Auto-repair tracker active_state mismatches — plan/exec only now.
    for (const domain of ['plan', 'exec']) {
        const tracker = chain[domain];
        if (!tracker.active_version)
            continue;
        const matches = tracker.versions.filter(v => v.version === tracker.active_version);
        if (matches.length === 1 && matches[0].state !== tracker.active_state) {
            repaired.push(`${domain}.active_state repaired from "${tracker.active_state}" to "${matches[0].state}"`);
            tracker.active_state = matches[0].state;
        }
    }
    // Auto-repair gate booleans to match actual runtime conditions, unless a
    // still-active override is the reason the gate is forced open.
    const hasActiveOverrideForGate = (gateLabel) => overrides.some(entry => {
        if (entry.gate_bypassed !== gateLabel)
            return false;
        if (entry.artifact === 'DIR-INTENT') {
            return entry.version ? entry.version === chain.intent.version && chain.intent.state === 'DRAFT' : chain.intent.state === 'DRAFT';
        }
        if (entry.artifact === 'FMN-PLAN' || entry.artifact === 'DEV-EXEC') {
            const domain = entry.artifact === 'FMN-PLAN' ? chain.plan : chain.exec;
            if (entry.version) {
                const v = domain.versions.find(x => x.version === entry.version);
                return !!v && v.state === 'DRAFT';
            }
            return !domain.versions.some(v => v.state !== 'DRAFT');
        }
        return false;
    });
    const expectedGate1 = hasRatifiedIntent(chain) || hasActiveOverrideForGate('Gate 1');
    if (chain.gates.gate_1_open !== expectedGate1) {
        repaired.push(`gates.gate_1_open repaired from "${chain.gates.gate_1_open}" to "${expectedGate1}"`);
        chain.gates.gate_1_open = expectedGate1;
    }
    const expectedGate2 = hasCleanGate2Chain(chain) || hasActiveOverrideForGate('Gate 2');
    if (chain.gates.gate_2_open !== expectedGate2) {
        repaired.push(`gates.gate_2_open repaired from "${chain.gates.gate_2_open}" to "${expectedGate2}"`);
        chain.gates.gate_2_open = expectedGate2;
    }
    const expectedGate3 = hasCleanGate3Chain(chain) || hasActiveOverrideForGate('Gate 3');
    if (chain.gates.gate_3_satisfied !== expectedGate3) {
        repaired.push(`gates.gate_3_satisfied repaired from "${chain.gates.gate_3_satisfied}" to "${expectedGate3}"`);
        chain.gates.gate_3_satisfied = expectedGate3;
    }
    // active-pair consistency markers — plan/exec only now (see header note).
    for (const domain of ['plan', 'exec']) {
        const tracker = chain[domain];
        const gateKey = domain === 'plan' ? 'gate_2_open' : 'gate_3_satisfied';
        if ((tracker.active_version === null) !== (tracker.active_state === null)) {
            nextMarkers.push(buildMarker(previous, now, {
                id: `${domain}:active-pair`,
                domain,
                reason: 'active_version and active_state are not paired consistently',
                gate: gateKey,
                chain: markerChain(null, domain === 'plan' ? tracker.active_version : null, domain === 'exec' ? tracker.active_version : null),
            }));
        }
        if (tracker.active_version) {
            const matches = tracker.versions.filter(v => v.version === tracker.active_version);
            if (matches.length !== 1) {
                nextMarkers.push(buildMarker(previous, now, {
                    id: `${domain}:active-version:${tracker.active_version}`,
                    domain,
                    reason: `active version "${tracker.active_version}" is not present exactly once`,
                    gate: gateKey,
                    chain: markerChain(null, domain === 'plan' ? tracker.active_version : null, domain === 'exec' ? tracker.active_version : null),
                }));
            }
        }
        else if (tracker.versions.some(v => v.state !== 'SUPERSEDED')) {
            nextMarkers.push(buildMarker(previous, now, {
                id: `${domain}:inactive-live-versions`,
                domain,
                reason: 'tracker has no active version while non-superseded versions still exist',
                gate: gateKey,
                chain: markerChain(),
            }));
        }
    }
    for (const version of chain.plan.versions) {
        if (version.intent_version_ref && version.intent_version_ref !== chain.intent.version) {
            nextMarkers.push(buildMarker(previous, now, {
                id: `plan-ref:${version.version}:${version.intent_version_ref}`,
                domain: 'plan',
                reason: `PLAN ${version.version} references INTENT ${version.intent_version_ref}, but this chain's INTENT is ${chain.intent.version}`,
                gate: 'gate_2_open',
                chain: markerChain(version.intent_version_ref, version.version, null),
            }));
        }
    }
    const planVersions = new Set(chain.plan.versions.map(v => v.version));
    for (const version of chain.exec.versions) {
        if (version.plan_version_ref && !planVersions.has(version.plan_version_ref)) {
            nextMarkers.push(buildMarker(previous, now, {
                id: `exec-ref:${version.version}:${version.plan_version_ref}`,
                domain: 'exec',
                reason: `EXEC ${version.version} references missing PLAN ${version.plan_version_ref}`,
                gate: 'gate_3_satisfied',
                chain: markerChain(null, version.plan_version_ref, version.version),
            }));
        }
    }
    runtimeInvalid.markers = nextMarkers;
    runtimeInvalid.last_doctor_run_at = now;
    const nextIds = new Set(nextMarkers.map(marker => marker.id));
    const invalidMarked = nextMarkers.filter(marker => !previous.has(marker.id));
    const invalidCleared = [...previous.values()].filter(marker => !nextIds.has(marker.id));
    return { repaired, invalidMarked, invalidCleared, remainingInvalid: nextMarkers };
}
// ── Chain/Plan/Exec Version Helpers ─────────────────────────────────────────
// PLAN-EVAL-01 §5 — unchanged logic, retyped for ChainState.
// parseMajorVersion/parseMinorVersion themselves live near the top of this
// file (relocated from progress.ts, PLAN-EVAL-05) — they never touched
// ProgressJson/ChainState shape at all.
// PLAN major = INTENT major − 1; minor starts at 1
function nextPlanVersion(chain, intentVersionRef) {
    const planMajor = parseMajorVersion(intentVersionRef) - 1;
    const existingUnderMajor = chain.plan.versions.filter(v => parseMajorVersion(v.version) === planMajor);
    return `v${planMajor}.${existingUnderMajor.length + 1}`;
}
// EXEC major must equal PLAN major; minor starts at 1
function nextExecVersion(chain, planVersionRef) {
    const execMajor = parseMajorVersion(planVersionRef);
    const highestExecMinor = chain.exec.versions
        .filter(v => parseMajorVersion(v.version) === execMajor)
        .reduce((highest, v) => Math.max(highest, parseMinorVersion(v.version)), 0);
    const planMinorFloor = parseMinorVersion(planVersionRef) - 1;
    const nextMinor = Math.max(highestExecMinor, planMinorFloor, 0) + 1;
    return `v${execMajor}.${nextMinor}`;
}
// ── INTENT Mutations ──────────────────────────────────────────────────────────
// No registerIntentDraft() here — unlike progress.ts, a ChainState is only
// ever created together with its (DRAFT) intent (see createInitialChain()
// above). There is no valid scenario for adding an intent draft to an
// already-existing chain, so that step of the old two-step
// (createInitialProgress + registerIntentDraft) collapses into one.
function ratifyIntent(chain) {
    const now = new Date().toISOString();
    if (chain.intent.state !== 'DRAFT') {
        throw new Error(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; ratify requires DRAFT`);
    }
    chain.intent.state = 'RATIFIED';
    chain.intent.ratified_at = now;
    chain.intent.updated_at = now;
    chain.gates.gate_1_open = true;
    chain.lifecycle_state = 'BUILD';
    // Recompute from this chain's own PLAN/EXEC — matches ratifyIntent()'s
    // reopen/pivot behavior in progress.ts, minus the INACTIVE-demotion loop
    // (PLAN-EVAL-01 §3.4 — nothing else in this file to demote).
    chain.gates.gate_2_open = hasCleanGate2Chain(chain);
    chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}
// ── ARC Satisfaction Score (Gate 3.5, closure-authority PLAN-EVAL-02) ──────
// Scale is tiered, not additive: 0-50 is output satisfaction (must be full
// to cross 50 at all), 50-100 is process satisfaction layered strictly on
// top of a complete output — see ARC-RULE.md §ARC Satisfaction Score
// Methodology for the full rationale. Band, not the raw number, is the
// primary signal shown to Director/FMN (mitigates false precision +
// Goodhart's Law — rationale in closure-authority-and-arc-scoring-proposal-20260720.md
// §4, retrievable via git history, not a live path).
function arcScoreBand(score) {
    if (score < 50)
        return 'OUTPUT_INCOMPLETE';
    if (score < 80)
        return 'SATISFIED_NEEDS_REVIEW';
    return 'SATISFIED_RECOMMENDED';
}
// Gate 3.5 pre-condition for `sigma close new` — does not gate `close lock`.
function hasGate35Score(chain) {
    return (chain.intent.arc_score ?? -1) >= 50;
}
function recordArcScore(chain, score, notes) {
    if (!Number.isInteger(score) || score < 0 || score > 100) {
        throw new Error('ARC score must be an integer between 0 and 100');
    }
    if (/[|\n\r]/.test(notes)) {
        throw new Error('--notes cannot contain "|" or a newline (breaks the intent-history.md table and its recovery parser)');
    }
    if (chain.intent.state !== 'RATIFIED') {
        throw new Error('ARC score can only be recorded against a RATIFIED DIR-INTENT');
    }
    chain.intent.arc_score = score;
    chain.intent.arc_score_notes = notes;
    chain.intent.arc_score_updated_at = new Date().toISOString();
    chain.updated_at = chain.intent.arc_score_updated_at;
}
// Read-only preflight for `sigma intent supersede` — mirrors
// previewIntentSupersedeCascade() in progress.ts. No `version` parameter:
// there is only ever one intent in a chain file, so "which version" is
// always this chain's own.
function previewIntentSupersedeCascade(chain) {
    return {
        roadmap: chain.roadmap && chain.roadmap.state !== 'SUPERSEDED' ? chain.roadmap : null,
        plan: chain.plan.versions.filter(v => v.state !== 'SUPERSEDED'),
        exec: chain.exec.versions.filter(v => v.state !== 'SUPERSEDED'),
        close: chain.close && chain.close.state !== 'SUPERSEDED' ? chain.close : null,
    };
}
function supersedeIntentVersion(chain, reason) {
    const now = new Date().toISOString();
    if (chain.intent.state !== 'RATIFIED') {
        throw new Error(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; supersede requires RATIFIED`);
    }
    const cascade = previewIntentSupersedeCascade(chain);
    chain.intent.state = 'SUPERSEDED';
    chain.intent.supersede_reason = reason;
    chain.intent.updated_at = now;
    const cascadeReason = `Cascade: DIR-INTENT ${chain.intent.version} superseded — ${reason}`;
    if (cascade.roadmap) {
        chain.roadmap.state = 'SUPERSEDED';
        chain.roadmap.supersede_reason = cascadeReason;
        chain.roadmap.updated_at = now;
    }
    for (const pv of cascade.plan) {
        pv.state = 'SUPERSEDED';
        pv.supersede_reason = cascadeReason;
        pv.updated_at = now;
        if (chain.plan.active_version === pv.version)
            chain.plan.active_state = 'SUPERSEDED';
    }
    for (const ev of cascade.exec) {
        ev.state = 'SUPERSEDED';
        ev.supersede_reason = cascadeReason;
        ev.updated_at = now;
        if (chain.exec.active_version === ev.version)
            chain.exec.active_state = 'SUPERSEDED';
    }
    if (cascade.close) {
        chain.close.state = 'SUPERSEDED';
        chain.close.supersede_reason = cascadeReason;
        chain.close.updated_at = now;
    }
}
// ── ROADMAP Mutations ─────────────────────────────────────────────────────────
// No activateRoadmap() — PLAN-EVAL-01 §3.5: removed, there is never a second
// DRAFT roadmap in the same chain to activate. `roadmap lock` stays a
// separate manual command, unchanged in spirit from today (PLAN-EVAL-04
// owns any future auto-cascade-on-close behavior — not implemented here).
function registerRoadmapDraft(chain, filePath) {
    if (chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED') {
        throw new Error(`ROADMAP already exists for this chain (${chain.roadmap.version}, ${chain.roadmap.state}). ` +
            'To create a new roadmap, create a new INTENT (chain) first.');
    }
    const now = new Date().toISOString();
    chain.roadmap = {
        version: chain.chain_version, state: 'DRAFT', file: filePath,
        created_at: now, updated_at: now,
    };
}
function lockActiveRoadmap(chain) {
    if (!chain.roadmap)
        throw new Error('No ROADMAP found. Run: sigma roadmap new');
    if (chain.roadmap.state !== 'DRAFT') {
        throw new Error(`ROADMAP ${chain.roadmap.version} is in state "${chain.roadmap.state}"; lock requires DRAFT`);
    }
    const now = new Date().toISOString();
    chain.roadmap.state = 'LOCKED';
    chain.roadmap.locked_at = now;
    chain.roadmap.updated_at = now;
}
// ── PLAN Mutations ────────────────────────────────────────────────────────────
// Unchanged logic from progress.ts — plan stays an array tracker, retyped
// for ChainState.
function registerPlanDraft(chain, version, filePath, intentVersionRef, title, focus) {
    const planMajor = parseMajorVersion(version);
    const expectedPlanMajor = parseMajorVersion(intentVersionRef) - 1;
    if (planMajor !== expectedPlanMajor) {
        throw new Error(`Version sync error: FMN-PLAN ${version} (major ${planMajor}) is not valid under DIR-INTENT ${intentVersionRef}. ` +
            `Expected PLAN major: ${expectedPlanMajor} (INTENT major ${parseMajorVersion(intentVersionRef)} − 1). ` +
            `Valid PLAN versions: v${expectedPlanMajor}.1, v${expectedPlanMajor}.2, ...`);
    }
    const now = new Date().toISOString();
    const entry = {
        version, state: 'DRAFT', file: filePath,
        created_at: now, updated_at: now,
        intent_version_ref: intentVersionRef,
    };
    if (title)
        entry.title = title;
    if (focus)
        entry.focus = focus;
    chain.plan.versions.push(entry);
    chain.plan.active_version = version;
    chain.plan.active_state = 'DRAFT';
}
function updatePlanMetadata(chain, version, title, focus) {
    const entry = chain.plan.versions.find(v => v.version === version);
    if (!entry)
        throw new Error(`FMN-PLAN ${version} not found. Run: sigma plan list`);
    if (title !== undefined)
        entry.title = title;
    if (focus !== undefined)
        entry.focus = focus;
    entry.updated_at = new Date().toISOString();
}
function lockOldestPlanDraft(chain) {
    const drafts = chain.plan.versions
        .filter(v => v.state === 'DRAFT')
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (drafts.length === 0)
        throw new Error('No DRAFT FMN-PLAN to lock. Run: sigma plan new');
    const oldest = drafts[0];
    const now = new Date().toISOString();
    oldest.state = 'LOCKED';
    oldest.locked_at = now;
    oldest.updated_at = now;
    chain.plan.active_version = oldest.version;
    chain.plan.active_state = 'LOCKED';
    chain.gates.gate_2_open = true;
    return oldest.version;
}
function registerPendingPlan(chain, id, filePath, title, focus) {
    const now = new Date().toISOString();
    const entry = { id, file: filePath, created_at: now };
    if (title)
        entry.title = title;
    if (focus)
        entry.focus = focus;
    chain.plan.pending.push(entry);
}
function promotePendingPlan(chain, id, version, newFilePath, intentVersionRef, title, focus) {
    const idx = chain.plan.pending.findIndex(p => p.id === id);
    if (idx === -1)
        throw new Error(`Pending plan ID "${id}" not found`);
    const pending = chain.plan.pending[idx];
    chain.plan.pending.splice(idx, 1);
    const now = new Date().toISOString();
    const entry = {
        version, state: 'DRAFT', file: newFilePath,
        created_at: pending.created_at,
        updated_at: now,
        intent_version_ref: intentVersionRef,
    };
    entry.title = title ?? pending.title;
    entry.focus = focus ?? pending.focus;
    chain.plan.versions.push(entry);
    chain.plan.active_version = version;
    chain.plan.active_state = 'DRAFT';
}
function supersedePlanVersion(chain, version, reason) {
    const now = new Date().toISOString();
    const target = chain.plan.versions.find(v => v.version === version);
    if (!target)
        throw new Error(`PLAN version ${version} not found`);
    if (target.state !== 'LOCKED')
        throw new Error(`PLAN ${version} is not LOCKED; cannot supersede`);
    target.state = 'SUPERSEDED';
    target.supersede_reason = reason;
    target.updated_at = now;
    if (chain.plan.active_version === version) {
        chain.plan.active_state = 'SUPERSEDED';
    }
    const cascadeReason = `Cascade: FMN-PLAN ${version} superseded — ${reason}`;
    for (const exec of chain.exec.versions) {
        if (exec.plan_version_ref === version && exec.state !== 'SUPERSEDED') {
            exec.state = 'SUPERSEDED';
            exec.supersede_reason = cascadeReason;
            exec.updated_at = now;
            if (chain.exec.active_version === exec.version) {
                chain.exec.active_state = 'SUPERSEDED';
            }
        }
    }
}
function activatePlanDraft(chain, version) {
    const target = chain.plan.versions.find(v => v.version === version);
    if (!target)
        throw new Error(`PLAN version ${version} not found`);
    if (target.state !== 'DRAFT') {
        throw new Error(`PLAN ${version} is in state "${target.state}"; activate requires a DRAFT version. ` +
            `Use 'sigma plan supersede' to supersede a LOCKED version instead.`);
    }
    chain.plan.active_version = version;
    chain.plan.active_state = 'DRAFT';
}
// ── EXEC Mutations ────────────────────────────────────────────────────────────
// Unchanged logic from progress.ts — exec stays an array tracker, retyped
// for ChainState.
function registerExecDraft(chain, version, filePath, planVersionRef) {
    const execMajor = parseMajorVersion(version);
    const planMajor = parseMajorVersion(planVersionRef);
    if (chain.exec.versions.some(v => v.version === version)) {
        throw new Error(`Duplicate DEV-EXEC version "${version}" already exists in progress-${chain.chain_version}.json`);
    }
    if (execMajor !== planMajor) {
        throw new Error(`Version sync error: DEV-EXEC ${version} (major ${execMajor}) does not match FMN-PLAN ${planVersionRef} (major ${planMajor}). ` +
            `EXEC major must equal PLAN major. Valid EXEC versions: v${planMajor}.1, v${planMajor}.2, ...`);
    }
    const now = new Date().toISOString();
    chain.exec.versions.push({
        version, state: 'DRAFT', file: filePath,
        created_at: now, updated_at: now,
        plan_version_ref: planVersionRef,
    });
    chain.exec.active_version = version;
    chain.exec.active_state = 'DRAFT';
    chain.gates.gate_3_satisfied = false;
}
function lockActiveExec(chain) {
    const now = new Date().toISOString();
    const activeVersion = chain.exec.active_version;
    if (!activeVersion)
        throw new Error('No active EXEC version to lock');
    const active = chain.exec.versions.find(v => v.version === activeVersion);
    if (!active)
        throw new Error(`EXEC version ${activeVersion} not found`);
    active.state = 'LOCKED';
    active.locked_at = now;
    active.updated_at = now;
    chain.exec.active_state = 'LOCKED';
    chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}
// ── CLOSE Mutations ───────────────────────────────────────────────────────────
function registerCloseDraft(chain, filePath) {
    // 1:1 guard, mirroring registerRoadmapDraft() above.
    if (chain.close !== null && chain.close.state !== 'SUPERSEDED') {
        throw new Error(`DIR-CLOSE already exists for this chain (${chain.close.version}, ${chain.close.state}). ` +
            'Resolve or lock the existing DIR-CLOSE first.');
    }
    const now = new Date().toISOString();
    chain.close = {
        version: chain.chain_version, state: 'DRAFT', file: filePath,
        created_at: now, updated_at: now,
    };
    chain.lifecycle_state = 'CLOSE';
}
function lockActiveClose(chain) {
    if (!chain.close)
        throw new Error('No CLOSE draft found. Run: sigma close new');
    if (chain.close.state !== 'DRAFT') {
        throw new Error(`CLOSE ${chain.close.version} is in state "${chain.close.state}"; lock requires DRAFT`);
    }
    const now = new Date().toISOString();
    chain.close.state = 'LOCKED';
    chain.close.locked_at = now;
    chain.close.updated_at = now;
    chain.lifecycle_state = 'CLOSED';
}
// ── Next Valid Operations ────────────────────────────────────────────────────
// Adapted from getNextValidOperations() in progress.ts — roadmap ACTIVE/DRAFT
// arbitration collapses to "exists and not SUPERSEDED" (PLAN-EVAL-01 §3.5);
// no more `roadmap activate` suggestion (command removed).
function getNextValidOperations(chain) {
    const ops = [];
    const intentRatified = chain.intent.state === 'RATIFIED';
    const planLocked = chain.plan.active_state === 'LOCKED';
    const roadmapExists = chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED';
    if (chain.intent.state === 'DRAFT') {
        ops.push('intent ratify');
    }
    if (intentRatified && !roadmapExists) {
        ops.push('roadmap new');
    }
    if (intentRatified && roadmapExists) {
        ops.push('plan new');
    }
    const draftPlans = chain.plan.versions.filter(v => v.state === 'DRAFT');
    if (draftPlans.length > 0) {
        const oldest = draftPlans.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
        ops.push(`plan lock    # will lock ${oldest.version} (oldest DRAFT)`);
    }
    if (chain.plan.pending.length > 0) {
        ops.push('plan queue');
    }
    if (planLocked) {
        ops.push('exec new');
    }
    if (chain.lifecycle_state === 'BUILD' && chain.gates.gate_3_satisfied) {
        ops.push('close new');
    }
    if (chain.close?.state === 'DRAFT') {
        ops.push('close lock');
    }
    ops.push('session bootstrap');
    ops.push('project status');
    return ops;
}
//# sourceMappingURL=chain.js.map