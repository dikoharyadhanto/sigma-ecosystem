import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChain,
  chainPath,
  validExecDoc,
  TestEnv,
} from './helpers';

// PLAN-IMPL-MULTIDRAFT-LOCK §4/§5/§13.1 (Director directive 2026-08-12) —
// covers the discussion document's core scenario (§1.5): PLAN A locked,
// EXEC A drafted and left incomplete, PLAN B locked, EXEC B created for a
// *different* plan while EXEC A is still open. Before this change, `exec
// new` refused outright the moment any exec chain-wide was non-final,
// regardless of which plan it referenced (the old chain-wide guard).

// PLAN A has an open DRAFT exec (v1.1); PLAN B (v1.2) does not yet.
function makeChainWithOneOpenExecOnePlanFree() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.2', active_state: 'LOCKED', pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
      ],
    },
    exec: {
      active_version: 'v1.1', active_state: 'DRAFT',
      versions: [
        { version: 'v1.1', state: 'DRAFT', file: 'Sigma/build/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

// Both PLAN A and PLAN B have an open DRAFT exec — used for exec lock/check
// ambiguity coverage.
function makeChainWithTwoOpenExecs() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.2', active_state: 'LOCKED', pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
      ],
    },
    exec: {
      active_version: 'v1.2', active_state: 'DRAFT',
      versions: [
        { version: 'v1.1', state: 'DRAFT', file: 'Sigma/build/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1' },
        { version: 'v1.2', state: 'DRAFT', file: 'Sigma/build/DEV-EXEC-v1.2.md', created_at: now, updated_at: now, plan_version_ref: 'v1.2' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

// Three LOCKED plans, only the first has an open exec — used to prove the
// ambiguity listing excludes plans that already have one.
function makeChainWithThreePlansOneOpenExec() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.3', active_state: 'LOCKED', pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.3', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.3.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
      ],
    },
    exec: {
      active_version: 'v1.1', active_state: 'DRAFT',
      versions: [
        { version: 'v1.1', state: 'DRAFT', file: 'Sigma/build/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

describe('sigma exec new — per-PLAN guard (PLAN-IMPL-MULTIDRAFT-LOCK §4, replaces the old chain-wide guard)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('allows creating an exec for PLAN B while PLAN A already has an open DRAFT exec (discussion §1.5 core scenario)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithOneOpenExecOnePlanFree());

    const result = runCli('exec new --plan v1.2', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/references PLAN v1\.2/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const versions = exec.versions as Array<Record<string, unknown>>;
    expect(versions.find(v => v.version === 'v1.1')?.state).toBe('DRAFT');
    expect(versions.find(v => v.version === 'v1.2')?.state).toBe('DRAFT');
  });

  it('refuses a second exec for a plan that already has one open, pointing at the existing draft', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithOneOpenExecOnePlanFree());

    const result = runCli('exec new --plan v1.1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/EXEC CONFLICT/);
    expect(result.stderr).toMatch(/DEV-EXEC v1\.1/);
    expect(result.stderr).toMatch(/sigma plan supersede --v v1\.1/);
  });

  it('auto-resolves to the sole unexecuted plan, not listing the one that already has an open exec', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithOneOpenExecOnePlanFree());

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/references PLAN v1\.2/);
  });

  it('lists only unexecuted plans as ambiguity candidates, excluding the plan with an open exec', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithThreePlansOneOpenExec());

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/2 unexecuted locked plans found/);
    expect(result.stderr).toContain('v1.2');
    expect(result.stderr).toContain('v1.3');
    expect(result.stderr).not.toContain('v1.1');
  });
});

describe('sigma exec lock — explicit --v targeting (PLAN-IMPL-MULTIDRAFT-LOCK §5)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('rejects without --v when more than one DRAFT exec is open, describing each by its plan ref', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithTwoOpenExecs());

    const result = runCli('exec lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/2 DRAFT DEV-EXECs are open/);
    expect(result.stderr).toMatch(/v1\.1 \(plan v1\.1\)/);
    expect(result.stderr).toMatch(/v1\.2 \(plan v1\.2\)/);
    expect(result.stderr).toMatch(/--v/);
  });

  it('locks the specified version with --v, leaving the other DRAFT untouched', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithTwoOpenExecs());
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v1.1.md'), validExecDoc('v1.1', 'v1.1'));

    const result = runCli('exec lock --v v1.1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/DEV-EXEC v1\.1 LOCKED/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const versions = exec.versions as Array<Record<string, unknown>>;
    expect(versions.find(v => v.version === 'v1.1')?.state).toBe('LOCKED');
    expect(versions.find(v => v.version === 'v1.2')?.state).toBe('DRAFT');
  });
});

describe('sigma exec check — ambiguity guard (PLAN-IMPL-MULTIDRAFT-LOCK §8.3)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('refuses without --v when more than one DRAFT exec is open', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithTwoOpenExecs());

    const result = runCli('exec check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/2 DRAFT DEV-EXECs are open/);
  });

  it('succeeds with an explicit --v even when ambiguous', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithTwoOpenExecs());
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v1.2.md'), validExecDoc('v1.2', 'v1.2'));

    const result = runCli('exec check --v v1.2', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});
