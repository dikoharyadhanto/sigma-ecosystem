export declare function ensureDir(dir: string): void;
export declare function copyFile(src: string, dest: string): void;
export declare function copyDir(src: string, dest: string): void;
export declare function fileExists(filePath: string): boolean;
export declare function atomicReplaceFileSync(tmpPath: string, destPath: string): void;
export declare function toPosix(p: string): string;
export declare function findProjectRoot(startDir?: string): string;
export type ProjectRegistrationState = 'REGISTERED_COMPLETE' | 'IDENTITY_ONLY_MISSING_SIGMA' | 'UNREGISTERED';
export interface ProjectRegistrationInspection {
    state: ProjectRegistrationState;
    /** Directory that holds the identity (or the whole project); null when UNREGISTERED. */
    root: string | null;
    projectId: string | null;
    projectName: string | null;
    /** Name recorded by `sigma config set origin-machine` / `project start`; null when never recorded. */
    originMachine: string | null;
}
/**
 * Walks up from `startDir` (or inspects only `startDir` when `exact`).
 *
 * IDENTITY_ONLY_MISSING_SIGMA means: a registered identity file and *no* `Sigma/`
 * directory beside it. A `Sigma/` folder that exists but lacks
 * activate_status.json is a damaged project, not a foreign machine, and is
 * deliberately left to the existing repair paths (`sigma doctor`).
 */
export declare function inspectProjectRegistrationState(startDir?: string, options?: {
    exact?: boolean;
}): ProjectRegistrationInspection;
export declare function missingSigmaFilesMessage(projectId: string, projectName: string, originMachine?: string | null, currentMachine?: string): string;
export declare class MissingSigmaFilesError extends Error {
    readonly projectId: string;
    readonly projectName: string;
    readonly originMachine: string | null;
    constructor(projectId: string, projectName: string, originMachine?: string | null);
}
/** Throws MissingSigmaFilesError when only the identity file is present. Any other state passes. */
export declare function assertSigmaFilesPresentOrThrow(startDir?: string, options?: {
    exact?: boolean;
}): void;
//# sourceMappingURL=fs.d.ts.map