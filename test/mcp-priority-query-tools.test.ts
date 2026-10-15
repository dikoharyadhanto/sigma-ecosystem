import { describe, it, expect, afterEach } from 'vitest';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildServer } from '../src/mcp/index';
import { buildControlServer } from '../src/mcp/control/index';
import {
  runCli, setupTestEnv, stubProjectIdentity, stubProjectRootAnchor, writeChainFixture, writeProductReview,
  makeChainWithLockedIntent, makeChainWithLockedExec, validIntentDocV5, validPlanDocV3, TestEnv,
} from './helpers';
import { setupGitProject, editIntent, sha256 } from './f05-git-helpers';
import {
  createInitialChain, ratifyIntent, certifyIntentDoc, registerPlanDraft, writeChain, writeActivateStatus,
} from '../src/engine/chain';
import { writeChainMetadata } from '../src/engine/numbering';
import { withGovernanceTransaction } from '../src/engine/governanceTransaction';
import { approveArtifactUseCase, approveArtifactTransactionFiles } from '../src/services/approvalService';
import { revisionPaths, boundedPath, preparePlanRevision, checkPlanRevision } from '../src/engine/revisions';

// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — Phase 2 (WP-MCP-03).
// TC-MCP-03 (plane), TC-MCP-04 (query immutability), TC-MCP-05 (close
// semantics) for the seven priority query tools. Every behavioural test is
// differential: the MCP tool is compared with the CLI command it mirrors, run
// against the same fixture.

type Payload = Record<string, any>;

const envs: Array<{ cleanup: () => void }> = [];
const cwd = process.cwd();
const clients: Client[] = [];
afterEach(async () => {
  process.chdir(cwd);
  for (const c of clients.splice(0)) await c.close().catch(() => undefined);
  for (const e of envs.splice(0)) e.cleanup();
});

// runCli drops stderr on success; the notes warnings are stderr-only.
function cliStderr(args: string[], cwd: string, homeDir: string): string {
  const r = spawnSync('node', [path.resolve(__dirname, '..', 'dist', 'cli.js'), ...args], {
    cwd, encoding: 'utf8', env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
  });
  return r.stderr ?? '';
}

// The one write a semantic CLI command makes on its own: its operation-log entry.
const LOG = '+ Sigma/logs/operations.jsonl';
const onlyLog = (changes: string[]) => changes.filter((c) => c !== LOG);

function track<T extends { cleanup: () => void }>(e: T): T { envs.push(e); return e; }

async function connect(server = buildServer()): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'priority-query-tools', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  clients.push(client);
  return client;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<{ error: boolean; payload: Payload; raw: string }> {
  const res = await client.callTool({ name, arguments: args });
  const raw = (res.content as Array<{ type: string; text: string }>)[0].text;
  return { error: res.isError === true, payload: JSON.parse(raw) as Payload, raw };
}

// Hash of every file under `root` (path + bytes) — .git included.
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) out.set(path.relative(root, abs), crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'));
    }
  };
  walk(root);
  return out;
}

function diff(before: Map<string, string>, after: Map<string, string>): string[] {
  const changed: string[] = [];
  for (const [k, v] of after) {
    if (!before.has(k)) changed.push(`+ ${k}`);
    else if (before.get(k) !== v) changed.push(`~ ${k}`);
  }
  for (const k of before.keys()) if (!after.has(k)) changed.push(`- ${k}`);
  return changed.sort();
}

/** Runs `fn` and asserts the project tree is byte-identical afterwards. */
async function expectPure(root: string, fn: () => Promise<void>): Promise<void> {
  const before = snapshot(root);
  await fn();
  expect(diff(before, snapshot(root)), 'a query tool changed the project').toEqual([]);
}

function lockedExecProject(): TestEnv {
  const env = track(setupTestEnv());
  stubProjectRootAnchor(env);
  writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
  return env;
}

const NEW_TOOLS = [
  'sigma_review_check', 'sigma_close_check', 'sigma_dev_status', 'sigma_notes_list',
  'sigma_intent_baseline_check', 'sigma_intent_amendment_preview', 'sigma_plan_revise_check',
];

