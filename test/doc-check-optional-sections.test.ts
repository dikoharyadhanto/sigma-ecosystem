import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import { validIntentDoc, validPlanDoc, validExecDoc } from './helpers';

// Coverage for docCheck.ts's "known but not required" section support (Fase 4
// of the RATIFIED/Amendment plan) — AMENDMENT_HISTORY (DIR-INTENT Section 14)
// must never block check/ratify when absent (legacy docs), never warn as
// "unknown" when present, and still be order-checked when present.
//
// PLAN-IMPL-MULTIDRAFT-LOCK §9.3/§13.2 (Director directive 2026-08-12) —
// the same three-way coverage extended to FMN-PLAN's PRE_REQUIREMENT and
// DEV-EXEC's TECHNICAL_RESEARCH, added by this plan's Fase 7 using the
// identical optionalSections + sectionOrder mechanism.

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

const PRE_REQUIREMENT_BLOCK = [
  '',
  '<!-- SIGMA:FMN_PLAN:SECTION:PRE_REQUIREMENT -->',
  '## 2. Pre-requirement',
  '',
  'No prerequisites for this plan.',
].join('\n');

describe('docCheck — PRE_REQUIREMENT (FMN-PLAN) as a known-but-optional section', () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    while (tempPaths.length > 0) {
      const target = tempPaths.pop();
      if (target) fs.removeSync(target);
    }
  });

  function writeTempPlanDoc(content: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-plan-doc-'));
    tempPaths.push(tempDir);
    const filePath = path.join(tempDir, 'FMN-PLAN-v1.md');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it('a document without Pre-requirement is still ok — no missing-required error, no unknown-marker warning', () => {
    const filePath = writeTempPlanDoc(validPlanDoc('v1'));

    const report = validateSigmaDocFile(filePath, 'plan');

    expect(report.ok).toBe(true);
    expect(report.errors.filter(e => e.includes('PRE_REQUIREMENT'))).toHaveLength(0);
    expect(report.warnings.filter(w => w.includes('PRE_REQUIREMENT'))).toHaveLength(0);
  });

  it('a document with Pre-requirement present right after Source Alignment is ok and order-valid', () => {
    const original = validPlanDoc('v1');
    const marker = '<!-- SIGMA:FMN_PLAN:SECTION:WORK_ORDER_TASK_PLAN -->';
    const insertAt = original.indexOf(marker);
    expect(insertAt).toBeGreaterThan(-1);
    const withPreRequirement = original.slice(0, insertAt) + PRE_REQUIREMENT_BLOCK + '\n\n' + original.slice(insertAt);
    const filePath = writeTempPlanDoc(withPreRequirement);

    const report = validateSigmaDocFile(filePath, 'plan');

    expect(report.ok).toBe(true);
    expect(report.warnings.some(w => w.includes('Unknown section markers') && w.includes('PRE_REQUIREMENT'))).toBe(false);
    expect(report.passes).toContain('Section order valid');
  });

  it('Pre-requirement out of order (after Directors Summary) is reported as invalid order', () => {
    const outOfOrder = validPlanDoc('v1') + PRE_REQUIREMENT_BLOCK;
    const filePath = writeTempPlanDoc(outOfOrder);

    const report = validateSigmaDocFile(filePath, 'plan');

    expect(report.errors).toContain('Section order invalid');
  });
});

const TECHNICAL_RESEARCH_BLOCK = [
  '',
  '<!-- SIGMA:DEV_EXEC:SECTION:TECHNICAL_RESEARCH -->',
  '## 3. Technical Research',
  '',
  '### 3.1 Status',
  '',
  '- [x] NOT_NEEDED',
  '',
  'Existing knowledge is sufficient.',
].join('\n');

describe('docCheck — TECHNICAL_RESEARCH (DEV-EXEC) as a known-but-optional section', () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    while (tempPaths.length > 0) {
      const target = tempPaths.pop();
      if (target) fs.removeSync(target);
    }
  });

  function writeTempExecDoc(content: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-exec-doc-'));
    tempPaths.push(tempDir);
    const filePath = path.join(tempDir, 'DEV-EXEC-v1.md');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  it('a document without Technical Research is still ok — no missing-required error, no unknown-marker warning', () => {
    const filePath = writeTempExecDoc(validExecDoc('v1', 'v1'));

    const report = validateSigmaDocFile(filePath, 'exec');

    expect(report.ok).toBe(true);
    expect(report.errors.filter(e => e.includes('TECHNICAL_RESEARCH'))).toHaveLength(0);
    expect(report.warnings.filter(w => w.includes('TECHNICAL_RESEARCH'))).toHaveLength(0);
  });

  it('a document with Technical Research present right after DEV Pre-Build Assessment is ok and order-valid', () => {
    const original = validExecDoc('v1', 'v1');
    const marker = '<!-- SIGMA:DEV_EXEC:SECTION:IMPLEMENTATION_APPROACH -->';
    const insertAt = original.indexOf(marker);
    expect(insertAt).toBeGreaterThan(-1);
    const withTechnicalResearch = original.slice(0, insertAt) + TECHNICAL_RESEARCH_BLOCK + '\n\n' + original.slice(insertAt);
    const filePath = writeTempExecDoc(withTechnicalResearch);

    const report = validateSigmaDocFile(filePath, 'exec');

    expect(report.ok).toBe(true);
    expect(report.warnings.some(w => w.includes('Unknown section markers') && w.includes('TECHNICAL_RESEARCH'))).toBe(false);
    expect(report.passes).toContain('Section order valid');
  });

  it('Technical Research out of order (after Directors Summary) is reported as invalid order', () => {
    const outOfOrder = validExecDoc('v1', 'v1') + TECHNICAL_RESEARCH_BLOCK;
    const filePath = writeTempExecDoc(outOfOrder);

    const report = validateSigmaDocFile(filePath, 'exec');

    expect(report.errors).toContain('Section order invalid');
  });
});
