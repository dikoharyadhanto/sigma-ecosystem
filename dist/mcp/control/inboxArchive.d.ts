export interface ArchiveMessageInput {
    projectRoot: string;
    actorRole: string;
    messageId: string;
}
export interface ArchiveMessageResult {
    id: string;
    status: 'ARCHIVED';
}
export declare function archiveMessageTransactionFiles(projectRoot: string): string[];
export declare function archiveMessage(input: ArchiveMessageInput): ArchiveMessageResult;
//# sourceMappingURL=inboxArchive.d.ts.map