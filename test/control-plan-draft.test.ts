// Stage E W1 pilot — sigma_create_plan_draft. First primitive added after
// Stage C/D's intent_draft/intent_ratify pilot proved the pattern; this file
// exercises the same contract categories test/control-intent-draft.test.ts
// established (role/gate boundary, stale-state, idempotency, crash-window,
// transport-level, path-traversal-by-construction, cross-process
// concurrency, process-death recovery), adapted for what differs about
// plan_draft specifically: it targets a RATIFIED intent + eligible ROADMAP
// (not "no precondition" like intent_draft), and its target is an entry in
// chain.plan.versions[] (array), not a single object like chain.intent — so
// this file also covers that a second draft never clobbers the first.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { computeStateRevision } from '../src/mcp/contract';
import { readChain } from '../src/engine/chain';
import { createPlanDraft, createPlanDraftTransactionFiles, PlanDraftError } from '../src/services/planDraftService';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';
import { readIdempotencyRecord, writeIdempotencyRecord } from '../src/engine/controlStore';

import {
  setupTestEnv,
  stubProjectIdentity,
  writeChainFixture,
  makeChainWithLockedIntent,
  TestEnv,
} from './helpers';

type Payload = Record<string, unknown>;

afterEach(() => {
  resetBindingForTest();
});

function setControlBinding(root: string, role: string | null, projectId = 'TEST'): void {
  const binding: Binding = {
    mode: 'control',
    kind: 'verified',
    root,
    projectId,
    rootFingerprint: fingerprintRoot(root),
    role,
    verified: true,
  };
  setBinding(binding);
}

function revisionOf(root: string): string {
  const rev = computeStateRevision(root).revision;
  if (!rev) throw new Error('test setup produced no state_revision');
  return rev;
}

// RATIFIED intent + eligible (non-SUPERSEDED) ROADMAP entry — the minimum
// chain state Gate 1 / Gate 1.5 require. `plan new`/createPlanDraft() also
// reads the ROADMAP file from disk (renderRoadmapFile), so callers that
// expect a successful create must also call writeRoadmapFile() below.
function chainWithRoadmap(version = 'v1', roadmapState: 'LOCKED' | 'SUPERSEDED' = 'LOCKED') {
  const chain = makeChainWithLockedIntent(version) as Record<string, unknown>;
  const now = new Date().toISOString();
  chain.roadmap = {
    version, state: roadmapState, file: `Sigma/roadmap/ROADMAP-${version}.md`, created_at: now, updated_at: now, locked_at: now,
    ...(roadmapState === 'SUPERSEDED' ? { supersede_reason: 'test supersede' } : {}),
  };
  return chain;
}

function writeRoadmapFile(env: TestEnv, version = 'v1'): void {
  const src = path.join(__dirname, '..', 'Sigma', 'templates', 'ROADMAP-TEMPLATE.md');
  const dest = path.join(env.projectDir, 'Sigma', 'roadmap', `ROADMAP-${version}.md`);
  fs.ensureDirSync(path.dirname(dest));
  fs.copySync(src, dest);
}

function bootstrapReadyProject(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', chainWithRoadmap('v1'));
  writeRoadmapFile(env, 'v1');
}

