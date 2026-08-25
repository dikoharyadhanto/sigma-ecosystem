import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  stubProjectIdentity,
  writeChainFixture,
  makeChainWithLockedIntent,
  makeChainWithLockedPlan,
  makeChainWithLockedExec,
  chainPath,
  TestEnv,
} from './helpers';

describe('Sigma doctor and INVALID recovery mode', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('doctor repairs gate drift automatically', () => {
    // The old "intent.active_state disagrees with versions[]" corruption is
    // structurally impossible now — intent is a single object, not a
    // tracker with a separate active_state mirror (PLAN-EVAL-01 §3.4). Gate
    // boolean drift is the chain-representable equivalent.
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.0.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Repaired/);
    expect(result.stdout).toMatch(/gates\.gate_1_open repaired/i);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(updated.gates.gate_1_open).toBe(true);
    expect(updated.runtime_invalid.markers).toHaveLength(0);
  });

  it('doctor marks a PLAN referencing a different chain\'s INTENT as INVALID', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const chain = makeChainWithLockedIntent('v1') as Record<string, any>;
    const now = new Date().toISOString();
    // Corruption: plan.intent_version_ref doesn't match this chain's own
    // intent — plan/exec stay arrays, but every entry belongs to exactly
    // one chain file now, so a mismatch here is drift, not a cross-chain
    // reference (PLAN-EVAL-01 §5).
    chain.plan = {
      active_version: 'v1.1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v9' }],
    };
    chain.gates = { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false };
    writeChainFixture(env, 'v1', chain);

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Marked INVALID/);
    expect(result.stdout).toMatch(/references INTENT v9.*this chain's INTENT is v1/i);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(updated.runtime_invalid.markers.length).toBeGreaterThan(0);
  });

  it('project status surfaces INVALID warnings after doctor', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    const chain = makeChainWithLockedIntent('v1') as Record<string, any>;
    const now = new Date().toISOString();
    chain.plan = {
      active_version: 'v1.1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v9' }],
    };
    chain.gates = { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false };
    writeChainFixture(env, 'v1', chain);

    runCli('doctor', env.projectDir, env.homeDir);
    const status = runCli('project status', env.projectDir, env.homeDir);

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toMatch(/INVALID Runtime Warnings/);
    expect(status.stdout).toMatch(/\[INVALID\]/);
  });

  it('exec new can proceed in invalid recovery mode when a locked plan still exists', () => {
    // `doctor` (the command that normally produces this state via
    // reconciliation) is exercised directly below now that it's migrated —
    // the corrupted-but-marked-INVALID chain state is still constructed
    // directly for determinism (no need to first provoke the exact
    // corruption pattern via a separate command sequence).
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const chain = makeChainWithLockedPlan() as Record<string, any>;
    chain.runtime_invalid = {
      markers: [{
        id: 'plan:manual-invalid',
        domain: 'plan',
        status: 'INVALID',
        reason: 'manual test invalid marker',
        gate: 'gate_2_open',
        chain: { intent_version: 'v1', plan_version: 'v1.1', exec_version: null },
        first_detected_at: new Date().toISOString(),
        last_detected_at: new Date().toISOString(),
      }],
      last_doctor_run_at: new Date().toISOString(),
    };
    writeChainFixture(env, 'v1', chain);

    const result = runCli('exec new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]evidence[\\/]DEV-EXEC-v1\.1\.md/);
    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(updated.exec.versions).toHaveLength(1);
  });

  it('doctor removes duplicate DRAFT exec when a LOCKED exec with the same version exists', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    const chain = makeChainWithLockedExec('v1', 'v0.1') as Record<string, any>;
    chain.exec.versions.push({
      version: 'v0.1',
      state: 'DRAFT',
      file: 'Sigma/evidence/DEV-EXEC-v0.1.md',
      created_at: now,
      updated_at: now,
      plan_version_ref: 'v0.1',
    });
    chain.exec.active_version = 'v0.1';
    chain.exec.active_state = 'DRAFT';
    writeChainFixture(env, 'v1', chain);

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/duplicate DRAFT/);
    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(updated.exec.versions.filter((v: Record<string, unknown>) => v.version === 'v0.1')).toHaveLength(1);
    expect(updated.exec.versions[0].state).toBe('LOCKED');
    expect(updated.exec.active_state).toBe('LOCKED');
    expect(updated.runtime_invalid.markers).toHaveLength(0);
  });
});
