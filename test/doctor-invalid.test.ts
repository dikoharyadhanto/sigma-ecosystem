import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import {
  setupTestEnv,
  runCli,
  makeProgress,
  makeProgressWithLockedIntent,
  makeProgressWithLockedPlan,
  makeProgressWithLockedExec,
  stubLegacyProgressJson,
  writeChainFixture,
  makeChainWithLockedPlan,
  chainPath,
  TestEnv,
} from './helpers';

describe('Sigma doctor and INVALID recovery mode', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('doctor repairs active_state and gate drift automatically', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    fs.writeJsonSync(env.progressPath, makeProgress({
      lifecycle_state: 'BUILD',
      intent: {
        active_version: 'v1',
        active_state: 'DRAFT',
        versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
      },
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    }));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Repaired/);
    expect(result.stdout).toMatch(/intent\.active_state repaired/i);
    expect(result.stdout).toMatch(/gates\.gate_1_open repaired/i);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.intent.active_state).toBe('LOCKED');
    expect(updated.gates.gate_1_open).toBe(true);
    expect(updated.runtime_invalid.markers).toHaveLength(0);
  });

  it('doctor marks unresolved broken references as INVALID', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    fs.writeJsonSync(env.progressPath, makeProgress({
      lifecycle_state: 'BUILD',
      intent: {
        active_version: 'v1',
        active_state: 'LOCKED',
        versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
      },
      plan: {
        active_version: 'v1.1',
        active_state: 'LOCKED',
        pending: [],
        versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v9' }],
      },
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    }));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Marked INVALID/);
    expect(result.stdout).toMatch(/references missing INTENT/i);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.runtime_invalid.markers.length).toBeGreaterThan(0);
  });

  it('project status surfaces INVALID warnings after doctor', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    fs.writeJsonSync(env.progressPath, makeProgress({
      lifecycle_state: 'BUILD',
      plan: {
        active_version: 'v1.1',
        active_state: 'LOCKED',
        pending: [],
        versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v9' }],
      },
    }));

    runCli('doctor', env.projectDir, env.homeDir);
    const status = runCli('project status', env.projectDir, env.homeDir);

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toMatch(/INVALID Runtime Warnings/);
    expect(status.stdout).toMatch(/\[INVALID\]/);
  });

  it('exec new can proceed in invalid recovery mode when a locked plan still exists', () => {
    // `doctor` (the command that normally produces this state via
    // reconciliation) is not yet migrated to chain.ts (PLAN-EVAL-01 Fase 4)
    // — the corrupted-but-marked-INVALID chain state is constructed
    // directly here instead of round-tripping through `sigma doctor`.
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    const chain = makeChainWithLockedPlan() as Record<string, any>;
    chain.runtime_invalid = {
      markers: [{
        id: 'plan:manual-invalid',
        domain: 'plan',
        status: 'INVALID',
        reason: 'manual test invalid marker',
        gate: 'gate_2_open',
        chain: { intent_version: 'v1', plan_version: 'v1.1', exec_version: null },
        first_detected_at: new Date().toISOString(),
        last_detected_at: new Date().toISOString(),
      }],
      last_doctor_run_at: new Date().toISOString(),
    };
    writeChainFixture(env, 'v1', chain);

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]build[\\/]DEV-EXEC-v1\.1\.md/);
    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(updated.exec.versions).toHaveLength(1);
  });

  it('doctor removes duplicate DRAFT exec when a LOCKED exec with the same version exists', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    const progress = makeProgressWithLockedExec() as Record<string, any>;
    progress.exec.versions.push({
      version: 'v0.1',
      state: 'DRAFT',
      file: 'Sigma/build/DEV-EXEC-v0.1.md',
      created_at: now,
      updated_at: now,
      plan_version_ref: 'v1',
    });
    progress.exec.active_version = 'v0.1';
    progress.exec.active_state = 'DRAFT';
    fs.writeJsonSync(env.progressPath, progress);

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/duplicate DRAFT/);
    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.exec.versions.filter((v: Record<string, unknown>) => v.version === 'v0.1')).toHaveLength(1);
    expect(updated.exec.versions[0].state).toBe('LOCKED');
    expect(updated.exec.active_state).toBe('LOCKED');
    expect(updated.runtime_invalid.markers).toHaveLength(0);
  });
});
