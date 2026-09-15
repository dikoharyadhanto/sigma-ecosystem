"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.1 — canonical governance-artifact
// path derivation, shared by every query tool that resolves a tracker-recorded
// file rather than a filesystem path handed in by a caller.
//
// Extracted out of tools/readArtifact.ts so a second tool (evidence) cannot
// duplicate this table and drift from it the way reconstruct.ts's PATTERNS and
// the original artifact reader once did (reviewer finding R-10). There is
// exactly one function that says "this tracker entry may occupy this path",
// and every caller goes through it.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ARTIFACT_BYTES = void 0;
exports.candidatesFor = candidatesFor;
exports.allowedRelPaths = allowedRelPaths;
exports.assertCanonicalLocation = assertCanonicalLocation;
exports.readCanonicalArtifactFile = readCanonicalArtifactFile;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const binding_1 = require("./binding");
const contract_1 = require("./contract");
const errors_1 = require("./errors");
/** Refuse rather than truncate. Generous for prose, far below any real file. */
exports.MAX_ARTIFACT_BYTES = 512 * 1024;
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
/**
 * The path a given artifact type+version is *allowed* to occupy. Derived, not
 * read from the tracker — so a rewritten tracker cannot widen it.
 */
function allowedRelPaths(type, version) {
    const { dirs, prefix, versionSource } = config_1.ARTIFACT_LAYOUT[type];
    // Per-type version shape, matching the engine: v1 for intent/roadmap/close,
    // v1.1 for plan/exec. Anything path-shaped fails here, before it can be
    // pasted into a filename.
    if (!new RegExp(`^${versionSource}$`).test(version)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'Artifact version is not a valid Sigma version token.');
    }
    // New folder name first, pre-rename name second — both are legitimate
    // locations for the same artifact, and which one a project uses depends only
    // on when it was created.
    return dirs.map((dir) => `${config_1.PROJECT_SIGMA_DIR}/${dir}/${prefix}-${version}.md`);
}
/**
 * Checks the tracker's own `file` value against the derived path, then checks
 * that the path still resolves there after symlinks and Windows junctions are
 * followed. The second check is what the original containment test missed: a
 * symlink at the canonical location pointing at `.env` is *inside the root*,
 * so "inside the root" alone would have let it through.
 */
function assertCanonicalLocation(root, type, version, trackerFile) {
    const allowed = allowedRelPaths(type, version);
    const declared = trackerFile.split('\\').join('/');
    // The tracker may only *select* among the allowed locations. It can never
    // introduce one — that is what turned this tool into a file reader before.
    if (!allowed.includes(declared)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.BOUNDARY_VIOLATION, 'Tracker entry does not point at a canonical location for this artifact type and version.');
    }
    const abs = path_1.default.resolve(root, declared);
    const realRoot = (0, binding_1.canonicalize)(root);
    const realAbs = (0, binding_1.canonicalize)(abs);
    const rel = path_1.default.relative(realRoot, realAbs).split(path_1.default.sep).join('/');
    // Must still land on the *same* entry after symlinks and junctions resolve.
    // A symlink sitting at a perfectly canonical path is inside the root and
    // still not the artifact it claims to be.
    if (rel !== declared) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.BOUNDARY_VIOLATION, 'Artifact path does not resolve to its canonical location.');
    }
    return { abs, rel };
}
/**
 * Opens, verifies, hashes and reads the one file a tracker entry may occupy
 * for a given type+version — the single place both sigma_read_artifact and
 * sigma_get_evidence go through, so the two cannot drift on what counts as a
 * safe read (reviewer finding R-B2-04: evidence originally re-implemented this
 * with a weaker posture — no BOUNDARY_VIOLATION on a non-regular file, no
 * canonical recheck after open — and R-10 already showed what a second copy
 * of a boundary table does over time).
 *
 * Bytes are read from the descriptor that was stat'd, and the canonical
 * location is re-checked after open, before those bytes are trusted — the
 * file that was measured is the file that is read, even if the path is
 * swapped underneath between the pre-open check and the open itself.
 */
function readCanonicalArtifactFile(root, type, version, trackerFile) {
    const { abs, rel } = assertCanonicalLocation(root, type, version, trackerFile);
    let fd;
    try {
        fd = fs_extra_1.default.openSync(abs, 'r');
    }
    catch {
        // The tracker references a file that is not on disk. That is a real
        // governance finding, reported as state rather than as a read failure.
        return { present: false, path: rel, bytes: null, sha256: null, content: null };
    }
    try {
        const stat = fs_extra_1.default.fstatSync(fd);
        if (!stat.isFile()) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.BOUNDARY_VIOLATION, 'Registered artifact path is not a regular file.');
        }
        if (stat.size > exports.MAX_ARTIFACT_BYTES) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.PAYLOAD_TOO_LARGE, `Artifact exceeds the ${exports.MAX_ARTIFACT_BYTES} byte read limit.`);
        }
        // Re-checked after open — residual TOCTOU window between the pre-open
        // check and openSync, not claimed to be zero, only re-verified.
        assertCanonicalLocation(root, type, version, trackerFile);
        const buf = Buffer.alloc(stat.size);
        let read = 0;
        while (read < stat.size) {
            const n = fs_extra_1.default.readSync(fd, buf, read, stat.size - read, read);
            if (n <= 0)
                break;
            read += n;
        }
        if (read !== stat.size) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Artifact could not be read in full.');
        }
        return {
            present: true,
            path: rel,
            bytes: buf.length,
            sha256: 'sha256:' + crypto_1.default.createHash('sha256').update(buf).digest('hex'),
            content: buf.toString('utf-8'),
        };
    }
    finally {
        fs_extra_1.default.closeSync(fd);
    }
}
//# sourceMappingURL=artifactPath.js.map