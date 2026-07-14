import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, makeProgress, validPlanDoc, TestEnv } from './helpers';

// Build a progress fixture with a locked intent and one or more plan DRAFTs
function makeProgressWithMultiplePlanDrafts() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
        { version: 'v2', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now, locked_at: now },
      ],
    },
    plan: {
      active_version: 'v1.3',
      active_state: 'DRAFT',
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v2' },
        { version: 'v1.2', state: 'DRAFT',  file: 'Sigma/build/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, intent_version_ref: 'v2' },
        { version: 'v1.3', state: 'DRAFT',  file: 'Sigma/build/FMN-PLAN-v1.3.md', created_at: now, updated_at: now, intent_version_ref: 'v2' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

function makeProgressWithSingleDraftPlan() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v2', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now, locked_at: now },
      ],
    },
    plan: {
      active_version: 'v1.1',
      active_state: 'DRAFT',
      versions: [
        { version: 'v1.1', state: 'DRAFT', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, intent_version_ref: 'v2' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  });
}

describe('sigma plan new — gate ordering follows current CLI', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('reports Gate 1.5 before any draft-queue concern when no ACTIVE ROADMAP exists', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithSingleDraftPlan());

    const result = runCli('plan new --title "Test Stage" --focus "Test focus"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Gate 1\.5 blocked/i);
    expect(result.stderr).toMatch(/ACTIVE ROADMAP/i);
  });

  it('gate-first error points to roadmap activation flow', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithSingleDraftPlan());

    const result = runCli('plan new --title "Test Stage" --focus "Test focus"', env.projectDir, env.homeDir);

    expect(result.stderr).toMatch(/sigma roadmap new/i);
    expect(result.stderr).toMatch(/sigma roadmap activate/i);
  });
});

describe('sigma plan activate', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('activates an existing DRAFT version successfully', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithMultiplePlanDrafts());

    const result = runCli('plan activate --v v1.2', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v1\.2/);
    expect(result.stdout).toMatch(/active/i);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, unknown>;
    const plan = updated.plan as Record<string, unknown>;
    expect(plan.active_version).toBe('v1.2');
    expect(plan.active_state).toBe('DRAFT');
  });

  it('fails for a version that does not exist', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithMultiplePlanDrafts());

    const result = runCli('plan activate --v v9.99', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });

  it('fails for a LOCKED version', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithMultiplePlanDrafts());

    const result = runCli('plan activate --v v1.1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/LOCKED/i);
  });

  it('after activation, sigma plan lock locks the activated version', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithMultiplePlanDrafts());

    // Activate v1.2 (not the current active v1.3)
    const activateResult = runCli('plan activate --v v1.2', env.projectDir, env.homeDir);
    expect(activateResult.exitCode).toBe(0);

    // Create a stub plan file so the harvester doesn't fail
    const planFile = path.join(env.projectDir, 'Sigma', 'build', 'FMN-PLAN-v1.2.md');
    fs.writeFileSync(planFile, validPlanDoc('v1.2'));

    const lockResult = runCli('plan lock', env.projectDir, env.homeDir);
    expect(lockResult.exitCode).toBe(0);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, unknown>;
    const plan = updated.plan as Record<string, unknown>;
    expect(plan.active_version).toBe('v1.2');
    expect(plan.active_state).toBe('LOCKED');

    const versions = plan.versions as Array<Record<string, unknown>>;
    const v12 = versions.find(v => v.version === 'v1.2');
    expect(v12?.state).toBe('LOCKED');
  });

  it('sigma plan status reflects the newly activated version', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithMultiplePlanDrafts());

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
    fs.writeJsonSync(env.progressPath, makeProgressWithSingleDraftPlan());
    const planFile = path.join(env.projectDir, 'Sigma', 'build', 'FMN-PLAN-v1.1.md');
    fs.writeFileSync(planFile, validPlanDoc('v1.1').replace('- [x] PASS', ''));

    const result = runCli('plan lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/no verdict checkbox is checked/);
  });

  it('plan lock succeeds when SKIP_FOR_AUDIT is checked with a recorded Director Instruction', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithSingleDraftPlan());
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
