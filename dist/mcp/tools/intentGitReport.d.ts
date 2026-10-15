import type { IntentGitReport } from '../../engine/intentGit';
export declare function serializeGitReport(report: IntentGitReport, root: string): {
    chain: string;
    file: string | null;
    repo_path: string | null;
    ok: boolean;
    checks: {
        id: string;
        ok: boolean;
        blocking: boolean;
        detail: string;
    }[];
    blockers: string[];
    baseline: import("../../engine/chain").IntentGitBaseline | null;
    revision: number | null;
    certified_sha256: string | null;
    working_sha256: string | null;
    working_sha256_lf: string | null;
};
//# sourceMappingURL=intentGitReport.d.ts.map