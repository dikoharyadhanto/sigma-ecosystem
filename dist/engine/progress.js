"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProgress = validateProgress;
exports.readProgress = readProgress;
exports.writeProgress = writeProgress;
exports.checkSchemaVersion = checkSchemaVersion;
exports.createInitialProgress = createInitialProgress;
exports.getGateStatus = getGateStatus;
exports.isStaleIntentPresent = isStaleIntentPresent;
exports.nextMajorVersion = nextMajorVersion;
exports.nextExecVersion = nextExecVersion;
exports.registerIntentDraft = registerIntentDraft;
exports.lockActiveIntent = lockActiveIntent;
exports.registerPlanDraft = registerPlanDraft;
exports.lockActivePlan = lockActivePlan;
exports.supersedePlanVersion = supersedePlanVersion;
exports.registerExecDraft = registerExecDraft;
exports.advanceExecState = advanceExecState;
exports.lockActiveExec = lockActiveExec;
exports.supersedeExecVersion = supersedeExecVersion;
exports.registerCloseDraft = registerCloseDraft;
exports.lockActiveClose = lockActiveClose;
exports.registerRoadmapDraft = registerRoadmapDraft;
exports.lockActiveRoadmap = lockActiveRoadmap;
exports.registerCsoEntry = registerCsoEntry;
exports.getNextValidOperations = getNextValidOperations;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
// ── Validation ───────────────────────────────────────────────────────────────
function validateProgress(data) {
    if (typeof data !== 'object' || data === null) {
        throw new Error('progress.json is not a valid JSON object');
    }
    const d = data;
    const required = [
        'schema_version', 'project_id', 'project_name', 'lifecycle_state',
        'created_at', 'updated_at', 'intent', 'plan', 'exec', 'close',
        'roadmap', 'gates', 'cso',
    ];
    for (const field of required) {
        if (!(field in d)) {
            throw new Error(`progress.json is missing required field: "${field}"`);
        }
    }
    const validLifecycleStates = ['DESIGN', 'BUILD', 'CLOSE', 'CLOSED'];
    if (!validLifecycleStates.includes(d.lifecycle_state)) {
        throw new Error(`progress.json has invalid lifecycle_state: "${d.lifecycle_state}"`);
    }
    const gates = d.gates;
    if (typeof gates.gate_1_open !== 'boolean' ||
        typeof gates.gate_2_open !== 'boolean' ||
        typeof gates.gate_3_satisfied !== 'boolean') {
        throw new Error('progress.json gates block is malformed');
    }
    if (!Array.isArray(d.cso)) {
        throw new Error('progress.json cso must be an array');
    }
    return data;
}
// ── Read / Write ─────────────────────────────────────────────────────────────
function readProgress(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.PROGRESS_FILE);
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
    const data = validateProgress(raw);
    checkSchemaVersion(data);
    return data;
}
function writeProgress(projectRoot, data) {
    const filePath = path_1.default.join(projectRoot, config_1.PROGRESS_FILE);
    const tmpPath = filePath + '.tmp';
    data.updated_at = new Date().toISOString();
    fs_extra_1.default.writeJsonSync(tmpPath, data, { spaces: 2 });
    fs_extra_1.default.moveSync(tmpPath, filePath, { overwrite: true });
}
// ── Schema Version ────────────────────────────────────────────────────────────
function checkSchemaVersion(data) {
    if (data.schema_version !== config_1.SCHEMA_VERSION) {
        process.stderr.write(`Warning: progress.json schema_version is "${data.schema_version}", ` +
            `CLI expects "${config_1.SCHEMA_VERSION}". Some operations may behave unexpectedly.\n`);
    }
}
// ── Seed State ────────────────────────────────────────────────────────────────
function createInitialProgress(projectId, projectName) {
    const now = new Date().toISOString();
    const emptyTracker = {
        active_version: null,
        active_state: null,
        versions: [],
    };
    return {
        schema_version: config_1.SCHEMA_VERSION,
        project_id: projectId,
        project_name: projectName,
        lifecycle_state: 'DESIGN',
        created_at: now,
        updated_at: now,
        intent: { ...emptyTracker },
        plan: { ...emptyTracker },
        exec: { ...emptyTracker },
        close: { ...emptyTracker },
        roadmap: { ...emptyTracker },
        gates: {
            gate_1_open: false,
            gate_2_open: false,
            gate_3_satisfied: false,
        },
        cso: [],
    };
}
// ── Gate & State Queries ──────────────────────────────────────────────────────
function getGateStatus(data) {
    return {
        gate_1_open: data.gates.gate_1_open,
        gate_2_open: data.gates.gate_2_open,
        gate_3_satisfied: data.gates.gate_3_satisfied,
    };
}
function isStaleIntentPresent(data) {
    const warnings = [];
    for (const domain of ['plan', 'exec']) {
        for (const v of data[domain].versions) {
            if (v.stale_intent) {
                warnings.push({ domain, version: v.version });
            }
        }
    }
    return warnings;
}
// ── Version Helpers ───────────────────────────────────────────────────────────
function nextMajorVersion(versions) {
    return `v${versions.length + 1}`;
}
function nextExecVersion(versions) {
    return `v0.${versions.length + 1}`;
}
// ── INTENT Mutations ──────────────────────────────────────────────────────────
function registerIntentDraft(data, version, filePath) {
    const now = new Date().toISOString();
    data.intent.versions.push({ version, state: 'DRAFT', file: filePath, created_at: now, updated_at: now });
    data.intent.active_version = version;
    data.intent.active_state = 'DRAFT';
}
function propagateStaleIntent(data, newLockedVersion) {
    const now = new Date().toISOString();
    const stalePlanVersions = new Set();
    for (const pv of data.plan.versions) {
        if (pv.intent_version_ref && pv.intent_version_ref !== newLockedVersion) {
            pv.stale_intent = true;
            pv.updated_at = now;
            stalePlanVersions.add(pv.version);
        }
    }
    for (const ev of data.exec.versions) {
        if (ev.plan_version_ref && stalePlanVersions.has(ev.plan_version_ref)) {
            ev.stale_intent = true;
            ev.updated_at = now;
        }
    }
}
function lockActiveIntent(data) {
    const now = new Date().toISOString();
    const activeVersion = data.intent.active_version;
    if (!activeVersion)
        throw new Error('No active INTENT version to lock');
    for (const v of data.intent.versions) {
        if (v.state === 'LOCKED') {
            v.state = 'SUPERSEDED';
            v.superseded_by = activeVersion;
            v.updated_at = now;
        }
    }
    const active = data.intent.versions.find(v => v.version === activeVersion);
    if (!active)
        throw new Error(`INTENT version ${activeVersion} not found`);
    active.state = 'LOCKED';
    active.locked_at = now;
    active.updated_at = now;
    data.intent.active_state = 'LOCKED';
    data.gates.gate_1_open = true;
    if (data.lifecycle_state === 'DESIGN')
        data.lifecycle_state = 'BUILD';
    propagateStaleIntent(data, activeVersion);
}
// ── PLAN Mutations ────────────────────────────────────────────────────────────
function registerPlanDraft(data, version, filePath, intentVersionRef) {
    const now = new Date().toISOString();
    data.plan.versions.push({
        version, state: 'DRAFT', file: filePath,
        created_at: now, updated_at: now,
        intent_version_ref: intentVersionRef,
    });
    data.plan.active_version = version;
    data.plan.active_state = 'DRAFT';
}
function lockActivePlan(data) {
    const now = new Date().toISOString();
    const activeVersion = data.plan.active_version;
    if (!activeVersion)
        throw new Error('No active PLAN version to lock');
    const active = data.plan.versions.find(v => v.version === activeVersion);
    if (!active)
        throw new Error(`PLAN version ${activeVersion} not found`);
    active.state = 'LOCKED';
    active.locked_at = now;
    active.updated_at = now;
    data.plan.active_state = 'LOCKED';
    data.gates.gate_2_open = true;
}
function supersedePlanVersion(data, version, reason) {
    const now = new Date().toISOString();
    const target = data.plan.versions.find(v => v.version === version);
    if (!target)
        throw new Error(`PLAN version ${version} not found`);
    if (target.state !== 'LOCKED')
        throw new Error(`PLAN ${version} is not LOCKED; cannot supersede`);
    target.state = 'SUPERSEDED';
    target.supersede_reason = reason;
    target.updated_at = now;
}
// ── EXEC Mutations ────────────────────────────────────────────────────────────
function registerExecDraft(data, version, filePath, planVersionRef) {
    const now = new Date().toISOString();
    data.exec.versions.push({
        version, state: 'DRAFT', file: filePath,
        created_at: now, updated_at: now,
        plan_version_ref: planVersionRef,
    });
    data.exec.active_version = version;
    data.exec.active_state = 'DRAFT';
}
function advanceExecState(data, toState) {
    const now = new Date().toISOString();
    const activeVersion = data.exec.active_version;
    if (!activeVersion)
        throw new Error('No active EXEC version to advance');
    const expectedSource = {
        BUILDING: 'DRAFT',
        TESTING: 'BUILDING',
        COMPLETED: 'TESTING',
    };
    const currentState = data.exec.active_state;
    if (currentState !== expectedSource[toState]) {
        throw new Error(`Cannot advance to ${toState}: current state is ${currentState}, expected ${expectedSource[toState]}`);
    }
    const active = data.exec.versions.find(v => v.version === activeVersion);
    if (!active)
        throw new Error(`EXEC version ${activeVersion} not found`);
    active.state = toState;
    active.updated_at = now;
    data.exec.active_state = toState;
}
function evaluateGate3(data) {
    const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
    if (!lockedIntent)
        return false;
    const qualifyingPlan = data.plan.versions.find(v => v.state === 'LOCKED' &&
        v.intent_version_ref === lockedIntent.version &&
        !v.stale_intent);
    if (!qualifyingPlan)
        return false;
    const qualifyingExec = data.exec.versions.find(v => v.version === data.exec.active_version &&
        v.state === 'LOCKED' &&
        v.plan_version_ref === qualifyingPlan.version);
    return !!qualifyingExec;
}
function lockActiveExec(data) {
    const now = new Date().toISOString();
    const activeVersion = data.exec.active_version;
    if (!activeVersion)
        throw new Error('No active EXEC version to lock');
    const active = data.exec.versions.find(v => v.version === activeVersion);
    if (!active)
        throw new Error(`EXEC version ${activeVersion} not found`);
    active.state = 'LOCKED';
    active.locked_at = now;
    active.updated_at = now;
    data.exec.active_state = 'LOCKED';
    data.gates.gate_3_satisfied = evaluateGate3(data);
}
function supersedeExecVersion(data, version, reason) {
    const now = new Date().toISOString();
    const target = data.exec.versions.find(v => v.version === version);
    if (!target)
        throw new Error(`EXEC version ${version} not found`);
    if (target.state !== 'LOCKED')
        throw new Error(`EXEC ${version} is not LOCKED; cannot supersede`);
    target.state = 'SUPERSEDED';
    target.supersede_reason = reason;
    target.updated_at = now;
}
// ── CLOSE Mutations ───────────────────────────────────────────────────────────
function registerCloseDraft(data, version, filePath, staleAcknowledged) {
    const now = new Date().toISOString();
    const entry = {
        version, state: 'DRAFT', file: filePath,
        created_at: now, updated_at: now,
    };
    if (staleAcknowledged)
        entry.stale_acknowledged = true;
    data.close.versions.push(entry);
    data.close.active_version = version;
    data.close.active_state = 'DRAFT';
    data.lifecycle_state = 'CLOSE';
}
function lockActiveClose(data) {
    const now = new Date().toISOString();
    const activeVersion = data.close.active_version;
    if (!activeVersion)
        throw new Error('No active CLOSE version to lock');
    for (const v of data.close.versions) {
        if (v.state === 'LOCKED') {
            v.state = 'SUPERSEDED';
            v.superseded_by = activeVersion;
            v.updated_at = now;
        }
    }
    const active = data.close.versions.find(v => v.version === activeVersion);
    if (!active)
        throw new Error(`CLOSE version ${activeVersion} not found`);
    active.state = 'LOCKED';
    active.locked_at = now;
    active.updated_at = now;
    data.close.active_state = 'LOCKED';
    data.lifecycle_state = 'CLOSED';
}
// ── ROADMAP Mutations ─────────────────────────────────────────────────────────
function registerRoadmapDraft(data, version, filePath) {
    const now = new Date().toISOString();
    data.roadmap.versions.push({ version, state: 'DRAFT', file: filePath, created_at: now, updated_at: now });
    data.roadmap.active_version = version;
    data.roadmap.active_state = 'DRAFT';
}
function lockActiveRoadmap(data) {
    const now = new Date().toISOString();
    const draft = data.roadmap.versions.find(v => v.state === 'DRAFT');
    if (!draft)
        throw new Error('No ROADMAP DRAFT to lock');
    for (const v of data.roadmap.versions) {
        if (v.state === 'LOCKED') {
            v.state = 'SUPERSEDED';
            v.superseded_by = draft.version;
            v.updated_at = now;
        }
    }
    draft.state = 'LOCKED';
    draft.locked_at = now;
    draft.updated_at = now;
    data.roadmap.active_version = draft.version;
    data.roadmap.active_state = 'LOCKED';
}
// ── CSO Registration ──────────────────────────────────────────────────────────
function registerCsoEntry(data, entry) {
    data.cso.push(entry);
}
function getNextValidOperations(data) {
    const ops = [];
    const intentLocked = data.intent.active_state === 'LOCKED';
    const planLocked = data.plan.active_state === 'LOCKED';
    const roadmapDraftExists = data.roadmap.versions.some(v => v.state === 'DRAFT');
    // intent domain
    if (!intentLocked) {
        ops.push('intent new');
    }
    if (data.intent.active_state === 'DRAFT') {
        ops.push('intent lock');
    }
    if (intentLocked) {
        ops.push('intent review');
    }
    // roadmap domain (optional)
    if (intentLocked && !roadmapDraftExists) {
        ops.push('roadmap new');
    }
    if (roadmapDraftExists) {
        ops.push('roadmap lock');
    }
    // plan domain
    if (intentLocked) {
        ops.push('plan new');
    }
    if (data.plan.active_state === 'DRAFT') {
        ops.push('plan lock');
    }
    // exec domain
    if (planLocked) {
        ops.push('exec new');
    }
    if (data.exec.active_state === 'BUILDING' || data.exec.active_state === 'TESTING') {
        ops.push('exec complete');
    }
    // close domain
    if (data.lifecycle_state === 'BUILD' && data.gates.gate_3_satisfied) {
        ops.push('close new');
    }
    if (data.close.active_state === 'DRAFT') {
        ops.push('close lock');
    }
    // always available
    ops.push('session bootstrap');
    ops.push('project status');
    ops.push('gitignore generate');
    return ops;
}
//# sourceMappingURL=progress.js.map