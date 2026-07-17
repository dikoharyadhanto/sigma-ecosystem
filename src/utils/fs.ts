import fs from 'fs-extra';
import path from 'path';
import { ACTIVATE_STATUS_FILE } from '../config';

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

export function backupFile(filePath: string, backupDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const basename = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);
  const backupName = `${basename}-backup-${timestamp}${ext}`;
  const backupPath = path.join(backupDir, backupName);
  fs.ensureDirSync(backupDir);
  fs.copySync(filePath, backupPath);
  return backupPath;
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
