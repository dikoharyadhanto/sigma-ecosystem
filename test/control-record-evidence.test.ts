// Stage E W1 batch — sigma_record_evidence. No CLI equivalent (unlike every
// other Stage E primitive so far except update_artifact_draft) — see
// src/mcp/control/recordEvidence.ts's header. This file exercises the same
// contract categories test/control-plan-draft.test.ts established (role/gate
// boundary, stale-state, idempotency, crash-window, transport-level,
// cross-process concurrency, process-death recovery), plus what is unique
// to this primitive: ref_path is the one MCP-facing path not derived from
// chain.ts tracker state, so it gets its own containment/size/existence
// coverage, and the evidence array on chain.exec.versions[] accumulates
// rather than being overwritten (same shape of proof as plan_draft's
// array-of-versions section, one level down).

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
import { computeStateRevision } from '../src/mcp/contract';
import { readChain } from '../src/engine/chain';
import { recordEvidence, recordEvidenceTransactionFiles, MAX_EVIDENCE_REF_BYTES } from '../src/mcp/control/recordEvidence';
import { McpQueryError } from '../src/mcp/errors';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';
import { readIdempotencyRecord, writeIdempotencyRecord, AUDIT_FILE_REL } from '../src/engine/controlStore';

import { setupTestEnv, stubProjectIdentity, writeChainFixture, makeChainWithLockedExec, TestEnv } from './helpers';

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

function bootstrapExecReady(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
}

function writeRefFile(env: TestEnv, relPath: string, content = 'test evidence content'): string {
  const abs = path.join(env.projectDir, relPath);
  fs.ensureDirSync(path.dirname(abs));
  fs.writeFileSync(abs, content);
  return abs;
}

function expectedHash(content: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(Buffer.from(content)).digest('hex');
}

