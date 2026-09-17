// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §16.3, Stage C pilot — create +
// update DIR-INTENT DRAFT through sigma-control. Gate C (§14) asks for five
// properties; this file is organized around them: write only on bound
// project/DRAFT, role/gate mismatch rejected, retry does not duplicate
// effects, stale writes rejected, and (via test/mcp-tools.test.ts's existing
// exact-match tool list) the query server carries zero write tools.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot, resolveBinding, BindingError } from '../src/mcp/binding';
import { computeStateRevision } from '../src/mcp/contract';
import { listChainVersions, readChain } from '../src/engine/chain';
import { createIntentDraft, createIntentDraftTransactionFiles, IntentDraftError } from '../src/services/intentDraftService';
import { updateArtifactDraft } from '../src/mcp/control/artifactDraftUpdate';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';
import { readIdempotencyRecord, writeIdempotencyRecord } from '../src/engine/controlStore';

import {
  setupTestEnv,
  stubProjectIdentity,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChain,
  makeChainWithLockedIntent,
  TestEnv,
} from './helpers';

type Payload = Record<string, unknown>;

afterEach(() => {
  resetBindingForTest();
});

function bootstrapProject(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  stubProjectRootAnchor(env); // Sigma/activate_status.json { active_chain: null }
}

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

function createOpts(idempotencyKey: string, expectedStateRevision: string, title = 'Title', focus = 'Focus') {
  return {
    tool: 'sigma_create_intent_draft',
    operationId: 'intent_create_draft',
    idempotencyKey,
    argumentsForHash: { title, focus, allow_reopen_closed: false },
    allowedRoles: ['ARC'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: createIntentDraftTransactionFiles,
  };
}

function callCreate(root: string, title = 'Title', focus = 'Focus') {
  return createIntentDraft({ projectRoot: root, title, focus });
}

describe('sigma-control — binding requires a role', () => {
  it('refuses to resolve a control binding with project-id but no --role', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    expect(() =>
      resolveBinding({ mode: 'control', projectRoot: env.projectDir, projectId: 'TEST' })
    ).toThrow(BindingError);
    try {
      resolveBinding({ mode: 'control', projectRoot: env.projectDir, projectId: 'TEST' });
    } catch (e) {
      expect((e as BindingError).code).toBe('BINDING_REQUIRED');
    }
    env.cleanup();
  });

  it('resolves a full control binding with root + id + role', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    const binding = resolveBinding({ mode: 'control', projectRoot: env.projectDir, projectId: 'TEST', role: 'ARC' });
    expect(binding.verified).toBe(true);
    expect(binding.role).toBe('ARC');
    expect(binding.mode).toBe('control');
    env.cleanup();
  });
});

describe('sigma_create_intent_draft — role and gate boundary', () => {
  it('rejects a call with no bound role', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, null);
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createOpts('k1', rev), (root) => callCreate(root))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(listChainVersions(env.projectDir)).toEqual([]);
    env.cleanup();
  });

  it('rejects a call bound to a role other than ARC', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createOpts('k1', rev), (root) => callCreate(root))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(listChainVersions(env.projectDir)).toEqual([]);
    env.cleanup();
  });
});

describe('sigma_create_intent_draft — stale state', () => {
  it('rejects a stale expected_state_revision and creates nothing', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');

    const res = (await respondControlWrite(
      createOpts('k1', 'sha256:not-the-real-revision'),
      (root) => callCreate(root)
    )) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('STALE_STATE');
    expect(listChainVersions(env.projectDir)).toEqual([]);
    env.cleanup();
  });
});

