import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import { setupTestEnv, runCli, makeProgress, TestEnv } from './helpers';

describe('Error message readability', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('gate block errors are human-readable, not raw stack traces', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('plan new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    // Must not emit a raw Node.js stack trace to stderr
    expect(result.stderr).not.toMatch(/at Object\.<anonymous>/);
    expect(result.stderr).not.toMatch(/at Module\._compile/);
    expect(result.stderr).not.toMatch(/\.ts:\d+:\d+\)/);
    // Must contain a human-readable message
    expect(result.stderr.trim().length).toBeGreaterThan(10);
  });

  it('unknown command error is human-readable', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('nonexistent-command', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    // Output should mention the unknown command without a stack trace
    const output = result.stdout + result.stderr;
    expect(output).not.toMatch(/at Object\.<anonymous>/);
    expect(output).not.toMatch(/at Module\._compile/);
  });

  it('missing progress.json produces a clear error, not a stack trace', () => {
    env = setupTestEnv();
    // Do NOT write progress.json — simulate running outside a Sigma project

    const result = runCli('project status', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    const output = result.stdout + result.stderr;
    expect(output).not.toMatch(/at Object\.<anonymous>/);
    expect(output).not.toMatch(/at Module\._compile/);
    // Should mention Sigma project or sigma project start
    expect(output).toMatch(/sigma/i);
  });
});
