import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport, ReviewVerdictState, ReviewRiskNote } from '../utils/docCheck';
export declare class CloseNewError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface CloseEligibilityBlocker {
    code: 'GATE_BLOCKED' | 'INVALID_OPERATION';
    message: string;
}
export interface CloseEligibility {
    eligible: boolean;
    /** Ordered reasons `close new` cannot run yet; empty when eligible. */
    blockers: CloseEligibilityBlocker[];
    gate3Satisfied: boolean;
    /** Project-relative path of the PRODUCT REVIEW, or null when it does not exist. */
    reviewFile: string | null;
    review: ReviewVerdictState | null;
}
/** Project-relative path of this chain's PRODUCT REVIEW, or null when no file exists. */
export declare function findProductReviewRel(projectRoot: string, chain: ChainState): string | null;
/**
 * Reports every `close new` precondition against a live chain without writing
 * anything or throwing. Used by `sigma close check`, by prepare (freeze the
 * ticket only if this would currently succeed), and by `close new` itself.
 * Order: Gate 3, then the PRODUCT REVIEW exists, then its verdicts, then an
 * existing CLOSE.
 */
export declare function assessCloseNewEligibility(chain: ChainState, projectRoot: string): CloseEligibility;
/** Throws CloseNewError for the first unmet `close new` precondition. */
export declare function assertCloseNewEligible(chain: ChainState, projectRoot: string): void;
export interface CreateCloseDraftResult {
    chainVersion: string;
    version: string;
    relPath: string;
    docReport: SigmaDocCheckReport;
    /** Parties whose PRODUCT REVIEW verdict is PASS_WITH_RISK, with their listed risks. */
    riskNotes: ReviewRiskNote[];
}
export declare function closeNewTransactionFiles(projectRoot: string): string[];
/**
 * Creates a new DIR-CLOSE draft against the active chain (Gate 3). Throws
 * CloseNewError (GATE_BLOCKED / INVALID_OPERATION) for every business-rule
 * rejection so the caller gets an actionable message.
 */
export declare function createCloseDraftUseCase(projectRoot: string): CreateCloseDraftResult;
//# sourceMappingURL=closeNewService.d.ts.map