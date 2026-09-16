// Stage E W1 extension — sigma_update_artifact_draft's scope grew from
// intent-only (Stage C) to intent/plan/exec. This file covers exactly the
// two new types; intent's own contract (already proved in Stage C) stays in
// test/control-intent-draft.test.ts unchanged. Structural difference from
// intent driving most of these tests: chain.intent is a single object,
// chain.plan.versions[]/chain.exec.versions[] are arrays — the lookup, not
// just the role, differs per type.

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
import { updateArtifactDraft, ownerRoleForArtifactType } from '../src/mcp/control/artifactDraftUpdate';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';

import { setupTestEnv, stubProjectIdentity, writeChainFixture, makeChain, TestEnv } from './helpers';

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

function sha256(content: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(Buffer.from(content, 'utf-8')).digest('hex');
}

// One DRAFT plan (v0.1) plus, optionally, a second version (LOCKED, or a
// second DRAFT) to exercise array lookup — chain.plan.versions[] is never
// just the one entry in a real project once work progresses.
function projectWithDraftPlan(env: TestEnv, content: string, opts: { secondVersion?: { version: string; state: 'DRAFT' | 'LOCKED' } } = {}): void {
  stubProjectIdentity(env);
  const now = new Date().toISOString();
  const versions = [
    { version: 'v0.1', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
  ];
  if (opts.secondVersion) {
    versions.push({
      version: opts.secondVersion.version, state: opts.secondVersion.state,
      file: `Sigma/contract/FMN-PLAN-${opts.secondVersion.version}.md`, created_at: now, updated_at: now, intent_version_ref: 'v1',
    });
  }
  writeChainFixture(env, 'v1', makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: { active_version: 'v0.1', active_state: 'DRAFT', pending: [], versions },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  }));
  fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'contract'));
  fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md'), content);
  if (opts.secondVersion) {
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'contract', `FMN-PLAN-${opts.secondVersion.version}.md`), '# other version, untouched');
  }
}