function evidenceOpts(idempotencyKey: string, expectedStateRevision: string, description = 'Test run', refPath = 'evidence-output/report.txt') {
  return {
    tool: 'sigma_record_evidence',
    operationId: 'record_evidence',
    idempotencyKey,
    argumentsForHash: { exec_version: null, description, ref_path: refPath },
    allowedRoles: ['DEV'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: recordEvidenceTransactionFiles,
  };
}

function callRecord(root: string, description = 'Test run', refPath = 'evidence-output/report.txt', execVersion?: string, actorRole = 'DEV') {
  return recordEvidence({ projectRoot: root, execVersion, description, refPath, actorRole });
}

describe('sigma_record_evidence — direct service contract', () => {
  it('records evidence against the active DEV-EXEC, with a server-computed hash', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'hello evidence');

    const result = callRecord(env.projectDir, 'Build passed', 'evidence-output/report.txt');
    expect(result.execVersion).toBe('v1.1');
    expect(result.record.description).toBe('Build passed');
    expect(result.record.ref_path).toBe('evidence-output/report.txt');
    expect(result.record.ref_sha256).toBe(expectedHash('hello evidence'));
    expect(result.record.recorded_by).toBe('DEV');

    const chain = readChain(env.projectDir, 'v1');
    expect(chain.exec.versions[0].evidence).toHaveLength(1);
    expect(chain.exec.versions[0].evidence?.[0]).toEqual(result.record);
    env.cleanup();
  });

  it('a second call accumulates a second entry — does not overwrite the first', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/a.txt', 'A');
    writeRefFile(env, 'evidence-output/b.txt', 'B');

    callRecord(env.projectDir, 'First', 'evidence-output/a.txt');
    callRecord(env.projectDir, 'Second', 'evidence-output/b.txt');

    const chain = readChain(env.projectDir, 'v1');
    const entries = chain.exec.versions[0].evidence ?? [];
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.description)).toEqual(['First', 'Second']);
    env.cleanup();
  });

  it('targets an explicit exec_version instead of the active one', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');

    const result = callRecord(env.projectDir, 'Targeted', 'evidence-output/report.txt', 'v1.1');
    expect(result.execVersion).toBe('v1.1');
    env.cleanup();
  });

  it('rejects an unknown exec_version — typed INVALID_OPERATION', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    expect(() => callRecord(env.projectDir, 'x', 'evidence-output/report.txt', 'v9.9')).toThrow(/not found/);
    try {
      callRecord(env.projectDir, 'x', 'evidence-output/report.txt', 'v9.9');
    } catch (e) {
      expect((e as McpQueryError).code).toBe('INVALID_OPERATION');
    }
    env.cleanup();
  });

  it('rejects when there is no active DEV-EXEC and no version given', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', {
      schema_version: '1.2.0', chain_version: 'v1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      lifecycle_state: 'DESIGN',
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });
    expect(() => callRecord(env.projectDir)).toThrow(/No active DEV-EXEC/);
    env.cleanup();
  });

  it('rejects an empty description', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    expect(() => callRecord(env.projectDir, '   ', 'evidence-output/report.txt')).toThrow(/description is required/);
    env.cleanup();
  });

  it('rejects an absolute ref_path', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    const abs = writeRefFile(env, 'evidence-output/report.txt', 'x');
    expect(() => callRecord(env.projectDir, 'x', abs)).toThrow(/relative path/);
    env.cleanup();
  });

  it('rejects a ref_path that escapes the project root via traversal — BOUNDARY_VIOLATION', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    // A real file that exists one level above the project root.
    const outside = path.join(env.projectDir, '..', 'outside-secret.txt');
    fs.writeFileSync(outside, 'secret');
    try {
      expect(() => callRecord(env.projectDir, 'x', '../outside-secret.txt')).toThrow(/escapes the project root/);
      try {
        callRecord(env.projectDir, 'x', '../outside-secret.txt');
      } catch (e) {
        expect((e as McpQueryError).code).toBe('BOUNDARY_VIOLATION');
      }
    } finally {
      fs.removeSync(outside);
    }
    env.cleanup();
  });

  it('rejects a ref_path that escapes the project root through a directory junction — BOUNDARY_VIOLATION (realpath resolves reparse points, not just literal "..")', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-escape-'));
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret');
    const junctionPath = path.join(env.projectDir, 'evidence-output', 'escape-junction');
    fs.ensureDirSync(path.dirname(junctionPath));
    fs.symlinkSync(outsideDir, junctionPath, 'junction');
    try {
      try {
        callRecord(env.projectDir, 'x', 'evidence-output/escape-junction/secret.txt');
        throw new Error('expected callRecord to throw');
      } catch (e) {
        expect((e as McpQueryError).code).toBe('BOUNDARY_VIOLATION');
      }
    } finally {
      fs.removeSync(junctionPath);
      fs.removeSync(outsideDir);
    }
    env.cleanup();
  });

  it('rejects a ref_path that does not exist', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    expect(() => callRecord(env.projectDir, 'x', 'evidence-output/does-not-exist.txt')).toThrow(/does not exist/);
    env.cleanup();
  });

  it('rejects a ref_path pointing at a directory — BOUNDARY_VIOLATION', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    fs.ensureDirSync(path.join(env.projectDir, 'evidence-output', 'a-directory'));
    try {
      callRecord(env.projectDir, 'x', 'evidence-output/a-directory');
      throw new Error('expected callRecord to throw');
    } catch (e) {
      expect((e as McpQueryError).code).toBe('BOUNDARY_VIOLATION');
    }
    env.cleanup();
  });

  it('rejects a ref_path file larger than MAX_EVIDENCE_REF_BYTES — PAYLOAD_TOO_LARGE', () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    const abs = path.join(env.projectDir, 'evidence-output', 'huge.bin');
    fs.ensureDirSync(path.dirname(abs));
    fs.writeFileSync(abs, Buffer.alloc(MAX_EVIDENCE_REF_BYTES + 1));
    try {
      callRecord(env.projectDir, 'x', 'evidence-output/huge.bin');
      throw new Error('expected callRecord to throw');
    } catch (e) {
      expect((e as McpQueryError).code).toBe('PAYLOAD_TOO_LARGE');
    }
    env.cleanup();
  }, 20000);
});

describe('sigma_record_evidence — role and gate boundary (through respondControlWrite)', () => {
  it('rejects a call with no bound role', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, null);
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(evidenceOpts('k1', rev), (root, role) => callRecord(root, 'x', 'evidence-output/report.txt', undefined, role))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence ?? []).toEqual([]);
    env.cleanup();
  });

  it('rejects a role other than DEV (e.g. FMN, which owns plan_draft)', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);

    const res = (await respondControlWrite(evidenceOpts('k1', rev), (root, role) => callRecord(root, 'x', 'evidence-output/report.txt', undefined, role))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence ?? []).toEqual([]);
    env.cleanup();
  });

  it('rejects a stale expected_state_revision — typed STALE_STATE, no write', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, 'DEV');

    const res = (await respondControlWrite(evidenceOpts('k1', 'sha256:stale'), (root, role) => callRecord(root, 'x', 'evidence-output/report.txt', undefined, role))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence ?? []).toEqual([]);
    env.cleanup();
  });
});

