"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMailboxEntry = readMailboxEntry;
exports.clearMailbox = clearMailbox;
const fs_extra_1 = __importDefault(require("fs-extra"));
const mailbox_1 = require("../engine/mailbox");
const mailboxContext_1 = require("../engine/mailboxContext");
const projectConfig_1 = require("../engine/projectConfig");
function readMailboxEntry(root, id, memo) {
    const index = (0, mailbox_1.readIndex)(root);
    (0, mailboxContext_1.assertMailboxMutable)(root, index);
    const entry = index.messages.find(m => m.id === id);
    if (!entry)
        throw new Error(`${memo ? 'Memo' : 'Message'} not found: ${id}`);
    if ((entry.type === 'MEMO') !== memo)
        throw new Error(`${id} is not a ${memo ? 'memo' : 'cross-role message'}. Use: sigma ${memo ? 'inbox' : 'memo'} read ${id}`);
    const content = fs_extra_1.default.readFileSync((0, mailboxContext_1.assertMailboxPath)(root, entry.file, true), 'utf8');
    let dirty = false;
    if (entry.status === 'UNREAD') {
        (0, mailbox_1.updateMessageStatus)(index, id, 'READ');
        dirty = true;
    }
    const keep = (0, projectConfig_1.resolveAutoOutdateKeep)((0, projectConfig_1.readProjectConfig)(root));
    const surplus = keep > 0 ? (0, mailbox_1.selectSurplusRead)(index, entry.to, keep, (0, mailboxContext_1.retentionScope)(entry), memo).filter(m => m.id !== id) : [];
    for (const m of surplus)
        (0, mailbox_1.updateMessageStatus)(index, m.id, 'OUTDATED');
    if (dirty || surplus.length)
        (0, mailbox_1.writeIndex)(root, index);
    return { entry, content, outdated: surplus.length };
}
function clearMailbox(root, roles, keep, scope, memo, dryRun) {
    const index = (0, mailbox_1.readIndex)(root);
    if (!dryRun)
        (0, mailboxContext_1.assertMailboxMutable)(root, index);
    const groups = new Map();
    for (const e of index.messages) {
        if (!roles.includes(e.to) || (e.type === 'MEMO') !== memo || !(0, mailboxContext_1.matchesMailboxScope)(e, scope))
            continue;
        const c = (0, mailboxContext_1.entryContext)(e);
        groups.set(`${e.to}:${c.intent_version ?? c.context}`, { role: e.to, scope: (0, mailboxContext_1.retentionScope)(e) });
    }
    const surplus = [];
    const selected = { ...index, messages: index.messages.filter(e => (0, mailboxContext_1.matchesMailboxScope)(e, scope)) };
    for (const group of groups.values())
        surplus.push(...(0, mailbox_1.selectSurplusRead)(selected, group.role, keep, group.scope, memo));
    if (!dryRun && surplus.length) {
        for (const e of surplus)
            (0, mailbox_1.updateMessageStatus)(index, e.id, 'OUTDATED');
        (0, mailbox_1.writeIndex)(root, index);
    }
    return surplus;
}
//# sourceMappingURL=mailboxService.js.map