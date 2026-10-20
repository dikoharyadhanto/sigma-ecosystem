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

import fs from 'fs-extra';
import path from 'path';
import { spawnSync } from 'child_process';
import { PROJECT_IDENTITY_FILE } from '../config';

export const GITIGNORE_BLOCK_START = '# >>> sigma-managed >>>';
export const GITIGNORE_BLOCK_END = '# <<< sigma-managed <<<';

/** Paths (repo-relative, as `git ls-files` sees them) that Sigma detaches from the index. Never includes the identity file or product code under dev/. */
export const SIGMA_GITIGNORE_TARGET_PATHS = [
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
] as const;

/** Rules written inside the managed block, in order. Root-anchored so a same-named file deeper in the tree is never caught. */
export const SIGMA_GITIGNORE_RULES: readonly string[] = [
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
  `!/${PROJECT_IDENTITY_FILE}`,
];

export function renderGitignoreBlock(): string {
  return [
    GITIGNORE_BLOCK_START,
    '# Managed by Sigma CLI (sigma config set gitignore on|off)',
    '# Do not edit inside this block manually.',
    ...SIGMA_GITIGNORE_RULES,
    GITIGNORE_BLOCK_END,
  ].join('\n');
}

function gitignorePath(projectRoot: string): string {
  return path.join(projectRoot, '.gitignore');
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/** Index range of the managed block (start line through end line, inclusive of its trailing newline), or null. */
function findBlock(text: string): { start: number; end: number } | null {
  const start = text.indexOf(GITIGNORE_BLOCK_START);
  if (start === -1) return null;
  const endMarker = text.indexOf(GITIGNORE_BLOCK_END, start);
  if (endMarker === -1) return null;
  let end = endMarker + GITIGNORE_BLOCK_END.length;
  if (text.startsWith('\r\n', end)) end += 2;
  else if (text[end] === '\n') end += 1;
  return { start, end };
}

export type GitignoreChange = 'created' | 'updated' | 'unchanged' | 'removed' | 'absent';

/**
 * Writes (or refreshes) the managed block. Content outside the markers is kept
 * byte-for-byte. A missing .gitignore is created. Idempotent.
 */
export function applyGitignoreBlock(projectRoot: string): GitignoreChange {
  const file = gitignorePath(projectRoot);
  const existed = fs.existsSync(file);
  const current = existed ? fs.readFileSync(file, 'utf8') : '';
  const eol = existed ? detectEol(current) : '\n';
  const block = renderGitignoreBlock().replace(/\n/g, eol);

  let next: string;
  const found = findBlock(current);
  if (found) {
    next = current.slice(0, found.start) + block + eol + current.slice(found.end);
  } else if (current.length === 0) {
    next = block + eol;
  } else {
    const separator = current.endsWith('\n') ? eol : eol + eol;
    next = current + separator + block + eol;
  }

  if (next === current) return 'unchanged';
  fs.writeFileSync(file, next);
  return existed ? 'updated' : 'created';
}

/** Removes the managed block and nothing else. A .gitignore left empty by that is kept (never deleted). */
export function removeGitignoreBlock(projectRoot: string): GitignoreChange {
  const file = gitignorePath(projectRoot);
  if (!fs.existsSync(file)) return 'absent';
  const current = fs.readFileSync(file, 'utf8');
  const found = findBlock(current);
  if (!found) return 'absent';
  let before = current.slice(0, found.start);
  const after = current.slice(found.end);
  // Drop the blank separator line applyGitignoreBlock added in front of the block.
  const eol = detectEol(current);
  if (before.endsWith(eol + eol)) before = before.slice(0, -eol.length);
  fs.writeFileSync(file, before + after);
  return 'removed';
}

export function hasGitignoreBlock(projectRoot: string): boolean {
  const file = gitignorePath(projectRoot);
  return fs.existsSync(file) && findBlock(fs.readFileSync(file, 'utf8')) !== null;
}

// ── Git index cleanup (never touches the working tree) ───────────────────────

function git(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE']) delete env[key];
  const r = spawnSync('git', args, { cwd, env, encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
  if (r.error) return { ok: false, stdout: '', stderr: r.error.message };
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: (r.stderr ?? '').trim() };
}

export interface UntrackResult {
  /** False when there is no usable Git working tree; nothing was attempted. */
  gitAvailable: boolean;
  /** Index entries that were detached (count, not paths — Sigma/ can hold thousands). */
  untracked: number;
  /** Paths (from SIGMA_GITIGNORE_TARGET_PATHS) that had at least one tracked entry. */
  paths: string[];
  error?: string;
}

/**
 * Detaches Sigma files from the Git index with `git rm -r --cached`. The files
 * stay on disk. The caller commits the resulting deletion; Sigma never commits.
 *
 * Pathspecs are relative to `projectRoot` (the command's cwd), so a project
 * nested inside a larger repository only ever touches its own files.
 */
export function untrackSigmaFilesFromGitIndex(projectRoot: string): UntrackResult {
  const inside = git(projectRoot, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || inside.stdout.trim() !== 'true') return { gitAvailable: false, untracked: 0, paths: [] };

  const listed = git(projectRoot, ['ls-files', '-z', '--', ...SIGMA_GITIGNORE_TARGET_PATHS]);
  if (!listed.ok) return { gitAvailable: true, untracked: 0, paths: [], error: listed.stderr };

  const entries = listed.stdout.split('\0').filter(Boolean);
  if (entries.length === 0) return { gitAvailable: true, untracked: 0, paths: [] };

  const touched = SIGMA_GITIGNORE_TARGET_PATHS.filter(target =>
    entries.some(entry => entry === target || entry.startsWith(target + '/')));

  const removed = git(projectRoot, ['rm', '-r', '--cached', '--quiet', '--ignore-unmatch', '--', ...touched]);
  if (!removed.ok) return { gitAvailable: true, untracked: 0, paths: [], error: removed.stderr };
  return { gitAvailable: true, untracked: entries.length, paths: [...touched] };
}
