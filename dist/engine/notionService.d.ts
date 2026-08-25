export interface ResolvedNotionConfig {
    enabled: boolean;
    token?: string;
    parent_page_id?: string;
    database_id?: string;
    clean_local: boolean;
}
export declare function getResolvedNotionConfig(projectRoot: string): ResolvedNotionConfig;
export declare function ensureGitignoreNotion(projectRoot: string): {
    added: boolean;
};
export declare function findProjectRootForRemote(startDir: string): string | undefined;
export interface RemoteStateMarker {
    chain_version: string;
    dashboard_url?: string;
}
export declare function clearRemoteStateMarker(projectRoot: string): void;
export declare function purgeSigmaDir(projectRoot: string, marker: RemoteStateMarker): boolean;
export declare function testNotionConnection(token: string): Promise<{
    success: boolean;
    botName?: string;
    workspaceName?: string;
    error?: string;
}>;
export declare function isNotionApiDetectable(): Promise<boolean>;
export declare function markdownToNotionBlocks(markdownText: string): Array<any>;
export declare function syncArtifactToNotion(projectRoot: string, artifactType: string, version: string, contentMarkdown: string, titleOverride?: string): Promise<{
    success: boolean;
    pageUrl?: string;
    error?: string;
}>;
export declare function deleteNotionPageByTitle(projectRoot: string, title: string): Promise<{
    deleted: boolean;
    error?: string;
}>;
export declare function fetchArtifactFromNotion(projectRoot: string, artifactType: string, version: string): Promise<{
    success: boolean;
    contentMarkdown?: string;
    pageUrl?: string;
    error?: string;
}>;
export declare function pushStateToNotion(projectRoot: string, activeChain: string): Promise<{
    success: boolean;
    pageUrl?: string;
    error?: string;
}>;
export declare function pullStateFromNotion(projectRoot: string, activeChain?: string): Promise<{
    success: boolean;
    restoredFiles?: string[];
    error?: string;
}>;
export declare function fetchRemoteProgressFromNotion(projectRoot: string, activeChain?: string): Promise<{
    success: boolean;
    data?: any;
    pageUrl?: string;
    error?: string;
}>;
export declare function syncProjectStateToNotion(projectRoot: string, state: {
    phase: string;
    active_chain: string;
    gates: any;
    projectName?: string;
    projectId?: string;
}): Promise<{
    success: boolean;
    pageUrl?: string;
    error?: string;
}>;
export interface NotionPushResult {
    success: boolean;
    dashboardUrl?: string;
    purged: boolean;
    error?: string;
}
export declare function runNotionPush(projectRoot: string): Promise<NotionPushResult>;
//# sourceMappingURL=notionService.d.ts.map