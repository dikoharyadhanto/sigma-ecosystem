import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  makeProgress,
  makeProgressWithDraftIntentAfterLockedChain,
  validIntentDoc,
  TestEnv,
} from './helpers';

describe('Progress hardening', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('blocks mutating commands when active_version has no matching version entry', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress({
      intent: { active_version: 'v9', active_state: 'DRAFT', versions: [] },
    }));

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Invalid progress\.json state/i);
    expect(result.stderr).toMatch(/Recovery:/i);
    expect(result.stderr).toMatch(/sigma session bootstrap/i);
  });

  it('blocks mutating commands when active_state disagrees with the active entry', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    fs.writeJsonSync(env.progressPath, makeProgress({
      intent: {
        active_version: 'v1',
        active_state: 'DRAFT',
        versions: [{ version: 'v1', state: 'LOCKED', created_at: now, updated_at: now, locked_at: now }],
      },
      gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
    }));

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/active_state/i);
    expect(result.stderr).toMatch(/Recovery:/i);
  });

  it('blocks impossible Gate 3 satisfaction without a clean locked chain', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress({
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: true },
    }));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/gates\.gate_3_satisfied repaired/i);
  });

  it('cso new remains standalone even when runtime state previously needed doctor reconciliation', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress({
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: true },
    }));

    runCli('doctor', env.projectDir, env.homeDir);
    const result = runCli('cso new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/CSO created/i);
  });

  it('allows a new draft intent while prior locked artifacts keep gates open', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntentAfterLockedChain());
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'design'));
    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v2.md'),
      validIntentDoc('v2')
    );

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    const planVersions = (updated as any).plan.versions as Array<Record<string, unknown>>;
    const execVersions = (updated as any).exec.versions as Array<Record<string, unknown>>;
    expect(planVersions[0].stale_intent).toBe(true);
    expect(execVersions[0].stale_intent).toBe(true);
  });
});