describe('sigma_record_evidence — audit trail', () => {
  it('the audit record for a successful commit carries artifact_hash_after — a top-level sha256 for sha256Of() to read structurally', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'hello evidence');
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);

    await respondControlWrite(evidenceOpts('audit-key', rev), (root, role) => callRecord(root, 'Test run', 'evidence-output/report.txt', undefined, role));

    const auditPath = path.join(env.projectDir, AUDIT_FILE_REL);
    const lines = fs.readFileSync(auditPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const last = JSON.parse(lines[lines.length - 1]) as { artifact_hash_after: string | null; outcome: string };
    expect(last.outcome).toBe('commit');
    expect(last.artifact_hash_after).toBe(expectedHash('hello evidence'));
    env.cleanup();
  });
});

describe('sigma_record_evidence — idempotency', () => {
  it('a retry with the same key and same arguments replays the original result — exactly one entry, not two', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts = evidenceOpts('same-key', rev);
    const mutate = (root: string, role: string) => callRecord(root, 'Test run', 'evidence-output/report.txt', undefined, role);

    const first = (await respondControlWrite(opts, mutate)) as { structuredContent: Payload };
    const second = (await respondControlWrite(opts, mutate)) as { structuredContent: Payload };
    expect(second.structuredContent.record).toEqual(first.structuredContent.record);
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence).toHaveLength(1);
    env.cleanup();
  });

  it('same key with different arguments is rejected — IDEMPOTENCY_CONFLICT, no write', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts1 = evidenceOpts('conflict-key', rev, 'First description');
    const mutate1 = (root: string, role: string) => callRecord(root, 'First description', 'evidence-output/report.txt', undefined, role);
    await respondControlWrite(opts1, mutate1);

    const opts2 = evidenceOpts('conflict-key', rev, 'Different description');
    const mutate2 = (root: string, role: string) => callRecord(root, 'Different description', 'evidence-output/report.txt', undefined, role);
    const res = (await respondControlWrite(opts2, mutate2)) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence).toHaveLength(1);
    env.cleanup();
  });

  it('two concurrent same-process calls with the same key produce exactly one entry', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts = evidenceOpts('race-key', rev);
    const mutate = (root: string, role: string) => callRecord(root, 'Test run', 'evidence-output/report.txt', undefined, role);

    const [a, b] = await Promise.all([
      respondControlWrite(opts, mutate) as Promise<Payload>,
      respondControlWrite(opts, mutate) as Promise<Payload>,
    ]);
    const aBody = (a as { structuredContent: Payload }).structuredContent;
    const bBody = (b as { structuredContent: Payload }).structuredContent;
    expect(aBody.record).toEqual(bBody.record);
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence).toHaveLength(1);
    env.cleanup();
  });
});

describe('sigma_record_evidence — crash-window safety', () => {
  it('a synchronous rejection inside mutate() is retained as a "failed" record — an immediate retry with the SAME key is still not blocked', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);

    const rejecting = () =>
      respondControlWrite(
        {
          tool: 'sigma_record_evidence', operationId: 'record_evidence', idempotencyKey: 'reject-then-retry',
          argumentsForHash: { x: 1 }, allowedRoles: ['DEV'], checkPreconditions: staleStateCheck(rev),
          transactionFiles: recordEvidenceTransactionFiles,
        },
        () => { throw new Error('simulated business-rule rejection'); }
      ) as Promise<Payload>;

    const first = (await rejecting()) as { structuredContent: Payload };
    expect((first.structuredContent.error as Payload).code).toBe('INTERNAL_ERROR');

    const failedRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'record_evidence', 'DEV', 'reject-then-retry');
    expect(failedRecord?.status).toBe('failed');

    const second = (await respondControlWrite(
      {
        tool: 'sigma_record_evidence', operationId: 'record_evidence', idempotencyKey: 'reject-then-retry',
        argumentsForHash: { x: 1 }, allowedRoles: ['DEV'], checkPreconditions: staleStateCheck(rev),
        transactionFiles: recordEvidenceTransactionFiles,
      },
      (root, role) => callRecord(root, 'Test run', 'evidence-output/report.txt', undefined, role)
    )) as { structuredContent: Payload };
    expect(second.structuredContent.execVersion).toBe('v1.1');

    const finalRecord = readIdempotencyRecord(env.projectDir, 'TEST', 'record_evidence', 'DEV', 'reject-then-retry');
    expect(finalRecord?.status).toBe('completed');
    env.cleanup();
  });

  it('a pending record without a recovery journal fails closed instead of guessing that retry is safe', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts = evidenceOpts('crashed-key', rev);
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(opts.argumentsForHash)).digest('hex');

    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'record_evidence', bound_role: 'DEV',
      idempotency_key: 'crashed-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'pending', pid: 999999, result: null, error: null,
      created_at: new Date().toISOString(),
      committed_at: null,
    });

    const res = (await respondControlWrite(opts, (root, role) => callRecord(root, 'Test run', 'evidence-output/report.txt', undefined, role))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence ?? []).toEqual([]);
    env.cleanup();
  });
});