describe('sigma_create_intent_draft — idempotency and concurrency', () => {
  it('retrying the same idempotency_key with the same arguments replays the original result, no duplicate effect', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('same-key', rev);

    const first = (await respondControlWrite(opts, (root) => callCreate(root))) as Payload;
    const firstBody = (first as { structuredContent: Payload }).structuredContent;
    expect(firstBody.chainVersion).toBe('v1');

    // Second call reuses the now-stale `rev` on purpose — a genuine retry
    // resends exactly what it sent the first time. It must still succeed via
    // replay, without re-checking state_revision.
    const second = (await respondControlWrite(opts, (root) => callCreate(root))) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect(secondBody.chainVersion).toBe('v1');
    expect(secondBody.relPath).toBe(firstBody.relPath);

    expect(listChainVersions(env.projectDir)).toEqual(['v1']);
    env.cleanup();
  });

  it('the same idempotency_key with different arguments is rejected as IDEMPOTENCY_CONFLICT', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);

    const first = (await respondControlWrite(
      createOpts('same-key', rev, 'Title A', 'Focus A'),
      (root) => callCreate(root, 'Title A', 'Focus A')
    )) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).chainVersion).toBe('v1');

    const second = (await respondControlWrite(
      createOpts('same-key', rev, 'Title B', 'Focus B'),
      (root) => callCreate(root, 'Title B', 'Focus B')
    )) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect((secondBody.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');

    // Only the first call's chain exists — the conflicting retry created nothing.
    expect(listChainVersions(env.projectDir)).toEqual(['v1']);
    env.cleanup();
  });

  it('two concurrent calls with the same idempotency_key produce exactly one commit', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('concurrent-key', rev);

    const [a, b] = await Promise.all([
      respondControlWrite(opts, (root) => callCreate(root)) as Promise<Payload>,
      respondControlWrite(opts, (root) => callCreate(root)) as Promise<Payload>,
    ]);

    const aBody = (a as { structuredContent: Payload }).structuredContent;
    const bBody = (b as { structuredContent: Payload }).structuredContent;
    expect(aBody.chainVersion).toBe('v1');
    expect(bBody.chainVersion).toBe('v1');

    // The project lock (src/mcp/control/shared.ts, now the cross-process
    // file lock in src/engine/controlStore.ts) serializes the two calls;
    // only one may observe "no existing record" and actually mutate.
    expect(listChainVersions(env.projectDir)).toEqual(['v1']);
    env.cleanup();
  });
});

