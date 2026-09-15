// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §14 Stage B2 (evidence-only) —
// sigma_get_evidence test contract. Mirrors the rigor of
// test/mcp-binding.test.ts: boundary violation on a corrupted tracker,
// non-mutation, and — per reviewer finding R-B2-04 — the same read posture as
// sigma_read_artifact (BOUNDARY_VIOLATION on a non-regular file, not a silent
// present:false).
//
// MCP mailbox tools (sigma_list_messages, sigma_read_message) were built and
// reviewed here but withdrawn by Director decision after review (2026-09-15,
// RESULT-IMPL-SIGMA-MCP-STAGE-B2-20260915.md §9) — mailbox stays CLI/skill
// only. Their tests were removed along with the tool; do not reintroduce them
// without a fresh Director decision.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildServer, bindFromArgv } from '../src/mcp/index';
import { resetBindingForTest } from '../src/mcp/shared';
import { computeGetEvidence } from '../src/mcp/tools/evidence';

import {
  setupTestEnv,
  writeChainFixture,
  stubProjectIdentity,
  makeChainWithLockedExec,
  TestEnv,
} from './helpers';

type Payload = Record<string, unknown>;

let envs: TestEnv[] = [];

function project(id = 'TEST', chain: object): TestEnv {
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

// ── sigma_get_evidence ───────────────────────────────────────────────────────

describe('sigma_get_evidence (§9.1 Stage B2)', () => {
  it('reports status for the active exec version, including a hash of its file', () => {
    const env = project('MINE', makeChainWithLockedExec());
    const execPath = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md');
    fs.ensureDirSync(path.dirname(execPath));
    fs.writeFileSync(execPath, '# DEV-EXEC v1.1\n\nbody\n');

    const out = computeGetEvidence(env.projectDir, 'exec') as Payload;
    expect(out.active).toBe(true);
    expect(out.evidence_type).toBe('exec');
    expect(out.version).toBe('v1.1');
    expect(out.state).toBe('LOCKED');
    expect(out.present).toBe(true);
    expect(out.path).toBe('Sigma/evidence/DEV-EXEC-v1.1.md');
    expect(out.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    // No document body — that is sigma_read_artifact's job, not this tool's.
    expect(out).not.toHaveProperty('content');
  });

  it('reports present:false when the tracker references a file missing on disk', () => {
    const env = project('MINE', makeChainWithLockedExec());
    // No file written at Sigma/evidence/DEV-EXEC-v1.1.md.
    const out = computeGetEvidence(env.projectDir, 'exec') as Payload;
    expect(out.present).toBe(false);
    expect(out.sha256).toBeNull();
    expect(out.path).toBe('Sigma/evidence/DEV-EXEC-v1.1.md');
  });

  it('rejects an unknown version', () => {
    const env = project('MINE', makeChainWithLockedExec());
    expect(() => computeGetEvidence(env.projectDir, 'exec', 'v9.9')).toThrow(/INVALID_OPERATION|No exec artifact/);
  });

  it('refuses a tracker entry redirected at a dotfile — same boundary as sigma_read_artifact', () => {
    const env = project('MINE', makeChainWithLockedExec());
    const chainPath = path.join(env.sigmaDir, 'progress-v1.json');
    const chain = fs.readJsonSync(chainPath);
    chain.exec.versions[0].file = '.env';
    fs.writeJsonSync(chainPath, chain);
    fs.writeFileSync(path.join(env.projectDir, '.env'), 'SECRET=leak\n');

    expect(() => computeGetEvidence(env.projectDir, 'exec')).toThrow(/canonical location|BOUNDARY_VIOLATION/);
  });

  it('accepts the legacy pre-rename folder, matching sigma_read_artifact (R-10 parity)', () => {
    const env = project('MINE', makeChainWithLockedExec());
    const chainPath = path.join(env.sigmaDir, 'progress-v1.json');
    const chain = fs.readJsonSync(chainPath);
    chain.exec.versions[0].file = 'Sigma/build/DEV-EXEC-v1.1.md';
    fs.writeJsonSync(chainPath, chain);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'build'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'build', 'DEV-EXEC-v1.1.md'), 'legacy body\n');

    const out = computeGetEvidence(env.projectDir, 'exec') as Payload;
    expect(out.present).toBe(true);
    expect(out.path).toBe('Sigma/build/DEV-EXEC-v1.1.md');
  });

  // R-B2-04 — the first version of this tool left a non-regular file at the
  // canonical path as present:false instead of failing closed. A directory
  // sitting exactly at Sigma/evidence/DEV-EXEC-v1.1.md is "openable" but is
  // not the artifact it claims to be — same posture sigma_read_artifact
  // already had via the shared readCanonicalArtifactFile() routine.
  it('refuses (BOUNDARY_VIOLATION), rather than reporting present:false, when the canonical path is a directory', () => {
    const env = project('MINE', makeChainWithLockedExec());
    const execPath = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md');
    fs.ensureDirSync(execPath); // a directory, not a file, at the exact canonical path

    expect(() => computeGetEvidence(env.projectDir, 'exec')).toThrow(/BOUNDARY_VIOLATION|not a regular file/);
  });

  it('refuses a file above the read/hash size limit rather than silently omitting the hash', () => {
    const env = project('MINE', makeChainWithLockedExec());
    const execPath = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md');
    fs.ensureDirSync(path.dirname(execPath));
    fs.writeFileSync(execPath, Buffer.alloc(512 * 1024 + 1, 'a'));

    expect(() => computeGetEvidence(env.projectDir, 'exec')).toThrow(/PAYLOAD_TOO_LARGE|byte read limit/);
  });
});

// ── Transport-level: binding isolation + non-mutation ───────────────────────

describe('Stage B2 — transport-level binding and non-mutation', () => {
  it('a bound query session serves sigma_get_evidence with the standard envelope', async () => {
    const env = project('MINE', makeChainWithLockedExec());
    const execPath = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md');
    fs.ensureDirSync(path.dirname(execPath));
    fs.writeFileSync(execPath, '# DEV-EXEC v1.1\n\nbody\n');
    bindFromArgv(['--mode', 'query', '--project-root', env.projectDir, '--project-id', 'MINE']);

    const { client, close } = await connected();
    try {
      const evidence = await call(client, 'sigma_get_evidence', { type: 'exec' });
      expect(evidence.isError).toBe(false);
      expect(evidence.payload.contract_version).toBe('1.0');
      expect(evidence.payload.tool).toBe('sigma_get_evidence');
      expect(evidence.payload.present).toBe(true);
    } finally {
      await close();
    }
  });

  it('every Stage B2 query leaves the governance tree byte-identical', async () => {
    const env = project('MINE', makeChainWithLockedExec());
    const execPath = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md');
    fs.ensureDirSync(path.dirname(execPath));
    fs.writeFileSync(execPath, '# DEV-EXEC v1.1\n\nbody\n');
    bindFromArgv(['--mode', 'query', '--project-root', env.projectDir, '--project-id', 'MINE']);

    const before = governanceHashes(env.projectDir);
    const { client, close } = await connected();
    try {
      await call(client, 'sigma_get_evidence', { type: 'exec' });
    } finally {
      await close();
    }
    expect(governanceHashes(env.projectDir)).toEqual(before);
  });
});
