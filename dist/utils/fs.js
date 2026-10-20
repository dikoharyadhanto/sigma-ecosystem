"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingSigmaFilesError = void 0;
exports.ensureDir = ensureDir;
exports.copyFile = copyFile;
exports.copyDir = copyDir;
exports.fileExists = fileExists;
exports.atomicReplaceFileSync = atomicReplaceFileSync;
exports.toPosix = toPosix;
exports.findProjectRoot = findProjectRoot;
exports.inspectProjectRegistrationState = inspectProjectRegistrationState;
exports.missingSigmaFilesMessage = missingSigmaFilesMessage;
exports.assertSigmaFilesPresentOrThrow = assertSigmaFilesPresentOrThrow;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
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
// Atomic replace for the tmp+rename write idiom used throughout the engine
// (chain.ts, controlStore.ts, mcp/control/canonicalWrite.ts). Replaces
// fs-extra's `moveSync(tmp, dest, {overwrite:true})`, which internally does
// `removeSync(dest)` then `rename()` — two syscalls, not one atomic replace.
// An empirical two-thread reproduction measured ~55% of concurrent reads
// observing the destination missing entirely during that window
// (RESULT-IMPL-SIGMA-MCP-STAGE-C-20260915.md §21.9).
//
// A single fs.renameSync(tmp, dest) is the real atomic replace on both POSIX
// and Windows, but on Windows it can transiently fail with EPERM/EACCES/EBUSY
// if something else (AV, indexer, or — reproduced directly by
// test/atomic-write-regression.test.ts — a concurrent reader's stat) has the
// *destination* file momentarily open. graceful-fs's own win32 rename patch
// (node_modules/graceful-fs/polyfills.js) does not cover this: it only
// retries when the destination does not exist yet (fresh-file creation), and
// gives up immediately if the destination is present — which is exactly the
// overwrite case every caller here has. This retries the rename itself,
// yielding between attempts so Windows scheduling doesn't starve whatever
// holds the transient lock (same rationale graceful-fs's own comment gives
// for not busy-spinning).
const RENAME_RETRY_BUDGET_MS = 5000;
const RENAME_RETRY_STEP_MS = 5;
const RENAME_RETRYABLE_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function atomicReplaceFileSync(tmpPath, destPath) {
    const deadline = Date.now() + RENAME_RETRY_BUDGET_MS;
    for (;;) {
        try {
            fs_extra_1.default.renameSync(tmpPath, destPath);
            return;
        }
        catch (err) {
            const code = err.code;
            if (!code || !RENAME_RETRYABLE_CODES.has(code) || Date.now() >= deadline) {
                throw err;
            }
            sleepSync(RENAME_RETRY_STEP_MS);
        }
    }
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
function readRegisteredIdentity(dir) {
    const file = path_1.default.join(dir, config_1.PROJECT_IDENTITY_FILE);
    if (!fs_extra_1.default.existsSync(file))
        return null;
    try {
        const parsed = fs_extra_1.default.readJsonSync(file);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
            return null;
        const identity = parsed;
        if (identity.registered !== true || typeof identity.project_id !== 'string')
            return null;
        return {
            projectId: identity.project_id,
            projectName: typeof identity.project_name === 'string' ? identity.project_name : identity.project_id,
            originMachine: typeof identity.origin_machine?.name === 'string' && identity.origin_machine.name.trim() ? identity.origin_machine.name : null,
        };
    }
    catch {
        return null;
    }
}
/**
 * Walks up from `startDir` (or inspects only `startDir` when `exact`).
 *
 * IDENTITY_ONLY_MISSING_SIGMA means: a registered identity file and *no* `Sigma/`
 * directory beside it. A `Sigma/` folder that exists but lacks
 * activate_status.json is a damaged project, not a foreign machine, and is
 * deliberately left to the existing repair paths (`sigma doctor`).
 */
function inspectProjectRegistrationState(startDir = process.cwd(), options = {}) {
    let current = path_1.default.resolve(startDir);
    while (true) {
        if (fs_extra_1.default.existsSync(path_1.default.join(current, config_1.ACTIVATE_STATUS_FILE))) {
            return { state: 'REGISTERED_COMPLETE', root: current, projectId: null, projectName: null, originMachine: null };
        }
        const identity = readRegisteredIdentity(current);
        if (identity && !fs_extra_1.default.existsSync(path_1.default.join(current, config_1.PROJECT_SIGMA_DIR))) {
            return { state: 'IDENTITY_ONLY_MISSING_SIGMA', root: current, projectId: identity.projectId, projectName: identity.projectName, originMachine: identity.originMachine };
        }
        const parent = path_1.default.dirname(current);
        if (options.exact || parent === current) {
            return { state: 'UNREGISTERED', root: null, projectId: null, projectName: null, originMachine: null };
        }
        current = parent;
    }
}
function missingSigmaFilesMessage(projectId, projectName, originMachine = null, currentMachine = os_1.default.hostname().trim()) {
    const header = [
        '[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]',
        `This project was previously registered with Sigma (detected via ${config_1.PROJECT_IDENTITY_FILE}: ${projectId} — "${projectName}"),`,
        'but the Sigma runtime files (Sigma/) were not found on this machine.',
    ];
    const sameMachine = originMachine !== null && originMachine.trim().toLowerCase() === currentMachine.trim().toLowerCase();
    if (sameMachine) {
        // The machine that should hold the files does not hold them in this folder: either they were
        // lost, or this folder is a second clone on the same machine (hostnames cannot tell the two apart).
        return [
            ...header,
            `This machine ("${currentMachine}") is the machine where this project was registered, but the Sigma files are not in this folder.`,
            '',
            'All Sigma operations are blocked and you cannot run any Sigma command on this machine',
            '(including re-registering or re-initializing the project).',
            '',
            'To recover:',
            '  1. Restore the Sigma/ folder and the other Sigma files from a backup or from Git history',
            '     (for example: git checkout <commit-before-gitignore-on> -- Sigma).',
            '  2. Do not re-register: that would create a second, diverging Sigma state.',
            '',
            'If this folder is another clone of the project on this same machine, the Sigma files live in the original folder:',
            '  1. There, disable Sigma gitignore: sigma config set gitignore off',
            '  2. Commit and push all Sigma files from there.',
            '  3. Run `git pull` here.',
        ].join('\n');
    }
    const where = originMachine === null
        ? 'The original machine was not recorded for this project (set it on that machine with: sigma config set origin-machine).'
        : `This machine ("${currentMachine}") is not the machine where this project was registered ("${originMachine}").`;
    return [
        ...header,
        where,
        '',
        'All Sigma operations are blocked and you cannot run any Sigma command on this machine',
        '(including re-registering or re-initializing the project).',
        '',
        'To use Sigma on this machine:',
        '  1. On the original machine where this project is registered, disable Sigma gitignore:',
        '     sigma config set gitignore off',
        '  2. Commit and push all Sigma files from the original machine to your Git repository.',
        '  3. Run `git pull` on this machine.',
    ].join('\n');
}
class MissingSigmaFilesError extends Error {
    constructor(projectId, projectName, originMachine = null) {
        super(missingSigmaFilesMessage(projectId, projectName, originMachine));
        this.projectId = projectId;
        this.projectName = projectName;
        this.originMachine = originMachine;
        this.name = 'MissingSigmaFilesError';
    }
}
exports.MissingSigmaFilesError = MissingSigmaFilesError;
/** Throws MissingSigmaFilesError when only the identity file is present. Any other state passes. */
function assertSigmaFilesPresentOrThrow(startDir = process.cwd(), options = {}) {
    const inspection = inspectProjectRegistrationState(startDir, options);
    if (inspection.state === 'IDENTITY_ONLY_MISSING_SIGMA') {
        throw new MissingSigmaFilesError(inspection.projectId ?? 'UNKNOWN', inspection.projectName ?? 'UNKNOWN', inspection.originMachine);
    }
}
//# sourceMappingURL=fs.js.map