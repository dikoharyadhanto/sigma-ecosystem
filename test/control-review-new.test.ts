import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { computeStateRevision } from '../src/mcp/contract';
import { buildControlServer } from '../src/mcp/control/index';
import { buildServer } from '../src/mcp/index';
import {
  setupTestEnv, stubProjectIdentity, stubProjectRootAnchor, writeChainFixture, runCli,
  makeChainWithLockedExec, makeChainWithDraftIntent, TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — Phase 3, sigma_create_review.
// TC-MCP-03 (role/project binding), TC-MCP-06 (idempotent replay, stale state),
// TC-MCP-07 (path containment: exactly one file). Differential against `sigma review new`.

type Payload = Record<string, any>;

const envs: TestEnv[] = [];
const clients: Client[] = [];
afterEach(async () => {
  resetBindingForTest();
  for (const c of clients.splice(0)) await c.close().catch(() => undefined);
  for (const e of envs.splice(0)) e.cleanup();
});

function project(chain: object = makeChainWithLockedExec('v1', 'v1.1')): TestEnv {
  const env = setupTestEnv();
  envs.push(env);
  stubProjectIdentity(env);
  stubProjectRootAnchor(env);
  writeChainFixture(env, 'v1', chain);
  return env;
}

function bind(root: string, role: string | null): void {
  const binding: Binding = {
    mode: 'control', kind: 'verified', root, projectId: 'TEST',
    rootFingerprint: fingerprintRoot(root), role, verified: true,
  };
  setBinding(binding);
}

const revisionOf = (root: string): string => {
  const rev = computeStateRevision(root).revision;
  if (!rev) throw new Error('no state revision');
  return rev;
};

async function connect(server = buildControlServer()): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'review-new', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return client;
}

async function createReview(client: Client, root: string, key: string, rev = revisionOf(root)): Promise<{ error: boolean; body: Payload }> {
  const res = await client.callTool({ name: 'sigma_create_review', arguments: { idempotency_key: key, expected_state_revision: rev } });
  return { error: res.isError === true, body: res.structuredContent as Payload };
}

function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.set(path.relative(root, abs), crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
    }
  };
  walk(root);
  return out;
}

function changed(before: Map<string, string>, after: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of after) if (before.get(k) !== v) out.push(k);
  for (const k of before.keys()) if (!after.has(k)) out.push(k);
  return out.sort();
}

const REVIEW = path.join('Sigma', 'review', 'PRODUCT-REVIEW-v1.md');
// Control-store bookkeeping a control write always leaves; not project content.
const bookkeeping = (k: string) => k.includes('.mcp-control') || k.endsWith(path.join('logs', 'operations.jsonl'));

describe('sigma_create_review — role binding', () => {
  it('rejects a server with no bound role', async () => {
    const env = project();
    bind(env.projectDir, null);
    const { error, body } = await createReview(await connect(), env.projectDir, 'k');
    expect(error).toBe(true);
    expect(body.error.code).toBe('ROLE_NOT_AUTHORIZED');
    expect(fs.existsSync(path.join(env.projectDir, REVIEW))).toBe(false);
  });

  it.each(['FMN', 'DEV', 'AUD'])('refuses %s: only ARC creates the PRODUCT REVIEW', async (role) => {
    const env = project();
    bind(env.projectDir, role);
    const { error, body } = await createReview(await connect(), env.projectDir, `k-${role}`);
    expect(error).toBe(true);
    expect(body.error.code).toBe('ROLE_NOT_AUTHORIZED');
    expect(fs.existsSync(path.join(env.projectDir, REVIEW))).toBe(false);
  });

  it('creates the review for ARC', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const { error, body } = await createReview(await connect(), env.projectDir, 'k');
    expect(error).toBe(false);
    expect(body.chain).toBe('v1');
    expect(body.path).toBe(REVIEW);
    expect(body.validation.ok).toBe(true);
    expect(fs.existsSync(path.join(env.projectDir, REVIEW))).toBe(true);
  });
});

