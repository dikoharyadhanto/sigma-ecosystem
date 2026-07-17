import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  makeProgress,
  makeProgressWithLockedExec,
  validIntentDoc,
  TestEnv,
} from './helpers';

// Coverage for PLAN-EVAL-01: `sigma intent supersede` is the only path to a
// real SUPERSEDED INTENT, the cascade is explicit + director-confirmed, and
// it must never leak outside the exact chain it targets.

function fullLockedChain() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
    },
    roadmap: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/build/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    plan: {
      active_version: 'v1.1',
      active_state: 'LOCKED',
      pending: [],
      versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v1.1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1.1' }],
    },
    close: {
      active_version: 'v1',
      active_state: 'DRAFT',
      versions: [{ version: 'v1', state: 'DRAFT', file: 'Sigma/close/DIR-CLOSE-v1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
  });
}

function twoIndependentChains() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v1', state: 'INACTIVE', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
        { version: 'v2', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now, locked_at: now },
      ],
    },
    roadmap: {
      active_version: 'v2',
      active_state: 'ACTIVE',
      versions: [
        { version: 'v1', state: 'LOCKED', file: 'Sigma/build/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v2', state: 'ACTIVE', file: 'Sigma/build/ROADMAP-v2.md', created_at: now, updated_at: now, intent_version_ref: 'v2' },
      ],
    },
    plan: {
      active_version: 'v1.1',
      active_state: 'LOCKED',
      pending: [],
      versions: [
        { version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v2' },
      ],
    },
    exec: {
      active_version: 'v1.1',
      active_state: 'LOCKED',
      versions: [
        { version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v0.1' },
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1.1' },
      ],
    },
    close: {
      active_version: 'v1',
      active_state: 'DRAFT',
      versions: [
        { version: 'v1', state: 'DRAFT', file: 'Sigma/close/DIR-CLOSE-v1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
  });
}

describe('sigma intent supersede', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  // ── Guard checks ────────────────────────────────────────────────────────────

  it('fails when the intent version does not exist', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, fullLockedChain());

    const result = runCli('intent supersede --v v9 --reason "no such intent" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });

  it('fails when the intent version is DRAFT, not LOCKED or INACTIVE', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    fs.writeJsonSync(env.progressPath, makeProgress({
      intent: {
        active_version: 'v1',
        active_state: 'DRAFT',
        versions: [{ version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now }],
      },
    }));

    const result = runCli('intent supersede --v v1 --reason "testing" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/requires LOCKED or INACTIVE/i);
  });

  // ── Director-confirm gate (second code-enforced precedent after override.ts) ─

  it('refuses to execute without --director-confirm and leaves progress.json untouched', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, fullLockedChain());

    const result = runCli('intent supersede --v v1 --reason "pivot"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--director-confirm/);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.intent.versions[0].state).toBe('LOCKED');
    expect(data.roadmap.versions[0].state).toBe('LOCKED');
    expect(data.plan.versions[0].state).toBe('LOCKED');
    expect(data.exec.versions[0].state).toBe('LOCKED');
    expect(data.close.versions[0].state).toBe('DRAFT');
  });

  it('shows a preflight listing every artifact that will cascade, including LOCKED work, before requiring confirm', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, fullLockedChain());

    const result = runCli('intent supersede --v v1 --reason "pivot"', env.projectDir, env.homeDir);

    expect(result.stdout).toMatch(/Intent Supersede Preflight/);
    expect(result.stdout).toMatch(/ROADMAP v1 \[LOCKED\]/);
    expect(result.stdout).toMatch(/PLAN v1\.1 \[LOCKED\]/);
    expect(result.stdout).toMatch(/EXEC v1\.1 \[LOCKED\]/);
    expect(result.stdout).toMatch(/CLOSE v1 \[DRAFT\]/);
  });

  // ── Core cascade ────────────────────────────────────────────────────────────

  it('cascades SUPERSEDED to the full Roadmap/Plan/Exec/Close chain, including LOCKED entries', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, fullLockedChain());

    const result = runCli('intent supersede --v v1 --reason "scope pivot" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.intent.versions[0].state).toBe('SUPERSEDED');
    expect(data.intent.versions[0].supersede_reason).toBe('scope pivot');
    expect(data.roadmap.versions[0].state).toBe('SUPERSEDED');
    expect(data.plan.versions[0].state).toBe('SUPERSEDED');
    expect(data.exec.versions[0].state).toBe('SUPERSEDED');
    expect(data.close.versions[0].state).toBe('SUPERSEDED');

    // Cascaded entries carry a cascade reason, not their own superseded_by
    expect(data.roadmap.versions[0].supersede_reason).toMatch(/cascade/i);
    expect(data.plan.versions[0].supersede_reason).toMatch(/cascade/i);
    expect(data.exec.versions[0].supersede_reason).toMatch(/cascade/i);
    expect(data.close.versions[0].supersede_reason).toMatch(/cascade/i);
  });

  it('does not crash and reports no cascade when nothing references the target version', () => {
    env = setupTestEnv();
    const progress = fullLockedChain() as Record<string, any>;
    progress.roadmap = { active_version: null, active_state: null, versions: [] };
    progress.plan = { active_version: null, active_state: null, pending: [], versions: [] };
    progress.exec = { active_version: null, active_state: null, versions: [] };
    progress.close = { active_version: null, active_state: null, versions: [] };
    progress.gates = { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false };
    fs.writeJsonSync(env.progressPath, progress);

    const result = runCli('intent supersede --v v1 --reason "no descendants" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No downstream Roadmap\/Plan\/Exec\/Close artifacts/);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.intent.versions[0].state).toBe('SUPERSEDED');
  });

  // ── Principle C: downward-only, never leaks across chains ──────────────────

  it('does not touch an unrelated INTENT chain (two independent LOCKED/INACTIVE intents)', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, twoIndependentChains());

    const result = runCli('intent supersede --v v1 --reason "retire old complementary intent" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;

    // v1 chain cascades
    expect(data.intent.versions.find((v: any) => v.version === 'v1').state).toBe('SUPERSEDED');
    expect(data.roadmap.versions.find((v: any) => v.version === 'v1').state).toBe('SUPERSEDED');
    expect(data.plan.versions.find((v: any) => v.version === 'v0.1').state).toBe('SUPERSEDED');
    expect(data.exec.versions.find((v: any) => v.version === 'v0.1').state).toBe('SUPERSEDED');
    expect(data.close.versions.find((v: any) => v.version === 'v1').state).toBe('SUPERSEDED');

    // v2 chain is completely untouched
    expect(data.intent.versions.find((v: any) => v.version === 'v2').state).toBe('LOCKED');
    expect(data.roadmap.versions.find((v: any) => v.version === 'v2').state).toBe('ACTIVE');
    expect(data.plan.versions.find((v: any) => v.version === 'v1.1').state).toBe('LOCKED');
    expect(data.exec.versions.find((v: any) => v.version === 'v1.1').state).toBe('LOCKED');
  });

  it('sigma plan supersede does not change the state of the INTENT that governs it (downward-only)', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, fullLockedChain());

    const result = runCli('plan supersede --v v1.1 --reason "replan"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.plan.versions[0].state).toBe('SUPERSEDED');
    expect(data.intent.versions[0].state).toBe('LOCKED');
  });
});

