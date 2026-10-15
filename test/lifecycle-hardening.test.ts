import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  stubProjectIdentity,
  writeChainFixture,
  makeChain,
  makeChainWithLockedPlan,
  makeChainWithLockedExec,
  writeProductReview,
  chainPath,
  TestEnv,
} from './helpers';

describe('Lifecycle hardening coverage', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma project start seeds project structure', () => {
    env = setupTestEnv();

    const result = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(env.activateStatusPath)).toBe(true);
    expect(fs.existsSync(env.progressPath)).toBe(false);
    expect(fs.existsSync(path.join(env.sigmaDir, 'messages', 'index.json'))).toBe(true);
  });

  it('sigma project start initializes local Git only when --init-git is explicit', () => {
    env = setupTestEnv();

    const withoutGit = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(withoutGit.exitCode).toBe(0);
    expect(fs.existsSync(path.join(env.projectDir, '.git'))).toBe(false);
    expect(withoutGit.stdout).toMatch(/project remains valid without Git/i);

    env.cleanup();
    env = setupTestEnv();
    const withGit = runCli('project start --id TEST --name "Test Project" --confirm --init-git', env.projectDir, env.homeDir);

    expect(withGit.exitCode).toBe(0);
    expect(fs.existsSync(path.join(env.projectDir, '.git'))).toBe(true);
    expect(withGit.stdout).toMatch(/local repository initialized/i);
  });

  it('sigma project start reuses an existing local Git repository', () => {
    env = setupTestEnv();
    execFileSync('git', ['init'], { cwd: env.projectDir, stdio: 'pipe' });

    const result = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/existing local repository detected/i);
  });

  it('sigma session bootstrap reports gates and next operations from a locked chain', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec());

    const result = runCli('session bootstrap', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Lifecycle Phase:\s+BUILD/);
    expect(result.stdout).toMatch(/Gate 3 \(Build Evidence\):\s+SATISFIED/);
    expect(result.stdout).toMatch(/sigma close new/);
  });

  it('sigma close new creates a close draft for a clean locked chain', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    writeProductReview(env);

    const result = runCli('close new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]close[\\/]CLOSE-v1\.md/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'close', 'CLOSE-v1.md'))).toBe(true);
  });

  it('sigma close new is refused while the PRODUCT REVIEW does not exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));

    const check = runCli('close check', env.projectDir, env.homeDir);
    expect(check.exitCode).toBe(1);
    expect(check.stdout).toMatch(/PRODUCT REVIEW MISSING/);
    expect(check.stdout).toMatch(/Closure readiness: Not eligible/);

    const result = runCli('close new', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/PRODUCT REVIEW MISSING/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'close', 'CLOSE-v1.md'))).toBe(false);
  });

  it('sigma close new accepts only PASS or PASS_WITH_RISK from every required party', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    writeProductReview(env, { arc: 'PASS', aud: 'REVISE', director: 'PASS' });

    const refused = runCli('close new', env.projectDir, env.homeDir);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toMatch(/PRODUCT REVIEW NOT ACCEPTED/);
    expect(refused.stderr).toMatch(/AUD: verdict is REVISE/);

    // AUD skipped with the Director's verbatim instruction: ARC and Director are enough.
    writeProductReview(env, { arc: 'PASS', aud: 'SKIP_FOR_AUDIT', director: 'PASS_WITH_RISK', risks: { director: 'Operator training is not covered.' } });
    const check = runCli('close check', env.projectDir, env.homeDir);
    expect(check.exitCode).toBe(0);
    expect(check.stdout).toMatch(/AUD:\s+SKIP_FOR_AUDIT/);
    expect(check.stdout).toMatch(/PASS_WITH_RISK is present/);
    expect(check.stdout).toMatch(/Operator training is not covered\./);
    expect(check.stdout).toMatch(/Closure readiness: Eligible with PASS_WITH_RISK/);

    const created = runCli('close new', env.projectDir, env.homeDir);
    expect(created.exitCode).toBe(0);
  });

  it('sigma close new rejects a second draft for a chain that already has a non-superseded DIR-CLOSE', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    writeProductReview(env);

    const first = runCli('close new', env.projectDir, env.homeDir);
    expect(first.exitCode).toBe(0);

    const second = runCli('close new', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(1);
    expect(second.stderr).toMatch(/DIR-CLOSE already exists for this chain/i);
  });

  it('sigma exec new skips exec version gaps caused by superseded plans', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    const planVersions = [];
    const execVersions = [];

    for (let minor = 1; minor <= 32; minor += 1) {
      planVersions.push({
        version: `v1.${minor}`,
        state: 'LOCKED',
        file: `Sigma/contract/FMN-PLAN-v1.${minor}.md`,
        created_at: now,
        updated_at: now,
        locked_at: now,
        intent_version_ref: 'v2',
      });
      execVersions.push({
        version: `v1.${minor}`,
        state: 'LOCKED',
        file: `Sigma/evidence/DEV-EXEC-v1.${minor}.md`,
        created_at: now,
        updated_at: now,
        locked_at: now,
        plan_version_ref: `v1.${minor}`,
      });
    }

    planVersions.push({
      version: 'v1.33',
      state: 'SUPERSEDED',
      file: 'Sigma/contract/FMN-PLAN-v1.33.md',
      created_at: now,
      updated_at: now,
      supersede_reason: 'replaced before execution',
      intent_version_ref: 'v2',
    });
    planVersions.push({
      version: 'v1.34',
      state: 'LOCKED',
      file: 'Sigma/contract/FMN-PLAN-v1.34.md',
      created_at: now,
      updated_at: now,
      locked_at: now,
      intent_version_ref: 'v2',
    });
    execVersions.push({
      version: 'v1.34',
      state: 'LOCKED',
      file: 'Sigma/evidence/DEV-EXEC-v1.34.md',
      created_at: now,
      updated_at: now,
      locked_at: now,
      plan_version_ref: 'v1.34',
    });
    planVersions.push({
      version: 'v1.35',
      state: 'LOCKED',
      file: 'Sigma/contract/FMN-PLAN-v1.35.md',
      created_at: now,
      updated_at: now,
      locked_at: now,
      intent_version_ref: 'v2',
    });

    // Chain "v2" — the old fixture's intent major (kept as-is; chain naming
    // doesn't need to start at v1).
    const chain = makeChain('v2', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v2', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v2.md', created_at: now, updated_at: now, locked_at: now },
      plan: { active_version: 'v1.35', active_state: 'LOCKED', pending: [], versions: planVersions },
      exec: { active_version: 'v1.34', active_state: 'LOCKED', versions: execVersions },
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    });
    writeChainFixture(env, 'v2', chain);

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]evidence[\\/]EXEC-v1\.35\.md/);
    const updated = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(updated.exec.versions.filter((v: Record<string, unknown>) => v.version === 'v1.34')).toHaveLength(1);
    expect(updated.exec.versions.some((v: Record<string, unknown>) => v.version === 'v1.35' && v.plan_version_ref === 'v1.35')).toBe(true);
  });

  it('sigma exec new refuses to overwrite an existing target artifact file', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan());
    const target = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md');
    fs.writeFileSync(target, 'locked evidence must survive');

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/EXEC FILE CONFLICT/);
    expect(fs.readFileSync(target, 'utf8')).toBe('locked evidence must survive');
    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(updated.exec.versions).toHaveLength(0);
  });
});
