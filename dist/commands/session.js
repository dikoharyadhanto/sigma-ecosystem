"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionCommand = sessionCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const progress_1 = require("../engine/progress");
const registry_1 = require("../engine/registry");
const fs_1 = require("../utils/fs");
const mailbox_1 = require("../engine/mailbox");
const config_1 = require("../config");
// ── CSO log reader ────────────────────────────────────────────────────────────
function recentCsoFiles(data, sigmaDir) {
    // Prefer CSO entries from progress.json if available
    if (data.cso.length > 0) {
        return data.cso
            .slice(-3)
            .reverse()
            .map(e => e.file);
    }
    // Fallback: scan Sigma/logs/ for CSO-*.md files by mtime
    const logsDir = path_1.default.join(sigmaDir, 'logs');
    if (!fs_extra_1.default.existsSync(logsDir))
        return [];
    try {
        const files = fs_extra_1.default.readdirSync(logsDir)
            .filter(f => f.startsWith('CSO-') && f.endsWith('.md'))
            .map(f => ({ name: f, mtime: fs_extra_1.default.statSync(path_1.default.join(logsDir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime)
            .slice(0, 3)
            .map(f => f.name);
        return files;
    }
    catch {
        return [];
    }
}
// ── Format helpers ────────────────────────────────────────────────────────────
function fmtVersion(v) {
    return v ?? 'none';
}
function fmtState(s) {
    return s ?? '—';
}
function fmtGate(open, satisfiedLabel = 'OPEN') {
    return open ? satisfiedLabel : 'BLOCKED';
}
// ── sigma session bootstrap ───────────────────────────────────────────────────
function runBootstrap(opts) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const sigmaDir = path_1.default.join(projectRoot, 'Sigma');
    const data = (0, progress_1.readProgress)(projectRoot);
    const gates = (0, progress_1.getGateStatus)(data);
    const stale = (0, progress_1.isStaleIntentPresent)(data);
    const nextOps = (0, progress_1.getNextValidOperations)(data);
    const csoFiles = recentCsoFiles(data, sigmaDir);
    // Document registry (tolerate missing)
    let docEntries = [];
    try {
        const docRegistry = (0, registry_1.loadDocumentRegistry)(projectRoot);
        docEntries = (0, registry_1.getDocumentsForRole)(docRegistry, opts.role ?? null);
    }
    catch {
        // registry missing — continue without it
    }
    // Operation registry (tolerate missing — used for display only in Phase 3)
    try {
        (0, registry_1.loadOperationRegistry)(projectRoot);
    }
    catch {
        // tolerate missing in Phase 3
    }
    // ── Output ─────────────────────────────────────────────────────────────────
    console.log('\n=== Sigma Session Bootstrap ===\n');
    console.log(`Project:          ${data.project_name} (${data.project_id})`);
    console.log(`Lifecycle Phase:  ${data.lifecycle_state}`);
    const artifactLine = (label, code, version, state) => {
        const display = version !== 'none' ? `${label} (${code} ${version})` : `${label} (${code})`;
        return `${display.padEnd(40)} [${fmtState(state)}]`;
    };
    console.log('\n--- Artifact Status ---');
    console.log(artifactLine('Intent Doc', 'DIR-INTENT', fmtVersion(data.intent.active_version), data.intent.active_state));
    console.log(artifactLine('Plan Doc', 'FMN-PLAN', fmtVersion(data.plan.active_version), data.plan.active_state));
    console.log(artifactLine('Execution Evidence', 'DEV-EXEC', fmtVersion(data.exec.active_version), data.exec.active_state));
    console.log(artifactLine('Closure Doc', 'DIR-CLOSE', fmtVersion(data.close.active_version), data.close.active_state));
    console.log(artifactLine('Roadmap Doc', 'ROADMAP', fmtVersion(data.roadmap.active_version), data.roadmap.active_state));
    console.log('\n--- Gate Status ---');
    console.log(`Gate 1 (Design Complete):   ${fmtGate(gates.gate_1_open)}`);
    console.log(`Gate 2 (Plan Locked):       ${fmtGate(gates.gate_2_open)}`);
    console.log(`Gate 3 (Build Evidence):    ${fmtGate(gates.gate_3_satisfied, 'SATISFIED')}`);
    console.log('\n--- STALE_INTENT Warnings ---');
    if (stale.length > 0) {
        for (const w of stale) {
            console.log(`  [STALE] ${w.domain} ${w.version}`);
        }
    }
    else {
        console.log('  none');
    }
    console.log('\n--- Recent CSO Files ---');
    if (csoFiles.length > 0) {
        for (const f of csoFiles) {
            console.log(`  ${f}`);
        }
    }
    else {
        console.log('  none');
    }
    console.log('\n--- Next Valid Operations ---');
    if (nextOps.length > 0) {
        for (const op of nextOps) {
            console.log(`  sigma ${op}`);
        }
    }
    else {
        console.log('  none');
    }
    console.log('\n--- Documents to Read ---');
    const roleLabel = opts.role ? ` (role: ${opts.role.toUpperCase()})` : '';
    console.log(`  Reading list${roleLabel}:`);
    if (docEntries.length > 0) {
        for (const doc of docEntries) {
            const loc = doc.location === 'project root' ? '' : `${doc.location}`;
            const filePath = loc ? `${loc}${doc.file}` : doc.file;
            console.log(`  - ${filePath}`);
        }
    }
    else {
        // Fallback when registry is unavailable
        console.log('  - Sigma/SIGMA_CONSTITUTION.md');
        console.log('  - Sigma/SIGMA_PROTOCOL.md');
        console.log('  - Sigma/progress.json');
        if (opts.role) {
            console.log(`  - Sigma/rules/${opts.role.toUpperCase()}-RULE.md`);
        }
    }
    // ── Role Mailbox ───────────────────────────────────────────────────────────
    try {
        const index = (0, mailbox_1.readIndex)(projectRoot);
        if (opts.role) {
            const role = opts.role.toUpperCase();
            if (config_1.VALID_ROLES.includes(role)) {
                const unread = (0, mailbox_1.getUnreadForRole)(index, role).slice(-3).reverse();
                if (unread.length > 0) {
                    console.log(`\n--- Role Inbox — ${role} ---`);
                    console.log(`${unread.length} unread message${unread.length > 1 ? 's' : ''}:`);
                    unread.forEach((m, i) => {
                        console.log(`\n  ${i + 1}. [${m.from} → ${m.to}] ${m.type}: ${m.subject}`);
                        console.log(`     File: ${m.file}`);
                        if (m.attachments.length > 0) {
                            console.log(`     Attach: ${m.attachments[0]}`);
                        }
                    });
                    console.log(`\n  Run: sigma inbox --role ${role.toLowerCase()}`);
                }
            }
        }
        else {
            // Group unread by role — show up to 3 per role that has messages
            const byRole = {};
            for (const role of config_1.VALID_ROLES) {
                const unread = (0, mailbox_1.getUnreadForRole)(index, role).slice(-3).reverse();
                if (unread.length > 0)
                    byRole[role] = unread;
            }
            const rolesWithMessages = Object.keys(byRole);
            if (rolesWithMessages.length > 0) {
                console.log('\n--- Role Mailbox — Unread Messages ---');
                for (const role of rolesWithMessages) {
                    const msgs = byRole[role];
                    console.log(`\n  ${role} (${msgs.length} unread)`);
                    msgs.forEach((m, i) => {
                        console.log(`  ${i + 1}. [${m.from} → ${m.to}] ${m.type}: ${m.subject}`);
                    });
                }
                console.log('\n  Run: sigma inbox --role <role>    sigma inbox read <id>');
            }
        }
    }
    catch {
        // index.json absent or unreadable — skip silently
    }
    console.log('');
}
// ── Command builder ───────────────────────────────────────────────────────────
function sessionCommand() {
    const cmd = new commander_1.Command('session');
    cmd.description('Session management commands');
    cmd
        .command('bootstrap')
        .description('Display current project state for session start')
        .option('--role <role>', 'Filter document list to role-specific reads (ARC, AUD, FMN, DEV)')
        .action((opts) => {
        try {
            runBootstrap(opts);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=session.js.map