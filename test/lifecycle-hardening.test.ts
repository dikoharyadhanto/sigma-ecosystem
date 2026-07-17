import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  makeProgressWithLockedPlan,
  makeProgressWithLockedExec,
  TestEnv,
} from './helpers';

describe('Lifecycle hardening coverage', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma project start seeds project structure', () => {
    env = setupTestEnv();

    const result = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(env.progressPath)).toBe(true);
    expect(fs.existsSync(path.join(env.sigmaDir, 'messages', 'index.json'))).toBe(true);
  });

  it('sigma session bootstrap reports gates and next operations from a locked chain', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedExec());

    const result = runCli('session bootstrap', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Lifecycle Phase:\s+BUILD/);
    expect(result.stdout).toMatch(/Gate 3 \(Build Evidence\):\s+SATISFIED/);
    expect(result.stdout).toMatch(/sigma close new/);
  });

  it('sigma close new creates a close draft for a clean locked chain', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedExec());

    const result = runCli('close new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]close[\\/]DIR-CLOSE-v1\.md/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'))).toBe(true);
  });

  it('sigma close new rejects a second draft for an INTENT that already has a non-superseded DIR-CLOSE', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedExec());

    const first = runCli('close new', env.projectDir, env.homeDir);
    expect(first.exitCode).toBe(0);

    const second = runCli('close new', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(1);
    expect(second.stderr).toMatch(/DIR-CLOSE already exists for INTENT/i);
  });

  it('sigma exec new skips exec version gaps caused by superseded plans', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    const planVersions = [];
    const execVersions = [];

    for (let minor = 1; minor <= 32; minor += 1) {
      planVersions.push({
        version: `v1.${minor}`,
        state: 'LOCKED',
        file: `Sigma/build/FMN-PLAN-v1.${minor}.md`,
        created_at: now,
        updated_at: now,
        locked_at: now,
        intent_version_ref: 'v2',
      });
      execVersions.push({
        version: `v1.${minor}`,
        state: 'LOCKED',
        file: `Sigma/build/DEV-EXEC-v1.${minor}.md`,
        created_at: now,
        updated_at: now,
        locked_at: now,
        plan_version_ref: `v1.${minor}`,
      });
    }

    planVersions.push({
      version: 'v1.33',
      state: 'SUPERSEDED',
      file: 'Sigma/build/FMN-PLAN-v1.33.md',
      created_at: now,
      updated_at: now,
      supersede_reason: 'replaced before execution',
      intent_version_ref: 'v2',
    });
    planVersions.push({
      version: 'v1.34',
      state: 'LOCKED',
      file: 'Sigma/build/FMN-PLAN-v1.34.md',
      created_at: now,
      updated_at: now,
      locked_at: now,
      intent_version_ref: 'v2',
    });
    execVersions.push({
      version: 'v1.34',
      state: 'LOCKED',
      file: 'Sigma/build/DEV-EXEC-v1.34.md',
      created_at: now,
      updated_at: now,
      locked_at: now,
      plan_version_ref: 'v1.34',
    });
    planVersions.push({
      version: 'v1.35',
      state: 'LOCKED',
      file: 'Sigma/build/FMN-PLAN-v1.35.md',
      created_at: now,
      updated_at: now,
      locked_at: now,
      intent_version_ref: 'v2',
    });

    const progress = makeProgressWithLockedPlan() as Record<string, any>;
    progress.intent = {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [{ version: 'v2', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now, locked_at: now }],
    };
    progress.plan = { active_version: 'v1.35', active_state: 'LOCKED', pending: [], versions: planVersions };
    progress.exec = { active_version: 'v1.34', active_state: 'LOCKED', versions: execVersions };
    fs.writeJsonSync(env.progressPath, progress);

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]build[\\/]DEV-EXEC-v1\.35\.md/);
    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.exec.versions.filter((v: Record<string, unknown>) => v.version === 'v1.34')).toHaveLength(1);
    expect(updated.exec.versions.some((v: Record<string, unknown>) => v.version === 'v1.35' && v.plan_version_ref === 'v1.35')).toBe(true);
  });

  it('sigma exec new refuses to overwrite an existing target artifact file', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedPlan());
    const target = path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v1.1.md');
    fs.writeFileSync(target, 'locked evidence must survive');

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/EXEC FILE CONFLICT/);
    expect(fs.readFileSync(target, 'utf8')).toBe('locked evidence must survive');
    const updated = fs.readJsonSync(env.progressPath) as Record<string, any>;
    expect(updated.exec.versions).toHaveLength(0);
  });
});
