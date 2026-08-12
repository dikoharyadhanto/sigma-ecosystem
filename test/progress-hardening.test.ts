import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChainWithLockedExec,
  chainPath,
  validIntentDoc,
  TestEnv,
} from './helpers';

describe('Progress hardening', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  // The old array-based corruption ("active_version points at nothing in
  // versions[]", "active_state disagrees with the active entry") is
  // structurally impossible for `intent` now — there is no separate
  // active_version/versions pair to disagree with itself, just one object
  // (PLAN-EVAL-01 §3.4). The analogous corruption for a single-object domain
  // is "the stored version doesn't match the file it lives in" and "a gate
  // flag claims something the domain state doesn't support" — both covered
  // by validateChainSemantics() and exercised end-to-end here.

  it('blocks mutating commands when intent.version does not match chain_version', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.0.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'DESIGN',
      intent: { version: 'v9', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('intent ratify', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/chain_version/i);
    expect(result.stderr).toMatch(/Recovery:/i);
    expect(result.stderr).toMatch(/sigma session bootstrap/i);
  });

  it('blocks mutating commands when gate_1_open is true without a RATIFIED intent', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.0.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'DESIGN',
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('intent ratify', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/gate_1_open/i);
    expect(result.stderr).toMatch(/Recovery:/i);
  });

  it('blocks impossible Gate 3 satisfaction without a clean locked chain', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.0.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'DESIGN',
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: true },
    });

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/gates\.gate_3_satisfied repaired/i);
  });

  it('allows locking a brand-new chain while an older, fully independent chain keeps its own gates open — isolation is structural (separate files), not a demotion', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'), { activate: false });
    const v1Before = fs.readJsonSync(chainPath(env, 'v1'));

    const now = new Date().toISOString();
    writeChainFixture(env, 'v2', {
      schema_version: '1.0.0', chain_version: 'v2', created_at: now, updated_at: now,
      lifecycle_state: 'DESIGN',
      intent: { version: 'v2', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    }, { activate: true });

    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v2.md'),
      validIntentDoc('v2')
    );

    const result = runCli('intent ratify', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const v2 = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v2.intent.state).toBe('RATIFIED');
    expect(v2.gates.gate_1_open).toBe(true);

    // v1's file — its own LOCKED plan/exec and gates — is byte-for-byte
    // unchanged. No INACTIVE demotion (that state no longer exists,
    // PLAN-EVAL-01 §3.4); there is nothing in this file for v2's lock to
    // touch in the first place.
    const v1After = fs.readJsonSync(chainPath(env, 'v1'));
    expect(v1After).toEqual(v1Before);
  });
});
