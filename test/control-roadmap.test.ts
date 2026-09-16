// Stage E W1 batch — sigma_create_roadmap_draft + sigma_render_roadmap.
// chain.roadmap is a single object (SingleRoadmapState | null), like
// chain.intent — no independent version counter (always
// chain.chain_version). render is structurally unlike every prior control
// primitive: it never touches progress-v<N>.json, so state_revision must
// stay unchanged across a render, and it has no DRAFT/LOCKED precondition
// at all (only "a ROADMAP must exist").

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
import {
  createRoadmapDraft,
  createRoadmapDraftTransactionFiles,
  renderActiveRoadmap,
  renderActiveRoadmapTransactionFiles,
  RoadmapServiceError,
} from '../src/services/roadmapService';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';
import { readIdempotencyRecord, writeIdempotencyRecord } from '../src/engine/controlStore';

import { setupTestEnv, stubProjectIdentity, writeChainFixture, makeChain, makeChainWithLockedIntent, TestEnv } from './helpers';

type Payload = Record<string, unknown>;

afterEach(() => {
  resetBindingForTest();
});

function setControlBinding(root: string, role: string | null, projectId = 'TEST'): void {
  const binding: Binding = {
    mode: 'control', kind: 'verified', root, projectId,
    rootFingerprint: fingerprintRoot(root), role, verified: true,
  };
  setBinding(binding);
}

function revisionOf(root: string): string {
  const rev = computeStateRevision(root).revision;
  if (!rev) throw new Error('test setup produced no state_revision');
  return rev;
}

function bootstrapReadyProject(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1')); // RATIFIED intent, roadmap: null
}

function writeRoadmapTemplateFile(env: TestEnv, version = 'v1'): void {
  const src = path.join(__dirname, '..', 'Sigma', 'templates', 'ROADMAP-TEMPLATE.md');
  const dest = path.join(env.projectDir, 'Sigma', 'roadmap', `ROADMAP-${version}.md`);
  fs.ensureDirSync(path.dirname(dest));
  fs.copySync(src, dest);
}

function bootstrapProjectWithRoadmap(env: TestEnv, id = 'TEST', roadmapState: 'DRAFT' | 'LOCKED' | 'SUPERSEDED' = 'DRAFT'): void {
  stubProjectIdentity(env, id);
  const now = new Date().toISOString();
  const chain = makeChainWithLockedIntent('v1') as Record<string, unknown>;
  chain.roadmap = {
    version: 'v1', state: roadmapState, file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now,
    ...(roadmapState === 'LOCKED' ? { locked_at: now } : {}),
    ...(roadmapState === 'SUPERSEDED' ? { supersede_reason: 'test supersede' } : {}),
  };
  writeChainFixture(env, 'v1', chain);
  writeRoadmapTemplateFile(env, 'v1');
}

function createDraftOpts(idempotencyKey: string, expectedStateRevision: string) {
  return {
    tool: 'sigma_create_roadmap_draft',
    operationId: 'roadmap_create_draft',
    idempotencyKey,
    argumentsForHash: {},
    allowedRoles: ['FMN'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: createRoadmapDraftTransactionFiles,
  };
}

function renderOpts(idempotencyKey: string, expectedStateRevision: string) {
  return {
    tool: 'sigma_render_roadmap',
    operationId: 'roadmap_render',
    idempotencyKey,
    argumentsForHash: {},
    allowedRoles: ['FMN'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: renderActiveRoadmapTransactionFiles,
  };
}

describe('sigma_create_roadmap_draft — role and gate boundary', () => {
  it('rejects a call with no bound role', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, null);
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createDraftOpts('k1', rev), (root) => createRoadmapDraft({ projectRoot: root }))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readChain(env.projectDir, 'v1').roadmap).toBeNull();
    env.cleanup();
  });

  it('rejects a call bound to a role other than FMN', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(createDraftOpts('k1', rev), (root) => createRoadmapDraft({ projectRoot: root }))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    env.cleanup();
  });

  it('rejects when intent is not RATIFIED — typed GATE_BLOCKED', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChain('v1')); // DRAFT intent

    expect(() => createRoadmapDraft({ projectRoot: env.projectDir })).toThrow(RoadmapServiceError);
    try {
      createRoadmapDraft({ projectRoot: env.projectDir });
    } catch (e) {
      expect((e as RoadmapServiceError).code).toBe('GATE_BLOCKED');
      expect((e as RoadmapServiceError).message).toMatch(/ratified DIR-INTENT/);
    }
    env.cleanup();
  });

  it('rejects when a DRAFT ROADMAP already exists — typed INVALID_OPERATION, not INTERNAL_ERROR', () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env, 'TEST', 'DRAFT');
    expect(() => createRoadmapDraft({ projectRoot: env.projectDir })).toThrow(RoadmapServiceError);
    try {
      createRoadmapDraft({ projectRoot: env.projectDir });
    } catch (e) {
      expect((e as RoadmapServiceError).code).toBe('INVALID_OPERATION');
      expect((e as RoadmapServiceError).message).toMatch(/already exists/);
    }
    env.cleanup();
  });

  it('rejects when a LOCKED ROADMAP already exists', () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env, 'TEST', 'LOCKED');
    expect(() => createRoadmapDraft({ projectRoot: env.projectDir })).toThrow(/already exists/);
    env.cleanup();
  });

  it('a SUPERSEDED ROADMAP does not block creating a new one', () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env, 'TEST', 'SUPERSEDED');
    const result = createRoadmapDraft({ projectRoot: env.projectDir });
    expect(result.version).toBe('v1');
    env.cleanup();
  });
});

