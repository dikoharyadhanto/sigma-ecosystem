"use strict";
// Stage E W1 — sigma_inbox_archive's shared service. Refactored out of an
// MCP-only implementation (formerly src/mcp/control/inboxArchive.ts) after
// Codex's independent review (finding H-02, 2026-09-16) flagged the
// MCP-only version as violating Plan Doc invariant #9 ("same use case, two
// adapters") and §13's service-layer rule: a mutation use case must have
// exactly one implementation shared by CLI and MCP, not two.
//
// CLI `sigma inbox archive <id>` (src/commands/inbox.ts) has no role/
// binding concept at all — any caller who knows a message ID can archive
// any role's message, because the CLI never filters on `entry.to`. That is
// tolerable for a trusted human at a terminal; it is a real gap once this
// becomes callable by an AI role/orchestrator through MCP, which is the
// same class of concern that got sigma_list_messages/sigma_read_message
// reverted by Director after Codex found role-mismatch issues (capability
// matrix §3.6). Director decision (2026-09-16, clarifying this specific
// primitive): add an ownership check — a bound role may only archive a
// message addressed to itself — without changing CLI behavior.
//
// Reconciled with the shared-service invariant via `actorRole: string |
// null`: null means "trusted CLI caller, no ownership enforced" (CLI
// passes null, preserving today's exact behavior byte-for-byte); a role
// string means "MCP bound-role caller" and enforces `entry.to ===
// actorRole`. One function, one code path, two call-time policies — not
// two implementations.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InboxArchiveError = void 0;
exports.archiveMessageTransactionFiles = archiveMessageTransactionFiles;
exports.archiveMessage = archiveMessage;
const path_1 = __importDefault(require("path"));
const mailbox_1 = require("../engine/mailbox");
const config_1 = require("../config");
const controlStore_1 = require("../engine/controlStore");
class InboxArchiveError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'InboxArchiveError';
    }
}
exports.InboxArchiveError = InboxArchiveError;
function archiveMessageTransactionFiles(projectRoot) {
    return [path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE)];
}
function archiveMessage(input) {
    const { projectRoot, messageId, actorRole } = input;
    const index = (0, mailbox_1.readIndex)(projectRoot);
    const entry = index.messages.find(m => m.id === messageId);
    if (!entry) {
        throw new InboxArchiveError('INVALID_OPERATION', `Message not found: ${messageId}`);
    }
    if (actorRole !== null && entry.to !== actorRole) {
        throw new InboxArchiveError('ROLE_NOT_AUTHORIZED', `Message ${messageId} is addressed to ${entry.to}, not ${actorRole}. A role may only archive its own messages.`);
    }
    (0, mailbox_1.updateMessageStatus)(index, messageId, 'ARCHIVED');
    (0, controlStore_1.controlTestFailpoint)('inbox_archive_after_status');
    (0, mailbox_1.writeIndex)(projectRoot, index);
    (0, controlStore_1.controlTestFailpoint)('inbox_archive_after_write');
    return { id: messageId, status: 'ARCHIVED' };
}
//# sourceMappingURL=inboxArchiveService.js.map