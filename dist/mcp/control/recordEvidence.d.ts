import { EvidenceRecord } from '../../engine/chain';
/** Refuse rather than hash pathologically large files under the control
 *  lock — respondControlWrite's mutate() must stay synchronous (shared.ts),
 *  so an unbounded read here would block concurrent requests. Generous for
 *  a test report or build log, far below what a lock should ever hold. */
export declare const MAX_EVIDENCE_REF_BYTES: number;
export interface RecordEvidenceInput {
    projectRoot: string;
    execVersion?: string;
    description: string;
    refPath: string;
    actorRole: string;
}
export interface RecordEvidenceResult {
    chainVersion: string;
    execVersion: string;
    record: EvidenceRecord;
    /** Mirrors record.ref_sha256 at the top level — respondControlWrite's
     *  sha256Of() reads .sha256 structurally to populate the audit trail's
     *  artifact_hash_after (shared.ts), the same convention
     *  updateArtifactDraft's result uses. */
    sha256: string;
}
export declare function recordEvidenceTransactionFiles(projectRoot: string): string[];
export declare function recordEvidence(input: RecordEvidenceInput): RecordEvidenceResult;
//# sourceMappingURL=recordEvidence.d.ts.map