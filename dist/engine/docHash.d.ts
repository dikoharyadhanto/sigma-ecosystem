export declare const sha256Hex: (bytes: string | Buffer) => string;
/** Hash of the content with CRLF folded to LF — comparable across `core.autocrlf` settings (F05 R-1). */
export declare function lfSha256(bytes: Buffer): string;
/** Hash of the content with every line ending expanded to CRLF — the raw hash a Windows `core.autocrlf=true` checkout would have. */
export declare function crlfSha256(bytes: Buffer): string;
/**
 * Diagnostic suffix for UNCERTIFIED_EDIT: shows raw and LF hashes beside the
 * certified one and says whether line endings alone could explain a mismatch.
 */
export declare function lineEndingHint(bytes: Buffer, certified: string | null | undefined): string;
/**
 * True when `bytes` is the certified document, regardless of line-ending
 * conversion. Accepts the LF-folded hash (what certification stores now) and
 * the raw-byte hash of either form (certifications made before line-ending
 * normalization, on an LF or a CRLF host). The `sha256:` prefix is tolerated.
 */
export declare function matchesCertified(bytes: Buffer, certified: string | null | undefined): boolean;
//# sourceMappingURL=docHash.d.ts.map