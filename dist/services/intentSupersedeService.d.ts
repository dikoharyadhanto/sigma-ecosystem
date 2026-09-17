import { ChainState, IntentCascadeTargets } from '../engine/chain';
export declare class IntentSupersedeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function assertValidSupersedeReason(reason: string): void;
export declare function describeSupersedeCascadeEffects(chain: ChainState, cascade: IntentCascadeTargets): string[];
export interface SupersedeIntentResult {
    chainVersion: string;
    version: string;
    cascade: IntentCascadeTargets;
}
export declare function intentSupersedeTransactionFiles(projectRoot: string, targetChainVersion?: string): string[];
/**
 * Supersedes a RATIFIED DIR-INTENT — the active chain by default, or
 * `targetChainVersion` (mirrors CLI's `--v`, human-only; see this file's
 * header for why the MCP tool never passes it). Cascades SUPERSEDED to its
 * ROADMAP/PLAN/EXEC/CLOSE. Throws IntentSupersedeError (INVALID_OPERATION)
 * for every business-rule rejection (not RATIFIED, malformed reason).
 */
export declare function supersedeIntentUseCase(projectRoot: string, reason: string, targetChainVersion?: string): SupersedeIntentResult;
//# sourceMappingURL=intentSupersedeService.d.ts.map