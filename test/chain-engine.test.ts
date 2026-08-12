import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  ChainState,
  createInitialChain,
  listChainVersions,
  nextChainVersion,
  readActivateStatus,
  writeActivateStatus,
  resolveActiveChainVersion,
  readChain,
  writeChain,
  readActiveChain,
  ratifyIntent,
  previewIntentSupersedeCascade,
  supersedeIntentVersion,
  registerRoadmapDraft,
  lockActiveRoadmap,
  registerPlanDraft,
  lockPlanVersion,
  registerExecDraft,
  lockExecVersion,
  registerCloseDraft,
  lockActiveClose,
  hasCleanGate2Chain,
  hasCleanGate3Chain,
  validateChainSemantics,
  runDoctorReconciliation,
  getNextValidOperations,
} from '../src/engine/chain';

// PLAN-EVAL-01 Fase 1 — unit tests against the chain.ts domain layer
// directly, not through the CLI (nothing is wired into commands yet).

let projectRoot: string;

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-chain-test-'));
  fs.mkdirSync(path.join(projectRoot, 'Sigma'), { recursive: true });
});

afterEach(() => {
  fs.removeSync(projectRoot);
});

describe('createInitialChain', () => {
  it('produces a chain with intent DRAFT already set, roadmap/close null', () => {
    const chain = createInitialChain('v1', 'Sigma/design/DIR-INTENT-v1.md');
    expect(chain.chain_version).toBe('v1');
    expect(chain.intent).toMatchObject({ version: 'v1', state: 'DRAFT' });
    expect(chain.roadmap).toBeNull();
    expect(chain.close).toBeNull();
    expect(chain.lifecycle_state).toBe('DESIGN');
    expect(chain.gates).toEqual({ gate_1_open: false, gate_2_open: false, gate_3_satisfied: false });
  });
});

describe('path/discovery helpers', () => {
  it('listChainVersions finds progress-v<N>.json files, sorted ascending', () => {
    writeChain(projectRoot, 'v2', createInitialChain('v2', 'x'));
    writeChain(projectRoot, 'v1', createInitialChain('v1', 'x'));
    expect(listChainVersions(projectRoot)).toEqual(['v1', 'v2']);
  });

  it('nextChainVersion is v1 for a fresh project, increments from the highest existing', () => {
    expect(nextChainVersion(projectRoot)).toBe('v1');
    writeChain(projectRoot, 'v1', createInitialChain('v1', 'x'));
    expect(nextChainVersion(projectRoot)).toBe('v2');
    writeChain(projectRoot, 'v2', createInitialChain('v2', 'x'));
    expect(nextChainVersion(projectRoot)).toBe('v3');
  });
});

describe('activate_status.json', () => {
  it('round-trips active_chain', () => {
    writeActivateStatus(projectRoot, 'v1');
    expect(readActivateStatus(projectRoot)).toEqual({ active_chain: 'v1' });
  });

  it('round-trips null', () => {
    writeActivateStatus(projectRoot, null);
    expect(readActivateStatus(projectRoot)).toEqual({ active_chain: null });
  });
});

describe('resolveActiveChainVersion — invariant: exactly one ACTIVE chain (DISCUSSION §12)', () => {
  it('throws a directed error when no chain exists yet', () => {
    writeActivateStatus(projectRoot, null);
    expect(() => resolveActiveChainVersion(projectRoot)).toThrow(/No DIR-INTENT exists yet/);
  });

  it('returns active_chain when it points at a chain that exists', () => {
    writeChain(projectRoot, 'v1', createInitialChain('v1', 'x'));
    writeActivateStatus(projectRoot, 'v1');
    expect(resolveActiveChainVersion(projectRoot)).toBe('v1');
  });

  it('auto-defaults to the highest non-SUPERSEDED chain when active_chain is null', () => {
    writeChain(projectRoot, 'v1', createInitialChain('v1', 'x'));
    writeChain(projectRoot, 'v2', createInitialChain('v2', 'x'));
    writeActivateStatus(projectRoot, null);
    expect(resolveActiveChainVersion(projectRoot)).toBe('v2');
  });

  it('auto-defaults to the highest non-SUPERSEDED chain when active_chain points at a missing chain', () => {
    writeChain(projectRoot, 'v1', createInitialChain('v1', 'x'));
    writeActivateStatus(projectRoot, 'v9');
    expect(resolveActiveChainVersion(projectRoot)).toBe('v1');
  });

  it('skips SUPERSEDED chains when auto-defaulting', () => {
    const v1 = createInitialChain('v1', 'x');
    const v2 = createInitialChain('v2', 'x');
    ratifyIntent(v1);
    supersedeIntentVersion(v1, 'superseded by v2');
    writeChain(projectRoot, 'v1', v1);
    writeChain(projectRoot, 'v2', v2);
    writeActivateStatus(projectRoot, null);
    expect(resolveActiveChainVersion(projectRoot)).toBe('v2');
  });

  it('auto-defaults away from a stale active_chain pointer that now points at a SUPERSEDED chain', () => {
    // Reachable case: `intent supersede` on the currently active chain never
    // touches activate_status.json — the manifest is left pointing at a now
    // dead chain until this fallback kicks in.
    const v1 = createInitialChain('v1', 'x');
    const v2 = createInitialChain('v2', 'x');
    ratifyIntent(v1);
    supersedeIntentVersion(v1, 'superseded by v2');
    writeChain(projectRoot, 'v1', v1);
    writeChain(projectRoot, 'v2', v2);
    writeActivateStatus(projectRoot, 'v1'); // stale — v1 is SUPERSEDED
    expect(resolveActiveChainVersion(projectRoot)).toBe('v2');
  });

  it('throws when every existing chain is SUPERSEDED', () => {
    const v1 = createInitialChain('v1', 'x');
    ratifyIntent(v1);
    supersedeIntentVersion(v1, 'dead end');
    writeChain(projectRoot, 'v1', v1);
    writeActivateStatus(projectRoot, null);
    expect(() => resolveActiveChainVersion(projectRoot)).toThrow(/SUPERSEDED/);
  });
});

