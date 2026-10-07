"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInboxCommand = buildInboxCommand;
exports.buildMemoCommand = buildMemoCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const fs_1 = require("../utils/fs");
const mailbox_1 = require("../engine/mailbox");
const mailboxContext_1 = require("../engine/mailboxContext");
const mailboxMigration_1 = require("../engine/mailboxMigration");
const mailboxLock_1 = require("../engine/mailboxLock");
const projectConfig_1 = require("../engine/projectConfig");
const chain_1 = require("../engine/chain");
const mailboxService_1 = require("../services/mailboxService");
const inboxArchiveService_1 = require("../services/inboxArchiveService");
function role(value) {
    if (!value)
        throw new Error('--role is required. Use --role arc|fmn|dev|aud.');
    const r = value.toUpperCase();
    if (!config_1.MESSAGING_ROLES.includes(r))
        throw new Error(`Invalid role "${value}". Valid messaging roles: arc, fmn, dev, aud. DIRECTOR communicates directly — no CLI inbox needed.`);
    return r;
}
function selectors(cmd) {
    return cmd.option('--intent <version>', 'Select the owning INTENT major (including legacy numbering)')
        .option('--context <context>', 'Select storage context: GENERAL, LEGACY, or an artifact version')
        .option('--all-intents', 'Select all intent contexts, GENERAL and LEGACY');
}
function printEntry(e, i) {
    const c = (0, mailboxContext_1.entryContext)(e);
    console.log(`\n${i + 1}. [${e.status}] [${e.from} → ${e.to}] ${e.type}: ${e.subject}`);
    console.log(`   ID       : ${e.id}\n   Action   : ${e.action ?? 'FYI'}\n   Artifact : ${e.related_artifact ?? 'GENERAL'}\n   Context  : ${c.context} | INTENT ${c.intent_version ?? '—'}\n   File     : ${e.file}`);
    if (e.reply_to)
        console.log(`   Reply-To : ${e.reply_to}`);
    if (e.attachments.length)
        console.log(`   Attach   : ${e.attachments.join(', ')}`);
}
function list(opts, memo) {
    if (opts.all && opts.outdated)
        throw new Error('--all and --outdated are mutually exclusive.');
    const r = role(opts.role), root = (0, fs_1.findProjectRoot)(), scope = (0, mailboxContext_1.mailboxScope)(root, opts), index = (0, mailbox_1.readIndex)(root);
    const view = opts.outdated ? 'outdated' : opts.all ? 'all' : 'unread';
    const entries = memo ? index.messages.filter(e => e.to === r && e.type === 'MEMO' && (0, mailboxContext_1.matchesMailboxScope)(e, scope) && (view === 'unread' ? e.status === 'UNREAD' : view === 'outdated' ? e.status === 'OUTDATED' : e.status !== 'OUTDATED')).sort((a, b) => a.created_at.localeCompare(b.created_at)) : (0, mailbox_1.selectInboxMessages)(index, r, view, scope);
    const label = scope.allIntents ? 'all contexts' : scope.context ?? scope.intent ?? 'GENERAL';
    console.log(`\n${memo ? 'Memo' : 'Role Inbox'} — ${r} — ${label}`);
    const diagnosis = (0, mailboxMigration_1.mailboxMigrationDiagnosis)(root);
    for (const warning of diagnosis.warnings)
        console.log(`[WARN] ${warning}`);
    if (memo) {
        const limit = (0, projectConfig_1.resolveMemoLimit)((0, projectConfig_1.readProjectConfig)(root));
        const intentCount = scope.intent ? (0, mailbox_1.getUnreadMemosForRole)(index, r, { intent: scope.intent }).length : 0;
        const generalCount = (0, mailbox_1.getUnreadMemosForRole)(index, r, { context: 'GENERAL' }).length;
        console.log(`INTENT ${scope.intent ?? '—'}: ${intentCount}/${limit} slot terpakai | GENERAL: ${generalCount}/${limit}`);
    }
    console.log(entries.length ? `${entries.length} ${memo ? 'memo' : 'message'}${entries.length === 1 ? '' : 's'}:` : `No ${view === 'unread' ? 'unread ' : view === 'outdated' ? 'outdated ' : ''}${memo ? 'memos' : 'messages'}.`);
    entries.forEach(printEntry);
    if (!memo) {
        const count = (0, mailbox_1.countUnreadMemos)(index, r, scope);
        if (count)
            console.log(`\n${count} unread memo${count === 1 ? '' : 's'} — sigma memo list --role ${r.toLowerCase()}`);
    }
    console.log(`\nRun: sigma ${memo ? 'memo' : 'inbox'} read <id>\n`);
}
async function read(id, memo) {
    const root = (0, fs_1.findProjectRoot)();
    await (0, mailboxMigration_1.withMailboxLock)(root, () => {
        const result = (0, mailboxService_1.readMailboxEntry)(root, id, memo);
        if (result.entry.context === 'LEGACY')
            console.log('[LEGACY] Status comes from the index; migration reset UNREAD to READ administratively, not as evidence of recipient understanding.');
        console.log('\n' + result.content);
        console.log(`[Marked as ${result.entry.status}: ${id}]`);
        if (result.outdated)
            console.log(`[${result.outdated} older READ ${memo ? 'memo' : 'message'}(s) moved to OUTDATED]`);
    });
}
async function clear(opts, memo) {
    if ((opts.allRoles || opts.allIntents) && !opts.directorConfirm)
        throw new Error('--all-roles / --all-intents requires --director-confirm.');
    const roles = opts.allRoles ? [...config_1.MESSAGING_ROLES] : [role(opts.role)];
    const keep = opts.keep === undefined ? 5 : Number(opts.keep);
    if (!Number.isInteger(keep) || keep < 0)
        throw new Error('--keep must be a non-negative integer.');
    const root = (0, fs_1.findProjectRoot)(), scope = (0, mailboxContext_1.mailboxScope)(root, opts);
    if (scope.intent === null && !opts.context && !opts.allIntents)
        throw new Error('No active INTENT. Select --context GENERAL explicitly to clear GENERAL.');
    // GENERAL READ is selected explicitly, never swept as an intent side effect.
    scope.includeGeneral = false;
    const run = () => {
        const surplus = (0, mailboxService_1.clearMailbox)(root, roles, keep, scope, memo, !!opts.dryRun);
        console.log(`\n=== sigma ${memo ? 'memo' : 'inbox'} clear${opts.dryRun ? ' (dry run)' : ''} ===`);
        surplus.forEach(e => console.log(`  - ${e.id} ${e.subject}`));
        console.log(opts.dryRun ? `Dry run — no changes written. ${surplus.length} message(s) would move to OUTDATED.` : surplus.length ? `${surplus.length} message(s) moved to OUTDATED.` : 'Nothing to do.');
    };
    if (opts.dryRun)
        run();
    else
        await (0, mailboxMigration_1.withMailboxLock)(root, run);
}
function memoWrite(opts) {
    if (opts.to)
        throw new Error('sigma memo does not take --to — a memo is always to your own role. Use sigma send for cross-role messages.');
    const r = role(opts.role);
    if (!opts.ref?.trim())
        throw new Error('--ref is required. Use INTENT/ROADMAP/PLAN/EXEC/CLOSE-vN, or GENERAL.');
    const topic = opts.topic?.trim();
    if (!topic)
        throw new Error('--topic is required and must not be empty.');
    const body = opts.messageFile ? fs_extra_1.default.readFileSync(path_1.default.resolve(opts.messageFile), 'utf8').trim() : opts.message?.trim();
    if (!body)
        throw new Error('--message or --message-file is required and must not be empty.');
    const root = (0, fs_1.findProjectRoot)(), index = (0, mailbox_1.readIndex)(root);
    (0, mailboxContext_1.assertMailboxMutable)(root, index);
    let context;
    try {
        context = (0, mailboxContext_1.resolveMailboxReference)(root, opts.ref);
    }
    catch (err) {
        if (err.message.startsWith('Invalid artifact reference'))
            throw new Error(`Invalid --ref: ${err.message}`);
        throw err;
    }
    if (context.warning)
        console.warn(context.warning);
    const limit = (0, projectConfig_1.resolveMemoLimit)((0, projectConfig_1.readProjectConfig)(root));
    if (limit === 0)
        throw new Error('Memo is disabled (mailbox.memo_unread_limit = 0). Enable with: sigma config set memo-limit 5');
    const unread = (0, mailbox_1.getUnreadMemosForRole)(index, r, context.intent_version ? { intent: context.intent_version } : { context: 'GENERAL' });
    if (unread.length >= limit)
        throw new Error(`MEMO QUOTA FULL — ${r} already has ${unread.length}/${limit} unread memos in ${context.intent_version ?? 'GENERAL'}.\n${unread.map(e => `  - ${e.id} ${e.subject}`).join('\n')}\nRead them first: sigma memo read <id>`);
    let chainLine = '(unresolved — no active chain)';
    if ((0, chain_1.listChainVersions)(root).length > 0) {
        const { chainVersion, data: c } = (0, chain_1.readActiveChain)(root);
        chainLine = `${chainVersion} | ${c.lifecycle_state} | INTENT ${c.intent.version} (${c.intent.state}) · PLAN ${c.plan.active_version ?? '—'} (${c.plan.active_state ?? '—'}) · EXEC ${c.exec.active_version ?? '—'} (${c.exec.active_state ?? '—'})`;
    }
    const ts = (0, mailbox_1.generateTimestamp)(), suffix = (0, mailbox_1.generateRandomSuffix)(), id = (0, mailbox_1.generateMessageId)(r, r, ts, suffix);
    const filename = (0, mailbox_1.generateFilename)('MEMO', r, r, ts, suffix), directory = (0, mailbox_1.resolveInboxDir)(root, r, context.context, true);
    const file = `Sigma/memo/${r}/${context.context}/${filename}`;
    const entry = { id, from: r, to: r, type: 'MEMO', subject: opts.subject?.trim() || topic, file, status: 'UNREAD', created_at: ts, attachments: [], action: 'FYI', related_artifact: opts.ref.trim(), intent_version: context.intent_version, context: context.context };
    const markdown = `## Memo — ${r} — ${ts.slice(0, 16).replace('T', ' ')}\n\n**Chain / Phase / Version:** ${chainLine}\n\n**Mailbox Context:** ${context.context} | INTENT ${context.intent_version ?? 'GENERAL'}\n\n**Sigma Artifact Reference:** ${opts.ref.trim()}\n\n**Topic:** ${topic}\n\n${body}\n`;
    (0, mailboxLock_1.assertMailboxLease)(root);
    fs_extra_1.default.ensureDirSync(directory);
    const absolute = path_1.default.join(directory, filename);
    fs_extra_1.default.writeFileSync(absolute, markdown, { encoding: 'utf8', flag: 'wx' });
    index.messages.push(entry);
    try {
        (0, mailbox_1.writeIndex)(root, index);
    }
    catch (err) {
        fs_extra_1.default.removeSync(absolute);
        throw err;
    }
    console.log(`\nMemo written.\n  ID    : ${id}\n  Role  : ${r}\n  Ref   : ${opts.ref.trim()}\n  Topic : ${topic}\n  File  : ${file}\n  Slot  : ${unread.length + 1}/${limit}\n  Context: ${context.context} | INTENT ${context.intent_version ?? 'GENERAL'}\n`);
}
function safe(fn) {
    return async (...args) => { try {
        await fn(...args);
    }
    catch (err) {
        console.error(err.message);
        process.exitCode = 1;
    } };
}
function clearCommand(parent, memo) {
    selectors(parent.command('clear').description('Move surplus READ entries to OUTDATED in the selected context; files are retained')
        .option('--role <role>', 'Recipient role').option('--all-roles', 'All roles (requires --director-confirm)')
        .option('--keep <n>', 'Most recent READ entries to keep per role and intent', '5')
        .option('--dry-run', 'Preview without writing').option('--director-confirm', 'Required for all roles or all intents'))
        .action(safe((_opts, command) => clear(command.optsWithGlobals(), memo)));
}
function buildInboxCommand() {
    const cmd = selectors(new commander_1.Command('inbox').description('Manage messages in Sigma/messages/<ROLE>/<CONTEXT>/; defaults to active INTENT plus GENERAL UNREAD')
        .option('--role <role>', 'Recipient role').option('--all', 'Include READ/ARCHIVED in selected context; excludes OUTDATED')
        .option('--outdated', 'OUTDATED only in selected context'));
    cmd.action(safe((opts) => list(opts, false)));
    cmd.command('read <message-id>').description('Read a message by ID and mark READ').action(safe((id) => read(id, false)));
    cmd.command('archive <message-id>').description('Archive by ID (all contexts)').action(safe(async (id) => {
        const root = (0, fs_1.findProjectRoot)();
        await (0, mailboxMigration_1.withMailboxLock)(root, () => (0, inboxArchiveService_1.archiveMessage)({ projectRoot: root, messageId: id, actorRole: null }));
        console.log(`Message ${id} archived.`);
    }));
    clearCommand(cmd, false);
    cmd.command('check').description('Check both mailbox trees and shared index').action(safe(() => {
        const report = (0, mailbox_1.checkMailboxIntegrity)((0, fs_1.findProjectRoot)());
        console.log('\n=== sigma inbox check ===');
        for (const e of report.findings.missing_files)
            console.log(`MISSING FILE: ${e.id} → ${e.file}`);
        for (const e of report.findings.orphan_files)
            console.log(`ORPHAN FILE: ${e} (not in index)`);
        for (const e of report.findings.missing_attachments)
            console.log(`MISSING ATTACHMENT: ${e.id} → ${e.path}`);
        for (const e of report.findings.invalid_fields)
            console.log(`INVALID ${e.field}: ${e.id} ${e.value}`);
        console.log(`Result: ${report.passes} pass, ${report.warnings} warning(s), ${report.failures} failure(s)`);
        if (report.failures)
            process.exitCode = 1;
        else
            console.log(report.warnings ? 'Orphan files found — inspect before migration.' : 'Inbox integrity verified. No issues found.');
    }));
    return cmd;
}
function buildMemoCommand() {
    const cmd = new commander_1.Command('memo').description('Self-to-self operational brief; quota per owning INTENT and role, GENERAL separate');
    cmd.command('write').description('Write a memo to your own role')
        .option('--role <role>', 'Role').option('--to <role>', 'Not supported: use sigma send')
        .option('--ref <ref>', 'INTENT/ROADMAP/PLAN/EXEC/CLOSE reference or GENERAL')
        .option('--topic <sentence>', 'Required topic').option('--subject <subject>', 'Defaults to topic')
        .option('--message <body>', 'Body').option('--message-file <path>', 'Body file')
        .action(safe(async (opts) => (0, mailboxMigration_1.withMailboxLock)((0, fs_1.findProjectRoot)(), () => memoWrite(opts))));
    selectors(cmd.command('list').description('List active INTENT and GENERAL UNREAD memos')
        .option('--role <role>', 'Role').option('--all', 'Include READ/ARCHIVED; excludes OUTDATED').option('--outdated', 'OUTDATED only'))
        .action(safe((opts) => list(opts, true)));
    cmd.command('read <memo-id>').description('Read a memo by ID and mark READ').action(safe((id) => read(id, true)));
    clearCommand(cmd, true);
    return cmd;
}
//# sourceMappingURL=mailboxShared.js.map