describe('TC-MCP-03 plane enforcement', () => {
  it('registers the seven tools on the query plane only, all read-only annotated', async () => {
    const query = await connect(buildServer());
    const { tools } = await query.listTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    for (const name of NEW_TOOLS) {
      expect(byName.has(name), `${name} missing from the query server`).toBe(true);
      expect(byName.get(name)!.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
    }
    const control = await connect(buildControlServer());
    const controlNames = new Set((await control.listTools()).tools.map((t) => t.name));
    for (const name of NEW_TOOLS) expect(controlNames.has(name), `${name} leaked onto the control plane`).toBe(false);
  });

  it('answers active:false in a directory that is not a Sigma project, and writes nothing', async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-priority-bare-'));
    envs.push({ cleanup: () => fs.removeSync(bare) });
    process.chdir(bare);
    const client = await connect();
    for (const name of NEW_TOOLS) {
      const args = name === 'sigma_plan_revise_check' ? { version: 'v1.1' } : {};
      const { payload } = await call(client, name, args);
      expect(payload.active, name).toBe(false);
    }
    expect(fs.readdirSync(bare)).toEqual([]);
  });
});

describe('sigma_review_check', () => {
  it('matches `sigma review check` and never writes', async () => {
    const env = lockedExecProject();
    process.chdir(env.projectDir);
    const client = await connect();

    const missing = await call(client, 'sigma_review_check');
    expect(missing.error).toBe(true);
    expect(missing.payload.error.code).toBe('INVALID_OPERATION');
    expect(missing.payload.error.message).toMatch(/No PRODUCT REVIEW found/);

    for (const verdicts of [{ aud: 'REVISE' }, {}]) {
      writeProductReview(env, verdicts);
      const cli = runCli('review check', env.projectDir, env.homeDir);
      await expectPure(env.projectDir, async () => {
        const { payload, raw, error } = await call(client, 'sigma_review_check');
        expect(error).toBe(false);
        expect(payload.ok).toBe(cli.exitCode === 0);
        expect(payload.document_type).toBe('PRODUCT_REVIEW');
        expect(payload.file).toBe(path.join('Sigma', 'review', 'PRODUCT-REVIEW-v1.md'));
        expect(raw, 'host path leaked').not.toContain(env.projectDir);
      });
    }
  });
});

describe('sigma_close_check', () => {
  const scenarios: Array<{ name: string; review?: Parameters<typeof writeProductReview>[1]; eligible: boolean; readiness: string }> = [
    { name: 'no PRODUCT REVIEW', eligible: false, readiness: 'not_eligible' },
    { name: 'a party says REVISE', review: { arc: 'PASS', aud: 'REVISE', director: 'PASS' }, eligible: false, readiness: 'not_eligible' },
    { name: 'every party PASS', review: {}, eligible: true, readiness: 'eligible' },
    {
      name: 'PASS_WITH_RISK with the audit skipped',
      review: { arc: 'PASS', aud: 'SKIP_FOR_AUDIT', director: 'PASS_WITH_RISK', risks: { director: 'Operator training is not covered.' } },
      eligible: true, readiness: 'eligible_with_pass_with_risk',
    },
  ];

  it.each(scenarios)('TC-MCP-05: follows Gate 3 and the review, same as the CLI — $name', async ({ review, eligible, readiness }) => {
    const env = lockedExecProject();
    if (review) writeProductReview(env, review);
    process.chdir(env.projectDir);
    const cli = runCli('close check', env.projectDir, env.homeDir);
    const client = await connect();

    await expectPure(env.projectDir, async () => {
      const { payload, error } = await call(client, 'sigma_close_check');
      expect(error).toBe(false);
      expect(payload.eligible).toBe(eligible);
      expect(payload.eligible).toBe(cli.exitCode === 0);
      expect(payload.closure_readiness).toBe(readiness);
      expect(payload.gate_3_satisfied).toBe(true);
      expect(payload.product_review.file !== null).toBe(review !== undefined);
      if (!eligible) expect(payload.blockers.length).toBeGreaterThan(0);
      if (readiness === 'eligible_with_pass_with_risk') {
        expect(payload.risk_notes).toEqual([{ party: 'Director', notes: ['Operator training is not covered.'] }]);
        expect(payload.product_review.verdicts.aud).toBe('SKIP_FOR_AUDIT');
      }
    });
  });

  it('reports Gate 3 as blocked when work is open, whatever the review says', async () => {
    const env = track(setupTestEnv());
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    writeProductReview(env);
    process.chdir(env.projectDir);
    const client = await connect();
    const { payload } = await call(client, 'sigma_close_check');
    expect(payload.eligible).toBe(false);
    expect(payload.gate_3_satisfied).toBe(false);
    expect(payload.blockers[0].message).toMatch(/GATE 3 BLOCKED/);
  });

  it('AC-MCP-07: is not sigma_check_document(type=close)', async () => {
    const env = lockedExecProject();
    writeProductReview(env);
    process.chdir(env.projectDir);
    const client = await connect();

    // No CLOSE document exists. The document checker has nothing to validate…
    const doc = await call(client, 'sigma_check_document', { type: 'close' });
    expect(doc.error).toBe(true);
    // …while close_check still answers, from the gate and the review.
    const check = await call(client, 'sigma_close_check');
    expect(check.error).toBe(false);
    expect(check.payload.eligible).toBe(true);
  });
});

