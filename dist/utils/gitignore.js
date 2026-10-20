"use strict";
// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY-20261020 §3.2 / WP-2.
//
// Manages the Sigma block inside <project_root>/.gitignore and detaches Sigma
// files from the Git index. Hard invariants (plan §1):
//   1. Nothing in this module ever deletes a file from disk. The only Git
//      mutation is `git rm --cached`, which touches the index alone.
//   3. `dev/` is never ignored as a folder; only the two Sigma-written files
//      inside it are.
//   2/4. `.sigma-identity.json` is the one Sigma file that stays tracked, and
//      the block says so explicitly with a negation rule.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGMA_GITIGNORE_RULES = exports.SIGMA_GITIGNORE_TARGET_PATHS = exports.GITIGNORE_BLOCK_END = exports.GITIGNORE_BLOCK_START = void 0;
exports.renderGitignoreBlock = renderGitignoreBlock;
exports.applyGitignoreBlock = applyGitignoreBlock;
exports.removeGitignoreBlock = removeGitignoreBlock;
exports.hasGitignoreBlock = hasGitignoreBlock;
exports.untrackSigmaFilesFromGitIndex = untrackSigmaFilesFromGitIndex;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const config_1 = require("../config");
exports.GITIGNORE_BLOCK_START = '# >>> sigma-managed >>>';
exports.GITIGNORE_BLOCK_END = '# <<< sigma-managed <<<';
/** Paths (repo-relative, as `git ls-files` sees them) that Sigma detaches from the index. Never includes the identity file or product code under dev/. */
exports.SIGMA_GITIGNORE_TARGET_PATHS = [
    'Sigma',
    'CLAUDE.md',
    'GEMINI.md',
    'AGENTS.md',
    'DEEPSEEK.md',
    'REASONIX.md',
    '.mcp.json',
    'opencode.json',
    'opencode.jsonc',
    'CHANGE-RECORD.md',
    'dev/.sigma-workspace.json',
    'dev/CHANGE-RECORD.md',
];
/** Rules written inside the managed block, in order. Root-anchored so a same-named file deeper in the tree is never caught. */
exports.SIGMA_GITIGNORE_RULES = [
    '/Sigma/',
    '/CLAUDE.md',
    '/GEMINI.md',
    '/AGENTS.md',
    '/DEEPSEEK.md',
    '/REASONIX.md',
    '/.mcp.json',
    '/opencode.json',
    '/opencode.jsonc',
    '/CHANGE-RECORD.md',
    '/dev/.sigma-workspace.json',
    '/dev/CHANGE-RECORD.md',
    `!/${config_1.PROJECT_IDENTITY_FILE}`,
];
function renderGitignoreBlock() {
    return [
        exports.GITIGNORE_BLOCK_START,
        '# Managed by Sigma CLI (sigma config set gitignore on|off)',
        '# Do not edit inside this block manually.',
        ...exports.SIGMA_GITIGNORE_RULES,
        exports.GITIGNORE_BLOCK_END,
    ].join('\n');
}
function gitignorePath(projectRoot) {
    return path_1.default.join(projectRoot, '.gitignore');
}
function detectEol(text) {
    return text.includes('\r\n') ? '\r\n' : '\n';
}
/** Index range of the managed block (start line through end line, inclusive of its trailing newline), or null. */
function findBlock(text) {
    const start = text.indexOf(exports.GITIGNORE_BLOCK_START);
    if (start === -1)
        return null;
    const endMarker = text.indexOf(exports.GITIGNORE_BLOCK_END, start);
    if (endMarker === -1)
        return null;
    let end = endMarker + exports.GITIGNORE_BLOCK_END.length;
    if (text.startsWith('\r\n', end))
        end += 2;
    else if (text[end] === '\n')
        end += 1;
    return { start, end };
}
/**
 * Writes (or refreshes) the managed block. Content outside the markers is kept
 * byte-for-byte. A missing .gitignore is created. Idempotent.
 */
function applyGitignoreBlock(projectRoot) {
    const file = gitignorePath(projectRoot);
    const existed = fs_extra_1.default.existsSync(file);
    const current = existed ? fs_extra_1.default.readFileSync(file, 'utf8') : '';
    const eol = existed ? detectEol(current) : '\n';
    const block = renderGitignoreBlock().replace(/\n/g, eol);
    let next;
    const found = findBlock(current);
    if (found) {
        next = current.slice(0, found.start) + block + eol + current.slice(found.end);
    }
    else if (current.length === 0) {
        next = block + eol;
    }
    else {
        const separator = current.endsWith('\n') ? eol : eol + eol;
        next = current + separator + block + eol;
    }
    if (next === current)
        return 'unchanged';
    fs_extra_1.default.writeFileSync(file, next);
    return existed ? 'updated' : 'created';
}
/** Removes the managed block and nothing else. A .gitignore left empty by that is kept (never deleted). */
function removeGitignoreBlock(projectRoot) {
    const file = gitignorePath(projectRoot);
    if (!fs_extra_1.default.existsSync(file))
        return 'absent';
    const current = fs_extra_1.default.readFileSync(file, 'utf8');
    const found = findBlock(current);
    if (!found)
        return 'absent';
    let before = current.slice(0, found.start);
    const after = current.slice(found.end);
    // Drop the blank separator line applyGitignoreBlock added in front of the block.
    const eol = detectEol(current);
    if (before.endsWith(eol + eol))
        before = before.slice(0, -eol.length);
    fs_extra_1.default.writeFileSync(file, before + after);
    return 'removed';
}
function hasGitignoreBlock(projectRoot) {
    const file = gitignorePath(projectRoot);
    return fs_extra_1.default.existsSync(file) && findBlock(fs_extra_1.default.readFileSync(file, 'utf8')) !== null;
}
// ── Git index cleanup (never touches the working tree) ───────────────────────
function git(cwd, args) {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'])
        delete env[key];
    const r = (0, child_process_1.spawnSync)('git', args, { cwd, env, encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
    if (r.error)
        return { ok: false, stdout: '', stderr: r.error.message };
    return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: (r.stderr ?? '').trim() };
}
/**
 * Detaches Sigma files from the Git index with `git rm -r --cached`. The files
 * stay on disk. The caller commits the resulting deletion; Sigma never commits.
 *
 * Pathspecs are relative to `projectRoot` (the command's cwd), so a project
 * nested inside a larger repository only ever touches its own files.
 */
function untrackSigmaFilesFromGitIndex(projectRoot) {
    const inside = git(projectRoot, ['rev-parse', '--is-inside-work-tree']);
    if (!inside.ok || inside.stdout.trim() !== 'true')
        return { gitAvailable: false, untracked: 0, paths: [] };
    const listed = git(projectRoot, ['ls-files', '-z', '--', ...exports.SIGMA_GITIGNORE_TARGET_PATHS]);
    if (!listed.ok)
        return { gitAvailable: true, untracked: 0, paths: [], error: listed.stderr };
    const entries = listed.stdout.split('\0').filter(Boolean);
    if (entries.length === 0)
        return { gitAvailable: true, untracked: 0, paths: [] };
    const touched = exports.SIGMA_GITIGNORE_TARGET_PATHS.filter(target => entries.some(entry => entry === target || entry.startsWith(target + '/')));
    const removed = git(projectRoot, ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', ...touched]);
    if (!removed.ok)
        return { gitAvailable: true, untracked: 0, paths: [], error: removed.stderr };
    return { gitAvailable: true, untracked: entries.length, paths: [...touched] };
}
//# sourceMappingURL=gitignore.js.map