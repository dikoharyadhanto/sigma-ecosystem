// Stage C — the write half of artifactPath.ts's canonical-location boundary.
// Deliberately lives under src/mcp/control/, not src/mcp/artifactPath.ts:
// that file is imported by every query tool (readArtifact, evidence), and a
// writer sitting in a shared module those tools import is exactly the kind
// of reachable-but-unused capability the read-only guard
// (test/mcp-tools.test.ts, "no query-plane file imports a state-mutating
// function") exists to make impossible to add by accident. Putting the write
// function here means the guard's directory split (src/mcp/control/ excluded)
// is what keeps it out of the query plane, not code review vigilance alone.
//
// Reuses assertCanonicalLocation() from artifactPath.ts rather than
// re-deriving allowed paths — the whole point of R-10 (Batch 1) was that a
// second copy of the layout table drifts. There must be exactly one function
// that says "this tracker entry may occupy this path", for both read and
// write.

import fs from 'fs-extra';
import crypto from 'crypto';
import { assertCanonicalLocation, MAX_ARTIFACT_BYTES, ArtifactType } from '../artifactPath';
import { ERROR_CODES } from '../contract';
import { McpQueryError } from '../errors';

export interface CanonicalWriteResult {
  abs: string;
  rel: string;
  bytes: number;
  sha256: string;
}

export function writeCanonicalArtifactFile(
  root: string,
  type: ArtifactType,
  version: string,
  trackerFile: string,
  content: string
): CanonicalWriteResult {
  const { abs, rel } = assertCanonicalLocation(root, type, version, trackerFile);

  const buf = Buffer.from(content, 'utf-8');
  if (buf.length > MAX_ARTIFACT_BYTES) {
    throw new McpQueryError(
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      `Content exceeds the ${MAX_ARTIFACT_BYTES} byte write limit.`
    );
  }

  const tmpPath = `${abs}.tmp`;
  fs.writeFileSync(tmpPath, buf);
  fs.moveSync(tmpPath, abs, { overwrite: true });

  return {
    abs,
    rel,
    bytes: buf.length,
    sha256: 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex'),
  };
}
