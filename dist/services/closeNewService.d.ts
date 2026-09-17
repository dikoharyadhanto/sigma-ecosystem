import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class CloseNewError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Re-runs every close_new precondition against a live chain, without
 *  writing anything — used by both prepare (freeze the ticket only if this
 *  would currently succeed) and by CLI's own preflight message. */
export declare function assertCloseNewEligible(projectRoot: string, chain: ChainState): void;
export interface CreateCloseDraftResult {
    chainVersion: string;
    version: string;
    relPath: string;
    docReport: SigmaDocCheckReport;
    arcScore: number | null;
    arcScoreBand: string | null;
}
export declare function closeNewTransactionFiles(projectRoot: string): string[];
/**
 * Creates a new DIR-CLOSE draft against the active chain (Gate 3). Throws
 * CloseNewError (GATE_BLOCKED / INVALID_OPERATION) for every business-rule
 * rejection so the caller gets an actionable message.
 */
export declare function createCloseDraftUseCase(projectRoot: string): CreateCloseDraftResult;
//# sourceMappingURL=closeNewService.d.ts.map