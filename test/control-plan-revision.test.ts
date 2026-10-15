import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { fingerprintRoot } from '../src/mcp/binding';
import { computeStateRevision } from '../src/mcp/contract';
import { buildControlServer } from '../src/mcp/control/index';
import { setupTestEnv, stubProjectIdentity, validIntentDocV5, validPlanDocV3, runCli, TestEnv } from './helpers';
import {
  createInitialChain, ratifyIntent, certifyIntentDoc, registerPlanDraft, writeChain, writeActivateStatus, readActiveChain,
} from '../src/engine/chain';
import { writeChainMetadata } from '../src/engine/numbering';
import { withGovernanceTransaction } from '../src/engine/governanceTransaction';
import { approveArtifactUseCase, approveArtifactTransactionFiles } from '../src/services/approvalService';
import { revisionPaths, boundedPath, checkPlanRevision, readRevisionLedger } from '../src/engine/revisions';
import { readTicket, readApproval, writeApproval, generateId } from '../src/engine/controlStore';

// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — Phase 3, the PLAN
// revision trio. TC-MCP-03 (role binding), TC-MCP-06 (ticket lifecycle, replay,
// stale state), TC-MCP-07 (path containment). Differential against the CLI.

type Payload = Record<string, any>;
const V = 'v1.1';

const envs: TestEnv[] = [];
const clients: Client[] = [];
afterEach(async () => {
  resetBindingForTest();
  for (const c of clients.splice(0)) await c.close().catch(() => undefined);
  for (const e of envs.splice(0)) e.cleanup();
});

async function approvedPlan(approve = true): Promise<{ env: TestEnv; root: string }> {
  const env = setupTestEnv();
  envs.push(env);
  stubProjectIdentity(env);
  const root = env.projectDir;
  const intentFile = path.join(root, 'Sigma/charter/DIR-INTENT-v1.md');
  fs.outputFileSync(intentFile, validIntentDocV5('v1'));
  const chain = createInitialChain('v1', 'Sigma/charter/DIR-INTENT-v1.md', undefined, undefined, 'intent_aligned', 'paired_approval');
  writeChainMetadata(intentFile, chain);
  ratifyIntent(chain);
  certifyIntentDoc(chain, intentFile);
  registerPlanDraft(chain, V, `Sigma/contract/FMN-PLAN-${V}.md`, 'v1');
  const planFile = path.join(root, `Sigma/contract/FMN-PLAN-${V}.md`);
  fs.outputFileSync(planFile, validPlanDocV3(V));
  writeChainMetadata(planFile, chain);
  writeChain(root, 'v1', chain);
  writeActivateStatus(root, 'v1');
  if (approve) {
    await withGovernanceTransaction(root, 'plan_approve', () => approveArtifactTransactionFiles(root, 'plan', V), () => approveArtifactUseCase(root, 'plan', V));
  }
  return { env, root };
}

async function session(root: string, role: string | null): Promise<(name: string, args: Record<string, unknown>) => Promise<{ error: boolean; body: Payload }>> {
  setBinding({ mode: 'control', kind: 'verified', root, projectId: 'TEST', rootFingerprint: fingerprintRoot(root), role, verified: true });
  const server = buildControlServer();
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'plan-revision', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  clients.push(client);
  return async (name, args) => {
    const res = await client.callTool({ name, arguments: args });
    // Schema rejections come back as plain text from the SDK, not as an envelope.
    const text = (res.content as any)[0].text as string;
    let body: Payload;
    try { body = (res.structuredContent ?? JSON.parse(text)) as Payload; } catch { body = { error: { code: 'SCHEMA', message: text } }; }
    return { error: res.isError === true, body };
  };
}

const rev = (root: string): string => {
  const r = computeStateRevision(root).revision;
  if (!r) throw new Error('no state revision');
  return r;
};

const declaration = (loosening = false, checkpoint: 'pre-build' | 'post-build' | 'director' = 'pre-build') =>
  ({ version: V, checkpoint, reason: 'AC correction', requested_by: 'FMN', loosening, delta: 'Change AC-001' });

/** What an FMN does between prepare and check: edit the candidate file and declare the change in it. */
function editCandidate(root: string, loosening = false, checkpoint = 'pre-build'): void {
  const candidate = boundedPath(root, revisionPaths(V).candidate);
  let text = fs.readFileSync(candidate, 'utf8').replace('Test criteria.', 'Revised criteria.');
  text = text.replace('<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->',
    '<!-- SIGMA:FMN_PLAN:SECTION:CONTRACT_CHANGES -->\n## Contract Changes\n\n| No | Checkpoint | What Changed | Reason | Requested By | Loosening? | Director Approval |\n|:--|:--|:--|:--|:--|:--|:--|\n| 1 | '
    + checkpoint + ' | Change AC-001 | AC correction | FMN | ' + (loosening ? 'Yes' : 'No') + ' | Review package |\n\n<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->');
  fs.writeFileSync(candidate, text);
}

