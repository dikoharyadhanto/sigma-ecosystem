// PLAN-IMPL-01 Stage 3 — tests for the sigma-mcp read-only tools.
//
// Strategy (PLAN-IMPL-01 §4): each tool's logic lives in an exported pure
// computeX(root) function; registerXTool is a thin wrapper. Unit tests drive
// computeX directly against fixtures; one integration test boots buildServer()
// over the SDK's in-memory transport and calls every tool through a real MCP
// client; a static guard test asserts no writer function is imported into
// src/mcp/tools/.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { computeState } from '../src/mcp/tools/state';
import { computeGates } from '../src/mcp/tools/gates';
import { computeArtifacts } from '../src/mcp/tools/artifacts';
import { computeDoctor } from '../src/mcp/tools/doctor';
import { computeOrientation } from '../src/mcp/tools/orientation';
import { computeMemory } from '../src/mcp/tools/memory';
import { buildServer } from '../src/mcp/index';

import {
  setupTestEnv,
  writeChainFixture,
  stubProjectIdentity,
  stubProjectRootAnchor,
  makeChain,
  makeChainWithDraftIntent,
  makeChainWithLockedPlan,
  makeChainWithLockedExec,
  TestEnv,
} from './helpers';

// Anything returned by computeX is a plain object; narrow it for assertions.
type Payload = Record<string, unknown>;

// A project on disk with the given chain fixture active.
function projectWithChain(env: TestEnv, chain: object): void {
  stubProjectIdentity(env);
  writeChainFixture(env, 'v1', chain);
}

// A project on disk with identity + anchor but no chain fixture at all.
function projectWithoutChain(env: TestEnv): void {
  stubProjectIdentity(env);
  stubProjectRootAnchor(env);
}

describe('sigma-mcp tools — no active project (root = null)', () => {
  it('every tool returns active:false without touching the filesystem', () => {
    for (const compute of [computeState, computeGates, computeArtifacts, computeDoctor, computeOrientation]) {
      const out = compute(null) as Payload;
      expect(out.active).toBe(false);
      expect(out.source).toBe('engine');
    }
  });
});

describe('sigma-mcp tools — project present but no chain yet', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('state/gates/artifacts/doctor report active:false with identity context', () => {
    env = setupTestEnv();
    projectWithoutChain(env);

    const state = computeState(env.projectDir) as Payload;
    expect(state.active).toBe(false);
    expect(state.project_id).toBe('TEST');

    expect((computeGates(env.projectDir) as Payload).active).toBe(false);
    expect((computeArtifacts(env.projectDir) as Payload).active).toBe(false);
    expect((computeDoctor(env.projectDir) as Payload).active).toBe(false);
  });

  it('orientation still works pre-intent (phase null, next op = intent new)', () => {
    env = setupTestEnv();
    projectWithoutChain(env);

    const out = computeOrientation(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.phase).toBeNull();
    expect(out.next_valid_operations).toEqual(['intent new']);
  });
});

describe('sigma_get_state', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('reports DESIGN phase and closed gates for a draft-intent chain', () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithDraftIntent());

    const out = computeState(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.phase).toBe('DESIGN');
    expect(out.active_chain).toBe('v1');
    expect(out.project_id).toBe('TEST');
    expect(out.gates).toMatchObject({ gate_1_open: false, gate_2_open: false, gate_3_satisfied: false });
    expect(out.has_invalid_runtime).toBe(false);
    expect(out.source).toBe('engine');
  });

  it('reflects an open Gate 2 for a locked-plan chain', () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithLockedPlan());

    const out = computeState(env.projectDir) as Payload;
    expect(out.phase).toBe('BUILD');
    expect(out.gates).toMatchObject({ gate_1_open: true, gate_2_open: true, gate_3_satisfied: false });
  });
});

