import fs from 'fs-extra';
import path from 'path';
import { OPERATIONS_LOG_FILE } from '../config';
import { findProjectRoot } from './fs';

export interface OperationLogEntry {
  operation: string;
  timestamp: string;
  status: 'success' | 'error';
  exit_code: number;
}

// Appends one JSONL line to Sigma/logs/operations.jsonl for the operation
// that just finished. No-ops outside a Sigma project (nothing to log to).
export function appendOperationLogEntry(operation: string, exitCode: number): void {
  let projectRoot: string;
  try {
    projectRoot = findProjectRoot();
  } catch {
    return;
  }

  const entry: OperationLogEntry = {
    operation,
    timestamp: new Date().toISOString(),
    status: exitCode === 0 ? 'success' : 'error',
    exit_code: exitCode,
  };

  const filePath = path.join(projectRoot, OPERATIONS_LOG_FILE);
  fs.ensureFileSync(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

// Ensures Sigma/logs/operations.jsonl exists and every line is valid JSON.
// Recreates it empty if missing or corrupt. Returns true if it was
// (re)initialized, so callers can decide whether to stamp a fresh
// logs_created_at on the identity file.
export function ensureOperationsLog(projectRoot: string): boolean {
  const filePath = path.join(projectRoot, OPERATIONS_LOG_FILE);

  let needsInit = !fs.existsSync(filePath);
  if (!needsInit) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
      try {
        JSON.parse(line);
      } catch {
        needsInit = true;
        break;
      }
    }
  }

  if (needsInit) {
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, '', 'utf8');
  }

  return needsInit;
}
