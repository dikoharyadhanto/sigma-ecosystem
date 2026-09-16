// Stage E W1 pilot — sigma_create_exec_draft. Second primitive after
// sigma_create_plan_draft; exercises the same contract categories
// test/control-plan-draft.test.ts established, adapted for what differs
// about exec_draft specifically: its version is always the referenced
// PLAN's own version (no independent counter), and target-PLAN selection
// (PLAN-IMPL-MULTIDRAFT-LOCK §4's per-PLAN exec cardinality guard) is real
// business logic with its own error paths, not a formality.

import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import crypto from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { computeStateRevision } from '../src/mcp/contract';
import { readChain } from '../src/engine/chain';
import { createExecDraft, createExecDraftTransactionFiles, ExecDraftError } from '../src/services/execDraftService';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';
import { readIdempotencyRecord, writeIdempotencyRecord } from '../src/engine/controlStore';

import {
  setupTestEnv,
  stubProjectIdentity,
  writeChainFixture,
  makeChain,
  makeChainWithLockedPlan,
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

// One LOCKED plan (v1.1), no exec yet — Gate 2 open, exactly one candidate
// for auto-resolve. The happy-path baseline for every test below unless a
// test needs a different plan/exec shape.
function bootstrapReadyProject(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', makeChainWithLockedPlan('v1', 'v1.1'));
}

// Two LOCKED plans, neither executed — ambiguous auto-resolve.
function chainWithTwoUnexecutedPlans() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.2', active_state: 'LOCKED', pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

// PLAN v1.1 is LOCKED but already has an open (DRAFT) exec — zero remaining
// candidates, and the direct EXEC CONFLICT target for an explicit request.
function chainWithOnePlanAlreadyExecuted() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v1.1', active_state: 'DRAFT',
      versions: [{ version: 'v1.1', state: 'DRAFT', file: 'Sigma/evidence/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

// PLAN v1.1 LOCKED with no exec (candidate), PLAN v1.2 still DRAFT (not a
// LOCKED plan at all) — Gate 2 is open (v1.1 alone satisfies it), but v1.2
// is not a legal explicit target.
function chainWithOneLockedOneDraftPlan() {
  const now = new Date().toISOString();
  return makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v1.2', active_state: 'DRAFT', pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

function createOpts(idempotencyKey: string, expectedStateRevision: string, planVersion?: string) {
  return {
    tool: 'sigma_create_exec_draft',
    operationId: 'exec_create_draft',
    idempotencyKey,
    argumentsForHash: { plan_version: planVersion ?? null },
    allowedRoles: ['DEV'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: (root: string) => createExecDraftTransactionFiles(root, planVersion),
  };
}

function callCreate(root: string, planVersion?: string) {
  return createExecDraft({ projectRoot: root, planVersion });
}

describe('sigma_create_exec_draft — role and gate boundary', () => {
  it('rejects a call with no bound role', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, null);
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createOpts('k1', rev), (root) => callCreate(root))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readChain(env.projectDir, 'v1').exec.versions).toEqual([]);
    env.cleanup();
  });

  it('rejects a call bound to a role other than DEV (including FMN, which owns plan_draft)', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createOpts('k1', rev), (root) => callCreate(root))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readChain(env.projectDir, 'v1').exec.versions).toEqual([]);
    env.cleanup();
  });

  it('rejects when no PLAN is LOCKED at all (Gate 2 blocked) — direct service call, typed GATE_BLOCKED', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChain('v1')); // fresh chain, no plan at all

    expect(() => callCreate(env.projectDir)).toThrow(ExecDraftError);
    try {
      callCreate(env.projectDir);
    } catch (e) {
      expect((e as ExecDraftError).code).toBe('GATE_BLOCKED');
      expect((e as ExecDraftError).message).toMatch(/GATE 2 BLOCKED/);
    }
    env.cleanup();
  });
});

