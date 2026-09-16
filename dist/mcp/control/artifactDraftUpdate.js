"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUpdatableArtifactType = isUpdatableArtifactType;
exports.ownerRoleForArtifactType = ownerRoleForArtifactType;
exports.updateArtifactDraftTransactionFiles = updateArtifactDraftTransactionFiles;
exports.updateArtifactDraft = updateArtifactDraft;
const chain_1 = require("../../engine/chain");
const artifactPath_1 = require("../artifactPath");
const canonicalWrite_1 = require("./canonicalWrite");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const artifactPath_2 = require("../artifactPath");
const OWNER_ROLE = {
    intent: 'ARC',
    plan: 'FMN',
    exec: 'DEV',
};
function isUpdatableArtifactType(type) {
    return type === 'intent' || type === 'plan' || type === 'exec';
}
function ownerRoleForArtifactType(type) {
    return OWNER_ROLE[type];
}
/** Resolves the DRAFT entry a given type/version refers to in the active
 *  chain. `intent` is a single object; `plan`/`exec` are versioned arrays
 *  (chain.plan.versions[] / chain.exec.versions[]) — this is the one place
 *  that difference is bridged, so both updateArtifactDraftTransactionFiles()
 *  and updateArtifactDraft() see the identical resolution and can never
 *  diverge. */
function resolveDraftEntry(chain, type, version) {
    if (type === 'intent') {
        if (chain.intent.version !== version) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `The active chain's intent is at version ${chain.intent.version}, not ${version}.`);
        }
        if (!chain.intent.file) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
        }
        return { file: chain.intent.file, state: chain.intent.state };
    }
    const entry = chain[type].versions.find(v => v.version === version);
    if (!entry) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `No ${type} version ${version} found in the active chain.`);
    }
    if (!entry.file) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, `Active chain's ${type} ${version} has no registered file.`);
    }
    return { file: entry.file, state: entry.state };
}
function updateArtifactDraftTransactionFiles(input) {
    if (!isUpdatableArtifactType(input.type)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Updating a DRAFT of type "${input.type}" is outside the Stage E pilot scope (intent/plan/exec only).`);
    }
    const { data: chain } = (0, chain_1.readActiveChain)(input.projectRoot);
    const { file } = resolveDraftEntry(chain, input.type, input.version);
    return [(0, artifactPath_2.assertCanonicalLocation)(input.projectRoot, input.type, input.version, file).abs];
}
function updateArtifactDraft(input) {
    const { projectRoot, type, version, content, expectedArtifactSha256 } = input;
    if (!isUpdatableArtifactType(type)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Updating a DRAFT of type "${type}" is outside the Stage E pilot scope (intent/plan/exec only).`);
    }
    const buf = Buffer.from(content, 'utf-8');
    if (buf.length > artifactPath_1.MAX_ARTIFACT_BYTES) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.PAYLOAD_TOO_LARGE, `Content exceeds the ${artifactPath_1.MAX_ARTIFACT_BYTES} byte write limit.`);
    }
    // Only the active chain's own entries are editable — no chain-selection
    // argument on this tool, matching create's own scope.
    const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const { file, state } = resolveDraftEntry(chain, type, version);
    if (state !== 'DRAFT') {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `${type} ${version} is in state "${state}"; only a DRAFT can be updated through this tool.`);
    }
    const current = (0, artifactPath_1.readCanonicalArtifactFile)(projectRoot, type, version, file);
    if (!current.present || current.sha256 === null) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The registered DRAFT file is not present on disk — nothing to update.');
    }
    if (current.sha256 !== expectedArtifactSha256) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, 'Artifact content has changed since expected_artifact_sha256 was read.');
    }
    const written = (0, canonicalWrite_1.writeCanonicalArtifactFile)(projectRoot, type, version, file, content);
    return { type, version, path: written.rel, bytes: written.bytes, sha256: written.sha256 };
}
//# sourceMappingURL=artifactDraftUpdate.js.map