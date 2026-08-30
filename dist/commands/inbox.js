"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboxCommand = inboxCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const mailbox_1 = require("../engine/mailbox");
const projectConfig_1 = require("../engine/projectConfig");
const fs_1 = require("../utils/fs");
function validateRole(value) {
    const upper = value.toUpperCase();
    if (!config_1.MESSAGING_ROLES.includes(upper)) {
        throw new Error(`Invalid role "${value}". Valid messaging roles: ${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}.\n` +
            `DIRECTOR communicates directly — no CLI inbox needed.`);
    }
    return upper;
}
function printMessageSummary(entry, index) {
    console.log(`\n${index}. [${entry.from} → ${entry.to}] ${entry.type}: ${entry.subject}`);
    console.log(`   ID       : ${entry.id}`);
    console.log(`   Action   : ${entry.action || 'FYI'}`);
    console.log(`   Artifact : ${entry.related_artifact || 'N/A'}`);
    console.log(`   File     : ${entry.file}`);
    if (entry.reply_to) {
        console.log(`   Reply-To : ${entry.reply_to}`);
    }
    if (entry.attachments.length > 0) {
        console.log(`   Attach   : ${entry.attachments.join(', ')}`);
    }
}
function runList(role, view) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const messages = (0, mailbox_1.selectInboxMessages)(index, role, view);
    console.log(`\nRole Inbox — ${role}`);
    const label = view === 'unread' ? 'unread message' : view === 'outdated' ? 'outdated message' : 'message';
    if (messages.length === 0) {
        console.log(`No ${label}s.`);
        console.log('');
        return;
    }
    console.log(`${messages.length} ${label}${messages.length === 1 ? '' : 's'}:`);
    messages.forEach((m, i) => printMessageSummary(m, i + 1));
    console.log(`\nRun: sigma inbox read <id>`);
    console.log('');
}
function runRead(messageId) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const entry = index.messages.find(m => m.id === messageId);
    if (!entry) {
        throw new Error(`Message not found: ${messageId}`);
    }
    const absPath = path_1.default.join(projectRoot, entry.file);
    if (!fs_extra_1.default.existsSync(absPath)) {
        throw new Error(`Message file missing on disk: ${entry.file}`);
    }
    const content = fs_extra_1.default.readFileSync(absPath, 'utf8');
    console.log('\n' + content);
    let dirty = false;
    if (entry.status === 'UNREAD') {
        (0, mailbox_1.updateMessageStatus)(index, messageId, 'READ');
        dirty = true;
        console.log(`[Marked as READ: ${messageId}]\n`);
    }
    // Phase 6 auto-sweep: after a successful read, keep the N most recent READ
    // messages for this recipient role and flip the rest to OUTDATED. Disabled
    // when mailbox.auto_outdate_read_keep is 0. Never touches the message just
    // read, UNREAD, or ARCHIVED.
    const keep = (0, projectConfig_1.resolveAutoOutdateKeep)((0, projectConfig_1.readProjectConfig)(projectRoot));
    if (keep > 0) {
        const surplus = (0, mailbox_1.selectSurplusRead)(index, entry.to, keep).filter(m => m.id !== messageId);
        for (const m of surplus)
            (0, mailbox_1.updateMessageStatus)(index, m.id, 'OUTDATED');
        if (surplus.length > 0) {
            dirty = true;
            console.log(`[${surplus.length} older READ message${surplus.length === 1 ? '' : 's'} moved to OUTDATED — ` +
                `see: sigma inbox --role ${entry.to.toLowerCase()} --outdated]\n`);
        }
    }
    if (dirty)
        (0, mailbox_1.writeIndex)(projectRoot, index);
}
function parseKeep(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
        throw new Error(`--keep must be a non-negative integer, got "${value}"`);
    }
    return n;
}
function runClear(opts) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const keep = opts.keep !== undefined ? parseKeep(opts.keep) : 5;
    let roles;
    if (opts.allRoles) {
        if (!opts.directorConfirm) {
            throw new Error('sigma inbox clear --all-roles sweeps every role\'s inbox — re-run with --director-confirm.');
        }
        roles = [...config_1.MESSAGING_ROLES];
    }
    else {
        if (!opts.role) {
            throw new Error('--role <role> is required (or: --all-roles --director-confirm).');
        }
        roles = [validateRole(opts.role)];
    }
    const index = (0, mailbox_1.readIndex)(projectRoot);
    let totalOutdated = 0;
    console.log(`\n=== sigma inbox clear${opts.dryRun ? ' (dry run)' : ''} ===\n`);
    for (const role of roles) {
        const readCount = index.messages.filter(m => m.to === role && m.status === 'READ').length;
        const surplus = (0, mailbox_1.selectSurplusRead)(index, role, keep);
        if (surplus.length === 0) {
            console.log(`${role}: ${readCount} READ — nothing to outdate (keep ${keep}).`);
            continue;
        }
        console.log(`${role}: ${readCount} READ → ${surplus.length} to OUTDATED, ${readCount - surplus.length} kept:`);
        for (const m of surplus) {
            console.log(`  - ${m.id}  ${m.subject}`);
            if (!opts.dryRun)
                (0, mailbox_1.updateMessageStatus)(index, m.id, 'OUTDATED');
        }
        totalOutdated += surplus.length;
    }
    if (opts.dryRun) {
        console.log(`\nDry run — no changes written. ${totalOutdated} message(s) would move to OUTDATED.`);
    }
    else if (totalOutdated > 0) {
        (0, mailbox_1.writeIndex)(projectRoot, index);
        console.log(`\n${totalOutdated} message(s) moved to OUTDATED. View: sigma inbox --role <role> --outdated`);
    }
    else {
        console.log('\nNothing to do.');
    }
    console.log('');
}
function runArchive(messageId) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const index = (0, mailbox_1.readIndex)(projectRoot);
    (0, mailbox_1.updateMessageStatus)(index, messageId, 'ARCHIVED');
    (0, mailbox_1.writeIndex)(projectRoot, index);
    console.log(`Message ${messageId} archived.`);
}
function runCheck() {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const messagesDir = path_1.default.join(projectRoot, 'Sigma', 'messages');
    let passes = 0;
    let warnings = 0;
    let failures = 0;
    console.log('\n=== sigma inbox check ===\n');
    // 1. Check every entry in index has a corresponding .md file
    console.log('Checking index entries → disk files...');
    for (const entry of index.messages) {
        const absPath = path_1.default.join(projectRoot, entry.file);
        if (!fs_extra_1.default.existsSync(absPath)) {
            console.log(`  ✗ MISSING FILE: ${entry.id} → ${entry.file}`);
            failures++;
        }
        else {
            passes++;
        }
    }
    // 2. Check every .md file in per-role folders has a corresponding index entry
    console.log('\nChecking disk files → index entries...');
    const indexedFiles = new Set(index.messages.map(m => m.file));
    for (const role of config_1.MESSAGING_ROLES) {
        const roleDir = path_1.default.join(messagesDir, role);
        if (!fs_extra_1.default.existsSync(roleDir))
            continue;
        const files = fs_extra_1.default.readdirSync(roleDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const relPath = path_1.default.join('Sigma', 'messages', role, file);
            if (!indexedFiles.has(relPath)) {
                console.log(`  ⚠ ORPHAN FILE: ${relPath} (not in index)`);
                warnings++;
            }
            else {
                passes++;
            }
        }
    }
    // 3. Check attachment paths exist
    console.log('\nChecking attachment paths...');
    let attachChecked = 0;
    for (const entry of index.messages) {
        for (const att of entry.attachments) {
            const absAtt = path_1.default.join(projectRoot, att);
            if (!fs_extra_1.default.existsSync(absAtt)) {
                console.log(`  ✗ MISSING ATTACHMENT: ${entry.id} → ${att}`);
                failures++;
            }
            else {
                attachChecked++;
            }
        }
    }
    if (attachChecked > 0)
        console.log(`  ✓ ${attachChecked} attachment(s) verified`);
    // 4. Check for valid roles and statuses
    console.log('\nChecking field validity...');
    const ids = new Set();
    for (const entry of index.messages) {
        if (ids.has(entry.id)) {
            console.log(`  ✗ DUPLICATE ID: ${entry.id}`);
            failures++;
        }
        ids.add(entry.id);
        if (!config_1.VALID_ROLES.includes(entry.from)) {
            console.log(`  ✗ INVALID from role: ${entry.id} → ${entry.from}`);
            failures++;
        }
        if (!config_1.VALID_ROLES.includes(entry.to)) {
            console.log(`  ✗ INVALID to role: ${entry.id} → ${entry.to}`);
            failures++;
        }
        if (!mailbox_1.VALID_STATUSES.includes(entry.status)) {
            console.log(`  ✗ INVALID status: ${entry.id} → ${entry.status}`);
            failures++;
        }
        if (!config_1.VALID_MESSAGE_TYPES.includes(entry.type)) {
            console.log(`  ✗ INVALID type: ${entry.id} → ${entry.type}`);
            failures++;
        }
    }
    if (failures === 0 && warnings === 0) {
        console.log('  ✓ All field values valid');
    }
    // Summary
    console.log('');
    console.log(`Result: ${passes} pass, ${warnings} warning(s), ${failures} failure(s)`);
    if (failures > 0) {
        console.log('Inbox has integrity failures. Inspect Sigma/messages/index.json manually.');
        process.exit(1);
    }
    else if (warnings > 0) {
        console.log('Orphan files found — they can be removed or added to the index manually.');
    }
    else {
        console.log('Inbox integrity verified. No issues found.');
    }
    console.log('');
}
function inboxCommand() {
    const cmd = new commander_1.Command('inbox');
    cmd.description('Manage role message inbox. Messages are stored in Sigma/messages/{ROLE}/.\n' +
        '  List unread  : sigma inbox --role <role>\n' +
        '  List all     : sigma inbox --role <role> --all        (UNREAD + READ + ARCHIVED, not OUTDATED)\n' +
        '  List outdated : sigma inbox --role <role> --outdated   (aged-out READ)\n' +
        '  Read message : sigma inbox read <id>   (marks as READ; auto-ages surplus READ to OUTDATED)\n' +
        '  Archive      : sigma inbox archive <id>\n' +
        '  Clear        : sigma inbox clear --role <role> [--keep 5] [--dry-run]\n' +
        '  Check        : sigma inbox check       (validates index vs disk files)');
    cmd
        .option('--role <role>', `Role inbox to view (${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--all', 'Include READ and ARCHIVED messages (excludes OUTDATED)')
        .option('--outdated', 'Show only OUTDATED messages (READ aged out by clear / auto-sweep)')
        .action((opts) => {
        try {
            if (!opts.role) {
                console.error('--role is required. Use: sigma inbox --role <role>');
                console.error(`Valid messaging roles: ${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}`);
                process.exit(1);
            }
            const role = validateRole(opts.role);
            const view = opts.outdated ? 'outdated' : opts.all ? 'all' : 'unread';
            runList(role, view);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('clear')
        .description('Age stale READ messages to OUTDATED, keeping the N most recent READ (default 5)')
        .option('--role <role>', `Role inbox to clear (${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--all-roles', 'Clear every messaging role (requires --director-confirm)')
        .option('--keep <n>', 'Number of most-recent READ messages to keep (default 5)')
        .option('--dry-run', 'Show what would change without writing')
        .option('--director-confirm', 'Required with --all-roles')
        .action((_opts, command) => {
        try {
            // `--role` is also declared on the parent `inbox` command; Commander
            // routes a shared option name to the parent, so merge globals here.
            runClear(command.optsWithGlobals());
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('read <message-id>')
        .description('Read a message and mark it as READ')
        .action((messageId) => {
        try {
            runRead(messageId);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('archive <message-id>')
        .description('Archive a message (hides from default listing)')
        .action((messageId) => {
        try {
            runArchive(messageId);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('check')
        .description('Run integrity check: validate index entries vs disk files, attachments, field values')
        .action(() => {
        try {
            runCheck();
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=inbox.js.map