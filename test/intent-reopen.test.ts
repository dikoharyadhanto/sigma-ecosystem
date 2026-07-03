import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import {
  makeProgressWithLockedExec,
  runCli,
  setupTestEnv,
  TestEnv,
} from './helpers';

describe('intent new on a CLOSED project', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  function closedProgress() {
    const progress = makeProgressWithLockedExec() as Record<string, unknown>;
    progress.lifecycle_state = 'CLOSED';
    return progress;
  }

  it('shows the reopen preflight and cancels when not approved', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, closedProgress());

    const result = runCli('intent new', env.projectDir, env.homeDir, 'n\n');

    expect(result.stdout).toMatch(/Reopen Preflight/);
    expect(result.stdout).toMatch(/CLOSED/);
    expect(result.stdout).toMatch(/cancelled/i);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.intent.versions).toHaveLength(1);
    expect(updated.intent.active_version).toBe('v1');
    expect(updated.lifecycle_state).toBe('CLOSED');
  });

  it('succeeds with --yes and reports the new work cycle', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, closedProgress());

    const result = runCli('intent new --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Reopen Preflight/);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.intent.active_version).toBe('v2');
    expect(updated.intent.active_state).toBe('DRAFT');
  });
});
