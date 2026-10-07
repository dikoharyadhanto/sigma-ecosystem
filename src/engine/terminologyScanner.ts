import fs from 'fs-extra';
import path from 'path';
import { PROJECT_SIGMA_DIR } from '../config';

// Terminology matcher for the standalone `sigma scan` command
// (informational, any file).

export interface TerminologyMatch {
  term: string;
  line: number;
  lineText: string;
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary, case-sensitive. Case-sensitive is deliberate: Sigma always
// writes state names in caps (DRAFT, LOCKED) — matching case-sensitively
// avoids flagging ordinary lowercase English ("a rough draft", "the door
// was locked") that would otherwise dominate false-positive noise. Director
// decision (session 2026-08-16): no smarter disambiguation than this — a
// false positive costs a reword, not a redesign.
export function scanForSigmaTerminology(content: string, terminology: string[]): TerminologyMatch[] {
  const lines = content.split('\n');
  const matches: TerminologyMatch[] = [];
  for (const term of terminology) {
    if (!term.trim()) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`);
    lines.forEach((lineText, idx) => {
      if (pattern.test(lineText)) {
        matches.push({ term, line: idx + 1, lineText: lineText.trim() });
      }
    });
  }
  return matches;
}

// §2.6 — default list is bundled (Sigma/rules/sigma_terminology.default.json,
// synced like any other rule file, never edited per-project); custom list is
// project-local (Sigma/sigma_terminology.custom.json, deliberately outside
// rules/ so sync never touches it) and starts empty. Director extends it by
// asking the AI to edit the file directly — no dedicated CLI command, this
// is a word list, not governance state.
export function loadTerminologyList(projectRoot: string): string[] {
  const defaultPath = path.join(projectRoot, PROJECT_SIGMA_DIR, 'rules', 'sigma_terminology.default.json');
  const customPath = path.join(projectRoot, PROJECT_SIGMA_DIR, 'sigma_terminology.custom.json');

  const readTerms = (p: string): string[] => {
    if (!fs.existsSync(p)) return [];
    try {
      const data = fs.readJsonSync(p);
      return Array.isArray(data.terms) ? data.terms.filter((t: unknown) => typeof t === 'string') : [];
    } catch {
      return [];
    }
  };

  return [...new Set([...readTerms(defaultPath), ...readTerms(customPath)])];
}
