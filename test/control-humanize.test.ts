// Stage E W1 batch — sigma_intent_humanize / sigma_exec_humanize /
// sigma_close_humanize. Three separate primitives (ARC/DEV/AUD), not one
// generic tool — see src/services/intentHumanizeService.ts's header for
// why. Each section below covers role boundary, its own type-specific
// precondition, --force semantics, stale-state, and idempotency replay.
// Full cross-process/failpoint coverage is exercised once (intent) as the
// representative proof that respondControlWrite()'s lock/journal machinery
// works for this primitive shape — already proven generically by every
// prior Stage E primitive, so exec/close get a lighter same-key check
// rather than repeating the full failpoint matrix a sixth/seventh time.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { computeStateRevision } from '../src/mcp/contract';
import { readChain } from '../src/engine/chain';
import { humanizeIntent, humanizeIntentTransactionFiles, IntentHumanizeError } from '../src/services/intentHumanizeService';
import { humanizeExec, humanizeExecTransactionFiles } from '../src/services/execHumanizeService';
import { humanizeClose, humanizeCloseTransactionFiles } from '../src/services/closeHumanizeService';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';

import { setupTestEnv, stubProjectIdentity, writeChainFixture, makeChain, makeChainWithLockedIntent, makeChainWithLockedExec, makeChainWithDraftClose, TestEnv } from './helpers';

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

// ── intent_humanize ─────────────────────────────────────────────────────

function bootstrapRatifiedIntent(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
}

function intentOpts(idempotencyKey: string, expectedStateRevision: string, version?: string, force?: boolean) {
  return {
    tool: 'sigma_intent_humanize',
    operationId: 'intent_humanize',
    idempotencyKey,
    argumentsForHash: { version: version ?? null, force: Boolean(force) },
    allowedRoles: ['ARC'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: (root: string) => humanizeIntentTransactionFiles(root, version),
  };
}

describe('sigma_intent_humanize', () => {
  it('rejects a role other than ARC', async () => {
    const env = setupTestEnv();
    bootstrapRatifiedIntent(env);
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(intentOpts('k1', rev), (root) => humanizeIntent({ projectRoot: root }))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    env.cleanup();
  });

  it('rejects a DRAFT intent — typed INVALID_OPERATION', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChain('v1'));
    expect(() => humanizeIntent({ projectRoot: env.projectDir })).toThrow(IntentHumanizeError);
    try {
      humanizeIntent({ projectRoot: env.projectDir });
    } catch (e) {
      expect((e as IntentHumanizeError).code).toBe('INVALID_OPERATION');
      expect((e as IntentHumanizeError).message).toMatch(/humanize requires RATIFIED/);
    }
    env.cleanup();
  });

  it('refuses to overwrite an existing projection without force, succeeds with force:true', () => {
    const env = setupTestEnv();
    bootstrapRatifiedIntent(env);
    humanizeIntent({ projectRoot: env.projectDir });
    expect(() => humanizeIntent({ projectRoot: env.projectDir })).toThrow(/already exists/);
    const result = humanizeIntent({ projectRoot: env.projectDir, force: true });
    expect(result.version).toBe('v1');
    env.cleanup();
  });

  it('rejects a stale expected_state_revision', async () => {
    const env = setupTestEnv();
    bootstrapRatifiedIntent(env);
    setControlBinding(env.projectDir, 'ARC');
    const res = (await respondControlWrite(
      intentOpts('k1', 'sha256:not-the-real-revision'),
      (root) => humanizeIntent({ projectRoot: root })
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('STALE_STATE');
    env.cleanup();
  });

  it('retrying the same idempotency_key replays the original result', async () => {
    const env = setupTestEnv();
    bootstrapRatifiedIntent(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const opts = intentOpts('same-key', rev);
    const first = (await respondControlWrite(opts, (root) => humanizeIntent({ projectRoot: root }))) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    const second = (await respondControlWrite(opts, (root) => humanizeIntent({ projectRoot: root }))) as Payload;
    expect(((second as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    const chain = readChain(env.projectDir, 'v1');
    expect(chain.intent.human).toBeTruthy();
    env.cleanup();
  });

  it('creates the human projection and fidelity ledger end-to-end through a real MCP client', async () => {
    const env = setupTestEnv();
    bootstrapRatifiedIntent(env);
    setControlBinding(env.projectDir, 'ARC');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'intent-humanize-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_intent_humanize',
      arguments: { idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.version).toBe('v1');
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'human', 'DIR-INTENT-HUMAN-v1.md'))).toBe(true);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'human', 'DIR-INTENT-HUMAN-v1.fidelity.md'))).toBe(true);
    await client.close();
    await server.close();
  });
});

