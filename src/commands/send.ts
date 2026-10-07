import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  MESSAGING_ROLES,
  VALID_MESSAGE_TYPES,
  VALID_ACTIONS,
  MESSAGES_ATTACHMENTS_DIR,
  MessagingRole,
  MessageType,
  ActionRequired,
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
import { findProjectRoot, toPosix } from '../utils/fs';
import { assertMailboxMutable, resolveMailboxReference, entryContext, assertMailboxPath } from '../engine/mailboxContext';
import { withMailboxLock } from '../engine/mailboxMigration';
import { assertMailboxLease } from '../engine/mailboxLock';

function validateRole(value: string, flag: string): MessagingRole {
  const upper = value.toUpperCase() as MessagingRole;
  if (!(MESSAGING_ROLES as readonly string[]).includes(upper)) {
    throw new Error(
      `Invalid ${flag} role "${value}". Valid messaging roles: ${MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}.\n` +
      `DIRECTOR communicates directly — no CLI inbox needed.`
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

function validateAction(value: string): ActionRequired {
  const upper = value.toUpperCase() as ActionRequired;
  if (!(VALID_ACTIONS as readonly string[]).includes(upper)) {
    throw new Error(
      `Invalid --action "${value}". Valid actions: ${VALID_ACTIONS.map(a => a.toLowerCase()).join(', ')}`
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
  replyTo?: string;
  action?: string;
  relatedArtifact?: string;
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
  const action: ActionRequired = opts.action ? validateAction(opts.action) : 'FYI';
  let relatedArtifact = opts.relatedArtifact?.trim() || 'N/A';

  const projectRoot = findProjectRoot();

  // Resolve identity and validate reply before any file or attachment write.
  const existingIndex = readIndex(projectRoot);
  assertMailboxMutable(projectRoot, existingIndex);
  const parent = opts.replyTo ? existingIndex.messages.find(m => m.id === opts.replyTo) : undefined;
  if (opts.replyTo && !parent) throw new Error(`Reply parent not found: ${opts.replyTo}`);
  if (parent && parent.type === 'MEMO') throw new Error('Cannot reply to a self-addressed MEMO.');
  if (parent && !opts.relatedArtifact) relatedArtifact = parent.related_artifact ?? 'GENERAL';
  const context = parent && !opts.relatedArtifact ? entryContext(parent) : resolveMailboxReference(projectRoot, relatedArtifact);
  if (parent && context.intent_version && resolveMailboxReference(projectRoot, `INTENT-${context.intent_version}`).intent_version !== context.intent_version) throw new Error('Reply INTENT identity mismatch.');
  if (parent) {
    const parentContext = entryContext(parent);
    if (parentContext.context === 'LEGACY' || parentContext.intent_version !== context.intent_version || (parentContext.context === 'GENERAL') !== (context.context === 'GENERAL')) throw new Error('Reply context mismatch; activate the parent INTENT or send a new message with an ID pointer.');
  }
  if ('warning' in context && context.warning) console.warn(context.warning);
  const unread = getUnreadForRole(existingIndex, fromRole, { excludeMemo: true, scope: { intent: context.intent_version, includeGeneral: true } });
  if (unread.length > 0) {
    const ids = unread.map(m => `  - ${m.id}  [${m.from} → ${m.to}] ${m.type}: ${m.subject}`).join('\n');
    throw new Error(
      `SEND BLOCKED — ${fromRole} has ${unread.length} unread message${unread.length > 1 ? 's' : ''} in their own inbox.\n` +
      `${ids}\n\n` +
      `Policy: a sender must read their own unread messages in the target INTENT and GENERAL before sending.\n` +
      `This prevents AI roles from sending while ignoring their own unread mailbox entries.\n` +
      `Run: sigma inbox read <id>   (or: sigma inbox --role ${fromRole.toLowerCase()} to list them)`
    );
  }

  const ts = generateTimestamp();
  const suffix = generateRandomSuffix();
  const msgId = generateMessageId(fromRole, toRole, ts, suffix);
  const filename = generateFilename(msgType, fromRole, toRole, ts, suffix);

  // Preflight the recipient directory and identity before copying attachments.
  const inboxDir = resolveInboxDir(projectRoot, toRole, context.context);
  const relFilePath = toPosix(path.join('Sigma', 'messages', toRole, context.context, filename));
  const absFilePath = path.join(inboxDir, filename);
  if (existingIndex.messages.some(m => m.id === msgId) || fs.existsSync(absFilePath)) throw new Error('Message identity/destination collision; no overwrite.');

  // Handle attachment
  const attachmentPaths: string[] = [];
  if (opts.attach) {
    const srcPath = path.resolve(opts.attach);
    if (!fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
      throw new Error(`Attachment file not found: ${opts.attach}`);
    }
    const attachDir = assertMailboxPath(projectRoot, toPosix(MESSAGES_ATTACHMENTS_DIR));
    assertMailboxLease(projectRoot);
    fs.ensureDirSync(attachDir);
    const attachFilename = `${msgId}-${path.basename(srcPath)}`;
    const destPath = path.join(attachDir, attachFilename);
    fs.copySync(srcPath, destPath, { overwrite: false, errorOnExist: true });
    attachmentPaths.push(toPosix(path.join(MESSAGES_ATTACHMENTS_DIR, attachFilename)));
  }

  // Build index entry
  assertMailboxLease(projectRoot);
  fs.ensureDirSync(inboxDir);

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
    action,
    related_artifact: relatedArtifact,
    intent_version: context.intent_version,
    context: context.context,
    ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
  };

  // Write message markdown
  const markdown = buildMessageMarkdown(entry, body);
  assertMailboxLease(projectRoot);
  try { fs.writeFileSync(absFilePath, markdown, { encoding: 'utf8', flag: 'wx' }); }
  catch (err) { for (const a of attachmentPaths) fs.removeSync(path.join(projectRoot, a)); throw err; }

  // Update index
  existingIndex.messages.push(entry);
  try { writeIndex(projectRoot, existingIndex); } catch (err) { fs.removeSync(absFilePath); for (const a of attachmentPaths) fs.removeSync(path.join(projectRoot, a)); throw err; }

  console.log('\nMessage sent.');
  console.log(`  ID       : ${msgId}`);
  console.log(`  From     : ${fromRole} → ${toRole}`);
  console.log(`  Type     : ${msgType}`);
  console.log(`  Subject  : ${subject}`);
  console.log(`  Action   : ${action}`);
  console.log(`  Artifact : ${relatedArtifact}`);
  console.log(`  Context  : ${context.context} | INTENT ${context.intent_version ?? 'GENERAL'}`);
  console.log(`  File     : ${relFilePath}`);
  if (opts.replyTo) {
    console.log(`  Reply-To : ${opts.replyTo}`);
  }
  if (attachmentPaths.length > 0) {
    console.log(`  Attach   : ${attachmentPaths[0]}`);
  }
  console.log('');
}

export function sendCommand(): Command {
  const cmd = new Command('send');
  cmd.description(
    'Send a message from one role to another.\n' +
    '  Context follows --related-artifact, a reply parent, or GENERAL fallback.\n' +
    '  Message files are CLI-generated — never create or rename them manually.\n' +
    '  Policy: read sender UNREAD in the target INTENT and GENERAL before sending.\n' +
    '  Clear unread with: sigma inbox read <id>\n' +
    '  Valid messaging roles: arc, fmn, dev, aud (director communicates directly)'
  );

  cmd
    .requiredOption('--from <role>', `Sender role (${MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .requiredOption('--to <role>', `Recipient role (${MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .option('--type <type>', `Message type (${VALID_MESSAGE_TYPES.map(t => t.toLowerCase()).join('|')})`, 'note')
    .option('--subject <subject>', 'Short subject line')
    .option('--message <body>', 'Message body (single-line; use --message-file for multi-line content)')
    .option('--message-file <path>', 'Path to a file whose contents become the message body (preserves newlines)')
    .option('--attach <file>', 'File to attach (copied into Sigma/messages/attachments/)')
    .option('--reply-to <id>', 'Existing parent message ID; its INTENT must match the active context')
    .option('--action <action>', `Action required from recipient (${VALID_ACTIONS.map(a => a.toLowerCase()).join('|')})`, 'fyi')
    .option('--related-artifact <artifact>', 'Artifact reference or GENERAL (reply defaults to parent context)')
    .action(async (opts: {
      from: string; to: string; type?: string; subject?: string;
      message?: string; messageFile?: string; attach?: string; replyTo?: string;
      action?: string; relatedArtifact?: string;
    }) => {
      try {
        await withMailboxLock(findProjectRoot(), () => runSend(opts));
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
