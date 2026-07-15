"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendOperationLogEntry = appendOperationLogEntry;
exports.ensureOperationsLog = ensureOperationsLog;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const fs_1 = require("./fs");
// Appends one JSONL line to Sigma/logs/operations.jsonl for the operation
// that just finished. No-ops outside a Sigma project (nothing to log to).
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