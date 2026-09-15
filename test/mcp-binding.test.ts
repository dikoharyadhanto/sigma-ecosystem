// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §16.1 / §16.2 — Batch 1 test contract.
//
// Two properties are load-bearing here and neither is provable by reading the
// code: that a bound server cannot be talked into another project, and that
// every query leaves the governance tree byte-identical.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildServer, bindFromArgv } from '../src/mcp/index';
import {
  parseBindingArgs,
  resolveBinding,
  BindingError,
  fingerprintRoot,
  sameRoot,
} from '../src/mcp/binding';
import { setBinding, getBinding, resetBindingForTest, resolveRoot } from '../src/mcp/shared';
import { computeEffectivePolicy, availabilityFor, OPERATION_TIERS } from '../src/mcp/policy';
import { computeReadArtifact, MAX_ARTIFACT_BYTES } from '../src/mcp/tools/readArtifact';
import { computeMemory } from '../src/mcp/tools/memory';

import {
  setupTestEnv,
  writeChainFixture,
  stubProjectIdentity,
  makeChain,
  makeChainWithLockedPlan,
  TestEnv,
} from './helpers';

type Payload = Record<string, unknown>;

let envs: TestEnv[] = [];

function project(id = 'TEST', chain: object = makeChain('v1')): TestEnv {
  const env = setupTestEnv();
  stubProjectIdentity(env, id, `${id} Project`);
  writeChainFixture(env, 'v1', chain);
  envs.push(env);
  return env;
}

beforeEach(() => {
  resetBindingForTest();
});

afterEach(() => {
  resetBindingForTest();
  for (const e of envs) e.cleanup();
  envs = [];
});

// Every file under the project, hashed. The non-mutation assertion compares
// this map before and after a batch of reads.
function governanceHashes(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs);
      else {
        out[path.relative(root, abs).split(path.sep).join('/')] =
          crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      }
    }
  };
  walk(root);
  return out;
}

async function connected() {
  const server = buildServer();
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ payload: Payload; isError: boolean }> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  return { payload: JSON.parse(text) as Payload, isError: res.isError === true };
}

// ── §16.1 Binding and isolation ──────────────────────────────────────────────

describe('binding — argument parsing (§7.1)', () => {
  it('accepts the legacy positional form every installed config still writes', () => {
    const parsed = parseBindingArgs(['C:/some/project']);
    expect(parsed.projectRoot).toBe('C:/some/project');
    expect(parsed.projectId).toBeUndefined();
    expect(parsed.mode).toBe('query');
  });

  it('accepts the verified flag form', () => {
    const parsed = parseBindingArgs(['--mode', 'query', '--project-root', '/p', '--project-id', 'ABC']);
    expect(parsed).toMatchObject({ mode: 'query', projectRoot: '/p', projectId: 'ABC' });
  });

  it('ignores unknown flags rather than dying — an old binary must survive a new config (§7.4)', () => {
    const parsed = parseBindingArgs(['--future-flag', 'x', '--project-root', '/p']);
    expect(parsed.projectRoot).toBe('/p');
  });

  it('rejects an unknown --mode', () => {
    expect(() => parseBindingArgs(['--mode', 'admin'])).toThrow(BindingError);
  });
});