describe('sigma-control — sigma_record_evidence through a real in-process MCP client', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('records evidence end-to-end and returns a structured, versioned response', async () => {
    env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'hello evidence');
    setControlBinding(env.projectDir, 'DEV');

    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-control-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_record_evidence',
      arguments: { description: 'Build passed', ref_path: 'evidence-output/report.txt', idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.execVersion).toBe('v1.1');
    expect(payload.contract_version).toBe('1.0');
    expect(res.structuredContent).toEqual(payload);

    const chain = readChain(env.projectDir, 'v1');
    expect(chain.exec.versions[0].evidence).toHaveLength(1);
    expect(chain.exec.versions[0].evidence?.[0].ref_sha256).toBe(expectedHash('hello evidence'));

    await client.close();
    await server.close();
  });
});

describe('sigma_record_evidence — cross-process concurrency and process-death recovery', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnRecord(root: string, idempotencyKey: string, expectedStateRevision: string, failpoint?: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    if (failpoint) childEnv.SIGMA_CONTROL_TEST_FAILPOINT = failpoint;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'DEV'],
      env: childEnv,
    });
    const client = new Client({ name: 'evidence-concurrency-test', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_record_evidence',
      arguments: { description: 'Race', ref_path: 'evidence-output/report.txt', idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent sigma-control processes, same idempotency_key: exactly one evidence entry is recorded', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnRecord(env.projectDir, 'cross-process-key', rev),
      spawnRecord(env.projectDir, 'cross-process-key', rev),
    ]);

    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence).toHaveLength(1);

    env.cleanup();
  }, 20000);

  it('two independent processes, different idempotency_key racing on the same expected_state_revision: exactly one wins, the loser sees STALE_STATE', async () => {
    const env = setupTestEnv();
    bootstrapExecReady(env);
    writeRefFile(env, 'evidence-output/report.txt', 'x');
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnRecord(env.projectDir, 'key-a', rev),
      spawnRecord(env.projectDir, 'key-b', rev),
    ]);

    const results = [a, b];
    const succeeded = results.filter((r) => r.isError !== true);
    const failed = results.filter((r) => r.isError === true);
    expect(succeeded.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect(failed.length, JSON.stringify({ a: a.payload, b: b.payload })).toBe(1);
    expect((failed[0].payload.error as Payload).code).toBe('STALE_STATE');
    expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence).toHaveLength(1);

    env.cleanup();
  }, 20000);

  it.each([
    'after_journal_prepared',
    'after_idempotency_pending',
    'record_evidence_after_read',
    'record_evidence_after_chain',
    'after_mutation_before_commit_marker',
    'after_commit_marker',
    'after_commit_idempotency',
    'after_commit_audit',
  ])(
    'recovers record-evidence deterministically after real process death at %s',
    async (failpoint) => {
      const env = setupTestEnv();
      bootstrapExecReady(env);
      writeRefFile(env, 'evidence-output/report.txt', 'x');
      const rev = computeStateRevision(env.projectDir).revision!;
      const key = `kill-${failpoint}`;

      await expect(spawnRecord(env.projectDir, key, rev, failpoint)).rejects.toThrow();
      const recovered = await spawnRecord(env.projectDir, key, rev);
      expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
      expect(readChain(env.projectDir, 'v1').exec.versions[0].evidence).toHaveLength(1);

      env.cleanup();
    },
    20000
  );
});
