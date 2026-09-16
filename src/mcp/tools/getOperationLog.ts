// Stage B2 — sigma_get_operation_log. Query-plane equivalent of `sigma
// report logs`.
//
// The capability matrix (§3.1, pre-B2) carried a caveat that
// "operations.jsonl memuat path host" (contains host paths) — checked
// directly against src/utils/operationLog.ts's OperationLogEntry: {
// operation, timestamp, status, exit_code }. No path field of any kind.
// That caveat does not hold against the current implementation; nothing
// here needed redaction. Filter/parse logic (parseTimeBound, applyFilters)
// is duplicated in miniature from src/commands/report.ts rather than
// imported, to avoid pulling the commander dependency into this module —
// same rationale as every small pure-function duplication elsewhere in
// this MCP surface (e.g. roadmapService.ts).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import { OPERATIONS_LOG_FILE } from '../../config';
import { OperationLogEntry } from '../../utils/operationLog';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond, ERROR_CODES } from '../contract';
import { McpQueryError } from '../errors';

export interface GetOperationLogFilters {
  status?: 'success' | 'error';
  operation?: string;
  since?: string;
  until?: string;
  limit?: number;
}

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
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `Invalid ${flag} value "${value}". Use an ISO date/time or a relative offset (e.g. 1d, 12h, 30m).`
    );
  }
  return parsed;
}

// Allowlist projection, not a type cast: a JSONL line parses to `unknown`
// shape at runtime, and OperationLogEntry's declared fields say nothing about
// what a legacy or corrupt line might actually contain. Every field returned
// to the model is picked explicitly so an unexpected extra property (e.g. a
// host path from some other log format) can never pass through unfiltered.
function toSafeEntry(raw: unknown): OperationLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.operation !== 'string') return null;
  if (typeof r.timestamp !== 'string') return null;
  if (r.status !== 'success' && r.status !== 'error') return null;
  if (typeof r.exit_code !== 'number') return null;
  return { operation: r.operation, timestamp: r.timestamp, status: r.status, exit_code: r.exit_code };
}

function readAllEntries(root: string): OperationLogEntry[] {
  const filePath = path.join(root, OPERATIONS_LOG_FILE);
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim().length > 0);
  const entries: OperationLogEntry[] = [];
  for (const line of lines) {
    try {
      const safe = toSafeEntry(JSON.parse(line));
      if (safe) entries.push(safe);
    } catch {
      // Corrupt line — skip rather than fail the whole report, same as CLI.
    }
  }
  return entries;
}

export function computeGetOperationLog(root: string | null, filters: GetOperationLogFilters): unknown {
  if (!root) return noProject({ entries: [] });

  let entries = readAllEntries(root);

  if (filters.status) entries = entries.filter((e) => e.status === filters.status);
  if (filters.operation) {
    const needle = filters.operation.toLowerCase();
    entries = entries.filter((e) => e.operation.toLowerCase().includes(needle));
  }
  if (filters.since) {
    const since = parseTimeBound(filters.since, 'since');
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= since.getTime());
  }
  if (filters.until) {
    const until = parseTimeBound(filters.until, 'until');
    entries = entries.filter((e) => new Date(e.timestamp).getTime() <= until.getTime());
  }
  if (filters.limit) {
    if (!Number.isInteger(filters.limit) || filters.limit <= 0) {
      throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, `Invalid limit "${filters.limit}". Must be a positive integer.`);
    }
    entries = entries.slice(-filters.limit);
  }

  return { entries, source: SOURCE_ENGINE };
}

export function registerGetOperationLogTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_operation_log',
    {
      title: 'Get Sigma operation history log',
      description:
        'Return entries from Sigma/logs/operations.jsonl — the query-plane equivalent of `sigma report logs`. ' +
        'Each entry is { operation, timestamp, status, exit_code } (no host paths or other sensitive data). ' +
        'Read-only. Filters: status (success|error), operation (substring), since/until (ISO date or relative ' +
        'offset like "1d"/"12h"/"30m"), limit (last N). Returns { entries, source }.',
      inputSchema: {
        status: z.enum(['success', 'error']).optional(),
        operation: z.string().optional().describe('Substring match against the operation name.'),
        since: z.string().optional().describe('ISO date/time, or a relative offset like "1d", "12h", "30m".'),
        until: z.string().optional().describe('ISO date/time, or a relative offset like "1d", "12h", "30m".'),
        limit: z.number().int().positive().optional().describe('Return only the last N matching entries.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ status, operation, since, until, limit }: GetOperationLogFilters) =>
      respond('sigma_get_operation_log', undefined, (root) =>
        computeGetOperationLog(root, { status, operation, since, until, limit })
      )
  );
}
