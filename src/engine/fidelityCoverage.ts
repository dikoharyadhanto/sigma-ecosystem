// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.3 (CR-02, CR-05) / §7.4 — proves a
// Source Fidelity Ledger actually accounts for every material item in its
// source, instead of trusting whatever list the same AI that compressed the
// document chose to write down. Two independent checks, because a source
// table either has a formal ID column or it doesn't (§7.3/§7.4 found
// DIR-CLOSE has none anywhere, and FMN-PLAN's Implementation Constraints
// has none either) — an ID-only checker would pass those tables vacuously.

export interface CoverageConfig {
  // Regexes matching structured IDs anywhere in the source (e.g. /\bCON-\d+\b/g).
  // Must be global (`g` flag) — findAllIds() calls .exec() in a loop.
  idPatterns: RegExp[];
  // Exact heading text (or a distinctive substring of it) for source tables
  // that have no ID column — coverage for these is row-count reconciliation
  // against `<tableName> #<n>` references in the Ledger, not ID matching.
  namedTables: string[];
  // Fixed, non-tabular items that must be named in the Ledger regardless of
  // classification — e.g. DIR-INTENT's four Quality Bar dimensions, which
  // are rows in a table but not identified by a per-row ID.
  namedItems?: string[];
}

export interface CoverageGap {
  kind: 'id' | 'table-row-count' | 'named-item';
  identifier: string;
  detail?: string;
}

function findAllIds(content: string, pattern: RegExp): string[] {
  const found = new Set<string>();
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    found.add(match[0]);
    if (match.index === re.lastIndex) re.lastIndex++; // guard against zero-width matches looping forever
  }
  return [...found];
}

// Finds `tableName` as a heading/label line, then counts data rows in the
// next markdown table that follows (skipping the header row and the
// `:---|:---` separator row). Returns 0 if no table is found after the
// heading — an empty source table is a legitimate "0 rows to cover", not a
// parse failure; the Ledger template's own Coverage Check asks the author
// to state that explicitly rather than leaving the table absent.
function countTableRows(content: string, tableName: string): number {
  const lines = content.split('\n');
  const headingIdx = lines.findIndex(l => l.includes(tableName));
  if (headingIdx === -1) return 0;

  let i = headingIdx + 1;
  while (i < lines.length && !lines[i].trim().startsWith('|')) {
    // Stop scanning if we hit the next heading before finding a table at all.
    if (/^#{1,6}\s/.test(lines[i].trim())) return 0;
    i++;
  }
  if (i >= lines.length) return 0;

  // lines[i] = header row, lines[i+1] = separator row (assumed present, per
  // every source template's own table formatting).
  let dataRows = 0;
  let j = i + 2;
  while (j < lines.length && lines[j].trim().startsWith('|')) {
    dataRows++;
    j++;
  }
  return dataRows;
}

function countLedgerReferencesToTable(ledgerContent: string, tableName: string): number {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*#\\d+`, 'g');
  const matches = ledgerContent.match(pattern);
  return matches ? matches.length : 0;
}

export function checkFidelityCoverage(
  sourceContent: string,
  ledgerContent: string,
  config: CoverageConfig
): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  for (const pattern of config.idPatterns) {
    for (const id of findAllIds(sourceContent, pattern)) {
      const idPattern = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (!idPattern.test(ledgerContent)) {
        gaps.push({ kind: 'id', identifier: id, detail: 'not referenced anywhere in the Fidelity Ledger' });
      }
    }
  }

  for (const tableName of config.namedTables) {
    const sourceRows = countTableRows(sourceContent, tableName);
    const ledgerRows = countLedgerReferencesToTable(ledgerContent, tableName);
    if (sourceRows !== ledgerRows) {
      gaps.push({
        kind: 'table-row-count',
        identifier: tableName,
        detail: `source has ${sourceRows} row(s), Ledger references ${ledgerRows}`,
      });
    }
  }

  for (const item of config.namedItems ?? []) {
    const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(escaped).test(ledgerContent)) {
      gaps.push({ kind: 'named-item', identifier: item, detail: 'not referenced anywhere in the Fidelity Ledger' });
    }
  }

  return gaps;
}

// §2.3/§7.1 — DIR-INTENT source ID vocabulary + Quality Bar's four fixed
// dimensions (not ID-addressable — see checkFidelityCoverage's namedItems).
export const DIR_INTENT_COVERAGE_CONFIG: CoverageConfig = {
  idPatterns: [/\bCON-\d+\b/g, /\bRR-\d+\b/g, /\bREQ-\d+\b/g, /\bASM-\d+\b/g, /\bSC-\d+\b/g, /\bOS-\d+\b/g, /\bNG-\d+\b/g],
  namedTables: [],
  namedItems: ['Security', 'UX Trust', 'UI / Product Packaging', 'Performance / Cost'],
};

// §7.2 — FMN-PLAN/DEV-EXEC ID vocabulary (TASK-*/AC-*/TC-*/OBS-*/REQ-* —
// REQ-* here is DEV-EXEC's Minor Requests table, a different namespace than
// DIR-INTENT's REQ-* Functional Requirements; the two document types are
// never scanned together against the same config). Implementation
// Constraints (FMN-PLAN §5) has no ID column — covered as a named table.
export const PLAN_EXEC_COVERAGE_CONFIG: CoverageConfig = {
  idPatterns: [/\bTASK-\d+\b/g, /\bAC-\d+\b/g, /\bTC-\d+\b/g, /\bOBS-\d+\b/g, /\bREQ-\d+\b/g],
  namedTables: ['Implementation Constraints'],
  namedItems: [],
};

// §7.3 — DIR-CLOSE has zero ID columns anywhere; every table is covered by
// row-count reconciliation.
export const DIR_CLOSE_COVERAGE_CONFIG: CoverageConfig = {
  idPatterns: [],
  namedTables: [
    'Delivered Capability Map',
    'Known Limitations and Accepted Risks',
    'Deviations From Intent / Plan',
  ],
  namedItems: [],
};
