// Stage C pilot — sigma_update_artifact_draft's compute function. No CLI
// equivalent exists (a human just edits the file directly), so unlike
// intent draft creation there is nothing to extract a shared service out of;
// this is control-plane-only logic, kept under src/mcp/control/ rather than
// src/services/ so it can depend on the MCP path-safety helpers
// (readCanonicalArtifactFile / writeCanonicalArtifactFile) without pulling
// those into a nominally transport-agnostic services layer.
//
// Scope is pinned to type === 'intent' for the pilot (plan §14 Stage C item
// 4: "satu lifecycle sempit"). The MCP tool schema also pins this with
// z.literal('intent') — this check is defense in depth, not the only gate.

import { readActiveChain } from '../../engine/chain';
import { readCanonicalArtifactFile, MAX_ARTIFACT_BYTES, ArtifactType } from '../artifactPath';
import { writeCanonicalArtifactFile } from './canonicalWrite';
import { ERROR_CODES } from '../contract';
import { McpQueryError } from '../errors';
import { assertCanonicalLocation } from '../artifactPath';

export interface UpdateArtifactDraftInput {
  projectRoot: string;
  type: ArtifactType;
  version: string;
  content: string;
  expectedArtifactSha256: string;
}

export interface UpdateArtifactDraftResult {
  type: ArtifactType;
  version: string;
  path: string;
  bytes: number;
  sha256: string;
}

export function updateArtifactDraftTransactionFiles(input: Pick<UpdateArtifactDraftInput, 'projectRoot' | 'type' | 'version'>): string[] {
  const { data: chain } = readActiveChain(input.projectRoot);
  if (!chain.intent.file) throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
  return [assertCanonicalLocation(input.projectRoot, input.type, input.version, chain.intent.file).abs];
}

export function updateArtifactDraft(input: UpdateArtifactDraftInput): UpdateArtifactDraftResult {
  const { projectRoot, type, version, content, expectedArtifactSha256 } = input;

  if (type !== 'intent') {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `Updating a DRAFT of type "${type}" is outside the Stage C pilot scope (intent only).`
    );
  }

  const buf = Buffer.from(content, 'utf-8');
  if (buf.length > MAX_ARTIFACT_BYTES) {
    throw new McpQueryError(
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      `Content exceeds the ${MAX_ARTIFACT_BYTES} byte write limit.`
    );
  }

  // Only the active chain's own intent is editable — the same chain that
  // sigma_create_intent_draft would have just activated. There is no
  // chain-selection argument on this tool, matching create's own scope.
  const { data: chain } = readActiveChain(projectRoot);

  if (chain.intent.version !== version) {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `The active chain's intent is at version ${chain.intent.version}, not ${version}.`
    );
  }
  if (chain.intent.state !== 'DRAFT') {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `DIR-INTENT ${version} is in state "${chain.intent.state}"; only a DRAFT can be updated through this tool.`
    );
  }
  if (!chain.intent.file) {
    throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
  }

  const current = readCanonicalArtifactFile(projectRoot, 'intent', version, chain.intent.file);
  if (!current.present || current.sha256 === null) {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      'The registered DRAFT file is not present on disk — nothing to update.'
    );
  }
  if (current.sha256 !== expectedArtifactSha256) {
    throw new McpQueryError(
      ERROR_CODES.STALE_ARTIFACT,
      'Artifact content has changed since expected_artifact_sha256 was read.'
    );
  }

  const written = writeCanonicalArtifactFile(projectRoot, 'intent', version, chain.intent.file, content);

  return { type: 'intent', version, path: written.rel, bytes: written.bytes, sha256: written.sha256 };
}
