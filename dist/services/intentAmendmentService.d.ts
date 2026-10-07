import { AmendmentEntry } from '../engine/chain';
import { VerifiedResultCommit } from '../engine/intentGit';
export declare class IntentAmendmentError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface AmendmentRequest {
    change: string;
    purposeChanged: boolean;
    /** Explicit commit reference holding the approved content (F05 §4.5). */
    commit: string;
    /** Raw-byte SHA-256 of the INTENT file the Director reviewed (from `amendment preview`). */
    docSha256?: string;
}
export interface VerifiedAmendment {
    chainVersion: string;
    verified: VerifiedResultCommit;
    tag: string;
    tagCreated: boolean;
    diffStat: string;
    amendmentId: string;
}
export interface RecordIntentAmendmentResult {
    chainVersion: string;
    version: string;
    entry: AmendmentEntry;
    certifiedDocSha256: string | undefined;
    tag: string;
    tagCreated: boolean;
    commit: string;
}
export declare function intentAmendmentTransactionFiles(projectRoot: string, targetChainVersion?: string): string[];
export declare function appendIntentLog(projectRoot: string, record: Record<string, unknown>): void;
/**
 * Phase 1 — every Git step. Throws IntentAmendmentError (INVALID_OPERATION) for each
 * business-rule rejection (not RATIFIED, empty/malformed --change, any unfinished Git
 * step) so the caller gets an actionable message. The tag is created last, after all
 * verification; a rerun adopts a tag left by an interrupted attempt (same commit only)
 * and a tag on any other commit is never moved or overwritten.
 */
export declare function verifyAndTagAmendment(projectRoot: string, request: AmendmentRequest, targetChainVersion?: string): VerifiedAmendment;
/** Phase 2 — no Git subprocess: records the entry, certifies the file bytes, writes chain and log. */
export declare function applyVerifiedAmendment(projectRoot: string, request: AmendmentRequest, v: VerifiedAmendment, targetChainVersion?: string): RecordIntentAmendmentResult;
/**
 * Both phases, for the CLI (runs inside withGovernanceTransaction, which has no
 * mutation-time budget). Must run inside the project's governance transaction.
 */
export declare function recordIntentAmendmentUseCase(projectRoot: string, request: AmendmentRequest, targetChainVersion?: string): RecordIntentAmendmentResult;
//# sourceMappingURL=intentAmendmentService.d.ts.map