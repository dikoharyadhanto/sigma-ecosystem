// Stage B2 — LIST group test contract: sigma_list_intents, sigma_list_plans,
// sigma_list_execs, sigma_list_roadmap_stages. Covers the cross-chain
// behaviour unique to sigma_list_intents (the only B2 tool reading multiple
// progress-v<N>.json files), the "all states including SUPERSEDED" contract
// of plan/exec list (contrast the STATUS group, which hides SUPERSEDED),
// and the roadmap_list naming correction (lists stages, not roadmap
// versions — see listRoadmapStages.ts's header).

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import { resetBindingForTest } from '../src/mcp/shared';
import { computeListIntents } from '../src/mcp/tools/listIntents';
import { computeListPlans } from '../src/mcp/tools/listPlans';
import { computeListExecs } from '../src/mcp/tools/listExecs';
import { computeListRoadmapStages } from '../src/mcp/tools/listRoadmapStages';

import {
  setupTestEnv,
  writeChainFixture,
  stubProjectIdentity,
  stubProjectRootAnchor,
  makeChain,
  makeChainWithLockedIntent,
  makeChainWithFullBuiltCycle,
  TestEnv,
} from './helpers';

type Payload = Record<string, unknown>;

let envs: TestEnv[] = [];

function project(id = 'TEST', chain?: object): TestEnv {
  const env = setupTestEnv();
  stubProjectIdentity(env, id, `${id} Project`);
  stubProjectRootAnchor(env);
  if (chain) writeChainFixture(env, 'v1', chain);
  envs.push(env);
  return env;
}

beforeEach(() => {
  resetBindingForTest();
});

afterEach(() => {
  resetBindingForTest();
  for (const e of envs) e.cleanup();
  envs = [];
});

describe('sigma_list_intents — cross-chain', () => {
  it('returns an empty list when no chain exists yet', () => {
    const env = project();
    const out = computeListIntents(env.projectDir) as Payload;
    expect(out.chains).toEqual([]);
  });

  it('lists every chain under the project, marking exactly the active one', () => {
    const env = project('MINE', makeChainWithLockedIntent('v1'));
    // A second chain file, no activate_status.json pointer written — auto-
    // default resolves to the highest non-SUPERSEDED chain_version (v2).
    writeChainFixture(env, 'v2', makeChain('v2'));

    const out = computeListIntents(env.projectDir) as Payload;
    const chains = out.chains as Payload[];
    expect(chains.map((c) => c.chain_version).sort()).toEqual(['v1', 'v2']);
    const active = chains.filter((c) => c.active === true);
    expect(active).toHaveLength(1);
    expect(active[0].chain_version).toBe('v2');
  });
});

describe('sigma_list_plans', () => {
  it('lists all states including SUPERSEDED, plus pending', () => {
    const now = new Date().toISOString();
    const base = makeChainWithLockedIntent('v1') as Record<string, unknown>;
    base.plan = {
      active_version: 'v0.1', active_state: 'DRAFT',
      pending: [{ id: 'p1', file: 'Sigma/contract/PENDING-p1.md', created_at: now }],
      versions: [
        { version: 'v0.1', state: 'DRAFT', created_at: now, updated_at: now, intent_version_ref: 'v1' },
        { version: 'v0.2', state: 'SUPERSEDED', created_at: now, updated_at: now, intent_version_ref: 'v1', supersede_reason: 'x' },
      ],
    };
    const env = project('MINE', base);
    const out = computeListPlans(env.projectDir) as Payload;
    const versions = out.versions as Payload[];
    expect(versions.map((v) => v.state).sort()).toEqual(['DRAFT', 'SUPERSEDED']);
    expect(out.pending as Payload[]).toHaveLength(1);
  });

  it('pending title never carries a host absolute path when the file lacks a heading', () => {
    const now = new Date().toISOString();
    const base = makeChainWithLockedIntent('v1') as Record<string, unknown>;
    base.plan = {
      active_version: null, active_state: null,
      pending: [{ id: 'p1', file: 'Sigma/contract/PENDING-p1.md', created_at: now }],
      versions: [],
    };
    const env = project('MINE', base);
    const pendingAbs = path.join(env.projectDir, 'Sigma', 'contract', 'PENDING-p1.md');
    fs.ensureDirSync(path.dirname(pendingAbs));
    fs.writeFileSync(pendingAbs, 'no heading\n');
    const out = computeListPlans(env.projectDir) as Payload;
    expect((out.pending as Payload[])[0].title).toBeNull();
    expect(JSON.stringify(out)).not.toContain(env.projectDir);
  });
});

describe('sigma_list_execs', () => {
  it('lists all states including SUPERSEDED', () => {
    const now = new Date().toISOString();
    const base = makeChainWithLockedIntent('v1') as Record<string, unknown>;
    base.exec = {
      active_version: 'v1.1', active_state: 'DRAFT',
      versions: [
        { version: 'v1.1', state: 'DRAFT', created_at: now, updated_at: now, plan_version_ref: 'v1.1' },
        { version: 'v1.2', state: 'SUPERSEDED', created_at: now, updated_at: now, plan_version_ref: 'v1.1', supersede_reason: 'x' },
      ],
    };
    const env = project('MINE', base);
    const out = computeListExecs(env.projectDir) as Payload;
    const versions = out.versions as Payload[];
    expect(versions.map((v) => v.state).sort()).toEqual(['DRAFT', 'SUPERSEDED']);
  });
});

describe('sigma_list_roadmap_stages', () => {
  it('rejects when no ROADMAP exists on the chain', () => {
    const env = project('MINE', makeChainWithLockedIntent('v1'));
    expect(() => computeListRoadmapStages(env.projectDir)).toThrow(/No ROADMAP/);
  });

  it('lists stages (plans) for the active chain\'s intent, not roadmap versions', () => {
    const env = project('MINE', makeChainWithFullBuiltCycle('v1', 'v1.1'));
    const out = computeListRoadmapStages(env.projectDir) as Payload;
    expect(out.roadmap_version).toBe('v1');
    const stages = out.stages as Payload[];
    expect(stages).toHaveLength(1);
    expect(stages[0].version).toBe('v1.1');
    expect(stages[0].state).toBe('LOCKED');
  });
});
