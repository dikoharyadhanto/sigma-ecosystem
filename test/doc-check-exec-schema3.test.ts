import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import { validExecDoc, validExecDocV3 } from './helpers';

// DEV_EXEC schema 3 (E03): the validator picks the specification from the
// document's schema marker. Schema 3 drops the numbered layout and merges the
// build sections; earlier schemas must keep validating unchanged.

const TEMPLATE_V3 = path.resolve(__dirname, '..', 'Sigma', 'templates', 'DEV-EXEC-TEMPLATE.md');

const TECHNICAL_RESEARCH_BLOCK = [
  '<!-- SIGMA:DEV_EXEC:SECTION:TECHNICAL_RESEARCH -->',
  '## Technical Research',
  '',
  'Existing knowledge is sufficient.',
  '',
].join('\n');

const PRE_BUILD_MARKER = '<!-- SIGMA:DEV_EXEC:SECTION:FMN_PRE_BUILD_REVIEW -->';

describe('docCheck - DEV_EXEC schema selection', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) fs.removeSync(dir);
    }
  });

  function check(content: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-exec-v3-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'DEV-EXEC-v1.md');
    fs.writeFileSync(filePath, content);
    return validateSigmaDocFile(filePath, 'exec');
  }

  function unsatisfied(report: ReturnType<typeof check>): string[] {
    return report.requirements.filter(r => !r.satisfied).map(r => r.label);
  }

  describe('schema 3', () => {
    it('a filled document is structurally ok with every requirement satisfied and no warnings', () => {
      const report = check(validExecDocV3('v1', 'v1'));

      expect(report.schema).toBe('3');
      expect(report.errors).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(unsatisfied(report)).toEqual([]);
      expect(report.requirements.map(r => r.label)).toEqual([
        'FMN Post-Build Advisory Verdict recorded (exactly one)',
        'Director Summary is stated',
      ]);
    });

    it('the bundled template is structurally valid but not ready to lock', () => {
      const report = validateSigmaDocFile(TEMPLATE_V3, 'exec');

      expect(report.schema).toBe('3');
      expect(report.errors).toEqual([]);
      expect(unsatisfied(report)).toEqual([
        'FMN Post-Build Advisory Verdict recorded (exactly one)',
        'Director Summary is stated',
      ]);
    });

    it('a missing required section is an error', () => {
      const withoutPreBuild = validExecDocV3('v1', 'v1').replace(
        /<!-- SIGMA:DEV_EXEC:SECTION:FMN_PRE_BUILD_REVIEW -->\n## FMN Pre-Build Review\n\nTest pre-build review\.\n\n/,
        '',
      );
      expect(withoutPreBuild).not.toContain('SECTION:FMN_PRE_BUILD_REVIEW');

      const report = check(withoutPreBuild);

      expect(report.ok).toBe(false);
      expect(report.errors).toContain('Missing required section marker: FMN_PRE_BUILD_REVIEW');
    });

    it('a schema 2 section id in a schema 3 document is not recognised', () => {
      const report = check(
        validExecDocV3('v1', 'v1') + '\n<!-- SIGMA:DEV_EXEC:SECTION:IMPLEMENTATION_WALKTHROUGH -->\n## Implementation Walkthrough\n',
      );

      expect(report.warnings.some(w => w.includes('Unknown section markers') && w.includes('IMPLEMENTATION_WALKTHROUGH'))).toBe(true);
    });

    describe('optional sections', () => {
      it('Technical Research between Implementation Plan and FMN Pre-Build Review is ok and order-valid', () => {
        const content = validExecDocV3('v1', 'v1').replace(PRE_BUILD_MARKER, TECHNICAL_RESEARCH_BLOCK + PRE_BUILD_MARKER);

        const report = check(content);

        expect(report.ok).toBe(true);
        expect(report.warnings.some(w => w.includes('Unknown section markers'))).toBe(false);
        expect(report.passes).toContain('Section order valid');
      });

      it('Technical Research after the last section is reported as invalid order', () => {
        const report = check(validExecDocV3('v1', 'v1') + '\n' + TECHNICAL_RESEARCH_BLOCK);

        expect(report.errors).toContain('Section order invalid');
      });
    });

    describe('lock requirements', () => {
      it('an unfilled Summary leaves only the summary requirement unsatisfied', () => {
        const content = validExecDocV3('v1', 'v1').replace('Test summary.', '[...]');

        expect(unsatisfied(check(content))).toEqual(['Director Summary is stated']);
      });

      it('no verdict ticked leaves the verdict requirement unsatisfied', () => {
        const content = validExecDocV3('v1', 'v1').replace('- [x] READY_FOR_LOCK', '- [ ] READY_FOR_LOCK');

        expect(unsatisfied(check(content))).toEqual(['FMN Post-Build Advisory Verdict recorded (exactly one)']);
      });

      it('the verdict that is ticked does not affect the requirement', () => {
        const content = validExecDocV3('v1', 'v1', 'REVISION_REQUIRED');

        expect(unsatisfied(check(content))).toEqual([]);
      });
    });

    describe('advisory warnings', () => {
      it('a plan section that does not name the PLAN version warns but does not block', () => {
        const content = validExecDocV3('v1', 'v1').replace('| PLAN version | PLAN-v1 |', '| PLAN version | latest |');

        const report = check(content);

        expect(unsatisfied(report)).toEqual([]);
        expect(report.warnings).toContain('Implementation Plan: PLAN version not named');
      });

      it('a leftover placeholder in a required section warns but does not block', () => {
        const content = validExecDocV3('v1', 'v1').replace('Test build result.', 'Test build result. [...]');

        const report = check(content);

        expect(unsatisfied(report)).toEqual([]);
        expect(report.warnings).toContain('Placeholder [...] remains in: BUILD_RESULT_AND_VERIFICATION');
      });

      it('a placeholder in Technical Research is not reported because the section is optional', () => {
        const block = TECHNICAL_RESEARCH_BLOCK.replace('Existing knowledge is sufficient.', '[...]');
        const content = validExecDocV3('v1', 'v1').replace(PRE_BUILD_MARKER, block + PRE_BUILD_MARKER);

        expect(check(content).warnings).toEqual([]);
      });
    });
  });

  describe('schema 2 and earlier keep their original specification', () => {
    it('a schema 1 document still validates against the original 17 sections', () => {
      const report = check(validExecDoc('v1', 'v1'));

      expect(report.schema).toBe('1');
      expect(report.ok).toBe(true);
      expect(report.passes).toContain('Required section markers complete');
      expect(report.requirements.some(r => r.label === 'Director Summary is stated')).toBe(false);
    });

    it('a schema 2 marker on a schema 3 layout fails against the original specification', () => {
      const report = check(validExecDocV3('v1', 'v1').replace('schema=3', 'schema=2'));

      expect(report.ok).toBe(false);
      expect(report.errors).toContain('Missing required section marker: SOURCE_PLAN_ALIGNMENT');
    });

    it('a document with an unparsable schema falls back to the original specification', () => {
      const report = check(validExecDocV3('v1', 'v1').replace('schema=3', 'schema=next'));

      expect(report.errors).toContain('Missing required section marker: SOURCE_PLAN_ALIGNMENT');
    });
  });
});