function createOpts(idempotencyKey: string, expectedStateRevision: string, title = 'Stage Title', focus = 'Stage Focus') {
  return {
    tool: 'sigma_create_plan_draft',
    operationId: 'plan_create_draft',
    idempotencyKey,
    argumentsForHash: { title, focus },
    allowedRoles: ['FMN'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: createPlanDraftTransactionFiles,
  };
}

function callCreate(root: string, title = 'Stage Title', focus = 'Stage Focus') {
  return createPlanDraft({ projectRoot: root, title, focus });
}

describe('sigma_create_plan_draft — role and gate boundary', () => {
  it('rejects a call with no bound role', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, null);
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createOpts('k1', rev), (root) => callCreate(root))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readChain(env.projectDir, 'v1').plan.versions).toEqual([]);
    env.cleanup();
  });

  it('rejects a call bound to a role other than FMN (including ARC, which owns intent_draft)', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createOpts('k1', rev), (root) => callCreate(root))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readChain(env.projectDir, 'v1').plan.versions).toEqual([]);
    env.cleanup();
  });

  it('rejects when the intent is not RATIFIED (Gate 1 blocked) — direct service call, typed GATE_BLOCKED', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', {
      schema_version: '1.2.0', chain_version: 'v1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      lifecycle_state: 'DESIGN',
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });

    expect(() => callCreate(env.projectDir)).toThrow(PlanDraftError);
    try {
      callCreate(env.projectDir);
    } catch (e) {
      expect((e as PlanDraftError).code).toBe('GATE_BLOCKED');
      expect((e as PlanDraftError).message).toMatch(/GATE 1 BLOCKED/);
    }
    expect(readChain(env.projectDir, 'v1').plan.versions).toEqual([]);
    env.cleanup();
  });

  it('rejects when no eligible ROADMAP exists (Gate 1.5 blocked) — RATIFIED intent alone is not enough', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1')); // RATIFIED intent, roadmap: null

    expect(() => callCreate(env.projectDir)).toThrow(PlanDraftError);
    try {
      callCreate(env.projectDir);
    } catch (e) {
      expect((e as PlanDraftError).code).toBe('GATE_BLOCKED');
      expect((e as PlanDraftError).message).toMatch(/Gate 1\.5 blocked/);
    }
    env.cleanup();
  });

  it('rejects when the ROADMAP has been SUPERSEDED — a stale roadmap is not eligible even if the file still exists', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', chainWithRoadmap('v1', 'SUPERSEDED'));
    writeRoadmapFile(env, 'v1');

    expect(() => callCreate(env.projectDir)).toThrow(/Gate 1\.5 blocked/);
    env.cleanup();
  });

  it('rejects title/focus containing "|" — would corrupt the ROADMAP Stage Overview table', () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);

    expect(() => callCreate(env.projectDir, 'Bad | Title')).toThrow(/cannot contain/);
    expect(readChain(env.projectDir, 'v1').plan.versions).toEqual([]);
    env.cleanup();
  });

  it('respects notion_humanize_gate when enabled — blocks until the RATIFIED intent has a human projection pushed', () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    fs.writeJsonSync(path.join(env.projectDir, 'Sigma', 'project.config.json'), {
      schema_version: '1.2.0',
      document_language: 'English',
      interaction_language: 'English',
      output_document_language: 'English',
      notion_humanize_gate: { enabled: true },
    });

    expect(() => callCreate(env.projectDir)).toThrow(/HUMANIZE GATE BLOCKED/);
    expect(readChain(env.projectDir, 'v1').plan.versions).toEqual([]);
    env.cleanup();
  });
});

describe('sigma_create_plan_draft — stale state', () => {
  it('rejects a stale expected_state_revision and creates nothing', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');

    const res = (await respondControlWrite(
      createOpts('k1', 'sha256:not-the-real-revision'),
      (root) => callCreate(root)
    )) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').plan.versions).toEqual([]);
    env.cleanup();
  });
});

