"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readIndex = readIndex;
exports.writeIndex = writeIndex;
exports.generateTimestamp = generateTimestamp;
exports.formatTimestampForId = formatTimestampForId;
exports.generateRandomSuffix = generateRandomSuffix;
exports.generateMessageId = generateMessageId;
exports.generateFilename = generateFilename;
exports.buildMessageMarkdown = buildMessageMarkdown;
exports.getUnreadForRole = getUnreadForRole;
exports.getMessagesForRole = getMessagesForRole;
exports.updateMessageStatus = updateMessageStatus;
exports.resolveInboxDir = resolveInboxDir;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const VALID_STATUSES = ['UNREAD', 'READ', 'ARCHIVED'];
const REQUIRED_ENTRY_FIELDS = ['id', 'from', 'to', 'type', 'subject', 'file', 'status', 'created_at'];
function corruptionError(detail) {
    return new Error(`Mailbox index corruption detected in ${config_1.MESSAGES_INDEX_FILE}: ${detail}\n` +
        `Inspect Sigma/messages/index.json manually. Do not delete it — message history may be recoverable from files in Sigma/messages/.\n` +
        `To repair duplicate-ID entries from older builds: remove the duplicate entry from the "messages" array in index.json, then re-run the command.`);
}
function validateIndexData(data) {
    if (typeof data !== 'object' || data === null) {
        throw corruptionError('root value is not an object');
    }
    const d = data;
    if (!('messages' in d) || !Array.isArray(d.messages)) {
        throw corruptionError('"messages" field is missing or not an array');
    }
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
        if (!Array.isArray(entry.attachments)) {
            throw corruptionError(`entry at index ${i} has invalid "attachments" field (must be an array)`);
        }
        if (!VALID_STATUSES.includes(entry.status)) {
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
    }
    return data;
}
function readIndex(projectRoot) {
    const indexPath = path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE);
    if (!fs_extra_1.default.existsSync(indexPath))
        return { messages: [] };
    let raw;
    try {
        raw = fs_extra_1.default.readJsonSync(indexPath);
    }
    catch {
        throw new Error(`Mailbox index is not valid JSON: ${config_1.MESSAGES_INDEX_FILE}.\n` +
            `Inspect Sigma/messages/index.json manually and restore or repair it.\n` +
            `Do not delete the file — message history may be recoverable from files in Sigma/messages/.`);
    }
    return validateIndexData(raw);
}
function writeIndex(projectRoot, index) {
    const indexPath = path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE);
    fs_extra_1.default.writeJsonSync(indexPath, index, { spaces: 2 });
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
    return `${formatTimestampForId(ts)}-${suffix}-${type}-${from}-to-${to}.md`;
}
function buildMessageMarkdown(entry, body) {
    const attachmentCell = entry.attachments.length > 0
        ? entry.attachments.join(', ')
        : '—';
    const replyToRow = entry.reply_to ? `| Reply To | ${entry.reply_to} |\n` : '';
    return `# Sigma Role Message

## Metadata

| Field | Value |
| :--- | :--- |
| Message ID | ${entry.id} |
| Type | ${entry.type} |
| From Role | ${entry.from} |
| To Role | ${entry.to} |
| Subject | ${entry.subject} |
| Status | ${entry.status} |
| Created At | ${entry.created_at} |
${replyToRow}| Authority Level | Context Only |
| Attachments | ${attachmentCell} |

---

## Message

${body}
`;
}
function getUnreadForRole(index, role) {
    return index.messages.filter(m => m.to === role && m.status === 'UNREAD');
}
function getMessagesForRole(index, role, includeAll = false) {
    return index.messages.filter(m => {
        if (m.to !== role)
            return false;
        if (includeAll)
            return true;
        return m.status === 'UNREAD';
    });
}
function updateMessageStatus(index, id, status) {
    const entry = index.messages.find(m => m.id === id);
    if (!entry)
        throw new Error(`Message not found: ${id}`);
    entry.status = status;
    return entry;
}
function resolveInboxDir(projectRoot, role) {
    return path_1.default.join(projectRoot, config_1.MESSAGES_DIR, role);
}
//# sourceMappingURL=mailbox.js.map