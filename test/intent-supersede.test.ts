import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubLegacyProgressJson,
  writeChainFixture,
  makeChainWithFullBuiltCycle,
  makeChainWithLockedExec,
  makeChainWithLockedPlan,
  chainPath,
  validIntentDoc,
  TestEnv,
} from './helpers';

// Coverage for PLAN-EVAL-01 (intent-supersede feature) and its Opsi C
// storage migration: `sigma intent supersede` is the only path to a real
// SUPERSEDED INTENT, the cascade is explicit + director-confirmed, and it
// must never leak outside the exact chain (file) it targets. Under Opsi C,
// "never leaks outside the exact chain" is now a *structural* guarantee
// (two chains are two different files) rather than a behavioral one — the
// isolation tests below assert on that directly (the other chain's file is
// byte-for-byte read back untouched), not just on array entries staying put.

// `--v` in `--reason "pivot"` reasons below still says "pivot"/"scope pivot"
// etc. to keep parity with the pre-migration test names/messages.

function fullLockedChain() {
  return makeChainWithFullBuiltCycle('v1', 'v1.1');
}

describe('sigma intent supersede', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  // ── Guard checks ────────────────────────────────────────────────────────────

  it('fails when the intent version does not exist', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', fullLockedChain());

    const result = runCli('intent supersede --v v9 --reason "no such intent" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });

  it('fails when the intent version is DRAFT, not LOCKED (INACTIVE no longer exists, PLAN-EVAL-01 §3.4)', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', { chain_version: 'v1', schema_version: '1.0.0', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), lifecycle_state: 'DESIGN', intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, roadmap: null, plan: { active_version: null, active_state: null, versions: [], pending: [] }, exec: { active_version: null, active_state: null, versions: [] }, close: null, gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false } });

    const result = runCli('intent supersede --v v1 --reason "testing" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/requires LOCKED/i);
  });

  // ── Director-confirm gate (second code-enforced precedent after override.ts) ─

  it('refuses to execute without --director-confirm and leaves the chain file untouched', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', fullLockedChain());

    const result = runCli('intent supersede --v v1 --reason "pivot"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--director-confirm/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.state).toBe('LOCKED');
    expect(data.roadmap.state).toBe('LOCKED');
    expect(data.plan.versions[0].state).toBe('LOCKED');
    expect(data.exec.versions[0].state).toBe('LOCKED');
    expect(data.close.state).toBe('DRAFT');
  });

  it('shows a preflight listing every artifact that will cascade, including LOCKED work, before requiring confirm', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', fullLockedChain());

    const result = runCli('intent supersede --v v1 --reason "pivot"', env.projectDir, env.homeDir);

    expect(result.stdout).toMatch(/Intent Supersede Preflight/);
    expect(result.stdout).toMatch(/ROADMAP v1 \[LOCKED\]/);
    expect(result.stdout).toMatch(/PLAN v1\.1 \[LOCKED\]/);
    expect(result.stdout).toMatch(/EXEC v1\.1 \[LOCKED\]/);
    expect(result.stdout).toMatch(/CLOSE v1 \[DRAFT\]/);
  });

  // ── Core cascade ────────────────────────────────────────────────────────────

  it('cascades SUPERSEDED to the full Roadmap/Plan/Exec/Close chain, including LOCKED entries', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', fullLockedChain());

    const result = runCli('intent supersede --v v1 --reason "scope pivot" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.state).toBe('SUPERSEDED');
    expect(data.intent.supersede_reason).toBe('scope pivot');
    expect(data.roadmap.state).toBe('SUPERSEDED');
    expect(data.plan.versions[0].state).toBe('SUPERSEDED');
    expect(data.exec.versions[0].state).toBe('SUPERSEDED');
    expect(data.close.state).toBe('SUPERSEDED');

    // Cascaded entries carry a cascade reason, not their own superseded_by
    // (superseded_by itself is dropped entirely from the schema, §3.4/§3.2).
    expect(data.roadmap.supersede_reason).toMatch(/cascade/i);
    expect(data.plan.versions[0].supersede_reason).toMatch(/cascade/i);
    expect(data.exec.versions[0].supersede_reason).toMatch(/cascade/i);
    expect(data.close.supersede_reason).toMatch(/cascade/i);
  });

  it('does not crash and reports no cascade when nothing references the target version', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.0.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('intent supersede --v v1 --reason "no descendants" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No downstream Roadmap\/Plan\/Exec\/Close artifacts/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.state).toBe('SUPERSEDED');
  });

  // ── Principle C: downward-only, never leaks across chains. Under Opsi C
  // this is a structural guarantee (separate files) — asserted here by
  // reading the untouched chain's file back byte-for-byte, not just an
  // array entry. ─────────────────────────────────────────────────────────

  it('does not touch an unrelated INTENT chain — a second chain file is read back completely unchanged', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', fullLockedChain(), { activate: false });
    const v2Chain = makeChainWithLockedExec('v2', 'v2.1');
    writeChainFixture(env, 'v2', v2Chain, { activate: true });
    const v2Before = fs.readJsonSync(chainPath(env, 'v2'));

    const result = runCli('intent supersede --v v1 --reason "retire old complementary intent" --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    // v1 chain cascades
    const v1 = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(v1.intent.state).toBe('SUPERSEDED');
    expect(v1.roadmap.state).toBe('SUPERSEDED');
    expect(v1.plan.versions[0].state).toBe('SUPERSEDED');
    expect(v1.exec.versions[0].state).toBe('SUPERSEDED');
    expect(v1.close.state).toBe('SUPERSEDED');

    // v2 chain's file is byte-for-byte identical to before the command ran.
    const v2After = fs.readJsonSync(chainPath(env, 'v2'));
    expect(v2After).toEqual(v2Before);
  });

  it('sigma plan supersede does not change the state of the INTENT that governs it (downward-only)', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan('v1', 'v1.1'));

    const result = runCli('plan supersede --v v1.1 --reason "replan"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.plan.versions[0].state).toBe('SUPERSEDED');
    expect(data.intent.state).toBe('LOCKED');
  });
});

