import { ArtifactDomainKey } from '../config';
export type ArtifactNameForm = 'current' | 'legacy';
export declare const ARTIFACT_DOMAINS: ArtifactDomainKey[];
/** Name for a NEW artifact. The only function that should be used to create one. */
export declare function artifactFileName(domain: ArtifactDomainKey, version: string): string;
/** Every accepted name for this version, new form first. */
export declare function candidateFileNames(domain: ArtifactDomainKey, version: string): string[];
export declare function artifactDirs(domain: ArtifactDomainKey): readonly string[];
/** A fresh RegExp (never shared, so lastIndex cannot leak) matching a file name in either form. */
export declare function artifactNameRegex(domain: ArtifactDomainKey): RegExp;
export declare function matchArtifactName(domain: ArtifactDomainKey, filename: string): {
    version: string;
    form: ArtifactNameForm;
} | null;
/**
 * Match a project-relative path (`Sigma/<dir>/<name>`, forward slashes) against
 * one domain: directory must be one the domain may occupy, name must be either
 * form. Directory-aware on purpose: `Sigma/revisions/staging/PLAN-v1.1.md` has
 * the same basename as a plan and is not one.
 */
export declare function matchArtifactRel(domain: ArtifactDomainKey, rel: string): {
    dir: string;
    version: string;
    form: ArtifactNameForm;
} | null;
/** True when `rel` is a legitimate location for exactly this domain and version. */
export declare function isArtifactRelFor(domain: ArtifactDomainKey, rel: string, version: string): boolean;
/** Which domain (if any) a project-relative path is an artifact file of. */
export declare function classifyArtifactRel(rel: string): ArtifactDomainKey | null;
/** Names for this version that already exist in `dir` (either form). */
export declare function existingArtifactNames(projectRoot: string, domain: ArtifactDomainKey, dir: string, version: string): string[];
/**
 * Project-relative path to use when a tracker entry carries no `file`. An
 * existing file in either form wins; otherwise the new name. A registered
 * `entry.file` always takes precedence over this; it only fills the gap.
 */
export declare function defaultArtifactRel(projectRoot: string, domain: ArtifactDomainKey, dir: string, version: string): string;
/**
 * Throws when a new artifact would sit beside an existing file for the same
 * version in either form. Creating the new form next to a legacy one (or the
 * reverse) would give one version two files and no way to tell which is real.
 */
export declare function assertNoArtifactConflict(projectRoot: string, domain: ArtifactDomainKey, dir: string, version: string): void;
export declare function pendingPlanFileName(id: string): string;
export declare function pendingPlanRelCandidates(id: string): string[];
export declare function pendingPlanRel(id: string): string;
//# sourceMappingURL=artifactNames.d.ts.map