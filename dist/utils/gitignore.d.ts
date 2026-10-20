export declare const GITIGNORE_BLOCK_START = "# >>> sigma-managed >>>";
export declare const GITIGNORE_BLOCK_END = "# <<< sigma-managed <<<";
/** Paths (repo-relative, as `git ls-files` sees them) that Sigma detaches from the index. Never includes the identity file or product code under dev/. */
export declare const SIGMA_GITIGNORE_TARGET_PATHS: readonly ["Sigma", "CLAUDE.md", "GEMINI.md", "AGENTS.md", "DEEPSEEK.md", "REASONIX.md", ".mcp.json", "opencode.json", "opencode.jsonc", "CHANGE-RECORD.md", "dev/.sigma-workspace.json", "dev/CHANGE-RECORD.md"];
/** Rules written inside the managed block, in order. Root-anchored so a same-named file deeper in the tree is never caught. */
export declare const SIGMA_GITIGNORE_RULES: readonly string[];
export declare function renderGitignoreBlock(): string;
export type GitignoreChange = 'created' | 'updated' | 'unchanged' | 'removed' | 'absent';
/**
 * Writes (or refreshes) the managed block. Content outside the markers is kept
 * byte-for-byte. A missing .gitignore is created. Idempotent.
 */
export declare function applyGitignoreBlock(projectRoot: string): GitignoreChange;
/** Removes the managed block and nothing else. A .gitignore left empty by that is kept (never deleted). */
export declare function removeGitignoreBlock(projectRoot: string): GitignoreChange;
export declare function hasGitignoreBlock(projectRoot: string): boolean;
export interface UntrackResult {
    /** False when there is no usable Git working tree; nothing was attempted. */
    gitAvailable: boolean;
    /** Index entries that were detached (count, not paths — Sigma/ can hold thousands). */
    untracked: number;
    /** Paths (from SIGMA_GITIGNORE_TARGET_PATHS) that had at least one tracked entry. */
    paths: string[];
    error?: string;
}
/**
 * Detaches Sigma files from the Git index with `git rm -r --cached`. The files
 * stay on disk. The caller commits the resulting deletion; Sigma never commits.
 *
 * Pathspecs are relative to `projectRoot` (the command's cwd), so a project
 * nested inside a larger repository only ever touches its own files.
 */
export declare function untrackSigmaFilesFromGitIndex(projectRoot: string): UntrackResult;
//# sourceMappingURL=gitignore.d.ts.map