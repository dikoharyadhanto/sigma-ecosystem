import { ChainState } from '../engine/chain';
export declare class PlanSupersedeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function assertValidPlanSupersedeReason(reason: string): void;
export declare function planDocPath(projectRoot: string, chain: ChainState, version: string): string;
export declare function describePlanSupersedeCascadeEffects(chain: ChainState, version: string): string[];
export interface SupersedePlanResult {
    chainVersion: string;
    version: string;
    cascadedExecs: string[];
}
export declare function planSupersedeTransactionFiles(projectRoot: string): string[];
/**
 * Supersedes an FMN-PLAN version (DRAFT or LOCKED) on the active chain,
 * auto-superseding any linked non-final DEV-EXEC. Throws PlanSupersedeError
 * (INVALID_OPERATION) for every business-rule rejection (not found, already
 * SUPERSEDED, malformed reason).
 */
export declare function supersedePlanUseCase(projectRoot: string, version: string, reason: string): SupersedePlanResult;
//# sourceMappingURL=planSupersedeService.d.ts.map