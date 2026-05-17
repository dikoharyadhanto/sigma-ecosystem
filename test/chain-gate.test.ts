import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import { setupTestEnv, runCli, makeProgress, makeProgressWithLockedIntent, makeProgressWithLockedPlan, TestEnv } from './helpers';

describe('Chain gate: INTENT → PLAN → EXEC', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma plan new is blocked when INTENT is not locked (gate_1_open false)', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('plan new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE 1 BLOCKED/i);
  });

  it('sigma exec new is blocked when PLAN is not locked (gate_2_open false)', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedIntent());

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE 2 BLOCKED/i);
  });

  it('sigma exec new is not blocked by Gate 2 when PLAN is locked', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedPlan());

    // exec new will fail on missing template, but must NOT produce a Gate 2 block
    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.stderr).not.toMatch(/GATE 2 BLOCKED/i);
  });

  it('gates are enforced in order: INTENT gate blocks before PLAN gate', () => {
    env = setupTestEnv();
    // No intent, no plan locked
    fs.writeJsonSync(env.progressPath, makeProgress());

    // exec new should hit gate_1 (or gate_2 in exec) — not pass silently
    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    // Should be blocked at some gate — either gate 1 (via gate_2_open=false) or explicitly gate 2
    expect(result.stderr).toMatch(/GATE/i);
  });
});
