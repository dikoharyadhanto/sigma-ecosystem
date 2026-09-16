// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §16.4, Stage D pilot — prepare ->
// Director approval (trusted local CLI) -> commit for intent_ratify.
// Organized around plan §16.4's approval test contract: chat confirmation
// without a Sigma approval record is rejected, mismatched
// project/operation/argument/artifact/hash approvals are rejected,
// expired/rejected/consumed approvals are rejected, and a successful commit
// marks the approval consumed with an audit correlation.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { readChain } from '../src/engine/chain';
import { buildControlServer } from '../src/mcp/control/index';
import { controlMutationTimingSnapshot, resetControlMutationTimings } from '../src/mcp/control/shared';
import { computeStateRevision } from '../src/mcp/contract';
import {
  ApprovalRecord,
  OperationTicket,
  readTicket,
  readApproval,
  writeTicket,
  writeApproval,
  generateId,
  APPROVAL_TTL_MS,
  AUDIT_FILE_REL,
} from '../src/engine/controlStore';
import {
  runCli,
  setupTestEnv,
  stubProjectIdentity,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChainWithDraftIntent,
  makeChainWithLockedIntent,
  validIntentDoc,
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

function projectWithDraftIntent(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));
  fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));
}

describe('control mutation duration versus filesystem lease heartbeat', () => {
  it('measures all four production tool mutations below the 250ms budget and 1000ms heartbeat', async () => {
    const { CONTROL_MUTATION_MAX_MS, CONTROL_LOCK_UPDATE_MS } = await import('../src/engine/controlStore');
    const env = setupTestEnv();
    stubProjectIdentity(env);
    stubProjectRootAnchor(env);
    resetControlMutationTimings();
    const s = await session(env, 'ARC');

    const create = await s.call('sigma_create_intent_draft', {
      title: 'Timing', focus: 'Timing', idempotency_key: 'timing-create',
      expected_state_revision: computeStateRevision(env.projectDir).revision,
    });
    expect(create.isError, JSON.stringify(create.payload)).not.toBe(true);

    const artifactPath = path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md');
    const original = fs.readFileSync(artifactPath);
    const update = await s.call('sigma_update_artifact_draft', {
      type: 'intent', version: 'v1', content: validIntentDoc('v1'),
      expected_artifact_sha256: 'sha256:' + crypto.createHash('sha256').update(original).digest('hex'),
      idempotency_key: 'timing-update',
      expected_state_revision: computeStateRevision(env.projectDir).revision,
    });
    expect(update.isError, JSON.stringify(update.payload)).not.toBe(true);

    const prepare = await s.call('sigma_prepare_intent_ratify', { idempotency_key: 'timing-prepare' });
    expect(prepare.isError, JSON.stringify(prepare.payload)).not.toBe(true);
    const approval = directorDecide(env.projectDir, prepare.payload.operation_ticket_id as string, 'approve');
    const commit = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: prepare.payload.operation_ticket_id,
      approval_id: approval.approval_id,
      idempotency_key: 'timing-commit',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).not.toBe(true);

    const timings = controlMutationTimingSnapshot();
    for (const tool of [
      'sigma_create_intent_draft',
      'sigma_update_artifact_draft',
      'sigma_prepare_intent_ratify',
      'sigma_commit_intent_ratify',
    ]) {
      expect(timings[tool]?.count, tool).toBe(1);
      expect(timings[tool].max_ms, tool).toBeLessThan(CONTROL_MUTATION_MAX_MS);
      expect(timings[tool].max_ms, tool).toBeLessThan(CONTROL_LOCK_UPDATE_MS);
    }
    console.log('CONTROL_MUTATION_TIMINGS', JSON.stringify(timings));
    await s.close();
    env.cleanup();
  }, 20000);
});

async function session(env: TestEnv, role: string | null) {
  setControlBinding(env.projectDir, role);
  const server = buildControlServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'stageD-test', version: '0.0.0' });
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

