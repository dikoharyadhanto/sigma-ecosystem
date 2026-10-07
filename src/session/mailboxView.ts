import { MessageIndex, readIndex, getUnreadForRole, countUnreadMemos } from '../engine/mailbox';
import { mailboxScope, MailboxScope, validateEntryMembership } from '../engine/mailboxContext';
import { mailboxMigrationDiagnosis } from '../engine/mailboxMigration';
import { MESSAGING_ROLES, SigmaRole } from '../config';

export function buildMailboxView(root: string, role?: SigmaRole) {
  const inbox: Record<string, number> = {}, memo: Record<string, number> = {};
  let index: MessageIndex | null = null;
  let scope: MailboxScope = {};
  try {
    index = readIndex(root);
    scope = mailboxScope(root);
    const diagnosis = mailboxMigrationDiagnosis(root);
    const membershipCache = new Map();
    if (index.mailbox_format === 2) for (const e of index.messages) validateEntryMembership(root, e, membershipCache);
    for (const r of role ? [role] : MESSAGING_ROLES) {
      if (!(MESSAGING_ROLES as readonly string[]).includes(r)) continue;
      const unread = getUnreadForRole(index, r, { excludeMemo: true, scope }).length;
      const memos = countUnreadMemos(index, r, scope);
      if (unread) inbox[r] = unread;
      if (memos) memo[r] = memos;
    }
    return { index, scope, inbox_unread: inbox, memo_unread: memo, mailbox_status: diagnosis.required ? 'migration_required' : 'ready', mailbox_warnings: diagnosis.warnings };
  } catch (err) {
    return { index: null, scope, inbox_unread: inbox, memo_unread: memo, mailbox_status: 'invalid', mailbox_warnings: [`Mailbox counts unavailable: ${(err as Error).message}`] };
  }
}
