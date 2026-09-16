import fs from 'fs-extra';
import path from 'path';
import { ACTIVATE_STATUS_FILE, PROJECT_REMOTE_STATE_FILE } from '../config';

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
  // PLAN-IMPL-NOTION-REMOTE-GOVERNANCE-INTEGRATION-V2 D-03 — only tracked to
  // enrich the error message below. Does not change anchor/success behavior
  // at all: a directory with this marker but no activate_status.json still
  // fails to resolve, exactly as before this field existed.
  let remoteStateMarkerPath: string | undefined;

  while (true) {
    const candidate = path.join(current, ACTIVATE_STATUS_FILE);
    if (fs.existsSync(candidate)) {
      return current;
    }

    if (!remoteStateMarkerPath) {
      const markerCandidate = path.join(current, PROJECT_REMOTE_STATE_FILE);
      if (fs.existsSync(markerCandidate)) {
        remoteStateMarkerPath = markerCandidate;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      if (remoteStateMarkerPath) {
        try {
          const marker = fs.readJsonSync(remoteStateMarkerPath);
          throw new Error(
            `This project's Sigma state was moved to Notion on ${marker.pushed_at} (chain ${marker.chain_version}). ` +
            'Run: sigma notion pull-state — to restore it before continuing.'
          );
        } catch (err) {
          if (err instanceof Error && err.message.startsWith("This project's Sigma state was moved")) throw err;
          // Marker exists but is unreadable — fall through to the generic error.
        }
      }
      throw new Error(
        'Not inside a Sigma project. No Sigma/activate_status.json found in this directory or any parent. ' +
        'Run: sigma project start'
      );
    }

    current = parent;
  }
}
