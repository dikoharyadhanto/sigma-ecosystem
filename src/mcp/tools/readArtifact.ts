// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 — sigma_read_artifact
//
// The one tool in Batch 1 that returns file contents, so it is the one that
// has to be paranoid. Rules (§9.1):
//
//   - it takes an artifact TYPE and VERSION, never a path;
//   - the path comes from the chain tracker's own `file` field and nowhere
//     else, so the set of readable files is whatever Sigma itself recorded;
//   - the resolved real path must still be inside the bound root, which is
//     what stops a tracker entry pointing at a symlink or `..` from escaping;
//   - oversized files are refused, not truncated, because a truncated
//     governance document read as complete is worse than no read at all.
//
// It is NOT a file reader with a nice name. There is no argument by which a
// caller can name a file that the active chain does not already reference.

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain, listChainVersions, ArtifactVersion } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond, ERROR_CODES } from '../contract';
import { canonicalize } from '../binding';

/** Refuse rather than truncate. Generous for prose, far below any real file. */
export const MAX_ARTIFACT_BYTES = 512 * 1024;

export type ArtifactType = 'intent' | 'roadmap' | 'plan' | 'exec' | 'close';

/**
 * Canonical on-disk layout per artifact type, taken from the CLI writers that
 * create these files (src/commands/{intent,plan,exec,close,roadmap}.ts).
 *
 * Reviewer finding R-01: the first version of this tool treated the tracker's
 * `file` field as the allowlist and only checked that the resolved path stayed
 * inside the project root. A tracker entry rewritten to `.env` therefore read
 * `.env` back — reproduced, returning a live Notion token. "Inside the root" is
 * the wrong boundary for a governance-artifact reader; the right one is "this
 * exact directory, this exact filename, for this exact version".
 *
 * The tracker is now untrusted input: it may only *select* among paths that
 * already match this layout, never introduce one.
 */
const LAYOUT: Readonly<Record<ArtifactType, { dir: string; prefix: string }>> = Object.freeze({
  intent: { dir: 'Sigma/charter', prefix: 'DIR-INTENT' },
  roadmap: { dir: 'Sigma/roadmap', prefix: 'ROADMAP' },
  plan: { dir: 'Sigma/contract', prefix: 'FMN-PLAN' },
  exec: { dir: 'Sigma/evidence', prefix: 'DEV-EXEC' },
  close: { dir: 'Sigma/close', prefix: 'DIR-CLOSE' },
});

/** Version tokens Sigma actually issues: v1, v1.1. Nothing path-shaped. */
const VERSION_RE = /^v\d+(\.\d+)?$/;

export class ArtifactReadError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ArtifactReadError';
  }
}

interface Candidate {
  file: string;
  version: string;
  state: string;
}

/**
 * Every file the active chain references, per artifact type. This is the
 * allowlist — building it from tracker state is the entire security property.
 */
