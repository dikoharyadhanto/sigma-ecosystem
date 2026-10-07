import { MessageIndex } from '../engine/mailbox';
import { MailboxScope } from '../engine/mailboxContext';
import { SigmaRole } from '../config';
export declare function buildMailboxView(root: string, role?: SigmaRole): {
    index: MessageIndex;
    scope: MailboxScope;
    inbox_unread: Record<string, number>;
    memo_unread: Record<string, number>;
    mailbox_status: string;
    mailbox_warnings: string[];
} | {
    index: null;
    scope: MailboxScope;
    inbox_unread: Record<string, number>;
    memo_unread: Record<string, number>;
    mailbox_status: string;
    mailbox_warnings: string[];
};
//# sourceMappingURL=mailboxView.d.ts.map