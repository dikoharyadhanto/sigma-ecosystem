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
    console.log(`   ID   : ${entry.id}`);
    console.log(`   File : ${entry.file}`);
    if (entry.reply_to) {
        console.log(`   Reply-To: ${entry.reply_to}`);
    }
    if (entry.attachments.length > 0) {
        console.log(`   Attach: ${entry.attachments.join(', ')}`);
    }
}
function runList(role, includeAll) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const messages = (0, mailbox_1.getMessagesForRole)(index, role, includeAll);
    const totalUnread = index.messages.filter(m => m.to === role && m.status === 'UNREAD').length;
    const label = includeAll ? 'All messages' : 'Unread messages';
    console.log(`\nRole Inbox — ${role}`);
    if (messages.length === 0) {
        console.log(includeAll ? 'No messages.' : 'No unread messages.');
        console.log('');
        return;
    }
    if (!includeAll && totalUnread > messages.length) {
        console.log(`${totalUnread} unread (showing ${messages.length}):`);
    }
    else {
        console.log(`${messages.length} ${label.toLowerCase()}:`);
    }
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
    if (entry.status === 'UNREAD') {
        (0, mailbox_1.updateMessageStatus)(index, messageId, 'READ');
        (0, mailbox_1.writeIndex)(projectRoot, index);
        console.log(`[Marked as READ: ${messageId}]\n`);
    }
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
    const validStatuses = ['UNREAD', 'READ', 'ARCHIVED'];
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
        if (!validStatuses.includes(entry.status)) {
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
    cmd.description('Manage role message inbox');
    cmd
        .option('--role <role>', `Role inbox to view (${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--all', 'Include READ and ARCHIVED messages (default: unread only)')
        .action((opts) => {
        try {
            if (!opts.role) {
                console.error('--role is required. Use: sigma inbox --role <role>');
                console.error(`Valid messaging roles: ${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}`);
                process.exit(1);
            }
            const role = validateRole(opts.role);
            runList(role, opts.all ?? false);
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