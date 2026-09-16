"use strict";
// Stage E W1 — sigma_inbox_archive's compute function. MCP-only, deliberately
// NOT extracted as a shared CLI+MCP service (contrast every other Stage E
// primitive) and NOT a straight port of `sigma inbox archive`'s CLI
// behavior — see the file header rationale below.
//
// CLI `sigma inbox archive <id>` (src/commands/inbox.ts) has no role/
// ownership concept at all: any caller who knows a message ID can archive
// any role's message, because the CLI command takes no --role and never
// filters on `entry.to`. That is tolerable for a trusted human at a
// terminal; it is a real gap once this becomes callable by an AI
// role/orchestrator through MCP, which is exactly the class of concern that
// got the MCP mailbox read/list primitives (`sigma_list_messages`,
// `sigma_read_message`) reverted by Director after a Codex review found
// role-mismatch issues (capability matrix §3.6). Director decision
// (2026-09-16, clarifying this specific primitive): add an ownership check
// here — a bound role may only archive a message addressed to itself
// (`entry.to === actorRole`) — as new MCP-only behavior. The CLI command is
// deliberately left untouched: it has no role/binding concept to enforce
// this against, and changing its behavior was not asked for.
//
// Reuses readIndex/writeIndex/updateMessageStatus from src/engine/mailbox.ts
// unmodified — only the ownership gate in front of them is new.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveMessageTransactionFiles = archiveMessageTransactionFiles;
exports.archiveMessage = archiveMessage;
const path_1 = __importDefault(require("path"));
const mailbox_1 = require("../../engine/mailbox");
const config_1 = require("../../config");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const controlStore_1 = require("../../engine/controlStore");
function archiveMessageTransactionFiles(projectRoot) {
    return [path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE)];
}
function archiveMessage(input) {
    const { projectRoot, actorRole, messageId } = input;
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const entry = index.messages.find(m => m.id === messageId);
    if (!entry) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Message not found: ${messageId}`);
    }
    if (entry.to !== actorRole) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.ROLE_NOT_AUTHORIZED, `Message ${messageId} is addressed to ${entry.to}, not ${actorRole}. A role may only archive its own messages.`);
    }
    (0, mailbox_1.updateMessageStatus)(index, messageId, 'ARCHIVED');
    (0, controlStore_1.controlTestFailpoint)('inbox_archive_after_status');
    (0, mailbox_1.writeIndex)(projectRoot, index);
    (0, controlStore_1.controlTestFailpoint)('inbox_archive_after_write');
    return { id: messageId, status: 'ARCHIVED' };
}
//# sourceMappingURL=inboxArchive.js.map