describe('sigma_intent_humanize — cross-process concurrency and process-death recovery', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnHumanize(root: string, idempotencyKey: string, expectedStateRevision: string, failpoint?: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    if (failpoint) childEnv.SIGMA_CONTROL_TEST_FAILPOINT = failpoint;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', 'ARC'],
      env: childEnv,
    });
    const client = new Client({ name: 'intent-humanize-concurrency', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_intent_humanize',
      arguments: { idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent processes, same idempotency_key: exactly one projection is created', async () => {
    const env = setupTestEnv();
    bootstrapRatifiedIntent(env);
    const rev = computeStateRevision(env.projectDir).revision!;
    const [a, b] = await Promise.all([
      spawnHumanize(env.projectDir, 'cross-process-key', rev),
      spawnHumanize(env.projectDir, 'cross-process-key', rev),
    ]);
    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.version).toBe('v1');
    expect(b.payload.version).toBe('v1');
    env.cleanup();
  }, 20000);

  it.each([
    'after_journal_prepared',
    'after_idempotency_pending',
    'intent_humanize_after_template',
    'intent_humanize_after_ledger',
    'intent_humanize_after_chain',
    'after_mutation_before_commit_marker',
    'after_commit_marker',
    'after_commit_idempotency',
    'after_commit_audit',
  ])(
    'recovers intent-humanize deterministically after real process death at %s',
    async (failpoint) => {
      const env = setupTestEnv();
      bootstrapRatifiedIntent(env);
      const rev = computeStateRevision(env.projectDir).revision!;
      const key = `kill-${failpoint}`;
      await expect(spawnHumanize(env.projectDir, key, rev, failpoint)).rejects.toThrow();
      const recovered = await spawnHumanize(env.projectDir, key, rev);
      expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
      expect(recovered.payload.version).toBe('v1');
      env.cleanup();
    },
    20000
  );
});

// ── exec_humanize ───────────────────────────────────────────────────────

function bootstrapLockedExec(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
}

