import { describe, it, expect } from 'vitest';
import { getInactiveIntentWarnings, ProgressJson } from '../src/engine/progress';

// Regression coverage: ROADMAP has its own independent lifecycle
// (DRAFT -> ACTIVE -> INACTIVE -> LOCKED, plus SUPERSEDED) where INACTIVE and
// LOCKED are already normal, resolved resting states for that domain — unlike
// Plan/Exec/Close, which have no ACTIVE/INACTIVE of their own and treat only
// SUPERSEDED as terminal. getInactiveIntentWarnings() must not conflate the
// two: a ROADMAP that was properly demoted via `roadmap activate` (INACTIVE)
// or finalized via `close lock` (LOCKED) is not "hanging" just because it
// isn't SUPERSEDED.

const NOW = '2026-07-17T09:00:00Z';

function emptyTracker() {
  return { active_version: null as string | null, active_state: null as string | null, versions: [] as any[] };
}

function baseProgress(): ProgressJson {
  return {
    schema_version: '1.0.0',
    project_id: 'TEST',
    project_name: 'Inactive Intent Warning Fixture',
    lifecycle_state: 'BUILD',
    created_at: NOW,
    updated_at: NOW,
    intent: emptyTracker(),
    plan: { ...emptyTracker(), pending: [] } as any,
    exec: emptyTracker(),
    close: emptyTracker(),
    roadmap: emptyTracker(),
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
    runtime_invalid: { markers: [], last_doctor_run_at: null },
  } as ProgressJson;
}

describe('getInactiveIntentWarnings', () => {
  it('does not flag a ROADMAP that was already properly demoted to INACTIVE via roadmap activate', () => {
    const data = baseProgress();
    data.intent = {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v1', state: 'INACTIVE', created_at: NOW, updated_at: NOW },
        { version: 'v2', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW },
      ],
    };
    data.roadmap = {
      active_version: 'v2',
      active_state: 'ACTIVE',
      versions: [
        { version: 'v1', state: 'INACTIVE', created_at: NOW, updated_at: NOW, intent_version_ref: 'v1' },
        { version: 'v2', state: 'ACTIVE', created_at: NOW, updated_at: NOW, intent_version_ref: 'v2' },
      ],
    };

    const warnings = getInactiveIntentWarnings(data);
    expect(warnings).toHaveLength(0);
  });

  it('does not flag a ROADMAP that reached the terminal LOCKED state', () => {
    const data = baseProgress();
    data.intent = {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v1', state: 'INACTIVE', created_at: NOW, updated_at: NOW },
        { version: 'v2', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW },
      ],
    };
    data.roadmap = {
      active_version: 'v2',
      active_state: 'ACTIVE',
      versions: [
        { version: 'v1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW, intent_version_ref: 'v1' },
        { version: 'v2', state: 'ACTIVE', created_at: NOW, updated_at: NOW, intent_version_ref: 'v2' },
      ],
    };

    const warnings = getInactiveIntentWarnings(data);
    expect(warnings).toHaveLength(0);
  });

  it('still flags a ROADMAP left DRAFT or ACTIVE under an INACTIVE intent (genuinely not yet demoted)', () => {
    const data = baseProgress();
    data.intent = {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v1', state: 'INACTIVE', created_at: NOW, updated_at: NOW },
        { version: 'v2', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW },
      ],
    };
    data.roadmap = {
      // v1's roadmap was never demoted via `roadmap activate` — still ACTIVE
      // even though its INTENT already moved on. This is the real "forgot to
      // demote it" case and should still surface.
      active_version: 'v1',
      active_state: 'ACTIVE',
      versions: [
        { version: 'v1', state: 'ACTIVE', created_at: NOW, updated_at: NOW, intent_version_ref: 'v1' },
      ],
    };

    const warnings = getInactiveIntentWarnings(data);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].hangingArtifacts).toEqual(['ROADMAP v1 (ACTIVE)']);
  });

  it('still flags LOCKED/DRAFT Plan, Exec, and Close under an INACTIVE intent (no ACTIVE/INACTIVE concept of their own)', () => {
    const data = baseProgress();
    data.intent = {
      active_version: 'v2',
      active_state: 'LOCKED',
      versions: [
        { version: 'v1', state: 'INACTIVE', created_at: NOW, updated_at: NOW },
        { version: 'v2', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW },
      ],
    };
    data.plan = {
      active_version: 'v1.1',
      active_state: 'LOCKED',
      pending: [],
      versions: [
        { version: 'v0.1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW, intent_version_ref: 'v1' },
      ],
    } as any;
    data.exec = {
      active_version: 'v0.1',
      active_state: 'LOCKED',
      versions: [
        { version: 'v0.1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW, plan_version_ref: 'v0.1' },
      ],
    };
    data.close = {
      active_version: 'v1',
      active_state: 'DRAFT',
      versions: [
        { version: 'v1', state: 'DRAFT', created_at: NOW, updated_at: NOW, intent_version_ref: 'v1' },
      ],
    };

    const warnings = getInactiveIntentWarnings(data);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].hangingArtifacts).toEqual(
      expect.arrayContaining(['PLAN v0.1 (LOCKED)', 'EXEC v0.1 (LOCKED)', 'CLOSE v1 (DRAFT)'])
    );
  });

  it('returns no warnings when there is no INACTIVE intent at all', () => {
    const data = baseProgress();
    data.intent = {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', created_at: NOW, updated_at: NOW, locked_at: NOW }],
    };

    expect(getInactiveIntentWarnings(data)).toHaveLength(0);
  });
});
