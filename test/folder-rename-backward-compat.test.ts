import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectIdentity,
  writeChainFixture,
  makeChain,
  validIntentDoc,
  validPlanDoc,
  validExecDoc,
  TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-ARTIFACT-FOLDER-RENAME-20260816 §3.3 Fase 3 — proves the
// rename does not break a chain created under the old folder names. Every
// path-resolving command prioritizes the chain's own stored `entry.file`
// over any folder-name-derived fallback; these tests exercise that against
// a fixture that looks exactly like a pre-rename project, using the new
// binary, with no migration step run.

describe('Folder rename — old-style chains keep working unmigrated', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('intent check reads DIR-INTENT from the old Sigma/design/ path via stored entry.file', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'design'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('intent check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/ENOENT|not found/i);
  });

  it('plan check reads FMN-PLAN from the old Sigma/build/ path via stored entry.file', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
      plan: {
        active_version: 'v1.1', active_state: 'DRAFT', pending: [],
        versions: [{ version: 'v1.1', state: 'DRAFT', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' }],
      },
    }));
    stubProjectIdentity(env);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'build'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'build', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));

    const result = runCli('plan check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/ENOENT|not found/i);
  });

  it('exec check reads DEV-EXEC from the old Sigma/build/ path via stored entry.file', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
      plan: {
        active_version: 'v1.1', active_state: 'LOCKED', pending: [],
        versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
      },
      exec: {
        active_version: 'v1.1', active_state: 'DRAFT',
        versions: [{ version: 'v1.1', state: 'DRAFT', file: 'Sigma/build/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1' }],
      },
    }));
    stubProjectIdentity(env);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'build'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v1.1.md'), validExecDoc('v1.1', 'v1.1'));

    const result = runCli('exec check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/ENOENT|not found/i);
  });

  it('roadmap check reads ROADMAP from the old Sigma/build/ path via stored entry.file', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
      roadmap: { version: 'v1', state: 'DRAFT', file: 'Sigma/build/ROADMAP-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'build'));
    fs.copySync(
      path.join(__dirname, '..', 'Sigma', 'templates', 'ROADMAP-TEMPLATE.md'),
      path.join(env.projectDir, 'Sigma', 'build', 'ROADMAP-v1.md')
    );

    const result = runCli('roadmap check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/ENOENT|not found/i);
  });
});

describe('Folder rename — new projects use the new folder names by default', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('sigma project start pre-creates the renamed folders, not the old ones', () => {
    env = setupTestEnv();
    fs.removeSync(env.sigmaDir); // setupTestEnv() pre-creates old-style folders; start fresh

    const result = runCli('project start --id RENAMETEST --name "Rename Test" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    for (const folder of ['charter', 'contract', 'roadmap', 'evidence', 'close', 'human', 'notes']) {
      expect(fs.existsSync(path.join(env.sigmaDir, folder)), `Sigma/${folder}/ should exist`).toBe(true);
    }
    expect(fs.existsSync(path.join(env.sigmaDir, 'design'))).toBe(false);
    expect(fs.existsSync(path.join(env.sigmaDir, 'build'))).toBe(false);
  });

  it('intent new writes DIR-INTENT under Sigma/charter/, not Sigma/design/', () => {
    env = setupTestEnv();
    fs.removeSync(env.sigmaDir);
    runCli('project start --id RENAMETEST --name "Rename Test" --confirm', env.projectDir, env.homeDir);

    const result = runCli('intent new --title "T" --focus "F"', env.projectDir, env.homeDir);

    expect(result.stdout).toMatch(/Created: Sigma[/\\]charter[/\\]DIR-INTENT-v1\.md/);
    expect(fs.existsSync(path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v1.md'))).toBe(true);
  });
});