describe('sigma_create_exec_draft — target-PLAN selection (real business logic, not a formality)', () => {
  it('auto-resolves to the sole LOCKED plan with no open exec when plan_version is omitted', () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);

    const result = callCreate(env.projectDir);
    expect(result.planVersionRef).toBe('v1.1');
    expect(result.version).toBe('v1.1'); // exec version == plan version, not an independent counter
    env.cleanup();
  });

  it('rejects an explicit plan_version that is not a LOCKED plan', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', chainWithOneLockedOneDraftPlan());

    expect(() => callCreate(env.projectDir, 'v1.2')).toThrow(ExecDraftError);
    try {
      callCreate(env.projectDir, 'v1.2');
    } catch (e) {
      expect((e as ExecDraftError).code).toBe('INVALID_OPERATION');
      expect((e as ExecDraftError).message).toMatch(/is not a LOCKED plan/);
    }
    expect(readChain(env.projectDir, 'v1').exec.versions).toEqual([]);
    env.cleanup();
  });

  it('rejects an explicit plan_version whose plan already has a non-SUPERSEDED exec — EXEC CONFLICT', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', chainWithOnePlanAlreadyExecuted());

    expect(() => callCreate(env.projectDir, 'v1.1')).toThrow(/EXEC CONFLICT/);
    expect(readChain(env.projectDir, 'v1').exec.versions).toHaveLength(1); // unchanged
    env.cleanup();
  });

  it('rejects when omitted and zero candidates remain (every LOCKED plan already executed)', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', chainWithOnePlanAlreadyExecuted());

    expect(() => callCreate(env.projectDir)).toThrow(/All locked plans already have an exec/);
    env.cleanup();
  });

  it('rejects when omitted and more than one candidate is ambiguous', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', chainWithTwoUnexecutedPlans());

    expect(() => callCreate(env.projectDir)).toThrow(/2 unexecuted locked plans found/);
    expect(readChain(env.projectDir, 'v1').exec.versions).toEqual([]);
    env.cleanup();
  });

  it('an explicit plan_version resolves the same ambiguity deterministically', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', chainWithTwoUnexecutedPlans());

    const result = callCreate(env.projectDir, 'v1.2');
    expect(result.planVersionRef).toBe('v1.2');
    expect(result.version).toBe('v1.2');
    const versions = readChain(env.projectDir, 'v1').exec.versions;
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('v1.2');
    env.cleanup();
  });
});

describe('sigma_create_exec_draft — stale state', () => {
  it('rejects a stale expected_state_revision and creates nothing', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'DEV');

    const res = (await respondControlWrite(
      createOpts('k1', 'sha256:not-the-real-revision'),
      (root) => callCreate(root)
    )) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').exec.versions).toEqual([]);
    env.cleanup();
  });
});

describe('sigma_create_exec_draft — idempotency and concurrency', () => {
  it('retrying the same idempotency_key with the same arguments replays the original result, no duplicate effect', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('same-key', rev);

    const first = (await respondControlWrite(opts, (root) => callCreate(root))) as Payload;
    const firstBody = (first as { structuredContent: Payload }).structuredContent;
    expect(firstBody.version).toBe('v1.1');

    const second = (await respondControlWrite(opts, (root) => callCreate(root))) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect(secondBody.version).toBe('v1.1');
    expect(secondBody.relPath).toBe(firstBody.relPath);
    expect(readChain(env.projectDir, 'v1').exec.versions).toHaveLength(1);
    env.cleanup();
  });

  it('the same idempotency_key with a different plan_version is rejected as IDEMPOTENCY_CONFLICT', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', chainWithTwoUnexecutedPlans());
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);

    const first = (await respondControlWrite(
      createOpts('same-key', rev, 'v1.1'),
      (root) => callCreate(root, 'v1.1')
    )) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).version).toBe('v1.1');

    const second = (await respondControlWrite(
      createOpts('same-key', rev, 'v1.2'),
      (root) => callCreate(root, 'v1.2')
    )) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect((secondBody.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readChain(env.projectDir, 'v1').exec.versions).toHaveLength(1);
    env.cleanup();
  });

  it('two concurrent calls with the same idempotency_key produce exactly one commit', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('concurrent-key', rev);

    const [a, b] = await Promise.all([
      respondControlWrite(opts, (root) => callCreate(root)) as Promise<Payload>,
      respondControlWrite(opts, (root) => callCreate(root)) as Promise<Payload>,
    ]);

    const aBody = (a as { structuredContent: Payload }).structuredContent;
    const bBody = (b as { structuredContent: Payload }).structuredContent;
    expect(aBody.version).toBe('v1.1');
    expect(bBody.version).toBe('v1.1');
    expect(readChain(env.projectDir, 'v1').exec.versions).toHaveLength(1);
    env.cleanup();
  });
});

