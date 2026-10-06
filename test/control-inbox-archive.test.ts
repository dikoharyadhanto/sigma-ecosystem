// Stage E W1 batch — sigma_inbox_archive. Unlike every other Stage E
// primitive, this one is NOT a straight CLI port: it adds a new ownership
// check (bound role may only archive a message addressed to itself) that
// the CLI `sigma inbox archive <id>` command does not have and was never
// asked to gain. Reconciled with the CLI/MCP shared-service invariant
// (Codex finding H-02, 2026-09-16) via `actorRole: string | null` in
// src/services/inboxArchiveService.ts — null (CLI) skips the ownership
// check, a role string (MCP) enforces it. Never touches
// progress-v<N>.json; only Sigma/messages/index.json.

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
import { archiveMessage, archiveMessageTransactionFiles } from '../src/services/inboxArchiveService';
import { respondControlWrite, staleStateCheck } from '../src/mcp/control/shared';
import { buildControlServer } from '../src/mcp/control/index';
import { writeIdempotencyRecord } from '../src/engine/controlStore';
import { MESSAGES_INDEX_FILE } from '../src/config';
import type { MessageEntry } from '../src/engine/mailbox';

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

function seedMessage(env: TestEnv, entry: Partial<MessageEntry> & { id: string; from: string; to: string }): void {
  const indexPath = path.join(env.projectDir, MESSAGES_INDEX_FILE);
  fs.ensureDirSync(path.dirname(indexPath));
  const index = fs.existsSync(indexPath) ? fs.readJsonSync(indexPath) : { messages: [] };
  const now = new Date().toISOString();
  index.messages.push({
    type: 'NOTE',
    subject: 'Test message',
    file: `Sigma/messages/${entry.to}/${entry.id}.md`,
    status: 'UNREAD',
    created_at: now,
    attachments: [],
    ...entry,
  });
  fs.writeJsonSync(indexPath, index, { spaces: 2 });
}

function readIndexRaw(env: TestEnv): { messages: MessageEntry[] } {
  return fs.readJsonSync(path.join(env.projectDir, MESSAGES_INDEX_FILE));
}

function opts(idempotencyKey: string, expectedStateRevision: string, messageId: string) {
  return {
    tool: 'sigma_inbox_archive',
    operationId: 'inbox_archive',
    idempotencyKey,
    argumentsForHash: { message_id: messageId },
    allowedRoles: ['ARC', 'FMN', 'DEV', 'AUD'],
    checkPreconditions: staleStateCheck(expectedStateRevision),
    transactionFiles: archiveMessageTransactionFiles,
  };
}

describe('sigma_inbox_archive — direct service contract', () => {
  it('archives a message addressed to the calling role', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    const result = archiveMessage({ projectRoot: env.projectDir, actorRole: 'FMN', messageId: 'MSG-1' });
    expect(result.status).toBe('ARCHIVED');
    expect(readIndexRaw(env).messages[0].status).toBe('ARCHIVED');
    env.cleanup();
  });

  it('rejects archiving a message addressed to a different role — ROLE_NOT_AUTHORIZED, index untouched', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    expect(() => archiveMessage({ projectRoot: env.projectDir, actorRole: 'DEV', messageId: 'MSG-1' })).toThrow();
    try {
      archiveMessage({ projectRoot: env.projectDir, actorRole: 'DEV', messageId: 'MSG-1' });
    } catch (e) {
      expect((e as { code?: string }).code).toBe('ROLE_NOT_AUTHORIZED');
    }
    expect(readIndexRaw(env).messages[0].status).toBe('UNREAD'); // untouched
    env.cleanup();
  });

  it('actorRole: null (trusted CLI caller) archives regardless of message owner — no ownership check', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    const result = archiveMessage({ projectRoot: env.projectDir, actorRole: null, messageId: 'MSG-1' });
    expect(result.status).toBe('ARCHIVED');
    expect(readIndexRaw(env).messages[0].status).toBe('ARCHIVED');
    env.cleanup();
  });

  it('rejects an unknown message id — INVALID_OPERATION', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    expect(() => archiveMessage({ projectRoot: env.projectDir, actorRole: 'ARC', messageId: 'MSG-DOES-NOT-EXIST' })).toThrow(/not found/);
    try {
      archiveMessage({ projectRoot: env.projectDir, actorRole: 'ARC', messageId: 'MSG-DOES-NOT-EXIST' });
    } catch (e) {
      expect((e as { code?: string }).code).toBe('INVALID_OPERATION');
    }
    env.cleanup();
  });

  it('the message .md file itself is never touched — only index.json', () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN', file: 'Sigma/messages/FMN/MSG-1.md' });
    const msgFilePath = path.join(env.projectDir, 'Sigma', 'messages', 'FMN', 'MSG-1.md');
    fs.ensureDirSync(path.dirname(msgFilePath));
    fs.writeFileSync(msgFilePath, '# original content');
    archiveMessage({ projectRoot: env.projectDir, actorRole: 'FMN', messageId: 'MSG-1' });
    expect(fs.readFileSync(msgFilePath, 'utf-8')).toBe('# original content');
    env.cleanup();
  });
});

