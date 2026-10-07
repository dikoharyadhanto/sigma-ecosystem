"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_STATUSES = void 0;
exports.validateMailboxIndexData = validateMailboxIndexData;
exports.readIndex = readIndex;
exports.writeIndex = writeIndex;
exports.generateTimestamp = generateTimestamp;
exports.formatTimestampForId = formatTimestampForId;
exports.generateRandomSuffix = generateRandomSuffix;
exports.generateMessageId = generateMessageId;
exports.generateFilename = generateFilename;
exports.buildMessageMarkdown = buildMessageMarkdown;
exports.getUnreadForRole = getUnreadForRole;
exports.selectInboxMessages = selectInboxMessages;
exports.getUnreadMemosForRole = getUnreadMemosForRole;
exports.countUnreadMemos = countUnreadMemos;
exports.selectSurplusRead = selectSurplusRead;
exports.updateMessageStatus = updateMessageStatus;
exports.resolveInboxDir = resolveInboxDir;
exports.checkMailboxIntegrity = checkMailboxIntegrity;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const controlStore_1 = require("./controlStore");
const mailboxLock_1 = require("./mailboxLock");
const fs_1 = require("../utils/fs");
const mailboxContext_1 = require("./mailboxContext");
const config_1 = require("../config");
const config_2 = require("../config");
exports.VALID_STATUSES = ['UNREAD', 'READ', 'ARCHIVED', 'OUTDATED'];
const REQUIRED_ENTRY_FIELDS = ['id', 'from', 'to', 'type', 'subject', 'file', 'status', 'created_at'];
function corruptionError(detail) {
    return new Error(`Mailbox index corruption detected in ${config_2.MESSAGES_INDEX_FILE}: ${detail}\n` +
        `Inspect Sigma/messages/index.json manually. Do not delete it — message history may be recoverable from files in Sigma/messages/.\n` +
        `To repair duplicate-ID entries from older builds: remove the duplicate entry from the "messages" array in index.json, then re-run the command.`);
}
function validateMailboxIndexData(data) {
    if (typeof data !== 'object' || data === null) {
        throw corruptionError('root value is not an object');
    }
    const d = data;
    if (!('messages' in d) || !Array.isArray(d.messages)) {
        throw corruptionError('"messages" field is missing or not an array');
    }
    // Bug report 2026-08-30 (BUG B): entries written on Windows store `file`
    // with backslash separators (e.g. "Sigma\messages\DEV\...md"). On POSIX,
    // path.join() treats "\" as a literal filename character, so `sigma inbox
    // read`/`inbox check` look for a single file with backslashes in its name
    // and fail ENOENT even though the real forward-slash file exists. Normalize
    // to "/" on every read, before the duplicate-path check below so two
    // entries differing only by separator collapse. In-memory only — index.json
    // is not rewritten (mirrors normalizeFilePathsOnRead() in chain.ts).
    for (const m of d.messages) {
        if (m && typeof m === 'object') {
            const entry = m;
            if (typeof entry.file === 'string' && entry.file.includes('\\')) {
                entry.file = entry.file.replace(/\\/g, '/');
            }
            if (Array.isArray(entry.attachments)) {
                entry.attachments = entry.attachments.map(a => typeof a === 'string' && a.includes('\\') ? a.replace(/\\/g, '/') : a);
            }
        }
    }
    if (d.mailbox_format !== undefined && d.mailbox_format !== 2)
        throw corruptionError('unsupported mailbox_format');
    const ids = new Set();
    const files = new Set();
    for (let i = 0; i < d.messages.length; i++) {
        const m = d.messages[i];
        if (typeof m !== 'object' || m === null) {
            throw corruptionError(`entry at index ${i} is not an object`);
        }
        const entry = m;
        for (const field of REQUIRED_ENTRY_FIELDS) {
            if (typeof entry[field] !== 'string' || entry[field].length === 0) {
                throw corruptionError(`entry at index ${i} has missing or invalid field "${field}"`);
            }
        }
        if (!Array.isArray(entry.attachments) || entry.attachments.some(a => typeof a !== 'string')) {
            throw corruptionError(`entry at index ${i} has invalid "attachments" field (must be an array)`);
        }
        if (!exports.VALID_STATUSES.includes(entry.status)) {
            throw corruptionError(`entry at index ${i} has invalid status "${entry.status}"`);
        }
        const id = entry.id;
        if (ids.has(id)) {
            throw corruptionError(`duplicate message ID "${id}" at index ${i} — this can occur from same-second sends in older builds`);
        }
        ids.add(id);
        const file = entry.file;
        if (files.has(file)) {
            throw corruptionError(`duplicate file path "${file}" at index ${i}`);
        }
        files.add(file);
        (0, mailboxContext_1.validateMailboxContext)(entry, d.mailbox_format);
    }
    return data;
}
function readIndex(projectRoot) {
    const indexPath = (0, mailboxContext_1.assertMailboxPath)(projectRoot, config_2.MESSAGES_INDEX_FILE.replace(/\\/g, '/'));
    if (!fs_extra_1.default.existsSync(indexPath))
        return { messages: [] };
    let raw;
    try {
        raw = fs_extra_1.default.readJsonSync(indexPath);
    }
    catch {
        throw new Error(`Mailbox index is not valid JSON: ${config_2.MESSAGES_INDEX_FILE}.\n` +
            `Inspect Sigma/messages/index.json manually and restore or repair it.\n` +
            `Do not delete the file — message history may be recoverable from files in Sigma/messages/.`);
    }
    return validateMailboxIndexData(raw);
}
function writeIndex(projectRoot, index) {
    const indexPath = path_1.default.join(projectRoot, config_2.MESSAGES_INDEX_FILE);
    validateMailboxIndexData(index);
    (0, mailboxContext_1.assertMailboxPath)(projectRoot, config_2.MESSAGES_INDEX_FILE.replace(/\\/g, '/'));
    (0, mailboxLock_1.assertMailboxLease)(projectRoot);
    fs_extra_1.default.ensureDirSync(path_1.default.dirname(indexPath));
    if ((0, controlStore_1.journaledWriteIfActive)(projectRoot, indexPath, JSON.stringify(index, null, 2) + "\n"))
        return;
    const tmp = `${indexPath}.${process.pid}.${crypto_1.default.randomUUID()}.tmp`;
    fs_extra_1.default.writeJsonSync(tmp, index, { spaces: 2 });
    (0, fs_1.atomicReplaceFileSync)(tmp, indexPath);
}
function generateTimestamp() {
    return new Date().toISOString();
}
function formatTimestampForId(iso) {
    // YYYYMMDD-HHMMSSmmm — millisecond precision for collision resistance
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (!m)
        throw new Error(`Invalid ISO timestamp: ${iso}`);
    return `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}${m[6]}${m[7]}`;
}
function generateRandomSuffix() {
    return Math.random().toString(36).slice(2, 6).toUpperCase();
}
function generateMessageId(from, to, ts, suffix) {
    return `MSG-${formatTimestampForId(ts)}-${suffix}-${from}-${to}`;
}
function generateFilename(type, from, to, ts, suffix) {
    // MEMO is always from === to; the generic "<TYPE>-<FROM>-to-<TO>" pattern
    // would render as "MEMO-DEV-to-DEV", a redundant role mention. Special-case
    // to a role-once form instead.
    if (type === 'MEMO') {
        return `MEMO-${from}-${formatTimestampForId(ts)}-${suffix}.md`;
    }
    return `${formatTimestampForId(ts)}-${suffix}-${type}-${from}-to-${to}.md`;
}
function buildMessageMarkdown(entry, body) {
    const attachmentCell = entry.attachments.length > 0
        ? entry.attachments.join(', ')
        : '—';
    const replyToRow = entry.reply_to ? `| Reply To       | ${entry.reply_to} |\n` : '';
    const relatedArtifact = entry.related_artifact || 'N/A';
    const selectedAction = entry.action || 'FYI';
    const actionChecklist = config_2.VALID_ACTIONS
        .map(a => `- [${a === selectedAction ? 'x' : ' '}] ${a}`)
        .join('\n');
    return `# MSG-${entry.id}

## Metadata

| Field          | Value |
| :---           | :---  |
| Message ID     | ${entry.id} |
| Type           | ${entry.type} |
| From           | ${entry.from} |
| To             | ${entry.to} |
| Subject        | ${entry.subject} |
| Status         | ${entry.status} |
| Created At     | ${entry.created_at} |
${replyToRow}| Related Artifact | ${relatedArtifact} |
| Mailbox Context | ${entry.context ?? 'LEGACY'} |
| Owning INTENT | ${entry.intent_version ?? '—'} |
| Attachments    | ${attachmentCell} |
${entry.contract_change ? "| Revision ID | " + entry.contract_change.revision_id + " |\n| Contract SHA256 | " + entry.contract_change.contract_sha256 + " |" : ""}

---

## Action Required

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe in the message body.

${actionChecklist}

---

## Message

${body}
`;
}
function getUnreadForRole(index, role, opts = {}) {
    return index.messages.filter(m => m.to === role && m.status === 'UNREAD' && (!opts.excludeMemo || m.type !== 'MEMO') && (0, mailboxContext_1.matchesMailboxScope)(m, opts.scope));
}
// MEMO is self-to-self and has its own listing (`sigma memo list`) — never
// shown in the cross-role `sigma inbox` view, in any tier.
function selectInboxMessages(index, role, view, scope) {
    return index.messages.filter(m => {
        if (m.to !== role || !(0, mailboxContext_1.matchesMailboxScope)(m, scope))
            return false;
        if (m.type === 'MEMO')
            return false;
        if (view === 'unread')
            return m.status === 'UNREAD';
        if (view === 'outdated')
            return m.status === 'OUTDATED';
        return m.status !== 'OUTDATED';
    });
}
function getUnreadMemosForRole(index, role, scope) {
    return index.messages.filter(m => m.to === role && m.type === 'MEMO' && m.status === 'UNREAD' && (0, mailboxContext_1.matchesMailboxScope)(m, scope));
}
function countUnreadMemos(index, role, scope) {
    return getUnreadMemosForRole(index, role, scope).length;
}
// READ messages addressed to `role`, oldest-first, beyond the `keep` most
// recent by created_at — the ones `sigma inbox clear` and the `inbox read`
// auto-sweep flip to OUTDATED. keep <= 0 selects every READ message.
function selectSurplusRead(index, role, keep, scope, memo) {
    const read = index.messages
        .filter(m => m.to === role && m.status === 'READ' && (0, mailboxContext_1.matchesMailboxScope)(m, scope) && (memo === undefined || (m.type === 'MEMO') === memo))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (keep <= 0)
        return read;
    if (read.length <= keep)
        return [];
    return read.slice(0, read.length - keep);
}
function updateMessageStatus(index, id, status) {
    const entry = index.messages.find(m => m.id === id);
    if (!entry)
        throw new Error(`Message not found: ${id}`);
    entry.status = status;
    return entry;
}
function resolveInboxDir(projectRoot, role, context = 'GENERAL', memo = false) {
    return (0, mailboxContext_1.assertMailboxPath)(projectRoot, `Sigma/${memo ? 'memo' : 'messages'}/${role}/${context}`);
}
function checkMailboxIntegrity(root) {
    const index = readIndex(root);
    const missingFiles = [];
    const missingAttachments = [];
    const invalidFields = [];
    let passes = 0;
    const membershipCache = new Map();
    for (const entry of index.messages) {
        try {
            (0, mailboxContext_1.assertMailboxPath)(root, entry.file, true);
            passes++;
        }
        catch {
            missingFiles.push({ id: entry.id, file: entry.file });
        }
        for (const att of entry.attachments) {
            try {
                (0, mailboxContext_1.assertMailboxPath)(root, att, true);
                passes++;
            }
            catch {
                missingAttachments.push({ id: entry.id, path: att });
            }
        }
        for (const field of ['from', 'to'])
            if (!config_1.VALID_ROLES.includes(entry[field]))
                invalidFields.push({ id: entry.id, field, value: entry[field] });
        if (!config_1.VALID_MESSAGE_TYPES.includes(entry.type))
            invalidFields.push({ id: entry.id, field: 'type', value: entry.type });
        try {
            (0, mailboxContext_1.validateMailboxContext)(entry, index.mailbox_format);
            if (index.mailbox_format === 2)
                (0, mailboxContext_1.validateEntryMembership)(root, entry, membershipCache);
        }
        catch (err) {
            invalidFields.push({ id: entry.id, field: 'context', value: err.message });
        }
    }
    const indexed = new Set(index.messages.map(m => m.file));
    const orphanFiles = (0, mailboxContext_1.mailboxDiskFiles)(root).filter(file => {
        if (indexed.has(file)) {
            passes++;
            return false;
        }
        return true;
    });
    const failures = missingFiles.length + missingAttachments.length + invalidFields.length;
    return {
        ok: failures === 0, passes, warnings: orphanFiles.length, failures,
        findings: { missing_files: missingFiles, orphan_files: orphanFiles, missing_attachments: missingAttachments, duplicate_ids: [], invalid_fields: invalidFields },
    };
}
//# sourceMappingURL=mailbox.js.map