/**
 * Stands in for `sigma control approve`/`reject` (src/commands/control.ts):
 * same controlStore.writeApproval() write path the CLI uses, without
 * spawning a subprocess per test case. The CLI's own subprocess behavior
 * (preview, --director-confirm gate, --reason requirement) is covered
 * separately below via runCli().
 */
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

async function prepareTicket(env: TestEnv, idempotencyKey = 'prep-1'): Promise<string> {
  const s = await session(env, 'ARC');
  const res = await s.call('sigma_prepare_intent_ratify', { idempotency_key: idempotencyKey });
  await s.close();
  if (res.isError) throw new Error('test setup: prepare failed — ' + JSON.stringify(res.payload));
  return res.payload.operation_ticket_id as string;
}

describe('sigma_prepare_intent_ratify', () => {
  it('requires ARC role', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const s = await session(env, 'DEV');
    const res = await s.call('sigma_prepare_intent_ratify', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    await s.close();
    env.cleanup();
  });

  it('refuses when the active intent is not DRAFT, and writes no ticket', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), '# already ratified');
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_prepare_intent_ratify', { idempotency_key: 'p1' });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', '.mcp-control', 'tickets'))).toBe(false);
    await s.close();
    env.cleanup();
  });

  it('freezes the current DRAFT into a ticket without mutating governance state', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_prepare_intent_ratify', { idempotency_key: 'p1' });
    expect(res.isError).not.toBe(true);
    expect(res.payload.operation_id).toBe('intent_ratify');
    expect((res.payload.target as Payload).artifact).toBe('intent');
    expect((res.payload.target as Payload).version).toBe('v1');
    expect(typeof res.payload.expected_state_revision).toBe('string');

    const chainAfter = readChain(env.projectDir, 'v1');
    expect(chainAfter.intent.state).toBe('DRAFT'); // prepare must not ratify anything itself
    await s.close();
    env.cleanup();
  });
});

