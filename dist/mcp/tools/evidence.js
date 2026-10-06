"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 — sigma_get_evidence
//
// "Membaca evidence reference/status untuk plan/exec tertentu ... Tidak
// arbitrary log read." This is a status/reference projection over one
// plan/exec version's tracker entry — version, state, timestamps, refs, and a
// hash of the artifact file if one is registered — never the document body
// (that is sigma_read_artifact's job) and never operations.jsonl or any other
// log.
//
// The tracker's `file` field is exactly as untrusted here as it is for
// sigma_read_artifact (reviewer findings R-01/R-10): a corrupted or rewritten
// tracker entry must not turn this into a file reader either. Path
// containment AND the open/verify/hash/read routine are both delegated to
// ../artifactPath.ts — the first version of this tool re-implemented the read
// routine on its own and came out weaker (reviewer finding R-B2-04: no
// BOUNDARY_VIOLATION on a non-regular file, no canonical recheck after open).
// There is now exactly one routine both tools go through.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGetEvidence = computeGetEvidence;
exports.registerGetEvidenceTool = registerGetEvidenceTool;
const zod_1 = require("zod");
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
const artifactPath_1 = require("../artifactPath");
const errors_1 = require("../errors");
function computeGetEvidence(root, type, version) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    const { chainVersion, data } = (0, chain_1.readActiveChain)(root);
    const versions = (type === 'plan' ? data.plan : data.exec).versions ?? [];
    if (versions.length === 0) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `No ${type} artifact is registered in the active chain.`);
    }
    const picked = version
        ? versions.find((v) => v.version === version)
        : versions[versions.length - 1];
    if (!picked) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `No ${type} artifact with that version is registered in the active chain.`);
    }
    let present = false;
    let relPath = null;
    let bytes = null;
    let sha256 = null;
    if (picked.file) {
        // Same boundary AND same read posture as sigma_read_artifact: fail closed
        // on a tracker entry that does not land on the canonical current/legacy
        // location, on a non-regular file, and on a canonical-location change
        // between the pre-open check and the open itself.
        const file = (0, artifactPath_1.readCanonicalArtifactFile)(root, type, picked.version, picked.file);
        present = file.present;
        relPath = file.path;
        bytes = file.bytes;
        sha256 = file.sha256;
    }
    return {
        active: true,
        active_chain: chainVersion,
        evidence_type: type,
        version: picked.version,
        state: picked.state,
        created_at: picked.created_at,
        updated_at: picked.updated_at,
        locked_at: picked.locked_at ?? null,
        superseded_by: picked.superseded_by ?? null,
        supersede_reason: picked.supersede_reason ?? null,
        intent_version_ref: picked.intent_version_ref ?? null,
        plan_version_ref: picked.plan_version_ref ?? null,
        title: picked.title ?? null,
        focus: picked.focus ?? null,
        human: picked.human ?? null,
        present,
        path: relPath,
        bytes,
        sha256,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerGetEvidenceTool(server) {
    server.registerTool('sigma_get_evidence', {
        title: 'Get Sigma Evidence Status',
        description: 'Return status/reference metadata for one plan or exec artifact version of the active chain: state, timestamps, supersede/version refs, humanize status, and — if a file is registered for that version — its canonical relative path, byte size and sha256. Does NOT return document content (use sigma_read_artifact for that) and does not read any log file. Read-only. Returns { active, active_chain, evidence_type, version, state, created_at, updated_at, locked_at, superseded_by, supersede_reason, intent_version_ref, plan_version_ref, title, focus, human, present, path, bytes, sha256, source }.',
        inputSchema: {
            type: zod_1.z
                .enum(['plan', 'exec'])
                .describe('Which artifact tracker to report evidence status for.'),
            version: zod_1.z
                .string()
                .optional()
                .describe('Artifact version, e.g. "v1.1". Defaults to the most recent version the tracker records for that type.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ type, version }) => (0, contract_1.respond)('sigma_get_evidence', undefined, (root) => computeGetEvidence(root, type, version)));
}
//# sourceMappingURL=evidence.js.map