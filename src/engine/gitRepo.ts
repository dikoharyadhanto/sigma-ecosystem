// F05 W1 — minimal, shell-free Git adapter for the INTENT amendment flow.
// Sigma only ever *reads* Git state and, at the single effective point of an
// amendment/baseline, runs `git tag`. It never stages, commits, checks out,
// resets, fetches or pushes (F05 §2 items 8-9). Every call uses spawnSync with
// an argument vector (no shell) and pathspecs after `--`.

import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface GitResult {
  ok: boolean;
  code: number | null;
  stdout: Buffer;
  stderr: string;
  /** Set when git could not be spawned at all (not installed / not on PATH). */
  spawnError?: string;
}

const MAX_BUFFER = 256 * 1024 * 1024;

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  // Never let an inherited environment redirect Sigma to a different repository.
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_NAMESPACE']) delete env[key];
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_OPTIONAL_LOCKS = '0';
  return env;
}

export function runGit(cwd: string, args: string[]): GitResult {
  const r = spawnSync('git', args, { cwd, env: gitEnv(), maxBuffer: MAX_BUFFER, windowsHide: true });
  if (r.error) return { ok: false, code: null, stdout: Buffer.alloc(0), stderr: '', spawnError: r.error.message };
  return { ok: r.status === 0, code: r.status, stdout: r.stdout ?? Buffer.alloc(0), stderr: (r.stderr ?? Buffer.alloc(0)).toString('utf8').trim() };
}

const text = (r: GitResult): string => r.stdout.toString('utf8').trim();

export const sha256Hex = (bytes: string | Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');

/** Hash of the content with CRLF folded to LF — comparable across `core.autocrlf` settings (F05 R-1). */
export function lfSha256(bytes: Buffer): string {
  return sha256Hex(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
}

export function gitAvailable(cwd: string): { ok: boolean; version?: string; error?: string } {
  const r = runGit(cwd, ['--version']);
  if (r.spawnError) return { ok: false, error: r.spawnError };
  return r.ok ? { ok: true, version: text(r) } : { ok: false, error: r.stderr || 'git --version failed' };
}

export function repoToplevel(cwd: string): { ok: true; root: string } | { ok: false; error: string } {
  const r = runGit(cwd, ['rev-parse', '--show-toplevel']);
  if (!r.ok) return { ok: false, error: r.spawnError ?? (r.stderr || 'not inside a Git working tree') };
  return { ok: true, root: text(r) };
}

/** Path of `absFile` relative to the repository top level, forward-slashed. Throws if outside it. */
export function repoRelativePath(repoRoot: string, absFile: string): string {
  const top = fs.realpathSync.native(path.resolve(repoRoot));
  const file = fs.realpathSync.native(absFile);
  const rel = path.relative(top, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`File is outside the Git working tree: ${absFile}`);
  return rel.split(path.sep).join('/');
}

export function isTracked(cwd: string, rel: string): boolean {
  return runGit(cwd, ['ls-files', '--error-unmatch', '--', rel]).ok;
}

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._\/@{}^~-]*$/;

/** Resolve a user-supplied ref to a full commit SHA. Ranges, options and path-like specs are rejected. */
export function resolveCommit(cwd: string, ref: string): { ok: true; sha: string } | { ok: false; error: string } {
  if (typeof ref !== 'string' || !SAFE_REF.test(ref) || ref.includes('..')) return { ok: false, error: `Invalid commit reference: "${ref}"` };
  const r = runGit(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  if (!r.ok) return { ok: false, error: `Commit not found: ${ref}` };
  return { ok: true, sha: text(r) };
}

export function blobAt(cwd: string, commit: string, rel: string): Buffer | null {
  const r = runGit(cwd, ['cat-file', 'blob', `${commit}:${rel}`]);
  return r.ok ? r.stdout : null;
}

export function isAncestor(cwd: string, ancestor: string, descendant: string): boolean {
  return runGit(cwd, ['merge-base', '--is-ancestor', ancestor, descendant]).ok;
}

/** `git status --porcelain` for one path; empty string means clean. */
export function pathStatus(cwd: string, rel: string): string {
  const r = runGit(cwd, ['status', '--porcelain', '--', rel]);
  return r.ok ? text(r) : `(status unavailable: ${r.stderr})`;
}

export function commitsTouching(cwd: string, afterCommit: string, rel: string): string[] {
  const r = runGit(cwd, ['log', '--format=%H', `${afterCommit}..HEAD`, '--', rel]);
  return r.ok ? text(r).split('\n').filter(Boolean) : [];
}

/** Diff of the commit against the working tree for one path (line-ending conversion follows Git's own filters). */
export function diffAgainstWorktree(cwd: string, commit: string, rel: string): { stat: string; patch: string } {
  const common = ['diff', '--no-color', '--no-ext-diff', '--no-textconv'];
  const stat = runGit(cwd, [...common, '--stat', commit, '--', rel]);
  const patch = runGit(cwd, [...common, commit, '--', rel]);
  return { stat: stat.ok ? text(stat) : '', patch: patch.ok ? patch.stdout.toString('utf8') : '' };
}

export interface TagInfo {
  name: string;
  exists: boolean;
  annotated?: boolean;
  /** Commit the tag peels to. */
  commit?: string;
}

export function validTagName(cwd: string, name: string): boolean {
  return runGit(cwd, ['check-ref-format', `refs/tags/${name}`]).ok;
}

export function readTag(cwd: string, name: string): TagInfo {
  const ref = `refs/tags/${name}`;
  const exists = runGit(cwd, ['rev-parse', '--verify', '--quiet', ref]);
  if (!exists.ok) return { name, exists: false };
  const type = runGit(cwd, ['cat-file', '-t', ref]);
  const peeled = runGit(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return { name, exists: true, annotated: text(type) === 'tag', commit: peeled.ok ? text(peeled) : undefined };
}

export function listTags(cwd: string, pattern: string): string[] {
  const r = runGit(cwd, ['tag', '--list', pattern]);
  return r.ok ? text(r).split('\n').filter(Boolean) : [];
}

/** Creates an annotated tag. Never forces; an existing tag makes git fail and that failure is surfaced. */
export function createAnnotatedTag(cwd: string, name: string, commit: string, message: string): { ok: boolean; error?: string } {
  const r = runGit(cwd, ['tag', '-a', name, commit, '-m', message]);
  return r.ok ? { ok: true } : { ok: false, error: r.stderr || 'git tag failed' };
}
