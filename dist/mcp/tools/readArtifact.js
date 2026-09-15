"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtifactReadError = exports.MAX_ARTIFACT_BYTES = void 0;
exports.computeReadArtifact = computeReadArtifact;
exports.registerReadArtifactTool = registerReadArtifactTool;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
const binding_1 = require("../binding");
/** Refuse rather than truncate. Generous for prose, far below any real file. */
exports.MAX_ARTIFACT_BYTES = 512 * 1024;
class ArtifactReadError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ArtifactReadError';
    }
}
exports.ArtifactReadError = ArtifactReadError;
/**
 * Every file the active chain references, per artifact type. This is the
 * allowlist — building it from tracker state is the entire security property.
 */
function candidatesFor(data, type) {
    const fromVersions = (versions) => versions
        .filter((v) => typeof v.file === 'string' && v.file.length > 0)
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
function assertInsideRoot(root, abs) {
    const realRoot = (0, binding_1.canonicalize)(root);
    const realAbs = (0, binding_1.canonicalize)(abs);
    const rel = path_1.default.relative(realRoot, realAbs);
    if (rel === '' || rel.startsWith('..') || path_1.default.isAbsolute(rel)) {
        throw new ArtifactReadError(contract_1.ERROR_CODES.BOUNDARY_VIOLATION, 'Artifact path resolves outside the bound project root.');
    }
}
function computeReadArtifact(root, type, version) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    const { chainVersion, data } = (0, chain_1.readActiveChain)(root);
    const candidates = candidatesFor(data, type);
    if (candidates.length === 0) {
        throw new ArtifactReadError(contract_1.ERROR_CODES.INVALID_OPERATION, `No ${type} artifact is registered in the active chain.`);
    }
    // No version given → the last entry the tracker recorded for that type.
    const picked = version
        ? candidates.find((c) => c.version === version)
        : candidates[candidates.length - 1];
    if (!picked) {
        throw new ArtifactReadError(contract_1.ERROR_CODES.INVALID_OPERATION, `No ${type} artifact with that version is registered in the active chain.`);
    }
    const abs = path_1.default.resolve(root, picked.file);
    assertInsideRoot(root, abs);
    let stat;
    try {
        stat = fs_extra_1.default.statSync(abs);
    }
    catch {
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
            source: shared_1.SOURCE_ENGINE,
        };
    }
    if (!stat.isFile()) {
        throw new ArtifactReadError(contract_1.ERROR_CODES.BOUNDARY_VIOLATION, 'Registered artifact path is not a regular file.');
    }
    if (stat.size > exports.MAX_ARTIFACT_BYTES) {
        throw new ArtifactReadError(contract_1.ERROR_CODES.PAYLOAD_TOO_LARGE, `Artifact exceeds the ${exports.MAX_ARTIFACT_BYTES} byte read limit.`);
    }
    const buf = fs_extra_1.default.readFileSync(abs);
    return {
        active: true,
        active_chain: chainVersion,
        artifact_type: type,
        version: picked.version,
        state: picked.state,
        present: true,
        // Project-relative, posix — never the host path (§8 rule 5).
        path: picked.file.split(path_1.default.sep).join('/'),
        bytes: stat.size,
        sha256: 'sha256:' + crypto_1.default.createHash('sha256').update(buf).digest('hex'),
        content: buf.toString('utf-8'),
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerReadArtifactTool(server) {
    server.registerTool('sigma_read_artifact', {
        title: 'Read Sigma Governance Artifact',
        description: 'Read the contents of one governance artifact of the active chain, selected by type and optional version. Read-only. Does NOT accept a filesystem path: the path is resolved solely from the active chain tracker, must stay inside the bound project root, and files above the size limit are refused rather than truncated. Returns { active, active_chain, artifact_type, version, state, present, path, bytes, sha256, content, source }. present:false means the chain references a file that is missing on disk.',
        inputSchema: {
            type: zod_1.z
                .enum(['intent', 'roadmap', 'plan', 'exec', 'close'])
                .describe('Which governance artifact of the active chain to read.'),
            version: zod_1.z
                .string()
                .optional()
                .describe('Artifact version, e.g. "v1" or "v1.1". Defaults to the most recent version the tracker records for that type.'),
        },
    }, async ({ type, version }) => (0, contract_1.respond)('sigma_read_artifact', undefined, (root) => computeReadArtifact(root, type, version)));
}
//# sourceMappingURL=readArtifact.js.map