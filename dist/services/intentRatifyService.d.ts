import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class IntentRatifyError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface RatifyIntentDraftResult {
    chainVersion: string;
    version: string;
    docReport: SigmaDocCheckReport;
}
export declare function ratifyIntentDraftTransactionFiles(projectRoot: string): string[];
/**
 * Ratifies the active chain's DRAFT intent. Throws IntentRatifyError
 * (INVALID_OPERATION) for every business-rule rejection — not DRAFT, or the
 * doc fails structural/lock-requirement validation — so the caller (CLI or
 * MCP) gets an actionable message rather than an anonymised internal error.
 * Anything assertChainCanMutate() throws for corrupted/invalid chain state is
 * left untyped on purpose — that is not a normal, caller-fixable rejection.
 */
export declare function ratifyIntentDraft(projectRoot: string): RatifyIntentDraftResult;
//# sourceMappingURL=intentRatifyService.d.ts.map