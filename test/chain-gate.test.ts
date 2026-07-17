import { describe, it, expect, afterEach } from 'vitest';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChainWithDraftIntent,
  makeChainWithLockedIntent,
  makeChainWithLockedPlan,
  TestEnv,
} from './helpers';

describe('Chain gate: INTENT → PLAN → EXEC', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma plan new is blocked when INTENT is not locked (gate_1_open false)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent());

    const result = runCli('plan new --title "Test Stage" --focus "Test focus"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE 1 BLOCKED/i);
  });

  it('sigma exec new is blocked when PLAN is not locked (gate_2_open false)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent());

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE 2 BLOCKED/i);
  });

  it('sigma exec new is not blocked by Gate 2 when PLAN is locked', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan());

    // exec new will fail on missing template, but must NOT produce a Gate 2 block
    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.stderr).not.toMatch(/GATE 2 BLOCKED/i);
  });

  it('gates are enforced in order: INTENT gate blocks before PLAN gate', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    // No intent locked
    writeChainFixture(env, 'v1', makeChainWithDraftIntent());

    // exec new should hit gate_1 (via gate_2_open=false) — not pass silently
    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE/i);
  });
});
