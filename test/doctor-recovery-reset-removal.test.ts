import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import { setupTestEnv, runCli, makeProgress, TestEnv } from './helpers';

// Coverage for PLAN-EVAL-01 Bagian B.1/B.2:
// - `sigma project reset` no longer exists (removed in favor of `sigma doctor`).
// - `sigma doctor --recovery` is an explicit alias for the default behavior.

describe('sigma project reset is removed', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('rejects `sigma project reset` as an unknown subcommand', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('project reset --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/unknown command/i);
  });
});

describe('sigma doctor --recovery', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('behaves identically to plain `sigma doctor`', () => {
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

    const result = runCli('doctor --recovery', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/intent\.active_state repaired/i);
    expect(result.stdout).toMatch(/gates\.gate_1_open repaired/i);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.intent.active_state).toBe('LOCKED');
    expect(updated.gates.gate_1_open).toBe(true);
  });
});
