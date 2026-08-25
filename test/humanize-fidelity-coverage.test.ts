import { describe, it, expect } from 'vitest';
import {
  checkFidelityCoverage,
  DIR_INTENT_COVERAGE_CONFIG,
  PLAN_EXEC_COVERAGE_CONFIG,
  DIR_CLOSE_COVERAGE_CONFIG,
} from '../src/engine/fidelityCoverage';

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.3 (CR-02, CR-05) / §7.4, Fase 5c.

describe('checkFidelityCoverage() — ID-based mode', () => {
  it('flags a source ID never mentioned in the Ledger', () => {
    const source = '| ID | Statement |\n| CON-001 | ... |\n| CON-007 | IDCloudHost mandatory, GCP prohibited |';
    const ledger = '| Source Reference | Classification |\n| CON-001 | Preserve |'; // CON-007 missing

    const gaps = checkFidelityCoverage(source, ledger, DIR_INTENT_COVERAGE_CONFIG);

    expect(gaps).toContainEqual(
      expect.objectContaining({ kind: 'id', identifier: 'CON-007' })
    );
    expect(gaps.find(g => g.identifier === 'CON-001')).toBeUndefined();
  });

  it('passes when every source ID is referenced in the Ledger, any classification', () => {
    const source = '| CON-001 | ... |\n| RR-002 | ... |';
    const ledger = 'CON-001: Preserve, verbatim quote here.\nRR-002: Omit — not human-facing.';

    expect(checkFidelityCoverage(source, ledger, DIR_INTENT_COVERAGE_CONFIG).filter(g => g.kind === 'id')).toEqual([]);
  });

  it('does not confuse Functional Requirements REQ-* with DEV-EXEC Minor Requests REQ-* (separate configs)', () => {
    const source = '### REQ-007 — Export report\n**Tier**: Sovereign';
    const ledgerMissing = 'The ledger says nothing relevant to this requirement.';

    const gaps = checkFidelityCoverage(source, ledgerMissing, DIR_INTENT_COVERAGE_CONFIG);
    expect(gaps.some(g => g.identifier === 'REQ-007')).toBe(true);
  });
});

describe('checkFidelityCoverage() — Quality Bar named items (DIR-INTENT)', () => {
  it('flags a Quality Bar dimension never mentioned in the Ledger', () => {
    const source = '| Dimension |\n| Security |\n| UX Trust |\n| UI / Product Packaging |\n| Performance / Cost |';
    const ledger = 'Security: Preserve.\nUX Trust: Preserve.\nUI / Product Packaging: Omit.';
    // Performance / Cost never mentioned.

    const gaps = checkFidelityCoverage(source, ledger, DIR_INTENT_COVERAGE_CONFIG);

    expect(gaps).toContainEqual(
      expect.objectContaining({ kind: 'named-item', identifier: 'Performance / Cost' })
    );
  });

  it('passes when all four dimensions are mentioned, even if some are Omit', () => {
    const ledger = [
      'Security: Preserve.',
      'UX Trust: Omit — internal only.',
      'UI / Product Packaging: Omit — internal only.',
      'Performance / Cost: Preserve.',
    ].join('\n');

    const gaps = checkFidelityCoverage('irrelevant source', ledger, DIR_INTENT_COVERAGE_CONFIG);
    expect(gaps.filter(g => g.kind === 'named-item')).toEqual([]);
  });
});

describe('checkFidelityCoverage() — row-count reconciliation mode (un-ID\'d tables)', () => {
  it('flags a mismatch between source table row count and Ledger references', () => {
    const source = [
      '## Known Limitations and Accepted Risks',
      '',
      '| Limitation | Impact |',
      '| :--- | :--- |',
      '| Exports over 50k rows time out | Medium |',
      '| Button hard to find on mobile | Low |',
    ].join('\n');
    const ledger = 'Known Limitations #1: Preserve.'; // only one of two rows referenced

    const gaps = checkFidelityCoverage(source, ledger, DIR_CLOSE_COVERAGE_CONFIG);

    expect(gaps).toContainEqual(
      expect.objectContaining({
        kind: 'table-row-count',
        identifier: 'Known Limitations and Accepted Risks',
        detail: expect.stringContaining('source has 2'),
      })
    );
  });

  it('passes when row counts match', () => {
    const source = [
      '## Known Limitations and Accepted Risks',
      '',
      '| Limitation | Impact |',
      '| :--- | :--- |',
      '| Exports over 50k rows time out | Medium |',
    ].join('\n');
    const ledger = 'Known Limitations and Accepted Risks #1: Preserve.';

    const gaps = checkFidelityCoverage(source, ledger, DIR_CLOSE_COVERAGE_CONFIG);
    expect(gaps.filter(g => g.kind === 'table-row-count' && g.identifier === 'Known Limitations and Accepted Risks')).toEqual([]);
  });

  it('treats an absent source table as zero rows, not a parse error — this is DIR-CLOSE\'s actual shape: zero ID tables anywhere', () => {
    const source = 'A document with no such table at all.';
    const ledger = 'nothing relevant';

    // Zero rows in source, zero references in Ledger — counts match, no gap.
    const gaps = checkFidelityCoverage(source, ledger, DIR_CLOSE_COVERAGE_CONFIG);
    expect(gaps).toEqual([]);
  });

  it('does not vacuously pass when the source table has rows but the heading is entirely missing from a differently-worded source', () => {
    // Guards the exact failure mode the audit found: a coverage box that
    // looks satisfied without anything having been checked. Here the table
    // genuinely has rows and the Ledger genuinely has zero references — the
    // mismatch must be caught, not silently treated as "nothing to check".
    const source = [
      '## Deviations From Intent / Plan',
      '',
      '| Deviation | Source |',
      '| :--- | :--- |',
      '| Scope narrowed mid-build | FMN-PLAN |',
    ].join('\n');
    const ledger = 'No mention of deviations at all.';

    const gaps = checkFidelityCoverage(source, ledger, DIR_CLOSE_COVERAGE_CONFIG);
    expect(gaps).toContainEqual(
      expect.objectContaining({ kind: 'table-row-count', identifier: 'Deviations From Intent / Plan' })
    );
  });
});

describe('checkFidelityCoverage() — PLAN-EXEC config (mixed ID + un-ID\'d table)', () => {
  it('covers TASK-*/AC-*/TC-*/OBS-* by ID and Implementation Constraints by row count', () => {
    const source = [
      '### TASK-001',
      '### AC-001',
      '## Implementation Constraints',
      '',
      '| Constraint | Reason |',
      '| :--- | :--- |',
      '| Must use existing filter layer | Reuse |',
    ].join('\n');
    const ledger = 'TASK-001: Preserve.'; // AC-001 missing, Implementation Constraints row never referenced

    const gaps = checkFidelityCoverage(source, ledger, PLAN_EXEC_COVERAGE_CONFIG);

    expect(gaps.some(g => g.kind === 'id' && g.identifier === 'AC-001')).toBe(true);
    expect(gaps.some(g => g.kind === 'table-row-count' && g.identifier === 'Implementation Constraints')).toBe(true);
    expect(gaps.some(g => g.identifier === 'TASK-001')).toBe(false);
  });
});