async function prepare(call: Awaited<ReturnType<typeof session>>, root: string, key: string, loosening = false, extra: Record<string, unknown> = {}) {
  return call('sigma_prepare_plan_revision', { ...declaration(loosening), ...extra, idempotency_key: key, expected_state_revision: rev(root) });
}

const planFileOf = (root: string) => path.join(root, `Sigma/contract/FMN-PLAN-${V}.md`);
const ledgerOf = (root: string) => readRevisionLedger(root, readActiveChain(root).data, V);

describe('plan revision tools — role binding (FMN only)', () => {
  it.each([null, 'ARC', 'DEV', 'AUD'])('refuses all three tools for role %s', async (role) => {
    const { root } = await approvedPlan();
    const call = await session(root, role);
    const staged = await call('sigma_prepare_plan_revision', { ...declaration(), idempotency_key: 'k1', expected_state_revision: rev(root) });
    const ticket = await call('sigma_issue_plan_revision_ticket', { version: V, idempotency_key: 'k2', expected_state_revision: rev(root) });
    const commit = await call('sigma_commit_plan_revision', { version: V, expected_candidate_sha256: 'a'.repeat(64), idempotency_key: 'k3', expected_state_revision: rev(root) });
    for (const r of [staged, ticket, commit]) {
      expect(r.error).toBe(true);
      expect(r.body.error.code).toBe('ROLE_NOT_AUTHORIZED');
    }
    expect(fs.existsSync(boundedPath(root, revisionPaths(V).candidate))).toBe(false);
  });
});

describe('sigma_prepare_plan_revision', () => {
  it('stages the same candidate as `sigma plan revise prepare`, leaving the canonical PLAN alone', async () => {
    const cli = await approvedPlan();
    const r = runCli(`plan revise prepare --v ${V} --checkpoint pre-build --reason "AC correction" --requested-by FMN --loosening false --delta "Change AC-001"`, cli.root, cli.env.homeDir);
    expect(r.exitCode, r.stderr).toBe(0);

    const mcp = await approvedPlan();
    const before = fs.readFileSync(planFileOf(mcp.root));
    const call = await session(mcp.root, 'FMN');
    const out = await prepare(call, mcp.root, 'k');
    expect(out.error, JSON.stringify(out.body)).toBe(false);
    expect(out.body.early_approval_required).toBe(false);

    const read = (root: string) => fs.readFileSync(boundedPath(root, revisionPaths(V).candidate));
    expect(read(mcp.root)).toEqual(read(cli.root));
    const stage = (root: string) => fs.readJsonSync(boundedPath(root, revisionPaths(V).staging));
    expect(stage(mcp.root).declaration).toEqual(stage(cli.root).declaration);
    expect(fs.readFileSync(planFileOf(mcp.root))).toEqual(before);
  });

  it('refuses a PLAN that is not APPROVED, an open candidate, and accepts replace_staging', async () => {
    const draft = await approvedPlan(false);
    const callDraft = await session(draft.root, 'FMN');
    const notApproved = await prepare(callDraft, draft.root, 'k');
    expect(notApproved.error).toBe(true);
    expect(notApproved.body.error.code).toBe('INVALID_OPERATION');
    expect(fs.existsSync(boundedPath(draft.root, revisionPaths(V).staging))).toBe(false);

    const { root } = await approvedPlan();
    const call = await session(root, 'FMN');
    expect((await prepare(call, root, 'a')).error).toBe(false);
    const second = await prepare(call, root, 'b');
    expect(second.error).toBe(true);
    expect(second.body.error.message).toMatch(/open staging candidate/);
    expect((await prepare(call, root, 'c', false, { replace_staging: true })).error).toBe(false);
  });

  it('rejects a version that is not a PLAN version, so no path can be steered', async () => {
    const { root } = await approvedPlan();
    const call = await session(root, 'FMN');
    for (const version of ['../../etc', 'v1', 'v1.0', 'v1.1/../x']) {
      const r = await call('sigma_prepare_plan_revision', { ...declaration(), version, idempotency_key: 'k', expected_state_revision: rev(root) });
      expect(r.error, version).toBe(true);
    }
    // The ledger folder exists from approval; nothing may have been staged.
    expect(fs.existsSync(path.join(root, 'Sigma', 'revisions', 'staging'))).toBe(false);
  });

  it('rejects a stale state revision before staging anything', async () => {
    const { root } = await approvedPlan();
    const call = await session(root, 'FMN');
    const r = await call('sigma_prepare_plan_revision', { ...declaration(), idempotency_key: 'k', expected_state_revision: 'sha256:' + '0'.repeat(64) });
    expect(r.error).toBe(true);
    expect(r.body.error.code).toBe('STALE_STATE');
    expect(fs.existsSync(boundedPath(root, revisionPaths(V).candidate))).toBe(false);
  });
});

