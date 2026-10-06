// Stage F — W2 governance transition batch, continued (3 more of 10
// operations; see SIGMA-MCP-OPERATION-CAPABILITY-MATRIX §3.3):
// intent_supersede, plan_supersede, close_lock. Same prepare -> Director
// approval -> commit shape as control-w2-batch.test.ts; see that file's
// header for why this focuses on operation-specific behavior rather than
// re-proving the shared respondControlWrite() plumbing.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { readChain } from '../src/engine/chain';
import { buildControlServer } from '../src/mcp/control/index';
import {
  ApprovalRecord,
  OperationTicket,
  readTicket,
  writeApproval,
  generateId,
  APPROVAL_TTL_MS,
} from '../src/engine/controlStore';
import {
  setupTestEnv,
  stubProjectIdentity,
  writeChainFixture,
  makeChainWithFullBuiltCycle,
  makeChainWithLockedPlan,
  makeChainWithLockedExec,
  makeChainWithDraftClose,
  validIntentDoc,
  validPlanDoc,
  validCloseDoc,
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

async function session(env: TestEnv, role: string | null) {
  setControlBinding(env.projectDir, role);
  const server = buildControlServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'stageF-test-2', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    async call(name: string, args: Record<string, unknown>) {
      const res = await client.callTool({ name, arguments: args });
      const text = (res.content as Array<{ type: string; text: string }>)[0].text;
      return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
    },
    close: () => client.close(),
  };
}

function directorDecide(root: string, ticketId: string, decision: 'approve' | 'reject'): ApprovalRecord {
  const ticket = readTicket(root, ticketId);
  if (!ticket) throw new Error('test setup: ticket missing');
  const now = new Date();
  const approval: ApprovalRecord = {
    approval_id: generateId('appr'),
    project_id: ticket.project_id,
    operation_ticket_id: ticket.operation_ticket_id,
    operation_id: ticket.operation_id,
    arguments_hash: ticket.arguments_hash,
    target_artifact: ticket.target?.artifact ?? null,
    target_version: ticket.target?.version ?? null,
    target_sha256: ticket.target?.sha256 ?? null,
    expected_state_revision: ticket.expected_state_revision,
    decision,
    reason: decision === 'reject' ? 'test rejection' : null,
    director_identity: 'test-director',
    authentication_method: 'local_cli',
    channel: 'cli',
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + APPROVAL_TTL_MS).toISOString(),
    consumed_at: null,
  };
  writeApproval(root, approval);
  return approval;
}