describe('binding — resolution (§7.1)', () => {
  it('matching project_id yields a verified binding', () => {
    const env = project('HERMESLAB');
    const b = resolveBinding({ mode: 'query', projectRoot: env.projectDir, projectId: 'HERMESLAB' });
    expect(b.verified).toBe(true);
    expect(b.kind).toBe('verified');
    expect(b.projectId).toBe('HERMESLAB');
    expect(b.rootFingerprint).toBe(fingerprintRoot(env.projectDir));
  });

  it('a mismatched project_id fails closed and echoes neither id', () => {
    const env = project('REAL');
    try {
      resolveBinding({ mode: 'query', projectRoot: env.projectDir, projectId: 'EXPECTED' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BindingError);
      const err = e as BindingError;
      expect(err.code).toBe('PROJECT_ID_MISMATCH');
      expect(err.message).not.toContain('REAL');
      expect(err.message).not.toContain('EXPECTED');
    }
  });

  it('the positional form binds the root but stays unverified', () => {
    const env = project('TEST');
    const b = resolveBinding(parseBindingArgs([env.projectDir]));
    expect(b.kind).toBe('bound');
    expect(b.verified).toBe(false);
    expect(b.root).not.toBeNull();
  });

  it('a root that is not a Sigma project is refused', () => {
    const empty = fs.mkdtempSync(path.join(require('os').tmpdir(), 'sigma-not-a-project-'));
    try {
      expect(() => resolveBinding({ mode: 'query', projectRoot: empty })).toThrow(/NO_PROJECT|not a Sigma project/);
    } finally {
      fs.removeSync(empty);
    }
  });

  it('control mode refuses to start unbound, and refuses a root without an id', () => {
    const env = project('TEST');
    expect(() => resolveBinding({ mode: 'control' })).toThrow(BindingError);
    expect(() => resolveBinding({ mode: 'control', projectRoot: env.projectDir })).toThrow(/BINDING_REQUIRED|--project-id/);
  });

  it('no root at all falls back to discovery, never to control', () => {
    const b = resolveBinding({ mode: 'query' });
    expect(b.kind).toBe('discovery');
    expect(b.root).toBeNull();
    expect(b.verified).toBe(false);
  });
});

describe('binding — isolation (§16.1)', () => {
  it('a per-call project_root naming another project is a BOUNDARY_VIOLATION', async () => {
    const mine = project('MINE');
    const theirs = project('THEIRS');
    bindFromArgv(['--mode', 'query', '--project-root', mine.projectDir, '--project-id', 'MINE']);

    const { client, close } = await connected();
    try {
      const { payload, isError } = await call(client, 'sigma_get_state', { project_root: theirs.projectDir });
      expect(isError).toBe(true);
      expect((payload.error as Payload).code).toBe('BOUNDARY_VIOLATION');
      // The other project's identity must not leak through the refusal.
      expect(JSON.stringify(payload)).not.toContain('THEIRS');
    } finally {
      await close();
    }
  });

  it('a per-call project_root naming the bound project itself is allowed', async () => {
    const mine = project('MINE');
    bindFromArgv(['--mode', 'query', '--project-root', mine.projectDir, '--project-id', 'MINE']);

    const { client, close } = await connected();
    try {
      const { payload, isError } = await call(client, 'sigma_get_state', { project_root: mine.projectDir });
      expect(isError).toBe(false);
      expect(payload.project_id).toBe('MINE');
    } finally {
      await close();
    }
  });

  it('once bound, environment, cwd and client roots cannot move the root', async () => {
    const mine = project('MINE');
    const theirs = project('THEIRS');
    bindFromArgv([mine.projectDir]);

    const originalCwd = process.cwd();
    process.env.SIGMA_PROJECT_ROOT = theirs.projectDir;
    try {
      process.chdir(theirs.projectDir);
      const { addClientRoot } = await import('../src/mcp/shared');
      addClientRoot(`file:///${theirs.projectDir.replace(/\\/g, '/')}`);

      // resolveRoot is the legacy path; it must short-circuit to the binding.
      expect(sameRoot(resolveRoot()!, mine.projectDir)).toBe(true);
      expect(sameRoot(resolveRoot(undefined)!, mine.projectDir)).toBe(true);

      const { client, close } = await connected();
      const { payload } = await call(client, 'sigma_get_state');
      expect(payload.project_id).toBe('MINE');
      await close();
    } finally {
      process.chdir(originalCwd);
      delete process.env.SIGMA_PROJECT_ROOT;
    }
  });

  it('two bindings for two projects do not share state', () => {
    const a = project('AAA');
    const b = project('BBB');

    const bindA = resolveBinding({ mode: 'query', projectRoot: a.projectDir, projectId: 'AAA' });
    const bindB = resolveBinding({ mode: 'query', projectRoot: b.projectDir, projectId: 'BBB' });

    expect(bindA.rootFingerprint).not.toBe(bindB.rootFingerprint);
    expect(bindA.projectId).not.toBe(bindB.projectId);

    setBinding(bindA);
    expect(getBinding().projectId).toBe('AAA');
    setBinding(bindB);
    expect(getBinding().projectId).toBe('BBB');
  });

  it('the absolute root is not sent to the model; the fingerprint is', async () => {
    const mine = project('MINE');
    bindFromArgv(['--mode', 'query', '--project-root', mine.projectDir, '--project-id', 'MINE']);

    const { client, close } = await connected();
    try {
      const { payload } = await call(client, 'sigma_get_state');
      const binding = payload.binding as Payload;
      expect(binding.root_fingerprint).toBe(fingerprintRoot(mine.projectDir));
      expect(JSON.stringify(binding)).not.toContain(mine.projectDir);
    } finally {
      await close();
    }
  });
});

describe('sigma_verify_binding (§9.1)', () => {
  it('confirms a matching expectation and reports a mismatching one without rebinding', async () => {
    const mine = project('MINE');
    bindFromArgv(['--mode', 'query', '--project-root', mine.projectDir, '--project-id', 'MINE']);

    const { client, close } = await connected();
    try {
      const good = await call(client, 'sigma_verify_binding', { expected_project_id: 'MINE', expected_root: mine.projectDir });
      expect(good.payload.usable).toBe(true);
      expect(good.payload.expected_project_id_match).toBe(true);
      expect(good.payload.expected_root_match).toBe(true);

      const bad = await call(client, 'sigma_verify_binding', { expected_project_id: 'SOMETHING_ELSE' });
      expect(bad.payload.expected_project_id_match).toBe(false);
      expect(bad.payload.usable).toBe(false);

      // The binding itself is untouched by a failed expectation.
      expect(getBinding().projectId).toBe('MINE');
    } finally {
      await close();
    }
  });

  it('reports an unchecked expectation as null rather than as a pass', async () => {
    const mine = project('MINE');
    bindFromArgv([mine.projectDir]);
    const { client, close } = await connected();
    try {
      const { payload } = await call(client, 'sigma_verify_binding');
      expect(payload.expected_project_id_match).toBeNull();
      expect(payload.expected_root_match).toBeNull();
      expect(payload.binding_verified).toBe(false);
      expect(payload.bound).toBe(true);
    } finally {
      await close();
    }
  });
});

// ── §16.2 Query safety ───────────────────────────────────────────────────────

describe('query safety (§16.2)', () => {
  it('every Batch 1 query leaves the governance tree byte-identical', async () => {
    const env = project('MINE', makeChainWithLockedPlan());
    // Give the tracker a real file to read so sigma_read_artifact does work.
    const intentPath = path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md');
    fs.ensureDirSync(path.dirname(intentPath));
    fs.writeFileSync(intentPath, '# DIR-INTENT v1\n\nbody\n');
    fs.copySync(path.resolve(__dirname, '..', 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'),
      path.join(env.projectDir, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'));

    bindFromArgv(['--mode', 'query', '--project-root', env.projectDir, '--project-id', 'MINE']);

    const before = governanceHashes(env.projectDir);

    const { client, close } = await connected();
    try {
      await call(client, 'sigma_get_state');
      await call(client, 'sigma_get_gates');
      await call(client, 'sigma_get_orientation');
      await call(client, 'sigma_list_artifacts');
      await call(client, 'sigma_doctor');
      await call(client, 'sigma_get_memory', { role: 'FMN' });
      await call(client, 'sigma_verify_binding');
      await call(client, 'sigma_get_effective_policy');
      await call(client, 'sigma_read_artifact', { type: 'intent' });
    } finally {
      await close();
    }

    expect(governanceHashes(env.projectDir)).toEqual(before);
  });

  it('state_revision changes only when a tracked input changes', async () => {
    const env = project('MINE');
    bindFromArgv(['--mode', 'query', '--project-root', env.projectDir, '--project-id', 'MINE']);

    const { client, close } = await connected();
    try {
      const first = await call(client, 'sigma_get_state');
      const second = await call(client, 'sigma_get_state');
      const rev = (p: Payload) => (p.snapshot as Payload).state_revision;
      expect(rev(first.payload)).toBe(rev(second.payload));

      // An untracked file must not move the revision (§7.3).
      fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'logs'));
      fs.appendFileSync(path.join(env.projectDir, 'Sigma', 'logs', 'operations.jsonl'), '{"op":"noise"}\n');
      const third = await call(client, 'sigma_get_state');
      expect(rev(third.payload)).toBe(rev(first.payload));

      // A tracked one must.
      writeChainFixture(env, 'v1', makeChainWithLockedPlan());
      const fourth = await call(client, 'sigma_get_state');
      expect(rev(fourth.payload)).not.toBe(rev(first.payload));
    } finally {
      await close();
    }
  });
});

describe('sigma_read_artifact (§9.1)', () => {
  function withIntentDoc(body: string): TestEnv {
    const env = project('MINE');
    const p = path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md');
    fs.ensureDirSync(path.dirname(p));
    fs.writeFileSync(p, body);
    return env;
  }

  it('reads a tracker-registered artifact and reports its hash and relative path', () => {
    const env = withIntentDoc('# DIR-INTENT v1\n');
    const out = computeReadArtifact(env.projectDir, 'intent') as Payload;
    expect(out.present).toBe(true);
    expect(out.content).toBe('# DIR-INTENT v1\n');
    expect(out.path).toBe('Sigma/charter/DIR-INTENT-v1.md');
    expect(String(out.sha256)).toMatch(/^sha256:[0-9a-f]{64}$/);
    // Never a host path.
    expect(JSON.stringify(out)).not.toContain(env.projectDir);
  });

  it('refuses a version the tracker does not record', () => {
    const env = withIntentDoc('x');
    expect(() => computeReadArtifact(env.projectDir, 'intent', 'v99')).toThrow(/INVALID_OPERATION|No intent artifact/);
  });

  it('refuses an artifact type the chain has no entry for', () => {
    const env = withIntentDoc('x');
    expect(() => computeReadArtifact(env.projectDir, 'close')).toThrow(/INVALID_OPERATION|No close artifact/);
  });

  it('refuses rather than truncates an oversized artifact', () => {
    const env = withIntentDoc('x'.repeat(MAX_ARTIFACT_BYTES + 1));
    expect(() => computeReadArtifact(env.projectDir, 'intent')).toThrow(/PAYLOAD_TOO_LARGE|read limit/);
  });

  it('refuses a tracker entry that escapes the project root', () => {
    const env = project('MINE');
    const outside = path.join(env.homeDir, 'secret.md');
    fs.writeFileSync(outside, 'secret');
    // A tracker entry crafted to point out of the tree — the containment check,
    // not the tracker, is what has to stop this.
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: path.relative(env.projectDir, outside), created_at: 'x', updated_at: 'x' },
    }));
    expect(() => computeReadArtifact(env.projectDir, 'intent')).toThrow(/BOUNDARY_VIOLATION|outside/);
  });

  it('reports a tracked-but-missing file as state, not as a read error', () => {
    const env = project('MINE'); // chain references the doc; no file written
    const out = computeReadArtifact(env.projectDir, 'intent') as Payload;
    expect(out.present).toBe(false);
    expect(out.content).toBeNull();
  });
});

