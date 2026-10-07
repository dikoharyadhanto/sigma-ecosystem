import { ChainState } from './chain';
import type { MessageEntry, MessageIndex } from './mailbox';
export interface MailboxContext {
    intent_version: string | null;
    context: string;
}
export interface MailboxScope {
    intent?: string | null;
    context?: string;
    allIntents?: boolean;
    includeGeneral?: boolean;
}
export interface MailboxSelector {
    intent?: string;
    context?: string;
    allIntents?: boolean;
}
export declare const MIGRATION_REQUIRED = "Mailbox migration required. Run: sigma doctor --migrate-mailbox --dry-run, then sigma doctor --migrate-mailbox";
export declare function activeMailboxIntent(root: string): string | null;
export declare function mailboxScope(root: string, opts?: MailboxSelector): MailboxScope;
export declare function entryContext(entry: MessageEntry): MailboxContext;
export declare function matchesMailboxScope(entry: MessageEntry, scope?: MailboxScope): boolean;
export declare function retentionScope(entry: MessageEntry): MailboxScope;
export declare function assertMailboxPath(root: string, relative: string, mustExist?: boolean): string;
export declare function mailboxDiskFiles(root: string): string[];
export declare function validateMailboxContext(entry: MessageEntry, format?: number): void;
export declare function resolveMailboxReference(root: string, reference: string | undefined): MailboxContext & {
    warning?: string;
};
export declare function validateEntryMembership(root: string, entry: MessageEntry, cache?: Map<string, ChainState>): void;
export declare function assertMailboxMutable(root: string, index: MessageIndex): void;
//# sourceMappingURL=mailboxContext.d.ts.map