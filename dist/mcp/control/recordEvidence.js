"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.2, Stage E W1 — sigma_record_evidence's
// compute function. No CLI equivalent exists (DEV has never had a
// `sigma exec evidence add` command; evidence has always lived informally
// as build/test output a human refers to from memory) — like
// artifactDraftUpdate.ts, there is nothing to extract a shared CLI+MCP
// service out of, so this stays control-plane-only under src/mcp/control/
// rather than src/services/, where it can depend on binding.ts's
// canonicalize() without pulling that into a nominally transport-agnostic
// services layer.
//
// ref_path is the one path in this MCP surface that is NOT derived from
// chain.ts tracker state (contrast artifactPath.ts's allowlist-by-tracker
// model, used by sigma_read_artifact/sigma_get_evidence) — it points at an
// arbitrary file the DEV role wants to cite as evidence (a test report, a
// build log). Bounded instead by project-root containment: resolved,
// realpath-canonicalized, and rejected if it escapes projectRoot (../
// traversal or a symlink pointing outside) — Director decision 2026-09-16
// (H-01 follow-up) after this was flagged as adjacent to the `scan`
// non-admissibility risk (capability matrix §3.5: arbitrary host path
// read). ref_sha256 is always server-computed by reading that file at
// record time — never trusted from caller input — so the record is a
// verified fact, not an unverified claim.
//
// Storage: chain.exec.versions[].evidence[] (Director decision 2026-09-16)
// — scoped to a specific DEV-EXEC version, not a separate append-only log,
// so it rides the same state_revision/transaction-journal machinery as
// every other chain.ts mutation with no new atomicity primitive needed.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EVIDENCE_REF_BYTES = void 0;
exports.recordEvidenceTransactionFiles = recordEvidenceTransactionFiles;
exports.recordEvidence = recordEvidence;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const chain_1 = require("../../engine/chain");
const binding_1 = require("../binding");
const controlStore_1 = require("../../engine/controlStore");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
/** Refuse rather than hash pathologically large files under the control
 *  lock — respondControlWrite's mutate() must stay synchronous (shared.ts),
 *  so an unbounded read here would block concurrent requests. Generous for
 *  a test report or build log, far below what a lock should ever hold. */
exports.MAX_EVIDENCE_REF_BYTES = 10 * 1024 * 1024;
function resolveExecEntry(chain, version) {
    const normalized = (0, chain_1.normalizeVersionArg)(version);
    const execEntry = normalized
        ? chain.exec.versions.find(v => v.version === normalized)
        : chain.exec.versions.find(v => v.version === chain.exec.active_version);
    if (!execEntry) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, normalized ? `DEV-EXEC ${normalized} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
    }
    return execEntry;
}
function assertContained(projectRoot, candidate, refPath) {
    const realRoot = (0, binding_1.canonicalize)(projectRoot);
    const realCandidate = (0, binding_1.canonicalize)(candidate);
    const rel = path_1.default.relative(realRoot, realCandidate).split(path_1.default.sep).join('/');
    if (rel.startsWith('..') || path_1.default.isAbsolute(rel)) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.BOUNDARY_VIOLATION, `ref_path escapes the project root: ${refPath}`);
    }
}
/**
 * Resolves ref_path against projectRoot and refuses anything that is not a
 * contained, existing, regular file — mirrors the containment principle of
 * artifactPath.ts's boundary checks (open-by-fd, fstat, re-verify after
 * open), but without a tracker allowlist since evidence files are not
 * governance artifacts and can live anywhere inside the project.
 */
function readContainedRef(projectRoot, refPath) {
    if (path_1.default.isAbsolute(refPath) || refPath.trim().length === 0) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'ref_path must be a non-empty relative path within the project.');
    }
    const candidate = path_1.default.resolve(projectRoot, refPath);
    // Pre-open containment check — canonicalize() resolves symlinks (falling
    // back to the unresolved path if the target doesn't exist yet, which is
    // fine: the open below is what proves existence).
    assertContained(projectRoot, candidate, refPath);
    let fd;
    try {
        fd = fs_extra_1.default.openSync(candidate, 'r');
    }
    catch {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, `ref_path does not exist or is not readable: ${refPath}`);
    }
    try {
        const stat = fs_extra_1.default.fstatSync(fd);
        if (!stat.isFile()) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.BOUNDARY_VIOLATION, 'ref_path is not a regular file.');
        }
        if (stat.size > exports.MAX_EVIDENCE_REF_BYTES) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.PAYLOAD_TOO_LARGE, `ref_path file exceeds the ${exports.MAX_EVIDENCE_REF_BYTES} byte limit.`);
        }
        // Re-verified after open, on the descriptor that was actually stat'd —
        // same TOCTOU-minimization posture as readCanonicalArtifactFile: the
        // path could have been swapped (e.g. a symlink replaced) between the
        // pre-open check above and openSync.
        assertContained(projectRoot, candidate, refPath);
        const rel = path_1.default.relative((0, binding_1.canonicalize)(projectRoot), (0, binding_1.canonicalize)(candidate)).split(path_1.default.sep).join('/');
        const buf = Buffer.alloc(stat.size);
        let read = 0;
        while (read < stat.size) {
            const n = fs_extra_1.default.readSync(fd, buf, read, stat.size - read, read);
            if (n <= 0)
                break;
            read += n;
        }
        if (read !== stat.size) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'ref_path could not be read in full.');
        }
        return {
            rel,
            bytes: buf.length,
            sha256: 'sha256:' + crypto_1.default.createHash('sha256').update(buf).digest('hex'),
        };
    }
    finally {
        fs_extra_1.default.closeSync(fd);
    }
}
function recordEvidenceTransactionFiles(projectRoot) {
    const { chainVersion } = (0, chain_1.readActiveChain)(projectRoot);
    return [(0, chain_1.chainFilePath)(projectRoot, chainVersion)];
}
function recordEvidence(input) {
    const { projectRoot, execVersion, description, refPath, actorRole } = input;
    if (!description?.trim()) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'description is required.');
    }
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    (0, chain_1.assertChainCanMutate)(chain);
    const execEntry = resolveExecEntry(chain, execVersion);
    const { rel, sha256 } = readContainedRef(projectRoot, refPath);
    (0, controlStore_1.controlTestFailpoint)('record_evidence_after_read');
    const record = {
        description,
        ref_path: rel,
        ref_sha256: sha256,
        recorded_by: actorRole,
        recorded_at: new Date().toISOString(),
    };
    execEntry.evidence = [...(execEntry.evidence ?? []), record];
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('record_evidence_after_chain');
    return { chainVersion, execVersion: execEntry.version, record, sha256 };
}
//# sourceMappingURL=recordEvidence.js.map