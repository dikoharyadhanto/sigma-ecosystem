import { afterEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { runCli, setupTestEnv, stubProjectRootAnchor, TestEnv } from './helpers';

const ROOT = path.resolve(__dirname, '..');

describe('F01 asset consistency', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('records each role rule exact-byte hash in master role memory', () => {
    for (const role of ['ARC', 'FMN', 'DEV', 'AUD']) {
      const rule = fs.readFileSync(path.join(ROOT, 'Sigma', 'rules', role + '-RULE.md'));
      const memory = fs.readJsonSync(path.join(ROOT, 'Sigma', 'role-memory', role.toLowerCase() + '-memory.json'));
      expect(memory.source_rule_version).toBe('sha256:' + crypto.createHash('sha256').update(rule).digest('hex'));
    }
  });

  it('reports project drift without writing an operation log or changing the target', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const target = path.join(env.sigmaDir, 'SIGMA-OPERATION-REGISTRY.json');
    fs.writeFileSync(target, 'local registry');
    const before = fs.readFileSync(target);
    const report = runCli('doctor --check-assets', env.projectDir, env.homeDir);
    expect(report.exitCode).toBe(0);
    expect(report.stdout).toContain('[master-project] DIFF Sigma/SIGMA-OPERATION-REGISTRY.json');
    expect(fs.readFileSync(target)).toEqual(before);
    expect(fs.existsSync(path.join(env.sigmaDir, 'logs', 'operations.jsonl'))).toBe(false);
  });

  it('requires a fresh per-file token and backs up accepted replacements', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const target = path.join(env.sigmaDir, 'SIGMA-OPERATION-REGISTRY.json');
    const oldBytes = 'local registry';
    fs.writeFileSync(target, oldBytes);
    const preview = runCli('project sync', env.projectDir, env.homeDir);
    expect(preview.exitCode).toBe(0);
    const line = preview.stdout.split('\n').find(value => value.includes('DIFF Sigma/SIGMA-OPERATION-REGISTRY.json'));
    const token = line?.match(/accept=([0-9a-f]{64})/)?.[1];
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const blocked = runCli('project sync --confirm', env.projectDir, env.homeDir);
    expect(blocked.exitCode).not.toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe(oldBytes);
    expect(fs.existsSync(path.join(env.projectDir, '.mcp.json'))).toBe(false);

    fs.writeFileSync(target, 'changed after preview');
    const stale = runCli('project sync --confirm --accept ' + token, env.projectDir, env.homeDir);
    expect(stale.exitCode).not.toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe('changed after preview');

    const fresh = runCli('project sync', env.projectDir, env.homeDir);
    const freshLine = fresh.stdout.split('\n').find(value => value.includes('DIFF Sigma/SIGMA-OPERATION-REGISTRY.json'));
    const freshToken = freshLine?.match(/accept=([0-9a-f]{64})/)?.[1];
    expect(freshToken).toMatch(/^[0-9a-f]{64}$/);
    const accepted = runCli('project sync --confirm --accept ' + freshToken, env.projectDir, env.homeDir);
    expect(accepted.exitCode).toBe(0);
    expect(fs.readFileSync(target)).toEqual(fs.readFileSync(path.join(ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json')));
    const backupDir = accepted.stdout.match(/Previous files backed up at: (.+)/)?.[1]?.trim();
    expect(backupDir).toBeTruthy();
    expect(fs.readFileSync(path.join(backupDir!, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'), 'utf8'))
      .toBe('changed after preview');
  });

  it('blocks reinitialization when a managed file has local changes', () => {
    env = setupTestEnv();
    const started = runCli('project start --id TEST --name Test --confirm', env.projectDir, env.homeDir);
    expect(started.exitCode).toBe(0);
    const target = path.join(env.sigmaDir, 'SIGMA-OPERATION-REGISTRY.json');
    fs.writeFileSync(target, 'local registry');
    const reinit = runCli('project start --id TEST --name Test --confirm --reinit', env.projectDir, env.homeDir);
    expect(reinit.exitCode).not.toBe(0);
    expect(fs.readFileSync(target, 'utf8')).toBe('local registry');
  });
});
