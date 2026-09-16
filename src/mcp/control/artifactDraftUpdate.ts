// Stage C pilot (intent) + Stage E W1 extension (plan/exec) —
// sigma_update_artifact_draft's compute function. No CLI equivalent exists
// for any of the three (a human just edits the file directly), so unlike
// draft creation there is nothing to extract a shared service out of; this
// is control-plane-only logic, kept under src/mcp/control/ rather than
// src/services/ so it can depend on the MCP path-safety helpers
// (readCanonicalArtifactFile / writeCanonicalArtifactFile) without pulling
// those into a nominally transport-agnostic services layer.
//
// Scope is pinned to type intent/plan/exec — roadmap/close stay out (plan
// §14 Stage E, Director's W1 list only names "plan/exec"). The MCP tool
// schema also pins this with z.enum(['intent','plan','exec']) — this check
// is defense in depth, not the only gate.
//
// assertCanonicalLocation()/readCanonicalArtifactFile()/
// writeCanonicalArtifactFile() (src/mcp/artifactPath.ts, this file's
// canonicalWrite.ts) are already generic across all five ArtifactType
// values since Batch 1 — extending scope here does not touch that path-safety
// layer at all, only the chain lookup and role below it.

import { ChainState, readActiveChain } from '../../engine/chain';
import { readCanonicalArtifactFile, MAX_ARTIFACT_BYTES, ArtifactType } from '../artifactPath';
import { writeCanonicalArtifactFile } from './canonicalWrite';
import { ERROR_CODES } from '../contract';
import { McpQueryError } from '../errors';
import { assertCanonicalLocation } from '../artifactPath';

/** The three artifact types this tool supports updating a DRAFT of. A
 *  narrower alias of ArtifactType, not a redeclaration — roadmap/close
 *  remain rejected below even though they're valid ArtifactType values. */
export type UpdatableArtifactType = 'intent' | 'plan' | 'exec';

const OWNER_ROLE: Record<UpdatableArtifactType, 'ARC' | 'FMN' | 'DEV'> = {
  intent: 'ARC',
  plan: 'FMN',
  exec: 'DEV',
};

export function isUpdatableArtifactType(type: string): type is UpdatableArtifactType {
  return type === 'intent' || type === 'plan' || type === 'exec';
}

export function ownerRoleForArtifactType(type: UpdatableArtifactType): 'ARC' | 'FMN' | 'DEV' {
  return OWNER_ROLE[type];
}

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

/** Resolves the DRAFT entry a given type/version refers to in the active
 *  chain. `intent` is a single object; `plan`/`exec` are versioned arrays
 *  (chain.plan.versions[] / chain.exec.versions[]) — this is the one place
 *  that difference is bridged, so both updateArtifactDraftTransactionFiles()
 *  and updateArtifactDraft() see the identical resolution and can never
 *  diverge. */
function resolveDraftEntry(chain: ChainState, type: UpdatableArtifactType, version: string): { file: string; state: string } {
  if (type === 'intent') {
    if (chain.intent.version !== version) {
      throw new McpQueryError(
        ERROR_CODES.INVALID_OPERATION,
        `The active chain's intent is at version ${chain.intent.version}, not ${version}.`
      );
    }
    if (!chain.intent.file) {
      throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
    }
    return { file: chain.intent.file, state: chain.intent.state };
  }

  const entry = chain[type].versions.find(v => v.version === version);
  if (!entry) {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `No ${type} version ${version} found in the active chain.`
    );
  }
  if (!entry.file) {
    throw new McpQueryError(ERROR_CODES.INTERNAL_ERROR, `Active chain's ${type} ${version} has no registered file.`);
  }
  return { file: entry.file, state: entry.state };
}

export function updateArtifactDraftTransactionFiles(input: Pick<UpdateArtifactDraftInput, 'projectRoot' | 'type' | 'version'>): string[] {
  if (!isUpdatableArtifactType(input.type)) {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `Updating a DRAFT of type "${input.type}" is outside the Stage E pilot scope (intent/plan/exec only).`
    );
  }
  const { data: chain } = readActiveChain(input.projectRoot);
  const { file } = resolveDraftEntry(chain, input.type, input.version);
  return [assertCanonicalLocation(input.projectRoot, input.type, input.version, file).abs];
}

export function updateArtifactDraft(input: UpdateArtifactDraftInput): UpdateArtifactDraftResult {
  const { projectRoot, type, version, content, expectedArtifactSha256 } = input;

  if (!isUpdatableArtifactType(type)) {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `Updating a DRAFT of type "${type}" is outside the Stage E pilot scope (intent/plan/exec only).`
    );
  }

  const buf = Buffer.from(content, 'utf-8');
  if (buf.length > MAX_ARTIFACT_BYTES) {
    throw new McpQueryError(
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      `Content exceeds the ${MAX_ARTIFACT_BYTES} byte write limit.`
    );
  }

  // Only the active chain's own entries are editable — no chain-selection
  // argument on this tool, matching create's own scope.
  const { data: chain } = readActiveChain(projectRoot);
  const { file, state } = resolveDraftEntry(chain, type, version);

  if (state !== 'DRAFT') {
    throw new McpQueryError(
      ERROR_CODES.INVALID_OPERATION,
      `${type} ${version} is in state "${state}"; only a DRAFT can be updated through this tool.`
    );
  }

  const current = readCanonicalArtifactFile(projectRoot, type, version, file);
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

  const written = writeCanonicalArtifactFile(projectRoot, type, version, file, content);

  return { type, version, path: written.rel, bytes: written.bytes, sha256: written.sha256 };
}
