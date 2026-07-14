import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  makeProgressWithDraftIntent,
  makeProgressWithLockedIntent,
  runCli,
  setupTestEnv,
  TestEnv,
  validIntentDoc,
} from './helpers';

describe('Document checks and auto-validation', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('intent new auto-runs validation after file creation', () => {
    env = setupTestEnv();
    const progress = makeProgressWithDraftIntent() as Record<string, unknown>;
    progress.intent = { active_version: null, active_state: null, versions: [] };
    progress.gates = { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false };
    fs.writeJsonSync(env.progressPath, progress);

    const result = runCli('intent new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Running automatic validation/);
    expect(result.stdout).toMatch(/Sigma Intent Check/);
    expect(result.stdout).toMatch(/\[PASS\] Document marker found/);
    expect(result.stdout).toMatch(/Result: OK/);
  });

  it('intent check passes for a template-generated draft', () => {
    env = setupTestEnv();
    const progress = makeProgressWithDraftIntent() as Record<string, unknown>;
    progress.intent = { active_version: null, active_state: null, versions: [] };
    progress.gates = { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false };
    fs.writeJsonSync(env.progressPath, progress);

    const created = runCli('intent new', env.projectDir, env.homeDir);
    expect(created.exitCode).toBe(0);

    const checked = runCli('intent check', env.projectDir, env.homeDir);
    expect(checked.exitCode).toBe(0);
    expect(checked.stdout).toMatch(/Lock readiness: Eligible/);
  });

  it('intent lock is blocked when required markers are missing', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, '# DIR-INTENT\n\n## 1. Intent Core — Sovereign Layer\n');

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Sigma Intent Check failed/);
    expect(result.stdout).toMatch(/\[ERROR\] Missing document marker/);
    expect(result.stdout).toMatch(/Lock readiness: Not eligible/);
  });

  it('roadmap new auto-runs validation for created roadmap docs', () => {
    env = setupTestEnv();
    const progress = makeProgressWithLockedIntent() as Record<string, any>;
    fs.writeJsonSync(env.progressPath, progress);

    const result = runCli('roadmap new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Running automatic validation/);
    expect(result.stdout).toMatch(/Sigma Roadmap Check/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'build', 'ROADMAP-v1.md'))).toBe(true);
  });
});

describe('AUD Advisory Verdict gate (intent lock / plan lock only)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('intent lock fails when no verdict checkbox is checked', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, validIntentDoc('v1').replace('- [x] PASS', ''));

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/no verdict checkbox is checked/);
  });

  it('intent lock fails when more than one verdict checkbox is checked', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, validIntentDoc('v1').replace('- [x] PASS', '- [x] PASS\n- [x] REVISE'));

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/more than one verdict checkbox is checked/);
  });

  it('intent lock fails when SKIP_FOR_AUDIT is checked but Director Instruction is empty', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(
      intentFile,
      validIntentDoc('v1').replace('- [x] PASS', '- [x] SKIP_FOR_AUDIT\n\nDirector Instruction (verbatim): [...]')
    );

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/Director Instruction \(verbatim\)" is empty/);
  });

  it('intent lock succeeds when SKIP_FOR_AUDIT is checked with a recorded Director Instruction', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(
      intentFile,
      validIntentDoc('v1').replace(
        '- [x] PASS',
        '- [x] SKIP_FOR_AUDIT\n\nDirector Instruction (verbatim): Director said skip audit for this cycle, proceed.'
      )
    );

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});

describe('Final Validation Checklist gate (intent lock only)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('intent lock fails when a Lock Requirement item is not checked', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(
      intentFile,
      validIntentDoc('v1').replace('- [x] Risk appetite is stated.', '- [ ] Risk appetite is stated.')
    );

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/Lock Requirement.*not checked/);
    expect(result.stdout).toMatch(/Risk appetite is stated/);
  });

  it('intent lock fails when a Quality Bar dimension in Section 4 is still a placeholder', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(
      intentFile,
      validIntentDoc('v1').replace(
        '| Security | N/A | N/A | N/A |',
        '| Security | [What must be true for this to be safe enough?] | N/A | N/A |'
      )
    );

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/Quality Bar \(Section 4\).*placeholder/);
    expect(result.stdout).toMatch(/Security/);
  });

  it('intent lock succeeds when Lock Requirement is complete and Quality Bar has no placeholders, ignoring unchecked Conditional Requirement', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    // validIntentDoc() ships with Conditional Requirement items left unchecked by default.
    fs.writeFileSync(intentFile, validIntentDoc('v1'));

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Final Validation Checklist — Lock Requirement: all items checked/);
    expect(result.stdout).toMatch(/Quality Bar \(Section 4\): minimum standard stated or N\/A for all dimensions/);
  });
});