describe('sigma_commit_intent_ratify — ticket validity', () => {
  it('refuses an unknown operation_ticket_id', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: 'opt_does-not-exist',
      approval_id: 'appr_does-not-exist',
      idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });

  it('refuses an expired ticket', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const ticket = readTicket(env.projectDir, ticketId) as OperationTicket;
    ticket.expires_at = new Date(Date.now() - 1000).toISOString();
    writeTicket(env.projectDir, ticket);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('DRAFT');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_commit_intent_ratify — approval contract (plan §16.4)', () => {
  it('a call with no Sigma approval record for approval_id is rejected (chat confirmation is never sufficient)', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: 'appr_never-recorded', idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_REQUIRED');
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('DRAFT');
    await s.close();
    env.cleanup();
  });

  it('an approval referencing a different ticket_id is rejected', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env, 'prep-a');
    const approval = directorDecide(env.projectDir, ticketId, 'approve', { operation_ticket_id: 'opt_some-other-ticket' });

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });

  it('an approval whose target_sha256 no longer matches the ticket is rejected', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve', { target_sha256: 'sha256:' + '0'.repeat(64) });

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });

  it('an approval with the SAME target_sha256 but a different target_artifact/target_version is rejected — Codex round 2 finding D-R05', async () => {
    // Round 1 only compared target_sha256, so an approval recorded against
    // a different artifact type or version (a coincidentally identical hash
    // — e.g. two placeholder documents with the same content) would have
    // been accepted. All three target fields must match now.
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve', { target_artifact: 'plan', target_version: 'v9.9' });

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });

  it('an approval whose expected_state_revision no longer matches the ticket is rejected', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve', { expected_state_revision: 'sha256:' + '1'.repeat(64) });

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });

  it('a "reject" decision is refused, not treated as an implicit approve', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'reject');

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('DRAFT');
    await s.close();
    env.cleanup();
  });

  it('an expired approval is refused', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve', { expires_at: new Date(Date.now() - 1000).toISOString() });

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });

  it('an already-consumed approval cannot be reused', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve', { consumed_at: new Date().toISOString() });

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_commit_intent_ratify — world moved since prepare', () => {
  it('refuses when live state_revision has drifted from what the ticket froze', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');

    // Something else touched the chain after prepare — e.g. a concurrent
    // amendment on a different artifact. Simulated directly on disk since
    // the exact cause doesn't matter, only that state_revision moved.
    const activatePath = path.join(env.projectDir, 'Sigma', 'activate_status.json');
    const activate = fs.readJsonSync(activatePath);
    fs.writeJsonSync(activatePath, { ...activate, _drift_marker: true });

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('DRAFT');
    await s.close();
    env.cleanup();
  });

  it('refuses when the DRAFT document changed after prepare, even with a valid approval', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');

    // Director approved the content read at prepare time; the DRAFT was
    // edited afterward. The approval is void for the new content.
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1') + '\nedited after prepare\n');

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('STALE_ARTIFACT');
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('DRAFT');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_commit_intent_ratify — happy path, single-use, audit', () => {
  it('commits, opens Gate 1, and marks both ticket and approval consumed', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(res.isError).not.toBe(true);
    expect(res.payload.version).toBe('v1');

    const chain = readChain(env.projectDir, 'v1');
    expect(chain.intent.state).toBe('RATIFIED');
    expect(chain.gates.gate_1_open).toBe(true);

    const ticketAfter = readTicket(env.projectDir, ticketId);
    expect(ticketAfter?.consumed_at).not.toBeNull();

    // Codex review finding (Stage C/D combined review): this assertion used
    // to stop at the ticket and never checked the approval record itself —
    // a bug in the test, not proof the approval was actually marked.
    const approvalAfter = readApproval(env.projectDir, approval.approval_id);
    expect(approvalAfter?.consumed_at).not.toBeNull();

    const auditPath = path.join(env.projectDir, AUDIT_FILE_REL);
    const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]);
    expect(last.operation_id).toBe('intent_ratify_commit');
    expect(last.operation_ticket_id).toBe(ticketId);
    expect(last.approval_id).toBe(approval.approval_id);
    expect(last.channel).toBe('mcp-control');
    expect(last.outcome).toBe('commit');
    expect(last.state_revision_before).not.toBe(last.state_revision_after);

    await s.close();
    env.cleanup();
  });

  it('the SAME approval cannot commit a second, different transition (single-use)', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');

    const s = await session(env, 'ARC');
    const first = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c1',
    });
    expect(first.isError).not.toBe(true);

    // A different idempotency_key reusing the same ticket+approval must not
    // be able to piggyback on the idempotency cache — it has to go through
    // checkPreconditions again, which now sees a consumed ticket.
    const second = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'c2-different-key',
    });
    expect(second.isError).toBe(true);
    expect((second.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');

    await s.close();
    env.cleanup();
  });

  it('retrying with the SAME idempotency_key replays the result without re-ratifying', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');

    const s = await session(env, 'ARC');
    const first = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'same-key',
    });
    expect(first.isError).not.toBe(true);

    const second = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approval.approval_id, idempotency_key: 'same-key',
    });
    expect(second.isError).not.toBe(true);
    expect(second.payload.version).toBe(first.payload.version);

    await s.close();
    env.cleanup();
  });
});

