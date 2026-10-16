"use strict";
// Certified-document hashing that survives `core.autocrlf` differences between
// hosts (Windows checkout = CRLF, Fedora checkout = LF). Dependency-free so any
// engine module can import it without creating a cycle.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = void 0;
exports.lfSha256 = lfSha256;
exports.crlfSha256 = crlfSha256;
exports.lineEndingHint = lineEndingHint;
exports.matchesCertified = matchesCertified;
const crypto_1 = __importDefault(require("crypto"));
const sha256Hex = (bytes) => crypto_1.default.createHash('sha256').update(bytes).digest('hex');
exports.sha256Hex = sha256Hex;
/** Hash of the content with CRLF folded to LF — comparable across `core.autocrlf` settings (F05 R-1). */
function lfSha256(bytes) {
    return (0, exports.sha256Hex)(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
}
/** Hash of the content with every line ending expanded to CRLF — the raw hash a Windows `core.autocrlf=true` checkout would have. */
function crlfSha256(bytes) {
    return (0, exports.sha256Hex)(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'latin1'));
}
/**
 * Diagnostic suffix for UNCERTIFIED_EDIT: shows raw and LF hashes beside the
 * certified one and says whether line endings alone could explain a mismatch.
 */
function lineEndingHint(bytes, certified) {
    const raw = (0, exports.sha256Hex)(bytes);
    const lf = lfSha256(bytes);
    const crCount = bytes.toString('latin1').split('\r\n').length - 1;
    return `certified=${certified ?? 'none'} file_raw=${raw} file_lf=${lf} crlf_count=${crCount}` +
        (crCount > 0 ? ' (CRLF present: if only line endings changed, the file should still match via file_lf; a mismatch here means content differs)' : '');
}
/**
 * True when `bytes` is the certified document, regardless of line-ending
 * conversion. Accepts the LF-folded hash (what certification stores now) and
 * the raw-byte hash of either form (certifications made before line-ending
 * normalization, on an LF or a CRLF host). The `sha256:` prefix is tolerated.
 */
function matchesCertified(bytes, certified) {
    if (!certified)
        return false;
    const want = certified.startsWith('sha256:') ? certified.slice(7) : certified;
    return (0, exports.sha256Hex)(bytes) === want || lfSha256(bytes) === want || crlfSha256(bytes) === want;
}
//# sourceMappingURL=docHash.js.map