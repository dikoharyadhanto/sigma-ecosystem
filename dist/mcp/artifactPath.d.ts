import { ArtifactVersion } from '../engine/chain';
/** Refuse rather than truncate. Generous for prose, far below any real file. */
export declare const MAX_ARTIFACT_BYTES: number;
export type ArtifactType = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';
export interface ArtifactCandidate {
    file: string;
    version: string;
    state: string;
}
/**
 * Every file the active chain references, per artifact type. This is the
 * allowlist — building it from tracker state is the entire security property.
 */
export declare function candidatesFor(data: {
    intent: {
        file?: string;
        version: string;
        state: string;
    };
    roadmap: {
        file?: string;
        version: string;
        state: string;
    } | null;
    close: {
        file?: string;
        version: string;
        state: string;
    } | null;
    plan: {
        versions: ArtifactVersion[];
    };
    exec: {
        versions: ArtifactVersion[];
    };
}, type: ArtifactType): ArtifactCandidate[];
/**
 * The path a given artifact type+version is *allowed* to occupy. Derived, not
 * read from the tracker — so a rewritten tracker cannot widen it.
 */
export declare function allowedRelPaths(type: ArtifactType, version: string): string[];
/**
 * Checks the tracker's own `file` value against the derived path, then checks
 * that the path still resolves there after symlinks and Windows junctions are
 * followed. The second check is what the original containment test missed: a
 * symlink at the canonical location pointing at `.env` is *inside the root*,
 * so "inside the root" alone would have let it through.
 */
export declare function assertCanonicalLocation(root: string, type: ArtifactType, version: string, trackerFile: string): {
    abs: string;
    rel: string;
};
export interface ArtifactFileResult {
    present: boolean;
    /** Canonical relative path — set even when present:false, so a caller can
     *  report where the file was expected. */
    path: string;
    bytes: number | null;
    sha256: string | null;
    content: string | null;
}
export declare function readCanonicalArtifactFile(root: string, type: ArtifactType, version: string, trackerFile: string): ArtifactFileResult;
/**
 * A pending plan (`sigma plan new --pending`) is not a versioned tracker
 * artifact — it has no ArtifactType/version, only an `id` and a fixed
 * location (`Sigma/pending/FMN-PLAN-<id>.md`, written exclusively by
 * registerPendingPlan()). Used by plan_promote to freeze/verify its content
 * hash with the same boundary posture as readCanonicalArtifactFile(), one
 * fixed path instead of a multi-directory allowlist.
 */
export declare function assertCanonicalPendingPlanLocation(root: string, id: string, trackerFile: string): {
    abs: string;
    rel: string;
};
export declare function readCanonicalPendingPlanFile(root: string, id: string, trackerFile: string): ArtifactFileResult;
//# sourceMappingURL=artifactPath.d.ts.map