describe('sigma control approve/reject — trusted local Director CLI', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('show previews a ticket without requiring confirmation or writing an approval', async () => {
    env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);

    const result = runCli(`control show ${ticketId}`, env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(new RegExp(ticketId));
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', '.mcp-control', 'approvals'))).toBe(false);
  });

  it('approve without --director-confirm previews but does not record an approval', async () => {
    env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);

    const result = runCli(`control approve ${ticketId}`, env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--director-confirm/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', '.mcp-control', 'approvals'))).toBe(false);
  });

  it('approve --director-confirm records an approval the commit tool can use end-to-end', async () => {
    env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);

    const result = runCli(`control approve ${ticketId} --director-confirm`, env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    const idMatch = result.stdout.match(/Approval recorded: (appr_[a-f0-9-]+)/);
    expect(idMatch).not.toBeNull();
    const approvalId = idMatch![1];

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approvalId, idempotency_key: 'cli-flow',
    });
    expect(res.isError).not.toBe(true);
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('RATIFIED');
    await s.close();
  });

  it('reject requires --reason', async () => {
    env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);

    const result = runCli(`control reject ${ticketId} --director-confirm`, env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
  });

  it('reject --reason --director-confirm records a reject decision the commit tool refuses', async () => {
    env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);

    const result = runCli(`control reject ${ticketId} --reason "not ready" --director-confirm`, env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    const idMatch = result.stdout.match(/Rejection recorded: (appr_[a-f0-9-]+)/);
    expect(idMatch).not.toBeNull();
    const approvalId = idMatch![1];

    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: ticketId, approval_id: approvalId, idempotency_key: 'cli-flow-reject',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('APPROVAL_MISMATCH');
    await s.close();
  });

  it('approve on an unknown ticket id fails cleanly', async () => {
    env = setupTestEnv();
    projectWithDraftIntent(env);

    const result = runCli('control approve opt_not-a-real-ticket --director-confirm', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/no operation ticket found/i);
  });
});

describe('controlStore — ticket/approval id path traversal (Codex review finding, 2026-09-16)', () => {
  // Independently reproduced against the pre-fix build before this test was
  // written: readTicket(root, "../../../../<name>") read a file outside the
  // project root entirely — operation_ticket_id/approval_id are MCP tool
  // arguments, so this was reachable from a model-controlled call, not just
  // a local file-path bug. Fixed by isValidStoreId() rejecting anything that
  // does not match generateId()'s exact `<prefix>_<uuid>` shape before the
  // id is ever joined into a filesystem path.
  it('readTicket/readApproval refuse a crafted id that would otherwise escape the project root', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);

    const outsidePath = path.join(env.homeDir, 'outside-secret.json');
    fs.writeJsonSync(outsidePath, { secret: 'leaked-if-traversal-works' });

    const ticketsDir = path.join(env.projectDir, 'Sigma', '.mcp-control', 'tickets');
    const maliciousId = path
      .relative(ticketsDir, outsidePath)
      .replace(/\.json$/, '')
      .split(path.sep)
      .join('/');
    expect(maliciousId).toMatch(/\.\./); // sanity: the crafted id actually walks upward

    const { readTicket, readApproval } = await import('../src/engine/controlStore');
    expect(readTicket(env.projectDir, maliciousId)).toBeNull();
    expect(readApproval(env.projectDir, maliciousId)).toBeNull();

    // A handful of other shapes, including ones with no ".." at all but
    // still outside the exact <prefix>_<uuid> grammar.
    for (const id of ['../../../../etc/passwd', 'opt_' + '../'.repeat(10) + 'secret', '', 'opt_not-a-uuid', 'DROP TABLE tickets']) {
      expect(readTicket(env.projectDir, id), `readTicket(${JSON.stringify(id)})`).toBeNull();
    }

    env.cleanup();
  });

  it('sigma_commit_intent_ratify refuses a crafted operation_ticket_id the same way as an unknown one', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const s = await session(env, 'ARC');
    const res = await s.call('sigma_commit_intent_ratify', {
      operation_ticket_id: '../../../../outside',
      approval_id: '../../../../outside',
      idempotency_key: 'traversal-attempt',
    });
    expect(res.isError).toBe(true);
    expect((res.payload.error as Payload).code).toBe('INVALID_OPERATION');
    await s.close();
    env.cleanup();
  });
});

