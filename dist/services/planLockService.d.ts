import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class PlanLockError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/**
 * Resolves which DRAFT FMN-PLAN version a lock should target, mirroring the
 * CLI's `resolveTargetVersion()` disambiguation: explicit version wins, then
 * the sole open DRAFT, otherwise an actionable error (none open, or more
 * than one and no version was given).
 */
export declare function resolvePlanLockTarget(chain: ChainState, explicitVersion?: string): string;
export interface LockPlanDraftResult {
    chainVersion: string;
    version: string;
    docReport: SigmaDocCheckReport;
}
export declare function lockPlanDraftTransactionFiles(projectRoot: string): string[];
/**
 * Locks the active chain's DRAFT FMN-PLAN identified by `version` (or the
 * sole open DRAFT when omitted), opening Gate 2. Throws PlanLockError
 * (INVALID_OPERATION) for every business-rule rejection — ambiguous/missing
 * target, or the doc fails structural/eligibility validation.
 */
export declare function lockPlanDraftUseCase(projectRoot: string, version?: string): LockPlanDraftResult;
//# sourceMappingURL=planLockService.d.ts.map