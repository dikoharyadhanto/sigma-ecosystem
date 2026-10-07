import { ChainState, IntentGitBaseline } from './chain';
export interface GitCheck {
    id: string;
    ok: boolean;
    /** Non-blocking checks are informational or drift warnings. */
    blocking: boolean;
    detail: string;
}
export interface IntentGitReport {
    chain: string;
    file: string | null;
    repo_path: string | null;
    repo_root: string | null;
    checks: GitCheck[];
    blockers: string[];
    baseline: IntentGitBaseline | null;
    working_sha256: string | null;
    working_sha256_lf: string | null;
    certified_sha256: string | null;
    revision: number | null;
}
export type InspectMode = 'clean' | 'edited';
export declare function intentTagName(chainVersion: string, kind: 'base' | string): string;
export declare function intentAbsPath(root: string, chain: ChainState): string;
/**
 * `clean`  — the INTENT must equal its certified/baseline content and be committed (before ARC starts editing, and before Petition).
 * `edited` — the INTENT is expected to differ from the baseline (preview and commit verification).
 */
export declare function inspectIntentGit(root: string, chainVersion: string, chain: ChainState, mode: InspectMode): IntentGitReport;
export interface AmendmentImpact {
    current_revision: number | null;
    next_revision: number;
    plans_flagged_for_review: string[];
    locked_pairs_unchanged: string[];
    drafts: {
        plan: string[];
        exec: string[];
    };
}
export declare function amendmentImpact(chain: ChainState): AmendmentImpact;
export interface AmendmentPreview {
    report: IntentGitReport;
    impact: AmendmentImpact;
    diff: {
        stat: string;
        patch: string;
    };
    diff_sha256: string;
    next_amendment_id: string;
    next_tag: string;
}
export declare function nextAmendmentIdOf(chain: ChainState): string;
export declare function previewIntentAmendment(root: string, chainVersion: string, chain: ChainState): AmendmentPreview;
export interface VerifiedResultCommit {
    commit: string;
    repo_root: string;
    repo_path: string;
    working_sha256: string;
    working_sha256_lf: string;
}
/** Verifies that `ref` is a commit holding exactly the working-tree INTENT content (F05 §4.5). Throws with every failed condition. */
export declare function verifyResultCommit(root: string, chainVersion: string, chain: ChainState, ref: string, expectedSha256?: string): VerifiedResultCommit;
export interface LocatedIntent {
    repoRoot: string;
    rel: string;
    abs: string;
    bytes: Buffer;
}
/** Shared by `baseline adopt`: finds the INTENT file in the Git working tree or throws with the reason. */
export declare function locateIntentInRepo(root: string, chain: ChainState): LocatedIntent;
/**
 * Creates the annotated tag, or adopts an existing one that already points to the same commit.
 * A tag on any other commit is never moved or overwritten (F05 §2 item 6).
 */
export declare function ensureAnnotatedTag(root: string, name: string, commit: string, message: string): {
    created: boolean;
};
/** Read-only drift summary of recorded Git references (doctor/status). Never writes. */
export declare function intentGitDrift(root: string, chainVersion: string, chain: ChainState): string[];
//# sourceMappingURL=intentGit.d.ts.map