function execOpts(idempotencyKey: string, expectedStateRevision: string, version?: string) {
  return {
    tool: 'sigma_exec_humanize',
    operationId: 'exec_humanize',
    idempotencyKey,
    argumentsForHash: { version: version ?? null, force: false },
    allowedRoles: ['DEV'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: (root: string) => humanizeExecTransactionFiles(root, version),
  };
}

describe('sigma_exec_humanize', () => {
  it('rejects a role other than DEV', async () => {
    const env = setupTestEnv();
    bootstrapLockedExec(env);
    setControlBinding(env.projectDir, 'ARC');
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(execOpts('k1', rev), (root) => humanizeExec({ projectRoot: root }))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    env.cleanup();
  });

  it('rejects a DRAFT exec', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1')); // intent RATIFIED, no exec at all
    expect(() => humanizeExec({ projectRoot: env.projectDir })).toThrow(/No active DEV-EXEC found/);
    env.cleanup();
  });

  it('rejects when the referenced plan is not LOCKED', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    const now = new Date().toISOString();
    const chain = makeChainWithLockedExec('v1', 'v1.1') as Record<string, unknown>;
    (chain.plan as { versions: Array<Record<string, unknown>> }).versions[0].state = 'DRAFT';
    (chain.plan as Record<string, unknown>).active_state = 'DRAFT';
    writeChainFixture(env, 'v1', chain);
    expect(() => humanizeExec({ projectRoot: env.projectDir })).toThrow(/not LOCKED/);
    env.cleanup();
  });

  it('refuses to overwrite without force, succeeds with force:true', () => {
    const env = setupTestEnv();
    bootstrapLockedExec(env);
    humanizeExec({ projectRoot: env.projectDir });
    expect(() => humanizeExec({ projectRoot: env.projectDir })).toThrow(/already exists/);
    const result = humanizeExec({ projectRoot: env.projectDir, force: true });
    expect(result.version).toBe('v1.1');
    env.cleanup();
  });

  it('rejects a stale expected_state_revision', async () => {
    const env = setupTestEnv();
    bootstrapLockedExec(env);
    setControlBinding(env.projectDir, 'DEV');
    const res = (await respondControlWrite(
      execOpts('k1', 'sha256:not-the-real-revision'),
      (root) => humanizeExec({ projectRoot: root })
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('STALE_STATE');
    env.cleanup();
  });

  it('retrying the same idempotency_key replays the original result', async () => {
    const env = setupTestEnv();
    bootstrapLockedExec(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const opts = execOpts('same-key', rev);
    const first = (await respondControlWrite(opts, (root) => humanizeExec({ projectRoot: root }))) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).planVersionRef).toBe('v1.1');
    const second = (await respondControlWrite(opts, (root) => humanizeExec({ projectRoot: root }))) as Payload;
    expect(((second as { structuredContent: Payload }).structuredContent).version).toBe('v1.1');
    env.cleanup();
  });

  it('creates the human projection end-to-end through a real MCP client', async () => {
    const env = setupTestEnv();
    bootstrapLockedExec(env);
    setControlBinding(env.projectDir, 'DEV');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'exec-humanize-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_exec_humanize',
      arguments: { idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.version).toBe('v1.1');
    expect(payload.planVersionRef).toBe('v1.1');
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'human', 'PLAN-EXEC-HUMAN-v1.1.md'))).toBe(true);
    await client.close();
    await server.close();
  });
});

describe('sigma_exec_humanize — cross-process, same idempotency_key', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  it('two independent processes, same idempotency_key: exactly one projection is created', async () => {
    const env = setupTestEnv();
    bootstrapLockedExec(env);
    const rev = computeStateRevision(env.projectDir).revision!;

    async function spawn() {
      const childEnv = Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      );
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [CONTROL_BIN, '--project-root', env.projectDir, '--project-id', 'TEST', '--role', 'DEV'],
        env: childEnv,
      });
      const client = new Client({ name: 'exec-humanize-concurrency', version: '0.0.0' });
      await client.connect(transport);
      const res = await client.callTool({
        name: 'sigma_exec_humanize',
        arguments: { idempotency_key: 'cross-process-key', expected_state_revision: rev },
      });
      await client.close();
      const text = (res.content as Array<{ type: string; text: string }>)[0].text;
      return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
    }

    const [a, b] = await Promise.all([spawn(), spawn()]);
    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.version).toBe('v1.1');
    expect(b.payload.version).toBe('v1.1');
    env.cleanup();
  }, 20000);
});

// ── close_humanize ──────────────────────────────────────────────────────

function bootstrapLockedClose(env: TestEnv, id = 'TEST'): void {
  stubProjectIdentity(env, id);
  const now = new Date().toISOString();
  const chain = makeChainWithDraftClose('v1') as Record<string, unknown>;
  chain.close = { version: 'v1', state: 'LOCKED', file: 'Sigma/close/DIR-CLOSE-v1.md', created_at: now, updated_at: now, locked_at: now };
  writeChainFixture(env, 'v1', chain);
}