describe('sigma_dev_status', () => {
  it('matches `sigma dev status` through INACTIVE, ACTIVE, and ACTIVE_DEGRADED', async () => {
    const env = track(setupTestEnv());
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    process.chdir(env.projectDir);
    const client = await connect();

    const stateOf = async () => {
      const cli = runCli('dev status', env.projectDir, env.homeDir);
      let mcp: Payload = {};
      await expectPure(env.projectDir, async () => { mcp = (await call(client, 'sigma_dev_status')).payload; });
      expect(cli.stdout).toContain(`DEV workspace: ${mcp.state}`);
      return mcp;
    };

    expect((await stateOf()).state).toBe('INACTIVE');
    expect(runCli('dev create-workspace', env.projectDir, env.homeDir).exitCode).toBe(0);
    expect((await stateOf()).state).toBe('ACTIVE');
    fs.removeSync(path.join(env.projectDir, 'dev', '.sigma-workspace.json'));
    const degraded = await stateOf();
    expect(degraded.state).toBe('ACTIVE_DEGRADED');
    expect(degraded.degraded_reason).toBe('MARKER_MISSING');
    expect(degraded.guidance.join(' ')).toMatch(/Restrictions still apply/);
  });
});

describe('sigma_notes_list', () => {
  it('mirrors `sigma notes list` as is, warnings included, and never writes', async () => {
    const env = track(setupTestEnv());
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    process.chdir(env.projectDir);
    const client = await connect();

    const empty = await call(client, 'sigma_notes_list');
    expect(empty.payload.notes).toEqual([]);

    for (const title of ['Alpha plan', 'Beta review']) {
      expect(runCli(`notes new --title "${title}"`, env.projectDir, env.homeDir).exitCode).toBe(0);
    }
    fs.outputFileSync(path.join(env.projectDir, 'Sigma', 'notes', 'stray.md'), '# stray\n');
    fs.outputFileSync(path.join(env.projectDir, 'Sigma', 'notes', 'data.bin'), 'x');

    const cli = runCli('notes list', env.projectDir, env.homeDir);
    await expectPure(env.projectDir, async () => {
      const { payload } = await call(client, 'sigma_notes_list');
      expect(payload.notes.map((n: Payload) => n.id)).toEqual(
        cli.stdout.split('\n').filter(Boolean).map((l) => l.split(/\s+/)[0]),
      );
      expect(payload.notes.map((n: Payload) => n.title).sort()).toEqual(['Alpha plan', 'Beta review']);
      // The CLI warns about both; the tool carries the same two warnings.
      const warned = cliStderr(['notes', 'list'], env.projectDir, env.homeDir);
      expect(warned).toMatch(/non-Markdown/);
      expect(warned).toMatch(/not registered notes/);
      expect(payload.warnings.non_markdown).toEqual(['data.bin']);
      expect(payload.warnings.unregistered).toEqual(['stray.md']);
    });

    const filtered = await call(client, 'sigma_notes_list', { search: 'alpha' });
    expect(filtered.payload.notes.map((n: Payload) => n.title)).toEqual(['Alpha plan']);
  });

  it('refuses an unreadable registry with the CLI explanation', async () => {
    const env = track(setupTestEnv());
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.outputFileSync(path.join(env.projectDir, 'Sigma', 'notes-registry.json'), '{ not json');
    process.chdir(env.projectDir);
    const client = await connect();
    const { error, payload, raw } = await call(client, 'sigma_notes_list');
    expect(error).toBe(true);
    expect(payload.error.code).toBe('INVALID_OPERATION');
    expect(payload.error.message).toMatch(/unreadable/);
    expect(raw).not.toContain(env.projectDir);
  });
});

