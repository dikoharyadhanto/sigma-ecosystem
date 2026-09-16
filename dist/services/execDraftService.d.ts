export declare class ExecDraftError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface CreateExecDraftInput {
    projectRoot: string;
    /** Which LOCKED plan to execute. Required when more than one LOCKED plan
     *  has no open (non-SUPERSEDED) exec yet; optional and auto-resolved when
     *  exactly one such plan exists — mirrors CLI's `--plan`. */
    planVersion?: string;
}
export interface CreateExecDraftResult {
    chainVersion: string;
    version: string;
    relPath: string;
    planVersionRef: string;
}
export declare function createExecDraftTransactionFiles(projectRoot: string, planVersion?: string): string[];
export declare function createExecDraft(input: CreateExecDraftInput): CreateExecDraftResult;
//# sourceMappingURL=execDraftService.d.ts.map