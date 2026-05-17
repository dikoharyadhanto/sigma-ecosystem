"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readIndex = readIndex;
exports.writeIndex = writeIndex;
exports.generateTimestamp = generateTimestamp;
exports.formatTimestampForId = formatTimestampForId;
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
function readIndex(projectRoot) {
    const indexPath = path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE);
    if (!fs_extra_1.default.existsSync(indexPath))
        return { messages: [] };
    try {
        return fs_extra_1.default.readJsonSync(indexPath);
    }
    catch {
        return { messages: [] };
    }
}
function writeIndex(projectRoot, index) {
    const indexPath = path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE);
    fs_extra_1.default.writeJsonSync(indexPath, index, { spaces: 2 });
}
function generateTimestamp() {
    return new Date().toISOString();
}
function formatTimestampForId(iso) {
    // YYYYMMDD-HHMMSS from ISO string
    return iso.replace(/[-:T]/g, '').slice(0, 15).replace(/(\d{8})(\d{6}).*/, '$1-$2');
}
function generateMessageId(from, to, ts) {
    return `MSG-${formatTimestampForId(ts)}-${from}-${to}`;
}
function generateFilename(type, from, to, ts) {
    return `${formatTimestampForId(ts)}-${type}-${from}-to-${to}.md`;
}
function buildMessageMarkdown(entry, body) {
    const attachmentCell = entry.attachments.length > 0
        ? entry.attachments.join(', ')
        : '—';
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
| Authority Level | Context Only |
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