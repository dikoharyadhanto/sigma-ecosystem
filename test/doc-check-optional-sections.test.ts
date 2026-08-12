import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import { validIntentDoc } from './helpers';

// Coverage for docCheck.ts's "known but not required" section support (Fase 4
// of the RATIFIED/Amendment plan) — AMENDMENT_HISTORY (DIR-INTENT Section 14)
// must never block check/ratify when absent (legacy docs), never warn as
// "unknown" when present, and still be order-checked when present.

const SECTION_14_BLOCK = [
  '',
  '<!-- SIGMA:DIR_INTENT:SECTION:AMENDMENT_HISTORY -->',
  '## 14. Amendment History',
  '',
  '<!-- SIGMA:RENDER:START:amendment-history -->',
  '| Amendment | Date | Change |',
  '| :--- | :--- | :--- |',
  '<!-- SIGMA:RENDER:END:amendment-history -->',
].join('\n');

describe('docCheck — AMENDMENT_HISTORY as a known-but-optional section', () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    while (tempPaths.length > 0) {
      const target = tempPaths.pop();
      if (target) fs.removeSync(target);
    }
  });

  function writeTempIntentDoc(content: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-intent-doc-'));
    tempPaths.push(tempDir);
    const filePath = path.join(tempDir, 'DIR-INTENT-v1.md');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it('a document without Section 14 is still ok — no missing-required error, no unknown-marker warning', () => {
    const filePath = writeTempIntentDoc(validIntentDoc('v1'));

    const report = validateSigmaDocFile(filePath, 'intent');

    expect(report.ok).toBe(true);
    expect(report.errors.filter(e => e.includes('AMENDMENT_HISTORY'))).toHaveLength(0);
    expect(report.warnings.filter(w => w.includes('AMENDMENT_HISTORY'))).toHaveLength(0);
  });

  it('a document with Section 14 present at the end is ok and not flagged as an unknown section marker', () => {
    const filePath = writeTempIntentDoc(validIntentDoc('v1') + SECTION_14_BLOCK);

    const report = validateSigmaDocFile(filePath, 'intent');

    expect(report.ok).toBe(true);
    expect(report.warnings.some(w => w.includes('Unknown section markers') && w.includes('AMENDMENT_HISTORY'))).toBe(false);
    expect(report.passes).toContain('Section order valid');
  });

  it('Section 14 out of order (before Final Validation Checklist) is reported as invalid order', () => {
    const original = validIntentDoc('v1');
    const marker = '<!-- SIGMA:DIR_INTENT:SECTION:FINAL_VALIDATION_CHECKLIST -->';
    const insertAt = original.indexOf(marker);
    expect(insertAt).toBeGreaterThan(-1);
    const outOfOrder = original.slice(0, insertAt) + SECTION_14_BLOCK + '\n\n' + original.slice(insertAt);
    const filePath = writeTempIntentDoc(outOfOrder);

    const report = validateSigmaDocFile(filePath, 'intent');

    expect(report.errors).toContain('Section order invalid');
  });
});