describe('sigma_create_exec_draft — crash-window safety (mirrors control-plan-draft.test.ts\'s contract)', () => {
  it('a synchronous rejection inside mutate() is retained as a "failed" record (not deleted) — an immediate retry with the SAME key is still not blocked', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);

    const rejecting = () =>
      respondControlWrite(
        {
          tool: 'sigma_create_exec_draft', operationId: 'exec_create_draft', idempotencyKey: 'reject-then-retry',
          argumentsForHash: { plan_version: null }, allowedRoles: ['DEV'], checkPreconditions: staleStateCheck(rev),
          transactionFiles: (root: string) => createExecDraftTransactionFiles(root),
        },
        () => { throw new Error('simulated business-rule rejection'); }
      ) as Promise<Payload>;

    const first = (await rejecting()) as { structuredContent: Payload };
    expect((first.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');

    const failedRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'exec_create_draft', 'DEV', 'reject-then-retry');
    expect(failedRecord?.status).toBe('failed');
    expect(failedRecord?.error).toMatch(/simulated business-rule rejection/);

    const second = (await respondControlWrite(
      {
        tool: 'sigma_create_exec_draft', operationId: 'exec_create_draft', idempotencyKey: 'reject-then-retry',
        argumentsForHash: { plan_version: null }, allowedRoles: ['DEV'], checkPreconditions: staleStateCheck(rev),
        transactionFiles: (root: string) => createExecDraftTransactionFiles(root),
      },
      (root) => callCreate(root)
    )) as { structuredContent: Payload };
    expect(second.structuredContent.version).toBe('v1.1');

    const finalRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'exec_create_draft', 'DEV', 'reject-then-retry');
    expect(finalRecord?.status).toBe('completed');
    env.cleanup();
  });

  it('a pending record without a recovery journal fails closed instead of guessing that retry is safe', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('crashed-key', rev);
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(opts.argumentsForHash)).digest('hex');

    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'exec_create_draft', bound_role: 'DEV',
      idempotency_key: 'crashed-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'pending', pid: 999999, result: null, error: null,
      created_at: new Date().toISOString(),
      committed_at: null,
    });

    const res = (await respondControlWrite(opts, (root) => callCreate(root))) as { structuredContent: Payload };
    expect((res.structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readChain(env.projectDir, 'v1').exec.versions).toEqual([]);
    env.cleanup();
  });
});

describe('sigma-control — sigma_create_exec_draft through a real in-process MCP client', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('creates an exec draft end-to-end and returns a structured response whose version matches the plan', async () => {
    env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'DEV');

    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-control-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_create_exec_draft',
      arguments: { idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.version).toBe('v1.1');
    expect(payload.planVersionRef).toBe('v1.1');
    expect(payload.contract_version).toBe('1.0');
    expect(res.structuredContent).toEqual(payload);

    const chain = readChain(env.projectDir, 'v1');
    expect(chain.exec.versions).toHaveLength(1);
    expect(chain.exec.versions[0].state).toBe('DRAFT');
    expect(chain.exec.versions[0].plan_version_ref).toBe('v1.1');

    await client.close();
    await server.close();
  });

  it('rejects a malformed plan_version at the schema level (not a "vN.N" token)', async () => {
    env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'DEV');

    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-control-client-2', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_create_exec_draft',
      arguments: { plan_version: '../../etc/passwd', idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    expect(res.isError).toBe(true);
    expect(readChain(env.projectDir, 'v1').exec.versions).toEqual([]);

    await client.close();
    await server.close();
  });
});

describe('sigma_create_exec_draft — cross-process concurrency and process-death recovery', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnCreate(root: string, idempotencyKey: string, expectedStateRevision: string, failpoint?: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    if (failpoint) childEnv.SIGMA_CONTROL_TEST_FAILPOINT = failpoint;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'DEV'],
      env: childEnv,
    });
    const client = new Client({ name: 'exec-concurrency-test', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_create_exec_draft',
      arguments: { idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent sigma-control processes, same idempotency_key: exactly one exec draft is created', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnCreate(env.projectDir, 'cross-process-key', rev),
      spawnCreate(env.projectDir, 'cross-process-key', rev),
    ]);

    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.version).toBe('v1.1');
    expect(b.payload.version).toBe('v1.1');
    expect(readChain(env.projectDir, 'v1').exec.versions).toHaveLength(1);

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
    expect(succeeded[0].payload.version).toBe('v1.1');
    expect((failed[0].payload.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').exec.versions).toHaveLength(1);

    env.cleanup();
  }, 20000);

  it.each([
    'after_journal_prepared',
    'after_idempotency_pending',
    'exec_create_after_artifact',
    'exec_create_after_chain',
    'after_mutation_before_commit_marker',
    'after_commit_marker',
    'after_commit_idempotency',
    'after_commit_audit',
  ])(
    'recovers create-exec-draft deterministically after real process death at %s',
    async (failpoint) => {
      const env = setupTestEnv();
      bootstrapReadyProject(env);
      const rev = computeStateRevision(env.projectDir).revision!;
      const key = `kill-${failpoint}`;

      await expect(spawnCreate(env.projectDir, key, rev, failpoint)).rejects.toThrow();
      const recovered = await spawnCreate(env.projectDir, key, rev);
      expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
      expect(recovered.payload.version).toBe('v1.1');
      expect(readChain(env.projectDir, 'v1').exec.versions).toHaveLength(1);

      env.cleanup();
    },
    20000
  );
});
