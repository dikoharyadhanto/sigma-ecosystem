import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import { validPlanDocV3, validExecDocV3, validExecDocV4 } from './helpers';

const scheduleMarker = '<!-- SIGMA:FMN_PLAN:SECTION:CHECKPOINT_FOR_POST_BUILD_REVIEW -->';
const intermediateMarker = '<!-- SIGMA:DEV_EXEC:SECTION:INTERMEDIATE_POST_BUILD_REVIEWS -->';
const finalCheckpoint = (n: number) => `- Checkpoint ${n} (Final): After: all implementation and verification are complete; Focus: overall post-build review.`;
const custom = `- Checkpoint 1: After: TASK-001 is complete and verified; Focus: interfaces.\n${finalCheckpoint(2)}`;
function plan(count = '1', bullets = '') {
  return validPlanDocV3('v1').replace('schema=3', 'schema=4').replace(
    '<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_AND_TEST_CONTRACT -->',
    `${scheduleMarker}\n## Checkpoint for Post-Build Review\n\n**Total checkpoints:** ${count}\n\n${bullets}\n\n<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_AND_TEST_CONTRACT -->`,
  );
}
function exec() {
  return validExecDocV4('v1', 'v1').replace('schema=4', 'schema=5').replace(
    '<!-- SIGMA:DEV_EXEC:SECTION:FMN_POST_BUILD_REVIEW -->',
    `${intermediateMarker}\n## Intermediate Post-Build Reviews\n\n### Last Checkpoint Reviewed\n\nN/A\n\n### Content\n\nN/A\n\n<!-- SIGMA:DEV_EXEC:SECTION:FMN_POST_BUILD_REVIEW -->`,
  );
}
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.removeSync(dir); });
function check(content: string, domain: 'plan' | 'exec' = 'plan') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-review-checkpoints-'));
  dirs.push(dir);
  const file = path.join(dir, 'document.md');
  fs.writeFileSync(file, content);
  return validateSigmaDocFile(file, domain);
}
function scheduleIsComplete(content: string) {
  return check(content).requirements.find(r => r.label === 'Post-build review checkpoint contract is complete')?.satisfied;
}

describe('post-build checkpoint document contracts', () => {
  it('accepts the one-checkpoint default without a list and a complete custom schedule', () => {
    for (const content of [plan(), plan('1', finalCheckpoint(1)), plan('2', custom)]) {
      const report = check(content);
      expect(report.errors).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(report.requirements.every(r => r.satisfied)).toBe(true);
    }
  });

  it('accepts checkpoint descriptions in the configured document language', () => {
    const bullets = '- Checkpoint 1: After: TASK-001 selesai dan terverifikasi; Focus: antarmuka.\n- Checkpoint 2 (Final): After: seluruh implementasi dan verifikasi selesai; Focus: review keseluruhan hasil.';
    expect(scheduleIsComplete(plan('2', bullets))).toBe(true);
  });

  it.each(['0', '-1', '1.5', '[...]', 'two', '9007199254740992'])(
    'requires a positive integer total: %s', count => expect(scheduleIsComplete(plan(count))).toBe(false),
  );

  it.each([
    ['missing list', '2', ''],
    ['too few bullets', '2', finalCheckpoint(1)],
    ['duplicate number', '2', custom.replace('Checkpoint 2', 'Checkpoint 1')],
    ['out of order', '2', `${finalCheckpoint(2)}\n- Checkpoint 1: After: TASK-001; Focus: interfaces.`],
    ['missing focus', '2', custom.replace('Focus: interfaces.', '')],
    ['placeholder scope', '2', custom.replace('interfaces.', '[...]')],
    ['missing final marker', '2', custom.replace(' (Final)', '')],
    ['premature final marker', '2', custom.replace('Checkpoint 1:', 'Checkpoint 1 (Final):')],
    ['malformed checkpoint', '1', '- Checkpoint unknown: After: TASK-001; Focus: interfaces.'],
    ['extra default bullet', '1', custom],
  ])('rejects an incomplete schedule: %s', (_name, count, bullets) => {
    expect(scheduleIsComplete(plan(count, bullets))).toBe(false);
  });

  it('rejects duplicate count declarations and ignores quoted template examples', () => {
    expect(scheduleIsComplete(plan().replace('**Total checkpoints:** 1', '**Total checkpoints:** 1\n**Total checkpoints:** 2'))).toBe(false);
    expect(scheduleIsComplete(plan('2', custom + '\n> - Checkpoint 99: After: example; Focus: example.'))).toBe(true);
  });

  it('requires the new section only on PLAN schema 4 and validates its order', () => {
    const old = validPlanDocV3('v1');
    expect(check(old).errors).toEqual([]);
    expect(check(old.replace('schema=3', 'schema=4')).errors).toContain('Missing required section marker: CHECKPOINT_FOR_POST_BUILD_REVIEW');
    const block = `${scheduleMarker}\n## Checkpoint for Post-Build Review\n\n**Total checkpoints:** 1\n\n`;
    expect(check(plan().replace(block, '') + '\n' + block).errors).toContain('Section order invalid');
  });

  it('keeps EXEC schemas 3/4 valid and requires the intermediate section only from schema 5', () => {
    for (const old of [validExecDocV3('v1', 'v1'), validExecDocV4('v1', 'v1')]) expect(check(old, 'exec').errors).toEqual([]);
    expect(check(validExecDocV4('v1', 'v1').replace('schema=4', 'schema=5'), 'exec').errors).toContain('Missing required section marker: INTERMEDIATE_POST_BUILD_REVIEWS');
    expect(check(exec(), 'exec').errors).toEqual([]);
  });

  it('places the latest intermediate review immediately before the final review', () => {
    const content = exec();
    const start = content.indexOf(intermediateMarker);
    const end = content.indexOf('<!-- SIGMA:DEV_EXEC:SECTION:FMN_POST_BUILD_REVIEW -->');
    const block = content.slice(start, end);
    const moved = content.replace(block, '').replace(
      '<!-- SIGMA:DEV_EXEC:SECTION:BUILD_RESULT_AND_VERIFICATION -->',
      block + '<!-- SIGMA:DEV_EXEC:SECTION:BUILD_RESULT_AND_VERIFICATION -->',
    );
    expect(check(content, 'exec').errors).toEqual([]);
    expect(check(moved, 'exec').errors).toContain('Section order invalid');
  });

  it('does not count intermediate outcomes as the final overall verdict', () => {
    const content = exec().replace('### Content\n\nN/A', '### Content\n\nReview completed. Dependent work may continue.\n- [x] READY_FOR_APPROVAL')
      .replace('- [x] READY_FOR_LOCK', '- [ ] READY_FOR_LOCK');
    const report = check(content, 'exec');
    expect(report.requirements.find(r => r.label === 'FMN Post-Build Advisory Verdict recorded (exactly one)')?.satisfied).toBe(false);
  });
});
