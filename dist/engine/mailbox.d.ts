import { MailboxScope } from './mailboxContext';
import { SigmaRole, MessageType, ActionRequired } from '../config';
export interface MessageEntry {
    id: string;
    from: SigmaRole;
    to: SigmaRole;
    type: MessageType;
    subject: string;
    file: string;
    status: 'UNREAD' | 'READ' | 'ARCHIVED' | 'OUTDATED';
    created_at: string;
    attachments: string[];
    reply_to?: string;
    related_artifact?: string;
    action?: ActionRequired;
    intent_version?: string | null;
    context?: string;
    migration?: {
        original_file: string;
        original_status: string;
        migrated_at: string;
    };
}
export interface MessageIndex {
    mailbox_format?: 2;
    messages: MessageEntry[];
}
export declare const VALID_STATUSES: ReadonlyArray<string>;
export declare function validateMailboxIndexData(data: unknown): MessageIndex;
export declare function readIndex(projectRoot: string): MessageIndex;
export declare function writeIndex(projectRoot: string, index: MessageIndex): void;
export declare function generateTimestamp(): string;
export declare function formatTimestampForId(iso: string): string;
export declare function generateRandomSuffix(): string;
export declare function generateMessageId(from: SigmaRole, to: SigmaRole, ts: string, suffix: string): string;
export declare function generateFilename(type: MessageType, from: SigmaRole, to: SigmaRole, ts: string, suffix: string): string;
export declare function buildMessageMarkdown(entry: MessageEntry, body: string): string;
export declare function getUnreadForRole(index: MessageIndex, role: SigmaRole, opts?: {
    excludeMemo?: boolean;
    scope?: MailboxScope;
}): MessageEntry[];
export type InboxView = 'unread' | 'all' | 'outdated';
export declare function selectInboxMessages(index: MessageIndex, role: SigmaRole, view: InboxView, scope?: MailboxScope): MessageEntry[];
export declare function getUnreadMemosForRole(index: MessageIndex, role: SigmaRole, scope?: MailboxScope): MessageEntry[];
export declare function countUnreadMemos(index: MessageIndex, role: SigmaRole, scope?: MailboxScope): number;
export declare function selectSurplusRead(index: MessageIndex, role: SigmaRole, keep: number, scope?: MailboxScope, memo?: boolean): MessageEntry[];
export declare function updateMessageStatus(index: MessageIndex, id: string, status: 'READ' | 'ARCHIVED' | 'OUTDATED'): MessageEntry;
export declare function resolveInboxDir(projectRoot: string, role: SigmaRole, context?: string, memo?: boolean): string;
export declare function checkMailboxIntegrity(root: string): {
    ok: boolean;
    passes: number;
    warnings: number;
    failures: number;
    findings: {
        missing_files: {
            id: string;
            file: string;
        }[];
        orphan_files: string[];
        missing_attachments: {
            id: string;
            path: string;
        }[];
        duplicate_ids: string[];
        invalid_fields: {
            id: string;
            field: string;
            value: string;
        }[];
    };
};
//# sourceMappingURL=mailbox.d.ts.map