describe('sigma_create_roadmap_draft — stale state', () => {
  it('rejects a stale expected_state_revision and creates nothing', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const res = (await respondControlWrite(
      createDraftOpts('k1', 'sha256:not-the-real-revision'),
      (root) => createRoadmapDraft({ projectRoot: root })
    )) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect((body.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').roadmap).toBeNull();
    env.cleanup();
  });
});

describe('sigma_create_roadmap_draft — idempotency and crash-window', () => {
  it('retrying the same idempotency_key replays the original result, no duplicate effect', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const opts = createDraftOpts('same-key', rev);

    const first = (await respondControlWrite(opts, (root) => createRoadmapDraft({ projectRoot: root }))) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    const second = (await respondControlWrite(opts, (root) => createRoadmapDraft({ projectRoot: root }))) as Payload;
    expect(((second as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    env.cleanup();
  });

  it('a synchronous rejection inside mutate() is retained as a "failed" record; an immediate retry with the SAME key is not blocked', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);

    const rejecting = () =>
      respondControlWrite(
        { ...createDraftOpts('reject-then-retry', rev) },
        () => { throw new Error('simulated business-rule rejection'); }
      ) as Promise<Payload>;
    const first = (await rejecting()) as { structuredContent: Payload };
    expect((first.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');

    const failedRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'roadmap_create_draft', 'FMN', 'reject-then-retry');
    expect(failedRecord?.status).toBe('failed');

    const second = (await respondControlWrite(
      createDraftOpts('reject-then-retry', rev),
      (root) => createRoadmapDraft({ projectRoot: root })
    )) as { structuredContent: Payload };
    expect(second.structuredContent.version).toBe('v1');
    env.cleanup();
  });

  it('a pending record without a recovery journal fails closed', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const opts = createDraftOpts('crashed-key', rev);
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(opts.argumentsForHash)).digest('hex');
    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'roadmap_create_draft', bound_role: 'FMN',
      idempotency_key: 'crashed-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'pending', pid: 999999, result: null, error: null,
      created_at: new Date().toISOString(), committed_at: null,
    });
    const res = (await respondControlWrite(opts, (root) => createRoadmapDraft({ projectRoot: root }))) as { structuredContent: Payload };
    expect((res.structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readChain(env.projectDir, 'v1').roadmap).toBeNull();
    env.cleanup();
  });
});

describe('sigma_render_roadmap — role and precondition boundary', () => {
  it('rejects a call bound to a role other than FMN', async () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(renderOpts('k1', rev), (root) => renderActiveRoadmap(root))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    env.cleanup();
  });

  it('rejects when no ROADMAP exists at all', () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env); // no roadmap
    expect(() => renderActiveRoadmap(env.projectDir)).toThrow(/No ROADMAP found/);
    env.cleanup();
  });

  it('renders regardless of ROADMAP lock state — DRAFT, LOCKED, and SUPERSEDED all succeed', () => {
    for (const state of ['DRAFT', 'LOCKED', 'SUPERSEDED'] as const) {
      const env = setupTestEnv();
      bootstrapProjectWithRoadmap(env, 'TEST', state);
      const result = renderActiveRoadmap(env.projectDir);
      expect(result.version).toBe('v1');
      env.cleanup();
    }
  });

  it('never moves state_revision — render does not touch progress-v<N>.json', () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env);
    const before = revisionOf(env.projectDir);
    renderActiveRoadmap(env.projectDir);
    const after = revisionOf(env.projectDir);
    expect(after).toBe(before);
    env.cleanup();
  });

  it('is idempotent — re-rendering twice produces byte-identical file content', () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env);
    const roadmapPath = path.join(env.projectDir, 'Sigma', 'roadmap', 'ROADMAP-v1.md');
    renderActiveRoadmap(env.projectDir);
    const firstContent = fs.readFileSync(roadmapPath, 'utf-8');
    renderActiveRoadmap(env.projectDir);
    const secondContent = fs.readFileSync(roadmapPath, 'utf-8');
    expect(secondContent).toBe(firstContent);
    env.cleanup();
  });
});

