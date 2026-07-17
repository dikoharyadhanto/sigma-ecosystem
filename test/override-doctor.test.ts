import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChainWithLockedIntent,
  chainPath,
  TestEnv,
} from './helpers';

// Coverage for PLAN-EVAL-01 Bagian A: `sigma doctor` must not silently revert
// a gate that `sigma override` forced open, as long as the override is still
// in force (the bypassed artifact version is still sitting in DRAFT).

function chainWithDraftPlan() {
  const chain = makeChainWithLockedIntent('v1') as Record<string, any>;
  const now = new Date().toISOString();
  chain.plan = {
    active_version: 'v1', active_state: 'DRAFT', pending: [],
    versions: [{ version: 'v1', state: 'DRAFT', file: 'Sigma/build/FMN-PLAN-v1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' }],
  };
  return chain;
}

describe('sigma override survives sigma doctor while still in force', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('keeps gate_2_open true after doctor when the overridden plan is still DRAFT', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', chainWithDraftPlan());

    const overrideResult = runCli('override --reason "Director decision: unblock demo" --director-confirm', env.projectDir, env.homeDir);
    expect(overrideResult.exitCode).toBe(0);

    const afterOverride = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(afterOverride.gates.gate_2_open).toBe(true);

    const overridesLog = fs.readFileSync(`${env.sigmaDir}/memory/overrides.jsonl`, 'utf8').trim().split('\n');
    const entry = JSON.parse(overridesLog[overridesLog.length - 1]);
    expect(entry.gate_bypassed).toBe('Gate 2');
    expect(entry.version).toBe('v1');

    const doctorResult = runCli('doctor', env.projectDir, env.homeDir);
    expect(doctorResult.exitCode).toBe(0);
    expect(doctorResult.stdout).not.toMatch(/gate_2_open repaired/i);

    const afterDoctor = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(afterDoctor.gates.gate_2_open).toBe(true);
  });

  it('stops forcing the gate open once the overridden version is superseded by a real pivot', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', chainWithDraftPlan());

    runCli('override --reason "Director decision: unblock demo" --director-confirm', env.projectDir, env.homeDir);

    // Simulate the normal flow moving past the overridden version: v1 is
    // explicitly superseded and a fresh v2 draft takes its place, still
    // unlocked. The old override must not keep forcing gate_2 open for a
    // chain it never actually applied to.
    const now = new Date().toISOString();
    const pivoted = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    pivoted.plan.versions[0].state = 'SUPERSEDED';
    pivoted.plan.versions[0].supersede_reason = 'Replaced by v2 during normal planning';
    pivoted.plan.versions.push({ version: 'v2', state: 'DRAFT', file: 'Sigma/build/FMN-PLAN-v2.md', created_at: now, updated_at: now, intent_version_ref: 'v1' });
    pivoted.plan.active_version = 'v2';
    pivoted.plan.active_state = 'DRAFT';
    fs.writeJsonSync(chainPath(env, 'v1'), pivoted, { spaces: 2 });

    const doctorResult = runCli('doctor', env.projectDir, env.homeDir);
    expect(doctorResult.exitCode).toBe(0);
    expect(doctorResult.stdout).toMatch(/gate_2_open repaired from "true" to "false"/i);

    const afterDoctor = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(afterDoctor.gates.gate_2_open).toBe(false);
  });
});
