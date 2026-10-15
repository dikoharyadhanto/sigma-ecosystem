import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
  makeChainWithDraftIntent,
  makeChainWithLockedExec,
  runCli,
  setupTestEnv,
  stubProjectRootAnchor,
  TestEnv,
  validCloseDoc,
  writeChainFixture,
  writeProductReview,
} from './helpers';
import { evaluateProductReview, validateSigmaDocFile } from '../src/utils/docCheck';

// PRODUCT REVIEW: three verdict blocks (ARC, AUD unless SKIP_FOR_AUDIT, Director)
// read by `sigma close new`. Only PASS and PASS_WITH_RISK are accepted.

describe('PRODUCT REVIEW verdicts', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  const setup = () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    return env;
  };

  it('accepts PASS from ARC, AUD, and the Director', () => {
    setup();
    const state = evaluateProductReview(writeProductReview(env));
    expect(state).toMatchObject({ arc: 'PASS', aud: 'PASS', director: 'PASS', audSkipped: false, accepted: true });
    expect(state.blockers).toEqual([]);
    expect(state.riskNotes).toEqual([]);
  });

  it('accepts PASS_WITH_RISK and lists the risks each party wrote', () => {
    setup();
    const state = evaluateProductReview(writeProductReview(env, {
      arc: 'PASS_WITH_RISK',
      risks: { arc: 'Load above 50 users was not verified.' },
      director: 'PASS_WITH_RISK',
    }));
    expect(state.accepted).toBe(true);
    expect(state.riskNotes).toEqual([
      { party: 'ARC', notes: ['Load above 50 users was not verified.'] },
      { party: 'Director', notes: [] },
    ]);
  });

  it.each(['REVISE', 'REJECT_RECOMMENDED'])('does not accept %s from any party', verdict => {
    setup();
    for (const party of ['arc', 'aud', 'director'] as const) {
      const state = evaluateProductReview(writeProductReview(env, { [party]: verdict }));
      expect(state.accepted, party).toBe(false);
      expect(state.blockers.join('\n')).toMatch(new RegExp(`verdict is ${verdict}`));
    }
  });

  it('does not accept the AUD verdict OTHER', () => {
    setup();
    const state = evaluateProductReview(writeProductReview(env, { aud: 'OTHER' }));
    expect(state.accepted).toBe(false);
    expect(state.blockers.join('\n')).toMatch(/AUD: verdict is OTHER/);
  });

  it('lets SKIP_FOR_AUDIT stand in for the AUD verdict when the Director instruction is recorded', () => {
    setup();
    const state = evaluateProductReview(writeProductReview(env, { aud: 'SKIP_FOR_AUDIT', skipInstruction: 'Skip it.' }));
    expect(state).toMatchObject({ audSkipped: true, accepted: true });
  });

  it('refuses SKIP_FOR_AUDIT without the verbatim instruction', () => {
    setup();
    const file = writeProductReview(env, { aud: 'SKIP_FOR_AUDIT' });
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Skip the audit.', '[...]'));
    const state = evaluateProductReview(file);
    expect(state.accepted).toBe(false);
    expect(state.blockers.join('\n')).toMatch(/SKIP_FOR_AUDIT is checked but "Director Instruction \(verbatim\)" is empty/);
  });

  it('requires the Director verdict to carry the Director instruction verbatim', () => {
    setup();
    const file = writeProductReview(env);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('Pass.', '[...]'));
    const state = evaluateProductReview(file);
    expect(state.accepted).toBe(false);
    expect(state.blockers.join('\n')).toMatch(/Director: "Director Instruction \(verbatim\)" is not recorded/);
  });

  it('reports a missing or doubled verdict', () => {
    setup();
    const file = writeProductReview(env);
    const text = fs.readFileSync(file, 'utf8');
    const arcStart = text.indexOf('SIGMA:PRODUCT_REVIEW:SECTION:ARC_REVIEW');
    const none = text.slice(0, arcStart) + text.slice(arcStart).replace('- [x] PASS\n', '- [ ] PASS\n');
    fs.writeFileSync(file, none);
    expect(evaluateProductReview(file).blockers.join('\n')).toMatch(/ARC: no verdict is recorded/);

    const two = text.slice(0, arcStart) + text.slice(arcStart).replace('- [ ] REVISE\n', '- [x] REVISE\n');
    fs.writeFileSync(file, two);
    expect(evaluateProductReview(file).blockers.join('\n')).toMatch(/ARC: more than one verdict is checked/);
  });

  it('validates the template as structurally sound and not yet ready for closure', () => {
    const template = path.resolve(__dirname, '..', 'Sigma', 'templates', 'PRODUCT-REVIEW-TEMPLATE.md');
    const report = validateSigmaDocFile(template, 'review');
    expect(report.errors).toEqual([]);
    expect(report.schema).toBe('1');
    const unsatisfied = report.requirements.filter(r => !r.satisfied).map(r => r.label);
    expect(unsatisfied).toEqual(expect.arrayContaining([
      'ARC verdict recorded (exactly one)',
      'Director verdict recorded (exactly one)',
    ]));
  });
});

describe('sigma review', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('review new creates one PRODUCT REVIEW for a ratified INTENT and refuses a second', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));

    const created = runCli('review new', env.projectDir, env.homeDir);
    expect(created.exitCode).toBe(0);
    expect(created.stdout).toMatch(/Created: Sigma[\\/]review[\\/]PRODUCT-REVIEW-v1\.md/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'review', 'PRODUCT-REVIEW-v1.md'))).toBe(true);

    const again = runCli('review new', env.projectDir, env.homeDir);
    expect(again.exitCode).toBe(1);
    expect(again.stderr).toMatch(/PRODUCT REVIEW already exists/);
  });

  it('review new requires a RATIFIED INTENT', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));

    const result = runCli('review new', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/requires a RATIFIED INTENT/);
  });

  it('review check reports closure readiness without changing anything', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    const file = writeProductReview(env, { arc: 'PASS', aud: 'REVISE', director: 'PASS' });
    const before = fs.readFileSync(file);

    const result = runCli('review check', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/✗ AUD verdict accepted \(PASS or PASS_WITH_RISK\)/);
    expect(result.stdout).toMatch(/Closure readiness: Not eligible/);
    expect(fs.readFileSync(file)).toEqual(before);
  });

  it('review check says so when there is no PRODUCT REVIEW', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    const result = runCli('review check', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/No PRODUCT REVIEW found/);
  });
});

describe('DIR-CLOSE schema 3', () => {
  it('validates the bundled template with no structural errors and no lock requirements', () => {
    const template = path.resolve(__dirname, '..', 'Sigma', 'templates', 'DIR-CLOSE-TEMPLATE.md');
    const report = validateSigmaDocFile(template, 'close');
    expect(report.errors).toEqual([]);
    expect(report.schema).toBe('3');
    expect(report.requirements).toEqual([]);
  });

  it('keeps validating a schema 2 document against its original spec', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-close2-'));
    try {
      const file = path.join(dir, 'DIR-CLOSE-v1.md');
      fs.writeFileSync(file, validCloseDoc('v1', 'DO_NOT_CLOSE'));
      const report = validateSigmaDocFile(file, 'close');
      expect(report.schema).toBe('2');
      expect(report.errors).toEqual([]);
      expect(report.requirements.some(r => r.label.startsWith('Closure Decision verdict permits lock') && !r.satisfied)).toBe(true);
    } finally {
      fs.removeSync(dir);
    }
  });
});