function closeOpts(idempotencyKey: string, expectedStateRevision: string) {
  return {
    tool: 'sigma_close_humanize',
    operationId: 'close_humanize',
    idempotencyKey,
    argumentsForHash: { force: false },
    allowedRoles: ['AUD'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: humanizeCloseTransactionFiles,
  };
}

describe('sigma_close_humanize', () => {
  it('rejects a role other than AUD', async () => {
    const env = setupTestEnv();
    bootstrapLockedClose(env);
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(closeOpts('k1', rev), (root) => humanizeClose({ projectRoot: root }))) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    env.cleanup();
  });

  it('rejects when no DIR-CLOSE exists at all', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1')); // no close
    expect(() => humanizeClose({ projectRoot: env.projectDir })).toThrow(/No active DIR-CLOSE found/);
    env.cleanup();
  });

  it('rejects a DRAFT close (not LOCKED)', () => {
    const env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftClose('v1'));
    expect(() => humanizeClose({ projectRoot: env.projectDir })).toThrow(/humanize requires LOCKED/);
    env.cleanup();
  });

  it('refuses to overwrite without force, succeeds with force:true', () => {
    const env = setupTestEnv();
    bootstrapLockedClose(env);
    humanizeClose({ projectRoot: env.projectDir });
    expect(() => humanizeClose({ projectRoot: env.projectDir })).toThrow(/already exists/);
    const result = humanizeClose({ projectRoot: env.projectDir, force: true });
    expect(result.version).toBe('v1');
    env.cleanup();
  });

  it('rejects a stale expected_state_revision', async () => {
    const env = setupTestEnv();
    bootstrapLockedClose(env);
    setControlBinding(env.projectDir, 'AUD');
    const res = (await respondControlWrite(
      closeOpts('k1', 'sha256:not-the-real-revision'),
      (root) => humanizeClose({ projectRoot: root })
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('STALE_STATE');
    env.cleanup();
  });

  it('retrying the same idempotency_key replays the original result', async () => {
    const env = setupTestEnv();
    bootstrapLockedClose(env);
    setControlBinding(env.projectDir, 'AUD');
    const rev = revisionOf(env.projectDir);
    const opts = closeOpts('same-key', rev);
    const first = (await respondControlWrite(opts, (root) => humanizeClose({ projectRoot: root }))) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    const second = (await respondControlWrite(opts, (root) => humanizeClose({ projectRoot: root }))) as Payload;
    expect(((second as { structuredContent: Payload }).structuredContent).version).toBe('v1');
    env.cleanup();
  });

  it('creates the human projection end-to-end through a real MCP client', async () => {
    const env = setupTestEnv();
    bootstrapLockedClose(env);
    setControlBinding(env.projectDir, 'AUD');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'close-humanize-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_close_humanize',
      arguments: { idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.version).toBe('v1');
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'human', 'DIR-CLOSE-HUMAN-v1.md'))).toBe(true);
    await client.close();
    await server.close();
  });
});

describe('sigma_close_humanize — cross-process, same idempotency_key', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  it('two independent processes, same idempotency_key: exactly one projection is created', async () => {
    const env = setupTestEnv();
    bootstrapLockedClose(env);
    const rev = computeStateRevision(env.projectDir).revision!;

    async function spawn() {
      const childEnv = Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      );
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [CONTROL_BIN, '--project-root', env.projectDir, '--project-id', 'TEST', '--role', 'AUD'],
        env: childEnv,
      });
      const client = new Client({ name: 'close-humanize-concurrency', version: '0.0.0' });
      await client.connect(transport);
      const res = await client.callTool({
        name: 'sigma_close_humanize',
        arguments: { idempotency_key: 'cross-process-key', expected_state_revision: rev },
      });
      await client.close();
      const text = (res.content as Array<{ type: string; text: string }>)[0].text;
      return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
    }

    const [a, b] = await Promise.all([spawn(), spawn()]);
    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.version).toBe('v1');
    expect(b.payload.version).toBe('v1');
    env.cleanup();
  }, 20000);
});
