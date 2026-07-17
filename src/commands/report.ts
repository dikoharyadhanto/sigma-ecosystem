import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { OPERATIONS_LOG_FILE } from '../config';
import { OperationLogEntry } from '../utils/operationLog';
import { findProjectRoot, fileExists } from '../utils/fs';
import { error } from '../utils/output';

// ── Filters ──────────────────────────────────────────────────────────────────

interface LogFilterOpts {
  status?: string;
  operation?: string;
  since?: string;
  until?: string;
  limit?: string;
  json?: boolean;
}

// Accepts an absolute ISO date/datetime, or a relative offset like "1d",
// "12h", "30m" (interpreted as "N units before now").
function parseTimeBound(value: string, flag: string): Date {
  const relative = value.match(/^(\d+)([dhm])$/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const msPerUnit = unit === 'd' ? 86_400_000 : unit === 'h' ? 3_600_000 : 60_000;
    return new Date(Date.now() - amount * msPerUnit);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid ${flag} value "${value}". Use an ISO date/time (e.g. 2026-07-15) or a relative offset (e.g. 1d, 12h, 30m).`
    );
  }
  return parsed;
}

function readAllEntries(projectRoot: string): OperationLogEntry[] {
  const filePath = path.join(projectRoot, OPERATIONS_LOG_FILE);
  if (!fileExists(filePath)) return [];

  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim().length > 0);
  const entries: OperationLogEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as OperationLogEntry);
    } catch {
      // Corrupt line — skip rather than fail the whole report.
    }
  }
  return entries;
}

function applyFilters(entries: OperationLogEntry[], opts: LogFilterOpts): OperationLogEntry[] {
  let result = entries;

  if (opts.status) {
    const status = opts.status.toLowerCase();
    if (status !== 'success' && status !== 'error') {
      throw new Error(`Invalid --status value "${opts.status}". Must be "success" or "error".`);
    }
    result = result.filter(e => e.status === status);
  }

  if (opts.operation) {
    const needle = opts.operation.toLowerCase();
    result = result.filter(e => e.operation.toLowerCase().includes(needle));
  }

  if (opts.since) {
    const since = parseTimeBound(opts.since, '--since');
    result = result.filter(e => new Date(e.timestamp).getTime() >= since.getTime());
  }

  if (opts.until) {
    const until = parseTimeBound(opts.until, '--until');
    result = result.filter(e => new Date(e.timestamp).getTime() <= until.getTime());
  }

  if (opts.limit) {
    const n = Number(opts.limit);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`Invalid --limit value "${opts.limit}". Must be a positive integer.`);
    }
    result = result.slice(-n);
  }

  return result;
}

function printFormatted(entries: OperationLogEntry[]): void {
  if (entries.length === 0) {
    console.log('No matching operations found.');
    return;
  }

  for (const entry of entries) {
    const label = entry.status.toUpperCase().padEnd(7);
    const suffix = entry.status === 'error' ? ` (exit ${entry.exit_code})` : '';
    console.log(`[${entry.timestamp}] ${label} ${entry.operation}${suffix}`);
  }
}

// ── Command handler ─────────────────────────────────────────────────────────

function runLogs(opts: LogFilterOpts): void {
  const projectRoot = findProjectRoot();
  const all = readAllEntries(projectRoot);
  const filtered = applyFilters(all, opts);

  if (opts.json) {
    for (const entry of filtered) {
      console.log(JSON.stringify(entry));
    }
    return;
  }

  printFormatted(filtered);
}

// ── Command builder ─────────────────────────────────────────────────────────

export function reportCommand(): Command {
  const cmd = new Command('report');
  cmd.description('Read-only reports derived from Sigma project state');

  cmd
    .command('logs')
    .description('View the operation history log (Sigma/logs/operations.jsonl)')
    .option('--status <status>', 'Filter by result: success or error')
    .option('--operation <text>', 'Filter by operation name (substring match, e.g. "intent")')
    .option('--since <when>', 'Only entries at or after this time (ISO date, or relative: 1d, 12h, 30m)')
    .option('--until <when>', 'Only entries at or before this time (ISO date, or relative: 1d, 12h, 30m)')
    .option('-n, --limit <count>', 'Show only the last N matching entries')
    .option('--json', 'Print raw JSONL instead of formatted log lines')
    .action((opts: LogFilterOpts) => {
      try {
        runLogs(opts);
      } catch (e) {
        error((e as Error).message);
      }
    });

  return cmd;
}
