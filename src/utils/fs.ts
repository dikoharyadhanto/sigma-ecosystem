import fs from 'fs-extra';
import path from 'path';
import { ACTIVATE_STATUS_FILE, PROJECT_IDENTITY_FILE, PROJECT_SIGMA_DIR } from '../config';

export function ensureDir(dir: string): void {
  fs.ensureDirSync(dir);
}

export function copyFile(src: string, dest: string): void {
  fs.ensureDirSync(path.dirname(dest));
  fs.copySync(src, dest, { overwrite: true });
}

export function copyDir(src: string, dest: string): void {
  fs.copySync(src, dest, { overwrite: true });
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
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

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function atomicReplaceFileSync(tmpPath: string, destPath: string): void {
  const deadline = Date.now() + RENAME_RETRY_BUDGET_MS;
  for (;;) {
    try {
      fs.renameSync(tmpPath, destPath);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
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
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

// PLAN-EVAL-01 Fase 5 — anchors on Sigma/activate_status.json (written by
// `sigma project start`/`--reinit`), not Sigma/progress.json. That file is
// legacy/inert now (nothing reads its content, PLAN-EVAL-01 §3.6) and this
// anchor could only move here once every project-creating path
// unconditionally wrote activate_status.json too (done in Fase 4).
export function findProjectRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, ACTIVATE_STATUS_FILE);
    if (fs.existsSync(candidate)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(
        'Not inside a Sigma project. No Sigma/activate_status.json found in this directory or any parent. ' +
        'Run: sigma project start'
      );
    }

    current = parent;
  }
}

// ── Cross-machine guardrail (PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY §3.1) ──
//
// With gitignore ON, `.sigma-identity.json` is the only Sigma file in Git. A
// clone on another machine therefore holds the identity but no `Sigma/` folder.
// Re-registering there would mint a second, diverging Sigma state for the same
// project, so every Sigma operation is refused instead.

export type ProjectRegistrationState =
  | 'REGISTERED_COMPLETE'
  | 'IDENTITY_ONLY_MISSING_SIGMA'
  | 'UNREGISTERED';

export interface ProjectRegistrationInspection {
  state: ProjectRegistrationState;
  /** Directory that holds the identity (or the whole project); null when UNREGISTERED. */
  root: string | null;
  projectId: string | null;
  projectName: string | null;
}

function readRegisteredIdentity(dir: string): { projectId: string; projectName: string } | null {
  const file = path.join(dir, PROJECT_IDENTITY_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed: unknown = fs.readJsonSync(file);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const identity = parsed as { registered?: unknown; project_id?: unknown; project_name?: unknown };
    if (identity.registered !== true || typeof identity.project_id !== 'string') return null;
    return {
      projectId: identity.project_id,
      projectName: typeof identity.project_name === 'string' ? identity.project_name : identity.project_id,
    };
  } catch {
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
export function inspectProjectRegistrationState(
  startDir: string = process.cwd(),
  options: { exact?: boolean } = {},
): ProjectRegistrationInspection {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, ACTIVATE_STATUS_FILE))) {
      return { state: 'REGISTERED_COMPLETE', root: current, projectId: null, projectName: null };
    }
    const identity = readRegisteredIdentity(current);
    if (identity && !fs.existsSync(path.join(current, PROJECT_SIGMA_DIR))) {
      return { state: 'IDENTITY_ONLY_MISSING_SIGMA', root: current, projectId: identity.projectId, projectName: identity.projectName };
    }
    const parent = path.dirname(current);
    if (options.exact || parent === current) {
      return { state: 'UNREGISTERED', root: null, projectId: null, projectName: null };
    }
    current = parent;
  }
}

export function missingSigmaFilesMessage(projectId: string, projectName: string): string {
  return [
    '[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]',
    `This project was previously registered with Sigma (detected via ${PROJECT_IDENTITY_FILE}: ${projectId} — "${projectName}"),`,
    'but the Sigma runtime files (Sigma/) were not found on this machine.',
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

export class MissingSigmaFilesError extends Error {
  constructor(public readonly projectId: string, public readonly projectName: string) {
    super(missingSigmaFilesMessage(projectId, projectName));
    this.name = 'MissingSigmaFilesError';
  }
}

/** Throws MissingSigmaFilesError when only the identity file is present. Any other state passes. */
export function assertSigmaFilesPresentOrThrow(startDir: string = process.cwd(), options: { exact?: boolean } = {}): void {
  const inspection = inspectProjectRegistrationState(startDir, options);
  if (inspection.state === 'IDENTITY_ONLY_MISSING_SIGMA') {
    throw new MissingSigmaFilesError(inspection.projectId ?? 'UNKNOWN', inspection.projectName ?? 'UNKNOWN');
  }
}
