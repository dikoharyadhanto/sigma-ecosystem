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

// PLAN-IMPL-MULTIDRAFT-LOCK §3/§13.1 (Director directive 2026-08-12) —
// replaces test/plan-activate.test.ts, deleted along with the `plan
// activate` command it exercised (§8.2: activate's only purpose was moving
// a display pointer for `plan status`, which no longer reads it). The two
// fixtures and the "gate ordering"/"AUD Advisory Verdict" describe blocks
// below are carried over unchanged from that file — still valid coverage,
// just no longer about `activate`.

function makeChainWithMultiplePlanDrafts() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.3',
      active_state: 'DRAFT',
      pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'DRAFT',  file: 'Sigma/contract/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
        { version: 'v1.3', state: 'DRAFT',  file: 'Sigma/contract/FMN-PLAN-v1.3.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

function makeChainWithSingleDraftPlan() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    // No roadmap — used by the Gate 1.5 tests below.
    plan: {
      active_version: 'v1.1',
      active_state: 'DRAFT',
      pending: [],
      versions: [
        { version: 'v1.1', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  });
}

function makeChainWithNoDraftPlan() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.1',
      active_state: 'LOCKED',
      pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
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

describe('sigma plan lock — explicit --v targeting (PLAN-IMPL-MULTIDRAFT-LOCK §3, FIFO removed)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('fails with an explicit "nothing to lock" message when zero DRAFT plans exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithNoDraftPlan());

    const result = runCli('plan lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/No DRAFT FMN-PLAN to lock/i);
  });

  it('locks without --v when exactly one DRAFT plan is open', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));

    const result = runCli('plan lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v1\.1 LOCKED/);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = updated.plan as Record<string, unknown>;
    expect(plan.active_version).toBe('v1.1');
    expect(plan.active_state).toBe('LOCKED');
    const gates = updated.gates as Record<string, unknown>;
    expect(gates.gate_2_open).toBe(true);
  });

  it('rejects without --v when more than one DRAFT plan is open, listing every candidate', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    const result = runCli('plan lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/2 DRAFT FMN-PLANs are open/);
    expect(result.stderr).toMatch(/v1\.2/);
    expect(result.stderr).toMatch(/v1\.3/);
    expect(result.stderr).toMatch(/--v/);
  });

  it('locks the specified version with --v, leaving the other DRAFT untouched', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.2.md'), validPlanDoc('v1.2'));

    const result = runCli('plan lock --v v1.2', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v1\.2 LOCKED/);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = updated.plan as Record<string, unknown>;
    const versions = plan.versions as Array<Record<string, unknown>>;
    expect(versions.find(v => v.version === 'v1.2')?.state).toBe('LOCKED');
    expect(versions.find(v => v.version === 'v1.3')?.state).toBe('DRAFT');
    expect(plan.active_version).toBe('v1.2');
  });

  it('fails when --v targets a version that is not DRAFT', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));

    const result = runCli('plan lock --v v1.1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/lock requires DRAFT/i);
  });

  it('fails when --v targets a version that does not exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    const result = runCli('plan lock --v v9.99', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });
});

describe('sigma plan check — ambiguity guard (PLAN-IMPL-MULTIDRAFT-LOCK §8.3)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('refuses without --v when more than one DRAFT plan is open', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());

    const result = runCli('plan check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/2 DRAFT FMN-PLANs are open/);
    expect(result.stderr).toMatch(/--v/);
  });

  it('succeeds with an explicit --v even when ambiguous', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithMultiplePlanDrafts());
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.2.md'), validPlanDoc('v1.2'));

    const result = runCli('plan check --v v1.2', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });

  it('still falls back to the active pointer when unambiguous (0 or 1 DRAFT)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));

    const result = runCli('plan check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});

describe('AUD Advisory Verdict gate on plan lock', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('plan lock fails when no verdict checkbox is checked', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());
    const planFile = path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md');
    fs.writeFileSync(planFile, validPlanDoc('v1.1').replace('- [x] PASS', ''));

    const result = runCli('plan lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/no verdict checkbox is checked/);
  });

  it('plan lock succeeds when SKIP_FOR_AUDIT is checked with a recorded Director Instruction', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithSingleDraftPlan());
    const planFile = path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md');
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
