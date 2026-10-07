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
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCheckMailboxIntegrity = computeCheckMailboxIntegrity;
exports.registerCheckMailboxIntegrityTool = registerCheckMailboxIntegrityTool;
const mailbox_1 = require("../../engine/mailbox");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeCheckMailboxIntegrity(root) {
    if (!root)
        return (0, shared_1.noProject)();
    return { ...(0, mailbox_1.checkMailboxIntegrity)(root), source: shared_1.SOURCE_ENGINE };
}
function registerCheckMailboxIntegrityTool(server) {
    server.registerTool('sigma_check_mailbox_integrity', {
        title: 'Check mailbox index integrity',
        description: 'Validate Sigma/messages/index.json against disk — the query-plane equivalent of `sigma inbox check`: ' +
            'missing message/memo files, orphan .md files in role/context folders, missing attachments, duplicate IDs, and ' +
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