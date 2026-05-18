import { SigmaRole, MessageType } from '../config';
export interface MessageEntry {
    id: string;
    from: SigmaRole;
    to: SigmaRole;
    type: MessageType;
    subject: string;
    file: string;
    status: 'UNREAD' | 'READ' | 'ARCHIVED';
    created_at: string;
    attachments: string[];
}
export interface MessageIndex {
    messages: MessageEntry[];
}
export declare function readIndex(projectRoot: string): MessageIndex;
export declare function writeIndex(projectRoot: string, index: MessageIndex): void;
export declare function generateTimestamp(): string;
export declare function formatTimestampForId(iso: string): string;
export declare function generateRandomSuffix(): string;
export declare function generateMessageId(from: SigmaRole, to: SigmaRole, ts: string, suffix: string): string;
export declare function generateFilename(type: MessageType, from: SigmaRole, to: SigmaRole, ts: string, suffix: string): string;
export declare function buildMessageMarkdown(entry: MessageEntry, body: string): string;
export declare function getUnreadForRole(index: MessageIndex, role: SigmaRole): MessageEntry[];
export declare function getMessagesForRole(index: MessageIndex, role: SigmaRole, includeAll?: boolean): MessageEntry[];
export declare function updateMessageStatus(index: MessageIndex, id: string, status: 'READ' | 'ARCHIVED'): MessageEntry;
export declare function resolveInboxDir(projectRoot: string, role: SigmaRole): string;
//# sourceMappingURL=mailbox.d.ts.map