describe('readActiveChain / writeChain round-trip', () => {
  it('reads back exactly what was written, resolved via the manifest', () => {
    const chain = createInitialChain('v1', 'Sigma/design/DIR-INTENT-v1.md');
    writeChain(projectRoot, 'v1', chain);
    writeActivateStatus(projectRoot, 'v1');
    const result = readActiveChain(projectRoot);
    expect(result.chainVersion).toBe('v1');
    expect(result.data.intent.version).toBe('v1');
  });
});

function lockedIntentChain(version = 'v1'): ChainState {
  const chain = createInitialChain(version, `Sigma/design/DIR-INTENT-${version}.md`);
  ratifyIntent(chain);
  return chain;
}

describe('ratifyIntent', () => {
  it('opens Gate 1, sets lifecycle to BUILD, sets ratified_at', () => {
    const chain = createInitialChain('v1', 'x');
    ratifyIntent(chain);
    expect(chain.intent.state).toBe('RATIFIED');
    expect(chain.intent.ratified_at).toBeTruthy();
    expect(chain.gates.gate_1_open).toBe(true);
    expect(chain.lifecycle_state).toBe('BUILD');
  });

  it('rejects ratifying a non-DRAFT intent', () => {
    const chain = lockedIntentChain();
    expect(() => ratifyIntent(chain)).toThrow(/DRAFT/);
  });
});

describe('roadmap: 1:1 guard replaces ACTIVE/INACTIVE arbitration (PLAN-EVAL-01 §3.5)', () => {
  it('registerRoadmapDraft rejects a second roadmap while the first is still live', () => {
    const chain = lockedIntentChain();
    registerRoadmapDraft(chain, 'Sigma/build/ROADMAP-v1.md');
    expect(() => registerRoadmapDraft(chain, 'Sigma/build/ROADMAP-v1-again.md')).toThrow(/already exists/);
  });

  it('lockActiveRoadmap requires an existing DRAFT roadmap', () => {
    const chain = lockedIntentChain();
    expect(() => lockActiveRoadmap(chain)).toThrow(/No ROADMAP/);
    registerRoadmapDraft(chain, 'Sigma/build/ROADMAP-v1.md');
    lockActiveRoadmap(chain);
    expect(chain.roadmap?.state).toBe('LOCKED');
    expect(chain.roadmap?.locked_at).toBeTruthy();
  });
});

function fullyBuiltChain(): ChainState {
  const chain = lockedIntentChain();
  registerRoadmapDraft(chain, 'Sigma/build/ROADMAP-v1.md');
  registerPlanDraft(chain, 'v0.1', 'Sigma/build/FMN-PLAN-v0.1.md', 'v1', 'Title', 'Focus');
  lockPlanVersion(chain, 'v0.1');
  registerExecDraft(chain, 'v0.1', 'Sigma/build/DEV-EXEC-v0.1.md', 'v0.1');
  lockExecVersion(chain, 'v0.1');
  return chain;
}

describe('plan/exec gate progression (targeted lock, PLAN-IMPL-MULTIDRAFT-LOCK §3/§5)', () => {
  it('gate_2_open opens on plan lock, gate_3_satisfied opens on exec lock', () => {
    const chain = lockedIntentChain();
    registerPlanDraft(chain, 'v0.1', 'Sigma/build/FMN-PLAN-v0.1.md', 'v1', 'Title', 'Focus');
    expect(hasCleanGate2Chain(chain)).toBe(false);
    lockPlanVersion(chain, 'v0.1');
    expect(chain.gates.gate_2_open).toBe(true);
    expect(hasCleanGate2Chain(chain)).toBe(true);

    registerExecDraft(chain, 'v0.1', 'Sigma/build/DEV-EXEC-v0.1.md', 'v0.1');
    expect(hasCleanGate3Chain(chain)).toBe(false);
    lockExecVersion(chain, 'v0.1');
    expect(chain.gates.gate_3_satisfied).toBe(true);
    expect(hasCleanGate3Chain(chain)).toBe(true);
  });
});

