"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
exports.copyFile = copyFile;
exports.copyDir = copyDir;
exports.backupFile = backupFile;
exports.fileExists = fileExists;
exports.findProjectRoot = findProjectRoot;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
function ensureDir(dir) {
    fs_extra_1.default.ensureDirSync(dir);
}
function copyFile(src, dest) {
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(dest));
    fs_extra_1.default.copySync(src, dest, { overwrite: true });
}
function copyDir(src, dest) {
    fs_extra_1.default.copySync(src, dest, { overwrite: true });
}
function backupFile(filePath, backupDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const basename = path_1.default.basename(filePath, path_1.default.extname(filePath));
    const ext = path_1.default.extname(filePath);
    const backupName = `${basename}-backup-${timestamp}${ext}`;
    const backupPath = path_1.default.join(backupDir, backupName);
    fs_extra_1.default.ensureDirSync(backupDir);
    fs_extra_1.default.copySync(filePath, backupPath);
    return backupPath;
}
function fileExists(filePath) {
    return fs_extra_1.default.existsSync(filePath);
}
// PLAN-EVAL-01 Fase 5 — anchors on Sigma/activate_status.json (written by
// `sigma project start`/`--reinit`), not Sigma/progress.json. That file is
// legacy/inert now (nothing reads its content, PLAN-EVAL-01 §3.6) and this
// anchor could only move here once every project-creating path
// unconditionally wrote activate_status.json too (done in Fase 4).
function findProjectRoot(startDir = process.cwd()) {
    let current = path_1.default.resolve(startDir);
    while (true) {
        const candidate = path_1.default.join(current, config_1.ACTIVATE_STATUS_FILE);
        if (fs_extra_1.default.existsSync(candidate)) {
            return current;
        }
        const parent = path_1.default.dirname(current);
        if (parent === current) {
            throw new Error('Not inside a Sigma project. No Sigma/activate_status.json found in this directory or any parent. ' +
                'Run: sigma project start');
        }
        current = parent;
    }
}
//# sourceMappingURL=fs.js.map