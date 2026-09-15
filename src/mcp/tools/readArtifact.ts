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

/** Real path must remain inside the bound root — junctions and `..` included. */
function assertInsideRoot(root: string, abs: string): void {
  const realRoot = canonicalize(root);
  const realAbs = canonicalize(abs);
  const rel = path.relative(realRoot, realAbs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new ArtifactReadError(ERROR_CODES.BOUNDARY_VIOLATION, 'Artifact path resolves outside the bound project root.');
  }
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

  const abs = path.resolve(root, picked.file);
  assertInsideRoot(root, abs);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
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

  if (!stat.isFile()) {
    throw new ArtifactReadError(ERROR_CODES.BOUNDARY_VIOLATION, 'Registered artifact path is not a regular file.');
  }

  if (stat.size > MAX_ARTIFACT_BYTES) {
    throw new ArtifactReadError(
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      `Artifact exceeds the ${MAX_ARTIFACT_BYTES} byte read limit.`
    );
  }

  const buf = fs.readFileSync(abs);

  return {
    active: true,
    active_chain: chainVersion,
    artifact_type: type,
    version: picked.version,
    state: picked.state,
    present: true,
    // Project-relative, posix — never the host path (§8 rule 5).
    path: picked.file.split(path.sep).join('/'),
    bytes: stat.size,
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
    },
    async ({ type, version }: { type: ArtifactType; version?: string }) =>
      respond('sigma_read_artifact', undefined, (root) => computeReadArtifact(root, type, version))
  );
}