describe('sigma_inbox_archive — role boundary through the control wrapper', () => {
  it('rejects a call with no bound role', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    setControlBinding(env.projectDir, null);
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(
      opts('k1', rev, 'MSG-1'),
      (root, role) => archiveMessage({ projectRoot: root, actorRole: role, messageId: 'MSG-1' })
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    env.cleanup();
  });

  it.each(['ARC', 'FMN', 'DEV', 'AUD'])('role %s can archive its own message via the control wrapper', async (role) => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: `MSG-${role}`, from: 'ARC', to: role });
    setControlBinding(env.projectDir, role);
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(
      opts(`k-${role}`, rev, `MSG-${role}`),
      (root, r) => archiveMessage({ projectRoot: root, actorRole: r, messageId: `MSG-${role}` })
    )) as Payload;
    const body = (res as { structuredContent: Payload }).structuredContent;
    expect(body.error).toBeUndefined();
    expect(body.status).toBe('ARCHIVED');
    env.cleanup();
  });

  it('a bound role is rejected when the message belongs to a different role, via the control wrapper', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    setControlBinding(env.projectDir, 'DEV');
    const rev = revisionOf(env.projectDir);
    const res = (await respondControlWrite(
      opts('k1', rev, 'MSG-1'),
      (root, role) => archiveMessage({ projectRoot: root, actorRole: role, messageId: 'MSG-1' })
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('ROLE_NOT_AUTHORIZED');
    expect(readIndexRaw(env).messages[0].status).toBe('UNREAD');
    env.cleanup();
  });
});

describe('sigma_inbox_archive — stale state and idempotency', () => {
  it('rejects a stale expected_state_revision', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    setControlBinding(env.projectDir, 'FMN');
    const res = (await respondControlWrite(
      opts('k1', 'sha256:not-the-real-revision', 'MSG-1'),
      (root, role) => archiveMessage({ projectRoot: root, actorRole: role, messageId: 'MSG-1' })
    )) as Payload;
    expect(((res as { structuredContent: Payload }).structuredContent.error as Payload).code).toBe('STALE_STATE');
    env.cleanup();
  });

  it('retrying the same idempotency_key replays the original result', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const o = opts('same-key', rev, 'MSG-1');
    const mutate = (root: string, role: string) => archiveMessage({ projectRoot: root, actorRole: role, messageId: 'MSG-1' });
    const first = (await respondControlWrite(o, mutate)) as Payload;
    expect(((first as { structuredContent: Payload }).structuredContent).status).toBe('ARCHIVED');
    const second = (await respondControlWrite(o, mutate)) as Payload;
    expect(((second as { structuredContent: Payload }).structuredContent).status).toBe('ARCHIVED');
    env.cleanup();
  });

  it('a pending record without a recovery journal fails closed', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    setControlBinding(env.projectDir, 'FMN');
    const rev = revisionOf(env.projectDir);
    const o = opts('crashed-key', rev, 'MSG-1');
    const argumentsHash = crypto.createHash('sha256').update(JSON.stringify(o.argumentsForHash)).digest('hex');
    writeIdempotencyRecord(env.projectDir, {
      project_id: 'TEST', operation_id: 'inbox_archive', bound_role: 'FMN',
      idempotency_key: 'crashed-key', arguments_hash: 'sha256:' + argumentsHash,
      status: 'pending', pid: 999999, result: null, error: null,
      created_at: new Date().toISOString(), committed_at: null,
    });
    const res = (await respondControlWrite(
      o,
      (root, role) => archiveMessage({ projectRoot: root, actorRole: role, messageId: 'MSG-1' })
    )) as { structuredContent: Payload };
    expect((res.structuredContent.error as Payload).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(readIndexRaw(env).messages[0].status).toBe('UNREAD');
    env.cleanup();
  });
});

