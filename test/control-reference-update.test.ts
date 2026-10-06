// Stage E W1 batch — sigma_update_reference. Structurally unlike every
// other control primitive: it never reads or writes progress-v<N>.json at
// all (Sigma/SIGMA-OPERATION-REGISTRY.json's own gating note: "Not tracked
// in progress-v<N>.json — no gate, no lock state"), and role is "any" — all
// four AI roles are allowed, not one owner role.

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
import {
  updateReferenceList,
  referenceUpdateTransactionFiles,
  ReferenceUpdateError,
} from '../src/services/referenceUpdateService';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';
import { writeIdempotencyRecord } from '../src/engine/controlStore';

import { setupTestEnv, stubProjectIdentity, stubProjectRootAnchor, TestEnv } from './helpers';

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

function bootstrapProject(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  stubProjectRootAnchor(env);
}

function opts(idempotencyKey: string, expectedStateRevision: string) {
  return {
    tool: 'sigma_update_reference',
    operationId: 'reference_update',
    idempotencyKey,
    argumentsForHash: {},
    allowedRoles: ['ARC', 'FMN', 'DEV', 'AUD'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: referenceUpdateTransactionFiles,
  };
}

describe('sigma_update_reference — role boundary (any of the four AI roles)', () => {
  it('rejects a call with no bound role', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, null);
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(opts('k1', rev), (root) => updateReferenceList(root))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    env.cleanup();
  });

  it.each(['ARC', 'FMN', 'DEV', 'AUD'])('accepts binding role %s', async (role) => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, role);
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(opts(`k-${role}`, rev), (root) => updateReferenceList(root))) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect(body.error).toBeUndefined();
    expect(body.scaffolded).toBe(true); // no reference-list.md exists yet in a fresh project
    env.cleanup();
  });
});

describe('sigma_update_reference — direct service contract', () => {
  it('self-heals a missing reference-list.md', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    const result = updateReferenceList(env.projectDir);
    expect(result.scaffolded).toBe(true);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md'))).toBe(true);
    env.cleanup();
  });

  it('adds a row for a new top-level file in data/ and reports the count', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    updateReferenceList(env.projectDir); // scaffold first

    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');

    const result = updateReferenceList(env.projectDir);
    expect(result.newRowsAdded).toBe(1);
    // Not asserting missingFiles is empty: the template's own built-in LA01
    // example row (`data/example.csv`) is never actually present on disk in
    // a test fixture, so it always shows up as missing — that's the
    // template's content, not something this operation should suppress.
    expect(result.missingFiles.some((m) => m.includes('dataset.csv'))).toBe(false);

    const content = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md'), 'utf-8');
    expect(content).toMatch(/`data\/dataset\.csv`/);
    env.cleanup();
  });

  it('is idempotent — a second call with no filesystem change adds zero rows', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');
    const first = updateReferenceList(env.projectDir);
    expect(first.newRowsAdded).toBe(1);
    const second = updateReferenceList(env.projectDir);
    expect(second.newRowsAdded).toBe(0);
    env.cleanup();
  });

  it('flags a missing file without deleting its row', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');
    updateReferenceList(env.projectDir);
    fs.removeSync(path.join(dataDir, 'dataset.csv'));

    const result = updateReferenceList(env.projectDir);
    // Template's own LA01 example (`data/example.csv`) is also always
    // missing in a fresh fixture — only assert dataset.csv is among the
    // flagged rows, not the exact total count.
    expect(result.missingFiles.some((m) => m.includes('dataset.csv'))).toBe(true);
    const content = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md'), 'utf-8');
    expect(content).toMatch(/data\/dataset\.csv/); // row itself still present
    env.cleanup();
  });

  it('throws typed INVALID_OPERATION on a malformed Local Artifact table', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    const listPath = path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md');
    fs.ensureDirSync(path.dirname(listPath));
    fs.writeFileSync(listPath, '## Local Artifact\n\nno table here\n');
    expect(() => updateReferenceList(env.projectDir)).toThrow(ReferenceUpdateError);
    try {
      updateReferenceList(env.projectDir);
    } catch (e) {
      expect((e as ReferenceUpdateError).code).toBe('INVALID_OPERATION');
      expect((e as ReferenceUpdateError).message).toMatch(/malformed/);
    }
    env.cleanup();
  });
});

describe('sigma_update_reference — stale state and idempotency (control wrapper)', () => {
  it('rejects a stale expected_state_revision', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const res = (await respondControlWrite(
      opts('k1', 'sha256:not-the-real-revision'),
      (root) => updateReferenceList(root)
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('STALE_STATE');
    env.cleanup();
  });

  it('retrying the same idempotency_key replays the original result, no duplicate row', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');

    const rev = revisionOf(env.projectDir);
    const o = opts('same-key', rev);
    const first = (await respondControlWrite(o, (root) => updateReferenceList(root))) as Payload;
    const firstBody = (first as { structuredContent: Payload }).structuredContent;
    expect(firstBody.newRowsAdded).toBe(1);

    const second = (await respondControlWrite(o, (root) => updateReferenceList(root))) as Payload;
    const secondBody = (second as { structuredContent: Payload }).structuredContent;
    expect(secondBody.newRowsAdded).toBe(1); // replayed original result, not a fresh 0

    const content = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md'), 'utf-8');
    expect(content.match(/data\/dataset\.csv/g)?.length).toBe(1); // never duplicated
    env.cleanup();
  });

  it('a pending record without a recovery journal fails closed', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const o = opts('crashed-key', rev);
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(o.argumentsForHash)).digest('hex');
    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'reference_update', bound_role: 'ARC',
      idempotency_key: 'crashed-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'pending', pid: 999999, result: null, error: null,
      created_at: new Date().toISOString(), committed_at: null,
    });
    const res = (await respondControlWrite(o, (root) => updateReferenceList(root))) as { structuredContent: Payload };
    expect((res.structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    env.cleanup();
  });
});

describe('sigma-control — sigma_update_reference through a real in-process MCP client', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('syncs the reference list end-to-end and returns a structured response', async () => {
    env = setupTestEnv();
    bootstrapProject(env);
    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');
    setControlBinding(env.projectDir, 'AUD');

    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'reference-update-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_update_reference',
      arguments: { idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.newRowsAdded).toBe(1);
    expect(payload.contract_version).toBe('1.0');

    await client.close();
    await server.close();
  });
});

describe('sigma-control sigma_update_reference — cross-process concurrency', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnUpdate(root: string, idempotencyKey: string, expectedStateRevision: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'ARC'],
      env: childEnv,
    });
    const client = new Client({ name: 'reference-update-concurrency', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_update_reference',
      arguments: { idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent processes, same idempotency_key: exactly one row is added, not two', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    const dataDir = path.join(env.projectDir, 'Sigma', 'reference', 'data');
    fs.ensureDirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, 'dataset.csv'), 'a,b,c\n');
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnUpdate(env.projectDir, 'cross-process-key', rev),
      spawnUpdate(env.projectDir, 'cross-process-key', rev),
    ]);
    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.newRowsAdded).toBe(1);
    expect(b.payload.newRowsAdded).toBe(1);

    const content = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'reference', 'reference-list.md'), 'utf-8');
    expect(content.match(/data\/dataset\.csv/g)?.length).toBe(1);
    env.cleanup();
  }, 20000);
});
