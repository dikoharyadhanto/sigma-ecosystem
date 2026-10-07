// Stage F — W2 governance transition batch (5 of 10 operations; see
// SIGMA-MCP-OPERATION-CAPABILITY-MATRIX §3.3): intent_amendment, intent_score,
// plan_lock, exec_lock, close_new. Each follows Stage D's prepare -> Director
// approval (trusted local CLI) -> commit shape (see prepareIntentRatify.ts /
// commitIntentRatify.ts). This file focuses on what's specific to each
// operation — role gate, business preconditions, and the approval/staleness
// contract's essential cases — rather than re-proving the shared
// respondControlWrite() plumbing (idempotency, crash-recovery, transaction
// journaling), which control-intent-ratify.test.ts already covers
// exhaustively against that one shared implementation.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { readChain, writeChain } from '../src/engine/chain';
import { buildControlServer } from '../src/mcp/control/index';
import {
  ApprovalRecord,
  OperationTicket,
  readTicket,
  writeTicket,
  writeApproval,
  generateId,
  APPROVAL_TTL_MS,
} from '../src/engine/controlStore';
import {
  setupTestEnv,
  stubProjectIdentity,
  writeChainFixture,
  makeChainWithLockedIntent,
  makeChainWithDraftIntent,
  makeChainWithLockedPlan,
  makeChainWithDraftExec,
  makeChainWithLockedExec,
  validIntentDoc,
  validPlanDoc,
  validExecDoc,
  TestEnv,
} from './helpers';
import { GitProject, setupGitProject, editIntent, commitIntent, git, gitTry } from './f05-git-helpers';

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
  const client = new Client({ name: 'stageF-test', version: '0.0.0' });
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

function directorDecide(
  root: string,
  ticketId: string,
  decision: 'approve' | 'reject',
  overrides: Partial<ApprovalRecord> = {}
): ApprovalRecord {
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
    ...overrides,
  };
  writeApproval(root, approval);
  return approval;
}

function projectWithRatifiedIntent(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
  fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
}

