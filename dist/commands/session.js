"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionCommand = sessionCommand;
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const registry_1 = require("../engine/registry");
const mailbox_1 = require("../engine/mailbox");
const config_1 = require("../config");
const projectConfig_1 = require("../engine/projectConfig");
const bootstrapView_1 = require("../session/bootstrapView");
// ── Format helpers ────────────────────────────────────────────────────────────
function fmtVersion(v) {
    return v ?? 'none';
}
function fmtState(s) {
    return s ?? '—';
}
function getRoleGuidance(role, gate2Open) {
    switch (role) {
        case 'ARC':
            return {
                routine: [
                    'Clarify whether this is discussion-only or intent-documentation work.',
                    'If the Director opens intent work, begin intent clarification before any broader inspection.',
                ],
                approval: [
                    'Opening a new DIR-INTENT workflow.',
                    'Any lock, supersession, risk acceptance, or closure action.',
                ],
                stopPoint: 'Stop after clarifying whether to open DIR-INTENT; do not inspect broader artifacts unless the Director explicitly asks.',
            };
        case 'FMN':
            return {
                routine: [
                    'Orient to runtime state and the ROADMAP if planning direction needs confirmation.',
                    'Brief the Director on pending plans, roadmap direction, latest progress, and planning options.',
                ],
                approval: [
                    'Creating, promoting, or locking an FMN-PLAN.',
                    'Any supersession, risk acceptance, or closure action.',
                ],
                stopPoint: 'Stop after briefing planning options and wait for the Director to select the next planning direction.',
            };
        case 'DEV':
            return {
                routine: [
                    gate2Open
                        ? 'Gate 2 is open: identify the runtime-selected locked plan and prepare DEV-EXEC pre-implementation planning.'
                        : 'Gate 2 is blocked: report the blocker and wait for a locked FMN-PLAN before execution work.',
                    'Stay within the locked FMN-PLAN scope and queue FMN review before material implementation.',
                ],
                approval: [
                    'Material implementation after pre-build review.',
                    'Any lock, supersession, risk acceptance, closure, git commit, or git push.',
                ],
                stopPoint: 'Stop after pre-implementation planning and FMN review request, then stop again after post-build evidence is complete.',
            };
        case 'AUD':
            return {
                routine: [
                    'Confirm the exact artifact, evidence package, or question the Director wants audited.',
                    'Review only the files or evidence explicitly provided or authorized.',
                ],
                approval: [
                    'Any Sigma CLI command or local inspection beyond the exact authorized scope.',
                    'Any attempt to mutate runtime state, approve, reject, or lock artifacts.',
                ],
                stopPoint: 'Stop until the Director provides or authorizes the exact audit evidence scope.',
            };
        default:
            return null;
    }
}
function printReferenceDocuments(opts, docEntries) {
    console.log('\n--- Reference Documents ---');
    const roleLabel = opts.role ? ` (role: ${opts.role.toUpperCase()})` : '';
    console.log(`  Reference list${roleLabel}:`);
    if (docEntries.length > 0) {
        for (const doc of docEntries) {
            const loc = doc.location === 'project root' ? '' : `${doc.location}`;
            const filePath = loc ? `${loc}${doc.file}` : doc.file;
            console.log(`  - ${filePath}`);
        }
        return;
    }
    if (opts.role) {
        console.log(`  - Sigma/role-memory/${opts.role.toLowerCase()}-memory.json`);
        console.log(`  - Sigma/rules/${opts.role.toUpperCase()}-RULE.md`);
    }
    else {
        console.log('  none');
    }
}
// ── sigma session bootstrap ───────────────────────────────────────────────────
function runBootstrap(opts) {
    // PLAN-IMPL-01 Stage 1 — data assembly extracted to buildBootstrapView so the
    // MCP orientation tool can reuse it without any console output. The printing
    // below is unchanged and must stay byte-identical (regression: role-memory-
    // bootstrap.test.ts, lifecycle-hardening.test.ts).
    const { projectRoot, identity, chainVersion, chain, gates, nextOps } = (0, bootstrapView_1.buildBootstrapView)();
    const role = opts.role?.toUpperCase();
    const roleGuidance = getRoleGuidance(role, gates?.gate_2_open ?? false);
    let docEntries = [];
    if (opts.showDocs) {
        try {
            const docRegistry = (0, registry_1.loadDocumentRegistry)(projectRoot);
            docEntries = (0, registry_1.getDocumentsForRole)(docRegistry, opts.role ?? null);
        }
        catch {
            // registry missing — continue with fallback references
        }
    }
    // ── Output ─────────────────────────────────────────────────────────────────
    const projectConfig = (0, projectConfig_1.readProjectConfig)(projectRoot);
    console.log('\n=== Sigma Session Bootstrap ===\n');
    console.log(`Project:          ${identity.project_name} (${identity.project_id})`);
    // PLAN-EVAL-01 — mandatory, prominent (DISCUSSION "Konsolidasi Lanjutan"
    // bagian 6): `intent activate` doesn't require --director-confirm, so
    // bootstrap is the compensating visibility for which chain is active.
    console.log(`Active Chain:     ${chainVersion ?? 'none — no DIR-INTENT yet'}`);
    console.log(`Lifecycle Phase:  ${chain?.lifecycle_state ?? '—'}`);
    // Director language preferences — always shown, even at default.
    console.log('\n--- Director Preferences ---');
    console.log(`  AI Communication Language:    ${projectConfig.interaction_language}`);
    console.log(`  Sigma Docs Language:          ${projectConfig.document_language}`);
    console.log(`  Output Doc Written Language:  ${projectConfig.output_document_language}`);
    console.log('');
    console.log(`  [LANG] Write Sigma document prose in ${projectConfig.document_language}.`);
    console.log(`  [LANG] Write non-Sigma output documents in ${projectConfig.output_document_language}.`);
    console.log(`  [LANG] Communicate with the Director in ${projectConfig.interaction_language}.`);
    console.log('  [LANG] These settings govern AI write/response direction only — never auto-switch based on the language of the Director\'s message.');
    console.log('  [LANG] Keep Sigma artifact codes, CLI commands, filenames, and state names unchanged.');
    const artifactLine = (label, code, version, state) => {
        const display = version !== 'none' ? `${label} (${code} ${version})` : `${label} (${code})`;
        return `${display.padEnd(40)} [${fmtState(state)}]`;
    };
    if (chain) {
        console.log('\n--- Artifact Status ---');
        console.log(artifactLine('Intent Doc', 'DIR-INTENT', fmtVersion(chain.intent.version), chain.intent.state));
        if (chain.intent.file && (0, chain_1.isIntentDocUncertified)(chain, path_1.default.join(projectRoot, chain.intent.file))) {
            const since = chain.intent.effective_amendment ?? 'ratification';
            console.log(`  [WARNING] Doc state: UNCERTIFIED_EDIT (edited after ${since}) — see: sigma intent check`);
        }
        console.log(artifactLine('Plan Doc', 'FMN-PLAN', fmtVersion(chain.plan.active_version), chain.plan.active_state));
        const openPlanDrafts = chain.plan.versions.filter(v => v.state === 'DRAFT');
        if (openPlanDrafts.length > 1) {
            console.log(`  [NOTE] ${openPlanDrafts.length} DRAFT FMN-PLANs are open: ${openPlanDrafts.map(v => v.version).join(', ')} — run: sigma plan status`);
        }
        console.log(artifactLine('Execution Evidence', 'DEV-EXEC', fmtVersion(chain.exec.active_version), chain.exec.active_state));
        const openExecDrafts = chain.exec.versions.filter(v => v.state === 'DRAFT');
        if (openExecDrafts.length > 1) {
            console.log(`  [NOTE] ${openExecDrafts.length} DRAFT DEV-EXECs are open: ${openExecDrafts.map(v => v.version).join(', ')} — run: sigma exec status`);
        }
        console.log(artifactLine('Closure Doc', 'DIR-CLOSE', fmtVersion(chain.close?.version ?? null), chain.close?.state ?? null));
        console.log(artifactLine('Roadmap Doc', 'ROADMAP', fmtVersion(chain.roadmap?.version ?? null), chain.roadmap?.state ?? null));
        console.log('\n--- Gate Status ---');
        console.log(`Gate 1 (Design Complete):   ${(0, chain_1.getGateStatusLabel)(chain, 'gate_1_open')}`);
        console.log(`Gate 2 (Plan Locked):       ${(0, chain_1.getGateStatusLabel)(chain, 'gate_2_open')}`);
        console.log(`Gate 3 (Build Evidence):    ${(0, chain_1.getGateStatusLabel)(chain, 'gate_3_satisfied')}`);
        if ((0, chain_1.hasInvalidRuntime)(chain)) {
            console.log('\n--- INVALID Runtime Warnings ---');
            for (const line of (0, chain_1.getInvalidWarningLines)(chain)) {
                console.log(`  [INVALID] ${line}`);
            }
        }
    }
    else {
        console.log('\n--- Artifact Status ---');
        console.log('  No DIR-INTENT exists yet.');
    }
    console.log('\n--- CLI-Valid Runtime Operations ---');
    if (nextOps.length > 0) {
        for (const op of nextOps) {
            console.log(`  sigma ${op}`);
        }
    }
    else {
        console.log('  none');
    }
    if (roleGuidance) {
        console.log('\n--- Role-Permitted Routine Actions ---');
        for (const item of roleGuidance.routine) {
            console.log(`  - ${item}`);
        }
        console.log('\n--- Requires Director Approval ---');
        for (const item of roleGuidance.approval) {
            console.log(`  - ${item}`);
        }
        console.log('\n--- Current Stop Point ---');
        console.log(`  ${roleGuidance.stopPoint}`);
    }
    else {
        console.log('\n--- Current Stop Point ---');
        console.log('  Use the active role rule and Director instruction to decide whether any CLI-valid runtime operation should be used now.');
    }
    if (opts.showDocs) {
        printReferenceDocuments(opts, docEntries);
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
        .option('--role <role>', `Show role-aware guidance (${BOOTSTRAP_VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--show-docs', 'Also display registry-based reference documents')
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