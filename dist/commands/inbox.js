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
    if (!config_1.VALID_ROLES.includes(upper)) {
        throw new Error(`Invalid role "${value}". Valid roles: ${config_1.VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`);
    }
    return upper;
}
function printMessageSummary(entry, index) {
    console.log(`\n${index}. [${entry.from} → ${entry.to}] ${entry.type}: ${entry.subject}`);
    console.log(`   ID   : ${entry.id}`);
    console.log(`   File : ${entry.file}`);
    if (entry.attachments.length > 0) {
        console.log(`   Attach: ${entry.attachments.join(', ')}`);
    }
}
function runList(role, includeAll) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const messages = (0, mailbox_1.getMessagesForRole)(index, role, includeAll);
    const label = includeAll ? 'All messages' : 'Unread messages';
    console.log(`\nRole Inbox — ${role}`);
    if (messages.length === 0) {
        console.log(includeAll ? 'No messages.' : 'No unread messages.');
        console.log('');
        return;
    }
    console.log(`${messages.length} ${label.toLowerCase()}:`);
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
function inboxCommand() {
    const cmd = new commander_1.Command('inbox');
    cmd.description('Manage role message inbox');
    cmd
        .option('--role <role>', `Role inbox to view (${config_1.VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--all', 'Include READ and ARCHIVED messages (default: unread only)')
        .action((opts) => {
        try {
            if (!opts.role) {
                console.error('--role is required. Use: sigma inbox --role <role>');
                console.error(`Valid roles: ${config_1.VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`);
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
    return cmd;
}
//# sourceMappingURL=inbox.js.map