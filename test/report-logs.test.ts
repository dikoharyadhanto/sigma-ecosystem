import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { setupTestEnv, runCli, makeProgress, TestEnv } from './helpers';

// Coverage for Implementation/planned_sigma_evaluation_2026_07_15/PLAN-EVAL-01
// follow-up: `sigma report logs` reads Sigma/logs/operations.jsonl and
// renders/filters it for Director review.

function writeRawLog(sigmaDir: string, lines: object[]): void {
  const filePath = path.join(sigmaDir, 'logs', 'operations.jsonl');
  fs.writeFileSync(filePath, lines.map(l => JSON.stringify(l)).join('\n') + '\n', 'utf8');
}

describe('sigma report logs', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('prints formatted log lines with SUCCESS/ERROR labels', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    writeRawLog(env.sigmaDir, [
      { operation: 'intent status', timestamp: '2026-07-15T10:00:00.000Z', status: 'success', exit_code: 0 },
      { operation: 'override', timestamp: '2026-07-15T10:01:00.000Z', status: 'error', exit_code: 1 },
    ]);

    const result = runCli('report logs', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\[2026-07-15T10:00:00\.000Z\] SUCCESS\s+intent status/);
    expect(result.stdout).toMatch(/\[2026-07-15T10:01:00\.000Z\] ERROR\s+override \(exit 1\)/);
  });

  it('--status filters to only matching entries', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    writeRawLog(env.sigmaDir, [
      { operation: 'intent status', timestamp: '2026-07-15T10:00:00.000Z', status: 'success', exit_code: 0 },
      { operation: 'override', timestamp: '2026-07-15T10:01:00.000Z', status: 'error', exit_code: 1 },
    ]);

    const result = runCli('report logs --status error', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/intent status/);
    expect(result.stdout).toMatch(/override/);
  });

  it('--operation filters by substring match', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    writeRawLog(env.sigmaDir, [
      { operation: 'intent status', timestamp: '2026-07-15T10:00:00.000Z', status: 'success', exit_code: 0 },
      { operation: 'plan check', timestamp: '2026-07-15T10:01:00.000Z', status: 'success', exit_code: 0 },
    ]);

    const result = runCli('report logs --operation intent', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/intent status/);
    expect(result.stdout).not.toMatch(/plan check/);
  });

  it('--limit shows only the last N matching entries', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    writeRawLog(env.sigmaDir, [
      { operation: 'a', timestamp: '2026-07-15T10:00:00.000Z', status: 'success', exit_code: 0 },
      { operation: 'b', timestamp: '2026-07-15T10:01:00.000Z', status: 'success', exit_code: 0 },
      { operation: 'c', timestamp: '2026-07-15T10:02:00.000Z', status: 'success', exit_code: 0 },
    ]);

    // The file is read (and --limit applied) before this invocation's own
    // "report logs" entry is appended at process exit, so only the 3
    // pre-seeded entries are visible here — --limit 1 keeps just "c".
    const result = runCli('report logs --limit 1', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split('\n').filter(l => l.length > 0);
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatch(/\bc\b/);
  });

  it('--since/--until bound the time range', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    writeRawLog(env.sigmaDir, [
      { operation: 'old-op', timestamp: '2000-01-01T00:00:00.000Z', status: 'success', exit_code: 0 },
      { operation: 'new-op', timestamp: '2026-07-15T10:00:00.000Z', status: 'success', exit_code: 0 },
    ]);

    const sinceResult = runCli('report logs --since 2020-01-01', env.projectDir, env.homeDir);
    expect(sinceResult.stdout).not.toMatch(/old-op/);
    expect(sinceResult.stdout).toMatch(/new-op/);

    const untilResult = runCli('report logs --until 2010-01-01', env.projectDir, env.homeDir);
    expect(untilResult.stdout).toMatch(/old-op/);
    expect(untilResult.stdout).not.toMatch(/new-op/);
  });

  it('--json prints raw JSONL instead of formatted lines', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    writeRawLog(env.sigmaDir, [
      { operation: 'intent status', timestamp: '2026-07-15T10:00:00.000Z', status: 'success', exit_code: 0 },
    ]);

    const result = runCli('report logs --json --operation intent', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    const firstLine = result.stdout.trim().split('\n')[0];
    const parsed = JSON.parse(firstLine);
    expect(parsed).toEqual({
      operation: 'intent status',
      timestamp: '2026-07-15T10:00:00.000Z',
      status: 'success',
      exit_code: 0,
    });
  });

  it('rejects an invalid --status value with exit code 1', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('report logs --status bogus', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Invalid --status value/);
  });

  it('rejects an invalid --limit value with exit code 1', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('report logs --limit abc', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Invalid --limit value/);
  });

  it('reports "No matching operations found." when the log is empty', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('report logs', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No matching operations found\./);
  });

  it('fails cleanly outside a Sigma project', () => {
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-bare-'));
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-home-'));
    try {
      const result = runCli('report logs', bareDir, homeDir);
      expect(result.exitCode).not.toBe(0);
    } finally {
      fs.removeSync(bareDir);
      fs.removeSync(homeDir);
    }
  });
});