describe('sigma_render_roadmap — stale state and idempotency', () => {
  it('rejects a stale expected_state_revision', async () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env);
    setControlBinding(env.projectDir, 'FMN');
    const res = (await respondControlWrite(
      renderOpts('k1', 'sha256:not-the-real-revision'),
      (root) => renderActiveRoadmap(root)
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('STALE_STATE');
    env.cleanup();
  });

  it('retrying the same idempotency_key replays the original result', async () => {
    const env = setupTestEnv();
    bootstrapProjectWithRoadmap(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const opts = renderOpts('same-key', rev);
    const first = (await respondControlWrite(opts, (root) => renderActiveRoadmap(root))) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    const second = (await respondControlWrite(opts, (root) => renderActiveRoadmap(root))) as Payload;
    expect(((second as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    env.cleanup();
  });
});

describe('sigma-control — roadmap tools through a real in-process MCP client', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('creates a roadmap draft end-to-end and returns a structured response', async () => {
    env = setupTestEnv();
    bootstrapReadyProject(env);
    setControlBinding(env.projectDir, 'FMN');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'roadmap-draft-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_create_roadmap_draft',
      arguments: { idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.version).toBe('v1');
    expect(payload.contract_version).toBe('1.0');
    const chain = readChain(env.projectDir, 'v1');
    expect(chain.roadmap?.state).toBe('DRAFT');
    await client.close();
    await server.close();
  });

  it('renders the roadmap end-to-end through a real client', async () => {
    env = setupTestEnv();
    bootstrapProjectWithRoadmap(env);
    setControlBinding(env.projectDir, 'FMN');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'roadmap-render-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_render_roadmap',
      arguments: { idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.version).toBe('v1');
    await client.close();
    await server.close();
  });
});

describe('sigma-control roadmap tools — cross-process concurrency and process-death recovery', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnCreateDraft(root: string, idempotencyKey: string, expectedStateRevision: string, failpoint?: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    if (failpoint) childEnv.SIGMA_CONTROL_TEST_FAILPOINT = failpoint;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'FMN'],
      env: childEnv,
    });
    const client = new Client({ name: 'roadmap-draft-concurrency', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_create_roadmap_draft',
      arguments: { idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent processes, same idempotency_key: exactly one roadmap draft is created', async () => {
    const env = setupTestEnv();
    bootstrapReadyProject(env);
    const rev = computeStateRevision(env.projectDir).revision!;
    const [a, b] = await Promise.all([
      spawnCreateDraft(env.projectDir, 'cross-process-key', rev),
      spawnCreateDraft(env.projectDir, 'cross-process-key', rev),
    ]);
    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.version).toBe('v1');
    expect(b.payload.version).toBe('v1');
    expect(readChain(env.projectDir, 'v1').roadmap).not.toBeNull();
    env.cleanup();
  }, 20000);

  it.each([
    'after_journal_prepared',
    'after_idempotency_pending',
    'roadmap_create_after_artifact',
    'roadmap_create_after_chain',
    'after_mutation_before_commit_marker',
    'after_commit_marker',
    'after_commit_idempotency',
    'after_commit_audit',
  ])(
    'recovers create-roadmap-draft deterministically after real process death at %s',
    async (failpoint) => {
      const env = setupTestEnv();
      bootstrapReadyProject(env);
      const rev = computeStateRevision(env.projectDir).revision!;
      const key = `kill-${failpoint}`;
      await expect(spawnCreateDraft(env.projectDir, key, rev, failpoint)).rejects.toThrow();
      const recovered = await spawnCreateDraft(env.projectDir, key, rev);
      expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
      expect(recovered.payload.version).toBe('v1');
      expect(readChain(env.projectDir, 'v1').roadmap).not.toBeNull();
      env.cleanup();
    },
    20000
  );
});
