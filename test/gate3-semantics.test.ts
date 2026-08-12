import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs-extra';
import {
  ChainState,
  createInitialChain,
  ratifyIntent,
  registerPlanDraft,
  lockPlanVersion,
  registerExecDraft,
  lockExecVersion,
  supersedePlanVersion,
  hasCleanGate3Chain,
  describeGate3Blockers,
} from '../src/engine/chain';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  chainPath,
  TestEnv,
} from './helpers';

// PLAN-IMPL-MULTIDRAFT-LOCK §7/§13.1 (Director directive 2026-08-12) — the
// Gate 3 definition unit-tested here directly against the engine, mirroring
// chain-engine.test.ts's style, since it is the single riskiest change in
// the whole plan (§14: "salah di sini tidak muncul sebagai perilaku aneh,
// melainkan sebagai chain yang gagal divalidasi").

function lockedIntentChain(version = 'v1'): ChainState {
  const chain = createInitialChain(version, `Sigma/design/DIR-INTENT-${version}.md`);
  ratifyIntent(chain);
  return chain;
}

// Builds one fully-closed PLAN/EXEC pair (v0.1) on the given chain.
function closeOnePair(chain: ChainState, minor: string): void {
  registerPlanDraft(chain, `v0.${minor}`, `Sigma/build/FMN-PLAN-v0.${minor}.md`, 'v1');
  lockPlanVersion(chain, `v0.${minor}`);
  registerExecDraft(chain, `v0.${minor}`, `Sigma/build/DEV-EXEC-v0.${minor}.md`, `v0.${minor}`);
  lockExecVersion(chain, `v0.${minor}`);
}

describe('hasCleanGate3Chain — new definition (PLAN-IMPL-MULTIDRAFT-LOCK §7.1)', () => {
  it('false when INTENT is not RATIFIED', () => {
    const chain = createInitialChain('v1', 'x');
    expect(hasCleanGate3Chain(chain)).toBe(false);
  });

  it('false when no plan exists at all', () => {
    const chain = lockedIntentChain();
    expect(hasCleanGate3Chain(chain)).toBe(false);
  });

  it('true for a single fully-closed PLAN/EXEC pair', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    expect(hasCleanGate3Chain(chain)).toBe(true);
  });

  it('false while any DRAFT plan is open, even with an otherwise clean closed pair elsewhere', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    expect(hasCleanGate3Chain(chain)).toBe(true);

    registerPlanDraft(chain, 'v0.2', 'Sigma/build/FMN-PLAN-v0.2.md', 'v1');
    expect(hasCleanGate3Chain(chain)).toBe(false);
  });

  it('false while any DRAFT exec is open, even with another plan fully closed', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    expect(hasCleanGate3Chain(chain)).toBe(true);

    registerPlanDraft(chain, 'v0.2', 'Sigma/build/FMN-PLAN-v0.2.md', 'v1');
    lockPlanVersion(chain, 'v0.2');
    registerExecDraft(chain, 'v0.2', 'Sigma/build/DEV-EXEC-v0.2.md', 'v0.2');
    // v0.2's exec is deliberately left DRAFT here.
    expect(hasCleanGate3Chain(chain)).toBe(false);
  });

  it('true once every LOCKED plan has exactly one LOCKED exec — two independent, fully closed workstreams', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    closeOnePair(chain, '2');
    expect(hasCleanGate3Chain(chain)).toBe(true);
  });

  it('SUPERSEDED plans are ignored entirely, with or without an exec (Director-confirmed — never a Gate 3 blocker)', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    expect(hasCleanGate3Chain(chain)).toBe(true);

    registerPlanDraft(chain, 'v0.2', 'Sigma/build/FMN-PLAN-v0.2.md', 'v1');
    lockPlanVersion(chain, 'v0.2');
    supersedePlanVersion(chain, 'v0.2', 'deprioritized, no exec was ever started');

    expect(hasCleanGate3Chain(chain)).toBe(true);
  });

  it('pending plans (never promoted into versions[]) never affect Gate 3', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    chain.plan.pending.push({ id: 'abcd', file: 'Sigma/pending/FMN-PLAN-abcd.md', created_at: new Date().toISOString() });

    expect(hasCleanGate3Chain(chain)).toBe(true);
  });
});

describe('Gate 3 recompute at every mutation point (PLAN-IMPL-MULTIDRAFT-LOCK §7.3)', () => {
  it('registerPlanDraft closes an already-open Gate 3 (this function touched no gate at all before this plan)', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    expect(chain.gates.gate_3_satisfied).toBe(true);

    registerPlanDraft(chain, 'v0.2', 'Sigma/build/FMN-PLAN-v0.2.md', 'v1');
    expect(chain.gates.gate_3_satisfied).toBe(false);
  });

  it('supersedePlanVersion can open Gate 3 by removing the blocking plan', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');

    registerPlanDraft(chain, 'v0.2', 'Sigma/build/FMN-PLAN-v0.2.md', 'v1');
    lockPlanVersion(chain, 'v0.2');
    expect(chain.gates.gate_3_satisfied).toBe(false);

    supersedePlanVersion(chain, 'v0.2', 'no longer needed');
    expect(chain.gates.gate_3_satisfied).toBe(true);
  });

  it('lockExecVersion can open Gate 3 by completing the last open pairing', () => {
    const chain = lockedIntentChain();
    registerPlanDraft(chain, 'v0.1', 'Sigma/build/FMN-PLAN-v0.1.md', 'v1');
    lockPlanVersion(chain, 'v0.1');
    registerExecDraft(chain, 'v0.1', 'Sigma/build/DEV-EXEC-v0.1.md', 'v0.1');
    expect(chain.gates.gate_3_satisfied).toBe(false);

    lockExecVersion(chain, 'v0.1');
    expect(chain.gates.gate_3_satisfied).toBe(true);
  });

  it('registerExecDraft closes Gate 3 via computed recompute, not a bare false assertion', () => {
    const chain = lockedIntentChain();
    closeOnePair(chain, '1');
    expect(chain.gates.gate_3_satisfied).toBe(true);

    registerPlanDraft(chain, 'v0.2', 'Sigma/build/FMN-PLAN-v0.2.md', 'v1');
    lockPlanVersion(chain, 'v0.2');
    registerExecDraft(chain, 'v0.2', 'Sigma/build/DEV-EXEC-v0.2.md', 'v0.2');
    expect(chain.gates.gate_3_satisfied).toBe(false);
  });
});

