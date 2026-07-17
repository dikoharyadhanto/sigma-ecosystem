import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import {
  setupTestEnv,
  runCli,
  makeProgress,
  stubProjectRootAnchor,
  writeChainFixture,
  chainPath,
  TestEnv,
} from './helpers';

// Coverage for PLAN-EVAL-01 Bagian B.1/B.2:
// - `sigma project reset` no longer exists (removed in favor of `sigma doctor`).
// - `sigma doctor --recovery` is an explicit alias for the default behavior.

describe('sigma project reset is removed', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('rejects `sigma project reset` as an unknown subcommand', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
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
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.0.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      // Gate drift: intent is LOCKED but gate_1_open wasn't updated —
      // structurally-representable corruption for a single-object intent
      // (the old "active_state disagrees with versions[]" scenario no
      // longer exists, PLAN-EVAL-01 §3.4).
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('doctor --recovery', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/gates\.gate_1_open repaired/i);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(updated.gates.gate_1_open).toBe(true);
  });
});