describe('policy projection (§12, matrix §6)', () => {
  it('treats an operation absent from the allowlist as forbidden, not as unrestricted', () => {
    // The eight `notion` subcommands are in the CLI and in no registry entry.
    expect(availabilityFor('notion_push', null).availability).toBe('forbidden');
    expect(OPERATION_TIERS['notion_push']).toBeUndefined();
  });

  it('classifies scan as forbidden despite its read_only registry level', () => {
    expect(OPERATION_TIERS['scan']).toBe('NA');
    expect(availabilityFor('scan', null).availability).toBe('forbidden');
  });

  it('marks privileged operations forbidden and W2 transitions director_required', () => {
    for (const op of ['project_start', 'setup_install', 'override', 'config']) {
      expect(availabilityFor(op, null).availability).toBe('forbidden');
    }
    expect(availabilityFor('intent_ratify', null).availability).toBe('director_required');
    expect(availabilityFor('plan_lock', null).availability).toBe('director_required');
  });

  it('reports a gate-blocked operation as gate_blocked rather than role_action', () => {
    const closed = { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false, intent_state: 'DRAFT' };
    const open = { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false, intent_state: 'DRAFT' };
    expect(availabilityFor('plan_new', closed).availability).toBe('gate_blocked');
    expect(availabilityFor('plan_new', open).availability).toBe('role_action');
  });

  it('says out loud that it is advisory, and covers the whole registry', () => {
    const env = project('MINE');
    fs.copySync(path.resolve(__dirname, '..', 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'),
      path.join(env.projectDir, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'));

    const out = computeEffectivePolicy(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out.advisory).toBe(true);
    const ops = out.operations as Payload[];
    expect(ops.length).toBe(59);
    // Every registry operation is classified — no silent gaps.
    expect(ops.filter((o) => o.tier === null && o.availability !== 'forbidden')).toHaveLength(0);
    // Nothing in Batch 1 is exposed as an executable write.
    expect(ops.filter((o) => o.mcp_status === 'implemented').every((o) => o.availability === 'observe')).toBe(true);
  });
});

describe('host path redaction (§8.1)', () => {
  it('keeps the absolute source_path on an unverified binding', () => {
    const env = project('MINE');
    bindFromArgv([env.projectDir]); // positional → bound, unverified
    const out = computeMemory(env.projectDir, 'FMN') as Payload;
    expect(out.active).toBe(true);
    expect(path.isAbsolute(String(out.source_path))).toBe(true);
    expect(out.source_path_fingerprint).toBeNull();
  });

  it('relativises source_path and adds a fingerprint on a verified binding', () => {
    const env = project('MINE');
    // Role memory has to live inside the project for a relative path to exist.
    const roleMemDir = path.join(env.projectDir, 'Sigma', 'role-memory');
    fs.ensureDirSync(roleMemDir);
    fs.copySync(path.resolve(__dirname, '..', 'Sigma', 'role-memory'), roleMemDir);

    bindFromArgv(['--mode', 'query', '--project-root', env.projectDir, '--project-id', 'MINE']);
    const out = computeMemory(env.projectDir, 'FMN') as Payload;
    expect(out.active).toBe(true);
    expect(path.isAbsolute(String(out.source_path))).toBe(false);
    expect(String(out.source_path_fingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
