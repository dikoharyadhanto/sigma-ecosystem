import { describe, it, expect } from 'vitest';
import {
  lockActiveIntent,
  runDoctorReconciliation,
  validateProgressSemantics,
  ProgressJson,
} from '../src/engine/progress';

// Engine-level coverage for the "half-completed cycle reopen" runtime-state bug.
// These exercise lockActiveIntent + runDoctorReconciliation directly so they do
// not depend on the doc-check harness used by the CLI subprocess tests.

const NOW = '2026-07-13T08:45:34Z';

function emptyTracker() {
  return { active_version: null as string | null, active_state: null as string | null, versions: [] as any[] };
}

function baseProgress(): ProgressJson {
  return {
    schema_version: '1.0.0',
    project_id: 'JLH',
    project_name: 'Reopen Fixture',
    lifecycle_state: 'DESIGN',
    created_at: NOW,
    updated_at: NOW,
    intent: emptyTracker(),
    plan: { ...emptyTracker(), pending: [] } as any,
    exec: emptyTracker(),
    close: emptyTracker(),
    roadmap: emptyTracker(),
    gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    runtime_invalid: { markers: [], last_doctor_run_at: null },
  } as ProgressJson;
}

// A closed v1 cycle with a fresh DRAFT intent v2 sitting on top — the exact state
// right before `sigma intent lock` is run on a CLOSED project.
function closedProjectWithDraftV2(): ProgressJson {
  const data = baseProgress();
  data.lifecycle_state = 'CLOSED';
  data.intent = {
    active_version: 'v2',
    active_state: 'DRAFT',
    versions: [
      { version: 'v1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW },
      { version: 'v2', state: 'DRAFT', created_at: NOW, updated_at: NOW },
    ],
  };
  data.plan = {
    active_version: 'v0.3',
    active_state: 'LOCKED',
    pending: [],
    versions: [{ version: 'v0.3', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW, intent_version_ref: 'v1' }],
  } as any;
  data.exec = {
    active_version: 'v0.3',
    active_state: 'LOCKED',
    versions: [{ version: 'v0.3', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW, plan_version_ref: 'v0.3' }],
  };
  data.close = {
    active_version: 'v1',
    active_state: 'LOCKED',
    versions: [{ version: 'v1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW }],
  };
  data.roadmap = {
    active_version: 'v1',
    active_state: 'LOCKED',
    versions: [{ version: 'v1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW, intent_version_ref: 'v1' }],
  };
  data.gates = { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true };
  return data;
}

// The already-stranded runtime state a buggy 0.9.0 leaves behind: v2 LOCKED,
// v1 SUPERSEDED, still CLOSED, gates inherited from the v1 chain.
function strandedReopen(): ProgressJson {
  const data = closedProjectWithDraftV2();
  data.intent.active_state = 'LOCKED';
  data.intent.versions[0] = { version: 'v1', state: 'SUPERSEDED', created_at: NOW, updated_at: NOW, locked_at: NOW, superseded_by: 'v2' };
  data.intent.versions[1] = { version: 'v2', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW };
  (data.plan.versions[0] as any).stale_intent = true;
  (data.exec.versions[0] as any).stale_intent = true;
  return data;
}

describe('intent lock completes a reopen of a CLOSED project', () => {
  it('transitions lifecycle to BUILD and resets downstream gates', () => {
    const data = closedProjectWithDraftV2();

    lockActiveIntent(data);

    expect(data.lifecycle_state).toBe('BUILD');
    expect(data.gates.gate_1_open).toBe(true);
    expect(data.gates.gate_2_open).toBe(false);
    expect(data.gates.gate_3_satisfied).toBe(false);

    // v1 superseded, v2 now the locked active intent
    expect(data.intent.versions.find(v => v.version === 'v1')!.state).toBe('SUPERSEDED');
    expect(data.intent.versions.find(v => v.version === 'v2')!.state).toBe('LOCKED');

    // prior-cycle plan/exec flagged stale rather than deleted (kept as history)
    expect((data.plan.versions[0] as any).stale_intent).toBe(true);
    expect((data.exec.versions[0] as any).stale_intent).toBe(true);

    // The state is now clean enough for `sigma roadmap new` (assertProgressCanMutate).
    expect(() => validateProgressSemantics(data)).not.toThrow();
  });

  it('also resets gates on a mid-BUILD major intent pivot', () => {
    const data = closedProjectWithDraftV2();
    data.lifecycle_state = 'BUILD';
    data.close = emptyTracker();

    lockActiveIntent(data);

    expect(data.lifecycle_state).toBe('BUILD');
    expect(data.gates.gate_2_open).toBe(false);
    expect(data.gates.gate_3_satisfied).toBe(false);
    expect(() => validateProgressSemantics(data)).not.toThrow();
  });

  it('leaves gate_2/gate_3 closed on a clean first-cycle lock', () => {
    const data = baseProgress();
    data.intent = {
      active_version: 'v1',
      active_state: 'DRAFT',
      versions: [{ version: 'v1', state: 'DRAFT', created_at: NOW, updated_at: NOW }],
    };

    lockActiveIntent(data);

    expect(data.lifecycle_state).toBe('BUILD');
    expect(data.gates.gate_1_open).toBe(true);
    expect(data.gates.gate_2_open).toBe(false);
    expect(data.gates.gate_3_satisfied).toBe(false);
  });
});

describe('doctor recovers an already-stranded reopen', () => {
  it('repairs lifecycle and inherited gates to the desired end-state', () => {
    const data = strandedReopen();

    // Before repair the state is self-contradictory and would reject roadmap new.
    expect(() => validateProgressSemantics(data)).toThrow(/gate_3_satisfied/);

    const report = runDoctorReconciliation(data);

    expect(data.lifecycle_state).toBe('BUILD');
    expect(data.gates.gate_1_open).toBe(true);
    expect(data.gates.gate_2_open).toBe(false);
    expect(data.gates.gate_3_satisfied).toBe(false);
    expect(report.repaired.join('\n')).toMatch(/lifecycle_state repaired from "CLOSED" to "BUILD"/);
    expect(report.repaired.join('\n')).toMatch(/gate_3_satisfied repaired/);
    expect(report.remainingInvalid).toHaveLength(0);

    // Recovered state is now internally consistent.
    expect(() => validateProgressSemantics(data)).not.toThrow();
  });

  it('does NOT reopen a genuinely CLOSED clean project', () => {
    const data = closedProjectWithDraftV2();
    // Make it a real single-cycle close: only intent v1, locked and active, clean chain.
    data.intent = {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW }],
    };
    (data.plan.versions[0] as any).intent_version_ref = 'v1';
    (data.exec.versions[0] as any).plan_version_ref = 'v0.3';

    runDoctorReconciliation(data);

    expect(data.lifecycle_state).toBe('CLOSED');
    expect(data.gates.gate_3_satisfied).toBe(true);
  });

  it('does NOT reopen a CLOSED project that acknowledged a stale chain', () => {
    const data = closedProjectWithDraftV2();
    // Single intent cycle, closed with an acknowledged stale chain (no superseded intent).
    data.intent = {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW }],
    };
    (data.plan.versions[0] as any).stale_intent = true;
    (data.exec.versions[0] as any).stale_intent = true;
    data.gates.gate_3_satisfied = false;

    runDoctorReconciliation(data);

    expect(data.lifecycle_state).toBe('CLOSED');
  });
});
