import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class ExecLockError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Resolves which DRAFT DEV-EXEC version a lock should target, mirroring the
 * CLI's `resolveTargetVersion()` disambiguation: explicit version wins, then
 * the sole open DRAFT, otherwise an actionable error (none open, or more
 * than one and no version was given).
 */
export declare function resolveExecLockTarget(chain: ChainState, explicitVersion?: string): string;
export interface LockExecDraftResult {
    chainVersion: string;
    version: string;
    docReport: SigmaDocCheckReport;
    gate3Satisfied: boolean;
}
export declare function lockExecDraftTransactionFiles(projectRoot: string): string[];
/**
 * Locks the active chain's DRAFT DEV-EXEC identified by `version` (or the
 * sole open DRAFT when omitted), re-evaluating Gate 3. Throws ExecLockError
 * (INVALID_OPERATION) for every business-rule rejection — ambiguous/missing
 * target, or the doc fails structural/eligibility validation.
 */
export declare function lockExecDraftUseCase(projectRoot: string, version?: string): LockExecDraftResult;
//# sourceMappingURL=execLockService.d.ts.map