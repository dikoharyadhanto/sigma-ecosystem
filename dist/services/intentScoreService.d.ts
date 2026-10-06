export declare class IntentScoreError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface RecordArcScoreResult {
    chainVersion: string;
    version: string;
    score: number;
    notes: string;
}
export declare function intentScoreTransactionFiles(projectRoot: string, targetChainVersion?: string): string[];
/**
 * Records an ARC Satisfaction Score against a RATIFIED DIR-INTENT — the
 * active chain by default, or `targetChainVersion` (mirrors CLI's `--v`).
 * Throws IntentScoreError (INVALID_OPERATION) for every business-rule
 * rejection (not RATIFIED, score out of range, notes containing `|`/newline)
 * so the caller gets an actionable message.
 */
export declare function recordArcScoreUseCase(projectRoot: string, score: number, notes: string, targetChainVersion?: string): RecordArcScoreResult;
//# sourceMappingURL=intentScoreService.d.ts.map