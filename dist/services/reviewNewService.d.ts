import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class ReviewNewError extends Error {
    readonly code: 'GATE_BLOCKED' | 'INVALID_OPERATION';
    constructor(code: 'GATE_BLOCKED' | 'INVALID_OPERATION', message: string);
}
export interface ReviewNewTarget {
    chain: ChainState;
    chainVersion: string;
    /** Project-relative posix path the review will be written to. */
    relPath: string;
}
/** Every `review new` precondition, checked without writing. Throws ReviewNewError for a refusal. */
export declare function resolveReviewNewTarget(projectRoot: string): ReviewNewTarget;
/** The single file a `review new` may create, absolute, for a control transaction. */
export declare function reviewNewTransactionFiles(projectRoot: string): string[];
export interface CreateReviewResult {
    chainVersion: string;
    relPath: string;
    docReport: SigmaDocCheckReport;
}
export declare function createReviewDraft(projectRoot: string): CreateReviewResult;
//# sourceMappingURL=reviewNewService.d.ts.map