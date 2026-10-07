import { IntentGitBaseline } from '../engine/chain';
export declare class IntentBaselineError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface AdoptBaselineOptions {
    commit: string;
    /** Director-reviewed fallback when the certified content cannot be recovered from Git (F05 §4.6). */
    importCurrent?: boolean;
}
export interface AdoptBaselineResult {
    chainVersion: string;
    baseline: IntentGitBaseline;
    tagCreated: boolean;
    alreadyRecorded: boolean;
}
export declare function adoptIntentBaselineTransactionFiles(projectRoot: string, targetChainVersion?: string): string[];
export declare function adoptIntentBaselineUseCase(projectRoot: string, options: AdoptBaselineOptions, targetChainVersion?: string): AdoptBaselineResult;
//# sourceMappingURL=intentBaselineService.d.ts.map