// ── Regression: intent lock never auto-supersedes; reopening never mutates
// the prior chain's own file (Opsi C makes this structural, not behavioral) ──

describe('intent lock regression — no auto-supersede, no auto-cascade', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('reopen on a CLOSED project creates an isolated v2 chain and leaves the old CLOSED chain (with its LOCKED DIR-CLOSE) completely untouched', () => {
    env = setupTestEnv();
    stubLegacyProgressJson(env);
    const now = new Date().toISOString();
    const closedChain = makeChainWithFullBuiltCycle('v1', 'v1.1') as Record<string, any>;
    closedChain.close = { version: 'v1', state: 'LOCKED', file: 'Sigma/close/DIR-CLOSE-v1.md', created_at: now, updated_at: now, locked_at: now };
    closedChain.lifecycle_state = 'CLOSED';
    writeChainFixture(env, 'v1', closedChain);
    const v1Before = fs.readJsonSync(chainPath(env, 'v1'));

    const reopened = runCli('intent new --yes', env.projectDir, env.homeDir);
    expect(reopened.exitCode).toBe(0);

    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v2.md'),
      validIntentDoc('v2')
    );

    const locked = runCli('intent lock', env.projectDir, env.homeDir);
    expect(locked.exitCode).toBe(0);

    // The old chain file is byte-for-byte unchanged — no INACTIVE demotion,
    // no touch of any kind. Isolation is structural now, not a state value.
    const v1After = fs.readJsonSync(chainPath(env, 'v1'));
    expect(v1After).toEqual(v1Before);

    const v2 = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v2.intent.state).toBe('LOCKED');
    expect(v2.gates.gate_1_open).toBe(true);
  });
});
