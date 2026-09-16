"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGetOperationLog = computeGetOperationLog;
exports.registerGetOperationLogTool = registerGetOperationLogTool;
const zod_1 = require("zod");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../../config");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
function parseTimeBound(value, flag) {
    const relative = value.match(/^(\d+)([dhm])$/i);
    if (relative) {
        const amount = Number(relative[1]);
        const unit = relative[2].toLowerCase();
        const msPerUnit = unit === 'd' ? 86400000 : unit === 'h' ? 3600000 : 60000;
        return new Date(Date.now() - amount * msPerUnit);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Invalid ${flag} value "${value}". Use an ISO date/time or a relative offset (e.g. 1d, 12h, 30m).`);
    }
    return parsed;
}
function readAllEntries(root) {
    const filePath = path_1.default.join(root, config_1.OPERATIONS_LOG_FILE);
    if (!fs_extra_1.default.existsSync(filePath))
        return [];
    const lines = fs_extra_1.default.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim().length > 0);
    const entries = [];
    for (const line of lines) {
        try {
            entries.push(JSON.parse(line));
        }
        catch {
            // Corrupt line — skip rather than fail the whole report, same as CLI.
        }
    }
    return entries;
}
function computeGetOperationLog(root, filters) {
    if (!root)
        return (0, shared_1.noProject)({ entries: [] });
    let entries = readAllEntries(root);
    if (filters.status)
        entries = entries.filter((e) => e.status === filters.status);
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
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Invalid limit "${filters.limit}". Must be a positive integer.`);
        }
        entries = entries.slice(-filters.limit);
    }
    return { entries, source: shared_1.SOURCE_ENGINE };
}
function registerGetOperationLogTool(server) {
    server.registerTool('sigma_get_operation_log', {
        title: 'Get Sigma operation history log',
        description: 'Return entries from Sigma/logs/operations.jsonl — the query-plane equivalent of `sigma report logs`. ' +
            'Each entry is { operation, timestamp, status, exit_code } (no host paths or other sensitive data). ' +
            'Read-only. Filters: status (success|error), operation (substring), since/until (ISO date or relative ' +
            'offset like "1d"/"12h"/"30m"), limit (last N). Returns { entries, source }.',
        inputSchema: {
            status: zod_1.z.enum(['success', 'error']).optional(),
            operation: zod_1.z.string().optional().describe('Substring match against the operation name.'),
            since: zod_1.z.string().optional().describe('ISO date/time, or a relative offset like "1d", "12h", "30m".'),
            until: zod_1.z.string().optional().describe('ISO date/time, or a relative offset like "1d", "12h", "30m".'),
            limit: zod_1.z.number().int().positive().optional().describe('Return only the last N matching entries.'),
            project_root: zod_1.z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ status, operation, since, until, limit, project_root }) => (0, contract_1.respond)('sigma_get_operation_log', project_root, (root) => computeGetOperationLog(root, { status, operation, since, until, limit })));
}
//# sourceMappingURL=getOperationLog.js.map