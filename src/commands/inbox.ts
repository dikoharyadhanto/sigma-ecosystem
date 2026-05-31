import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { MESSAGING_ROLES, MessagingRole, VALID_ROLES, VALID_MESSAGE_TYPES } from '../config';
import {
  readIndex,
  writeIndex,
  getMessagesForRole,
  updateMessageStatus,
  MessageEntry,
} from '../engine/mailbox';
import { findProjectRoot } from '../utils/fs';

function validateRole(value: string): MessagingRole {
  const upper = value.toUpperCase() as MessagingRole;
  if (!(MESSAGING_ROLES as readonly string[]).includes(upper)) {
    throw new Error(
      `Invalid role "${value}". Valid messaging roles: ${MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}.\n` +
      `DIRECTOR communicates directly — no CLI inbox needed.`
    );
  }
  return upper;
}

function printMessageSummary(entry: MessageEntry, index: number): void {
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

function runList(role: MessagingRole, includeAll: boolean): void {
  const projectRoot = findProjectRoot();
  const index = readIndex(projectRoot);
  const messages = getMessagesForRole(index, role, includeAll);
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
  } else {
    console.log(`${messages.length} ${label.toLowerCase()}:`);
  }
  messages.forEach((m, i) => printMessageSummary(m, i + 1));
  console.log(`\nRun: sigma inbox read <id>`);
  console.log('');
}

function runRead(messageId: string): void {
  const projectRoot = findProjectRoot();
  const index = readIndex(projectRoot);
  const entry = index.messages.find(m => m.id === messageId);

  if (!entry) {
    throw new Error(`Message not found: ${messageId}`);
  }

  const absPath = path.join(projectRoot, entry.file);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Message file missing on disk: ${entry.file}`);
  }

  const content = fs.readFileSync(absPath, 'utf8');
  console.log('\n' + content);

  if (entry.status === 'UNREAD') {
    updateMessageStatus(index, messageId, 'READ');
    writeIndex(projectRoot, index);
    console.log(`[Marked as READ: ${messageId}]\n`);
  }
}

function runArchive(messageId: string): void {
  const projectRoot = findProjectRoot();
  const index = readIndex(projectRoot);

  updateMessageStatus(index, messageId, 'ARCHIVED');
  writeIndex(projectRoot, index);

  console.log(`Message ${messageId} archived.`);
}

function runCheck(): void {
  const projectRoot = findProjectRoot();
  const index = readIndex(projectRoot);
  const messagesDir = path.join(projectRoot, 'Sigma', 'messages');

  let passes = 0;
  let warnings = 0;
  let failures = 0;

  console.log('\n=== sigma inbox check ===\n');

  // 1. Check every entry in index has a corresponding .md file
  console.log('Checking index entries → disk files...');
  for (const entry of index.messages) {
    const absPath = path.join(projectRoot, entry.file);
    if (!fs.existsSync(absPath)) {
      console.log(`  ✗ MISSING FILE: ${entry.id} → ${entry.file}`);
      failures++;
    } else {
      passes++;
    }
  }

  // 2. Check every .md file in per-role folders has a corresponding index entry
  console.log('\nChecking disk files → index entries...');
  const indexedFiles = new Set(index.messages.map(m => m.file));
  for (const role of MESSAGING_ROLES) {
    const roleDir = path.join(messagesDir, role);
    if (!fs.existsSync(roleDir)) continue;
    const files = fs.readdirSync(roleDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const relPath = path.join('Sigma', 'messages', role, file);
      if (!indexedFiles.has(relPath)) {
        console.log(`  ⚠ ORPHAN FILE: ${relPath} (not in index)`);
        warnings++;
      } else {
        passes++;
      }
    }
  }

  // 3. Check attachment paths exist
  console.log('\nChecking attachment paths...');
  let attachChecked = 0;
  for (const entry of index.messages) {
    for (const att of entry.attachments) {
      const absAtt = path.join(projectRoot, att);
      if (!fs.existsSync(absAtt)) {
        console.log(`  ✗ MISSING ATTACHMENT: ${entry.id} → ${att}`);
        failures++;
      } else {
        attachChecked++;
      }
    }
  }
  if (attachChecked > 0) console.log(`  ✓ ${attachChecked} attachment(s) verified`);

  // 4. Check for valid roles and statuses
  console.log('\nChecking field validity...');
  const validStatuses = ['UNREAD', 'READ', 'ARCHIVED'];
  const ids = new Set<string>();
  for (const entry of index.messages) {
    if (ids.has(entry.id)) {
      console.log(`  ✗ DUPLICATE ID: ${entry.id}`);
      failures++;
    }
    ids.add(entry.id);
    if (!(VALID_ROLES as readonly string[]).includes(entry.from)) {
      console.log(`  ✗ INVALID from role: ${entry.id} → ${entry.from}`);
      failures++;
    }
    if (!(VALID_ROLES as readonly string[]).includes(entry.to)) {
      console.log(`  ✗ INVALID to role: ${entry.id} → ${entry.to}`);
      failures++;
    }
    if (!validStatuses.includes(entry.status)) {
      console.log(`  ✗ INVALID status: ${entry.id} → ${entry.status}`);
      failures++;
    }
    if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(entry.type)) {
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
  } else if (warnings > 0) {
    console.log('Orphan files found — they can be removed or added to the index manually.');
  } else {
    console.log('Inbox integrity verified. No issues found.');
  }
  console.log('');
}

export function inboxCommand(): Command {
  const cmd = new Command('inbox');
  cmd.description(
    'Manage role message inbox. Messages are stored in Sigma/messages/{ROLE}/.\n' +
    '  List unread  : sigma inbox --role <role>\n' +
    '  List all     : sigma inbox --role <role> --all\n' +
    '  Read message : sigma inbox read <id>   (marks as READ)\n' +
    '  Archive      : sigma inbox archive <id>\n' +
    '  Check        : sigma inbox check       (validates index vs disk files)'
  );

  cmd
    .option('--role <role>', `Role inbox to view (${MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .option('--all', 'Include READ and ARCHIVED messages (default: unread only)')
    .action((opts: { role?: string; all?: boolean }) => {
      try {
        if (!opts.role) {
          console.error('--role is required. Use: sigma inbox --role <role>');
          console.error(`Valid messaging roles: ${MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}`);
          process.exit(1);
        }
        const role = validateRole(opts.role);
        runList(role, opts.all ?? false);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('read <message-id>')
    .description('Read a message and mark it as READ')
    .action((messageId: string) => {
      try {
        runRead(messageId);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('archive <message-id>')
    .description('Archive a message (hides from default listing)')
    .action((messageId: string) => {
      try {
        runArchive(messageId);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('check')
    .description('Run integrity check: validate index entries vs disk files, attachments, field values')
    .action(() => {
      try {
        runCheck();
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