describe('sigma_get_gates', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('labels gates OPEN/BLOCKED and surfaces no invalid markers on a clean locked-plan chain', () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithLockedPlan());

    const out = computeGates(env.projectDir) as Payload;
    expect(out.gate_2_open).toBe(true);
    expect(out.labels).toMatchObject({ gate_2_open: 'OPEN', gate_3_satisfied: 'BLOCKED' });
    expect(out.invalid_markers).toEqual([]);
  });

  it('reports has_invalid markers when the chain carries runtime_invalid state', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    const invalidChain = makeChain('v1', {
      lifecycle_state: 'BUILD',
      runtime_invalid: {
        markers: [
          {
            id: 'test-marker-1',
            domain: 'gates',
            status: 'INVALID',
            reason: 'fabricated for test',
            gate: 'gate_2_open',
            chain: { intent_version: 'v1', plan_version: null, exec_version: null },
            first_detected_at: now,
            last_detected_at: now,
          },
        ],
        last_doctor_run_at: null,
      },
    });
    projectWithChain(env, invalidChain);

    const state = computeState(env.projectDir) as Payload;
    expect(state.has_invalid_runtime).toBe(true);

    const gates = computeGates(env.projectDir) as Payload;
    expect((gates.invalid_markers as unknown[]).length).toBe(1);
  });
});

describe('sigma_list_artifacts', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('projects intent/plan/exec trackers with counts for a locked-exec chain', () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithLockedExec());

    const out = computeArtifacts(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.intent).toMatchObject({ version: 'v1', state: 'RATIFIED' });
    expect(out.plan).toMatchObject({ active_version: 'v1.1', active_state: 'LOCKED', versions_count: 1, pending_count: 0 });
    expect(out.exec).toMatchObject({ active_version: 'v1.1', active_state: 'LOCKED', versions_count: 1 });
    expect(out.close).toBeNull();
  });
});

describe('sigma_doctor', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('reports a clean chain with applied:false and does not mutate the file on disk', () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithLockedExec());

    const chainFile = path.join(env.sigmaDir, 'progress-v1.json');
    const before = fs.readFileSync(chainFile, 'utf8');

    const out = computeDoctor(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.applied).toBe(false);
    expect(out.findings).toMatchObject({ repaired: [], remainingInvalid: [] });

    // Read-only w.r.t. disk: the chain file must be byte-identical after the call.
    expect(fs.readFileSync(chainFile, 'utf8')).toBe(before);
  });
});

describe('sigma_get_orientation', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('surfaces blockers and raw next operations for a locked-plan chain', () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithLockedPlan());

    const out = computeOrientation(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.phase).toBe('BUILD');
    expect(out.blockers).toContain('Gate 3 (Build Evidence) is BLOCKED');
    expect(Array.isArray(out.next_valid_operations)).toBe(true);
    expect(out.inbox_unread).toEqual({});
    expect(out.memo_unread).toEqual({});
  });

  // PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF-20260902 — inbox_unread must
  // exclude MEMO (mirrors the sigma send gate / sigma session bootstrap
  // "Role Inbox"); memo_unread is the separate self-addressed count (mirrors
  // sigma session bootstrap's "Unread Memos").
  it('splits inbox_unread (cross-role, excludes MEMO) from memo_unread (self-addressed)', () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithLockedPlan());

    const now = new Date().toISOString();
    fs.outputJsonSync(path.join(env.projectDir, 'Sigma', 'messages', 'index.json'), {
      messages: [
        {
          id: 'MSG-1', from: 'ARC', to: 'DEV', type: 'NOTE', subject: 'hi',
          file: 'Sigma/messages/DEV/msg1.md', status: 'UNREAD', created_at: now, attachments: [],
        },
        {
          id: 'MSG-2', from: 'DEV', to: 'DEV', type: 'MEMO', subject: 'self note',
          file: 'Sigma/messages/DEV/memo1.md', status: 'UNREAD', created_at: now, attachments: [],
        },
      ],
    });

    const out = computeOrientation(env.projectDir) as Payload;
    expect(out.inbox_unread).toEqual({ DEV: 1 });
    expect(out.memo_unread).toEqual({ DEV: 1 });
  });
});