describe('close: 1:1 guard (PLAN-EVAL-01 §3.5 analog)', () => {
  it('registerCloseDraft rejects a second close while the first is still live, lockActiveClose sets lifecycle CLOSED', () => {
    const chain = fullyBuiltChain();
    registerCloseDraft(chain, 'Sigma/close/DIR-CLOSE-v1.md');
    expect(() => registerCloseDraft(chain, 'Sigma/close/DIR-CLOSE-v1-again.md')).toThrow(/already exists/);
    lockActiveClose(chain);
    expect(chain.close?.state).toBe('LOCKED');
    expect(chain.lifecycle_state).toBe('CLOSED');
  });
});

describe('supersedeIntentVersion — chain-scoped cascade (PLAN-EVAL-01 §3.4)', () => {
  it('cascades roadmap/plan/exec/close to SUPERSEDED within this chain only', () => {
    const chain = fullyBuiltChain();
    registerCloseDraft(chain, 'Sigma/close/DIR-CLOSE-v1.md');

    const preview = previewIntentSupersedeCascade(chain);
    expect(preview.roadmap?.version).toBe('v1');
    expect(preview.plan).toHaveLength(1);
    expect(preview.exec).toHaveLength(1);
    expect(preview.close?.version).toBe('v1');

    supersedeIntentVersion(chain, 'pivot');
    expect(chain.intent.state).toBe('SUPERSEDED');
    expect(chain.intent.supersede_reason).toBe('pivot');
    expect(chain.roadmap?.state).toBe('SUPERSEDED');
    expect(chain.plan.versions[0].state).toBe('SUPERSEDED');
    expect(chain.exec.versions[0].state).toBe('SUPERSEDED');
    expect(chain.close?.state).toBe('SUPERSEDED');
  });

  it('rejects superseding a non-RATIFIED intent (INACTIVE no longer exists as a state, §3.4)', () => {
    const chain = createInitialChain('v1', 'x');
    expect(() => supersedeIntentVersion(chain, 'reason')).toThrow(/RATIFIED/);
  });
});

describe('validateChainSemantics', () => {
  it('accepts a well-formed chain', () => {
    const chain = fullyBuiltChain();
    expect(() => validateChainSemantics(chain)).not.toThrow();
  });

  it('rejects gate_1_open=true without a LOCKED intent', () => {
    const chain = createInitialChain('v1', 'x');
    chain.gates.gate_1_open = true;
    expect(() => validateChainSemantics(chain)).toThrow(/gate_1_open/);
  });

  it('rejects intent.version that does not match chain_version', () => {
    const chain = createInitialChain('v1', 'x');
    chain.intent.version = 'v2';
    expect(() => validateChainSemantics(chain)).toThrow(/chain_version/);
  });
});

describe('runDoctorReconciliation', () => {
  it('repairs the known exec duplicate DRAFT+LOCKED corruption pattern', () => {
    const chain = fullyBuiltChain();
    // Simulate the corruption: a stray DRAFT entry alongside the LOCKED one.
    chain.exec.versions.push({
      version: 'v0.1', state: 'DRAFT', file: 'x',
      created_at: chain.updated_at, updated_at: chain.updated_at, plan_version_ref: 'v0.1',
    });
    const report = runDoctorReconciliation(chain);
    expect(report.repaired.some(r => r.includes('duplicate DRAFT'))).toBe(true);
    expect(chain.exec.versions).toHaveLength(1);
    expect(chain.exec.versions[0].state).toBe('LOCKED');
  });

  it('flags a plan.intent_version_ref mismatch as INVALID', () => {
    const chain = lockedIntentChain();
    registerRoadmapDraft(chain, 'x');
    registerPlanDraft(chain, 'v0.1', 'x', 'v1', 'T', 'F');
    chain.plan.versions[0].intent_version_ref = 'v999';
    const report = runDoctorReconciliation(chain);
    expect(report.remainingInvalid.some(m => m.id.startsWith('plan-ref:'))).toBe(true);
  });
});

describe('getNextValidOperations', () => {
  it('suggests intent ratify for a fresh DRAFT chain', () => {
    const chain = createInitialChain('v1', 'x');
    expect(getNextValidOperations(chain)).toContain('intent ratify');
  });

  it('suggests roadmap new once intent is ratified, not before', () => {
    const chain = lockedIntentChain();
    expect(getNextValidOperations(chain)).toContain('roadmap new');
  });

  it('suggests plan new once roadmap exists, never suggests roadmap activate (removed, §3.5)', () => {
    const chain = lockedIntentChain();
    registerRoadmapDraft(chain, 'x');
    const ops = getNextValidOperations(chain);
    expect(ops).toContain('plan new');
    expect(ops.some(o => o.includes('roadmap activate'))).toBe(false);
  });
});
