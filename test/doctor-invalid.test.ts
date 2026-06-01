import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  makeProgress,
  makeProgressWithLockedIntent,
  makeProgressWithLockedPlan,
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

  it('exec new can proceed in invalid recovery mode when gate tracker was relaxed by doctor and a locked plan still exists', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedPlan());
    const progress = fs.readJsonSync(env.progressPath) as Record<string, any>;
    progress.plan.active_state = 'DRAFT';
    progress.gates.gate_2_open = false;
    fs.writeJsonSync(env.progressPath, progress, { spaces: 2 });

    runCli('doctor', env.projectDir, env.homeDir);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    updated.runtime_invalid.markers.push({
      id: 'plan:manual-invalid',
      domain: 'plan',
      status: 'INVALID',
      reason: 'manual test invalid marker',
      gate: 'gate_2_open',
      chain: { intent_version: 'v1', plan_version: 'v1', exec_version: null },
      first_detected_at: new Date().toISOString(),
      last_detected_at: new Date().toISOString(),
    });
    fs.writeJsonSync(env.progressPath, updated, { spaces: 2 });

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]build[\\/]DEV-EXEC-v1\.1\.md/);
  });

  it('cso new works without --role', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('cso new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/CSO created/i);

    const logsDir = path.join(env.projectDir, 'Sigma', 'logs');
    const files = fs.readdirSync(logsDir);
    expect(files.some(file => /^CSO-\d{8}-\d{4}\.md$/.test(file))).toBe(true);
  });
});