describe('sigma-mcp integration — buildServer over in-memory transport', () => {
  let env: TestEnv;
  const originalCwd = process.cwd();
  afterEach(() => {
    process.chdir(originalCwd);
    env?.cleanup();
  });

  it('lists the ten tools (Phase 0 + Batch 1 + Stage B2 evidence-only) and every core call returns source:engine', async () => {
    env = setupTestEnv();
    projectWithChain(env, makeChainWithLockedExec());
    // Registered tools resolve the project via findProjectRoot() from cwd.
    process.chdir(env.projectDir);

    const server = buildServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    // Six from Phase 0, three added by Batch 1 (Stage A + Stage B1), one added
    // by Stage B2 (sigma_get_evidence). MCP mailbox tools were built and
    // reviewed during Stage B2 but withdrawn by Director decision — see
    // RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md §9.
    expect(names).toEqual(
      [
        'sigma_doctor',
        'sigma_get_gates',
        'sigma_get_orientation',
        'sigma_get_state',
        'sigma_list_artifacts',
        'sigma_get_memory',
        'sigma_verify_binding',
        'sigma_get_effective_policy',
        'sigma_read_artifact',
        'sigma_get_evidence',
      ].sort(),
    );

    // R-08 — every query-plane tool carries the same safety annotations, so an
    // orchestrator reading the tool list sees uniform metadata. The three
    // Batch 1 additions shipped without them at first.
    for (const t of tools) {
      expect(t.annotations, `${t.name} must declare annotations`).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }

    // The original six keep their contract: active project, engine-sourced.
    const core = [
      'sigma_doctor',
      'sigma_get_gates',
      'sigma_get_orientation',
      'sigma_get_state',
      'sigma_list_artifacts',
      'sigma_get_memory',
    ];
    for (const name of core) {
      const args = name === 'sigma_get_memory' ? { role: 'FMN' } : {};
      const res = await client.callTool({ name, arguments: args });
      const text = (res.content as Array<{ type: string; text: string }>)[0].text;
      const payload = JSON.parse(text) as Payload;
      expect(payload.source).toBe('engine');
      expect(payload.active).toBe(true);
      // §8 — metadata is additive, so it rides alongside the old fields.
      expect(payload.contract_version).toBe('1.0');
      expect(payload.tool).toBe(name);
      // structuredContent carries the identical object (§16.2).
      expect(res.structuredContent).toEqual(payload);
    }

    await client.close();
    await server.close();
  });

  it('computeMemory returns valid role memory payload for all roles', () => {
    for (const role of ['ARC', 'FMN', 'DEV', 'AUD'] as const) {
      const res = computeMemory(null, role) as Payload;
      expect(res.active).toBe(true);
      expect(res.role).toBe(role);
      expect(Array.isArray(res.general)).toBe(true);
      expect(Array.isArray(res.role_specific)).toBe(true);
    }
  });
});

describe('sigma-mcp project root resolution fallbacks', () => {
  it('resolves root from explicit parameter and environment variables', async () => {
    const { resolveRoot, addClientRoot } = await import('../src/mcp/shared');
    const testEnv = setupTestEnv();
    projectWithChain(testEnv, makeChain());

    // 1. Explicit parameter
    expect(resolveRoot(testEnv.projectDir)).toBe(testEnv.projectDir);

    // 2. SIGMA_PROJECT_ROOT env var
    process.env.SIGMA_PROJECT_ROOT = testEnv.projectDir;
    expect(resolveRoot()).toBe(testEnv.projectDir);
    delete process.env.SIGMA_PROJECT_ROOT;

    // 3. Client Root URI via addClientRoot
    const fileUri = `file:///${testEnv.projectDir.replace(/\\/g, '/')}`;
    addClientRoot(fileUri);
    expect(resolveRoot()).toBe(testEnv.projectDir);

    testEnv.cleanup();
  });
});

describe('sigma-mcp read-only guard', () => {
  it('no query-plane file imports a state-mutating engine function', () => {
    // Widened for Batch 1: Stage A/B1 added binding.ts, contract.ts and
    // policy.ts directly under src/mcp/, which the old tools-only sweep would
    // never have looked at. src/mcp/control/ is deliberately NOT excluded here
    // — when Stage C creates it, this guard must be split, not silently
    // inherited, and failing loudly is how that gets noticed.
    const mcpDir = path.resolve(__dirname, '..', 'src', 'mcp');
    const writerNames = [
      'writeChain',
      'writeActivateStatus',
      'lockActiveIntent',
      'supersedeIntentVersion',
      'recordArcScore',
      'registerRoadmapDraft',
      'createInitialChain',
    ];

    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        if (fs.statSync(abs).isDirectory()) walk(abs);
        else if (name.endsWith('.ts')) files.push(abs);
      }
    };
    walk(mcpDir);
    expect(files.length).toBeGreaterThan(6);

    for (const file of files) {
      const raw = fs.readFileSync(file, 'utf8');
      // Strip comments so documentation mentions (e.g. doctor.ts explaining it
      // never calls writeChain) don't trip the guard.
      const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const writer of writerNames) {
        expect(code, `${path.basename(file)} must not reference writer ${writer}`).not.toMatch(new RegExp(`\\b${writer}\\b`));
      }
    }
  });
});