// ── Regression: intent lock never auto-supersedes; reopen leaves prior CLOSE
// LOCKED as-is unless Director explicitly supersedes that INTENT chain ───────

describe('intent lock regression — no auto-supersede, no auto-cascade', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('reopen on a CLOSED project demotes the old INTENT to INACTIVE and leaves the old DIR-CLOSE LOCKED untouched', () => {
    env = setupTestEnv();
    const progress = makeProgressWithLockedExec() as Record<string, any>;
    const now = new Date().toISOString();
    progress.close = {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/close/DIR-CLOSE-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    };
    progress.lifecycle_state = 'CLOSED';
    fs.writeJsonSync(env.progressPath, progress);

    const reopened = runCli('intent new --yes', env.projectDir, env.homeDir);
    expect(reopened.exitCode).toBe(0);

    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v2.md'),
      validIntentDoc('v2')
    );

    const locked = runCli('intent lock', env.projectDir, env.homeDir);
    expect(locked.exitCode).toBe(0);

    const data = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(data.intent.versions.find((v: any) => v.version === 'v1').state).toBe('INACTIVE');
    expect(data.intent.versions.find((v: any) => v.version === 'v2').state).toBe('LOCKED');

    // The old DIR-CLOSE is left exactly as it was — no automatic cascade.
    expect(data.close.versions[0].state).toBe('LOCKED');
    expect(data.close.active_state).toBe('LOCKED');
  });
});