describe('sigma_commit_plan_revision — ordinary revision (no approval needed)', () => {
  it('certifies exactly the reviewed candidate, once, and leaves the notice pending', async () => {
    const { root } = await approvedPlan();
    const call = await session(root, 'FMN');
    expect((await prepare(call, root, 'p')).error).toBe(false);
    editCandidate(root);
    const review = checkPlanRevision(root, V);
    expect(review.early_approval_required).toBe(false);
    const candidate = fs.readFileSync(boundedPath(root, revisionPaths(V).candidate));

    const args = { version: V, expected_candidate_sha256: review.candidate_sha256, idempotency_key: 'c', expected_state_revision: rev(root) };
    const first = await call('sigma_commit_plan_revision', args);
    expect(first.error, JSON.stringify(first.body)).toBe(false);
    expect(first.body.revision).toBe(2);
    expect(first.body.revision_id).toBe(`${V}:rev-2`);
    expect(first.body.status).toBe('pending_notice');
    expect(fs.readFileSync(planFileOf(root))).toEqual(candidate);
    expect(ledgerOf(root).records.map((r) => r.revision)).toEqual([1, 2]);

    // The same call again is a replay, not a third revision.
    const replay = await call('sigma_commit_plan_revision', args);
    expect(replay.error).toBe(false);
    expect(replay.body.revision).toBe(2);
    expect(ledgerOf(root).records).toHaveLength(2);
  });

  it('refuses a candidate that changed after it was checked, and certifies nothing', async () => {
    const { root } = await approvedPlan();
    const call = await session(root, 'FMN');
    await prepare(call, root, 'p');
    editCandidate(root);
    const reviewed = checkPlanRevision(root, V).candidate_sha256;
    const candidate = boundedPath(root, revisionPaths(V).candidate);
    fs.writeFileSync(candidate, fs.readFileSync(candidate, 'utf8') + '\n<!-- sneaked in after review -->\n');
    const planBefore = fs.readFileSync(planFileOf(root));

    const r = await call('sigma_commit_plan_revision', { version: V, expected_candidate_sha256: reviewed, idempotency_key: 'c', expected_state_revision: rev(root) });
    expect(r.error).toBe(true);
    expect(r.body.error.code).toBe('STALE_ARTIFACT');
    expect(fs.readFileSync(planFileOf(root))).toEqual(planBefore);
    expect(ledgerOf(root).records).toHaveLength(1);
  });

  it('produces the same ledger record as the CLI commit', async () => {
    const cli = await approvedPlan();
    runCli(`plan revise prepare --v ${V} --checkpoint pre-build --reason "AC correction" --requested-by FMN --loosening false --delta "Change AC-001"`, cli.root, cli.env.homeDir);
    editCandidate(cli.root);
    const done = runCli(`plan revise commit --v ${V}`, cli.root, cli.env.homeDir);
    expect(done.exitCode, done.stderr).toBe(0);

    const mcp = await approvedPlan();
    const call = await session(mcp.root, 'FMN');
    await prepare(call, mcp.root, 'p');
    editCandidate(mcp.root);
    const reviewed = checkPlanRevision(mcp.root, V).candidate_sha256;
    expect((await call('sigma_commit_plan_revision', { version: V, expected_candidate_sha256: reviewed, idempotency_key: 'c', expected_state_revision: rev(mcp.root) })).error).toBe(false);

    const shape = (root: string) => { const r = ledgerOf(root).records[1]; return { revision: r.revision, id: r.revision_id, contract: r.contract_sha256, snapshot: r.snapshot_sha256, auth: r.authorization ?? null }; };
    expect(shape(mcp.root)).toEqual(shape(cli.root));
    expect(fs.readFileSync(planFileOf(mcp.root))).toEqual(fs.readFileSync(planFileOf(cli.root)));
  });
});

