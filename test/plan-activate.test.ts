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
  validPlanDoc,
  TestEnv,
} from './helpers';

// Build a chain fixture with a locked intent and one or more plan DRAFTs.
// The old fixture carried a decoy second INTENT entry (v1 LOCKED alongside
// v2 LOCKED, only v2 relevant) — that pattern no longer exists under Opsi C
// (PLAN-EVAL-01 §3.4); one chain, one intent, is enough to cover the same
// plan-array behavior these tests actually exercise.
function makeChainWithMultiplePlanDrafts() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/build/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.3',
      active_state: 'DRAFT',
      pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'DRAFT',  file: 'Sigma/build/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
        { version: 'v1.3', state: 'DRAFT',  file: 'Sigma/build/FMN-PLAN-v1.3.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

function makeChainWithSingleDraftPlan() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    // No roadmap — used by the Gate 1.5 tests below.
    plan: {
      active_version: 'v1.1',
      active_state: 'DRAFT',
      pending: [],
      versions: [
        { version: 'v1.1', state: 'DRAFT', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  });
}

describe('sigma plan new — gate ordering follows current CLI', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('reports Gate 1.5 before any draft-queue concern when no ROADMAP exists', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());

    const result = runCli('plan new --title "Test Stage" --focus "Test focus"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Gate 1\.5 blocked/i);
    expect(result.stderr).toMatch(/ROADMAP must exist/i);
  });

  it('gate-first error points to the roadmap creation flow (no more "roadmap activate" — command removed, §3.5)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());

    const result = runCli('plan new --title "Test Stage" --focus "Test focus"', env.projectDir, env.homeDir);

    expect(result.stderr).toMatch(/sigma roadmap new/i);
    expect(result.stderr).not.toMatch(/sigma roadmap activate/i);
  });
});

describe('sigma plan activate', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('activates an existing DRAFT version successfully', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    const result = runCli('plan activate --v v1.2', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v1\.2/);
    expect(result.stdout).toMatch(/active/i);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = updated.plan as Record<string, unknown>;
    expect(plan.active_version).toBe('v1.2');
    expect(plan.active_state).toBe('DRAFT');
  });

  it('fails for a version that does not exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    const result = runCli('plan activate --v v9.99', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });

  it('fails for a LOCKED version', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    const result = runCli('plan activate --v v1.1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/LOCKED/i);
  });

  it('after activation, sigma plan lock locks the activated version', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    // Activate v1.2 (not the current active v1.3)
    const activateResult = runCli('plan activate --v v1.2', env.projectDir, env.homeDir);
    expect(activateResult.exitCode).toBe(0);

    // Create a stub plan file so the harvester doesn't fail
    const planFile = path.join(env.projectDir, 'Sigma', 'build', 'FMN-PLAN-v1.2.md');
    fs.writeFileSync(planFile, validPlanDoc('v1.2'));

    const lockResult = runCli('plan lock', env.projectDir, env.homeDir);
    expect(lockResult.exitCode).toBe(0);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = updated.plan as Record<string, unknown>;
    expect(plan.active_version).toBe('v1.2');
    expect(plan.active_state).toBe('LOCKED');

    const versions = plan.versions as Array<Record<string, unknown>>;
    const v12 = versions.find(v => v.version === 'v1.2');
    expect(v12?.state).toBe('LOCKED');
  });

  it('sigma plan status reflects the newly activated version', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    runCli('plan activate --v v1.2', env.projectDir, env.homeDir);

    const result = runCli('plan status', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v1\.2/);
    expect(result.stdout).toMatch(/DRAFT/);
  });
});

describe('AUD Advisory Verdict gate on plan lock', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('plan lock fails when no verdict checkbox is checked', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());
    const planFile = path.join(env.projectDir, 'Sigma', 'build', 'FMN-PLAN-v1.1.md');
    fs.writeFileSync(planFile, validPlanDoc('v1.1').replace('- [x] PASS', ''));

    const result = runCli('plan lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/no verdict checkbox is checked/);
  });

  it('plan lock succeeds when SKIP_FOR_AUDIT is checked with a recorded Director Instruction', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());
    const planFile = path.join(env.projectDir, 'Sigma', 'build', 'FMN-PLAN-v1.1.md');
    fs.writeFileSync(
      planFile,
      validPlanDoc('v1.1').replace(
        '- [x] PASS',
        '- [x] SKIP_FOR_AUDIT\n\nDirector Instruction (verbatim): Director said skip audit for this cycle, proceed.'
      )
    );

    const result = runCli('plan lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});
