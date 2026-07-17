import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { setupTestEnv, runCli, makeProgress, stubProjectRootAnchor, TestEnv } from './helpers';

// Coverage for Implementation/planned_sigma_evaluation_2026_07_15/PLAN-EVAL-01:
// Sigma/logs/operations.jsonl must record every CLI invocation at the local
// project level (success and failure alike), and must be regenerated
// (with .sigma-identity.json's logs_created_at updated) whenever it is
// missing or corrupt.

function readEntries(sigmaDir: string): Array<{ operation: string; status: string; exit_code: number; timestamp: string }> {
  const filePath = path.join(sigmaDir, 'logs', 'operations.jsonl');
  const content = fs.readFileSync(filePath, 'utf8');
  return content.split('\n').filter(l => l.trim().length > 0).map(l => JSON.parse(l));
}

describe('sigma operation history log', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('records a successful operation with status success and exit_code 0', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('doctor', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const entries = readEntries(env.sigmaDir);
    expect(entries.length).toBe(1);
    expect(entries[0].operation).toBe('doctor');
    expect(entries[0].status).toBe('success');
    expect(entries[0].exit_code).toBe(0);
    expect(typeof entries[0].timestamp).toBe('string');
  });

  it('records a failed operation (process.exit(1) inside the handler) with status error', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    fs.writeJsonSync(env.progressPath, makeProgress());

    // No --reason: runOverride() exits(1) directly, never throws — the exact
    // case a postAction-only hook would miss.
    const result = runCli('override', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);

    const entries = readEntries(env.sigmaDir);
    expect(entries.length).toBe(1);
    expect(entries[0].operation).toBe('override');
    expect(entries[0].status).toBe('error');
    expect(entries[0].exit_code).toBe(1);
  });

  it('records nested subcommands with their full command path', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('intent status', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const entries = readEntries(env.sigmaDir);
    expect(entries[0].operation).toBe('intent status');
  });

  it('regenerates a missing log and stamps a fresh logs_created_at, preserving it across valid calls', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    fs.writeJsonSync(env.progressPath, makeProgress());

    const first = runCli('project register --id TEST --name "Test Project"', env.projectDir, env.homeDir);
    expect(first.exitCode).toBe(0);

    const identityPath = path.join(env.projectDir, '.sigma-identity.json');
    const identityAfterFirst = fs.readJsonSync(identityPath);
    expect(typeof identityAfterFirst.logs_created_at).toBe('string');

    // Log was missing before this call, so ensureOperationsLog wiped it
    // clean before the register operation's own entry was appended.
    let entries = readEntries(env.sigmaDir);
    expect(entries.length).toBe(1);
    expect(entries[0].operation).toBe('project register');

    // Second call: log is still valid, so it must not be reinitialized —
    // logs_created_at stays the same and the entry accumulates.
    const second = runCli('project register --id TEST --name "Test Project"', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(0);

    const identityAfterSecond = fs.readJsonSync(identityPath);
    expect(identityAfterSecond.logs_created_at).toBe(identityAfterFirst.logs_created_at);

    entries = readEntries(env.sigmaDir);
    expect(entries.length).toBe(2);

    // Corrupt the log, then register again: it must be regenerated (old
    // entries lost, by design) and logs_created_at must move forward.
    const logPath = path.join(env.sigmaDir, 'logs', 'operations.jsonl');
    fs.writeFileSync(logPath, 'not valid json\n', 'utf8');

    const third = runCli('project register --id TEST --name "Test Project"', env.projectDir, env.homeDir);
    expect(third.exitCode).toBe(0);

    const identityAfterThird = fs.readJsonSync(identityPath);
    expect(identityAfterThird.logs_created_at).not.toBe(identityAfterFirst.logs_created_at);

    entries = readEntries(env.sigmaDir);
    expect(entries.length).toBe(1);
    expect(entries[0].operation).toBe('project register');
  });

  it('does not create Sigma/ or crash when run outside a Sigma project', () => {
    const bareDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-bare-'));
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-home-'));
    try {
      const result = runCli('project status', bareDir, homeDir);
      expect(result.exitCode).not.toBe(0);
      expect(fs.existsSync(path.join(bareDir, 'Sigma'))).toBe(false);
    } finally {
      fs.removeSync(bareDir);
      fs.removeSync(homeDir);
    }
  });
});
