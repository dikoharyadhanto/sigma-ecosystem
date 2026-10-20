import { GitignoreChange, UntrackResult } from '../utils/gitignore';
export interface GitignoreApplyReport {
    enabled: boolean;
    block: GitignoreChange;
    untrack: UntrackResult | null;
    lines: string[];
    warnings: string[];
}
/** Records the switch in project.config.json and .sigma-identity.json (read-merge-write; other fields survive). */
export declare function persistGitignoreSetting(projectRoot: string, enabled: boolean): void;
/** ON: write the managed block, then detach already-tracked Sigma files from the index (disk untouched). */
export declare function enableSigmaGitignore(projectRoot: string): GitignoreApplyReport;
/** OFF: remove the managed block only. Nothing is staged or untracked; Sigma files become committable again. */
export declare function disableSigmaGitignore(projectRoot: string): GitignoreApplyReport;
/** Applies whatever project.config.json currently says. */
export declare function applyGitignorePolicy(projectRoot: string): GitignoreApplyReport;
export declare function isGitignoreBlockApplied(projectRoot: string): boolean;
//# sourceMappingURL=gitignoreService.d.ts.map