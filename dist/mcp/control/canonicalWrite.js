"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeCanonicalArtifactFile = writeCanonicalArtifactFile;
const fs_extra_1 = __importDefault(require("fs-extra"));
const crypto_1 = __importDefault(require("crypto"));
const artifactPath_1 = require("../artifactPath");
const contract_1 = require("../contract");
const errors_1 = require("../errors");
const fs_1 = require("../../utils/fs");
function writeCanonicalArtifactFile(root, type, version, trackerFile, content) {
    const { abs, rel } = (0, artifactPath_1.assertCanonicalLocation)(root, type, version, trackerFile);
    const buf = Buffer.from(content, 'utf-8');
    if (buf.length > artifactPath_1.MAX_ARTIFACT_BYTES) {
        throw new errors_1.McpQueryError(contract_1.ERROR_CODES.PAYLOAD_TOO_LARGE, `Content exceeds the ${artifactPath_1.MAX_ARTIFACT_BYTES} byte write limit.`);
    }
    const tmpPath = `${abs}.tmp`;
    fs_extra_1.default.writeFileSync(tmpPath, buf);
    (0, fs_1.atomicReplaceFileSync)(tmpPath, abs); // see src/utils/fs.ts — §21.9
    return {
        abs,
        rel,
        bytes: buf.length,
        sha256: 'sha256:' + crypto_1.default.createHash('sha256').update(buf).digest('hex'),
    };
}
//# sourceMappingURL=canonicalWrite.js.map