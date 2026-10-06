import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import { validIntentDoc, validIntentDocV5 } from './helpers';

// DIR_INTENT schema 5 (E01): the validator picks the specification from the
// document's schema marker. Schema 5 drops the numbered layout and the Final
// Validation Checklist; earlier schemas must keep validating unchanged.

const TEMPLATE_V5 = path.resolve(__dirname, '..', 'Sigma', 'templates', 'DIR-INTENT-TEMPLATE.md');
const TEMPLATE_V4_SNAPSHOT = path.resolve(__dirname, 'fixtures', 'DIR-INTENT-TEMPLATE-schema4.md');

const AMENDMENT_BLOCK = [
  '',
  '<!-- SIGMA:DIR_INTENT:SECTION:AMENDMENT_HISTORY -->',
  '## Amendment History',
  '',
  '<!-- SIGMA:RENDER:START:amendment-history -->',
  '<!-- SIGMA:RENDER:END:amendment-history -->',
].join('\n');

const RESEARCH_BLOCK = [
  '<!-- SIGMA:DIR_INTENT:SECTION:RESEARCH -->',
  '## Research',
  '',
  'Test research.',
  '',
].join('\n');

describe('docCheck — DIR_INTENT schema selection', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) fs.removeSync(dir);
    }
  });

  function write(content: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-intent-v5-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'DIR-INTENT-v1.md');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  function check(content: string) {
    return validateSigmaDocFile(write(content), 'intent');
  }

  function unsatisfied(report: ReturnType<typeof check>): string[] {
    return report.requirements.filter(r => !r.satisfied).map(r => r.label);
  }

  describe('schema 5', () => {
    it('a filled document is structurally ok with every requirement satisfied and no warnings', () => {
      const report = check(validIntentDocV5('v1'));

      expect(report.schema).toBe('5');
      expect(report.errors).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(unsatisfied(report)).toEqual([]);
      expect(report.requirements.map(r => r.label)).toEqual(expect.arrayContaining([
        'Director Summary is stated',
        'Director Summary boundary examples stated (included and excluded)',
        'Quality Standards — Security minimum standard stated or N/A',
        'Quality Standards — UX Trust minimum standard stated or N/A',
        'Quality Standards — UI / Product Packaging minimum standard stated or N/A',
        'Quality Standards — Performance / Cost minimum standard stated or N/A',
        'AUD Advisory Verdict recorded (exactly one)',
      ]));
    });

    it('does not apply the schema 4 Final Validation Checklist requirements', () => {
      const report = check(validIntentDocV5('v1'));

      expect(report.requirements.some(r => r.label.includes('Intent Core is clear'))).toBe(false);
      expect(report.requirements).toHaveLength(7);
    });

    it('the bundled template is structurally valid but not ready to ratify', () => {
      const report = validateSigmaDocFile(TEMPLATE_V5, 'intent');

      expect(report.errors).toEqual([]);
      expect(unsatisfied(report)).toEqual(expect.arrayContaining([
        'Director Summary is stated',
        'Director Summary boundary examples stated (included and excluded)',
        'Quality Standards — Security minimum standard stated or N/A',
        'Quality Standards — UX Trust minimum standard stated or N/A',
        'Quality Standards — UI / Product Packaging minimum standard stated or N/A',
        'Quality Standards — Performance / Cost minimum standard stated or N/A',
        'AUD Advisory Verdict recorded (exactly one)',
      ]));
    });

    it('a missing required section is an error', () => {
      const withoutScope = validIntentDocV5('v1').replace(
        /<!-- SIGMA:DIR_INTENT:SECTION:SCOPE -->\n## Scope\n\nTest scope\.\n\n/,
        '',
      );
      expect(withoutScope).not.toContain('SECTION:SCOPE');

      const report = check(withoutScope);

      expect(report.ok).toBe(false);
      expect(report.errors).toContain('Missing required section marker: SCOPE');
    });

    it('a schema 4 section id in a schema 5 document is not recognised', () => {
      const report = check(validIntentDocV5('v1') + '\n<!-- SIGMA:DIR_INTENT:SECTION:FINAL_VALIDATION_CHECKLIST -->\n## Final Validation Checklist\n');

      expect(report.warnings.some(w => w.includes('Unknown section markers') && w.includes('FINAL_VALIDATION_CHECKLIST'))).toBe(true);
    });

    describe('optional sections', () => {
      it('Amendment History at the end is ok and not flagged as unknown', () => {
        const report = check(validIntentDocV5('v1') + AMENDMENT_BLOCK);

        expect(report.ok).toBe(true);
        expect(report.warnings.some(w => w.includes('Unknown section markers'))).toBe(false);
        expect(report.passes).toContain('Section order valid');
      });

      it('Research between Guidance for FMN and AUD Notes is ok and order-valid', () => {
        const marker = '<!-- SIGMA:DIR_INTENT:SECTION:AUD_NOTES -->';
        const original = validIntentDocV5('v1');
        const content = original.replace(marker, RESEARCH_BLOCK + marker);

        const report = check(content);

        expect(report.ok).toBe(true);
        expect(report.warnings.some(w => w.includes('Unknown section markers'))).toBe(false);
        expect(report.passes).toContain('Section order valid');
      });

      it('Research after AUD Notes is reported as invalid order', () => {
        const report = check(validIntentDocV5('v1') + '\n' + RESEARCH_BLOCK);

        expect(report.errors).toContain('Section order invalid');
      });

      it('Amendment History before AUD Notes is reported as invalid order', () => {
        const marker = '<!-- SIGMA:DIR_INTENT:SECTION:AUD_NOTES -->';
        const content = validIntentDocV5('v1').replace(marker, AMENDMENT_BLOCK.trimStart() + '\n\n' + marker);

        const report = check(content);

        expect(report.errors).toContain('Section order invalid');
      });
    });

    describe('Director Summary requirements', () => {
      it('an unfilled Summary leaves the summary requirement unsatisfied', () => {
        const content = validIntentDocV5('v1').replace('Test summary.', '[...]');

        expect(unsatisfied(check(content))).toEqual(['Director Summary is stated']);
      });

      it('missing excluded scenarios leave the boundary requirement unsatisfied', () => {
        const content = validIntentDocV5('v1')
          .replace(/- Excluded one\.\n- Excluded two\.\n- Excluded three\./, '- [Scenario 1]\n- [Scenario 2]');

        expect(unsatisfied(check(content))).toEqual([
          'Director Summary boundary examples stated (included and excluded)',
        ]);
      });

      it('a count other than 3 and 3 warns but does not block', () => {
        const content = validIntentDocV5('v1').replace('- Included three.\n', '');

        const report = check(content);

        expect(unsatisfied(report)).toEqual([]);
        expect(report.warnings).toContain(
          'Director Summary: 3 included and 3 excluded scenarios expected (found 2 and 3)',
        );
      });
    });

    describe('Quality Standards requirements', () => {
      it('an unfilled dimension leaves only that dimension unsatisfied', () => {
        const content = validIntentDocV5('v1').replace('| UX Trust | N/A |', '| UX Trust | [...] |');

        expect(unsatisfied(check(content))).toEqual([
          'Quality Standards — UX Trust minimum standard stated or N/A',
        ]);
      });

      it('an absent dimension row is unsatisfied', () => {
        const content = validIntentDocV5('v1').replace(/\| Performance \/ Cost \|[^\n]*\n/, '');

        expect(unsatisfied(check(content))).toEqual([
          'Quality Standards — Performance / Cost minimum standard stated or N/A',
        ]);
      });
    });

    describe('AUD verdict', () => {
      it('no verdict ticked leaves the verdict requirement unsatisfied', () => {
        const content = validIntentDocV5('v1').replace('- [x] PASS', '- [ ] PASS');

        expect(unsatisfied(check(content))).toEqual(['AUD Advisory Verdict recorded (exactly one)']);
      });

      it('SKIP_FOR_AUDIT requires the verbatim Director instruction', () => {
        const skipped = validIntentDocV5('v1').replace(
          '- [x] PASS\n- [ ] REVISE\n',
          '- [x] SKIP_FOR_AUDIT\n\n**Director Instruction (verbatim)**: [...]\n',
        );
        expect(unsatisfied(check(skipped))).toEqual([
          'Director Instruction (verbatim) recorded for SKIP_FOR_AUDIT',
        ]);

        const recorded = skipped.replace('[...]', 'Skip the audit this cycle.');
        expect(unsatisfied(check(recorded))).toEqual([]);
      });
    });
  });

  describe('schema 4 and earlier keep their original specification', () => {
    it('the schema 4 template snapshot is validated against the original 13 sections', () => {
      const report = validateSigmaDocFile(TEMPLATE_V4_SNAPSHOT, 'intent');

      expect(report.schema).toBe('4');
      expect(report.errors).toEqual([]);
      expect(report.passes).toContain('Required section markers complete');
      expect(report.requirements.some(r => r.label === 'Intent Core is clear enough to guide execution.')).toBe(true);
      expect(report.requirements.some(r => r.label === 'Director Summary is stated')).toBe(false);
    });

    it('a schema 3 document still passes with the Final Validation Checklist requirements', () => {
      const report = check(validIntentDoc('v1'));

      expect(report.schema).toBe('3');
      expect(report.ok).toBe(true);
      expect(unsatisfied(report)).toEqual([]);
      expect(report.requirements.some(r => r.label === 'Intent Core is clear enough to guide execution.')).toBe(true);
    });

    it('a schema 4 marker on a schema 5 layout fails against the original specification', () => {
      const content = validIntentDocV5('v1').replace('schema=5', 'schema=4');

      const report = check(content);

      expect(report.ok).toBe(false);
      expect(report.errors).toContain('Missing required section marker: INTENT_CORE');
    });

    it('a document with an unparsable schema falls back to the original specification', () => {
      const content = validIntentDocV5('v1').replace('schema=5', 'schema=next');

      expect(check(content).errors).toContain('Missing required section marker: INTENT_CORE');
    });
  });
});
