// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 — canonical governance-artifact
// path derivation, shared by every query tool that resolves a tracker-recorded
// file rather than a filesystem path handed in by a caller.
//
// Extracted out of tools/readArtifact.ts so a second tool (evidence) cannot
// duplicate this table and drift from it the way reconstruct.ts's PATTERNS and
// the original artifact reader once did (reviewer finding R-10). There is
// exactly one function that says "this tracker entry may occupy this path",
// and every caller goes through it.

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { ARTIFACT_LAYOUT, PROJECT_SIGMA_DIR } from '../config';
import { ArtifactVersion } from '../engine/chain';
import { canonicalize } from './binding';
import { ERROR_CODES } from './contract';
import { McpQueryError } from './errors';

/** Refuse rather than truncate. Generous for prose, far below any real file. */
export const MAX_ARTIFACT_BYTES = 512 * 1024;

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
export function candidatesFor(
  data: {
    intent: { file?: string; version: string; state: string };
    roadmap: { file?: string; version: string; state: string } | null;
    close: { file?: string; version: string; state: string } | null;
    plan: { versions: ArtifactVersion[] };
    exec: { versions: ArtifactVersion[] };
  },
  type: ArtifactType
): ArtifactCandidate[] {
  const fromVersions = (versions: ArtifactVersion[]): ArtifactCandidate[] =>
    versions
      .filter((v): v is ArtifactVersion & { file: string } => typeof v.file === 'string' && v.file.length > 0)
      .map((v) => ({ file: v.file, version: v.version, state: v.state }));

  switch (type) {
    case 'intent':
      return data.intent?.file
        ? [{ file: data.intent.file, version: data.intent.version, state: data.intent.state }]
        : [];
    case 'roadmap':
      return data.roadmap?.file
        ? [{ file: data.roadmap.file, version: data.roadmap.version, state: data.roadmap.state }]
        : [];
    case 'close':
      return data.close?.file
        ? [{ file: data.close.file, version: data.close.version, state: data.close.state }]
        : [];
    case 'plan':
      return fromVersions(data.plan?.versions ?? []);
    case 'exec':
      return fromVersions(data.exec?.versions ?? []);
  }
}

/**
 * The path a given artifact type+version is *allowed* to occupy. Derived, not
 * read from the tracker — so a rewritten tracker cannot widen it.
 */
export function allowedRelPaths(type: ArtifactType, version: string): string[] {
  const { dirs, prefix, versionSource } = ARTIFACT_LAYOUT[type];

  // Per-type version shape, matching the engine: v1 for intent/roadmap/close,
  // v1.1 for plan/exec. Anything path-shaped fails here, before it can be
  // pasted into a filename.
  if (!new RegExp(`^${versionSource}$`).test(version)) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Artifact version is not a valid Sigma version token.');
  }

  // New folder name first, pre-rename name second — both are legitimate
  // locations for the same artifact, and which one a project uses depends only
  // on when it was created.
  return dirs.map((dir) => `${PROJECT_SIGMA_DIR}/${dir}/${prefix}-${version}.md`);
}

/**
 * Checks the tracker's own `file` value against the derived path, then checks
 * that the path still resolves there after symlinks and Windows junctions are
 * followed. The second check is what the original containment test missed: a
 * symlink at the canonical location pointing at `.env` is *inside the root*,
 * so "inside the root" alone would have let it through.
 */
export function assertCanonicalLocation(
  root: string,
  type: ArtifactType,
  version: string,
  trackerFile: string
): { abs: string; rel: string } {
  const allowed = allowedRelPaths(type, version);
  const declared = trackerFile.split('\\').join('/');

  // The tracker may only *select* among the allowed locations. It can never
  // introduce one — that is what turned this tool into a file reader before.
  if (!allowed.includes(declared)) {
    throw new McpQueryError(
      ERROR_CODES.BOUNDARY_VIOLATION,
      'Tracker entry does not point at a canonical location for this artifact type and version.'
    );
  }

  const abs = path.resolve(root, declared);
  const realRoot = canonicalize(root);
  const realAbs = canonicalize(abs);
  const rel = path.relative(realRoot, realAbs).split(path.sep).join('/');

  // Must still land on the *same* entry after symlinks and junctions resolve.
  // A symlink sitting at a perfectly canonical path is inside the root and
  // still not the artifact it claims to be.
  if (rel !== declared) {
    throw new McpQueryError(
      ERROR_CODES.BOUNDARY_VIOLATION,
      'Artifact path does not resolve to its canonical location.'
    );
  }

  return { abs, rel };
}

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
/**
 * Shared read body for both readCanonicalArtifactFile() and
 * readCanonicalPendingPlanFile(): open, verify regular-file + size, re-check
 * the canonical location after open (TOCTOU), read fully, hash. `recheck` is
 * the type-specific location assertion, re-run post-open — the only part
 * that differs between a versioned tracker artifact and a pending plan.
 */
