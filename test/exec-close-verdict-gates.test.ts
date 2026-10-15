import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  makeChainWithDraftClose,
  makeChainWithDraftExec,
  stubProjectRootAnchor,
  writeChainFixture,
  runCli,
  setupTestEnv,
  stubProjectIdentity,
  TestEnv,
  validCloseDoc,
  validExecDoc,
} from './helpers';

describe('FMN Post-Build Advisory Verdict gate (exec approve --director-confirm only, verdict-agnostic — PLAN-EVAL-11 Bagian B)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('exec approve --director-confirm fails when no verdict checkbox is checked', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md');
    fs.writeFileSync(execFile, validExecDoc('v0.1', 'v1').replace('- [x] READY_FOR_LOCK', ''));

    const result = runCli('exec approve --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/no verdict checkbox is checked/);
    expect(result.stdout).toMatch(/✗ FMN Post-Build Advisory Verdict recorded/);
  });

  it('exec approve --director-confirm fails when more than one verdict checkbox is checked', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md');
    fs.writeFileSync(
      execFile,
      validExecDoc('v0.1', 'v1').replace('- [x] READY_FOR_LOCK', '- [x] READY_FOR_LOCK\n- [x] NEEDS_DEV_UPDATE')
    );

    const result = runCli('exec approve --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/more than one verdict checkbox is checked/);
  });

  it('exec approve --director-confirm succeeds regardless of which single verdict is checked — verdict-agnostic (FMN is advisory, not approval authority)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md');
    // REVISION_REQUIRED — semantically "not ready" — must still not block exec approve --director-confirm.
    fs.writeFileSync(execFile, validExecDoc('v0.1', 'v1', 'REVISION_REQUIRED'));

    const result = runCli('exec approve --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/✓ FMN Post-Build Advisory Verdict recorded/);
    expect(result.stdout).toMatch(/DEV-EXEC v0\.1 LOCKED/);
  });
});

describe('close lock has no document-content gate (closure design, 15 October 2026)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  // The gate sits before `close new` (Gate 3 and the PRODUCT REVIEW verdicts).
  // Locking is a stamp that the mandate is finished, so a legacy schema 2
  // document whose old lock requirements are unsatisfied no longer blocks it.
  const lockWith = (doc: string) => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(closeFile, doc);
    return runCli('close lock --yes', env.projectDir, env.homeDir);
  };

  it('close lock succeeds even when the legacy Closure Decision verdict is DO_NOT_CLOSE', () => {
    const result = lockWith(validCloseDoc('v1', 'DO_NOT_CLOSE'));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/DIR-CLOSE v1 LOCKED/);
    // The report is informational: the old requirement is still shown, but it does not block.
    expect(result.stdout).toMatch(/✗ Closure Decision verdict permits lock/);
  });

  it('close lock succeeds even when the legacy verdict is OTHER', () => {
    const result = lockWith(validCloseDoc('v1', 'OTHER'));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/DIR-CLOSE v1 LOCKED/);
  });

  it('close lock succeeds even when Reason and Closure Sentence are still placeholders', () => {
    const result = lockWith(
      validCloseDoc('v1')
        .replace(
          'Test project closed successfully with all acceptance criteria met.',
          '[State the final reason for closure, non-closure, new plan, or current exec update.]'
        )
        .replace(
          'Director accepts closure of Test Project as complete, with no known limitations, and directs all further expansion to begin from a new Intent.',
          '[Write one final sentence that can be read independently.]'
        )
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/DIR-CLOSE v1 LOCKED/);
  });

  it('close lock succeeds for a schema 3 closing report taken straight from the template', () => {
    const template = fs.readFileSync(path.resolve(__dirname, '..', 'Sigma', 'templates', 'DIR-CLOSE-TEMPLATE.md'), 'utf8');
    const result = lockWith(template);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Schema: 3/);
    expect(result.stdout).toMatch(/DIR-CLOSE v1 LOCKED/);
  });
});

describe('Lock Validation Equivalence (PLAN-EVAL-11 Bagian A.5)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('exec check and exec approve --director-confirm report the exact same unsatisfied requirement for the same document', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md');
    fs.writeFileSync(execFile, validExecDoc('v0.1', 'v1').replace('- [x] READY_FOR_LOCK', ''));

    const checked = runCli('exec check', env.projectDir, env.homeDir);
    const locked = runCli('exec approve --director-confirm', env.projectDir, env.homeDir);

    // check never fails on a lock requirement (only lock does) — but must show the exact
    // same unsatisfied requirement lock will block on, so Director never finds a "new"
    // requirement only at lock time.
    expect(checked.exitCode).toBe(0);
    expect(locked.exitCode).toBe(1);
    expect(checked.stdout).toMatch(/✗ FMN Post-Build Advisory Verdict recorded \(exactly one\)/);
    expect(locked.stdout).toMatch(/✗ FMN Post-Build Advisory Verdict recorded \(exactly one\)/);
  });
});
