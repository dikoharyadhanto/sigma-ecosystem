import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { MESSAGING_ROLES, MessagingRole } from '../config';
import {
  readIndex,
  writeIndex,
  generateTimestamp,
  generateRandomSuffix,
  generateMessageId,
  generateFilename,
  resolveInboxDir,
  getUnreadMemosForRole,
  selectSurplusRead,
  updateMessageStatus,
  MessageEntry,
} from '../engine/mailbox';
import { readProjectConfig, resolveMemoLimit, resolveAutoOutdateKeep } from '../engine/projectConfig';
import { readActiveChain } from '../engine/chain';
import { findProjectRoot } from '../utils/fs';

// PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF §9 poin 7 (Director 2026-09-12).
// Stored in the existing MessageEntry.related_artifact field — no schema
// change. GENERAL covers memos not tied to a specific governed artifact
// (e.g. pre-INTENT Professional Mode exploration).
const REF_PATTERN = /^(INTENT|PLAN|EXEC)-v\d+(?:\.\d+)*$/;

function validateRole(value: string): MessagingRole {
  const upper = value.toUpperCase() as MessagingRole;
  if (!(MESSAGING_ROLES as readonly string[]).includes(upper)) {
    throw new Error(
      `Invalid --role "${value}". Valid messaging roles: ${MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}.\n` +
      `DIRECTOR communicates directly — no CLI inbox needed.`
    );
  }
  return upper;
}

function validateRef(value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      '--ref is required. Valid values: INTENT-vN, PLAN-vN, EXEC-vN (matching an existing chain artifact version), or GENERAL.'
    );
  }
  const trimmed = value.trim();
  if (trimmed !== 'GENERAL' && !REF_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid --ref "${value}". Valid values: INTENT-vN, PLAN-vN, EXEC-vN, or GENERAL.`
    );
  }
  return trimmed;
}

function buildMemoMarkdown(role: MessagingRole, ts: string, chainLine: string, ref: string, topic: string, body: string): string {
  const when = ts.slice(0, 16).replace('T', ' ');
  return `## Memo — ${role} — ${when}

**Chain / Phase / Version:** ${chainLine}

**Sigma Artifact Reference:** ${ref}

**Topic:** ${topic}

${body}
`;
}

function resolveChainLine(projectRoot: string): string {
  try {
    const { chainVersion, data: chain } = readActiveChain(projectRoot);
    const planVersion = chain.plan.active_version ?? '—';
    const planState = chain.plan.active_state ?? '—';
    const execVersion = chain.exec.active_version ?? '—';
    const execState = chain.exec.active_state ?? '—';
    return `${chainVersion} | ${chain.lifecycle_state} | INTENT ${chain.intent.version} (${chain.intent.state}) · ` +
      `PLAN ${planVersion} (${planState}) · EXEC ${execVersion} (${execState})`;
  } catch {
    return '(unresolved — no active chain)';
  }
}

function runMemoWrite(opts: {
  role?: string;
  to?: string;
  ref?: string;
  topic?: string;
  message?: string;
  messageFile?: string;
  subject?: string;
}): void {
  if (opts.to) {
    throw new Error(
      'sigma memo does not take --to — a memo is always to your own role. Use sigma send for cross-role messages.'
    );
  }
  if (!opts.role) {
    throw new Error('--role is required. Use: sigma memo write --role <role> --ref <ref> --topic "<sentence>" --message "..."');
  }
  const role = validateRole(opts.role);
  const ref = validateRef(opts.ref);

  const topic = (opts.topic ?? '').trim();
  if (topic === '') {
    throw new Error('--topic is required and must not be empty — one sentence describing what this memo is about.');
  }

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

  const subject = opts.subject?.trim() || topic;

  const projectRoot = findProjectRoot();
  const config = readProjectConfig(projectRoot);
  const limit = resolveMemoLimit(config);

  if (limit === 0) {
    throw new Error(
      'Memo is disabled (mailbox.memo_unread_limit = 0). Enable with: sigma config set memo-limit 5'
    );
  }

  const existingIndex = readIndex(projectRoot);
  const unreadMemos = getUnreadMemosForRole(existingIndex, role);
  if (unreadMemos.length >= limit) {
    const ids = unreadMemos.map(m => `  - ${m.id}  ${m.subject}`).join('\n');
    throw new Error(
      `MEMO QUOTA FULL — ${role} already has ${unreadMemos.length}/${limit} unread memo${unreadMemos.length > 1 ? 's' : ''}.\n` +
      `${ids}\n\n` +
      `Read them first: sigma memo read <id>   (or: sigma memo list --role ${role.toLowerCase()})`
    );
  }

  const chainLine = resolveChainLine(projectRoot);

  const ts = generateTimestamp();
  const suffix = generateRandomSuffix();
  const msgId = generateMessageId(role, role, ts, suffix);
  const filename = generateFilename('MEMO', role, role, ts, suffix);

  const markdown = buildMemoMarkdown(role, ts, chainLine, ref, topic, body);

  const inboxDir = resolveInboxDir(projectRoot, role);
  fs.ensureDirSync(inboxDir);
  const relFilePath = path.join('Sigma', 'messages', role, filename);
  const absFilePath = path.join(inboxDir, filename);
  fs.writeFileSync(absFilePath, markdown, 'utf8');

  const entry: MessageEntry = {
    id: msgId,
    from: role,
    to: role,
    type: 'MEMO',
    subject,
    file: relFilePath,
    status: 'UNREAD',
    created_at: ts,
    attachments: [],
    action: 'FYI',
    related_artifact: ref,
  };

  const index = readIndex(projectRoot);
  index.messages.push(entry);
  writeIndex(projectRoot, index);

  console.log('\nMemo written.');
  console.log(`  ID    : ${msgId}`);
  console.log(`  Role  : ${role}`);
  console.log(`  Ref   : ${ref}`);
  console.log(`  Topic : ${topic}`);
  console.log(`  File  : ${relFilePath}`);
  console.log(`  Slot  : ${unreadMemos.length + 1}/${limit}`);
  console.log('');
}

function runMemoList(opts: { role?: string; all?: boolean }): void {
  if (!opts.role) {
    throw new Error('--role is required. Use: sigma memo list --role <role>');
  }
  const role = validateRole(opts.role);

  const projectRoot = findProjectRoot();
  const config = readProjectConfig(projectRoot);
  const limit = resolveMemoLimit(config);
  const index = readIndex(projectRoot);

  const memos = index.messages
    .filter(m => m.to === role && m.type === 'MEMO' && (opts.all || m.status === 'UNREAD'))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const unreadCount = getUnreadMemosForRole(index, role).length;
  console.log(`\nMemo — ${role} — ${unreadCount}/${limit} slot terpakai`);

  if (memos.length === 0) {
    console.log(opts.all ? 'No memos.' : 'No unread memos.');
    console.log('');
    return;
  }

  console.log(`\n${memos.length} memo${memos.length === 1 ? '' : 's'}:`);
  memos.forEach((m, i) => {
    console.log(`\n${i + 1}. [${m.status}] ${m.related_artifact || 'GENERAL'} — ${m.subject}`);
    console.log(`   ID      : ${m.id}`);
    console.log(`   Created : ${m.created_at}`);
  });
  console.log(`\nRun: sigma memo read <id>`);
  console.log('');
}

function runMemoRead(memoId: string): void {
  const projectRoot = findProjectRoot();
  const index = readIndex(projectRoot);
  const entry = index.messages.find(m => m.id === memoId);

  if (!entry) {
    throw new Error(`Memo not found: ${memoId}`);
  }
  if (entry.type !== 'MEMO') {
    throw new Error(`${memoId} is not a memo. Use: sigma inbox read ${memoId}`);
  }

  const absPath = path.join(projectRoot, entry.file);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Memo file missing on disk: ${entry.file}`);
  }

  const content = fs.readFileSync(absPath, 'utf8');
  console.log('\n' + content);

  let dirty = false;
  if (entry.status === 'UNREAD') {
    updateMessageStatus(index, memoId, 'READ');
    dirty = true;
    console.log(`[Marked as READ: ${memoId}]\n`);
  }

  // Same legacy auto-sweep as `sigma inbox read` (Fase 5 — no new mechanism):
  // memo and regular messages to this role share one "keep N most recent
  // READ" pool, exactly as selectSurplusRead already behaves.
  const keep = resolveAutoOutdateKeep(readProjectConfig(projectRoot));
  if (keep > 0) {
    const surplus = selectSurplusRead(index, entry.to, keep).filter(m => m.id !== memoId);
    for (const m of surplus) updateMessageStatus(index, m.id, 'OUTDATED');
    if (surplus.length > 0) {
      dirty = true;
      console.log(
        `[${surplus.length} older READ message${surplus.length === 1 ? '' : 's'} moved to OUTDATED — ` +
        `see: sigma inbox --role ${entry.to.toLowerCase()} --outdated]\n`
      );
    }
  }

  if (dirty) writeIndex(projectRoot, index);
}

