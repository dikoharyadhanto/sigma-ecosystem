export declare class InboxArchiveError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface ArchiveMessageInput {
    projectRoot: string;
    messageId: string;
    /** null = trusted CLI caller, no ownership check enforced. A role string
     *  = MCP bound-role caller, enforced against the message's `to` field. */
    actorRole: string | null;
}
export interface ArchiveMessageResult {
    id: string;
    status: 'ARCHIVED';
}
export declare function archiveMessageTransactionFiles(projectRoot: string): string[];
export declare function archiveMessage(input: ArchiveMessageInput): ArchiveMessageResult;
//# sourceMappingURL=inboxArchiveService.d.ts.map