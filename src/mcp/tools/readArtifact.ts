// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 — sigma_read_artifact
//
// The one tool in Batch 1 that returns file contents, so it is the one that
// has to be paranoid. Rules (§9.1):
//
//   - it takes an artifact TYPE and VERSION, never a path;
//   - the readable paths are DERIVED from the shared ARTIFACT_LAYOUT table for
//     that type and version; the chain tracker may only select among them, and
//     can never introduce one;
//   - the resolved real path must still land on that same entry after symlinks
//     and Windows junctions resolve;
//   - the bytes come from the descriptor that was stat'd, not from a second
//     lookup of the path;
//   - oversized files are refused, not truncated, because a truncated
//     governance document read as complete is worse than no read at all.
//
// It is NOT a file reader with a nice name. There is no argument by which a
// caller can name a file that the active chain does not already reference.
//
// Path derivation AND the open/verify/hash/read routine
// (candidatesFor/assertCanonicalLocation/readCanonicalArtifactFile) now live
// in ../artifactPath.ts — sigma_get_evidence needs the identical boundary and
// read posture over the same plan/exec trackers. A second copy of the path
// table is how it drifted once already (R-10); a second, weaker copy of the
// read routine is how it drifted a second time (R-B2-04: the first version of
// sigma_get_evidence skipped the non-regular-file check and the post-open
// canonical recheck). One routine, two callers.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain, listChainVersions } from '../../engine/chain';
import { SOURCE_ENGINE, noProject } from '../shared';
import { respond, ERROR_CODES } from '../contract';
import {
  ArtifactType,
  MAX_ARTIFACT_BYTES,
  candidatesFor,
  readCanonicalArtifactFile,
} from '../artifactPath';
import { McpQueryError } from '../errors';

export { MAX_ARTIFACT_BYTES, ArtifactType };

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
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `No ${type} artifact is registered in the active chain.`
    );
  }

  // No version given → the last entry the tracker recorded for that type.
  const picked = version
    ? candidates.find((c) => c.version === version)
    : candidates[candidates.length - 1];

  if (!picked) {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `No ${type} artifact with that version is registered in the active chain.`
    );
  }

  const file = readCanonicalArtifactFile(root, type, picked.version, picked.file);

  if (!file.present) {
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
    path: file.path,
    bytes: file.bytes,
    sha256: file.sha256,
    content: file.content,
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