describe('sigma_create_plan_draft — idempotency and concurrency', () => {
  it('retrying the same idempotency_key with the same arguments replays the original result, no duplicate effect', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('same-key', rev);

    const first = (await respondControlWrite(opts, (root) => callCreate(root))) as Payload;
    const firstBody = (first as { structuredContent: Payload }).structuredContent;
    expect(firstBody.version).toBe('v0.1');

    // Second call reuses the now-stale `rev` on purpose — a genuine retry
    // resends exactly what it sent the first time and must succeed via
    // replay without re-checking state_revision.
    const second = (await respondControlWrite(opts, (root) => callCreate(root))) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect(secondBody.version).toBe('v0.1');
    expect(secondBody.relPath).toBe(firstBody.relPath);

    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(1);
    env.cleanup();
  });

  it('the same idempotency_key with different arguments is rejected as IDEMPOTENCY_CONFLICT', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);

    const first = (await respondControlWrite(
      createOpts('same-key', rev, 'Title A', 'Focus A'),
      (root) => callCreate(root, 'Title A', 'Focus A')
    )) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).version).toBe('v0.1');

    const second = (await respondControlWrite(
      createOpts('same-key', rev, 'Title B', 'Focus B'),
      (root) => callCreate(root, 'Title B', 'Focus B')
    )) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect((secondBody.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(1);
    env.cleanup();
  });

  it('two concurrent calls with the same idempotency_key produce exactly one commit', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('concurrent-key', rev);

    const [a, b] = await Promise.all([
      respondControlWrite(opts, (root) => callCreate(root)) as Promise<Payload>,
      respondControlWrite(opts, (root) => callCreate(root)) as Promise<Payload>,
    ]);

    const aBody = (a as { structuredContent: Payload }).structuredContent;
    const bBody = (b as { structuredContent: Payload }).structuredContent;
    expect(aBody.version).toBe('v0.1');
    expect(bBody.version).toBe('v0.1');
    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(1);
    env.cleanup();
  });
});

describe('sigma_create_plan_draft — array-of-versions correctness (differs from intent_draft\'s single-object target)', () => {
  it('a second plan draft under the same RATIFIED intent appends to chain.plan.versions[] without touching the first', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');

    const rev1 = revisionOf(env.projectDir);
    const first = (await respondControlWrite(
      createOpts('key-1', rev1, 'Stage One', 'Focus One'),
      (root) => callCreate(root, 'Stage One', 'Focus One')
    )) as Payload;
    const firstBody = (first as { structuredContent: Payload }).structuredContent;
    expect(firstBody.version).toBe('v0.1');

    const rev2 = revisionOf(env.projectDir); // state moved after the first create — a real second call reads fresh
    const second = (await respondControlWrite(
      createOpts('key-2', rev2, 'Stage Two', 'Focus Two'),
      (root) => callCreate(root, 'Stage Two', 'Focus Two')
    )) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect(secondBody.version).toBe('v0.2');

    const versions = readChain(env.projectDir, 'v1').plan.versions;
    expect(versions).toHaveLength(2);
    expect(versions.map((v) => v.version).sort()).toEqual(['v0.1', 'v0.2']);
    expect(versions.find((v) => v.version === 'v0.1')?.title).toBe('Stage One');
    expect(versions.find((v) => v.version === 'v0.2')?.title).toBe('Stage Two');
    expect(versions.every((v) => v.state === 'DRAFT')).toBe(true);

    env.cleanup();
  });
});

describe('sigma_create_plan_draft — crash-window safety (mirrors control-intent-draft.test.ts\'s contract)', () => {
  it('a synchronous rejection inside mutate() is retained as a "failed" record (not deleted) — an immediate retry with the SAME key is still not blocked', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);

    const rejecting = () =>
      respondControlWrite(
        {
          tool: 'sigma_create_plan_draft', operationId: 'plan_create_draft', idempotencyKey: 'reject-then-retry',
          argumentsForHash: { x: 1 }, allowedRoles: ['FMN'], checkPreconditions: staleStateCheck(rev),
          transactionFiles: createPlanDraftTransactionFiles,
        },
        () => { throw new Error('simulated business-rule rejection'); }
      ) as Promise<Payload>;

    const first = (await rejecting()) as { structuredContent: Payload };
    expect((first.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');

    const failedRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'plan_create_draft', 'FMN', 'reject-then-retry');
    expect(failedRecord?.status).toBe('failed');
    expect(failedRecord?.error).toMatch(/simulated business-rule rejection/);

    const second = (await respondControlWrite(
      {
        tool: 'sigma_create_plan_draft', operationId: 'plan_create_draft', idempotencyKey: 'reject-then-retry',
        argumentsForHash: { x: 1 }, allowedRoles: ['FMN'], checkPreconditions: staleStateCheck(rev),
        transactionFiles: createPlanDraftTransactionFiles,
      },
      (root) => callCreate(root)
    )) as { structuredContent: Payload };
    expect(second.structuredContent.version).toBe('v0.1');

    const finalRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'plan_create_draft', 'FMN', 'reject-then-retry');
    expect(finalRecord?.status).toBe('completed');
    env.cleanup();
  });

  it('a pending record without a recovery journal fails closed instead of guessing that retry is safe', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('crashed-key', rev);
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(opts.argumentsForHash)).digest('hex');

    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'plan_create_draft', bound_role: 'FMN',
      idempotency_key: 'crashed-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'pending', pid: 999999, result: null, error: null,
      created_at: new Date().toISOString(),
      committed_at: null,
    });

    const res = (await respondControlWrite(opts, (root) => callCreate(root))) as { structuredContent: Payload };
    expect((res.structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readChain(env.projectDir, 'v1').plan.versions).toEqual([]);
    env.cleanup();
  });
});

