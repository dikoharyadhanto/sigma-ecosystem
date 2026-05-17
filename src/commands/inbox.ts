import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { VALID_ROLES, SigmaRole } from '../config';
import {
  readIndex,
  writeIndex,
  getMessagesForRole,
  updateMessageStatus,
  MessageEntry,
} from '../engine/mailbox';
import { findProjectRoot } from '../utils/fs';

function validateRole(value: string): SigmaRole {
  const upper = value.toUpperCase() as SigmaRole;
  if (!(VALID_ROLES as readonly string[]).includes(upper)) {
    throw new Error(
      `Invalid role "${value}". Valid roles: ${VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`
    );
  }
  return upper;
}

function printMessageSummary(entry: MessageEntry, index: number): void {
  console.log(`\n${index}. [${entry.from} → ${entry.to}] ${entry.type}: ${entry.subject}`);
  console.log(`   ID   : ${entry.id}`);
  console.log(`   File : ${entry.file}`);
  if (entry.attachments.length > 0) {
    console.log(`   Attach: ${entry.attachments.join(', ')}`);
  }
}

function runList(role: SigmaRole, includeAll: boolean): void {
  const projectRoot = findProjectRoot();
  const index = readIndex(projectRoot);
  const messages = getMessagesForRole(index, role, includeAll);

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

export function inboxCommand(): Command {
  const cmd = new Command('inbox');
  cmd.description('Manage role message inbox');

  cmd
    .option('--role <role>', `Role inbox to view (${VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .option('--all', 'Include READ and ARCHIVED messages (default: unread only)')
    .action((opts: { role?: string; all?: boolean }) => {
      try {
        if (!opts.role) {
          console.error('--role is required. Use: sigma inbox --role <role>');
          console.error(`Valid roles: ${VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`);
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

  return cmd;
}