describe('sigma_create_intent_draft — crash-window safety (Codex review finding P0-2, 2026-09-16)', () => {
  // Codex: a crash between mutate() succeeding and the idempotency record
  // being written was undetectable — a retry with the same key would
  // silently re-run the mutation. controlStore.ts's IdempotencyRecord is now
  // two-phase ("pending" written before mutate(), "completed" after); these
  // tests exercise both halves of that fix directly against the store,
  // without needing to actually crash a process.

  it('a synchronous rejection inside mutate() is retained as a "failed" record (not deleted) — an immediate retry with the SAME key is still not blocked', async () => {
    // Codex round 2 finding: an earlier version *deleted* the pending
    // reservation on a synchronous mutate() throw, erasing the only
    // evidence the attempt happened at all. This test now asserts the
    // opposite of what it used to: the record survives, marked "failed"
    // with the error message, rather than vanishing.
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);

    // A mutate() that always throws — stands in for any business-rule
    // rejection (bad doc, gate mismatch, whatever), not a crash.
    const rejecting = () =>
      respondControlWrite(
        {
          tool: 'sigma_create_intent_draft', operationId: 'intent_create_draft', idempotencyKey: 'reject-then-retry',
          argumentsForHash: { x: 1 }, allowedRoles: ['ARC'], checkPreconditions: staleStateCheck(rev),
          transactionFiles: createIntentDraftTransactionFiles,
        },
        () => { throw new Error('simulated business-rule rejection'); }
      ) as Promise<Payload>;

    const first = (await rejecting()) as { structuredContent: Payload };
    expect((first.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');

    const failedRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'intent_create_draft', 'ARC', 'reject-then-retry');
    expect(failedRecord?.status).toBe('failed');
    expect(failedRecord?.error).toMatch(/simulated business-rule rejection/);

    // A real retry — SAME idempotency_key and SAME arguments_hash as the
    // failed attempt (a genuine retry of the identical logical request, not
    // a different one reusing the key — that would correctly still be
    // IDEMPOTENCY_CONFLICT, key+arguments are a fixed pairing per §11.3),
    // this time succeeding — is not blocked by the retained "failed" record.
    const second = (await respondControlWrite(
      {
        tool: 'sigma_create_intent_draft', operationId: 'intent_create_draft', idempotencyKey: 'reject-then-retry',
        argumentsForHash: { x: 1 }, allowedRoles: ['ARC'], checkPreconditions: staleStateCheck(rev),
        transactionFiles: createIntentDraftTransactionFiles,
      },
      (root) => callCreate(root)
    )) as { structuredContent: Payload };
    expect(second.structuredContent.chainVersion).toBe('v1');

    // The retry's success overwrote the failed record with a completed one
    // — history for THIS key now shows its final, successful outcome.
    const finalRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'intent_create_draft', 'ARC', 'reject-then-retry');
    expect(finalRecord?.status).toBe('completed');

    env.cleanup();
  });

  it('a pending record without a recovery journal fails closed instead of guessing that retry is safe', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('crashed-key', rev);
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(opts.argumentsForHash)).digest('hex');

    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'intent_create_draft', bound_role: 'ARC',
      idempotency_key: 'crashed-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'pending', pid: 999999, result: null, error: null,
      created_at: new Date().toISOString(), // deliberately "fresh", not aged
      committed_at: null,
    });

    const res = (await respondControlWrite(opts, (root) => callCreate(root))) as { structuredContent: Payload };
    expect((res.structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(listChainVersions(env.projectDir)).toEqual([]);

    env.cleanup();
  });

  it('a syntactically valid but ill-shaped idempotency record (bad status/timestamp) fails closed, not silently trusted — Codex round 2 finding', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('bogus-shape-key', rev);
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(opts.argumentsForHash)).digest('hex');

    // Valid JSON, wrong shape — status is not "pending"/"completed" and
    // created_at is not parseable as a date. The first corruption fix only
    // caught JSON.parse failures; this is a different, subtler failure that
    // reached readIdempotencyRecord() untouched before this round's fix.
    const idempotencyDir = path.join(env.projectDir, 'Sigma', '.mcp-control', 'idempotency');
    fs.ensureDirSync(idempotencyDir);
    const hash = crypto.createHash('sha256').update('intent_create_draft ARC bogus-shape-key').digest('hex');
    fs.writeJsonSync(path.join(idempotencyDir, `${hash}.json`), {
      project_id: 'TEST', operation_id: 'intent_create_draft', bound_role: 'ARC',
      idempotency_key: 'bogus-shape-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'bogus', pid: 1, result: null, created_at: 'not-a-date', committed_at: null,
    });

    const res = (await respondControlWrite(opts, (root) => callCreate(root))) as { structuredContent: Payload };
    expect((res.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');
    expect(listChainVersions(env.projectDir)).toEqual([]);

    env.cleanup();
  });

  it('a present-but-corrupt idempotency record fails closed (INTERNAL_ERROR) instead of being treated as absent — Codex review finding C-R03', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const opts = createOpts('corrupt-key', rev);

    // Establish a real record, then corrupt the file that key hashes to —
    // the only way to reach it without exporting the internal hash-based
    // path function.
    const first = (await respondControlWrite(opts, (root) => callCreate(root))) as { structuredContent: Payload };
    expect(first.structuredContent.chainVersion).toBe('v1');

    const idempotencyDir = path.join(env.projectDir, 'Sigma', '.mcp-control', 'idempotency');
    const files = fs.readdirSync(idempotencyDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBe(1);
    fs.writeFileSync(path.join(idempotencyDir, files[0]), '{ not valid json');

    const second = (await respondControlWrite(opts, (root) => callCreate(root))) as { structuredContent: Payload };
    expect((second.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');
    // Fail-closed means no second chain — the corrupted record blocked a
    // blind re-run rather than silently allowing one.
    expect(listChainVersions(env.projectDir)).toEqual(['v1']);

    env.cleanup();
  });
});

