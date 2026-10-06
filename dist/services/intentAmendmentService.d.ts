import { AmendmentEntry } from '../engine/chain';
export declare class IntentAmendmentError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface RecordIntentAmendmentResult {
    chainVersion: string;
    version: string;
    entry: AmendmentEntry;
    certifiedDocSha256: string | undefined;
}
export declare function intentAmendmentTransactionFiles(projectRoot: string, targetChainVersion?: string): string[];
/**
 * Records a Director-approved Amendment against a RATIFIED DIR-INTENT —
 * the active chain by default, or `targetChainVersion` (mirrors CLI's
 * `--v`). Throws IntentAmendmentError (INVALID_OPERATION) for every
 * business-rule rejection (not RATIFIED, empty/malformed --change) so the
 * caller gets an actionable message. Chain-corruption errors from
 * assertChainCanMutate() are left untyped on purpose, same discipline as
 * ratifyIntentDraft().
 */
export declare function recordIntentAmendmentUseCase(projectRoot: string, change: string, targetChainVersion?: string): RecordIntentAmendmentResult;
//# sourceMappingURL=intentAmendmentService.d.ts.map