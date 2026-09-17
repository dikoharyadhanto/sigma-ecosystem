// Stage F — W2 governance transition batch, final (10th of 10 operations;
// see SIGMA-MCP-OPERATION-CAPABILITY-MATRIX §3.3): plan_promote.
// intent_activate is deliberately NOT implemented as an MCP primitive
// (Director decision 2026-09-17) and has no test file. Same prepare ->
// Director approval -> commit shape as control-w2-batch.test.ts; see that
// file's header for why this focuses on operation-specific behavior.

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

async function session(env: TestEnv, role: string | null) {
  setControlBinding(env.projectDir, role);
  const server = buildControlServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'stageF-test-3', version: '0.0.0' });
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

function projectWithPendingPlan(env: TestEnv, pendingId = 'ab12'): void {
  stubProjectIdentity(env);
  const now = new Date().toISOString();
  const chain = makeChainWithLockedIntent('v1') as any;
  chain.roadmap = { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now };
  chain.plan.pending = [{ id: pendingId, file: `Sigma/pending/FMN-PLAN-${pendingId}.md`, created_at: now }];
  writeChainFixture(env, 'v1', chain);
  fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'pending'));
  fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'pending', `FMN-PLAN-${pendingId}.md`), '# Pending Plan\n\nStaged content.\n');
  fs.writeFileSync(
    path.join(env.projectDir, 'Sigma', 'roadmap', 'ROADMAP-v1.md'),
    '# ROADMAP\n\n<!-- SIGMA:RENDER:START:stage-overview -->\n<!-- SIGMA:RENDER:END:stage-overview -->\n'
  );
}

describe('sigma_prepare_plan_promote / sigma_commit_plan_promote', () => {
  it('prepare requires FMN role', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'Stage 2', focus: 'Build the thing', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses an unknown pending id', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_plan_promote', { id: 'zzzz', title: 'Stage 2', focus: 'Build the thing', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses title/focus containing a pipe', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'bad | title', focus: 'ok', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('end-to-end: promotes the pending plan into the DRAFT queue with an assigned version', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const s = await session(env, 'FMN');

    const prep = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'Stage 2', focus: 'Build the thing', idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect(prep.payload.projected_version).toBe('v0.1');
    const chainMidway = readChain(env.projectDir, 'v1');
    expect(chainMidway.plan.pending).toHaveLength(1); // prepare must not mutate

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_plan_promote', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      id: 'ab12',
      title: 'Stage 2',
      focus: 'Build the thing',
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    expect(commit.payload.version).toBe('v0.1');

    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.plan.pending).toHaveLength(0);
    expect(chainAfter.plan.versions).toHaveLength(1);
    expect(chainAfter.plan.versions[0]).toMatchObject({ version: 'v0.1', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v0.1.md' });
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md'))).toBe(true);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'pending', 'FMN-PLAN-ab12.md'))).toBe(false);
    await s.close();
    env.cleanup();
  });

  it('commit rejects title/focus that do not hash-match what the ticket was prepared with', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const s = await session(env, 'FMN');
    const prep = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'original', focus: 'original focus', idempotency_key: 'p1' });
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_plan_promote', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      id: 'ab12',
      title: 'substituted',
      focus: 'original focus',
      idempotency_key: 'c1',
    });
    expect(commit.isError).toBe(true);
    expect((commit.payload.error as Payload).code).toBe('INVALID_OPERATION');
    expect(readChain(env.projectDir, 'v1').plan.pending).toHaveLength(1);
    await s.close();
    env.cleanup();
  });

  it('a consumed ticket cannot be committed twice', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const s = await session(env, 'FMN');
    const prep = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'Stage 2', focus: 'Build the thing', idempotency_key: 'p1' });
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const args = { operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id, id: 'ab12', title: 'Stage 2', focus: 'Build the thing' };
    const first = await s.call('sigma_commit_plan_promote', { ...args, idempotency_key: 'c1' });
    expect(first.isError, JSON.stringify(first.payload)).not.toBe(true);
    const second = await s.call('sigma_commit_plan_promote', { ...args, idempotency_key: 'c2' });
    expect(second.isError).toBe(true);
    expect((second.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });
});
