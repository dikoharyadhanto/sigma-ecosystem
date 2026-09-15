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
/**
 * Opens, verifies, hashes and reads the one file a tracker entry may occupy
 * for a given type+version — the single place both sigma_read_artifact and
 * sigma_get_evidence go through, so the two cannot drift on what counts as a
 * safe read (reviewer finding R-B2-04: evidence originally re-implemented this
 * with a weaker posture — no BOUNDARY_VIOLATION on a non-regular file, no
 * canonical recheck after open — and R-10 already showed what a second copy
 * of a boundary table does over time).
 *
 * Bytes are read from the descriptor that was stat'd, and the canonical
 * location is re-checked after open, before those bytes are trusted — the
 * file that was measured is the file that is read, even if the path is
 * swapped underneath between the pre-open check and the open itself.
 */
export declare function readCanonicalArtifactFile(root: string, type: ArtifactType, version: string, trackerFile: string): ArtifactFileResult;
//# sourceMappingURL=artifactPath.d.ts.map