"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
exports.copyFile = copyFile;
exports.copyDir = copyDir;
exports.fileExists = fileExists;
exports.toPosix = toPosix;
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
function fileExists(filePath) {
    return fs_extra_1.default.existsSync(filePath);
}
// Cross-platform path portability (bug report 2026-08-30, BUG B + follow-up).
// A relative path that Sigma *persists* (into progress-v<N>.json `entry.file`,
// Sigma/messages/index.json `file`/`attachments`, a reconstructed chain) or
// *string-compares* (inbox orphan check) or *prints as a stored location*
// must use forward slashes on every OS. path.join() emits "\" on Windows, so
// a chain/index written on Windows is unreadable on Linux without the
// read-time normalizers (normalizeFilePathsOnRead, readIndex) — and any code
// path that bypasses those (e.g. the orphan-file set comparison) breaks
// outright. Forward slashes are accepted by path.join()/fs on Windows too, so
// normalizing on write is the one fix that needs no OS branching and keeps
// state portable at rest. Read-time normalizers stay as the safety net for
// files written by older builds.
function toPosix(p) {
    return p.replace(/\\/g, '/');
}
// PLAN-EVAL-01 Fase 5 — anchors on Sigma/activate_status.json (written by
// `sigma project start`/`--reinit`), not Sigma/progress.json. That file is
// legacy/inert now (nothing reads its content, PLAN-EVAL-01 §3.6) and this
// anchor could only move here once every project-creating path
// unconditionally wrote activate_status.json too (done in Fase 4).
function findProjectRoot(startDir = process.cwd()) {
    let current = path_1.default.resolve(startDir);
    // PLAN-IMPL-NOTION-REMOTE-GOVERNANCE-INTEGRATION-V2 D-03 — only tracked to
    // enrich the error message below. Does not change anchor/success behavior
    // at all: a directory with this marker but no activate_status.json still
    // fails to resolve, exactly as before this field existed.
    let remoteStateMarkerPath;
    while (true) {
        const candidate = path_1.default.join(current, config_1.ACTIVATE_STATUS_FILE);
        if (fs_extra_1.default.existsSync(candidate)) {
            return current;
        }
        if (!remoteStateMarkerPath) {
            const markerCandidate = path_1.default.join(current, config_1.PROJECT_REMOTE_STATE_FILE);
            if (fs_extra_1.default.existsSync(markerCandidate)) {
                remoteStateMarkerPath = markerCandidate;
            }
        }
        const parent = path_1.default.dirname(current);
        if (parent === current) {
            if (remoteStateMarkerPath) {
                try {
                    const marker = fs_extra_1.default.readJsonSync(remoteStateMarkerPath);
                    throw new Error(`This project's Sigma state was moved to Notion on ${marker.pushed_at} (chain ${marker.chain_version}). ` +
                        'Run: sigma notion pull-state — to restore it before continuing.');
                }
                catch (err) {
                    if (err instanceof Error && err.message.startsWith("This project's Sigma state was moved"))
                        throw err;
                    // Marker exists but is unreadable — fall through to the generic error.
                }
            }
            throw new Error('Not inside a Sigma project. No Sigma/activate_status.json found in this directory or any parent. ' +
                'Run: sigma project start');
        }
        current = parent;
    }
}
//# sourceMappingURL=fs.js.map