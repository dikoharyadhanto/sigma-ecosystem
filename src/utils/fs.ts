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
