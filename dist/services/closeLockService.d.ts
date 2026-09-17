import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class CloseLockError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function closeDocPath(projectRoot: string, chain: ChainState): string;
export interface LockCloseResult {
    chainVersion: string;
    version: string;
    docReport: SigmaDocCheckReport;
    roadmapLocked: string | null;
}
export declare function closeLockTransactionFiles(projectRoot: string): string[];
/**
 * Locks the active chain's DRAFT DIR-CLOSE (lifecycle -> CLOSED), auto-
 * locking a still-DRAFT ROADMAP as a side effect. Throws CloseLockError
 * (INVALID_OPERATION) for every business-rule rejection — no active DRAFT
 * close, or the doc fails structural/eligibility validation.
 */
export declare function lockCloseUseCase(projectRoot: string): LockCloseResult;
//# sourceMappingURL=closeLockService.d.ts.map