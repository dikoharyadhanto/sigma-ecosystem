export declare class PlanDraftError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface CreatePlanDraftInput {
    projectRoot: string;
    title: string;
    focus: string;
}
export interface CreatePlanDraftResult {
    chainVersion: string;
    version: string;
    relPath: string;
    intentVersionRef: string;
    title: string;
    focus: string;
}
export declare function createPlanDraftTransactionFiles(projectRoot: string): string[];
export declare function createPlanDraft(input: CreatePlanDraftInput): CreatePlanDraftResult;
//# sourceMappingURL=planDraftService.d.ts.map