describe('sigma_intent_baseline_check and sigma_intent_amendment_preview', () => {
  it('matches the CLI on a clean baseline and after an uncommitted edit, writing nothing', async () => {
    const p = setupGitProject(track(setupTestEnv()));
    envs.push({ cleanup: p.cleanup });
    process.chdir(p.projectDir);
    const client = await connect();
    const cli = (args: string) => runCli(args, p.projectDir, p.env.homeDir);

    await expectPure(p.repoDir, async () => {
      const clean = await call(client, 'sigma_intent_baseline_check');
      expect(clean.payload.ok).toBe(true);
      expect(cli('intent baseline check').exitCode).toBe(0);
      expect(clean.raw).not.toContain(p.repoDir);
    });

    editIntent(p);
    await expectPure(p.repoDir, async () => {
      const dirty = await call(client, 'sigma_intent_baseline_check');
      expect(cli('intent baseline check').exitCode).toBe(1);
      expect(dirty.payload.ok).toBe(false);
      const failed = dirty.payload.checks.filter((c: Payload) => !c.ok && c.blocking).map((c: Payload) => c.id);
      expect(failed).toEqual(expect.arrayContaining(['worktree_clean', 'certified_matches_file']));
      expect(dirty.raw).not.toContain(p.repoDir);
    });
  });

  it('previews the amendment: same hash as the CLI, a diff, and no amendment or tag', async () => {
    const p = setupGitProject(track(setupTestEnv()));
    envs.push({ cleanup: p.cleanup });
    editIntent(p);
    process.chdir(p.projectDir);
    const client = await connect();
    const cli = runCli('intent amendment preview', p.projectDir, p.env.homeDir);
    const cliHash = cli.stdout.match(/SHA-256 \(use as --doc-sha256 after approval\): ([0-9a-f]{64})/)![1];

    await expectPure(p.repoDir, async () => {
      const { payload, error, raw } = await call(client, 'sigma_intent_amendment_preview');
      expect(error).toBe(false);
      expect(payload.doc_sha256_to_approve).toBe(cliHash);
      expect(payload.doc_sha256_to_approve).toBe(sha256(fs.readFileSync(p.intentFile)));
      expect(payload.next_amendment_id).toBe('AMD-001');
      expect(payload.next_tag).toBe('sigma/intent-v1-amd-001');
      expect(payload.diff.patch.length).toBeGreaterThan(0);
      expect(payload.diff.patch_truncated).toBe(false);
      expect(payload.impact).toHaveProperty('next_revision');
      expect(raw).not.toContain(p.repoDir);
    });
  });

  it('reports a project without Git as a finding with no host path', async () => {
    const p = setupGitProject(track(setupTestEnv()), { noGit: true });
    envs.push({ cleanup: p.cleanup });
    process.chdir(p.projectDir);
    const client = await connect();
    const { payload, error, raw } = await call(client, 'sigma_intent_baseline_check');
    expect(error).toBe(false);
    expect(payload.ok).toBe(false);
    expect(payload.checks.find((c: Payload) => c.id === 'git_repository' && !c.ok)).toBeTruthy();
    expect(raw).not.toContain(p.projectDir);
  });
});

