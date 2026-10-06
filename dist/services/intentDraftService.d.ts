export declare class IntentDraftError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface CreateIntentDraftInput {
    projectRoot: string;
    title: string;
    focus: string;
    /** Caller has already obtained (or does not need) confirmation to open a
     *  new chain while the active one is CLOSED. Defaults to false — silence
     *  never implies consent. */
    allowReopenClosed?: boolean;
}
export interface CreateIntentDraftResult {
    chainVersion: string;
    relPath: string;
    title: string;
    focus: string;
}
export declare function createIntentDraftTransactionFiles(projectRoot: string): string[];
export declare function createIntentDraft(input: CreateIntentDraftInput): CreateIntentDraftResult;
//# sourceMappingURL=intentDraftService.d.ts.map