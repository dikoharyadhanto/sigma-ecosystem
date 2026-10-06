import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import { validPlanDoc, validPlanDocV3 } from './helpers';

// FMN_PLAN schema 3 (E02): the validator picks the specification from the
// document's schema marker. Schema 3 drops the numbered layout and merges
// Acceptance Criteria with the Test Contract; earlier schemas must keep
// validating unchanged.

const TEMPLATE_V3 = path.resolve(__dirname, '..', 'Sigma', 'templates', 'FMN-PLAN-TEMPLATE.md');

const REQUIREMENT_BLOCK = [
  '<!-- SIGMA:FMN_PLAN:SECTION:REQUIREMENT -->',
  '## Requirement',
  '',
  '| No | Item | Role | Why Matters | Status |',
  '|:-- |:---- |:---- |:----------- |:------ |',
  '| 1 | src/a.ts | Input | Test reason. | AVAILABLE |',
  '',
].join('\n');

const CONTRACT_CHANGES_BLOCK = [
  '<!-- SIGMA:FMN_PLAN:SECTION:CONTRACT_CHANGES -->',
  '## Contract Changes',
  '',
  'None.',
  '',
].join('\n');

const AUD_MARKER = '<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->';

describe('docCheck - FMN_PLAN schema selection', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) fs.removeSync(dir);
    }
  });

  function check(content: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-plan-v3-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'FMN-PLAN-v1.md');
    fs.writeFileSync(filePath, content);
    return validateSigmaDocFile(filePath, 'plan');
  }

  function unsatisfied(report: ReturnType<typeof check>): string[] {
    return report.requirements.filter(r => !r.satisfied).map(r => r.label);
  }

  describe('schema 3', () => {
    it('a filled document is structurally ok with every requirement satisfied and no warnings', () => {
      const report = check(validPlanDocV3('v1'));

      expect(report.schema).toBe('3');
      expect(report.errors).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(unsatisfied(report)).toEqual([]);
      expect(report.requirements.map(r => r.label)).toEqual([
        'AUD Advisory Verdict recorded (exactly one)',
        'Director Summary is stated',
        'Source Alignment names the INTENT version',
      ]);
    });

    it('the bundled template is structurally valid but not ready to lock', () => {
      const report = validateSigmaDocFile(TEMPLATE_V3, 'plan');

      expect(report.schema).toBe('3');
      expect(report.errors).toEqual([]);
      expect(unsatisfied(report)).toEqual([
        'AUD Advisory Verdict recorded (exactly one)',
        'Director Summary is stated',
        'Source Alignment names the INTENT version',
      ]);
    });

    it('a missing required section is an error', () => {
      const withoutObjective = validPlanDocV3('v1').replace(
        /<!-- SIGMA:FMN_PLAN:SECTION:OBJECTIVE -->\n## Objective\n\nTest objective\.\n\n/,
        '',
      );
      expect(withoutObjective).not.toContain('SECTION:OBJECTIVE');

      const report = check(withoutObjective);

      expect(report.ok).toBe(false);
      expect(report.errors).toContain('Missing required section marker: OBJECTIVE');
    });

    it('a schema 2 section id in a schema 3 document is not recognised', () => {
      const report = check(validPlanDocV3('v1') + '\n<!-- SIGMA:FMN_PLAN:SECTION:PRE_BUILD_TEST_CONTRACT -->\n## Pre-Build Test Contract\n');

      expect(report.warnings.some(w => w.includes('Unknown section markers') && w.includes('PRE_BUILD_TEST_CONTRACT'))).toBe(true);
    });

    describe('optional sections', () => {
      it('Requirement between Objective and Key Output is ok and order-valid', () => {
        const marker = '<!-- SIGMA:FMN_PLAN:SECTION:KEY_OUTPUT -->';
        const content = validPlanDocV3('v1').replace(marker, REQUIREMENT_BLOCK + marker);

        const report = check(content);

        expect(report.ok).toBe(true);
        expect(report.warnings.some(w => w.includes('Unknown section markers'))).toBe(false);
        expect(report.passes).toContain('Section order valid');
      });

      it('Contract Changes before AUD Notes is ok and order-valid', () => {
        const content = validPlanDocV3('v1').replace(AUD_MARKER, CONTRACT_CHANGES_BLOCK + AUD_MARKER);

        const report = check(content);

        expect(report.ok).toBe(true);
        expect(report.warnings.some(w => w.includes('Unknown section markers'))).toBe(false);
        expect(report.passes).toContain('Section order valid');
      });

      it('Contract Changes after AUD Notes is reported as invalid order', () => {
        const report = check(validPlanDocV3('v1') + '\n' + CONTRACT_CHANGES_BLOCK);

        expect(report.errors).toContain('Section order invalid');
      });
    });

    describe('lock requirements', () => {
      it('an unfilled Summary leaves only the summary requirement unsatisfied', () => {
        const content = validPlanDocV3('v1').replace('Test summary.', '[...]');

        expect(unsatisfied(check(content))).toEqual(['Director Summary is stated']);
      });

      it('a Source Alignment without an INTENT version leaves only that requirement unsatisfied', () => {
        const content = validPlanDocV3('v1').replace('- Intent version: INTENT-v1', '- Intent version: INTENT-v{X}');

        expect(unsatisfied(check(content))).toEqual(['Source Alignment names the INTENT version']);
      });

      it('no verdict ticked leaves the verdict requirement unsatisfied', () => {
        const content = validPlanDocV3('v1').replace('- [x] PASS', '- [ ] PASS');

        expect(unsatisfied(check(content))).toEqual(['AUD Advisory Verdict recorded (exactly one)']);
      });

      it('SKIP_FOR_AUDIT requires the verbatim Director instruction', () => {
        const skipped = validPlanDocV3('v1').replace(
          '- [x] PASS\n- [ ] REVISE\n',
          '- [x] SKIP_FOR_AUDIT\n\n**Director Instruction (verbatim)**: [...]\n',
        );
        expect(unsatisfied(check(skipped))).toEqual([
          'Director Instruction (verbatim) recorded for SKIP_FOR_AUDIT',
        ]);

        const recorded = skipped.replace('(verbatim)**: [...]', '(verbatim)**: Skip the audit this cycle.');
        expect(unsatisfied(check(recorded))).toEqual([]);
      });
    });

    describe('advisory warnings', () => {
      it('an AC without Test Method or Expected Result warns but does not block', () => {
        const content = validPlanDocV3('v1').replace('| Test method. | Test result. |', '| [...] | [...] |');

        const report = check(content);

        expect(unsatisfied(report)).toEqual([]);
        expect(report.warnings).toContain(
          'Acceptance Criteria and Test Contract: no Test Method or Expected Result for AC-001',
        );
      });

      it('a Key Output table with more than 5 rows warns but does not block', () => {
        const extraRows = [2, 3, 4, 5, 6]
          .map(n => `| ${n} | Output ${n} | Creation | Test. | out/${n} |`)
          .join('\n');
        const content = validPlanDocV3('v1').replace(
          '| 1 | No file output | Creation | Behavior change only. | N/A |',
          `| 1 | No file output | Creation | Behavior change only. | N/A |\n${extraRows}`,
        );

        const report = check(content);

        expect(report.ok).toBe(true);
        expect(unsatisfied(report)).toEqual([]);
        expect(report.warnings).toContain('Key Output: 6 rows; 5 or fewer expected (key items only)');
      });

      it('a Requirement table with more than 5 rows warns but does not block', () => {
        const rows = [1, 2, 3, 4, 5, 6]
          .map(n => `| ${n} | src/${n}.ts | Input | Test reason. | AVAILABLE |`)
          .join('\n');
        const block = REQUIREMENT_BLOCK.replace('| 1 | src/a.ts | Input | Test reason. | AVAILABLE |', rows);
        const marker = '<!-- SIGMA:FMN_PLAN:SECTION:KEY_OUTPUT -->';

        const report = check(validPlanDocV3('v1').replace(marker, block + marker));

        expect(report.ok).toBe(true);
        expect(report.warnings).toContain('Requirement: 6 rows; 5 or fewer expected (key items only)');
      });
    });
  });

  describe('schema 2 and earlier keep their original specification', () => {
    it('a schema 1 document still validates against the original 9 sections', () => {
      const report = check(validPlanDoc('v1'));

      expect(report.schema).toBe('1');
      expect(report.ok).toBe(true);
      expect(report.passes).toContain('Required section markers complete');
      expect(report.requirements.some(r => r.label === 'Director Summary is stated')).toBe(false);
    });

    it('a schema 2 marker on a schema 3 layout fails against the original specification', () => {
      const report = check(validPlanDocV3('v1').replace('schema=3', 'schema=2'));

      expect(report.ok).toBe(false);
      expect(report.errors).toContain('Missing required section marker: WORK_ORDER_TASK_PLAN');
    });

    it('a document with an unparsable schema falls back to the original specification', () => {
      const report = check(validPlanDocV3('v1').replace('schema=3', 'schema=next'));

      expect(report.errors).toContain('Missing required section marker: WORK_ORDER_TASK_PLAN');
    });
  });
});