describe('sigma_plan_revise_check', () => {
  async function approvedPlan(): Promise<{ env: TestEnv; root: string; version: string }> {
    const env = track(setupTestEnv());
    stubProjectIdentity(env);
    const root = env.projectDir;
    const version = 'v1.1';
    const intentFile = path.join(root, 'Sigma/charter/DIR-INTENT-v1.md');
    fs.outputFileSync(intentFile, validIntentDocV5('v1'));
    const chain = createInitialChain('v1', 'Sigma/charter/DIR-INTENT-v1.md', undefined, undefined, 'intent_aligned', 'paired_approval');
    writeChainMetadata(intentFile, chain);
    ratifyIntent(chain);
    certifyIntentDoc(chain, intentFile);
    registerPlanDraft(chain, version, `Sigma/contract/FMN-PLAN-${version}.md`, 'v1');
    const planFile = path.join(root, `Sigma/contract/FMN-PLAN-${version}.md`);
    fs.outputFileSync(planFile, validPlanDocV3(version));
    writeChainMetadata(planFile, chain);
    writeChain(root, 'v1', chain);
    writeActivateStatus(root, 'v1');
    await withGovernanceTransaction(root, 'plan_approve', () => approveArtifactTransactionFiles(root, 'plan', version), () => approveArtifactUseCase(root, 'plan', version));
    return { env, root, version };
  }

  async function stage(root: string, version: string, loosening: boolean): Promise<void> {
    const p = revisionPaths(version);
    await withGovernanceTransaction(root, 'revision_prepare', () => [boundedPath(root, p.candidate), boundedPath(root, p.staging)],
      () => preparePlanRevision(root, version, { checkpoint: 'pre-build', loosening, reason: 'AC correction', requested_by: 'FMN', delta: 'Change AC-001' }));
    const candidate = boundedPath(root, p.candidate);
    let text = fs.readFileSync(candidate, 'utf8').replace('Test criteria.', 'Revised criteria.');
    text = text.replace('<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->',
      '<!-- SIGMA:FMN_PLAN:SECTION:CONTRACT_CHANGES -->\n## Contract Changes\n\n| No | Checkpoint | What Changed | Reason | Requested By | Loosening? | Director Approval |\n|:--|:--|:--|:--|:--|:--|:--|\n| 1 | pre-build | Change AC-001 | AC correction | FMN | '
      + (loosening ? 'Yes' : 'No') + ' | Review package |\n\n<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->');
    fs.writeFileSync(candidate, text);
  }

  it('explains a missing staging candidate as INVALID_OPERATION without a host path', async () => {
    const { root, version } = await approvedPlan();
    process.chdir(root);
    const client = await connect();
    const { error, payload, raw } = await call(client, 'sigma_plan_revise_check', { version });
    expect(error).toBe(true);
    expect(payload.error.code).toBe('INVALID_OPERATION');
    expect(raw).not.toContain(root);
  });

  it.each([false, true])('returns the engine review and issues no ticket (loosening=%s)', async (loosening) => {
    const { root, version } = await approvedPlan();
    await stage(root, version, loosening);
    process.chdir(root);
    const client = await connect();
    const engine = checkPlanRevision(root, version);

    await expectPure(root, async () => {
      const { payload, error, raw } = await call(client, 'sigma_plan_revise_check', { version });
      expect(error).toBe(false);
      expect(payload.version).toBe(version);
      expect(payload.candidate_sha256).toBe(engine.candidate_sha256);
      expect(payload.dependencies_sha256).toBe(engine.dependencies_sha256);
      expect(payload.early_approval_required).toBe(engine.early_approval_required);
      expect(payload.early_approval_required).toBe(loosening);
      expect(raw).not.toContain(root);
    });
  });

  it('CLI: only `plan revise ticket` (and the deprecated flag) writes a ticket; `check` does not', async () => {
    const { env, root, version } = await approvedPlan();
    await stage(root, version, false);
    const run = (args: string) => runCli(args, root, env.homeDir);

    const before = snapshot(root);
    expect(run(`plan revise check --v ${version}`).exitCode).toBe(0);
    expect(onlyLog(diff(before, snapshot(root))), 'plain check must write nothing but its log entry').toEqual([]);

    const afterTicket = snapshot(root);
    const ticket = run(`plan revise ticket --v ${version}`);
    expect(ticket.exitCode, ticket.stderr).toBe(0);
    // One ticket plus its control-store audit entry — nothing else.
    const created = onlyLog(diff(afterTicket, snapshot(root))).filter((l) => l.startsWith('+ '));
    expect(created.length, created.join('\n')).toBeGreaterThanOrEqual(1);
    expect(created.filter((l) => !l.includes('.mcp-control')), 'ticket issuance wrote outside the control store').toEqual([]);
    expect(JSON.parse(ticket.stdout.slice(ticket.stdout.indexOf('{'))).operation_ticket_id).toMatch(/^opt/);

    const aliasBase = snapshot(root);
    const alias = run(`plan revise check --v ${version} --prepare-ticket`);
    expect(alias.exitCode, alias.stderr).toBe(0);
    const aliasCreated = onlyLog(diff(aliasBase, snapshot(root))).filter((l) => l.startsWith('+ '));
    expect(aliasCreated.length).toBeGreaterThanOrEqual(1);
    expect(aliasCreated.filter((l) => !l.includes('.mcp-control'))).toEqual([]);
  });
});
