"use strict";
// The machine a Sigma project was registered on, recorded in .sigma-identity.json
// (the one Sigma file kept in Git). Informational only: a guard decision never
// depends on it, because hostnames change and repeat across machines. Its job is
// to make the "missing Sigma files" block say where the project's Sigma state lives.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_MACHINE_NAME_LENGTH = void 0;
exports.currentMachineName = currentMachineName;
exports.validateMachineName = validateMachineName;
exports.parseOriginMachine = parseOriginMachine;
exports.sameMachine = sameMachine;
exports.writeOriginMachine = writeOriginMachine;
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const fs_1 = require("../utils/fs");
exports.MAX_MACHINE_NAME_LENGTH = 64;
function currentMachineName() {
    return os_1.default.hostname().trim();
}
function validateMachineName(raw) {
    const name = raw.trim();
    if (name.length === 0 || name.length > exports.MAX_MACHINE_NAME_LENGTH) {
        throw new Error(`Machine name must be between 1 and ${exports.MAX_MACHINE_NAME_LENGTH} characters.`);
    }
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(name))
        throw new Error('Machine name cannot contain control characters or line breaks.');
    return name;
}
function parseOriginMachine(value) {
    if (value === null || typeof value !== 'object')
        return null;
    const record = value;
    if (typeof record.name !== 'string' || record.name.trim().length === 0)
        return null;
    return { name: record.name, recorded_at: typeof record.recorded_at === 'string' ? record.recorded_at : '' };
}
function sameMachine(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}
/** Read-merge-write of `origin_machine`; every other identity field survives. Returns the previous record. */
function writeOriginMachine(projectRoot, name, now = new Date()) {
    const file = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
    if (!fs_extra_1.default.existsSync(file))
        throw new Error(`No Sigma project identity found at ${file}. Run: sigma project start`);
    let identity;
    try {
        const parsed = fs_extra_1.default.readJsonSync(file);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('not an object');
        identity = parsed;
    }
    catch {
        throw new Error(`${config_1.PROJECT_IDENTITY_FILE} is unreadable. Run: sigma project register`);
    }
    const previous = parseOriginMachine(identity.origin_machine);
    identity.origin_machine = { name: validateMachineName(name), recorded_at: now.toISOString() };
    const tmp = `${file}.${process.pid}.tmp`;
    fs_extra_1.default.writeJsonSync(tmp, identity, { spaces: 2 });
    (0, fs_1.atomicReplaceFileSync)(tmp, file);
    return previous;
}
//# sourceMappingURL=originMachine.js.map