function candidatesFor(data: ReturnType<typeof readActiveChain>['data'], type: ArtifactType): Candidate[] {
  const fromVersions = (versions: ArtifactVersion[]): Candidate[] =>
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
function expectedRelPath(type: ArtifactType, version: string): string {
  if (!VERSION_RE.test(version)) {
    throw new ArtifactReadError(ERROR_CODES.INVALID_OPERATION, 'Artifact version is not a valid Sigma version token.');
  }
  const { dir, prefix } = LAYOUT[type];
  return `${dir}/${prefix}-${version}.md`;
}

/**
 * Checks the tracker's own `file` value against the derived path, then checks
 * that the path still resolves there after symlinks and Windows junctions are
 * followed. The second check is what the original containment test missed: a
 * symlink at the canonical location pointing at `.env` is *inside the root*,
 * so "inside the root" alone would have let it through.
 */
function assertCanonicalLocation(root: string, type: ArtifactType, version: string, trackerFile: string): string {
  const expected = expectedRelPath(type, version);
  const declared = trackerFile.split('\\').join('/');

  if (declared !== expected) {
    throw new ArtifactReadError(
      ERROR_CODES.BOUNDARY_VIOLATION,
      'Tracker entry does not point at the canonical location for this artifact type and version.'
    );
  }

  const abs = path.resolve(root, expected);
  const realRoot = canonicalize(root);
  const realAbs = canonicalize(abs);
  const rel = path.relative(realRoot, realAbs).split(path.sep).join('/');

  if (rel !== expected) {
    throw new ArtifactReadError(
      ERROR_CODES.BOUNDARY_VIOLATION,
      'Artifact path does not resolve to its canonical location.'
    );
  }

  return abs;
}

export function computeReadArtifact(
  root: string | null,
  type: ArtifactType,
  version?: string
): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();

  const { chainVersion, data } = readActiveChain(root);
  const candidates = candidatesFor(data, type);

  if (candidates.length === 0) {
    throw new ArtifactReadError(
      ERROR_CODES.INVALID_OPERATION,
      `No ${type} artifact is registered in the active chain.`
    );
  }

  // No version given → the last entry the tracker recorded for that type.
  const picked = version
    ? candidates.find((c) => c.version === version)
    : candidates[candidates.length - 1];

  if (!picked) {
    throw new ArtifactReadError(
      ERROR_CODES.INVALID_OPERATION,
      `No ${type} artifact with that version is registered in the active chain.`
    );
  }

  const abs = assertCanonicalLocation(root, type, picked.version, picked.file);

  let fd: number;
  try {
    fd = fs.openSync(abs, 'r');
  } catch {
    // The tracker references a file that is not on disk. That is a real
    // governance finding, reported as state rather than as a read failure.
    return {
      active: true,
      active_chain: chainVersion,
      artifact_type: type,
      version: picked.version,
      state: picked.state,
      present: false,
      content: null,
      source: SOURCE_ENGINE,
    };
  }

  // Size and type are read off the open descriptor, and the bytes come from
  // that same descriptor — so the file that was measured is the file that is
  // read, even if the path is swapped underneath. Residual window: between the
  // canonical-location check above and openSync. It is re-checked after the
  // open rather than claimed to be zero.
  let buf: Buffer;
  try {
    const stat = fs.fstatSync(fd);

    if (!stat.isFile()) {
      throw new ArtifactReadError(ERROR_CODES.BOUNDARY_VIOLATION, 'Registered artifact path is not a regular file.');
    }

    if (stat.size > MAX_ARTIFACT_BYTES) {
      throw new ArtifactReadError(
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Artifact exceeds the ${MAX_ARTIFACT_BYTES} byte read limit.`
      );
    }

    assertCanonicalLocation(root, type, picked.version, picked.file);

    buf = Buffer.alloc(stat.size);
    let read = 0;
    while (read < stat.size) {
      const n = fs.readSync(fd, buf, read, stat.size - read, read);
      if (n <= 0) break;
      read += n;
    }
    if (read !== stat.size) {
      throw new ArtifactReadError(ERROR_CODES.INTERNAL_ERROR, 'Artifact could not be read in full.');
    }
  } finally {
    fs.closeSync(fd);
  }

  return {
    active: true,
    active_chain: chainVersion,
    artifact_type: type,
    version: picked.version,
    state: picked.state,
    present: true,
    // The canonical path, not the tracker's spelling of it — they are proven
    // equal by assertCanonicalLocation, and echoing the derived one keeps the
    // payload independent of tracker text. Project-relative, posix, never the
    // host path (§8 rule 5).
    path: expectedRelPath(type, picked.version),
    bytes: buf.length,
    sha256: 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex'),
    content: buf.toString('utf-8'),
    source: SOURCE_ENGINE,
  };
}

export function registerReadArtifactTool(server: McpServer): void {
  server.registerTool(
    'sigma_read_artifact',
    {
      title: 'Read Sigma Governance Artifact',
      description:
        'Read the contents of one governance artifact of the active chain, selected by type and optional version. Read-only. Does NOT accept a filesystem path: the path is resolved solely from the active chain tracker, must stay inside the bound project root, and files above the size limit are refused rather than truncated. Returns { active, active_chain, artifact_type, version, state, present, path, bytes, sha256, content, source }. present:false means the chain references a file that is missing on disk.',
      inputSchema: {
        type: z
          .enum(['intent', 'roadmap', 'plan', 'exec', 'close'])
          .describe('Which governance artifact of the active chain to read.'),
        version: z
          .string()
          .optional()
          .describe('Artifact version, e.g. "v1" or "v1.1". Defaults to the most recent version the tracker records for that type.'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ type, version }: { type: ArtifactType; version?: string }) =>
      respond('sigma_read_artifact', undefined, (root) => computeReadArtifact(root, type, version))
  );
}
