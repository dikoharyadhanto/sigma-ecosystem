import { ChainState } from '../engine/chain';
import { SigmaDocCheckReport } from '../utils/docCheck';
export declare class CloseLockError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function closeDocPath(projectRoot: string, chain: ChainState): string;
/**
 * A CLOSE does not stop new work, but it can only be locked once nothing is
 * left open: every LOCKED PLAN paired with exactly one LOCKED EXEC and nothing
 * in DRAFT or APPROVED. Applies to every lifecycle model; the paired lifecycle
 * also needs its contract evidence to verify. Shared by the CLI, the use case,
 * and the MCP prepare step so they cannot disagree.
 */
export declare function assertCloseLockGate3(projectRoot: string, chain: ChainState): void;
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