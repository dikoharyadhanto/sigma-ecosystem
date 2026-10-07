"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMailboxView = buildMailboxView;
const mailbox_1 = require("../engine/mailbox");
const mailboxContext_1 = require("../engine/mailboxContext");
const mailboxMigration_1 = require("../engine/mailboxMigration");
const config_1 = require("../config");
function buildMailboxView(root, role) {
    const inbox = {}, memo = {};
    let index = null;
    let scope = {};
    try {
        index = (0, mailbox_1.readIndex)(root);
        scope = (0, mailboxContext_1.mailboxScope)(root);
        const diagnosis = (0, mailboxMigration_1.mailboxMigrationDiagnosis)(root);
        const membershipCache = new Map();
        if (index.mailbox_format === 2)
            for (const e of index.messages)
                (0, mailboxContext_1.validateEntryMembership)(root, e, membershipCache);
        for (const r of role ? [role] : config_1.MESSAGING_ROLES) {
            if (!config_1.MESSAGING_ROLES.includes(r))
                continue;
            const unread = (0, mailbox_1.getUnreadForRole)(index, r, { excludeMemo: true, scope }).length;
            const memos = (0, mailbox_1.countUnreadMemos)(index, r, scope);
            if (unread)
                inbox[r] = unread;
            if (memos)
                memo[r] = memos;
        }
        return { index, scope, inbox_unread: inbox, memo_unread: memo, mailbox_status: diagnosis.required ? 'migration_required' : 'ready', mailbox_warnings: diagnosis.warnings };
    }
    catch (err) {
        return { index: null, scope, inbox_unread: inbox, memo_unread: memo, mailbox_status: 'invalid', mailbox_warnings: [`Mailbox counts unavailable: ${err.message}`] };
    }
}
//# sourceMappingURL=mailboxView.js.map