describe('sigma_prepare_intent_supersede / sigma_commit_intent_supersede', () => {
  function fullCycleWithCertifiedIntent(env: TestEnv): void {
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithFullBuiltCycle('v1', 'v1.1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
  }

  it('prepare requires ARC role', async () => {
    const env = setupTestEnv();
    fullCycleWithCertifiedIntent(env);
    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_intent_supersede', { reason: 'obsolete', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('end-to-end: cascades SUPERSEDED to roadmap/plan/exec/close', async () => {
    const env = setupTestEnv();
    fullCycleWithCertifiedIntent(env);
    const s = await session(env, 'ARC');

    const prep = await s.call('sigma_prepare_intent_supersede', { reason: 'Superseded by DIR-INTENT v2', idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect(prep.payload.effects).toEqual(
      expect.arrayContaining([expect.stringContaining('intent.state: RATIFIED -> SUPERSEDED')])
    );

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_intent_supersede', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      reason: 'Superseded by DIR-INTENT v2',
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    expect(commit.payload.cascaded).toEqual({ roadmap: 1, plan: 1, exec: 1, close: 1 });

    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.intent.state).toBe('SUPERSEDED');
    expect(chainAfter.roadmap?.state).toBe('SUPERSEDED');
    expect(chainAfter.plan.versions[0].state).toBe('SUPERSEDED');
    expect(chainAfter.exec.versions[0].state).toBe('SUPERSEDED');
    expect(chainAfter.close?.state).toBe('SUPERSEDED');
    await s.close();
    env.cleanup();
  });

  it('commit rejects a `reason` that does not hash-match what the ticket was prepared with', async () => {
    const env = setupTestEnv();
    fullCycleWithCertifiedIntent(env);
    const s = await session(env, 'ARC');
    const prep = await s.call('sigma_prepare_intent_supersede', { reason: 'original', idempotency_key: 'p1' });
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_intent_supersede', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      reason: 'substituted',
      idempotency_key: 'c1',
    });
    expect(commit.isError).toBe(true);
    expect((commit.payload.error as Payload).code).toBe('INVALID_OPERATION');
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('RATIFIED');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_prepare_plan_supersede / sigma_commit_plan_supersede', () => {
  it('prepare requires FMN role', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan('v1', 'v1.1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));
    const s = await session(env, 'DEV');
    const res = await s.call('sigma_prepare_plan_supersede', { version: 'v1.1', reason: 'x', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses an unknown plan version', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan('v1', 'v1.1'));
    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_plan_supersede', { version: 'v9.9', reason: 'x', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('end-to-end: supersedes the plan and auto-cascades its linked DEV-EXEC', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));

    const s = await session(env, 'FMN');
    const prep = await s.call('sigma_prepare_plan_supersede', { version: 'v1.1', reason: 'Replaced by a better plan', idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect(prep.payload.effects).toEqual(
      expect.arrayContaining([expect.stringContaining('exec.v1.1.state:'), expect.stringContaining('cascade')])
    );

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_plan_supersede', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      reason: 'Replaced by a better plan',
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    expect(commit.payload.cascadedExecs).toEqual(['v1.1']);

    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.plan.versions[0].state).toBe('SUPERSEDED');
    expect(chainAfter.exec.versions[0].state).toBe('SUPERSEDED');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_prepare_close_lock / sigma_commit_close_lock', () => {
  it('prepare requires AUD role', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'), validCloseDoc('v1'));
    const s = await session(env, 'DEV');
    const res = await s.call('sigma_prepare_close_lock', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses when there is no active DIR-CLOSE', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1')); // no close yet
    const s = await session(env, 'AUD');
    const res = await s.call('sigma_prepare_close_lock', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('end-to-end without a roadmap: locks DIR-CLOSE and moves lifecycle_state to CLOSED', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'), validCloseDoc('v1'));

    const s = await session(env, 'AUD');
    const prep = await s.call('sigma_prepare_close_lock', { idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect(prep.payload.effects).not.toEqual(
      expect.arrayContaining([expect.stringContaining('roadmap')])
    );

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_close_lock', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    expect(commit.payload.roadmapLocked).toBeNull();

    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.close?.state).toBe('LOCKED');
    expect(chainAfter.lifecycle_state).toBe('CLOSED');
    await s.close();
    env.cleanup();
  });

  it('end-to-end with a DRAFT roadmap: auto-locks the roadmap as a cascade side effect', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    const chain = makeChainWithFullBuiltCycle('v1', 'v1.1') as any;
    chain.roadmap.state = 'DRAFT'; // still open — the case close_lock must cascade-lock
    writeChainFixture(env, 'v1', chain);
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'), validCloseDoc('v1'));

    const s = await session(env, 'AUD');
    const prep = await s.call('sigma_prepare_close_lock', { idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect(prep.payload.effects).toEqual(
      expect.arrayContaining([expect.stringContaining('roadmap.v1.state: DRAFT -> LOCKED')])
    );

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_close_lock', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    expect(commit.payload.roadmapLocked).toBe('v1');

    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.roadmap?.state).toBe('LOCKED');
    expect(chainAfter.close?.state).toBe('LOCKED');
    await s.close();
    env.cleanup();
  });

  it('a consumed ticket cannot be committed twice', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'), validCloseDoc('v1'));
    const s = await session(env, 'AUD');
    const prep = await s.call('sigma_prepare_close_lock', { idempotency_key: 'p1' });
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const args = { operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id };
    const first = await s.call('sigma_commit_close_lock', { ...args, idempotency_key: 'c1' });
    expect(first.isError, JSON.stringify(first.payload)).not.toBe(true);
    const second = await s.call('sigma_commit_close_lock', { ...args, idempotency_key: 'c2' });
    expect(second.isError).toBe(true);
    expect((second.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });
});
