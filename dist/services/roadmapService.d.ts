export declare class RoadmapServiceError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface CreateRoadmapDraftInput {
    projectRoot: string;
}
export interface CreateRoadmapDraftResult {
    chainVersion: string;
    version: string;
    relPath: string;
}
export declare function createRoadmapDraftTransactionFiles(projectRoot: string): string[];
export declare function createRoadmapDraft(input: CreateRoadmapDraftInput): CreateRoadmapDraftResult;
export declare function renderActiveRoadmapTransactionFiles(projectRoot: string): string[];
export interface RenderActiveRoadmapResult {
    version: string;
    relPath: string;
}
export declare function renderActiveRoadmap(projectRoot: string): RenderActiveRoadmapResult;
//# sourceMappingURL=roadmapService.d.ts.map