describe('sigma_commit_intent_ratify — cross-process concurrency (Codex review finding, 2026-09-16)', () => {
  // Stage D's whole design is prepare and commit happening from separate
  // callers/processes — exactly the shape an in-process-only lock cannot
  // protect. Two real `sigma-control` child processes race to commit the
  // SAME ticket+approval under different idempotency_key values (simulating
  // two orchestrator attempts, not a client retrying its own call); at most
  // one may actually ratify.
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnCommit(
    root: string,
    ticketId: string,
    approvalId: string,
    idempotencyKey: string,
    failpoint?: string
  ) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    if (failpoint) childEnv.SIGMA_CONTROL_TEST_FAILPOINT = failpoint;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'ARC'],
      env: childEnv,
    });
    const client = new Client({ name: 'concurrency-test', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_commit_intent_ratify',
      arguments: { operation_ticket_id: ticketId, approval_id: approvalId, idempotency_key: idempotencyKey },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent sigma-control processes racing to commit the same ticket+approval: exactly one ratifies', async () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');

    const [a, b] = await Promise.all([
      spawnCommit(env.projectDir, ticketId, approval.approval_id, 'proc-a'),
      spawnCommit(env.projectDir, ticketId, approval.approval_id, 'proc-b'),
    ]);

    const results = [a, b];
    const succeeded = results.filter((r) => r.isError !== true);
    const failed = results.filter((r) => r.isError === true);
    expect(succeeded.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect(failed.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect(succeeded[0].payload.version).toBe('v1');
    expect((failed[0].payload.error as Payload).code).toBe('APPROVAL_MISMATCH');

    const chain = readChain(env.projectDir, 'v1');
    expect(chain.intent.state).toBe('RATIFIED');

    env.cleanup();
  }, 20000);

  it.each([
    'ratify_after_chain',
    'ratify_after_ticket_consumed',
    'ratify_after_approval_consumed',
    'after_commit_idempotency',
    'after_commit_audit',
  ])('recovers deterministically after real process death at %s', async (failpoint) => {
    const env = setupTestEnv();
    projectWithDraftIntent(env);
    const ticketId = await prepareTicket(env);
    const approval = directorDecide(env.projectDir, ticketId, 'approve');
    const key = `kill-${failpoint}`;

    await expect(spawnCommit(env.projectDir, ticketId, approval.approval_id, key, failpoint)).rejects.toThrow();

    // A fresh process acquires past the dead owner's unique claim, recovers
    // the journal (rollback before commit marker, roll-forward after it),
    // and returns the one canonical successful outcome for the same key.
    const recovered = await spawnCommit(env.projectDir, ticketId, approval.approval_id, key);
    expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
    expect(recovered.payload.version).toBe('v1');
    expect(readChain(env.projectDir, 'v1').intent.state).toBe('RATIFIED');
    expect(readTicket(env.projectDir, ticketId)?.consumed_at).toBeTruthy();
    expect(readApproval(env.projectDir, approval.approval_id)?.consumed_at).toBeTruthy();

    env.cleanup();
  }, 20000);
});

