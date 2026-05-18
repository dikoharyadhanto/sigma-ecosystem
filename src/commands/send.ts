import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  VALID_ROLES,
  VALID_MESSAGE_TYPES,
  MESSAGES_ATTACHMENTS_DIR,
  SigmaRole,
  MessageType,
} from '../config';
import {
  readIndex,
  writeIndex,
  generateTimestamp,
  generateRandomSuffix,
  generateMessageId,
  generateFilename,
  buildMessageMarkdown,
  resolveInboxDir,
  getUnreadForRole,
  MessageEntry,
} from '../engine/mailbox';
import { findProjectRoot } from '../utils/fs';

function validateRole(value: string, flag: string): SigmaRole {
  const upper = value.toUpperCase() as SigmaRole;
  if (!(VALID_ROLES as readonly string[]).includes(upper)) {
    throw new Error(
      `Invalid ${flag} role "${value}". Valid roles: ${VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`
    );
  }
  return upper;
}

function validateType(value: string): MessageType {
  const upper = value.toUpperCase() as MessageType;
  if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(upper)) {
    throw new Error(
      `Invalid --type "${value}". Valid types: ${VALID_MESSAGE_TYPES.map(t => t.toLowerCase()).join(', ')}`
    );
  }
  return upper;
}

function runSend(opts: {
  from: string;
  to: string;
  type?: string;
  subject?: string;
  message?: string;
  messageFile?: string;
  attach?: string;
}): void {
  if (!opts.from) throw new Error('--from is required. Use: sigma send --from <role> --to <role> --message "..."');
  if (!opts.to) throw new Error('--to is required. Use: sigma send --from <role> --to <role> --message "..."');

  // Resolve body: --message-file takes precedence (preserves newlines from file);
  // --message is fine for single-line content but is truncated by shells on newlines.
  let body: string;
  if (opts.messageFile) {
    const filePath = path.resolve(opts.messageFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`--message-file not found: ${opts.messageFile}`);
    }
    body = fs.readFileSync(filePath, 'utf8').trim();
    if (body === '') throw new Error('--message-file exists but is empty.');
  } else if (opts.message && opts.message.trim() !== '') {
    body = opts.message.trim();
  } else {
    throw new Error('--message or --message-file is required and must not be empty.');
  }

  const fromRole = validateRole(opts.from, '--from');
  const toRole = validateRole(opts.to, '--to');
  const msgType: MessageType = opts.type ? validateType(opts.type) : 'NOTE';
  const subject = opts.subject?.trim() || '(no subject)';

  const projectRoot = findProjectRoot();

  // Gate: recipient must have an empty unread queue before receiving new messages.
  // This enforces sequential processing — roles cannot be buried in unread messages.
  const existingIndex = readIndex(projectRoot);
  const unread = getUnreadForRole(existingIndex, toRole);
  if (unread.length > 0) {
    const ids = unread.map(m => `  - ${m.id}  [${m.from} → ${m.to}] ${m.type}: ${m.subject}`).join('\n');
    throw new Error(
      `SEND BLOCKED — ${toRole} has ${unread.length} unread message${unread.length > 1 ? 's' : ''}.\n` +
      `${ids}\n\n` +
      `Policy: a recipient must read all unread messages before receiving new ones.\n` +
      `This prevents AI roles from skipping unread mailbox entries.\n` +
      `Run: sigma inbox read <id>   (or: sigma inbox --role ${toRole.toLowerCase()} to list them)`
    );
  }
  const ts = generateTimestamp();
  const suffix = generateRandomSuffix();
  const msgId = generateMessageId(fromRole, toRole, ts, suffix);
  const filename = generateFilename(msgType, fromRole, toRole, ts, suffix);

  // Handle attachment
  const attachmentPaths: string[] = [];
  if (opts.attach) {
    const srcPath = path.resolve(opts.attach);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Attachment file not found: ${opts.attach}`);
    }
    const attachDir = path.join(projectRoot, MESSAGES_ATTACHMENTS_DIR);
    fs.ensureDirSync(attachDir);
    const attachFilename = `${msgId}-${path.basename(srcPath)}`;
    const destPath = path.join(attachDir, attachFilename);
    fs.copySync(srcPath, destPath);
    attachmentPaths.push(path.join(MESSAGES_ATTACHMENTS_DIR, attachFilename));
  }

  // Build index entry
  const inboxDir = resolveInboxDir(projectRoot, toRole);
  fs.ensureDirSync(inboxDir);
  const relFilePath = path.join('Sigma', 'messages', toRole, filename);

  const entry: MessageEntry = {
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
  const absFilePath = path.join(inboxDir, filename);
  const markdown = buildMessageMarkdown(entry, body);
  fs.writeFileSync(absFilePath, markdown, 'utf8');

  // Update index
  const index = readIndex(projectRoot);
  index.messages.push(entry);
  writeIndex(projectRoot, index);

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

export function sendCommand(): Command {
  const cmd = new Command('send');
  cmd.description(
    'Send a message from one role to another.\n' +
    '  Policy: a recipient must have no unread messages before receiving a new one.\n' +
    '  Clear unread messages with: sigma inbox read <id>'
  );

  cmd
    .requiredOption('--from <role>', `Sender role (${VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .requiredOption('--to <role>', `Recipient role (${VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .option('--type <type>', `Message type (${VALID_MESSAGE_TYPES.map(t => t.toLowerCase()).join('|')})`, 'note')
    .option('--subject <subject>', 'Short subject line')
    .option('--message <body>', 'Message body (single-line; use --message-file for multi-line content)')
    .option('--message-file <path>', 'Path to a file whose contents become the message body (preserves newlines)')
    .option('--attach <file>', 'File to attach (copied into Sigma/messages/attachments/)')
    .action((opts: { from: string; to: string; type?: string; subject?: string; message?: string; messageFile?: string; attach?: string }) => {
      try {
        runSend(opts);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
