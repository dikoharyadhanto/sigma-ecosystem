export interface NotionConfig {
    enabled: boolean;
    parent_page_id?: string;
    database_id?: string;
    clean_local?: boolean;
}
export interface NotionHumanizeGateConfig {
    enabled: boolean;
}
export interface MailboxConfig {
    auto_outdate_read_keep: number;
    memo_unread_limit: number;
}
export declare const DEFAULT_MAILBOX: MailboxConfig;
export interface ProjectConfig {
    schema_version: string;
    document_language: string;
    interaction_language: string;
    output_document_language: string;
    notion?: NotionConfig;
    notion_humanize_gate?: NotionHumanizeGateConfig;
    mailbox?: MailboxConfig;
}
export declare function readProjectConfig(projectRoot: string): ProjectConfig;
export declare function writeProjectConfig(projectRoot: string, config: ProjectConfig): void;
export declare function createDefaultProjectConfig(lang?: string): ProjectConfig;
export declare function resolveAutoOutdateKeep(config: ProjectConfig): number;
export declare function resolveMemoLimit(config: ProjectConfig): number;
//# sourceMappingURL=projectConfig.d.ts.map