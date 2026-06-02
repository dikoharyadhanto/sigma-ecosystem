import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  makeProgressWithDraftIntent,
  makeProgressWithLockedIntent,
  runCli,
  setupTestEnv,
  TestEnv,
} from './helpers';

describe('Document checks and auto-validation', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('intent new auto-runs validation after file creation', () => {
    env = setupTestEnv();
    const progress = makeProgressWithDraftIntent() as Record<string, unknown>;
    progress.intent = { active_version: null, active_state: null, versions: [] };
    progress.gates = { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false };
    fs.writeJsonSync(env.progressPath, progress);

    const result = runCli('intent new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Running automatic validation/);
    expect(result.stdout).toMatch(/Sigma Intent Check/);
    expect(result.stdout).toMatch(/\[PASS\] Document marker found/);
    expect(result.stdout).toMatch(/Result: OK/);
  });

  it('intent check passes for a template-generated draft', () => {
    env = setupTestEnv();
    const progress = makeProgressWithDraftIntent() as Record<string, unknown>;
    progress.intent = { active_version: null, active_state: null, versions: [] };
    progress.gates = { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false };
    fs.writeJsonSync(env.progressPath, progress);

    const created = runCli('intent new', env.projectDir, env.homeDir);
    expect(created.exitCode).toBe(0);

    const checked = runCli('intent check', env.projectDir, env.homeDir);
    expect(checked.exitCode).toBe(0);
    expect(checked.stdout).toMatch(/Lock readiness: Eligible/);
  });

  it('intent lock is blocked when required markers are missing', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, '# DIR-INTENT\n\n## 1. Intent Core — Sovereign Layer\n');

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Sigma Intent Check failed/);
    expect(result.stdout).toMatch(/\[ERROR\] Missing document marker/);
    expect(result.stdout).toMatch(/Lock readiness: Not eligible/);
  });

  it('roadmap new auto-runs validation for created roadmap docs', () => {
    env = setupTestEnv();
    const progress = makeProgressWithLockedIntent() as Record<string, any>;
    fs.writeJsonSync(env.progressPath, progress);

    const result = runCli('roadmap new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Running automatic validation/);
    expect(result.stdout).toMatch(/Sigma Roadmap Check/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'build', 'ROADMAP-v1.md'))).toBe(true);
  });
});