describe('sigma_create_review — parity with `sigma review new`', () => {
  it('produces the same bytes as the CLI and passes `review check`', async () => {
    const cliEnv = project();
    expect(runCli('review new', cliEnv.projectDir, cliEnv.homeDir).exitCode).toBe(0);

    const mcpEnv = project();
    bind(mcpEnv.projectDir, 'ARC');
    expect((await createReview(await connect(), mcpEnv.projectDir, 'k')).error).toBe(false);

    expect(fs.readFileSync(path.join(mcpEnv.projectDir, REVIEW))).toEqual(fs.readFileSync(path.join(cliEnv.projectDir, REVIEW)));
    expect(runCli('review check', mcpEnv.projectDir, mcpEnv.homeDir).exitCode).toBe(0);
  });

  it('refuses a DRAFT INTENT with the CLI message and writes nothing', async () => {
    const env = project(makeChainWithDraftIntent('v1'));
    const cli = runCli('review new', env.projectDir, env.homeDir);
    expect(cli.exitCode).toBe(1);
    bind(env.projectDir, 'ARC');
    const before = snapshot(env.projectDir);
    const { error, body } = await createReview(await connect(), env.projectDir, 'k');
    expect(error).toBe(true);
    expect(body.error.code).toBe('GATE_BLOCKED');
    expect(body.error.message).toMatch(/requires a RATIFIED INTENT/);
    expect(cli.stderr).toMatch(/requires a RATIFIED INTENT/);
    expect(changed(before, snapshot(env.projectDir)).filter((k) => !bookkeeping(k))).toEqual([]);
    expect(fs.existsSync(path.join(env.projectDir, REVIEW))).toBe(false);
  });

  it('keeps one review per INTENT: a second call is refused and the file is untouched', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const client = await connect();
    expect((await createReview(client, env.projectDir, 'k1')).error).toBe(false);
    const written = fs.readFileSync(path.join(env.projectDir, REVIEW));
    // Verdicts are written by people, never by this tool; a re-run must not reset them.
    fs.writeFileSync(path.join(env.projectDir, REVIEW), Buffer.concat([written, Buffer.from('\n<!-- reviewer edit -->\n')]));
    const edited = fs.readFileSync(path.join(env.projectDir, REVIEW));

    const second = await createReview(client, env.projectDir, 'k2');
    expect(second.error).toBe(true);
    expect(second.body.error.code).toBe('INVALID_OPERATION');
    expect(second.body.error.message).toMatch(/already exists/);
    expect(fs.readFileSync(path.join(env.projectDir, REVIEW))).toEqual(edited);
  });
});

describe('sigma_create_review — transaction and replay', () => {
  it('writes the review file and nothing else but control-store bookkeeping', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const before = snapshot(env.projectDir);
    expect((await createReview(await connect(), env.projectDir, 'k')).error).toBe(false);
    expect(changed(before, snapshot(env.projectDir)).filter((k) => !bookkeeping(k))).toEqual([REVIEW]);
  });

  it('replays the same key without recreating, and rejects a stale revision', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const client = await connect();
    const rev = revisionOf(env.projectDir);
    const first = await createReview(client, env.projectDir, 'same', rev);
    const replay = await createReview(client, env.projectDir, 'same', rev);
    expect(first.error).toBe(false);
    expect(replay.error).toBe(false);
    expect(replay.body.path).toBe(first.body.path);

    const env2 = project();
    bind(env2.projectDir, 'ARC');
    const stale = await createReview(await connect(), env2.projectDir, 'k', 'sha256:' + '0'.repeat(64));
    expect(stale.error).toBe(true);
    expect(stale.body.error.code).toBe('STALE_STATE');
    expect(fs.existsSync(path.join(env2.projectDir, REVIEW))).toBe(false);
  });

  it('is readable by the query plane afterwards (review_check, close_check)', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    expect((await createReview(await connect(), env.projectDir, 'k')).error).toBe(false);
    const cwd = process.cwd();
    process.chdir(env.projectDir);
    try {
      resetBindingForTest();
      const query = await connect(buildServer());
      const check = JSON.parse(((await query.callTool({ name: 'sigma_review_check', arguments: {} })).content as any)[0].text) as Payload;
      expect(check.ok).toBe(true);
      // A fresh template has no verdicts, so closure is not yet possible.
      const close = JSON.parse(((await query.callTool({ name: 'sigma_close_check', arguments: {} })).content as any)[0].text) as Payload;
      expect(close.eligible).toBe(false);
      expect(close.product_review.file).toBe(REVIEW);
    } finally {
      process.chdir(cwd);
    }
  });
});
