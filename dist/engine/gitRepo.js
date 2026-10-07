"use strict";
// F05 W1 — minimal, shell-free Git adapter for the INTENT amendment flow.
// Sigma only ever *reads* Git state and, at the single effective point of an
// amendment/baseline, runs `git tag`. It never stages, commits, checks out,
// resets, fetches or pushes (F05 §2 items 8-9). Every call uses spawnSync with
// an argument vector (no shell) and pathspecs after `--`.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = void 0;
exports.runGit = runGit;
exports.lfSha256 = lfSha256;
exports.gitAvailable = gitAvailable;
exports.repoToplevel = repoToplevel;
exports.repoRelativePath = repoRelativePath;
exports.isTracked = isTracked;
exports.resolveCommit = resolveCommit;
exports.blobAt = blobAt;
exports.isAncestor = isAncestor;
exports.pathStatus = pathStatus;
exports.commitsTouching = commitsTouching;
exports.diffAgainstWorktree = diffAgainstWorktree;
exports.validTagName = validTagName;
exports.readTag = readTag;
exports.listTags = listTags;
exports.createAnnotatedTag = createAnnotatedTag;
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MAX_BUFFER = 256 * 1024 * 1024;
function gitEnv() {
    const env = { ...process.env };
    // Never let an inherited environment redirect Sigma to a different repository.
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_NAMESPACE'])
        delete env[key];
    env.GIT_TERMINAL_PROMPT = '0';
    env.GIT_OPTIONAL_LOCKS = '0';
    return env;
}
function runGit(cwd, args) {
    const r = (0, child_process_1.spawnSync)('git', args, { cwd, env: gitEnv(), maxBuffer: MAX_BUFFER, windowsHide: true });
    if (r.error)
        return { ok: false, code: null, stdout: Buffer.alloc(0), stderr: '', spawnError: r.error.message };
    return { ok: r.status === 0, code: r.status, stdout: r.stdout ?? Buffer.alloc(0), stderr: (r.stderr ?? Buffer.alloc(0)).toString('utf8').trim() };
}
const text = (r) => r.stdout.toString('utf8').trim();
const sha256Hex = (bytes) => crypto_1.default.createHash('sha256').update(bytes).digest('hex');
exports.sha256Hex = sha256Hex;
/** Hash of the content with CRLF folded to LF — comparable across `core.autocrlf` settings (F05 R-1). */
function lfSha256(bytes) {
    return (0, exports.sha256Hex)(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
}
function gitAvailable(cwd) {
    const r = runGit(cwd, ['--version']);
    if (r.spawnError)
        return { ok: false, error: r.spawnError };
    return r.ok ? { ok: true, version: text(r) } : { ok: false, error: r.stderr || 'git --version failed' };
}
function repoToplevel(cwd) {
    const r = runGit(cwd, ['rev-parse', '--show-toplevel']);
    if (!r.ok)
        return { ok: false, error: r.spawnError ?? (r.stderr || 'not inside a Git working tree') };
    return { ok: true, root: text(r) };
}
/** Path of `absFile` relative to the repository top level, forward-slashed. Throws if outside it. */
function repoRelativePath(repoRoot, absFile) {
    const top = fs_1.default.realpathSync.native(path_1.default.resolve(repoRoot));
    const file = fs_1.default.realpathSync.native(absFile);
    const rel = path_1.default.relative(top, file);
    if (!rel || rel.startsWith('..') || path_1.default.isAbsolute(rel))
        throw new Error(`File is outside the Git working tree: ${absFile}`);
    return rel.split(path_1.default.sep).join('/');
}
function isTracked(cwd, rel) {
    return runGit(cwd, ['ls-files', '--error-unmatch', '--', rel]).ok;
}
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._\/@{}^~-]*$/;
/** Resolve a user-supplied ref to a full commit SHA. Ranges, options and path-like specs are rejected. */
function resolveCommit(cwd, ref) {
    if (typeof ref !== 'string' || !SAFE_REF.test(ref) || ref.includes('..'))
        return { ok: false, error: `Invalid commit reference: "${ref}"` };
    const r = runGit(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (!r.ok)
        return { ok: false, error: `Commit not found: ${ref}` };
    return { ok: true, sha: text(r) };
}
function blobAt(cwd, commit, rel) {
    const r = runGit(cwd, ['cat-file', 'blob', `${commit}:${rel}`]);
    return r.ok ? r.stdout : null;
}
function isAncestor(cwd, ancestor, descendant) {
    return runGit(cwd, ['merge-base', '--is-ancestor', ancestor, descendant]).ok;
}
/** `git status --porcelain` for one path; empty string means clean. */
function pathStatus(cwd, rel) {
    const r = runGit(cwd, ['status', '--porcelain', '--', rel]);
    return r.ok ? text(r) : `(status unavailable: ${r.stderr})`;
}
function commitsTouching(cwd, afterCommit, rel) {
    const r = runGit(cwd, ['log', '--format=%H', `${afterCommit}..HEAD`, '--', rel]);
    return r.ok ? text(r).split('\n').filter(Boolean) : [];
}
/** Diff of the commit against the working tree for one path (line-ending conversion follows Git's own filters). */
function diffAgainstWorktree(cwd, commit, rel) {
    const common = ['diff', '--no-color', '--no-ext-diff', '--no-textconv'];
    const stat = runGit(cwd, [...common, '--stat', commit, '--', rel]);
    const patch = runGit(cwd, [...common, commit, '--', rel]);
    return { stat: stat.ok ? text(stat) : '', patch: patch.ok ? patch.stdout.toString('utf8') : '' };
}
function validTagName(cwd, name) {
    return runGit(cwd, ['check-ref-format', `refs/tags/${name}`]).ok;
}
function readTag(cwd, name) {
    const ref = `refs/tags/${name}`;
    const exists = runGit(cwd, ['rev-parse', '--verify', '--quiet', ref]);
    if (!exists.ok)
        return { name, exists: false };
    const type = runGit(cwd, ['cat-file', '-t', ref]);
    const peeled = runGit(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return { name, exists: true, annotated: text(type) === 'tag', commit: peeled.ok ? text(peeled) : undefined };
}
function listTags(cwd, pattern) {
    const r = runGit(cwd, ['tag', '--list', pattern]);
    return r.ok ? text(r).split('\n').filter(Boolean) : [];
}
/** Creates an annotated tag. Never forces; an existing tag makes git fail and that failure is surfaced. */
function createAnnotatedTag(cwd, name, commit, message) {
    const r = runGit(cwd, ['tag', '-a', name, commit, '-m', message]);
    return r.ok ? { ok: true } : { ok: false, error: r.stderr || 'git tag failed' };
}
//# sourceMappingURL=gitRepo.js.map