// F10 — artifact file names without a role prefix.
//
// New artifacts are written as INTENT-v1.md, PLAN-v1.1.md, EXEC-v1.1.md and
// CLOSE-v1.md. Artifacts created before F10 keep their names (DIR-INTENT-,
// FMN-PLAN-, DEV-EXEC-, DIR-CLOSE-) and are never renamed. This module is the
// only place that knows both forms: creation asks it for the new name, and
// everything that recognizes or validates a name asks it too, so the two
// cannot drift apart.

import fs from 'fs-extra';
import path from 'path';
import { ARTIFACT_LAYOUT, PROJECT_SIGMA_DIR, ArtifactDomainKey } from '../config';

export type ArtifactNameForm = 'current' | 'legacy';

export const ARTIFACT_DOMAINS = Object.keys(ARTIFACT_LAYOUT) as ArtifactDomainKey[];

function forms(domain: ArtifactDomainKey): Array<{ prefix: string; form: ArtifactNameForm }> {
  const { prefix, legacyPrefix } = ARTIFACT_LAYOUT[domain];
  const result: Array<{ prefix: string; form: ArtifactNameForm }> = [{ prefix, form: 'current' }];
  if (legacyPrefix !== prefix) result.push({ prefix: legacyPrefix, form: 'legacy' });
  return result;
}

/** Name for a NEW artifact. The only function that should be used to create one. */
export function artifactFileName(domain: ArtifactDomainKey, version: string): string {
  return `${ARTIFACT_LAYOUT[domain].prefix}-${version}.md`;
}

/** Every accepted name for this version, new form first. */
export function candidateFileNames(domain: ArtifactDomainKey, version: string): string[] {
  return forms(domain).map(f => `${f.prefix}-${version}.md`);
}

export function artifactDirs(domain: ArtifactDomainKey): readonly string[] {
  return ARTIFACT_LAYOUT[domain].dirs;
}

/** A fresh RegExp (never shared, so lastIndex cannot leak) matching a file name in either form. */
export function artifactNameRegex(domain: ArtifactDomainKey): RegExp {
  const alternatives = forms(domain).map(f => f.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`^(?:${alternatives})-(${ARTIFACT_LAYOUT[domain].versionSource})\\.md$`);
}

export function matchArtifactName(
  domain: ArtifactDomainKey,
  filename: string,
): { version: string; form: ArtifactNameForm } | null {
  const match = artifactNameRegex(domain).exec(filename);
  if (!match) return null;
  const current = `${ARTIFACT_LAYOUT[domain].prefix}-${match[1]}.md`;
  return { version: match[1], form: filename === current ? 'current' : 'legacy' };
}

/**
 * Match a project-relative path (`Sigma/<dir>/<name>`, forward slashes) against
 * one domain: directory must be one the domain may occupy, name must be either
 * form. Directory-aware on purpose: `Sigma/revisions/staging/PLAN-v1.1.md` has
 * the same basename as a plan and is not one.
 */
export function matchArtifactRel(
  domain: ArtifactDomainKey,
  rel: string,
): { dir: string; version: string; form: ArtifactNameForm } | null {
  const normalized = rel.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length !== 3 || parts[0] !== PROJECT_SIGMA_DIR) return null;
  const [, dir, filename] = parts;
  if (!artifactDirs(domain).includes(dir)) return null;
  const name = matchArtifactName(domain, filename);
  return name ? { dir, ...name } : null;
}

/** True when `rel` is a legitimate location for exactly this domain and version. */
export function isArtifactRelFor(domain: ArtifactDomainKey, rel: string, version: string): boolean {
  const match = matchArtifactRel(domain, rel);
  return match !== null && match.version === version;
}

/** Which domain (if any) a project-relative path is an artifact file of. */
export function classifyArtifactRel(rel: string): ArtifactDomainKey | null {
  return ARTIFACT_DOMAINS.find(domain => matchArtifactRel(domain, rel) !== null) ?? null;
}

/** Names for this version that already exist in `dir` (either form). */
export function existingArtifactNames(
  projectRoot: string,
  domain: ArtifactDomainKey,
  dir: string,
  version: string,
): string[] {
  return candidateFileNames(domain, version).filter(name =>
    fs.existsSync(path.join(projectRoot, PROJECT_SIGMA_DIR, dir, name)),
  );
}

/**
 * Project-relative path to use when a tracker entry carries no `file`. An
 * existing file in either form wins; otherwise the new name. A registered
 * `entry.file` always takes precedence over this; it only fills the gap.
 */
export function defaultArtifactRel(
  projectRoot: string,
  domain: ArtifactDomainKey,
  dir: string,
  version: string,
): string {
  const [existing] = existingArtifactNames(projectRoot, domain, dir, version);
  return `${PROJECT_SIGMA_DIR}/${dir}/${existing ?? artifactFileName(domain, version)}`;
}

/**
 * Throws when a new artifact would sit beside an existing file for the same
 * version in either form. Creating the new form next to a legacy one (or the
 * reverse) would give one version two files and no way to tell which is real.
 */
export function assertNoArtifactConflict(
  projectRoot: string,
  domain: ArtifactDomainKey,
  dir: string,
  version: string,
): void {
  const existing = existingArtifactNames(projectRoot, domain, dir, version);
  if (existing.length > 0) {
    throw new Error(
      `Artifact ${version} already exists as ${PROJECT_SIGMA_DIR}/${dir}/${existing[0]}; refusing to create a second file for the same version.`,
    );
  }
}

// ── Pending plans ───────────────────────────────────────────────────────────
// `Sigma/pending/PLAN-<id>.md` for new pending plans; `FMN-PLAN-<id>.md` is the
// pre-F10 form and stays valid where a tracker already records it.

const PENDING_PLAN_ID = /^[a-z0-9]+$/;

export function pendingPlanFileName(id: string): string {
  return `${ARTIFACT_LAYOUT.plan.prefix}-${id}.md`;
}

export function pendingPlanRelCandidates(id: string): string[] {
  if (!PENDING_PLAN_ID.test(id)) return [];
  return forms('plan').map(f => `${PROJECT_SIGMA_DIR}/pending/${f.prefix}-${id}.md`);
}

export function pendingPlanRel(id: string): string {
  return `${PROJECT_SIGMA_DIR}/pending/${pendingPlanFileName(id)}`;
}