describe('sigma_prepare_intent_amendment / sigma_commit_intent_amendment (F05 Git flow)', () => {
  async function prepared(p: GitProject, change = 'Scope widened per Director', purpose = false) {
    editIntent(p);
    const s = await session(p.env, 'ARC');
    const prep = await s.call('sigma_prepare_intent_amendment', { change, purpose_changed: purpose, idempotency_key: 'p1' });
    return { s, prep };
  }

  it('prepare requires ARC role', async () => {
    const p = setupGitProject(setupTestEnv());
    const s = await session(p.env, 'DEV');
    const res = await s.call('sigma_prepare_intent_amendment', { change: 'x', purpose_changed: false, idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    p.cleanup();
  });

  it('prepare refuses when the active intent is not RATIFIED', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_prepare_intent_amendment', { change: 'x', purpose_changed: false, idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses a change containing a pipe', async () => {
    const p = setupGitProject(setupTestEnv());
    const s = await session(p.env, 'ARC');
    const res = await s.call('sigma_prepare_intent_amendment', { change: 'bad | change', purpose_changed: false, idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    p.cleanup();
  });

  it('prepare refuses without a Git baseline, and when nothing changed since the baseline', async () => {
    const noBaseline = setupGitProject(setupTestEnv(), { baseline: false });
    editIntent(noBaseline);
    const s1 = await session(noBaseline.env, 'ARC');
    const a = await s1.call('sigma_prepare_intent_amendment', { change: 'x', purpose_changed: false, idempotency_key: 'p1' });
    expect(a.isError).toBe(true);
    expect(JSON.stringify(a.payload)).toMatch(/baseline_recorded/);
    await s1.close();
    noBaseline.cleanup();

    const unchanged = setupGitProject(setupTestEnv());
    const s2 = await session(unchanged.env, 'ARC');
    const b = await s2.call('sigma_prepare_intent_amendment', { change: 'x', purpose_changed: false, idempotency_key: 'p1' });
    expect(b.isError).toBe(true);
    expect(JSON.stringify(b.payload)).toMatch(/changed_since_baseline/);
    await s2.close();
    unchanged.cleanup();
  });

  it('end-to-end: prepare -> approve -> commit verifies the commit, tags it, and certifies without rewriting the doc', async () => {
    const p = setupGitProject(setupTestEnv());
    const { s, prep } = await prepared(p);
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect(readChain(p.projectDir, 'v1').intent.amendments ?? []).toHaveLength(0); // prepare must not mutate

    const edited = fs.readFileSync(p.intentFile);
    const commitSha = commitIntent(p);
    const approval = directorDecide(p.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_intent_amendment', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      change: 'Scope widened per Director',
      purpose_changed: false,
      commit: commitSha,
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    expect(commit.payload.result_tag).toBe('sigma/intent-v1-amd-001');

    const after = readChain(p.projectDir, 'v1');
    expect(after.intent.amendments).toHaveLength(1);
    expect(after.intent.amendments![0]).toMatchObject({ change: 'Scope widened per Director', result_commit: commitSha, purpose_changed: false });
    expect(after.intent.git_baseline).toMatchObject({ commit: commitSha, provenance: 'amendment' });
    expect(fs.readFileSync(p.intentFile).equals(edited)).toBe(true);
    expect(git(p.repoDir, 'rev-parse', 'sigma/intent-v1-amd-001^{commit}')).toBe(commitSha);
    await s.close();
    p.cleanup();
  });

  it('commit rejects a change or purpose_changed that does not hash-match the ticket', async () => {
    const p = setupGitProject(setupTestEnv());
    const { s, prep } = await prepared(p, 'original text');
    const commitSha = commitIntent(p);
    const approval = directorDecide(p.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const base = { operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id, commit: commitSha };
    const changed = await s.call('sigma_commit_intent_amendment', { ...base, change: 'substituted text', purpose_changed: false, idempotency_key: 'c1' });
    expect(changed.isError).toBe(true);
    expect((changed.payload.error as Payload).code).toBe('INVALID_OPERATION');
    const flipped = await s.call('sigma_commit_intent_amendment', { ...base, change: 'original text', purpose_changed: true, idempotency_key: 'c2' });
    expect(flipped.isError).toBe(true);
    expect((flipped.payload.error as Payload).code).toBe('INVALID_OPERATION');
    expect(readChain(p.projectDir, 'v1').intent.amendments ?? []).toHaveLength(0);
    await s.close();
    p.cleanup();
  });

  it('commit fails with the unfinished steps when the approved content is not committed, and consumes nothing', async () => {
    const p = setupGitProject(setupTestEnv());
    const { s, prep } = await prepared(p);
    const approval = directorDecide(p.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const res = await s.call('sigma_commit_intent_amendment', {
      operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id,
      change: 'Scope widened per Director', purpose_changed: false, commit: p.baselineCommit!, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.payload)).toMatch(/unfinished steps/);
    expect(readChain(p.projectDir, 'v1').intent.amendments ?? []).toHaveLength(0);
    expect(readTicket(p.projectDir, prep.payload.operation_ticket_id as string)!.consumed_at).toBeNull();
    expect(gitTry(p.repoDir, 'rev-parse', '--verify', '--quiet', 'refs/tags/sigma/intent-v1-amd-001').ok).toBe(false);
    await s.close();
    p.cleanup();
  });

  it('commit rejects when the INTENT changed after prepare (stale document)', async () => {
    const p = setupGitProject(setupTestEnv());
    const { s, prep } = await prepared(p);
    editIntent(p, 'a further edit nobody approved');
    const commitSha = commitIntent(p);
    const approval = directorDecide(p.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const res = await s.call('sigma_commit_intent_amendment', {
      operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id,
      change: 'Scope widened per Director', purpose_changed: false, commit: commitSha, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('STALE_ARTIFACT');
    expect(readChain(p.projectDir, 'v1').intent.amendments ?? []).toHaveLength(0);
    await s.close();
    p.cleanup();
  });

  it('a ticket prepared before F05 (no Git review package) is rejected without consumption', async () => {
    const p = setupGitProject(setupTestEnv());
    const { s, prep } = await prepared(p);
    const commitSha = commitIntent(p);
    const ticketId = prep.payload.operation_ticket_id as string;
    const ticket = readTicket(p.projectDir, ticketId)!;
    delete ticket.dependencies_sha256;
    delete ticket.review_package;
    writeTicket(p.projectDir, ticket);
    const approval = directorDecide(p.projectDir, ticketId, 'approve');
    const res = await s.call('sigma_commit_intent_amendment', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id,
      change: 'Scope widened per Director', purpose_changed: false, commit: commitSha, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('STALE_ARTIFACT');
    expect(readTicket(p.projectDir, ticketId)!.consumed_at).toBeNull();
    await s.close();
    p.cleanup();
  });

  it('a consumed ticket cannot be committed twice', async () => {
    const p = setupGitProject(setupTestEnv());
    const { s, prep } = await prepared(p, 'once only');
    const commitSha = commitIntent(p);
    const approval = directorDecide(p.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const args = {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      change: 'once only',
      purpose_changed: false,
      commit: commitSha,
    };
    const first = await s.call('sigma_commit_intent_amendment', { ...args, idempotency_key: 'c1' });
    expect(first.isError, JSON.stringify(first.payload)).not.toBe(true);
    const second = await s.call('sigma_commit_intent_amendment', { ...args, idempotency_key: 'c2' });
    expect(second.isError).toBe(true);
    expect((second.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    expect(readChain(p.projectDir, 'v1').intent.amendments).toHaveLength(1);
    await s.close();
    p.cleanup();
  });
});

describe('sigma_prepare_intent_score / sigma_commit_intent_score', () => {
  it('prepare requires ARC role', async () => {
    const env = setupTestEnv();
    projectWithRatifiedIntent(env);
    const s = await session(env, 'AUD');
    const res = await s.call('sigma_prepare_intent_score', { score: 80, notes: 'good', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses notes containing a pipe (breaks the intent-history.md table)', async () => {
    const env = setupTestEnv();
    projectWithRatifiedIntent(env);
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_prepare_intent_score', { score: 80, notes: 'bad | notes', idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('end-to-end: records the ARC score and opens Gate 3.5', async () => {
    const env = setupTestEnv();
    projectWithRatifiedIntent(env);
    const s = await session(env, 'ARC');
    const prep = await s.call('sigma_prepare_intent_score', { score: 80, notes: 'Meets acceptance criteria', idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_intent_score', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      score: 80,
      notes: 'Meets acceptance criteria',
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.intent.arc_score).toBe(80);
    await s.close();
    env.cleanup();
  });

  it('commit rejects a score that does not hash-match what the ticket was prepared with', async () => {
    const env = setupTestEnv();
    projectWithRatifiedIntent(env);
    const s = await session(env, 'ARC');
    const prep = await s.call('sigma_prepare_intent_score', { score: 80, notes: 'original', idempotency_key: 'p1' });
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_intent_score', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      score: 40,
      notes: 'original',
      idempotency_key: 'c1',
    });
    expect(commit.isError).toBe(true);
    expect((commit.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_prepare_plan_approve / sigma_commit_plan_approve', () => {
  it('prepare requires FMN role', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan('v1', 'v1.1'));
    const s = await session(env, 'DEV');
    const res = await s.call('sigma_prepare_plan_approve', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses when there is no DRAFT FMN-PLAN to lock', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan('v1', 'v1.1')); // already LOCKED, not DRAFT
    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_plan_approve', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('end-to-end: locks the DRAFT FMN-PLAN and opens Gate 2', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
    // Register a DRAFT plan by hand (chain-level), mirroring plan_new's shape.
    const chain = readChain(env.projectDir, 'v1');
    chain.versioning_scheme = 'intent_aligned';
    (chain as any).plan.versions.push({
      version: 'v1.1', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v1.1.md',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), intent_version_ref: 'v1',
    });
    (chain as any).plan.active_version = 'v1.1';
    (chain as any).plan.active_state = 'DRAFT';
    writeChain(env.projectDir, 'v1', chain);
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v1.1.md'), validPlanDoc('v1.1'));

    const s = await session(env, 'FMN');
    const prep = await s.call('sigma_prepare_plan_approve', { idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect((prep.payload.target as Payload).version).toBe('v1.1');

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_plan_approve', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.plan.versions.find((v: any) => v.version === 'v1.1').state).toBe('LOCKED');
    expect(chainAfter.gates.gate_2_open).toBe(true);
    await s.close();
    env.cleanup();
  });
});

describe('sigma_prepare_exec_approve / sigma_commit_exec_approve', () => {
  it('prepare requires DEV role', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md'), validExecDoc('v0.1', 'v1'));
    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_exec_approve', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('end-to-end: locks the DRAFT DEV-EXEC and re-evaluates Gate 3', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md'), validExecDoc('v0.1', 'v1', 'READY_FOR_LOCK'));

    const s = await session(env, 'DEV');
    const prep = await s.call('sigma_prepare_exec_approve', { idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect((prep.payload.target as Payload).version).toBe('v0.1');

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_exec_approve', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);
    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.exec.versions.find((v: any) => v.version === 'v0.1').state).toBe('LOCKED');
    await s.close();
    env.cleanup();
  });

  it('commit rejects when the DRAFT doc changed after prepare (STALE_ARTIFACT)', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftExec('v1'));
    const execPath = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md');
    fs.writeFileSync(execPath, validExecDoc('v0.1', 'v1', 'READY_FOR_LOCK'));

    const s = await session(env, 'DEV');
    const prep = await s.call('sigma_prepare_exec_approve', { idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');

    // Content drifts after prepare, before commit.
    fs.appendFileSync(execPath, '\n<!-- edited after prepare -->\n');

    const commit = await s.call('sigma_commit_exec_approve', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      idempotency_key: 'c1',
    });
    expect(commit.isError).toBe(true);
    expect((commit.payload.error as Payload).code).toBe('STALE_ARTIFACT');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_prepare_close_new / sigma_commit_close_new', () => {
  it('prepare requires AUD role', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1', 80));
    const s = await session(env, 'FMN');
    const res = await s.call('sigma_prepare_close_new', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses when Gate 3 is blocked (no LOCKED exec paired to the LOCKED plan)', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedPlan('v1', 'v1.1'));
    const s = await session(env, 'AUD');
    const res = await s.call('sigma_prepare_close_new', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('GATE_BLOCKED');
    await s.close();
    env.cleanup();
  });

  it('prepare refuses when Gate 3.5 is blocked (no ARC score yet)', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1')); // arcScore omitted
    const s = await session(env, 'AUD');
    const res = await s.call('sigma_prepare_close_new', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('GATE_BLOCKED');
    await s.close();
    env.cleanup();
  });

  it('end-to-end: creates the DIR-CLOSE draft and moves lifecycle_state to CLOSE', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1', 80));

    const s = await session(env, 'AUD');
    const prep = await s.call('sigma_prepare_close_new', { idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).not.toBe(true);
    expect(prep.payload.target).toBeNull();

    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_close_new', {
      operation_ticket_id: prep.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);

    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.close?.state).toBe('DRAFT');
    expect(chainAfter.lifecycle_state).toBe('CLOSE');
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'))).toBe(true);
    await s.close();
    env.cleanup();
  });

  it('commit rejects a reused (already-consumed) approval', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1', 80));
    const s = await session(env, 'AUD');
    const prep = await s.call('sigma_prepare_close_new', { idempotency_key: 'p1' });
    const approval = directorDecide(env.projectDir, prep.payload.operation_ticket_id as string, 'approve');
    const first = await s.call('sigma_commit_close_new', {
      operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(first.isError, JSON.stringify(first.payload)).not.toBe(true);

    // Same ticket+approval replayed with a fresh idempotency_key must not
    // silently succeed a second time — the ticket is already consumed.
    const second = await s.call('sigma_commit_close_new', {
      operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id, idempotency_key: 'c2',
    });
    expect(second.isError).toBe(true);
    expect((second.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });
});
