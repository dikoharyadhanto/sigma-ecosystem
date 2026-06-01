"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionCommand = sessionCommand;
const commander_1 = require("commander");
const progress_1 = require("../engine/progress");
const registry_1 = require("../engine/registry");
const fs_1 = require("../utils/fs");
const mailbox_1 = require("../engine/mailbox");
const config_1 = require("../config");
const projectConfig_1 = require("../engine/projectConfig");
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
    const data = (0, progress_1.readProgress)(projectRoot);
    const gates = (0, progress_1.getGateStatus)(data);
    const stale = (0, progress_1.isStaleIntentPresent)(data);
    const nextOps = (0, progress_1.getNextValidOperations)(data);
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
    const projectConfig = (0, projectConfig_1.readProjectConfig)(projectRoot);
    console.log('\n=== Sigma Session Bootstrap ===\n');
    console.log(`Project:          ${data.project_name} (${data.project_id})`);
    console.log(`Lifecycle Phase:  ${data.lifecycle_state}`);
    // Director language preference — only surface when non-English to avoid noise
    if (projectConfig.document_language !== 'en' || projectConfig.interaction_language !== 'en') {
        console.log('\n--- Director Preferences ---');
        console.log(`  Document language:   ${(0, projectConfig_1.langLabel)(projectConfig.document_language)} (${projectConfig.document_language})`);
        console.log(`  Interaction:         ${(0, projectConfig_1.langLabel)(projectConfig.interaction_language)} (${projectConfig.interaction_language})`);
        console.log(`  Formal identifiers:  English (unchanged)`);
        console.log('');
        console.log(`  [LANG] Write document prose in ${(0, projectConfig_1.langLabel)(projectConfig.document_language)}.`);
        console.log('  [LANG] Keep Sigma artifact codes, CLI commands, filenames, and state names unchanged.');
    }
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
            if (config_1.MESSAGING_ROLES.includes(role)) {
                const allUnread = (0, mailbox_1.getUnreadForRole)(index, role);
                const total = allUnread.length;
                const shown = allUnread.slice(-3).reverse();
                if (total > 0) {
                    console.log(`\n--- Role Inbox — ${role} ---`);
                    if (total > shown.length) {
                        console.log(`${total} unread messages (showing latest ${shown.length}):`);
                    }
                    else {
                        console.log(`${total} unread message${total > 1 ? 's' : ''}:`);
                    }
                    shown.forEach((m, i) => {
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
            // Group unread by messaging roles — show up to 3 per role that has messages
            const byRole = {};
            for (const role of config_1.MESSAGING_ROLES) {
                const allUnread = (0, mailbox_1.getUnreadForRole)(index, role);
                if (allUnread.length > 0) {
                    byRole[role] = { total: allUnread.length, shown: allUnread.slice(-3).reverse() };
                }
            }
            const rolesWithMessages = Object.keys(byRole);
            if (rolesWithMessages.length > 0) {
                console.log('\n--- Role Mailbox — Unread Messages ---');
                for (const role of rolesWithMessages) {
                    const { total, shown } = byRole[role];
                    const suffix = total > shown.length ? ` (showing latest ${shown.length} of ${total})` : '';
                    console.log(`\n  ${role} (${total} unread${suffix})`);
                    shown.forEach((m, i) => {
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
    const BOOTSTRAP_VALID_ROLES = ['ARC', 'FMN', 'DEV', 'AUD'];
    cmd
        .command('bootstrap')
        .description('Display current project state for session start')
        .option('--role <role>', `Filter document list to role-specific reads (${BOOTSTRAP_VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .action((opts) => {
        try {
            if (opts.role) {
                const upper = opts.role.toUpperCase();
                if (!BOOTSTRAP_VALID_ROLES.includes(upper)) {
                    console.error(`Invalid role "${opts.role}". Valid roles: ${BOOTSTRAP_VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`);
                    process.exit(1);
                }
                opts.role = upper;
            }
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