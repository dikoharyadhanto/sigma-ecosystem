// Generalized from src/utils/roadmap.ts (PLAN-EVAL-01 §3.5) — the
// `<!-- SIGMA:RENDER:START/END:<name> -->` delimiter mechanism is not
// specific to ROADMAP. The Amendment mechanism (Discussion 2026-08-11_0115
// §3 item 4, Director directive 2026-08-12) reuses it verbatim for DIR-INTENT
// Section 14 (Amendment History) via amendmentHistory.ts. `docLabel` replaces
// the hard-coded "ROADMAP file" wording in error messages so both callers get
// an accurate message.

export function replaceSection(content: string, name: string, replacement: string, docLabel = 'ROADMAP file'): string {
  const startDelim = `<!-- SIGMA:RENDER:START:${name} -->`;
  const endDelim = `<!-- SIGMA:RENDER:END:${name} -->`;
  const startIdx = content.indexOf(startDelim);
  const endIdx = content.indexOf(endDelim);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Section delimiters not found for "${name}" in ${docLabel}. Template may need updating.`);
  }
  const before = content.substring(0, startIdx + startDelim.length);
  const after = content.substring(endIdx);
  return `${before}\n${replacement}\n${after}`;
}

export function removeSectionIfPresent(content: string, name: string, docLabel = 'ROADMAP file'): string {
  const startDelim = `<!-- SIGMA:RENDER:START:${name} -->`;
  const endDelim = `<!-- SIGMA:RENDER:END:${name} -->`;
  const startIdx = content.indexOf(startDelim);
  const endIdx = content.indexOf(endDelim);
  if (startIdx === -1 || endIdx === -1) return content;
  if (endIdx < startIdx) {
    throw new Error(`Section delimiters are out of order for "${name}" in ${docLabel}.`);
  }

  const before = content.substring(0, startIdx).replace(/[ \t]*\n?$/, '');
  const after = content.substring(endIdx + endDelim.length).replace(/^\s*\n?/, '\n');
  return `${before}${after}`;
}
