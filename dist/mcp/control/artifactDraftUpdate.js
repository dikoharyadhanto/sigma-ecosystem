"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateArtifactDraftTransactionFiles = updateArtifactDraftTransactionFiles;
exports.updateArtifactDraft = updateArtifactDraft;
const chain_1 = require("../../engine/chain");
const artifactPath_1 = require("../artifactPath");
const canonicalWrite_1 = require("./canonicalWrite");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const artifactPath_2 = require("../artifactPath");
function updateArtifactDraftTransactionFiles(input) {
    const { data: chain } = (0, chain_1.readActiveChain)(input.projectRoot);
    if (!chain.intent.file)
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
    return [(0, artifactPath_2.assertCanonicalLocation)(input.projectRoot, input.type, input.version, chain.intent.file).abs];
}
function updateArtifactDraft(input) {
    const { projectRoot, type, version, content, expectedArtifactSha256 } = input;
    if (type !== 'intent') {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `Updating a DRAFT of type "${type}" is outside the Stage C pilot scope (intent only).`);
    }
    const buf = Buffer.from(content, 'utf-8');
    if (buf.length > artifactPath_1.MAX_ARTIFACT_BYTES) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.PAYLOAD_TOO_LARGE, `Content exceeds the ${artifactPath_1.MAX_ARTIFACT_BYTES} byte write limit.`);
    }
    // Only the active chain's own intent is editable — the same chain that
    // sigma_create_intent_draft would have just activated. There is no
    // chain-selection argument on this tool, matching create's own scope.
    const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    if (chain.intent.version !== version) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `The active chain's intent is at version ${chain.intent.version}, not ${version}.`);
    }
    if (chain.intent.state !== 'DRAFT') {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `DIR-INTENT ${version} is in state "${chain.intent.state}"; only a DRAFT can be updated through this tool.`);
    }
    if (!chain.intent.file) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Active intent has no registered file.');
    }
    const current = (0, artifactPath_1.readCanonicalArtifactFile)(projectRoot, 'intent', version, chain.intent.file);
    if (!current.present || current.sha256 === null) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The registered DRAFT file is not present on disk — nothing to update.');
    }
    if (current.sha256 !== expectedArtifactSha256) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.STALE_ARTIFACT, 'Artifact content has changed since expected_artifact_sha256 was read.');
    }
    const written = (0, canonicalWrite_1.writeCanonicalArtifactFile)(projectRoot, 'intent', version, chain.intent.file, content);
    return { type: 'intent', version, path: written.rel, bytes: written.bytes, sha256: written.sha256 };
}
//# sourceMappingURL=artifactDraftUpdate.js.map