describe('sigma-control — sigma_create_plan_draft through a real in-process MCP client', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('creates a plan draft end-to-end and returns a structured, versioned response', async () => {
    env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');

    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-control-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_create_plan_draft',
      arguments: { title: 'T', focus: 'F', idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.version).toBe('v0.1');
    expect(payload.contract_version).toBe('1.0');
    expect(res.structuredContent).toEqual(payload);

    const chain = readChain(env.projectDir, 'v1');
    expect(chain.plan.versions).toHaveLength(1);
    expect(chain.plan.versions[0].state).toBe('DRAFT');
    expect(chain.plan.versions[0].title).toBe('T');

    await client.close();
    await server.close();
  });
});

describe('sigma_create_plan_draft — cross-process concurrency and process-death recovery', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnCreate(root: string, idempotencyKey: string, expectedStateRevision: string, failpoint?: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    if (failpoint) childEnv.SIGMA_CONTROL_TEST_FAILPOINT = failpoint;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'FMN'],
      env: childEnv,
    });
    const client = new Client({ name: 'plan-concurrency-test', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_create_plan_draft',
      arguments: { title: 'Race', focus: 'Race', idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent sigma-control processes, same idempotency_key: exactly one plan draft is created', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnCreate(env.projectDir, 'cross-process-key', rev),
      spawnCreate(env.projectDir, 'cross-process-key', rev),
    ]);

    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.version).toBe('v0.1');
    expect(b.payload.version).toBe('v0.1');
    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(1);

    env.cleanup();
  }, 20000);

  it('two independent processes, different idempotency_key racing on the same expected_state_revision: exactly one wins, the loser sees STALE_STATE', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnCreate(env.projectDir, 'key-a', rev),
      spawnCreate(env.projectDir, 'key-b', rev),
    ]);

    const results = [a, b];
    const succeeded = results.filter((r) => r.isError !== true);
    const failed = results.filter((r) => r.isError === true);
    expect(succeeded.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect(failed.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect(succeeded[0].payload.version).toBe('v0.1');
    expect((failed[0].payload.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(1);

    env.cleanup();
  }, 20000);

  it.each([
    'after_journal_prepared',
    'after_idempotency_pending',
    'plan_create_after_artifact',
    'plan_create_after_chain',
    'plan_create_after_roadmap',
    'after_mutation_before_commit_marker',
    'after_commit_marker',
    'after_commit_idempotency',
    'after_commit_audit',
  ])(
    'recovers create-plan-draft deterministically after real process death at %s',
    async (failpoint) => {
      const env = setupTestEnv();
      bootstrapReadyProject(env);
      const rev = computeStateRevision(env.projectDir).revision!;
      const key = `kill-${failpoint}`;

      await expect(spawnCreate(env.projectDir, key, rev, failpoint)).rejects.toThrow();
      const recovered = await spawnCreate(env.projectDir, key, rev);
      expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
      expect(recovered.payload.version).toBe('v0.1');
      expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(1);

      env.cleanup();
    },
    20000
  );
});
