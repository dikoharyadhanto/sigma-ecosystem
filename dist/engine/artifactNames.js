"use strict";
// F10 — artifact file names without a role prefix.
//
// New artifacts are written as INTENT-v1.md, PLAN-v1.1.md, EXEC-v1.1.md and
// CLOSE-v1.md. Artifacts created before F10 keep their names (DIR-INTENT-,
// FMN-PLAN-, DEV-EXEC-, DIR-CLOSE-) and are never renamed. This module is the
// only place that knows both forms: creation asks it for the new name, and
// everything that recognizes or validates a name asks it too, so the two
// cannot drift apart.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARTIFACT_DOMAINS = void 0;
exports.artifactFileName = artifactFileName;
exports.candidateFileNames = candidateFileNames;
exports.artifactDirs = artifactDirs;
exports.artifactNameRegex = artifactNameRegex;
exports.matchArtifactName = matchArtifactName;
exports.matchArtifactRel = matchArtifactRel;
exports.isArtifactRelFor = isArtifactRelFor;
exports.classifyArtifactRel = classifyArtifactRel;
exports.existingArtifactNames = existingArtifactNames;
exports.defaultArtifactRel = defaultArtifactRel;
exports.assertNoArtifactConflict = assertNoArtifactConflict;
exports.pendingPlanFileName = pendingPlanFileName;
exports.pendingPlanRelCandidates = pendingPlanRelCandidates;
exports.pendingPlanRel = pendingPlanRel;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
exports.ARTIFACT_DOMAINS = Object.keys(config_1.ARTIFACT_LAYOUT);
function forms(domain) {
    const { prefix, legacyPrefix } = config_1.ARTIFACT_LAYOUT[domain];
    const result = [{ prefix, form: 'current' }];
    if (legacyPrefix !== prefix)
        result.push({ prefix: legacyPrefix, form: 'legacy' });
    return result;
}
/** Name for a NEW artifact. The only function that should be used to create one. */
function artifactFileName(domain, version) {
    return `${config_1.ARTIFACT_LAYOUT[domain].prefix}-${version}.md`;
}
/** Every accepted name for this version, new form first. */
function candidateFileNames(domain, version) {
    return forms(domain).map(f => `${f.prefix}-${version}.md`);
}
function artifactDirs(domain) {
    return config_1.ARTIFACT_LAYOUT[domain].dirs;
}
/** A fresh RegExp (never shared, so lastIndex cannot leak) matching a file name in either form. */
function artifactNameRegex(domain) {
    const alternatives = forms(domain).map(f => f.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return new RegExp(`^(?:${alternatives})-(${config_1.ARTIFACT_LAYOUT[domain].versionSource})\\.md$`);
}
function matchArtifactName(domain, filename) {
    const match = artifactNameRegex(domain).exec(filename);
    if (!match)
        return null;
    const current = `${config_1.ARTIFACT_LAYOUT[domain].prefix}-${match[1]}.md`;
    return { version: match[1], form: filename === current ? 'current' : 'legacy' };
}
/**
 * Match a project-relative path (`Sigma/<dir>/<name>`, forward slashes) against
 * one domain: directory must be one the domain may occupy, name must be either
 * form. Directory-aware on purpose: `Sigma/revisions/staging/PLAN-v1.1.md` has
 * the same basename as a plan and is not one.
 */
function matchArtifactRel(domain, rel) {
    const normalized = rel.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.length !== 3 || parts[0] !== config_1.PROJECT_SIGMA_DIR)
        return null;
    const [, dir, filename] = parts;
    if (!artifactDirs(domain).includes(dir))
        return null;
    const name = matchArtifactName(domain, filename);
    return name ? { dir, ...name } : null;
}
/** True when `rel` is a legitimate location for exactly this domain and version. */
function isArtifactRelFor(domain, rel, version) {
    const match = matchArtifactRel(domain, rel);
    return match !== null && match.version === version;
}
/** Which domain (if any) a project-relative path is an artifact file of. */
function classifyArtifactRel(rel) {
    return exports.ARTIFACT_DOMAINS.find(domain => matchArtifactRel(domain, rel) !== null) ?? null;
}
/** Names for this version that already exist in `dir` (either form). */
function existingArtifactNames(projectRoot, domain, dir, version) {
    return candidateFileNames(domain, version).filter(name => fs_extra_1.default.existsSync(path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, dir, name)));
}
/**
 * Project-relative path to use when a tracker entry carries no `file`. An
 * existing file in either form wins; otherwise the new name. A registered
 * `entry.file` always takes precedence over this; it only fills the gap.
 */
function defaultArtifactRel(projectRoot, domain, dir, version) {
    const [existing] = existingArtifactNames(projectRoot, domain, dir, version);
    return `${config_1.PROJECT_SIGMA_DIR}/${dir}/${existing ?? artifactFileName(domain, version)}`;
}
/**
 * Throws when a new artifact would sit beside an existing file for the same
 * version in either form. Creating the new form next to a legacy one (or the
 * reverse) would give one version two files and no way to tell which is real.
 */
function assertNoArtifactConflict(projectRoot, domain, dir, version) {
    const existing = existingArtifactNames(projectRoot, domain, dir, version);
    if (existing.length > 0) {
        throw new Error(`Artifact ${version} already exists as ${config_1.PROJECT_SIGMA_DIR}/${dir}/${existing[0]}; refusing to create a second file for the same version.`);
    }
}
// ── Pending plans ───────────────────────────────────────────────────────────
// `Sigma/pending/PLAN-<id>.md` for new pending plans; `FMN-PLAN-<id>.md` is the
// pre-F10 form and stays valid where a tracker already records it.
const PENDING_PLAN_ID = /^[a-z0-9]+$/;
function pendingPlanFileName(id) {
    return `${config_1.ARTIFACT_LAYOUT.plan.prefix}-${id}.md`;
}
function pendingPlanRelCandidates(id) {
    if (!PENDING_PLAN_ID.test(id))
        return [];
    return forms('plan').map(f => `${config_1.PROJECT_SIGMA_DIR}/pending/${f.prefix}-${id}.md`);
}
function pendingPlanRel(id) {
    return `${config_1.PROJECT_SIGMA_DIR}/pending/${pendingPlanFileName(id)}`;
}
//# sourceMappingURL=artifactNames.js.map