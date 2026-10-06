"use strict";
// Stage B2 — sigma_check_mailbox_integrity. Query-plane equivalent of
// `sigma inbox check`.
//
// Despite the "*_check" name, structurally NOT the same family as
// sigma_check_document (SigmaDocCheckReport): this validates the mailbox
// index against disk (missing files, orphan files, missing attachments,
// duplicate IDs, invalid role/type/status fields), a symmetric report
// available to every role — no --role concept, no per-message content, no
// existence-oracle risk across roles the way sigma_write_memo/sigma_send_
// message's withdrawn siblings had (R-B2-01/02, capability matrix §3.6).
// It reports structural counts and ids/paths, never subject lines or
// message bodies.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCheckMailboxIntegrity = computeCheckMailboxIntegrity;
exports.registerCheckMailboxIntegrityTool = registerCheckMailboxIntegrityTool;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../../config");
const mailbox_1 = require("../../engine/mailbox");
const fs_1 = require("../../utils/fs");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeCheckMailboxIntegrity(root) {
    if (!root)
        return (0, shared_1.noProject)();
    const index = (0, mailbox_1.readIndex)(root);
    const messagesDir = path_1.default.join(root, 'Sigma', 'messages');
    const missingFiles = [];
    const orphanFiles = [];
    const missingAttachments = [];
    const duplicateIds = [];
    const invalidFields = [];
    let passes = 0;
    for (const entry of index.messages) {
        if (fs_extra_1.default.existsSync(path_1.default.join(root, entry.file))) {
            passes++;
        }
        else {
            missingFiles.push({ id: entry.id, file: entry.file });
        }
    }
    const indexedFiles = new Set(index.messages.map((m) => m.file));
    for (const role of config_1.MESSAGING_ROLES) {
        const roleDir = path_1.default.join(messagesDir, role);
        if (!fs_extra_1.default.existsSync(roleDir))
            continue;
        const files = fs_extra_1.default.readdirSync(roleDir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
            const relPath = (0, fs_1.toPosix)(path_1.default.join('Sigma', 'messages', role, file));
            if (indexedFiles.has(relPath)) {
                passes++;
            }
            else {
                orphanFiles.push(relPath);
            }
        }
    }
    for (const entry of index.messages) {
        for (const att of entry.attachments) {
            if (fs_extra_1.default.existsSync(path_1.default.join(root, att))) {
                passes++;
            }
            else {
                missingAttachments.push({ id: entry.id, path: att });
            }
        }
    }
    const seenIds = new Set();
    for (const entry of index.messages) {
        if (seenIds.has(entry.id))
            duplicateIds.push(entry.id);
        seenIds.add(entry.id);
        if (!config_1.VALID_ROLES.includes(entry.from))
            invalidFields.push({ id: entry.id, field: 'from', value: entry.from });
        if (!config_1.VALID_ROLES.includes(entry.to))
            invalidFields.push({ id: entry.id, field: 'to', value: entry.to });
        if (!mailbox_1.VALID_STATUSES.includes(entry.status))
            invalidFields.push({ id: entry.id, field: 'status', value: entry.status });
        if (!config_1.VALID_MESSAGE_TYPES.includes(entry.type))
            invalidFields.push({ id: entry.id, field: 'type', value: entry.type });
    }
    const failures = missingFiles.length + missingAttachments.length + duplicateIds.length + invalidFields.length;
    const warnings = orphanFiles.length;
    return {
        ok: failures === 0,
        passes,
        warnings,
        failures,
        findings: { missing_files: missingFiles, orphan_files: orphanFiles, missing_attachments: missingAttachments, duplicate_ids: duplicateIds, invalid_fields: invalidFields },
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerCheckMailboxIntegrityTool(server) {
    server.registerTool('sigma_check_mailbox_integrity', {
        title: 'Check mailbox index integrity',
        description: 'Validate Sigma/messages/index.json against disk — the query-plane equivalent of `sigma inbox check`: ' +
            'missing message files, orphan .md files not in the index, missing attachments, duplicate IDs, and ' +
            'invalid role/type/status field values. Applies to the whole mailbox, not one role\'s inbox — never ' +
            'returns subject lines or message content. Read-only. Returns { ok, passes, warnings, failures, ' +
            'findings: { missing_files, orphan_files, missing_attachments, duplicate_ids, invalid_fields }, source }.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, contract_1.respond)('sigma_check_mailbox_integrity', undefined, (root) => computeCheckMailboxIntegrity(root)));
}
//# sourceMappingURL=checkMailboxIntegrity.js.map