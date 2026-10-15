"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationIdForCommandPath = operationIdForCommandPath;
exports.isRegisteredReadOnlyOperation = isRegisteredReadOnlyOperation;
exports.appendOperationLogEntry = appendOperationLogEntry;
exports.ensureOperationsLog = ensureOperationsLog;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const fs_1 = require("./fs");
let registryLevels = null;
function operationLevels() {
    if (registryLevels)
        return registryLevels;
    const registryPath = path_1.default.resolve(__dirname, '..', '..', 'Sigma', 'SIGMA-OPERATION-REGISTRY.json');
    try {
        const registry = fs_extra_1.default.readJsonSync(registryPath);
        registryLevels = new Map((registry.operations ?? []).map(operation => [operation.operation_id, operation.level ?? '']));
    }
    catch {
        // Fail closed: an unreadable registry must never suppress an audit entry.
        registryLevels = new Map();
    }
    return registryLevels;
}
function operationIdForCommandPath(commandPath) {
    return commandPath.trim().replace(/[\s-]+/g, '_');
}
function isRegisteredReadOnlyOperation(commandPath) {
    return operationLevels().get(operationIdForCommandPath(commandPath)) === 'read_only';
}
// Appends one JSONL line to Sigma/logs/operations.jsonl for a mutating or
// governance-significant operation that just finished. Read-only operations
// are filtered by the CLI before this function is called so observation does
// not change the project it is inspecting. No-ops outside a Sigma project.
function appendOperationLogEntry(operation, exitCode) {
    let projectRoot;
    try {
        projectRoot = (0, fs_1.findProjectRoot)();
    }
    catch {
        return;
    }
    const entry = {
        operation,
        timestamp: new Date().toISOString(),
        status: exitCode === 0 ? 'success' : 'error',
        exit_code: exitCode,
    };
    const filePath = path_1.default.join(projectRoot, config_1.OPERATIONS_LOG_FILE);
    fs_extra_1.default.ensureFileSync(filePath);
    fs_extra_1.default.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}
// Ensures Sigma/logs/operations.jsonl exists and every line is valid JSON.
// Recreates it empty if missing or corrupt. Returns true if it was
// (re)initialized, so callers can decide whether to stamp a fresh
// logs_created_at on the identity file.
function ensureOperationsLog(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.OPERATIONS_LOG_FILE);
    let needsInit = !fs_extra_1.default.existsSync(filePath);
    if (!needsInit) {
        const lines = fs_extra_1.default.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim().length > 0);
        for (const line of lines) {
            try {
                JSON.parse(line);
            }
            catch {
                needsInit = true;
                break;
            }
        }
    }
    if (needsInit) {
        fs_extra_1.default.ensureDirSync(path_1.default.dirname(filePath));
        fs_extra_1.default.writeFileSync(filePath, '', 'utf8');
    }
    return needsInit;
}
//# sourceMappingURL=operationLog.js.map