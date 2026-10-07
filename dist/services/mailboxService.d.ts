import { MessageEntry } from '../engine/mailbox';
import { MailboxScope } from '../engine/mailboxContext';
import { MessagingRole } from '../config';
export declare function readMailboxEntry(root: string, id: string, memo: boolean): {
    entry: MessageEntry;
    content: string;
    outdated: number;
};
export declare function clearMailbox(root: string, roles: MessagingRole[], keep: number, scope: MailboxScope, memo: boolean, dryRun: boolean): MessageEntry[];
//# sourceMappingURL=mailboxService.d.ts.map