describe('sigma_update_artifact_draft — scope and boundary', () => {
  function projectWithDraftIntent(env: TestEnv, content: string): void {
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChain('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), content);
  }

  function sha256(content: string): string {
    return 'sha256:' + crypto.createHash('sha256').update(Buffer.from(content, 'utf-8')).digest('hex');
  }

  it('refuses a type still outside scope after the Stage E plan/exec extension (roadmap, close)', () => {
    // plan/exec moved into scope in the Stage E W1 extension
    // (test/control-artifact-draft-update-plan-exec.test.ts covers those two
    // directly) — roadmap/close remain deliberately out, per Director's W1
    // list which only names "plan/exec".
    const env = setupTestEnv();
    projectWithDraftIntent(env, '# draft');
    for (const outOfScopeType of ['roadmap', 'close'] as const) {
      expect(() =>
        updateArtifactDraft({
          projectRoot: env.projectDir,
          type: outOfScopeType,
          version: 'v1',
          content: 'x',
          expectedArtifactSha256: sha256('# draft'),
        })
      ).toThrowError(/pilot scope/);
    }
    env.cleanup();
  });

  it('refuses to update an intent that is not the active chain\'s current version', () => {
    const env = setupTestEnv();
    projectWithDraftIntent(env, '# draft');
    expect(() =>
      updateArtifactDraft({
        projectRoot: env.projectDir,
        type: 'intent',
        version: 'v2',
        content: 'x',
        expectedArtifactSha256: sha256('# draft'),
      })
    ).toThrow(/not v2|v1, not v2/);
    env.cleanup();
  });

  it('refuses to update an intent that is no longer DRAFT', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), '# ratified');
    expect(() =>
      updateArtifactDraft({
        projectRoot: env.projectDir,
        type: 'intent',
        version: 'v1',
        content: 'x',
        expectedArtifactSha256: sha256('# ratified'),
      })
    ).toThrow(/only a DRAFT/);
    env.cleanup();
  });

  it('refuses a stale expected_artifact_sha256 and leaves the file untouched', () => {
    const env = setupTestEnv();
    const original = '# draft original';
    projectWithDraftIntent(env, original);
    expect(() =>
      updateArtifactDraft({
        projectRoot: env.projectDir,
        type: 'intent',
        version: 'v1',
        content: '# attempted overwrite',
        expectedArtifactSha256: sha256('# some other content the caller never actually read'),
      })
    ).toThrow(/STALE_ARTIFACT|changed since/);
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), 'utf-8');
    expect(onDisk).toBe(original);
    env.cleanup();
  });

  it('accepts a matching hash and writes the new content atomically', () => {
    const env = setupTestEnv();
    const original = '# draft original';
    projectWithDraftIntent(env, original);
    const result = updateArtifactDraft({
      projectRoot: env.projectDir,
      type: 'intent',
      version: 'v1',
      content: '# draft revised by ARC',
      expectedArtifactSha256: sha256(original),
    });
    expect(result.path).toBe('Sigma/charter/DIR-INTENT-v1.md');
    expect(result.sha256).toBe(sha256('# draft revised by ARC'));
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), 'utf-8');
    expect(onDisk).toBe('# draft revised by ARC');
    env.cleanup();
  });

  it('updating the DRAFT body does not move state_revision — the document is not a state_revision input', () => {
    const env = setupTestEnv();
    const original = '# draft original';
    projectWithDraftIntent(env, original);
    const before = revisionOf(env.projectDir);
    updateArtifactDraft({
      projectRoot: env.projectDir,
      type: 'intent',
      version: 'v1',
      content: '# draft revised',
      expectedArtifactSha256: sha256(original),
    });
    const after = revisionOf(env.projectDir);
    expect(after).toBe(before);
    env.cleanup();
  });
});

