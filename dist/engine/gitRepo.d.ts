export interface GitResult {
    ok: boolean;
    code: number | null;
    stdout: Buffer;
    stderr: string;
    /** Set when git could not be spawned at all (not installed / not on PATH). */
    spawnError?: string;
}
export declare function runGit(cwd: string, args: string[]): GitResult;
export declare const sha256Hex: (bytes: string | Buffer) => string;
/** Hash of the content with CRLF folded to LF — comparable across `core.autocrlf` settings (F05 R-1). */
export declare function lfSha256(bytes: Buffer): string;
export declare function gitAvailable(cwd: string): {
    ok: boolean;
    version?: string;
    error?: string;
};
export declare function repoToplevel(cwd: string): {
    ok: true;
    root: string;
} | {
    ok: false;
    error: string;
};
/** Path of `absFile` relative to the repository top level, forward-slashed. Throws if outside it. */
export declare function repoRelativePath(repoRoot: string, absFile: string): string;
export declare function isTracked(cwd: string, rel: string): boolean;
/** Resolve a user-supplied ref to a full commit SHA. Ranges, options and path-like specs are rejected. */
export declare function resolveCommit(cwd: string, ref: string): {
    ok: true;
    sha: string;
} | {
    ok: false;
    error: string;
};
export declare function blobAt(cwd: string, commit: string, rel: string): Buffer | null;
export declare function isAncestor(cwd: string, ancestor: string, descendant: string): boolean;
/** `git status --porcelain` for one path; empty string means clean. */
export declare function pathStatus(cwd: string, rel: string): string;
export declare function commitsTouching(cwd: string, afterCommit: string, rel: string): string[];
/** Diff of the commit against the working tree for one path (line-ending conversion follows Git's own filters). */
export declare function diffAgainstWorktree(cwd: string, commit: string, rel: string): {
    stat: string;
    patch: string;
};
export interface TagInfo {
    name: string;
    exists: boolean;
    annotated?: boolean;
    /** Commit the tag peels to. */
    commit?: string;
}
export declare function validTagName(cwd: string, name: string): boolean;
export declare function readTag(cwd: string, name: string): TagInfo;
export declare function listTags(cwd: string, pattern: string): string[];
/** Creates an annotated tag. Never forces; an existing tag makes git fail and that failure is surfaced. */
export declare function createAnnotatedTag(cwd: string, name: string, commit: string, message: string): {
    ok: boolean;
    error?: string;
};
//# sourceMappingURL=gitRepo.d.ts.map