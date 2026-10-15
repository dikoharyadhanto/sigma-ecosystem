import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { spawnSync } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { computeStateRevision } from '../src/mcp/contract';
import { buildControlServer } from '../src/mcp/control/index';
import { setupTestEnv, stubProjectIdentity, stubProjectRootAnchor, runCli, TestEnv } from './helpers';

// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — Phase 3, sigma_create_note.
// TC-MCP-03 (role/project binding), TC-MCP-06 (idempotent replay, stale state),
// TC-MCP-07 (path containment). Compared throughout with `sigma notes new`.

type Payload = Record<string, any>;

const envs: TestEnv[] = [];
const clients: Client[] = [];
afterEach(async () => {
  resetBindingForTest();
  for (const c of clients.splice(0)) await c.close().catch(() => undefined);
  for (const e of envs.splice(0)) e.cleanup();
});

function project(): TestEnv {
  const env = setupTestEnv();
  envs.push(env);
  stubProjectIdentity(env);
  stubProjectRootAnchor(env);
  return env;
}

function bind(root: string, role: string | null, projectId = 'TEST'): void {
  const binding: Binding = {
    mode: 'control', kind: 'verified', root, projectId,
    rootFingerprint: fingerprintRoot(root), role, verified: true,
  };
  setBinding(binding);
}

const revisionOf = (root: string): string => {
  const rev = computeStateRevision(root).revision;
  if (!rev) throw new Error('no state revision');
  return rev;
};

async function connect(): Promise<Client> {
  const server = buildControlServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'notes-new', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return client;
}

async function createNote(client: Client, root: string, title: string, key: string, rev = revisionOf(root)): Promise<{ error: boolean; body: Payload }> {
  const res = await client.callTool({ name: 'sigma_create_note', arguments: { title, idempotency_key: key, expected_state_revision: rev } });
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

const registryOf = (root: string) => fs.readJsonSync(path.join(root, 'Sigma', 'notes-registry.json')) as { last_id: number; notes: Payload[] };

describe('sigma_create_note — role and project binding', () => {
  it('rejects a server with no bound role', async () => {
    const env = project();
    bind(env.projectDir, null);
    const { error, body } = await createNote(await connect(), env.projectDir, 'Alpha', 'k1');
    expect(error).toBe(true);
    expect(body.error.code).toBe('ROLE_NOT_AUTHORIZED');
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'notes-registry.json'))).toBe(false);
  });

  it.each(['ARC', 'FMN', 'DEV', 'AUD'])('creates a note as %s and attributes it to that bound role', async (role) => {
    const env = project();
    bind(env.projectDir, role);
    const { error, body } = await createNote(await connect(), env.projectDir, 'Roadmap thoughts', `k-${role}`);
    expect(error).toBe(false);
    expect(body.id).toBe('N01');
    expect(body.created_by_role).toBe(role);
    expect(body.path).toMatch(/^Sigma[\\/]notes[\\/]note-list[\\/]NOTE-\d+-roadmap-thoughts\.md$/);
    expect(fs.readFileSync(path.join(env.projectDir, body.path), 'utf8')).toMatch(/^# Roadmap thoughts/);
  });

  it('accepts no role argument: a caller cannot attribute a note to another role', async () => {
    const env = project();
    bind(env.projectDir, 'DEV');
    const client = await connect();
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'sigma_create_note')!;
    expect(Object.keys((tool.inputSchema as { properties: object }).properties).sort())
      .toEqual(['expected_state_revision', 'idempotency_key', 'title']);
    const res = await client.callTool({
      name: 'sigma_create_note',
      arguments: { title: 'Mine', role: 'ARC', idempotency_key: 'k', expected_state_revision: revisionOf(env.projectDir) },
    });
    expect((res.structuredContent as Payload).created_by_role).toBe('DEV');
  });
});

