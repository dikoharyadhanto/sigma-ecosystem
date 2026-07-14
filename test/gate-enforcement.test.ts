import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import { setupTestEnv, runCli, makeProgress, makeProgressWithLockedIntent, TestEnv } from './helpers';

describe('Gate enforcement', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma plan new fails when Gate 1 is blocked (no locked INTENT)', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('plan new --title "Test Stage" --focus "Test focus"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE 1 BLOCKED/i);
  });

  it('sigma plan new succeeds when Gate 1 is open (INTENT LOCKED)', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedIntent());

    // plan new also needs a template to copy — it will fail on missing template,
    // but Gate 1 must NOT be the cause of failure
    const result = runCli('plan new', env.projectDir, env.homeDir);

    // Exit code may be non-zero due to missing template, but must NOT say "GATE 1 BLOCKED"
    expect(result.stderr).not.toMatch(/GATE 1 BLOCKED/i);
  });

  it('sigma exec new fails when Gate 2 is blocked (no locked PLAN)', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedIntent());

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE 2 BLOCKED/i);
  });
});