describe('plan revision tools — loosening needs a Director approval (TC-MCP-06)', () => {
  async function stagedLoosening() {
    const { root } = await approvedPlan();
    const call = await session(root, 'FMN');
    expect((await prepare(call, root, 'p', true)).body.early_approval_required).toBe(true);
    editCandidate(root, true);
    return { root, call, review: checkPlanRevision(root, V) };
  }

  it('refuses to commit without a ticket and approval, and certifies nothing', async () => {
    const { root, call, review } = await stagedLoosening();
    const r = await call('sigma_commit_plan_revision', { version: V, expected_candidate_sha256: review.candidate_sha256, idempotency_key: 'c', expected_state_revision: rev(root) });
    expect(r.error).toBe(true);
    expect(r.body.error.code).toBe('APPROVAL_REQUIRED');
    expect(ledgerOf(root).records).toHaveLength(1);
  });

  it('runs ticket → Director approval → commit once, and a spent approval cannot be reused', async () => {
    const { root, call, review } = await stagedLoosening();
    const issued = await call('sigma_issue_plan_revision_ticket', { version: V, idempotency_key: 't', expected_state_revision: rev(root) });
    expect(issued.error, JSON.stringify(issued.body)).toBe(false);
    const ticketId = issued.body.operation_ticket_id as string;
    expect(issued.body.early_approval_required).toBe(true);
    expect(readTicket(root, ticketId)?.target?.sha256).toBe(review.candidate_sha256);

    // A fabricated approval id is not an approval.
    const bogus = await call('sigma_commit_plan_revision', {
      version: V, expected_candidate_sha256: review.candidate_sha256, operation_ticket_id: ticketId,
      approval_id: 'appr_does_not_exist', idempotency_key: 'c0', expected_state_revision: rev(root),
    });
    expect(bogus.error).toBe(true);
    expect(ledgerOf(root).records).toHaveLength(1);

    // The Director's approval, recorded the way the trusted local CLI records it.
    const t = readTicket(root, ticketId)!;
    const approvalId = generateId('appr');
    writeApproval(root, {
      approval_id: approvalId, project_id: t.project_id, operation_ticket_id: ticketId, operation_id: t.operation_id,
      arguments_hash: t.arguments_hash, target_artifact: 'plan', target_version: V, target_sha256: t.target!.sha256,
      expected_state_revision: t.expected_state_revision, decision: 'approve', reason: null, director_identity: 'test-director',
      authentication_method: 'local_cli', channel: 'cli', issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null,
    });

    const args = {
      version: V, expected_candidate_sha256: review.candidate_sha256, operation_ticket_id: ticketId,
      approval_id: approvalId, idempotency_key: 'c1', expected_state_revision: rev(root),
    };
    const done = await call('sigma_commit_plan_revision', args);
    expect(done.error, JSON.stringify(done.body)).toBe(false);
    expect(done.body.revision).toBe(2);
    expect(readTicket(root, ticketId)?.consumed_at).toBeTruthy();
    expect(readApproval(root, approvalId)?.consumed_at).toBeTruthy();
    expect(ledgerOf(root).records[1].authorization?.approval.approval_id).toBe(approvalId);

    // New idempotency key, same spent approval: refused, no third revision.
    const again = await call('sigma_commit_plan_revision', { ...args, idempotency_key: 'c2', expected_state_revision: rev(root) });
    expect(again.error).toBe(true);
    expect(ledgerOf(root).records).toHaveLength(2);
  });

  it('refuses an approval that was recorded for a different candidate', async () => {
    const { root, call, review } = await stagedLoosening();
    const issued = await call('sigma_issue_plan_revision_ticket', { version: V, idempotency_key: 't', expected_state_revision: rev(root) });
    const ticketId = issued.body.operation_ticket_id as string;
    const t = readTicket(root, ticketId)!;
    const approvalId = generateId('appr');
    writeApproval(root, {
      approval_id: approvalId, project_id: t.project_id, operation_ticket_id: ticketId, operation_id: t.operation_id,
      arguments_hash: t.arguments_hash, target_artifact: 'plan', target_version: V, target_sha256: 'f'.repeat(64),
      expected_state_revision: t.expected_state_revision, decision: 'approve', reason: null, director_identity: 'test-director',
      authentication_method: 'local_cli', channel: 'cli', issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null,
    });
    const r = await call('sigma_commit_plan_revision', {
      version: V, expected_candidate_sha256: review.candidate_sha256, operation_ticket_id: ticketId,
      approval_id: approvalId, idempotency_key: 'c', expected_state_revision: rev(root),
    });
    expect(r.error).toBe(true);
    expect(['APPROVAL_MISMATCH', 'STALE_STATE']).toContain(r.body.error.code);
    expect(ledgerOf(root).records).toHaveLength(1);
  });
});