describe('sigma_create_note — parity with `sigma notes new`', () => {
  it('writes the same three files and the same registry shape as the CLI', async () => {
    const cliEnv = project();
    expect(runCli('notes new --title "Same title" --role dev', cliEnv.projectDir, cliEnv.homeDir).exitCode).toBe(0);

    const mcpEnv = project();
    bind(mcpEnv.projectDir, 'DEV');
    const created = await createNote(await connect(), mcpEnv.projectDir, 'Same title', 'k');
    expect(created.error).toBe(false);

    const a = registryOf(cliEnv.projectDir);
    const b = registryOf(mcpEnv.projectDir);
    expect(b.last_id).toBe(a.last_id);
    const pick = (n: Payload) => ({ id: n.id, title: n.title, role: n.created_by_role, dir: path.posix.dirname(n.path) });
    expect(b.notes.map(pick)).toEqual(a.notes.map(pick));
    expect(fs.readFileSync(path.join(mcpEnv.projectDir, 'Sigma', 'notes', 'note-list.md'), 'utf8')).toContain('Same title');
    // The catalog row the CLI writes is the row the tool writes.
    const row = (env: TestEnv) => fs.readFileSync(path.join(env.projectDir, 'Sigma', 'notes', 'note-list.md'), 'utf8')
      .split('\n').find((l) => l.includes('Same title'))!.replace(/NOTE-\d+/, 'NOTE-X').replace(/\d{4}-\d\d-\d\d[ T][\d:]+/g, 'T');
    expect(row(mcpEnv)).toBe(row(cliEnv));
  });

  it('numbers after existing CLI notes and the CLI continues after tool notes', async () => {
    const env = project();
    expect(runCli('notes new --title "First"', env.projectDir, env.homeDir).exitCode).toBe(0);
    bind(env.projectDir, 'FMN');
    const second = await createNote(await connect(), env.projectDir, 'Second', 'k');
    expect(second.body.id).toBe('N02');
    expect(runCli('notes new --title "Third"', env.projectDir, env.homeDir).exitCode).toBe(0);
    expect(registryOf(env.projectDir).notes.map((n) => n.id)).toEqual(['N01', 'N02', 'N03']);
  });

  it('refuses what the CLI refuses, before anything is written', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const client = await connect();
    const before = snapshot(env.projectDir);
    // A shell cannot carry a real newline in one argument, so that case is
    // MCP-only; the no-letters title is compared with the CLI.
    expect(runCli('notes new --title "!!! ???"', env.projectDir, env.homeDir).exitCode).not.toBe(0);
    for (const title of ['!!! ???', 'two\nlines']) {
      const { error, body } = await createNote(client, env.projectDir, title, `bad-${title.length}`);
      expect(error, JSON.stringify(title)).toBe(true);
      expect(body.error.code).toBe('INVALID_OPERATION');
    }
    // Only audit/control-store bookkeeping may differ; no note, registry, or catalog.
    const after = snapshot(env.projectDir);
    const touched = [...after.keys()].filter((k) => !before.has(k) || before.get(k) !== after.get(k));
    expect(touched.filter((k) => k.includes(path.join('Sigma', 'notes')) || k.includes('notes-registry'))).toEqual([]);
  });

  it('refuses an unreadable registry without modifying it', async () => {
    const env = project();
    const registry = path.join(env.projectDir, 'Sigma', 'notes-registry.json');
    fs.outputFileSync(registry, '{ not json');
    bind(env.projectDir, 'ARC');
    const { error, body } = await createNote(await connect(), env.projectDir, 'Anything', 'k');
    expect(error).toBe(true);
    expect(body.error.code).toBe('INVALID_OPERATION');
    expect(body.error.message).toMatch(/unreadable/);
    expect(body.error.message).not.toContain(env.projectDir);
    expect(fs.readFileSync(registry, 'utf8')).toBe('{ not json');
  });
});

