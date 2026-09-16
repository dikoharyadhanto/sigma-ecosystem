// Stage B2 — sigma_check_document test contract. First B2 primitive: five
// CLI check commands (intent/roadmap/plan/exec/close) collapsed into one
// typed tool because their implementation is one shared pipeline
// (validateSigmaDocFile -> SigmaDocCheckReport) — see
// src/mcp/tools/checkDocument.ts's header. Covers: per-type target
// resolution (single-object vs array-with-ambiguity-guard), the
// absolute-path redaction property (SigmaDocCheckReport.file is a host
// path — this is the one thing that differs from a plain CLI port), and
// non-mutation.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildServer, bindFromArgv } from '../src/mcp/index';
import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { computeCheckDocument } from '../src/mcp/tools/checkDocument';

import {
  setupTestEnv,
  writeChainFixture,
  stubProjectIdentity,
  makeChain,
  makeChainWithLockedIntent,
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

function setVerifiedBinding(root: string, projectId = 'TEST'): void {
  const binding: Binding = {
    mode: 'query', kind: 'verified', root, projectId,
    rootFingerprint: fingerprintRoot(root), role: null, verified: true,
  };
  setBinding(binding);
}

function writeIntentFile(env: TestEnv, version = 'v1', content = '# DIR-INTENT v1\n\nbody\n'): void {
  const abs = path.join(env.projectDir, 'Sigma', 'charter', `DIR-INTENT-${version}.md`);
  fs.ensureDirSync(path.dirname(abs));
  fs.writeFileSync(abs, content);
}

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

describe('sigma_check_document — single-object types (intent, roadmap, close)', () => {
  it('checks the active DIR-INTENT and reports validation results', () => {
    const env = project('MINE', makeChain('v1'));
    writeIntentFile(env, 'v1');
    const out = computeCheckDocument(env.projectDir, 'intent') as Payload;
    expect(out.type).toBe('intent');
    expect(out.version).toBe('v1');
    expect(out).toHaveProperty('ok');
    expect(out).toHaveProperty('requirements');
    expect(Array.isArray(out.errors)).toBe(true);
  });

  it('rejects a version that does not match the active intent', () => {
    const env = project('MINE', makeChain('v1'));
    writeIntentFile(env, 'v1');
    expect(() => computeCheckDocument(env.projectDir, 'intent', 'v9')).toThrow(/not found|v9/);
  });

  it('rejects roadmap check when no ROADMAP exists on the chain', () => {
    const env = project('MINE', makeChainWithLockedIntent('v1')); // roadmap: null
    expect(() => computeCheckDocument(env.projectDir, 'roadmap')).toThrow(/No ROADMAP/);
  });

  it('rejects close check when no CLOSE exists on the chain', () => {
    const env = project('MINE', makeChainWithLockedIntent('v1')); // close: null
    expect(() => computeCheckDocument(env.projectDir, 'close')).toThrow(/No CLOSE/);
  });
});

describe('sigma_check_document — array types (plan, exec): ambiguity guard and active-version default', () => {
  function chainWithTwoDraftPlans(): object {
    const now = new Date().toISOString();
    const base = makeChainWithLockedIntent('v1') as Record<string, unknown>;
    base.roadmap = { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, locked_at: now };
    base.plan = {
      active_version: null, active_state: null, pending: [],
      versions: [
        { version: 'v0.1', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v0.1.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
        { version: 'v0.2', state: 'DRAFT', file: 'Sigma/contract/FMN-PLAN-v0.2.md', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    };
    return base;
  }

  it('rejects an implicit plan check when more than one DRAFT is open', () => {
    const env = project('MINE', chainWithTwoDraftPlans());
    expect(() => computeCheckDocument(env.projectDir, 'plan')).toThrow(/DRAFT FMN-PLANs are open/);
  });

  it('an explicit version bypasses the ambiguity guard', () => {
    const env = project('MINE', chainWithTwoDraftPlans());
    const abs = path.join(env.projectDir, 'Sigma', 'contract', 'FMN-PLAN-v0.1.md');
    fs.ensureDirSync(path.dirname(abs));
    fs.writeFileSync(abs, '# FMN-PLAN v0.1\n\nbody\n');
    const out = computeCheckDocument(env.projectDir, 'plan', 'v0.1') as Payload;
    expect(out.version).toBe('v0.1');
  });

  it('defaults to the active exec version when unambiguous', () => {
    const env = project('MINE', makeChainWithLockedExec('v1', 'v1.1'));
    const abs = path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md');
    fs.ensureDirSync(path.dirname(abs));
    fs.writeFileSync(abs, '# DEV-EXEC v1.1\n\nbody\n');
    const out = computeCheckDocument(env.projectDir, 'exec') as Payload;
    expect(out.version).toBe('v1.1');
  });

  it('rejects an unknown explicit exec version', () => {
    const env = project('MINE', makeChainWithLockedExec('v1', 'v1.1'));
    expect(() => computeCheckDocument(env.projectDir, 'exec', 'v9.9')).toThrow(/not found/);
  });
});

describe('sigma_check_document — absolute path redaction', () => {
  it('on an unverified binding, file is left as-is (legacy client behaviour, no path leaked beyond what pre-Stage-A clients already saw)', () => {
    const env = project('MINE', makeChain('v1'));
    writeIntentFile(env, 'v1');
    // binding reset to unverified default in beforeEach
    const out = computeCheckDocument(env.projectDir, 'intent') as Payload;
    expect(typeof out.file).toBe('string');
  });

  it('on a verified binding, file is redacted to a project-relative path, never the host absolute path', () => {
    const env = project('MINE', makeChain('v1'));
    writeIntentFile(env, 'v1');
    setVerifiedBinding(env.projectDir, 'MINE');
    const out = computeCheckDocument(env.projectDir, 'intent') as Payload;
    expect(out.file).toBe('Sigma/charter/DIR-INTENT-v1.md');
    expect(out.file).not.toContain(env.projectDir);
  });
});

describe('sigma-control — sigma_check_document through a real in-process MCP client', () => {
  it('serves a standard envelope and reports lock-readiness verdict fields', async () => {
    const env = project('MINE', makeChain('v1'));
    writeIntentFile(env, 'v1');
    bindFromArgv(['--mode', 'query', '--project-root', env.projectDir, '--project-id', 'MINE']);

    const { client, close } = await connected();
    try {
      const res = await call(client, 'sigma_check_document', { type: 'intent' });
      expect(res.isError).toBe(false);
      expect(res.payload.contract_version).toBe('1.0');
      expect(res.payload.tool).toBe('sigma_check_document');
      expect(res.payload.type).toBe('intent');
      expect(res.payload.file).toBe('Sigma/charter/DIR-INTENT-v1.md');
    } finally {
      await close();
    }
  });

  it('leaves the governance tree byte-identical after a check call', async () => {
    const env = project('MINE', makeChain('v1'));
    writeIntentFile(env, 'v1');
    bindFromArgv(['--mode', 'query', '--project-root', env.projectDir, '--project-id', 'MINE']);
    const before = governanceHashes(env.projectDir);

    const { client, close } = await connected();
    try {
      await call(client, 'sigma_check_document', { type: 'intent' });
    } finally {
      await close();
    }

    expect(governanceHashes(env.projectDir)).toEqual(before);
  });
});
