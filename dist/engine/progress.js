"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasActiveLockedIntent = hasActiveLockedIntent;
exports.hasCleanGate2Chain = hasCleanGate2Chain;
exports.hasCleanGate3Chain = hasCleanGate3Chain;
exports.readOverrides = readOverrides;
exports.getInvalidMarkers = getInvalidMarkers;
exports.writeProgress = writeProgress;
exports.createInitialProgress = createInitialProgress;
exports.parseMajorVersion = parseMajorVersion;
exports.parseMinorVersion = parseMinorVersion;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
// ── Gate Chain Queries (used by reconstruct.ts) ─────────────────────────────
function hasActiveLockedIntent(data) {
    return data.intent.versions.some(v => v.state === 'LOCKED');
}
function hasCleanGate2Chain(data) {
    return data.plan.versions.some(v => v.state === 'LOCKED' &&
        !!v.intent_version_ref &&
        data.intent.versions.some(iv => iv.version === v.intent_version_ref && iv.state === 'LOCKED'));
}
function hasCleanGate3Chain(data) {
    const activeExec = data.exec.versions.find(v => v.version === data.exec.active_version && v.state === 'LOCKED');
    if (!activeExec?.plan_version_ref)
        return false;
    const referencedPlan = data.plan.versions.find(v => v.version === activeExec.plan_version_ref &&
        v.state === 'LOCKED');
    if (!referencedPlan?.intent_version_ref)
        return false;
    return data.intent.versions.some(v => v.version === referencedPlan.intent_version_ref && v.state === 'LOCKED');
}
// ── Overrides (used by doctor.ts) ───────────────────────────────────────────
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
function ensureRuntimeInvalid(data) {
    if (!data.runtime_invalid || !Array.isArray(data.runtime_invalid.markers)) {
        data.runtime_invalid = { markers: [], last_doctor_run_at: null };
    }
    return data.runtime_invalid;
}
function getInvalidMarkers(data) {
    return ensureRuntimeInvalid(data).markers;
}
// ── Read / Write (writeProgress used by doctor.ts --reconstruct) ───────────
function writeProgress(projectRoot, data) {
    const filePath = path_1.default.join(projectRoot, config_1.PROGRESS_FILE);
    const tmpPath = filePath + '.tmp';
    data.updated_at = new Date().toISOString();
    fs_extra_1.default.writeJsonSync(tmpPath, data, { spaces: 2 });
    fs_extra_1.default.moveSync(tmpPath, filePath, { overwrite: true });
}
// ── Seed State (used by project.ts's legacy stub write, reconstruct.ts) ────
function emptyTracker() {
    return { active_version: null, active_state: null, versions: [] };
}
function createInitialProgress(projectId, projectName) {
    const now = new Date().toISOString();
    return {
        schema_version: config_1.SCHEMA_VERSION,
        project_id: projectId,
        project_name: projectName,
        lifecycle_state: 'DESIGN',
        created_at: now,
        updated_at: now,
        intent: emptyTracker(),
        plan: { ...emptyTracker(), pending: [] },
        exec: emptyTracker(),
        close: emptyTracker(),
        roadmap: emptyTracker(),
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
// ── Version Helpers (shared, unchanged by the chain.ts migration) ──────────
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
//# sourceMappingURL=progress.js.map