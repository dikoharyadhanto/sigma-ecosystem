// Stage F — W2 governance transition batch, final (9th of 10 operations;
// see SIGMA-MCP-OPERATION-CAPABILITY-MATRIX §3.3): plan_promote.
// intent_activate is deliberately NOT implemented as an MCP primitive
// (Director decision 2026-09-17, final — NOT ADMISSIBLE) and has no test
// file; the tier is complete at 9/10 by design, not 10/10. Same prepare ->
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
import { respondControlWrite } from '../src/mcp/control/shared';
import { promotePlanUseCase, planPromoteTransactionFiles } from '../src/services/planPromoteService';
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

  // Codex review 2026-09-17 (R-03): plan_promote is the only W2 operation
  // that renames a file, so its risk profile differs from every other test
  // in this batch — covered here rather than assumed proven by the shared
  // respondControlWrite() plumbing.

  it('commit rejects when the pending file content changed after prepare, even with identical args (STALE_ARTIFACT)', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const pendingPath = path.join(env.projectDir, 'Sigma', 'pending', 'FMN-PLAN-ab12.md');
    const s = await session(env, 'FMN');
    const prep = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'Stage 2', focus: 'Build the thing', idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');

    // Content drifts after prepare, before commit — same args, different bytes.
    fs.appendFileSync(pendingPath, '\n<!-- edited after prepare -->\n');

    const commit = await s.call('sigma_commit_plan_promote', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      id: 'ab12',
      title: 'Stage 2',
      focus: 'Build the thing',
      idempotency_key: 'c1',
    });
    expect(commit.isError).toBe(true);
    expect((commit.payload.error as Payload).code).toBe('STALE_ARTIFACT');
    expect(readChain(env.projectDir, 'v1').plan.pending).toHaveLength(1);
    expect(fs.existsSync(pendingPath)).toBe(true);
    await s.close();
    env.cleanup();
  });

  it('prepare rejects a pending-plan tracker entry pointing outside its canonical location (BOUNDARY_VIOLATION)', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    const now = new Date().toISOString();
    const chain = makeChainWithLockedIntent('v1') as any;
    chain.roadmap = { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now };
    // Tampered/corrupted tracker entry: id "ab12" but file points somewhere
    // else — real bytes exist there, but not at the id's canonical path.
    chain.plan.pending = [{ id: 'ab12', file: 'Sigma/pending/FMN-PLAN-decoy.md', created_at: now }];
    writeChainFixture(env, 'v1', chain);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'pending'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'pending', 'FMN-PLAN-decoy.md'), '# Decoy\n');
    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'roadmap', 'ROADMAP-v1.md'),
      '# ROADMAP\n\n<!-- SIGMA:RENDER:START:stage-overview -->\n<!-- SIGMA:RENDER:END:stage-overview -->\n'
    );

    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'Stage 2', focus: 'Build the thing', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('BOUNDARY_VIOLATION');
    await s.close();
    env.cleanup();
  });

  it('commit fails safely (no silent overwrite) when the destination FMN-PLAN path already exists', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    const destPath = path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md');
    fs.ensureDirSync(path.dirname(destPath));
    fs.writeFileSync(destPath, '# Pre-existing plan v0.1 — must not be overwritten\n');

    const s = await session(env, 'FMN');
    const prep = await s.call('sigma_prepare_plan_promote', { id: 'ab12', title: 'Stage 2', focus: 'Build the thing', idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_plan_promote', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      id: 'ab12',
      title: 'Stage 2',
      focus: 'Build the thing',
      idempotency_key: 'c1',
    });
    expect(commit.isError).toBe(true);
    // The pre-existing destination content must survive untouched, and the
    // pending plan/chain must not have been half-promoted.
    expect(fs.readFileSync(destPath, 'utf8')).toContain('Pre-existing plan v0.1');
    expect(readChain(env.projectDir, 'v1').plan.pending).toHaveLength(1);
    expect(readChain(env.projectDir, 'v1').plan.versions).toHaveLength(0);
    await s.close();
    env.cleanup();
  });
});

describe('sigma_commit_plan_promote — rollback proves the rename itself is reversible', () => {
  // A real subprocess process-death test (SIGMA_CONTROL_TEST_FAILPOINT via
  // bin/sigma-control.js, the pattern control-plan-draft.test.ts uses for
  // sigma_create_plan_draft) requires a current dist/ build — this repo's
  // global `sigma-mcp` symlink means running `npm run build` mid-session
  // makes unreviewed code live for every MCP client on this machine
  // instantly (see memory `global-sigma-mcp-symlink`), so this session
  // deliberately does not build. What matters for R-03 is proven without it:
  // recoverControlTransactions() (what a killed process's next writer runs)
  // and respondControlWrite()'s own catch block both terminate a failed
  // attempt through the identical finalizeControlTransaction() ->
  // restoreSnapshots() call — see controlStore.ts. Calling
  // respondControlWrite() directly with a mutate() that performs the real
  // move via promotePlanUseCase() and then throws exercises that exact
  // restore path against this operation's actual transactionFiles(), which
  // is the part a rename could plausibly get wrong (two files, not one).
  it('a rejection immediately after the file move is fully reversed — pending file restored, destination removed, chain unchanged — and a clean retry then succeeds', async () => {
    const env = setupTestEnv();
    projectWithPendingPlan(env);
    setControlBinding(env.projectDir, 'FMN');
    const pendingPath = path.join(env.projectDir, 'Sigma', 'pending', 'FMN-PLAN-ab12.md');
    const destPath = path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md');
    const originalContent = fs.readFileSync(pendingPath, 'utf8');

    const crashingOpts = {
      tool: 'sigma_commit_plan_promote',
      operationId: 'plan_promote_commit',
      idempotencyKey: 'crash-sim',
      argumentsForHash: {},
      allowedRoles: ['FMN'],
      checkPreconditions: () => {},
      transactionFiles: (root: string) => planPromoteTransactionFiles(root, 'ab12'),
    };
    const first = (await respondControlWrite(crashingOpts, (root) => {
      promotePlanUseCase(root, 'ab12', 'Stage 2', 'Build the thing');
      throw new Error('simulated interruption right after the file move');
    })) as { structuredContent: Payload };
    expect((first.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');

    // The move must be reversed in full, not half-applied.
    expect(fs.existsSync(pendingPath)).toBe(true);
    expect(fs.readFileSync(pendingPath, 'utf8')).toBe(originalContent);
    expect(fs.existsSync(destPath)).toBe(false);
    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.plan.pending).toHaveLength(1);
    expect(chainAfter.plan.versions).toHaveLength(0);

    // A clean retry (no injected failure) must still succeed normally —
    // the rollback did not leave anything behind that would block it.
    const second = (await respondControlWrite(
      { ...crashingOpts, idempotencyKey: 'crash-sim-retry' },
      (root) => promotePlanUseCase(root, 'ab12', 'Stage 2', 'Build the thing')
    )) as { structuredContent: Payload };
    expect(second.structuredContent.version).toBe('v0.1');
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.existsSync(pendingPath)).toBe(false);

    env.cleanup();
  });
});
