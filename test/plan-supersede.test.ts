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
  TestEnv,
} from './helpers';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLockedPlanWithExec(opts: {
  execState?: 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
} = {}) {
  const now = new Date().toISOString();
  const execState = opts.execState ?? 'LOCKED';
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v1.1',
      active_state: execState,
      versions: [
        {
          version: 'v1.1', state: execState, file: 'Sigma/evidence/DEV-EXEC-v1.1.md',
          created_at: now, updated_at: now, plan_version_ref: 'v1',
          ...(execState === 'LOCKED' ? { locked_at: now } : {}),
        },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

function makeLockedPlanNoExec() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

function makeDraftPlanWithIntent() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1', active_state: 'DRAFT', pending: [],
      versions: [{ version: 'v1', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  });
}

// PLAN-IMPL-MULTIDRAFT-LOCK §1.3 — same shape as makeLockedPlanNoExec() but
// with a LOCKED roadmap, so a mutating command (`plan new`) run right after
// supersede can actually succeed rather than tripping an unrelated Gate 1.5
// error, making the gate-recompute regression test unambiguous.
function makeLockedPlanNoExecWithRoadmap() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

function makeLockedPlanWithMultipleExecs() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v1.2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v1.1', state: 'SUPERSEDED', file: 'Sigma/evidence/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1', supersede_reason: 'old' },
        { version: 'v1.2', state: 'LOCKED',     file: 'Sigma/evidence/DEV-EXEC-v1.2.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sigma plan supersede', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  // ── Guard checks ────────────────────────────────────────────────────────────

  it('fails when the plan version does not exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanNoExec());

    const result = runCli('plan supersede --v v9 --reason "no such plan"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });

  // PLAN-IMPL-MULTIDRAFT-LOCK §6.1 (Director directive 2026-08-12) —
  // supersede now accepts DRAFT: it is the only exit for a plan the
  // Director no longer wants (no `plan discard`, no lock-then-supersede
  // detour — see the plan's D-03/§1.5).
  it('succeeds when the plan version is DRAFT — DRAFT is a valid supersede target', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeDraftPlanWithIntent());

    const result = runCli('plan supersede --v v1 --reason "deprioritized"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = data.plan as Record<string, unknown>;
    const versions = plan.versions as Array<Record<string, unknown>>;
    const v1 = versions.find(v => v.version === 'v1');
    expect(v1?.state).toBe('SUPERSEDED');
    expect(v1?.supersede_reason).toBe('deprioritized');
  });

  it('fails when the plan version is already SUPERSEDED, without overwriting the original reason', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanNoExec());
    runCli('plan supersede --v v1 --reason "original reason"', env.projectDir, env.homeDir);

    const result = runCli('plan supersede --v v1 --reason "second attempt"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/already SUPERSEDED/i);
    expect(result.stderr).toMatch(/original reason/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = data.plan as Record<string, unknown>;
    const versions = plan.versions as Array<Record<string, unknown>>;
    const v1 = versions.find(v => v.version === 'v1');
    expect(v1?.supersede_reason).toBe('original reason');
  });

  // ── Core state mutations ────────────────────────────────────────────────────

  it('sets plan version state to SUPERSEDED', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanNoExec());

    const result = runCli('plan supersede --v v1 --reason "replaced by v2"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = data.plan as Record<string, unknown>;
    const versions = plan.versions as Array<Record<string, unknown>>;
    const v1 = versions.find(v => v.version === 'v1');
    expect(v1?.state).toBe('SUPERSEDED');
    expect(v1?.supersede_reason).toBe('replaced by v2');
  });

  it('updates plan.active_state to SUPERSEDED when active version is superseded', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanNoExec());

    runCli('plan supersede --v v1 --reason "replaced by v2"', env.projectDir, env.homeDir);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = data.plan as Record<string, unknown>;

    // This is the regression guard: active_state must match the entry state
    expect(plan.active_version).toBe('v1');
    expect(plan.active_state).toBe('SUPERSEDED');
  });

  // ── Exec cascade ────────────────────────────────────────────────────────────

  it('auto-supersedes a LOCKED exec that references the superseded plan', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanWithExec({ execState: 'LOCKED' }));

    const result = runCli('plan supersede --v v1 --reason "replan"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/auto-superseded/i);
    expect(result.stdout).toMatch(/v1\.1/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const versions = exec.versions as Array<Record<string, unknown>>;
    const v11 = versions.find(v => v.version === 'v1.1');
    expect(v11?.state).toBe('SUPERSEDED');
    expect((v11?.supersede_reason as string)).toMatch(/cascade/i);
    expect((v11?.supersede_reason as string)).toMatch(/v1/);
  });

  it('auto-supersedes a DRAFT exec that references the superseded plan', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanWithExec({ execState: 'DRAFT' }));

    const result = runCli('plan supersede --v v1 --reason "replan"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const versions = exec.versions as Array<Record<string, unknown>>;
    expect((versions.find(v => v.version === 'v1.1') as Record<string, unknown>)?.state).toBe('SUPERSEDED');
  });

  it('skips exec versions that are already SUPERSEDED', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanWithMultipleExecs());

    const result = runCli('plan supersede --v v1 --reason "replaced"', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const versions = exec.versions as Array<Record<string, unknown>>;
    const v11 = versions.find(v => v.version === 'v1.1') as Record<string, unknown>;

    // Original supersede_reason must not be overwritten
    expect(v11?.supersede_reason).toBe('old');
  });

  it('updates exec.active_state to SUPERSEDED when the active exec is cascaded', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanWithExec({ execState: 'LOCKED' }));

    const result = runCli('plan supersede --v v1 --reason "replan"', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;

    expect(exec.active_version).toBe('v1.1');
    expect(exec.active_state).toBe('SUPERSEDED');
  });

  it('does not crash when no exec versions reference the plan', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanNoExec());

    const result = runCli('plan supersede --v v1 --reason "no exec"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/auto-superseded/i);
  });

  // ── Regression: active_state mismatch must not corrupt subsequent commands ──

  it('subsequent sigma plan status does not fail after supersede', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanNoExec());

    const supersedeResult = runCli('plan supersede --v v1 --reason "regression check"', env.projectDir, env.homeDir);
    expect(supersedeResult.exitCode).toBe(0);

    const statusResult = runCli('plan status', env.projectDir, env.homeDir);

    expect(statusResult.exitCode).toBe(0);
  });

  // PLAN-IMPL-MULTIDRAFT-LOCK §1.3/§6.4 (Director directive 2026-08-12) —
  // supersede never recomputed gates before, so superseding the last LOCKED
  // plan left gate_2_open stale (true) until the next `sigma doctor` run,
  // and the very next *mutating* command would fail
  // validateChainSemantics() with "gate is open without a LOCKED PLAN".
  // `plan status` above is read-only and never exercised this path — this
  // test uses a real mutating command (`plan new`) to prove the fix.
  it('a mutating command after superseding the last LOCKED plan does not trip the stale gate_2_open bug', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanNoExecWithRoadmap());
    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'roadmap', 'ROADMAP-v1.md'),
      '# ROADMAP v1\n\n<!-- SIGMA:RENDER:START:stage-overview -->\n<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->\n## 3. Stage Overview\n<!-- SIGMA:RENDER:END:stage-overview -->\n'
    );

    const supersedeResult = runCli('plan supersede --v v1 --reason "regression check"', env.projectDir, env.homeDir);
    expect(supersedeResult.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const gates = data.gates as Record<string, unknown>;
    expect(gates.gate_2_open).toBe(false);

    const newPlanResult = runCli('plan new --title "Next stage" --focus "Next focus"', env.projectDir, env.homeDir);

    expect(newPlanResult.exitCode).toBe(0);
    expect(newPlanResult.stderr).not.toMatch(/gate is open without a LOCKED PLAN/i);
  });

  it('validates that active_state and active entry state are consistent after supersede', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeLockedPlanWithExec({ execState: 'LOCKED' }));

    const result = runCli('plan supersede --v v1 --reason "consistency check"', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const plan = data.plan as Record<string, unknown>;
    const exec = data.exec as Record<string, unknown>;
    const planVersions = plan.versions as Array<Record<string, unknown>>;
    const execVersions = exec.versions as Array<Record<string, unknown>>;

    const activePlanEntry = planVersions.find(v => v.version === plan.active_version);
    expect(activePlanEntry?.state).toBe(plan.active_state);

    const activeExecEntry = execVersions.find(v => v.version === exec.active_version);
    expect(activeExecEntry?.state).toBe(exec.active_state);
  });
});
