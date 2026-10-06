export declare class IntentHumanizeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface HumanizeIntentInput {
    projectRoot: string;
    /** Chain version to humanize instead of the active one — mirrors CLI's
     *  `--v`. Selects an entirely different chain file, not a version within
     *  the active one. */
    version?: string;
    force?: boolean;
}
export interface HumanizeIntentResult {
    chainVersion: string;
    version: string;
    humanRelPath: string;
    ledgerRelPath: string;
}
export declare function humanizeIntentTransactionFiles(projectRoot: string, version?: string): string[];
export declare function humanizeIntent(input: HumanizeIntentInput): HumanizeIntentResult;
//# sourceMappingURL=intentHumanizeService.d.ts.map