function readAtCanonicalLocation(abs: string, rel: string, recheck: () => void): ArtifactFileResult {
  let fd: number;
  try {
    fd = fs.openSync(abs, 'r');
  } catch {
    // The tracker references a file that is not on disk. That is a real
    // governance finding, reported as state rather than as a read failure.
    return { present: false, path: rel, bytes: null, sha256: null, content: null };
  }

  try {
    const stat = fs.fstatSync(fd);

    if (!stat.isFile()) {
      throw new McpQueryError(ERROR_CODES.BOUNDARY_VIOLATION, 'Registered artifact path is not a regular file.');
    }

    if (stat.size > MAX_ARTIFACT_BYTES) {
      throw new McpQueryError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Artifact exceeds the ${MAX_ARTIFACT_BYTES} byte read limit.`
      );
    }

    // Re-checked after open — residual TOCTOU window between the pre-open
    // check and openSync, not claimed to be zero, only re-verified.
    recheck();

    const buf = Buffer.alloc(stat.size);
    let read = 0;
    while (read < stat.size) {
      const n = fs.readSync(fd, buf, read, stat.size - read, read);
      if (n <= 0) break;
      read += n;
    }
    if (read !== stat.size) {
      throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Artifact could not be read in full.');
    }

    return {
      present: true,
      path: rel,
      bytes: buf.length,
      sha256: 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex'),
      content: buf.toString('utf-8'),
    };
  } finally {
    fs.closeSync(fd);
  }
}

export function readCanonicalArtifactFile(
  root: string,
  type: ArtifactType,
  version: string,
  trackerFile: string
): ArtifactFileResult {
  const { abs, rel } = assertCanonicalLocation(root, type, version, trackerFile);
  return readAtCanonicalLocation(abs, rel, () => assertCanonicalLocation(root, type, version, trackerFile));
}

/**
 * A pending plan (`sigma plan new --pending`) is not a versioned tracker
 * artifact — it has no ArtifactType/version, only an `id` and a fixed
 * location (`Sigma/pending/FMN-PLAN-<id>.md`, written exclusively by
 * registerPendingPlan()). Used by plan_promote to freeze/verify its content
 * hash with the same boundary posture as readCanonicalArtifactFile(), one
 * fixed path instead of a multi-directory allowlist.
 */
export function assertCanonicalPendingPlanLocation(root: string, id: string, trackerFile: string): { abs: string; rel: string } {
  if (!/^[a-z0-9]+$/.test(id)) {
    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Pending plan id is not a valid token.');
  }
  const expected = `${PROJECT_SIGMA_DIR}/pending/FMN-PLAN-${id}.md`;
  const declared = trackerFile.split('\\').join('/');
  if (declared !== expected) {
    throw new McpQueryError(ERROR_CODES.BOUNDARY_VIOLATION, 'Tracker entry does not point at the canonical location for this pending plan id.');
  }

  const abs = path.resolve(root, declared);
  const realRoot = canonicalize(root);
  const realAbs = canonicalize(abs);
  const rel = path.relative(realRoot, realAbs).split(path.sep).join('/');

  if (rel !== declared) {
    throw new McpQueryError(ERROR_CODES.BOUNDARY_VIOLATION, 'Pending plan path does not resolve to its canonical location.');
  }

  return { abs, rel };
}

export function readCanonicalPendingPlanFile(root: string, id: string, trackerFile: string): ArtifactFileResult {
  const { abs, rel } = assertCanonicalPendingPlanLocation(root, id, trackerFile);
  return readAtCanonicalLocation(abs, rel, () => assertCanonicalPendingPlanLocation(root, id, trackerFile));
}
