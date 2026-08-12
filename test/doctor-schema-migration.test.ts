import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  chainPath,
  TestEnv,
} from './helpers';

// Coverage for the RATIFIED rename's doctor migration (Director directive
// 2026-08-12, PLAN-IMPL-RATIFIED-AND-INTENT-AMENDMENT-20260812.md §3.7):
// readChain() normalizes a legacy intent.state "LOCKED" to "RATIFIED" (and
// locked_at to ratified_at) in memory on every read, but the file on disk
// keeps the old label until something actually writes it back. `sigma
// doctor` is that write — it must both persist the conversion and report it
// in the Repaired section, not silently write an already-normalized chain
// and claim nothing changed.

function legacyRatifiedChain(version: string) {
  const now = new Date().toISOString();
  return {
    schema_version: '1.0.0', chain_version: version, created_at: now, updated_at: now,
    lifecycle_state: 'BUILD',
    intent: { version, state: 'LOCKED', file: `Sigma/design/DIR-INTENT-${version}.md`, created_at: now, updated_at: now, locked_at: now },
    roadmap: null,
    plan: { active_version: null, active_state: null, versions: [], pending: [] },
    exec: { active_version: null, active_state: null, versions: [] },
    close: null,
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  };
}

describe('sigma doctor — RATIFIED schema migration', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('persists LOCKED → RATIFIED and locked_at → ratified_at to disk, reporting the migration', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', legacyRatifiedChain('v1'));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Migrated to RATIFIED schema.*"LOCKED".*"RATIFIED"/);
    expect(result.stdout).toMatch(/Migrated to RATIFIED schema.*locked_at.*ratified_at/);
    expect(result.stdout).toMatch(/schema_version migrated "1\.0\.0".*"1\.1\.0"/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.state).toBe('RATIFIED');
    expect(data.intent.ratified_at).toBeTruthy();
    expect(data.intent.locked_at).toBeUndefined();
    expect(data.schema_version).toBe('1.1.0');
  });

  it('is idempotent — a second doctor run reports no further migration', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', legacyRatifiedChain('v1'));

    const first = runCli('doctor', env.projectDir, env.homeDir);
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toMatch(/Migrated to RATIFIED schema/);

    const second = runCli('doctor', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).not.toMatch(/Migrated to RATIFIED schema/);
    expect(second.stdout).not.toMatch(/schema_version migrated/);
  });

  it('--all-versions migrates every chain on disk, not just the active one', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', legacyRatifiedChain('v1'), { activate: false });
    writeChainFixture(env, 'v2', legacyRatifiedChain('v2'), { activate: true });

    const result = runCli('doctor --all-versions', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const v1 = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    const v2 = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v1.intent.state).toBe('RATIFIED');
    expect(v1.schema_version).toBe('1.1.0');
    expect(v2.intent.state).toBe('RATIFIED');
    expect(v2.schema_version).toBe('1.1.0');
  });

  it('does not touch a chain already on the current schema (no false-positive migration report)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.1.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/Migrated to RATIFIED schema/);
    expect(result.stdout).not.toMatch(/schema_version migrated/);
  });
});