function projectWithDraftExec(env: TestEnv, content: string): void {
  stubProjectIdentity(env);
  const now = new Date().toISOString();
  writeChainFixture(env, 'v1', makeChain('v1', {
    lifecycle_state: 'BUILD',
    intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
    roadmap: { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now },
    plan: {
      active_version: 'v0.1', active_state: 'LOCKED', pending: [],
      versions: [{ version: 'v0.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v0.1', active_state: 'DRAFT',
      versions: [{ version: 'v0.1', state: 'DRAFT', file: 'Sigma/evidence/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, plan_version_ref: 'v0.1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  }));
  fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'evidence'));
  fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md'), content);
}

describe('sigma_update_artifact_draft — type "plan" (FMN role, array lookup)', () => {
  it('owner role is type-dependent: plan owned by FMN, exec by DEV, intent by ARC', () => {
    // Direct-service updateArtifactDraft() has no role check of its own —
    // role is enforced by respondControlWrite()/ownerRoleForArtifactType()
    // at the tool layer, exercised end-to-end via the transport-level tests
    // below. This proves the mapping itself is correct.
    expect(ownerRoleForArtifactType('plan')).toBe('FMN');
    expect(ownerRoleForArtifactType('exec')).toBe('DEV');
    expect(ownerRoleForArtifactType('intent')).toBe('ARC');
  });

  it('array lookup: updates v0.1 without touching a second, unrelated plan version', () => {
    const env = setupTestEnv();
    const original = '# plan draft v0.1';
    projectWithDraftPlan(env, original, { secondVersion: { version: 'v0.2', state: 'DRAFT' } });

    const result = updateArtifactDraft({
      projectRoot: env.projectDir, type: 'plan', version: 'v0.1',
      content: '# plan draft v0.1 revised', expectedArtifactSha256: sha256(original),
    });
    expect(result.path).toBe('Sigma/contract/FMN-PLAN-v0.1.md');

    const untouched = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.2.md'), 'utf-8');
    expect(untouched).toBe('# other version, untouched');
    env.cleanup();
  });

  it('rejects a version not present in chain.plan.versions[]', () => {
    const env = setupTestEnv();
    projectWithDraftPlan(env, '# plan draft');
    expect(() =>
      updateArtifactDraft({
        projectRoot: env.projectDir, type: 'plan', version: 'v9.9',
        content: 'x', expectedArtifactSha256: sha256('# plan draft'),
      })
    ).toThrow(/No plan version v9\.9 found/);
    env.cleanup();
  });

  it('rejects a plan version that is LOCKED, not DRAFT', () => {
    const env = setupTestEnv();
    projectWithDraftPlan(env, '# plan draft', { secondVersion: { version: 'v0.2', state: 'LOCKED' } });
    expect(() =>
      updateArtifactDraft({
        projectRoot: env.projectDir, type: 'plan', version: 'v0.2',
        content: 'x', expectedArtifactSha256: sha256('# other version, untouched'),
      })
    ).toThrow(/only a DRAFT/);
    env.cleanup();
  });

  it('rejects a stale expected_artifact_sha256 and leaves the file untouched', () => {
    const env = setupTestEnv();
    const original = '# plan draft original';
    projectWithDraftPlan(env, original);
    expect(() =>
      updateArtifactDraft({
        projectRoot: env.projectDir, type: 'plan', version: 'v0.1',
        content: '# attempted overwrite', expectedArtifactSha256: sha256('# some other content'),
      })
    ).toThrow(/STALE_ARTIFACT|changed since/);
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md'), 'utf-8');
    expect(onDisk).toBe(original);
    env.cleanup();
  });

  it('accepts a matching hash, writes atomically, and does not move state_revision', () => {
    const env = setupTestEnv();
    const original = '# plan draft original';
    projectWithDraftPlan(env, original);
    const before = revisionOf(env.projectDir);

    const result = updateArtifactDraft({
      projectRoot: env.projectDir, type: 'plan', version: 'v0.1',
      content: '# plan draft revised by FMN', expectedArtifactSha256: sha256(original),
    });
    expect(result.sha256).toBe(sha256('# plan draft revised by FMN'));
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md'), 'utf-8');
    expect(onDisk).toBe('# plan draft revised by FMN');

    const after = revisionOf(env.projectDir);
    expect(after).toBe(before);
    env.cleanup();
  });
});

describe('sigma_update_artifact_draft — type "exec" (DEV role, array lookup)', () => {
  it('rejects a version not present in chain.exec.versions[]', () => {
    const env = setupTestEnv();
    projectWithDraftExec(env, '# exec draft');
    expect(() =>
      updateArtifactDraft({
        projectRoot: env.projectDir, type: 'exec', version: 'v9.9',
        content: 'x', expectedArtifactSha256: sha256('# exec draft'),
      })
    ).toThrow(/No exec version v9\.9 found/);
    env.cleanup();
  });

  it('accepts a matching hash and writes the new content atomically', () => {
    const env = setupTestEnv();
    const original = '# exec draft original';
    projectWithDraftExec(env, original);
    const result = updateArtifactDraft({
      projectRoot: env.projectDir, type: 'exec', version: 'v0.1',
      content: '# exec draft revised by DEV', expectedArtifactSha256: sha256(original),
    });
    expect(result.path).toBe('Sigma/evidence/DEV-EXEC-v0.1.md');
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md'), 'utf-8');
    expect(onDisk).toBe('# exec draft revised by DEV');
    env.cleanup();
  });
});

describe('sigma-control — sigma_update_artifact_draft (plan/exec) through a real in-process MCP client', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('updates a plan DRAFT as FMN and is rejected for the same call bound to DEV', async () => {
    env = setupTestEnv();
    const original = '# plan draft';
    projectWithDraftPlan(env, original);

    // FMN — succeeds.
    setControlBinding(env.projectDir, 'FMN');
    let server = buildControlServer();
    let [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    let client = new Client({ name: 'plan-update-fmn', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    let rev = revisionOf(env.projectDir);
    let res = await client.callTool({
      name: 'sigma_update_artifact_draft',
      arguments: { type: 'plan', version: 'v0.1', content: '# updated by FMN', expected_artifact_sha256: sha256(original), idempotency_key: 'k1', expected_state_revision: rev },
    });
    let text = (res.content as Array<{ type: string; text: string }>)[0].text;
    let payload = JSON.parse(text) as Payload;
    expect(payload.sha256).toBe(sha256('# updated by FMN'));
    await client.close();
    await server.close();
    resetBindingForTest();

    // DEV, same operation — rejected.
    setControlBinding(env.projectDir, 'DEV');
    server = buildControlServer();
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'plan-update-dev', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    rev = revisionOf(env.projectDir);
    res = await client.callTool({
      name: 'sigma_update_artifact_draft',
      arguments: { type: 'plan', version: 'v0.1', content: '# should not land', expected_artifact_sha256: sha256('# updated by FMN'), idempotency_key: 'k2', expected_state_revision: rev },
    });
    text = (res.content as Array<{ type: string; text: string }>)[0].text;
    payload = JSON.parse(text) as Payload;
    expect((payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md'), 'utf-8');
    expect(onDisk).toBe('# updated by FMN'); // DEV's attempt never landed
    await client.close();
    await server.close();
  });

  it('updates an exec DRAFT as DEV and is rejected for the same call bound to FMN', async () => {
    env = setupTestEnv();
    const original = '# exec draft';
    projectWithDraftExec(env, original);

    setControlBinding(env.projectDir, 'FMN');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'exec-update-fmn', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_update_artifact_draft',
      arguments: { type: 'exec', version: 'v0.1', content: '# should not land', expected_artifact_sha256: sha256(original), idempotency_key: 'k1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect((payload.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md'), 'utf-8');
    expect(onDisk).toBe(original);
    await client.close();
    await server.close();
  });

  it('rejects roadmap/close at the schema level — scope did not silently widen past plan/exec', async () => {
    env = setupTestEnv();
    projectWithDraftPlan(env, '# plan draft');
    setControlBinding(env.projectDir, 'FMN');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'roadmap-scope-check', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_update_artifact_draft',
      arguments: { type: 'roadmap', version: 'v1', content: 'x', expected_artifact_sha256: sha256('x'), idempotency_key: 'k1', expected_state_revision: rev },
    });
    expect(res.isError).toBe(true);
    await client.close();
    await server.close();
  });
});

describe('sigma_update_artifact_draft (plan) — cross-process concurrency', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnUpdatePlan(root: string, idempotencyKey: string, expectedStateRevision: string, expectedArtifactSha256: string, content: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'FMN'],
      env: childEnv,
    });
    const client = new Client({ name: 'plan-update-concurrency-test', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_update_artifact_draft',
      arguments: { type: 'plan', version: 'v0.1', content, expected_artifact_sha256: expectedArtifactSha256, idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent update processes racing on one plan artifact hash: exactly one writes, the loser sees STALE_ARTIFACT', async () => {
    const env = setupTestEnv();
    const original = '# plan draft original';
    projectWithDraftPlan(env, original);
    const rev = computeStateRevision(env.projectDir).revision!;
    const originalHash = sha256(original);

    const [a, b] = await Promise.all([
      spawnUpdatePlan(env.projectDir, 'update-a', rev, originalHash, '# update A'),
      spawnUpdatePlan(env.projectDir, 'update-b', rev, originalHash, '# update B'),
    ]);

    const results = [a, b];
    const succeeded = results.filter((r) => r.isError !== true);
    const failed = results.filter((r) => r.isError === true);
    expect(succeeded.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect(failed.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect((failed[0].payload.error as Payload).code).toBe('STALE_ARTIFACT');
    const onDisk = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md'), 'utf-8');
    expect(['# update A', '# update B']).toContain(onDisk);

    env.cleanup();
  }, 20000);
});
