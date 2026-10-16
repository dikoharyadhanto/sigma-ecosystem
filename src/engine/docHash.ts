// Certified-document hashing that survives `core.autocrlf` differences between
// hosts (Windows checkout = CRLF, Fedora checkout = LF). Dependency-free so any
// engine module can import it without creating a cycle.

import crypto from 'crypto';

export const sha256Hex = (bytes: string | Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');

/** Hash of the content with CRLF folded to LF — comparable across `core.autocrlf` settings (F05 R-1). */
export function lfSha256(bytes: Buffer): string {
  return sha256Hex(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
}

/** Hash of the content with every line ending expanded to CRLF — the raw hash a Windows `core.autocrlf=true` checkout would have. */
export function crlfSha256(bytes: Buffer): string {
  return sha256Hex(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'latin1'));
}

/**
 * Diagnostic suffix for UNCERTIFIED_EDIT: shows raw and LF hashes beside the
 * certified one and says whether line endings alone could explain a mismatch.
 */
export function lineEndingHint(bytes: Buffer, certified: string | null | undefined): string {
  const raw = sha256Hex(bytes);
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
export function matchesCertified(bytes: Buffer, certified: string | null | undefined): boolean {
  if (!certified) return false;
  const want = certified.startsWith('sha256:') ? certified.slice(7) : certified;
  return sha256Hex(bytes) === want || lfSha256(bytes) === want || crlfSha256(bytes) === want;
}
