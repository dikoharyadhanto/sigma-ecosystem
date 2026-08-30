import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectIdentity,
  writeChainFixture,
  chainPath,
  makeChain,
  makeChainWithLockedExec,
  validIntentDoc,
  validPlanDoc,
  validExecDoc,
  TestEnv,
} from './helpers';

// Bug report 2026-08-30 (KLHK_JasaLingkunganHidup, "folder migration"): after a
// project's Sigma artifact folders are renamed to the SIGMA_PROTOCOL §13
// layout (design → charter, build → contract/roadmap/evidence), the chain's
// stored entry.file paths still point at the old folders. Every command that
// opens the artifact fails with ENOENT, and `sigma doctor` reported VALID
// because it never checked entry.file existence. `runDoctorReconciliation()`
// now reconciles stale paths when given a projectRoot.

function writeLegacyDir(env: TestEnv, sub: string): string {
  const dir = path.join(env.sigmaDir, sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('sigma doctor — stale entry.file reconciliation after folder migration', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('rewrites a DIR-INTENT path from the old design/ folder to charter/ when the file moved', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    // The artifact really lives in the new canonical folder.
    fs.writeFileSync(path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/relocated .*Sigma\/design\/DIR-INTENT-v1\.md.*Sigma\/charter\/DIR-INTENT-v1\.md/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.file).toBe('Sigma/charter/DIR-INTENT-v1.md');
  });

  it('rewrites FMN-PLAN and DEV-EXEC paths from the old build/ folder to contract/ and evidence/', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
      plan: {
        active_version: 'v1.1', active_state: 'LOCKED', pending: [],
        versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
      },
      exec: {
        active_version: 'v1.1', active_state: 'LOCKED',
        versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1.1' }],
      },
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
    fs.writeFileSync(path.join(env.sigmaDir, 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));
    fs.writeFileSync(path.join(env.sigmaDir, 'evidence', 'DEV-EXEC-v1.1.md'), validExecDoc('v1.1', 'v1.1'));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.plan.versions[0].file).toBe('Sigma/contract/FMN-PLAN-v1.1.md');
    expect(data.exec.versions[0].file).toBe('Sigma/evidence/DEV-EXEC-v1.1.md');
  });

  it('is idempotent — a second doctor run reports no further relocation', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const first = runCli('doctor', env.projectDir, env.homeDir);
    expect(first.stdout).toMatch(/relocated/);

    const second = runCli('doctor', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).not.toMatch(/relocated/);
  });

  it('leaves a not-yet-migrated project untouched (legacy design/ path still resolves)', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeLegacyDir(env, 'design');
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.sigmaDir, 'design', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/relocated/);
    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.file).toBe('Sigma/design/DIR-INTENT-v1.md');
  });

  it('flags INVALID when the basename is ambiguous (present in both old and new folders)', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeLegacyDir(env, 'design');
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/notes/DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
    fs.writeFileSync(path.join(env.sigmaDir, 'design', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/INVALID/);
    expect(result.stdout).toMatch(/matches 2 candidates/);
    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.file).toBe('Sigma/notes/DIR-INTENT-v1.md'); // unchanged
  });

  it('leaves a truly missing artifact alone (no relocation, no INVALID) — that is reconstruct\'s job', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    // No DIR-INTENT file written anywhere.

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/relocated/);
    expect(result.stdout).toMatch(/VALID/);
  });

  it('--all-versions reconciles a non-active chain too', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    // v1 active and clean
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1'));
    fs.writeFileSync(path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
    fs.writeFileSync(path.join(env.sigmaDir, 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));
    fs.writeFileSync(path.join(env.sigmaDir, 'evidence', 'DEV-EXEC-v1.1.md'), validExecDoc('v1.1', 'v1.1'));
    // v2 inactive, with a stale build/ plan path
    writeChainFixture(env, 'v2', makeChain('v2', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v2', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v2.md', created_at: now, updated_at: now, ratified_at: now },
      plan: {
        active_version: 'v2.1', active_state: 'LOCKED', pending: [],
        versions: [{ version: 'v2.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v2.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v2' }],
      },
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    }), { activate: false });
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.sigmaDir, 'charter', 'DIR-INTENT-v2.md'), validIntentDoc('v2'));
    fs.writeFileSync(path.join(env.sigmaDir, 'contract', 'FMN-PLAN-v2.1.md'), validPlanDoc('v2.1'));

    const result = runCli('doctor --all-versions', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const v2 = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v2.plan.versions[0].file).toBe('Sigma/contract/FMN-PLAN-v2.1.md');
  });
});
