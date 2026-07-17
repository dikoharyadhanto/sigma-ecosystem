"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportCommand = reportCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const fs_1 = require("../utils/fs");
const output_1 = require("../utils/output");
// Accepts an absolute ISO date/datetime, or a relative offset like "1d",
// "12h", "30m" (interpreted as "N units before now").
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
        throw new Error(`Invalid ${flag} value "${value}". Use an ISO date/time (e.g. 2026-07-15) or a relative offset (e.g. 1d, 12h, 30m).`);
    }
    return parsed;
}
function readAllEntries(projectRoot) {
    const filePath = path_1.default.join(projectRoot, config_1.OPERATIONS_LOG_FILE);
    if (!(0, fs_1.fileExists)(filePath))
        return [];
    const lines = fs_extra_1.default.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim().length > 0);
    const entries = [];
    for (const line of lines) {
        try {
            entries.push(JSON.parse(line));
        }
        catch {
            // Corrupt line — skip rather than fail the whole report.
        }
    }
    return entries;
}
function applyFilters(entries, opts) {
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
function printFormatted(entries) {
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
function runLogs(opts) {
    const projectRoot = (0, fs_1.findProjectRoot)();
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
function reportCommand() {
    const cmd = new commander_1.Command('report');
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
        .action((opts) => {
        try {
            runLogs(opts);
        }
        catch (e) {
            (0, output_1.error)(e.message);
        }
    });
    return cmd;
}
//# sourceMappingURL=report.js.map