describe('sigma-control — transport-level (in-memory MCP client)', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('lists exactly the control-plane pilot tools (Stage C + Stage D + Stage E W1 + Stage F W2 batch) and executes a create through a real client', async () => {
    env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');

    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-control-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'sigma_close_humanize',
      'sigma_commit_close_lock',
      'sigma_commit_close_new',
      'sigma_commit_exec_lock',
      'sigma_commit_intent_amendment',
      'sigma_commit_intent_ratify',
      'sigma_commit_intent_score',
      'sigma_commit_intent_supersede',
      'sigma_commit_plan_lock',
      'sigma_commit_plan_promote',
      'sigma_commit_plan_supersede',
      'sigma_create_exec_draft',
      'sigma_create_intent_draft',
      'sigma_create_plan_draft',
      'sigma_create_roadmap_draft',
      'sigma_exec_humanize',
      'sigma_inbox_archive',
      'sigma_intent_humanize',
      'sigma_prepare_close_lock',
      'sigma_prepare_close_new',
      'sigma_prepare_exec_lock',
      'sigma_prepare_intent_amendment',
      'sigma_prepare_intent_ratify',
      'sigma_prepare_intent_score',
      'sigma_prepare_intent_supersede',
      'sigma_prepare_plan_lock',
      'sigma_prepare_plan_promote',
      'sigma_prepare_plan_supersede',
      'sigma_record_evidence',
      'sigma_render_roadmap',
      'sigma_update_artifact_draft',
      'sigma_update_reference',
    ]);
    // Stage F's supersede/close-lock pairs are genuinely high-blast-radius
    // (cascading, hard-to-reverse status changes) and are annotated
    // destructiveHint: true accordingly — every other tool remains false.
    const destructiveTools = new Set([
      'sigma_prepare_intent_supersede', 'sigma_commit_intent_supersede',
      'sigma_prepare_plan_supersede', 'sigma_commit_plan_supersede',
      'sigma_prepare_close_lock', 'sigma_commit_close_lock',
    ]);
    for (const t of tools) {
      expect(t.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: destructiveTools.has(t.name),
        idempotentHint: true,
      });
    }

    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_create_intent_draft',
      arguments: { title: 'T', focus: 'F', idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.chainVersion).toBe('v1');
    expect(payload.contract_version).toBe('1.0');
    expect(res.structuredContent).toEqual(payload);

    const chain = readChain(env.projectDir, 'v1');
    expect(chain.intent.state).toBe('DRAFT');
    expect(chain.intent.title).toBe('T');

    await client.close();
    await server.close();
  });

  it('a cross-project project_root-shaped attempt is meaningless — control tools take no project_root argument at all', async () => {
    // Documents the boundary rather than probing it: unlike the six legacy
    // query tools (which accept an empty/matching project_root for
    // compatibility), neither control tool's inputSchema has a project_root
    // field, so there is no argument surface to attempt a boundary violation
    // through in the first place. Asserted structurally here so a future
    // change that adds such a parameter fails this test.
    env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-control-client-2', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    for (const t of tools) {
      const props = (t.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      expect(Object.keys(props)).not.toContain('project_root');
    }

    await client.close();
    await server.close();
  });
});

describe('sigma_create_intent_draft — CLOSED-chain reopen confirmation', () => {
  it('refuses to open a new chain over a CLOSED one without allow_reopen_closed, and creates nothing', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChain('v1', { lifecycle_state: 'CLOSED' }));

    expect(() => createIntentDraft({ projectRoot: env.projectDir, title: 'T', focus: 'F' })).toThrow(IntentDraftError);
    expect(listChainVersions(env.projectDir)).toEqual(['v1']);

    const result = createIntentDraft({
      projectRoot: env.projectDir,
      title: 'T',
      focus: 'F',
      allowReopenClosed: true,
    });
    expect(result.chainVersion).toBe('v2');
    expect(listChainVersions(env.projectDir)).toEqual(['v1', 'v2']);
    env.cleanup();
  });
});

