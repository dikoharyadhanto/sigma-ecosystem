import { ChainState, IntentSnapshotBaseline } from './chain';
import type { IntentGitReport } from './intentGit';
export interface SnapshotLedgerEntry {
    /** `BASE` or an amendment id such as `AMD-001`. */
    id: string;
    file: string;
    doc_sha256: string;
    doc_sha256_lf: string;
    revision: number;
    provenance: IntentSnapshotBaseline['provenance'];
    recorded_at: string;
}
export interface SnapshotLedger {
    schema_version: 1;
    chain: string;
    entries: SnapshotLedgerEntry[];
}
export type IntentVerificationMode = 'git' | 'snapshot';
export declare function snapshotDirRel(chainVersion: string): string;
export declare function snapshotLedgerRel(chainVersion: string): string;
export declare function snapshotFileRel(chainVersion: string, id: 'BASE' | string): string;
/** Files an adopt or amendment transaction may create or replace, so the journal can roll them back. */
export declare function intentSnapshotTransactionFiles(root: string, chainVersion: string, id: 'BASE' | string): string[];
/**
 * Which anchor verifies this chain's INTENT:
 *  - a recorded snapshot baseline wins (it is the newer decision);
 *  - otherwise a recorded Git baseline keeps Git mode;
 *  - with neither, Git mode only if the INTENT file is actually tracked by Git,
 *    because that is the only case where a commit can hold it.
 */
export declare function resolveIntentVerificationMode(root: string, chain: ChainState): IntentVerificationMode;
export declare function readSnapshotLedger(root: string, chainVersion: string): SnapshotLedger;
/**
 * Writes `bytes` as the snapshot for `id` and appends it to the ledger. An
 * existing snapshot is adopted only when its bytes are identical (a rerun after
 * an interrupted attempt); a different file is never overwritten.
 */
export declare function writeSnapshot(root: string, chainVersion: string, id: 'BASE' | string, bytes: Buffer, meta: {
    revision: number;
    provenance: IntentSnapshotBaseline['provenance'];
    recorded_at: string;
}): {
    entry: SnapshotLedgerEntry;
    created: boolean;
};
/** The recorded snapshot content, verified against its recorded hash. Null when missing or altered. */
export declare function readBaselineSnapshot(root: string, baseline: IntentSnapshotBaseline): Buffer | null;
/**
 * Looks through every snapshot of a chain for content that is the certified document `hash`
 * (raw, LF-folded or CRLF-expanded form, optional `sha256:` prefix — see matchesCertified).
 */
export declare function findSnapshotByHash(root: string, chainVersion: string, hash: string): Buffer | null;
/**
 * `clean`  — the INTENT must equal its certified/snapshot content (before ARC starts editing).
 * `edited` — the INTENT is expected to differ from the snapshot (preview and commit verification).
 *
 * Returns an IntentGitReport so the CLI and MCP printers need no second shape:
 * `repo_root` stays null and `repo_path` carries the project-relative INTENT path.
 */
export declare function inspectIntentSnapshot(root: string, chainVersion: string, chain: ChainState, mode: 'clean' | 'edited'): IntentGitReport;
/** Unified-style line diff of two documents (CRLF folded). Mechanical evidence only. */
export declare function diffDocuments(before: string, after: string, labelBefore: string, labelAfter: string): {
    stat: string;
    patch: string;
};
//# sourceMappingURL=intentSnapshot.d.ts.map