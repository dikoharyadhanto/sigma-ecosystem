"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoCommand = memoCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const mailbox_1 = require("../engine/mailbox");
const projectConfig_1 = require("../engine/projectConfig");
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
// PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF §9 poin 7 (Director 2026-09-12).
// Stored in the existing MessageEntry.related_artifact field — no schema
// change. GENERAL covers memos not tied to a specific governed artifact
// (e.g. pre-INTENT Professional Mode exploration).
const REF_PATTERN = /^(INTENT|PLAN|EXEC)-v\d+(?:\.\d+)*$/;
function validateRole(value) {
    const upper = value.toUpperCase();
    if (!config_1.MESSAGING_ROLES.includes(upper)) {
        throw new Error(`Invalid --role "${value}". Valid messaging roles: ${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join(', ')}.\n` +
            `DIRECTOR communicates directly — no CLI inbox needed.`);
    }
    return upper;
}
function validateRef(value) {
    if (!value || value.trim() === '') {
        throw new Error('--ref is required. Valid values: INTENT-vN, PLAN-vN, EXEC-vN (matching an existing chain artifact version), or GENERAL.');
    }
    const trimmed = value.trim();
    if (trimmed !== 'GENERAL' && !REF_PATTERN.test(trimmed)) {
        throw new Error(`Invalid --ref "${value}". Valid values: INTENT-vN, PLAN-vN, EXEC-vN, or GENERAL.`);
    }
    return trimmed;
}
function buildMemoMarkdown(role, ts, chainLine, ref, topic, body) {
    const when = ts.slice(0, 16).replace('T', ' ');
    return `## Memo — ${role} — ${when}

**Chain / Phase / Version:** ${chainLine}

**Sigma Artifact Reference:** ${ref}

**Topic:** ${topic}

${body}
`;
}
function resolveChainLine(projectRoot) {
    try {
        const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
        const planVersion = chain.plan.active_version ?? '—';
        const planState = chain.plan.active_state ?? '—';
        const execVersion = chain.exec.active_version ?? '—';
        const execState = chain.exec.active_state ?? '—';
        return `${chainVersion} | ${chain.lifecycle_state} | INTENT ${chain.intent.version} (${chain.intent.state}) · ` +
            `PLAN ${planVersion} (${planState}) · EXEC ${execVersion} (${execState})`;
    }
    catch {
        return '(unresolved — no active chain)';
    }
}
function runMemoWrite(opts) {
    if (opts.to) {
        throw new Error('sigma memo does not take --to — a memo is always to your own role. Use sigma send for cross-role messages.');
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
    const subject = opts.subject?.trim() || topic;
    const projectRoot = (0, fs_1.findProjectRoot)();
    const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
    const limit = (0, projectConfig_1.resolveMemoLimit)(config);
    if (limit === 0) {
        throw new Error('Memo is disabled (mailbox.memo_unread_limit = 0). Enable with: sigma config set memo-limit 5');
    }
    const existingIndex = (0, mailbox_1.readIndex)(projectRoot);
    const unreadMemos = (0, mailbox_1.getUnreadMemosForRole)(existingIndex, role);
    if (unreadMemos.length >= limit) {
        const ids = unreadMemos.map(m => `  - ${m.id}  ${m.subject}`).join('\n');
        throw new Error(`MEMO QUOTA FULL — ${role} already has ${unreadMemos.length}/${limit} unread memo${unreadMemos.length > 1 ? 's' : ''}.\n` +
            `${ids}\n\n` +
            `Read them first: sigma memo read <id>   (or: sigma memo list --role ${role.toLowerCase()})`);
    }
    const chainLine = resolveChainLine(projectRoot);
    const ts = (0, mailbox_1.generateTimestamp)();
    const suffix = (0, mailbox_1.generateRandomSuffix)();
    const msgId = (0, mailbox_1.generateMessageId)(role, role, ts, suffix);
    const filename = (0, mailbox_1.generateFilename)('MEMO', role, role, ts, suffix);
    const markdown = buildMemoMarkdown(role, ts, chainLine, ref, topic, body);
    const inboxDir = (0, mailbox_1.resolveInboxDir)(projectRoot, role);
    fs_extra_1.default.ensureDirSync(inboxDir);
    const relFilePath = path_1.default.join('Sigma', 'messages', role, filename);
    const absFilePath = path_1.default.join(inboxDir, filename);
    fs_extra_1.default.writeFileSync(absFilePath, markdown, 'utf8');
    const entry = {
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
    const index = (0, mailbox_1.readIndex)(projectRoot);
    index.messages.push(entry);
    (0, mailbox_1.writeIndex)(projectRoot, index);
    console.log('\nMemo written.');
    console.log(`  ID    : ${msgId}`);
    console.log(`  Role  : ${role}`);
    console.log(`  Ref   : ${ref}`);
    console.log(`  Topic : ${topic}`);
    console.log(`  File  : ${relFilePath}`);
    console.log(`  Slot  : ${unreadMemos.length + 1}/${limit}`);
    console.log('');
}
function runMemoList(opts) {
    if (!opts.role) {
        throw new Error('--role is required. Use: sigma memo list --role <role>');
    }
    const role = validateRole(opts.role);
    const projectRoot = (0, fs_1.findProjectRoot)();
    const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
    const limit = (0, projectConfig_1.resolveMemoLimit)(config);
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const memos = index.messages
        .filter(m => m.to === role && m.type === 'MEMO' && (opts.all || m.status === 'UNREAD'))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const unreadCount = (0, mailbox_1.getUnreadMemosForRole)(index, role).length;
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
function runMemoRead(memoId) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const entry = index.messages.find(m => m.id === memoId);
    if (!entry) {
        throw new Error(`Memo not found: ${memoId}`);
    }
    if (entry.type !== 'MEMO') {
        throw new Error(`${memoId} is not a memo. Use: sigma inbox read ${memoId}`);
    }
    const absPath = path_1.default.join(projectRoot, entry.file);
    if (!fs_extra_1.default.existsSync(absPath)) {
        throw new Error(`Memo file missing on disk: ${entry.file}`);
    }
    const content = fs_extra_1.default.readFileSync(absPath, 'utf8');
    console.log('\n' + content);
    let dirty = false;
    if (entry.status === 'UNREAD') {
        (0, mailbox_1.updateMessageStatus)(index, memoId, 'READ');
        dirty = true;
        console.log(`[Marked as READ: ${memoId}]\n`);
    }
    // Same legacy auto-sweep as `sigma inbox read` (Fase 5 — no new mechanism):
    // memo and regular messages to this role share one "keep N most recent
    // READ" pool, exactly as selectSurplusRead already behaves.
    const keep = (0, projectConfig_1.resolveAutoOutdateKeep)((0, projectConfig_1.readProjectConfig)(projectRoot));
    if (keep > 0) {
        const surplus = (0, mailbox_1.selectSurplusRead)(index, entry.to, keep).filter(m => m.id !== memoId);
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
function memoCommand() {
    const cmd = new commander_1.Command('memo');
    cmd.description('Self-to-self operational brief — a role leaving itself a resume note across sessions.\n' +
        '  Not a cross-role message: --to is not accepted. Use sigma send for that.\n' +
        '  Write : sigma memo write --role <role> --ref <ref> --topic "<sentence>" --message "..."\n' +
        '  List  : sigma memo list --role <role> [--all]\n' +
        '  Read  : sigma memo read <id>');
    cmd
        .command('write')
        .description('Write a memo to your own role inbox')
        .option('--role <role>', `Role this memo belongs to (${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--to <role>', 'Not supported — a memo is always self-addressed')
        .option('--ref <ref>', 'Sigma Artifact Reference: INTENT-vN | PLAN-vN | EXEC-vN | GENERAL')
        .option('--topic <sentence>', 'One-sentence topic — defaults --subject when --subject is omitted')
        .option('--subject <subject>', 'Short subject line (defaults to --topic)')
        .option('--message <body>', 'Memo body (single-line; use --message-file for multi-line content)')
        .option('--message-file <path>', 'Path to a file whose contents become the memo body (preserves newlines)')
        .action((opts) => {
        try {
            runMemoWrite(opts);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('list')
        .description('List memos for a role (default: UNREAD only)')
        .option('--role <role>', `Role inbox to view (${config_1.MESSAGING_ROLES.map(r => r.toLowerCase()).join('|')})`)
        .option('--all', 'Include READ and OUTDATED memos')
        .action((opts) => {
        try {
            runMemoList(opts);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd
        .command('read <memo-id>')
        .description('Read a memo and mark it as READ')
        .action((memoId) => {
        try {
            runMemoRead(memoId);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=memo.js.map