describe('sigma_create_intent_draft — cross-process concurrency (Codex review finding, 2026-09-16)', () => {
  // Every test above exercises the lock from inside a single process —
  // Promise.all() on two calls that share this process's event loop, which
  // an in-process promise chain (the pre-fix implementation) could already
  // serialize correctly. It could not serialize two separate OS processes,
  // which is exactly the shape plan §16.3 requires ("dua worker, paling
  // banyak satu berhasil") and exactly what this test uses: two real
  // `sigma-control` child processes, spawned independently, racing to
  // create a chain with the same idempotency_key.
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnCreate(root: string, idempotencyKey: string, expectedStateRevision: string, failpoint?: string) {
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
      name: 'sigma_create_intent_draft',
      arguments: { title: 'Race', focus: 'Race', idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  async function spawnUpdate(
    root: string,
    idempotencyKey: string,
    expectedStateRevision: string,
    expectedArtifactSha256: string,
    content: string
  ) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'ARC'],
      env: childEnv,
    });
    const client = new Client({ name: 'update-concurrency-test', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_update_artifact_draft',
      arguments: {
        type: 'intent',
        version: 'v1',
        content,
        expected_artifact_sha256: expectedArtifactSha256,
        idempotency_key: idempotencyKey,
        expected_state_revision: expectedStateRevision,
      },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent sigma-control processes, same idempotency_key: exactly one chain is created', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    stubProjectRootAnchor(env);
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnCreate(env.projectDir, 'cross-process-key', rev),
      spawnCreate(env.projectDir, 'cross-process-key', rev),
    ]);

    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    // Same idempotency_key, same arguments -> the second process must
    // observe the first's completed record and replay it, not race past
    // the lock and mint a second chain.
    expect(a.payload.chainVersion).toBe('v1');
    expect(b.payload.chainVersion).toBe('v1');
    expect(listChainVersions(env.projectDir)).toEqual(['v1']);

    env.cleanup();
  }, 20000);

  it('two independent sigma-control processes, different idempotency_key racing on the same expected_state_revision: exactly one wins, the loser sees STALE_STATE, never a torn write', async () => {
    // Different idempotency_key means these are two genuinely different
    // requests (§11.3), each entitled to its own effect — but both captured
    // the SAME expected_state_revision before either ran, so whichever loses
    // the lock race is *correctly* stale once the winner's write lands, not
    // just unlucky. That staleness detection working correctly under real
    // cross-process concurrency (not merely as a same-process unit test) is
    // exactly what the lock is for: without it, two processes could both
    // read "no chain yet" and both call nextChainVersion() -> "v1",
    // producing either a corrupted write or two chains silently claiming
    // the same version.
    const env = setupTestEnv();
    stubProjectIdentity(env);
    stubProjectRootAnchor(env);
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
    expect(succeeded[0].payload.chainVersion).toBe('v1');
    expect((failed[0].payload.error as Payload).code).toBe('STALE_STATE');
    expect(listChainVersions(env.projectDir)).toEqual(['v1']);

    env.cleanup();
  }, 20000);

  it('two independent update processes racing on one artifact hash: exactly one writes and the loser sees STALE_ARTIFACT', async () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChain('v1'));
    const artifactPath = path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md');
    const original = '# original draft';
    fs.writeFileSync(artifactPath, original);
    const rev = computeStateRevision(env.projectDir).revision!;
    const originalHash = 'sha256:' + crypto.createHash('sha256').update(Buffer.from(original, 'utf-8')).digest('hex');

    const [a, b] = await Promise.all([
      spawnUpdate(env.projectDir, 'update-a', rev, originalHash, '# update A'),
      spawnUpdate(env.projectDir, 'update-b', rev, originalHash, '# update B'),
    ]);

    const results = [a, b];
    const succeeded = results.filter((result) => result.isError !== true);
    const failed = results.filter((result) => result.isError === true);
    expect(succeeded.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect(failed.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect((failed[0].payload.error as Payload).code).toBe('STALE_ARTIFACT');
    expect(['# update A', '# update B']).toContain(fs.readFileSync(artifactPath, 'utf-8'));

    env.cleanup();
  }, 20000);

  it.each([
    'after_journal_prepared',
    'after_idempotency_pending',
    'create_after_artifact',
    'create_after_chain',
    'create_after_activate',
    'create_after_history',
    'after_mutation_before_commit_marker',
    'after_commit_marker',
    'after_commit_idempotency',
    'after_commit_audit',
  ])(
    'recovers create-intent deterministically after real process death at %s',
    async (failpoint) => {
      const env = setupTestEnv();
      stubProjectIdentity(env);
      stubProjectRootAnchor(env);
      const rev = computeStateRevision(env.projectDir).revision!;
      const key = `kill-${failpoint}`;

      await expect(spawnCreate(env.projectDir, key, rev, failpoint)).rejects.toThrow();
      const recovered = await spawnCreate(env.projectDir, key, rev);
      expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
      expect(recovered.payload.chainVersion).toBe('v1');
      expect(listChainVersions(env.projectDir)).toEqual(['v1']);

      env.cleanup();
    },
    20000
  );
});