describe('sigma_create_note — TC-MCP-06 ticket and replay semantics', () => {
  it('replays an identical call without a second note, and rejects the key reused with another title', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const client = await connect();
    const rev = revisionOf(env.projectDir);
    const first = await createNote(client, env.projectDir, 'Once', 'same-key', rev);
    const again = await createNote(client, env.projectDir, 'Once', 'same-key', rev);
    expect(first.error).toBe(false);
    expect(again.error).toBe(false);
    expect(again.body.id).toBe(first.body.id);
    expect(registryOf(env.projectDir).notes).toHaveLength(1);

    const reused = await createNote(client, env.projectDir, 'Other', 'same-key', rev);
    expect(reused.error).toBe(true);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(registryOf(env.projectDir).notes).toHaveLength(1);
  });

  it('rejects a stale state revision and writes no note', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const { error, body } = await createNote(await connect(), env.projectDir, 'Late', 'k', 'sha256:' + '0'.repeat(64));
    expect(error).toBe(true);
    expect(body.error.code).toBe('STALE_STATE');
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'notes-registry.json'))).toBe(false);
  });

  it('keeps two notes with the same title distinct', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const client = await connect();
    const a = await createNote(client, env.projectDir, 'Dup', 'k1');
    const b = await createNote(client, env.projectDir, 'Dup', 'k2');
    expect(a.body.path).not.toBe(b.body.path);
    expect([a.body.id, b.body.id]).toEqual(['N01', 'N02']);
  });
});

describe('sigma_create_note — TC-MCP-07 path containment', () => {
  it.each(['../../escape', '../outside/../../x', '/etc/cron.d/x', 'a/b\\c', '..'])('derives the file name from the slug only: %j', async (title) => {
    const env = project();
    bind(env.projectDir, 'ARC');
    // The parent is the shared temp dir, which parallel tests also write to, so
    // only entries a path-steering title could have produced are compared.
    const steered = (): string[] => fs.readdirSync(path.dirname(env.projectDir)).filter((n) => /escape|outside|^x$|^NOTE-/.test(n)).sort();
    const outsideBefore = steered();
    const { error, body } = await createNote(await connect(), env.projectDir, title, 'k');
    if (!error) {
      // Accepted titles become a flat slug under note-list/, never a path.
      const resolved = path.resolve(env.projectDir, body.path);
      expect(resolved.startsWith(path.join(env.projectDir, 'Sigma', 'notes', 'note-list') + path.sep)).toBe(true);
      expect(path.basename(body.path)).toMatch(/^NOTE-\d+-[a-z0-9-]+\.md$/);
    }
    expect(steered()).toEqual(outsideBefore);
    expect(fs.existsSync('/etc/cron.d/x')).toBe(false);
  });

  it('refuses a symlinked notes folder rather than writing through it', async () => {
    const env = project();
    const outside = fs.mkdtempSync(path.join(path.dirname(env.projectDir), 'sigma-outside-'));
    envs.push({ cleanup: () => fs.removeSync(outside) } as TestEnv);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'notes'));
    fs.symlinkSync(outside, path.join(env.projectDir, 'Sigma', 'notes', 'note-list'));
    bind(env.projectDir, 'ARC');
    const { error } = await createNote(await connect(), env.projectDir, 'Through the link', 'k');
    expect(error).toBe(true);
    expect(fs.readdirSync(outside)).toEqual([]);
  });
});

describe('sigma_create_note — plane', () => {
  it('lives on the control server only and is annotated as a write', async () => {
    const env = project();
    bind(env.projectDir, 'ARC');
    const { tools } = await (await connect()).listTools();
    const tool = tools.find((t) => t.name === 'sigma_create_note')!;
    expect(tool.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
    // spawn guard: the query binary must not list it (separate module graph).
    const query = spawnSync('node', ['-e', "const s=require('./dist/mcp/index.js').buildServer();console.log(Object.keys(s._registeredTools).join(','))"], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    expect(query.stdout).not.toContain('sigma_create_note');
  });
});