describe('sigma-control — sigma_inbox_archive through a real in-process MCP client', () => {
  let env: TestEnv;
  afterEach(() => {
    env?.cleanup();
  });

  it('archives a message end-to-end and returns a structured response', async () => {
    env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'AUD' });
    setControlBinding(env.projectDir, 'AUD');
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'inbox-archive-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const rev = revisionOf(env.projectDir);
    const res = await client.callTool({
      name: 'sigma_inbox_archive',
      arguments: { message_id: 'MSG-1', idempotency_key: 'tx-1', expected_state_revision: rev },
    });
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    const payload = JSON.parse(text) as Payload;
    expect(payload.status).toBe('ARCHIVED');
    expect(payload.contract_version).toBe('1.0');
    await client.close();
    await server.close();
  });
});

describe('sigma-control sigma_inbox_archive — cross-process concurrency', () => {
  const CONTROL_BIN = path.resolve(__dirname, '..', 'bin', 'sigma-control.js');

  async function spawnArchive(root: string, role: string, messageId: string, idempotencyKey: string, expectedStateRevision: string) {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CONTROL_BIN, '--project-root', root, '--project-id', 'TEST', '--role', role],
      env: childEnv,
    });
    const client = new Client({ name: 'inbox-archive-concurrency', version: '0.0.0' });
    await client.connect(transport);
    const res = await client.callTool({
      name: 'sigma_inbox_archive',
      arguments: { message_id: messageId, idempotency_key: idempotencyKey, expected_state_revision: expectedStateRevision },
    });
    await client.close();
    const text = (res.content as Array<{ type: string; text: string }>)[0].text;
    return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
  }

  it('two independent processes, same idempotency_key: exactly one archive commits', async () => {
    const env = setupTestEnv();
    bootstrapProject(env);
    seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
    const rev = computeStateRevision(env.projectDir).revision!;

    const [a, b] = await Promise.all([
      spawnArchive(env.projectDir, 'FMN', 'MSG-1', 'cross-process-key', rev),
      spawnArchive(env.projectDir, 'FMN', 'MSG-1', 'cross-process-key', rev),
    ]);
    expect(a.isError, JSON.stringify(a.payload)).not.toBe(true);
    expect(b.isError, JSON.stringify(b.payload)).not.toBe(true);
    expect(a.payload.status).toBe('ARCHIVED');
    expect(b.payload.status).toBe('ARCHIVED');
    env.cleanup();
  }, 20000);

  it.each([
    'after_journal_prepared',
    'after_idempotency_pending',
    'inbox_archive_after_status',
    'inbox_archive_after_write',
    'after_mutation_before_commit_marker',
    'after_commit_marker',
    'after_commit_idempotency',
    'after_commit_audit',
  ])(
    'recovers inbox-archive deterministically after real process death at %s',
    async (failpoint) => {
      const env = setupTestEnv();
      bootstrapProject(env);
      seedMessage(env, { id: 'MSG-1', from: 'ARC', to: 'FMN' });
      const rev = computeStateRevision(env.projectDir).revision!;
      const key = `kill-${failpoint}`;

      const childEnv = Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      );
      childEnv.SIGMA_CONTROL_TEST_FAILPOINT = failpoint;
      const killTransport = new StdioClientTransport({
        command: process.execPath,
        args: [CONTROL_BIN, '--project-root', env.projectDir, '--project-id', 'TEST', '--role', 'FMN'],
        env: childEnv,
      });
      const killClient = new Client({ name: 'inbox-archive-kill', version: '0.0.0' });
      await killClient.connect(killTransport);
      await expect(
        killClient.callTool({ name: 'sigma_inbox_archive', arguments: { message_id: 'MSG-1', idempotency_key: key, expected_state_revision: rev } })
      ).rejects.toThrow();
      await killClient.close().catch(() => {});

      const recovered = await spawnArchive(env.projectDir, 'FMN', 'MSG-1', key, rev);
      expect(recovered.isError, JSON.stringify(recovered.payload)).not.toBe(true);
      expect(recovered.payload.status).toBe('ARCHIVED');
      env.cleanup();
    },
    20000
  );
});
