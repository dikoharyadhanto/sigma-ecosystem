import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { OPERATION_TIERS, mcpStatusFor } from '../src/mcp/policy';

// PLAN-IMPL-SIGMA-REPORT-DIAGNOSTIC-MESSAGE-GIT-BOUNDARY — Layer B (TC-TST-02).
//
// Metadata-only parity between the operation registry and the MCP policy tier
// table: every active registry operation must be classified, nothing in the
// policy may be unknown to the registry, and tombstones must never read as
// active. Cheap enough to run on every build.

const ROOT = path.resolve(__dirname, '..');
const registry = fs.readJsonSync(path.join(ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json')) as {
  operations: Array<{ operation_id: string; level: string; role: string }>;
};
const registryIds = registry.operations.map(o => o.operation_id);

const TOMBSTONES = ['intent_lock', 'plan_lock', 'exec_lock'];

// Registry operations that have no tier yet. Unclassified means `forbidden`
// (policy.ts: absent from the table is forbidden), so this is safe but
// undecided. Assigning tiers is a policy decision that belongs to
// Implementation/PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015.md, not to
// the diagnostic work. The set is asserted exactly: it must shrink when that
// plan lands, and it must not grow silently.
const KNOWN_UNCLASSIFIED = ['notes_list', 'notes_new', 'notes_update'];

describe('operation registry ↔ MCP policy parity', () => {
  it('classifies every active operation, except the explicitly known gap', () => {
    const unclassified = registryIds.filter(id => !(id in OPERATION_TIERS)).sort();
    expect(unclassified,
      'registry operations without a tier. Classify them in src/mcp/policy.ts, or (if the decision is deferred) add them to KNOWN_UNCLASSIFIED with a reason')
      .toEqual(KNOWN_UNCLASSIFIED);
  });

  it('has no policy entry unknown to the registry', () => {
    const known = new Set(registryIds);
    expect(Object.keys(OPERATION_TIERS).filter(id => !known.has(id)).sort()).toEqual([]);
  });

  it('has no duplicate registry operation ids', () => {
    expect(registryIds.length).toBe(new Set(registryIds).size);
  });

  it('keeps tombstones inadmissible and out of the active count', () => {
    for (const id of TOMBSTONES) {
      expect(registryIds, `${id} must stay in the registry as a tombstone`).toContain(id);
      expect(OPERATION_TIERS[id], `${id} must be tier NA`).toBe('NA');
      expect(mcpStatusFor(id), `${id} must be not_admissible`).toBe('not_admissible');
    }
    const active = registryIds.filter(id => !TOMBSTONES.includes(id));
    expect(active.length).toBe(registryIds.length - TOMBSTONES.length);
  });

  it('gives every registry operation a level and a role', () => {
    const missing = registry.operations.filter(o => !o.level || !o.role).map(o => o.operation_id);
    expect(missing).toEqual([]);
  });
});
