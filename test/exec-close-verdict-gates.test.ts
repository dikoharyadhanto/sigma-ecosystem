import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  makeChainWithDraftClose,
  makeChainWithDraftExec,
  stubLegacyProgressJson,
  writeChainFixture,
  runCli,
  setupTestEnv,
  TestEnv,
  validCloseDoc,
  validExecDoc,
} from './helpers';

describe('FMN Post-Build Advisory Verdict gate (exec lock only, verdict-agnostic — PLAN-EVAL-11 Bagian B)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('exec lock fails when no verdict checkbox is checked', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v0.1.md');
    fs.writeFileSync(execFile, validExecDoc('v0.1', 'v1').replace('- [x] READY_FOR_LOCK', ''));

    const result = runCli('exec lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/no verdict checkbox is checked/);
    expect(result.stdout).toMatch(/✗ FMN Post-Build Advisory Verdict recorded/);
  });

  it('exec lock fails when more than one verdict checkbox is checked', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v0.1.md');
    fs.writeFileSync(
      execFile,
      validExecDoc('v0.1', 'v1').replace('- [x] READY_FOR_LOCK', '- [x] READY_FOR_LOCK\n- [x] NEEDS_DEV_UPDATE')
    );

    const result = runCli('exec lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/more than one verdict checkbox is checked/);
  });

  it('exec lock succeeds regardless of which single verdict is checked — verdict-agnostic (FMN is advisory, not approval authority)', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v0.1.md');
    // REVISION_REQUIRED — semantically "not ready" — must still not block exec lock.
    fs.writeFileSync(execFile, validExecDoc('v0.1', 'v1', 'REVISION_REQUIRED'));

    const result = runCli('exec lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/✓ FMN Post-Build Advisory Verdict recorded/);
    expect(result.stdout).toMatch(/DEV-EXEC v0\.1 LOCKED/);
  });
});

describe('Closure Decision verdict gate (close lock only, verdict-aware — PLAN-EVAL-11 Bagian C)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('close lock fails when verdict is DO_NOT_CLOSE', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(closeFile, validCloseDoc('v1', 'DO_NOT_CLOSE'));

    const result = runCli('close lock --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/✗ Closure Decision verdict permits lock/);
    expect(result.stdout).toMatch(/does not permit close lock/);
  });

  it('close lock fails when verdict is OTHER (treated as blocking, not an implicit positive verdict)', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(closeFile, validCloseDoc('v1', 'OTHER'));

    const result = runCli('close lock --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/✗ Closure Decision verdict permits lock/);
  });

  it('close lock fails when Final Director Decision Reason is still a placeholder', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(
      closeFile,
      validCloseDoc('v1').replace(
        'Test project closed successfully with all acceptance criteria met.',
        '[State the final reason for closure, non-closure, new plan, or current exec update.]'
      )
    );

    const result = runCli('close lock --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/✗ Final Director Decision — Reason is stated/);
  });

  it('close lock fails when Closure Sentence is still a placeholder', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(
      closeFile,
      validCloseDoc('v1').replace(
        'Director accepts closure of Test Project as complete, with no known limitations, and directs all further expansion to begin from a new Intent.',
        '[Write one final sentence that can be read independently.]'
      )
    );

    const result = runCli('close lock --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/✗ Final Director Decision — Closure Sentence is stated/);
  });

  it('close lock succeeds when verdict is CLOSE_ACCEPTED and Final Director Decision is filled', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(closeFile, validCloseDoc('v1', 'CLOSE_ACCEPTED'));

    const result = runCli('close lock --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/✓ Closure Decision verdict permits lock/);
    expect(result.stdout).toMatch(/DIR-CLOSE v1 LOCKED/);
  });

  it('close lock succeeds when verdict is CLOSE_ACCEPTED_WITH_LIMITATIONS', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(closeFile, validCloseDoc('v1', 'CLOSE_ACCEPTED_WITH_LIMITATIONS'));

    const result = runCli('close lock --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});

describe('Lock Validation Equivalence (PLAN-EVAL-11 Bagian A.5)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('exec check and exec lock report the exact same unsatisfied requirement for the same document', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec());
    const execFile = path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v0.1.md');
    fs.writeFileSync(execFile, validExecDoc('v0.1', 'v1').replace('- [x] READY_FOR_LOCK', ''));

    const checked = runCli('exec check', env.projectDir, env.homeDir);
    const locked = runCli('exec lock', env.projectDir, env.homeDir);

    // check never fails on a lock requirement (only lock does) — but must show the exact
    // same unsatisfied requirement lock will block on, so Director never finds a "new"
    // requirement only at lock time.
    expect(checked.exitCode).toBe(0);
    expect(locked.exitCode).toBe(1);
    expect(checked.stdout).toMatch(/✗ FMN Post-Build Advisory Verdict recorded \(exactly one\)/);
    expect(locked.stdout).toMatch(/✗ FMN Post-Build Advisory Verdict recorded \(exactly one\)/);
  });

  it('a document that check reports as fully lock-ready never fails lock for a requirement reason', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose());
    const closeFile = path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md');
    fs.writeFileSync(closeFile, validCloseDoc('v1', 'CLOSE_ACCEPTED'));

    const checked = runCli('close check', env.projectDir, env.homeDir);
    expect(checked.exitCode).toBe(0);
    expect(checked.stdout).toMatch(/Document is structurally valid and all Lock Requirements are satisfied\./);

    const locked = runCli('close lock --yes', env.projectDir, env.homeDir);
    expect(locked.exitCode).toBe(0);
  });
});
