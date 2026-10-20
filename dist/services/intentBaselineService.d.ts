import { IntentGitBaseline, IntentSnapshotBaseline } from '../engine/chain';
export declare class IntentBaselineError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface AdoptBaselineOptions {
    /** Git mode when given. Omitted: snapshot mode — the certified bytes are stored under Sigma/revisions/ and Git is not used. */
    commit?: string;
    /** Director-reviewed fallback when the certified content cannot be recovered from Git (F05 §4.6). */
    importCurrent?: boolean;
}
export interface AdoptBaselineResult {
    mode: 'git' | 'snapshot';
    chainVersion: string;
    /** Git mode only. */
    baseline?: IntentGitBaseline;
    /** Present in snapshot mode. */
    snapshot?: IntentSnapshotBaseline;
    tagCreated: boolean;
    alreadyRecorded: boolean;
}
export declare function adoptIntentBaselineTransactionFiles(projectRoot: string, targetChainVersion?: string): string[];
export declare function adoptIntentBaselineUseCase(projectRoot: string, options: AdoptBaselineOptions, targetChainVersion?: string): AdoptBaselineResult;
//# sourceMappingURL=intentBaselineService.d.ts.map