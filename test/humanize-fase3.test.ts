import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectIdentity,
  writeChainFixture,
  chainPath,
  makeChainWithLockedIntent,
  makeChainWithDraftIntent,
  makeChainWithLockedExec,
  makeChainWithDraftExec,
  makeChainWithDraftClose,
  TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.1/§4 Fase 3 — `sigma intent/exec/close
// humanize` scaffold the human projection + Fidelity Ledger from a
// RATIFIED/LOCKED source. These tests cover the guard (source must not be
// DRAFT), the scaffold itself (both files created, chain.*.human recorded),
// and the overwrite guard (--force required to re-run).

describe('sigma intent humanize', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('refuses to run against a DRAFT intent', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));
    stubProjectIdentity(env);

    const result = runCli('intent humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/DRAFT.*humanize requires RATIFIED/);
    expect(fs.existsSync(path.join(env.sigmaDir, 'human', 'DIR-INTENT-HUMAN-v1.md'))).toBe(false);
  });

  it('scaffolds the human doc + Fidelity Ledger from a RATIFIED intent and records chain state', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    stubProjectIdentity(env);

    const result = runCli('intent humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma\/human\/DIR-INTENT-HUMAN-v1\.md/);
    expect(result.stdout).toMatch(/Reading \/humanize writing rules/);

    const humanPath = path.join(env.sigmaDir, 'human', 'DIR-INTENT-HUMAN-v1.md');
    const ledgerPath = path.join(env.sigmaDir, 'human', 'DIR-INTENT-HUMAN-v1.fidelity.md');
    expect(fs.existsSync(humanPath)).toBe(true);
    expect(fs.existsSync(ledgerPath)).toBe(true);
    expect(fs.readFileSync(humanPath, 'utf8')).toContain('TEMPLATE ONLY');

    const chain = fs.readJsonSync(chainPath(env, 'v1'));
    expect(chain.intent.human).toMatchObject({ version: 'v1' });
    expect(chain.intent.human.generated_at).toBeTruthy();
  });

  it('refuses to overwrite an existing human projection without --force', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    stubProjectIdentity(env);
    runCli('intent humanize', env.projectDir, env.homeDir);

    const result = runCli('intent humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/already exists.*Pass --force/s);
  });

  it('overwrites with --force', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    stubProjectIdentity(env);
    runCli('intent humanize', env.projectDir, env.homeDir);

    const result = runCli('intent humanize --force', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});

describe('sigma exec humanize', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('refuses to run against a DRAFT exec', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithDraftExec('v1'));
    stubProjectIdentity(env);

    const result = runCli('exec humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/DRAFT.*humanize requires LOCKED/);
  });

  it('scaffolds PLAN-EXEC-HUMAN from a LOCKED plan+exec pair and records chain state', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    stubProjectIdentity(env);

    const result = runCli('exec humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma\/human\/PLAN-EXEC-HUMAN-v1\.1\.md \(sources: FMN-PLAN v1\.1 \+ DEV-EXEC v1\.1\)/);

    const humanPath = path.join(env.sigmaDir, 'human', 'PLAN-EXEC-HUMAN-v1.1.md');
    expect(fs.existsSync(humanPath)).toBe(true);
    expect(fs.existsSync(path.join(env.sigmaDir, 'human', 'PLAN-EXEC-HUMAN-v1.1.fidelity.md'))).toBe(true);

    const chain = fs.readJsonSync(chainPath(env, 'v1'));
    const execEntry = chain.exec.versions.find((v: any) => v.version === 'v1.1');
    expect(execEntry.human).toMatchObject({ version: 'v1.1' });
    // Only the exec side is stamped — plan entries never carry `human`.
    const planEntry = chain.plan.versions.find((v: any) => v.version === 'v1.1');
    expect(planEntry.human).toBeUndefined();
  });

  it('refuses to overwrite without --force', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    stubProjectIdentity(env);
    runCli('exec humanize', env.projectDir, env.homeDir);

    const result = runCli('exec humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/already exists.*Pass --force/s);
  });
});

describe('sigma close humanize', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('errors when no DIR-CLOSE exists yet', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    stubProjectIdentity(env);

    const result = runCli('close humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/No active DIR-CLOSE found/);
  });

  it('refuses to run against a DRAFT close', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', makeChainWithDraftClose('v1'));
    stubProjectIdentity(env);

    const result = runCli('close humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/DRAFT.*humanize requires LOCKED/);
  });

  it('scaffolds DIR-CLOSE-HUMAN from a LOCKED close and records chain state', () => {
    env = setupTestEnv();
    const draft = makeChainWithDraftClose('v1') as any;
    const now = new Date().toISOString();
    draft.close = { ...draft.close, state: 'LOCKED', locked_at: now };
    writeChainFixture(env, 'v1', draft);
    stubProjectIdentity(env);

    const result = runCli('close humanize', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma\/human\/DIR-CLOSE-HUMAN-v1\.md/);

    const chain = fs.readJsonSync(chainPath(env, 'v1'));
    expect(chain.close.human).toMatchObject({ version: 'v1' });
  });
});
