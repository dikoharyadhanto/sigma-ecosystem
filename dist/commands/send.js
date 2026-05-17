"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCommand = sendCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const mailbox_1 = require("../engine/mailbox");
const fs_1 = require("../utils/fs");
function validateRole(value, flag) {
    const upper = value.toUpperCase();
    if (!config_1.VALID_ROLES.includes(upper)) {
        throw new Error(`Invalid ${flag} role "${value}". Valid roles: ${config_1.VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`);
    }
    return upper;
}
function validateType(value) {
    const upper = value.toUpperCase();
    if (!config_1.VALID_MESSAGE_TYPES.includes(upper)) {
        throw new Error(`Invalid --type "${value}". Valid types: ${config_1.VALID_MESSAGE_TYPES.map(t => t.toLowerCase()).join(', ')}`);
    }
    return upper;
}
function runSend(opts) {
    if (!opts.from)
        throw new Error('--from is required. Use: sigma send --from <role> --to <role> --message "..."');
    if (!opts.to)
        throw new Error('--to is required. Use: sigma send --from <role> --to <role> --message "..."');
    // Resolve body: --message-file takes precedence (preserves newlines from file);
    // --message is fine for single-line content but is truncated by shells on newlines.
    let body;
    if (opts.messageFile) {
        const filePath = path_1.default.resolve(opts.messageFile);
        if (!fs_extra_1.default.existsSync(filePath)) {
            throw new Error(`--message-file not found: ${opts.messageFile}`);
        }
        body = fs_extra_1.default.readFileSync(filePath, 'utf8').trim();
        if (body === '')
            throw new Error('--message-file exists but is empty.');
    }
    else if (opts.message && opts.message.trim() !== '') {
        body = opts.message.trim();
    }
    else {
        throw new Error('--message or --message-file is required and must not be empty.');
    }
    const fromRole = validateRole(opts.from, '--from');
    const toRole = validateRole(opts.to, '--to');
    const msgType = opts.type ? validateType(opts.type) : 'NOTE';
    const subject = opts.subject?.trim() || '(no subject)';
    const projectRoot = (0, fs_1.findProjectRoot)();
    const ts = (0, mailbox_1.generateTimestamp)();
    const msgId = (0, mailbox_1.generateMessageId)(fromRole, toRole, ts);
    const filename = (0, mailbox_1.generateFilename)(msgType, fromRole, toRole, ts);
    // Handle attachment
    const attachmentPaths = [];
    if (opts.attach) {
        const srcPath = path_1.default.resolve(opts.attach);
        if (!fs_extra_1.default.existsSync(srcPath)) {
            throw new Error(`Attachment file not found: ${opts.attach}`);
        }
        const attachDir = path_1.default.join(projectRoot, config_1.MESSAGES_ATTACHMENTS_DIR);
        fs_extra_1.default.ensureDirSync(attachDir);
        const attachFilename = `${msgId}-${path_1.default.basename(srcPath)}`;
        const destPath = path_1.default.join(attachDir, attachFilename);
        fs_extra_1.default.copySync(srcPath, destPath);
        attachmentPaths.push(path_1.default.join(config_1.MESSAGES_ATTACHMENTS_DIR, attachFilename));
    }
    // Build index entry
    const inboxDir = (0, mailbox_1.resolveInboxDir)(projectRoot, toRole);
    fs_extra_1.default.ensureDirSync(inboxDir);
    const relFilePath = path_1.default.join('Sigma', 'messages', toRole, filename);
    const entry = {
        id: msgId,
        from: fromRole,
        to: toRole,
        type: msgType,
        subject,
        file: relFilePath,
        status: 'UNREAD',
        created_at: ts,
        attachments: attachmentPaths,
    };
    // Write message markdown
    const absFilePath = path_1.default.join(inboxDir, filename);
    const markdown = (0, mailbox_1.buildMessageMarkdown)(entry, body);
    fs_extra_1.default.writeFileSync(absFilePath, markdown, 'utf8');
    // Update index
    const index = (0, mailbox_1.readIndex)(projectRoot);
    index.messages.push(entry);
    (0, mailbox_1.writeIndex)(projectRoot, index);
    console.log('\nMessage sent.');
    console.log(`  ID      : ${msgId}`);
    console.log(`  From    : ${fromRole} → ${toRole}`);
    console.log(`  Type    : ${msgType}`);
    console.log(`  Subject : ${subject}`);
    console.log(`  File    : ${relFilePath}`);
    if (attachmentPaths.length > 0) {
        console.log(`  Attach  : ${attachmentPaths[0]}`);
    }
    console.log('');
}
function sendCommand() {
    const cmd = new commander_1.Command('send');
    cmd.description('Send a message from one role to another');
    cmd
        .requiredOption('--from <role>', `Sender role (${config_1.VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .requiredOption('--to <role>', `Recipient role (${config_1.VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--type <type>', `Message type (${config_1.VALID_MESSAGE_TYPES.map(t => t.toLowerCase()).join('|')})`, 'note')
        .option('--subject <subject>', 'Short subject line')
        .option('--message <body>', 'Message body (single-line; use --message-file for multi-line content)')
        .option('--message-file <path>', 'Path to a file whose contents become the message body (preserves newlines)')
        .option('--attach <file>', 'File to attach (copied into Sigma/messages/attachments/)')
        .action((opts) => {
        try {
            runSend(opts);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=send.js.map