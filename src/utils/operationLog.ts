import fs from 'fs-extra';
import path from 'path';
import { OPERATIONS_LOG_FILE } from '../config';
import { findProjectRoot } from './fs';

interface RegistryOperation {
  operation_id: string;
  level?: string;
}

let registryLevels: Map<string, string> | null = null;

function operationLevels(): Map<string, string> {
  if (registryLevels) return registryLevels;
  const registryPath = path.resolve(__dirname, '..', '..', 'Sigma', 'SIGMA-OPERATION-REGISTRY.json');
  try {
    const registry = fs.readJsonSync(registryPath) as { operations?: RegistryOperation[] };
    registryLevels = new Map((registry.operations ?? []).map(operation => [operation.operation_id, operation.level ?? '']));
  } catch {
    // Fail closed: an unreadable registry must never suppress an audit entry.
    registryLevels = new Map();
  }
  return registryLevels;
}

export function operationIdForCommandPath(commandPath: string): string {
  return commandPath.trim().replace(/[\s-]+/g, '_');
}

export function isRegisteredReadOnlyOperation(commandPath: string): boolean {
  return operationLevels().get(operationIdForCommandPath(commandPath)) === 'read_only';
}

export interface OperationLogEntry {
  operation: string;
  timestamp: string;
  status: 'success' | 'error';
  exit_code: number;
}

// Appends one JSONL line to Sigma/logs/operations.jsonl for a mutating or
// governance-significant operation that just finished. Read-only operations
// are filtered by the CLI before this function is called so observation does
// not change the project it is inspecting. No-ops outside a Sigma project.
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
