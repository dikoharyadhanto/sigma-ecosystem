"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevWorkspaceError = void 0;
exports.getDevWorkspaceStatus = getDevWorkspaceStatus;
exports.describeDevWorkspace = describeDevWorkspace;
exports.createDevWorkspace = createDevWorkspace;
exports.repairDevWorkspace = repairDevWorkspace;
const crypto_1 = __importDefault(require("crypto"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const fs_1 = require("../utils/fs");
class DevWorkspaceError extends Error {
}
exports.DevWorkspaceError = DevWorkspaceError;
// ── Identity access ────────────────────────────────────────────────────────
function identityPath(projectRoot) {
    return path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
}
function readIdentityObject(projectRoot) {
    const filePath = identityPath(projectRoot);
    if (!fs_extra_1.default.existsSync(filePath)) {
        throw new DevWorkspaceError(`No Sigma project identity found at ${filePath}. Run: sigma project start`);
    }
    let parsed;
    try {
        parsed = fs_extra_1.default.readJsonSync(filePath);
    }
    catch {
        throw new DevWorkspaceError(`Project identity at ${filePath} is not valid JSON. Run: sigma project register`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new DevWorkspaceError(`Project identity at ${filePath} is not a JSON object. Run: sigma project register`);
    }
    return parsed;
}
function hasRecord(identity) {
    return identity.dev_workspace !== undefined && identity.dev_workspace !== null;
}
function recordCreatedAt(identity) {
    const record = identity.dev_workspace;
    if (record !== null && typeof record === 'object') {
        const createdAt = record.created_at;
        if (typeof createdAt === 'string')
            return createdAt;
    }
    return null;
}
/** Read-merge-write through a temporary file, so a failed write leaves the identity as it was. */
function writeIdentityMerged(projectRoot, patch) {
    const filePath = identityPath(projectRoot);
    const merged = { ...readIdentityObject(projectRoot), ...patch };
    const tmpPath = `${filePath}.tmp-${process.pid}-${crypto_1.default.randomUUID()}`;
    try {
        fs_extra_1.default.writeJsonSync(tmpPath, merged, { spaces: 2 });
        (0, fs_1.atomicReplaceFileSync)(tmpPath, filePath);
    }
    catch (err) {
        fs_extra_1.default.removeSync(tmpPath);
        throw err;
    }
}
// ── Folder and marker access ───────────────────────────────────────────────
function workspaceFolder(projectRoot) {
    return path_1.default.join(projectRoot, config_1.DEV_WORKSPACE_DIR);
}
function markerPath(projectRoot) {
    return path_1.default.join(workspaceFolder(projectRoot), config_1.DEV_WORKSPACE_MARKER_FILE);
}
function isDirectory(target) {
    try {
        return fs_extra_1.default.statSync(target).isDirectory();
    }
    catch {
        return false;
    }
}
/** Name of any root entry equal to `dev` ignoring case, so `Dev` is caught on every platform. */
function findEntryNamedDev(projectRoot) {
    const match = fs_extra_1.default.readdirSync(projectRoot).find(name => name.toLowerCase() === config_1.DEV_WORKSPACE_DIR);
    return match ?? null;
}
function readMarker(projectRoot) {
    const filePath = markerPath(projectRoot);
    if (!fs_extra_1.default.existsSync(filePath))
        return { kind: 'missing' };
    try {
        const parsed = fs_extra_1.default.readJsonSync(filePath);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
            return { kind: 'invalid' };
        const marker = parsed;
        if (marker.role !== 'DEV' || typeof marker.project_id !== 'string')
            return { kind: 'invalid' };
        return { kind: 'ok', marker: marker };
    }
    catch {
        return { kind: 'invalid' };
    }
}
// ── Status ─────────────────────────────────────────────────────────────────
function getDevWorkspaceStatus(projectRoot) {
    const identity = readIdentityObject(projectRoot);
    if (!hasRecord(identity)) {
        return { state: 'INACTIVE', degradedReason: null, unregisteredFolder: findEntryNamedDev(projectRoot) !== null };
    }
    const degraded = (degradedReason) => ({
        state: 'ACTIVE_DEGRADED',
        degradedReason,
        unregisteredFolder: false,
    });
    if (!isDirectory(workspaceFolder(projectRoot)))
        return degraded('FOLDER_MISSING');
    const reading = readMarker(projectRoot);
    if (reading.kind === 'missing')
        return degraded('MARKER_MISSING');
    if (reading.kind === 'invalid')
        return degraded('MARKER_INVALID');
    if (reading.marker.project_id !== identity.project_id)
        return degraded('PROJECT_ID_MISMATCH');
    return { state: 'ACTIVE', degradedReason: null, unregisteredFolder: false };
}
const DEGRADED_REASON_TEXT = {
    FOLDER_MISSING: 'the folder dev/ is missing',
    MARKER_MISSING: 'the marker dev/.sigma-workspace.json is missing',
    MARKER_INVALID: 'the marker dev/.sigma-workspace.json is not valid',
    PROJECT_ID_MISMATCH: 'the marker belongs to a different project',
};
/** Message shown for a state, in the wording the DEV rules refer to. */
function describeDevWorkspace(status) {
    switch (status.state) {
        case 'INACTIVE': {
            const lines = ['No workspace restriction applies to DEV in this project. DEV works under the standard rules.'];
            if (status.unregisteredFolder) {
                lines.push('A folder `dev/` exists but is not a registered DEV workspace. It is treated as an ordinary project folder.');
            }
            return lines;
        }
        case 'ACTIVE':
            return [
                'DEV workspace is active. DEV may write only inside `<project_root>/dev/`. DEV may read other locations in this project. ' +
                    'Exceptions: DEV writes the EXEC file and runs Sigma operations that write inside `Sigma/` (for example `sigma memo`, `sigma send`). ' +
                    'Access outside the project requires explicit Director authorization.',
            ];
        case 'ACTIVE_DEGRADED': {
            const reason = status.degradedReason ? ` (${DEGRADED_REASON_TEXT[status.degradedReason]})` : '';
            return [
                `DEV workspace is registered, but \`dev/\` or its marker is missing or invalid${reason}. Restrictions still apply. ` +
                    'Do not write outside `dev/`. Report this to the Director and ask for repair with `sigma doctor --repair-workspace`.',
            ];
        }
    }
}
const DEFAULT_IO = {
    makeFolder: folderPath => fs_extra_1.default.mkdirSync(folderPath),
    writeMarker: (filePath, marker) => fs_extra_1.default.writeJsonSync(filePath, marker, { spaces: 2, flag: 'wx' }),
    writeRecord: (projectRoot, record) => writeIdentityMerged(projectRoot, { dev_workspace: record }),
};
function createDevWorkspace(projectRoot, io = DEFAULT_IO, now = new Date()) {
    const identity = readIdentityObject(projectRoot);
    if (hasRecord(identity)) {
        throw new DevWorkspaceError('A DEV workspace is already registered for this project. Run `sigma dev status` to see its state, ' +
            'or `sigma doctor` to check it.');
    }
    const existing = findEntryNamedDev(projectRoot);
    if (existing !== null) {
        throw new DevWorkspaceError(`An entry named "${existing}" already exists in the project root. ` +
            'To activate the workspace, the Director must rename or move that entry first.');
    }
    const createdAt = now.toISOString();
    const record = { path: config_1.DEV_WORKSPACE_DIR, created_at: createdAt };
    const marker = {
        role: 'DEV',
        project_id: String(identity.project_id),
        created_at: createdAt,
    };
    const folder = workspaceFolder(projectRoot);
    let folderCreated = false;
    try {
        io.makeFolder(folder);
        folderCreated = true;
        io.writeMarker(markerPath(projectRoot), marker);
        // The record is written last: it is the switch, so it must not exist unless the rest does.
        io.writeRecord(projectRoot, record);
    }
    catch (err) {
        const cause = err instanceof Error ? err.message : String(err);
        let rollbackFailure = null;
        if (folderCreated) {
            try {
                fs_extra_1.default.removeSync(folder);
            }
            catch (rollbackErr) {
                rollbackFailure = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
            }
        }
        throw new DevWorkspaceError(rollbackFailure === null
            ? `Could not create the DEV workspace: ${cause}. Everything created by this operation was removed.`
            : `Could not create the DEV workspace: ${cause}. Removing dev/ also failed: ${rollbackFailure}. Remove dev/ manually before retrying.`);
    }
    return { record, marker };
}
/**
 * Recreates a missing folder and a missing or invalid marker from the record.
 * Never touches the contents of dev/ beyond the marker, and never changes the record.
 */
function repairDevWorkspace(projectRoot, now = new Date()) {
    const before = getDevWorkspaceStatus(projectRoot);
    const actions = [];
    if (before.state === 'ACTIVE_DEGRADED') {
        const identity = readIdentityObject(projectRoot);
        const folder = workspaceFolder(projectRoot);
        if (before.degradedReason === 'FOLDER_MISSING') {
            fs_extra_1.default.mkdirSync(folder, { recursive: true });
            actions.push('Recreated the folder dev/ (empty).');
        }
        const marker = {
            role: 'DEV',
            project_id: String(identity.project_id),
            created_at: recordCreatedAt(identity) ?? now.toISOString(),
        };
        fs_extra_1.default.writeJsonSync(markerPath(projectRoot), marker, { spaces: 2 });
        actions.push('Recreated the marker dev/.sigma-workspace.json from the record.');
    }
    return { before, after: getDevWorkspaceStatus(projectRoot), actions };
}
//# sourceMappingURL=devWorkspace.js.map