describe('sigma doctor repairs gate_3_satisfied to match the new definition (PLAN-IMPL-MULTIDRAFT-LOCK §7.1)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('repairs a stale gate_3_satisfied=true left behind by a hand-edited chain with an unpaired LOCKED plan', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.1.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: {
        active_version: 'v0.2', active_state: 'LOCKED', pending: [],
        versions: [
          { version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
          { version: 'v0.2', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v0.2.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        ],
      },
      exec: {
        active_version: 'v0.1', active_state: 'LOCKED',
        versions: [
          { version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v0.1' },
        ],
      },
      close: null,
      // Stale on purpose: v0.2 has no exec at all, so this should be false.
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
    });

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/gates\.gate_3_satisfied repaired/i);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const gates = updated.gates as Record<string, unknown>;
    expect(gates.gate_3_satisfied).toBe(false);
  });
});

describe('describeGate3Blockers — names every entry holding the gate closed (PLAN-IMPL-MULTIDRAFT-LOCK §11)', () => {
  it('reports each DRAFT plan and DRAFT exec by version', () => {
    const chain = lockedIntentChain();
    registerPlanDraft(chain, 'v0.1', 'Sigma/build/FMN-PLAN-v0.1.md', 'v1');
    registerPlanDraft(chain, 'v0.2', 'Sigma/build/FMN-PLAN-v0.2.md', 'v1');
    lockPlanVersion(chain, 'v0.2');
    registerExecDraft(chain, 'v0.2', 'Sigma/build/DEV-EXEC-v0.2.md', 'v0.2');

    const blockers = describeGate3Blockers(chain);
    expect(blockers).toContain('DRAFT FMN-PLAN: v0.1');
    expect(blockers).toContain('DRAFT DEV-EXEC: v0.2 (plan v0.2)');
  });

  it('reports a LOCKED plan with no LOCKED exec pairing', () => {
    const chain = lockedIntentChain();
    registerPlanDraft(chain, 'v0.1', 'Sigma/build/FMN-PLAN-v0.1.md', 'v1');
    lockPlanVersion(chain, 'v0.1');

    const blockers = describeGate3Blockers(chain);
    expect(blockers).toContain('FMN-PLAN v0.1 is LOCKED but has no LOCKED DEV-EXEC');
  });

  it('reports nothing when the chain is clean', () => {
    const chain = lockedIntentChain();
    registerPlanDraft(chain, 'v0.1', 'Sigma/build/FMN-PLAN-v0.1.md', 'v1');
    lockPlanVersion(chain, 'v0.1');
    registerExecDraft(chain, 'v0.1', 'Sigma/build/DEV-EXEC-v0.1.md', 'v0.1');
    lockExecVersion(chain, 'v0.1');

    expect(describeGate3Blockers(chain)).toEqual([]);
    expect(hasCleanGate3Chain(chain)).toBe(true);
  });
});

describe('sigma close new — Gate 3 blocked message names the specific blockers (PLAN-IMPL-MULTIDRAFT-LOCK §11)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('lists the unpaired plan and suggests the relevant next step', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.1.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: {
        active_version: 'v0.1', active_state: 'LOCKED', pending: [],
        versions: [
          { version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        ],
      },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    });

    const result = runCli('close new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/GATE 3 BLOCKED: the chain still has open work/);
    expect(result.stderr).toMatch(/FMN-PLAN v0\.1 is LOCKED but has no LOCKED DEV-EXEC/);
    expect(result.stderr).toMatch(/sigma exec new \/ sigma exec lock/);
  });

  it('lists an open DRAFT plan and suggests supersede', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', {
      schema_version: '1.1.0', chain_version: 'v1', created_at: now, updated_at: now,
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
      roadmap: null,
      plan: {
        active_version: 'v0.2', active_state: 'DRAFT', pending: [],
        versions: [
          { version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
          { version: 'v0.2', state: 'DRAFT', file: 'Sigma/build/FMN-PLAN-v0.2.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
        ],
      },
      exec: {
        active_version: 'v0.1', active_state: 'LOCKED',
        versions: [
          { version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v0.1' },
        ],
      },
      close: null,
      gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
    });

    const result = runCli('close new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/DRAFT FMN-PLAN: v0\.2/);
    expect(result.stderr).toMatch(/sigma plan supersede --v <version> --reason/);
  });
});
