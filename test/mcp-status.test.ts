// Stage B2 — STATUS group test contract: sigma_intent_status,
// sigma_close_status, sigma_plan_status, sigma_exec_status. Four separate
// tools because the underlying shapes genuinely differ (single-object +
// gate vs DRAFT/LOCKED-categorized-with-pairing) — see each tool's header
// in src/mcp/tools/. Covers the no-chain edge case (query tools must not
// throw when a project has no chain yet), the plan<->exec pairing
// computation, and the pending-plan title fallback that deliberately never
// leaks a host absolute path (contrast the CLI's readPendingTitle()).

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import { resetBindingForTest } from '../src/mcp/shared';
import { computeIntentStatus } from '../src/mcp/tools/intentStatus';
import { computeCloseStatus } from '../src/mcp/tools/closeStatus';
import { computePlanStatus } from '../src/mcp/tools/planStatus';
import { computeExecStatus } from '../src/mcp/tools/execStatus';

import {
  setupTestEnv,
  writeChainFixture,
  stubProjectIdentity,
  stubProjectRootAnchor,
  makeChain,
  makeChainWithLockedIntent,
  makeChainWithLockedExec,
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

describe('sigma_intent_status', () => {
  it('reports active:false when no chain exists yet', () => {
    const env = project();
    const out = computeIntentStatus(env.projectDir) as Payload;
    expect(out.active).toBe(false);
    expect(out.gate_1_open).toBe(false);
  });

  it('reports version/state/gate for an active RATIFIED intent', () => {
    const env = project('MINE', makeChainWithLockedIntent('v1'));
    const out = computeIntentStatus(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.version).toBe('v1');
    expect(out.state).toBe('RATIFIED');
    expect(out.gate_1_open).toBe(true);
    expect(out.doc_uncertified).toBe(false);
  });
});

describe('sigma_close_status', () => {
  it('reports close:null when no DIR-CLOSE exists', () => {
    const env = project('MINE', makeChainWithLockedIntent('v1'));
    const out = computeCloseStatus(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.close).toBeNull();
    expect(out.lifecycle_state).toBe('BUILD');
  });

  it('reports close version/state/lifecycle when DIR-CLOSE exists', () => {
    const env = project('MINE', makeChainWithFullBuiltCycle('v1', 'v1.1'));
    const out = computeCloseStatus(env.projectDir) as Payload;
    const close = out.close as Payload;
    expect(close.version).toBe('v1');
    expect(close.state).toBe('DRAFT');
    expect(out.lifecycle_state).toBe('BUILD');
  });
});

describe('sigma_plan_status', () => {
  function chainWithPairingScenario(): object {
    const now = new Date().toISOString();
    const base = makeChainWithLockedIntent('v1') as Record<string, unknown>;
    base.roadmap = { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now };
    base.plan = {
      active_version: 'v0.1', active_state: 'LOCKED',
      pending: [{ id: 'abcd', file: 'Sigma/contract/PENDING-abcd.md', created_at: now }],
      versions: [
        { version: 'v0.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, locked_at: now, title: 'Stage One', intent_version_ref: 'v1' },
        { version: 'v0.2', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v0.2.md', created_at: now, updated_at: now, title: 'Stage Two', intent_version_ref: 'v1' },
        { version: 'v0.3', state: 'SUPERSEDED', file: 'Sigma/contract/FMN-PLAN-v0.3.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    };
    base.exec = {
      active_version: 'v0.1', active_state: 'DRAFT',
      versions: [{ version: 'v0.1', state: 'DRAFT', file: 'Sigma/evidence/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, plan_version_ref: 'v0.1' }],
    };
    return base;
  }

  it('categorizes DRAFT/LOCKED, computes plan<->exec pairing, lists pending, and counts SUPERSEDED', () => {
    const env = project('MINE', chainWithPairingScenario());
    const out = computePlanStatus(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect((out.drafts as Payload[]).map((d) => d.version)).toEqual(['v0.2']);
    const locked = out.locked as Payload[];
    expect(locked).toHaveLength(1);
    expect(locked[0].version).toBe('v0.1');
    expect(locked[0].exec_pairing).toEqual({ status: 'open', exec_version: 'v0.1', exec_state: 'DRAFT' });
    expect((out.pending as Payload[])).toHaveLength(1);
    expect(out.superseded_count).toBe(1);
  });

  it('pending title falls back to null, never a host absolute path, when the pending file has no "# " heading', () => {
    const env = project('MINE', chainWithPairingScenario());
    const pendingAbs = path.join(env.projectDir, 'Sigma', 'contract', 'PENDING-abcd.md');
    fs.ensureDirSync(path.dirname(pendingAbs));
    fs.writeFileSync(pendingAbs, 'no heading here\n');
    const out = computePlanStatus(env.projectDir) as Payload;
    const pending = (out.pending as Payload[])[0];
    expect(pending.title).toBeNull();
    expect(JSON.stringify(pending)).not.toContain(env.projectDir);
  });

  it('reports exec_pairing status "locked" when the paired exec is LOCKED', () => {
    const env = project('MINE', makeChainWithFullBuiltCycle('v1', 'v1.1'));
    const out = computePlanStatus(env.projectDir) as Payload;
    const locked = out.locked as Payload[];
    expect(locked[0].exec_pairing).toEqual({ status: 'locked', exec_version: 'v1.1' });
  });
});

describe('sigma_exec_status', () => {
  it('reports active:false when no chain exists yet', () => {
    const env = project();
    const out = computeExecStatus(env.projectDir) as Payload;
    expect(out.active).toBe(false);
    expect(out.gate_3_satisfied).toBe(false);
  });

  it('categorizes DRAFT/LOCKED exec versions with plan_version_ref', () => {
    const env = project('MINE', makeChainWithLockedExec('v1', 'v1.1'));
    const out = computeExecStatus(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    const locked = out.locked as Payload[];
    expect(locked).toEqual([{ version: 'v1.1', plan_version_ref: 'v1.1' }]);
    expect(out.gate_3_satisfied).toBe(true);
  });
});