describe('acquireProjectLock — proper-lockfile lease (final remediation, 2026-09-16)', () => {
  it('serializes same-process contenders and removes the lease directory on release', async () => {
    const { acquireProjectLock } = await import('../src/engine/controlStore');
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-proper-lock-'));
    const first = await acquireProjectLock(projectDir);

    let secondHandle: Awaited<ReturnType<typeof acquireProjectLock>> | null = null;
    const secondAttempt = acquireProjectLock(projectDir).then((handle) => {
      secondHandle = handle;
      return 'acquired' as const;
    });
    const early = await Promise.race([
      secondAttempt,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 300)),
    ]);
    expect(early).toBe('timeout');

    await first.release();
    expect(await secondAttempt).toBe('acquired');
    secondHandle!.assertOwned();
    await secondHandle!.release();
    expect(fs.existsSync(path.join(projectDir, 'Sigma', '.mcp-control', 'project-write.lock'))).toBe(false);
    fs.removeSync(projectDir);
  });

  it('keeps a live holder through multiple heartbeat intervals', async () => {
    const { acquireProjectLock, CONTROL_LOCK_UPDATE_MS } = await import('../src/engine/controlStore');
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-proper-lock-heartbeat-'));
    const first = await acquireProjectLock(projectDir);
    await new Promise((resolve) => setTimeout(resolve, CONTROL_LOCK_UPDATE_MS * 2 + 250));
    first.assertOwned();

    let secondHandle: Awaited<ReturnType<typeof acquireProjectLock>> | null = null;
    const secondAttempt = acquireProjectLock(projectDir).then((handle) => {
      secondHandle = handle;
      return 'acquired' as const;
    });
    const early = await Promise.race([
      secondAttempt,
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 300)),
    ]);
    expect(early).toBe('timeout');

    await first.release();
    expect(await secondAttempt).toBe('acquired');
    await secondHandle!.release();
    fs.removeSync(projectDir);
  }, 10000);

  it('fails closed when the legacy lock protocol path is present', async () => {
    const { acquireProjectLock } = await import('../src/engine/controlStore');
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-proper-lock-legacy-'));
    fs.ensureDirSync(path.join(projectDir, 'Sigma', '.mcp-control', 'lock'));
    await expect(acquireProjectLock(projectDir)).rejects.toThrow(/Legacy sigma-control lock path/);
    fs.removeSync(projectDir);
  });

  it('three simultaneous contenders enter one at a time', async () => {
    const { acquireProjectLock } = await import('../src/engine/controlStore');
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-proper-lock-three-'));
    let active = 0;
    let maxActive = 0;
    const run = async () => {
      const handle = await acquireProjectLock(projectDir);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 50));
      active -= 1;
      await handle.release();
    };
    await Promise.all([run(), run(), run()]);
    expect(maxActive).toBe(1);
    fs.removeSync(projectDir);
  });
});
describe('readIdempotencyRecord — identity/invariant validation (Codex review round 3, 2026-09-16)', () => {
  // Reproduced independently before this fix: a `completed` record whose
  // JSON shape was valid but whose project_id/operation_id/bound_role/
  // idempotency_key content belonged to a completely different scope was
  // accepted and would have been replayed, because only field TYPES were
  // checked, never whether the content matched what was actually looked up.
  it('rejects a well-formed record whose content belongs to a different scope than the path it was looked up under', async () => {
    const { writeIdempotencyRecord, readIdempotencyRecord } = await import('../src/engine/controlStore');
    const env = setupTestEnv();
    projectWithDraftIntent(env);

    // Legitimate record at the path (project TEST / real_op / ARC / real-key) derives.
    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'real_op', bound_role: 'ARC', idempotency_key: 'real-key',
      arguments_hash: 'sha256:aaaa', status: 'pending', pid: process.pid, result: null, error: null,
      created_at: new Date().toISOString(), committed_at: null,
    });
    const idemDir = path.join(env.projectDir, 'Sigma', '.mcp-control', 'idempotency');
    const file = fs.readdirSync(idemDir).find((f) => f.endsWith('.json'))!;
    // Overwrite the CONTENT at that same path with a different scope's identity.
    fs.writeJsonSync(path.join(idemDir, file), {
      project_id: 'FOREIGN', operation_id: 'other_operation', bound_role: 'DEV', idempotency_key: 'other-key',
      arguments_hash: 'sha256:deadbeef', status: 'completed', pid: process.pid, result: { forged: true }, error: null,
      created_at: new Date().toISOString(), committed_at: new Date().toISOString(),
    });

    expect(() => readIdempotencyRecord(env.projectDir, 'TEST', 'real_op', 'ARC', 'real-key')).toThrow(/does not match the scope/);

    env.cleanup();
  });

  it('rejects a record whose status/committed_at/error combination is internally inconsistent', async () => {
    const { writeIdempotencyRecord, readIdempotencyRecord } = await import('../src/engine/controlStore');
    const env = setupTestEnv();
    projectWithDraftIntent(env);

    // "completed" but with committed_at still null (should never happen from
    // this module's own writers, which is exactly why a corrupted or
    // maliciously-edited file with this shape needs to be rejected here).
    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'inconsistent_op', bound_role: 'ARC', idempotency_key: 'inconsistent-key',
      arguments_hash: 'sha256:aaaa', status: 'completed', pid: process.pid, result: { ok: true }, error: null,
      created_at: new Date().toISOString(), committed_at: null,
    });

    expect(() => readIdempotencyRecord(env.projectDir, 'TEST', 'inconsistent_op', 'ARC', 'inconsistent-key'))
      .toThrow(/internally inconsistent/);

    env.cleanup();
  });
});