export function memoCommand(): Command {
  const cmd = new Command('memo');
  cmd.description(
    'Self-to-self operational brief — a role leaving itself a resume note across sessions.\n' +
    '  Not a cross-role message: --to is not accepted. Use sigma send for that.\n' +
    '  Write : sigma memo write --role <role> --ref <ref> --topic "<sentence>" --message "..."\n' +
    '  List  : sigma memo list --role <role> [--all]\n' +
    '  Read  : sigma memo read <id>'
  );

  cmd
    .command('write')
    .description('Write a memo to your own role inbox')
    .option('--role <role>', `Role this memo belongs to (${MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .option('--to <role>', 'Not supported — a memo is always self-addressed')
    .option('--ref <ref>', 'Sigma Artifact Reference: INTENT-vN | PLAN-vN | EXEC-vN | GENERAL')
    .option('--topic <sentence>', 'One-sentence topic — defaults --subject when --subject is omitted')
    .option('--subject <subject>', 'Short subject line (defaults to --topic)')
    .option('--message <body>', 'Memo body (single-line; use --message-file for multi-line content)')
    .option('--message-file <path>', 'Path to a file whose contents become the memo body (preserves newlines)')
    .action((opts: {
      role?: string; to?: string; ref?: string; topic?: string;
      subject?: string; message?: string; messageFile?: string;
    }) => {
      try {
        runMemoWrite(opts);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('list')
    .description('List memos for a role (default: UNREAD only)')
    .option('--role <role>', `Role inbox to view (${MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .option('--all', 'Include READ and OUTDATED memos')
    .action((opts: { role?: string; all?: boolean }) => {
      try {
        runMemoList(opts);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd
    .command('read <memo-id>')
    .description('Read a memo and mark it as READ')
    .action((memoId: string) => {
      try {
        runMemoRead(memoId);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
