import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildControlServer } from '../src/mcp/control/index';
import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { fingerprintRoot } from '../src/mcp/binding';
import {
  setupTestEnv, stubProjectIdentity, validIntentDocV5, validPlanDocV3, validExecDocV3, validExecDocV4, runCli, TestEnv,
} from './helpers';
import {
  createInitialChain, ratifyIntent, certifyIntentDoc, registerPlanDraft, registerExecDraft, writeChain, writeActivateStatus, readActiveChain, chainFilePath,
} from '../src/engine/chain';
import { writeChainMetadata } from '../src/engine/numbering';
import { withGovernanceTransaction } from '../src/engine/governanceTransaction';
import { approveArtifactUseCase, approveArtifactTransactionFiles } from '../src/services/approvalService';
import { acknowledgePlan } from '../src/engine/revisions';
import { readTicket, writeApproval, generateId } from '../src/engine/controlStore';
import { createDevWorkspace } from '../src/engine/devWorkspace';
import { validateSigmaDocFile } from '../src/utils/docCheck';
import {
  readChangelogSection,
  addChangelogEntries,
  recordChangelogForLockedExec,
  planChangelogCreation,
  ensureChangelogFile,
  changelogSkipMessage,
  NO_PRODUCT_CHANGES,
} from '../src/services/changelogService';

const envs: TestEnv[] = [];
afterEach(() => {
  resetBindingForTest();
  for (const e of envs.splice(0)) e.cleanup();
});

const V = 'v1.1';
const SKIP_TAIL = 'so it was skipped. Update the changelog manually first, then resolve this issue; otherwise the next changelog record will fail again.';

function project() {
  const env = setupTestEnv();
  envs.push(env);
  stubProjectIdentity(env);
  return { env, root: env.projectDir };
}

/** A chain with an APPROVED PLAN and a DRAFT, acknowledged EXEC ready for approval. */
async function readyExec(execDoc: (v: string) => string = v => validExecDocV4(v, v, 'READY_FOR_APPROVAL')) {
  const { env, root } = project();
  const c = createInitialChain('v1', 'Sigma/charter/DIR-INTENT-v1.md', undefined, undefined, 'intent_aligned');
  const intent = path.join(root, c.intent.file!);
  fs.writeFileSync(intent, validIntentDocV5('v1'));
  writeChainMetadata(intent, c);
  ratifyIntent(c);
  certifyIntentDoc(c, intent);
  registerPlanDraft(c, V, 'Sigma/contract/FMN-PLAN-' + V + '.md', 'v1');
  const planFile = path.join(root, c.plan.versions[0].file!);
  fs.writeFileSync(planFile, validPlanDocV3(V));
  writeChainMetadata(planFile, c);
  c.roadmap = { version: 'v1', state: 'DRAFT', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  fs.outputFileSync(path.join(root, c.roadmap.file!), ['<!-- SIGMA:DOC type=ROADMAP schema=1 -->', '# ROADMAP v1', '<!-- SIGMA:RENDER:START:stage-overview -->', '<!-- SIGMA:ROADMAP:SECTION:STAGE_OVERVIEW -->', '## 4. Stage Overview', 'Initial stages', '<!-- SIGMA:RENDER:END:stage-overview -->'].join('\n'));
  writeChainMetadata(path.join(root, c.roadmap.file!), c);
  writeChain(root, 'v1', c);
  writeActivateStatus(root, 'v1');
  await approve(root, 'plan');
  const d = readActiveChain(root).data;
  registerExecDraft(d, V, 'Sigma/evidence/DEV-EXEC-' + V + '.md', V);
  const execFile = path.join(root, d.exec.versions[0].file!);
  fs.writeFileSync(execFile, execDoc(V));
  writeChainMetadata(execFile, d, V);
  writeChain(root, 'v1', d);
  await withGovernanceTransaction(root, 'ack', () => [chainFilePath(root, 'v1')], () => acknowledgePlan(root, V, 1));
  return { env, root, execFile };
}

function approve(root: string, domain: 'plan' | 'exec') {
  return withGovernanceTransaction(root, 'approve', () => approveArtifactTransactionFiles(root, domain, V), () => approveArtifactUseCase(root, domain, V));
}

async function lockedExec(execDoc?: (v: string) => string) {
  const ctx = await readyExec(execDoc);
  await approve(ctx.root, 'exec');
  return ctx;
}

const read = (root: string, rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('F17 changelog — EXEC Changelog section', () => {
  const section = (body: string) =>
    `<!-- SIGMA:DEV_EXEC:SECTION:BUILD_RESULT_AND_VERIFICATION -->\n## Build\n\nDone.\n\n<!-- SIGMA:DEV_EXEC:SECTION:CHANGELOG -->\n## Changelog\n\n> Guidance.\n\n${body}\n\n---\n\n<!-- SIGMA:DEV_EXEC:SECTION:DEVIATIONS_ISSUES_LIMITATIONS -->\n## Deviations\n`;

  it('reads a flat list and ignores guidance, headings and rules', () => {
    const r = readChangelogSection(section('- Added CSV export.\n* Faster table loading.'));
    expect(r).toEqual({ ok: true, entries: ['Added CSV export.', 'Faster table loading.'] });
  });

  it.each([
    ['placeholder', '- [...]', 'still contains the placeholder'],
    ['empty', '', 'is empty'],
    ['prose', 'We changed things.', 'not a flat list'],
    ['artifact reference', '- Implemented FMN-PLAN v1.1 scope.', 'Sigma artifact identity'],
    ['mixed statement', `${NO_PRODUCT_CHANGES}\n- Something.`, 'mixes'],
  ])('is not recordable: %s', (_name, body, reason) => {
    const r = readChangelogSection(section(body));
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain(reason);
  });

  it('treats the exact no-changes statement as a declared nothing-to-record', () => {
    expect(readChangelogSection(section(NO_PRODUCT_CHANGES))).toMatchObject({ ok: false, none: true });
  });

  it('reports a missing section', () => {
    expect(readChangelogSection('# nothing')).toMatchObject({ ok: false, reason: 'the DEV-EXEC has no Changelog section' });
  });
});

describe('F17 changelog — target file format', () => {
  it('starts an empty file', () => {
    expect(addChangelogEntries('', 'v1.1', ['A.', 'B.'])).toBe('## v1.1\n\n- A.\n- B.\n');
  });

  it('puts a newly locked version above earlier ones and keeps existing history', () => {
    const existing = '## v1.1\n\n- Old.\n';
    expect(addChangelogEntries(existing, 'v1.2', ['New.'])).toBe('## v1.2\n\n- New.\n\n## v1.1\n\n- Old.\n');
  });

  it('orders by recording, not by comparing version strings', () => {
    const existing = '## v1.10\n\n- Ten.\n';
    expect(addChangelogEntries(existing, 'v1.9', ['Nine.'])).toBe('## v1.9\n\n- Nine.\n\n## v1.10\n\n- Ten.\n');
  });

  it('appends to the group of a version that is already present', () => {
    const existing = '## v1.2\n\n- First.\n\n## v1.1\n\n- Old.\n';
    expect(addChangelogEntries(existing, 'v1.2', ['Second.'])).toBe('## v1.2\n\n- First.\n- Second.\n\n## v1.1\n\n- Old.\n');
  });

  it('refuses a file that is not in the version-heading format and never alters it', () => {
    expect(addChangelogEntries('# Changelog\n\nSome notes.\n', 'v1.1', ['A.'])).toBeNull();
    expect(addChangelogEntries('## 2026-10-14\n\n- Dated.\n', 'v1.1', ['A.'])).toBeNull();
  });

  it('preserves CRLF line endings', () => {
    expect(addChangelogEntries('## v1.1\r\n\r\n- Old.\r\n', 'v1.2', ['New.'])).toBe('## v1.2\r\n\r\n- New.\r\n\r\n## v1.1\r\n\r\n- Old.\r\n');
  });
});

describe('F17 changelog — document schema 4', () => {
  const check = (content: string) => {
    const { root } = project();
    const file = path.join(root, 'DEV-EXEC-v1.md');
    fs.writeFileSync(file, content);
    return validateSigmaDocFile(file, 'exec');
  };

  it('requires the Changelog section from schema 4 on', () => {
    expect(check(validExecDocV4('v1', 'v1')).errors).toEqual([]);
    const without = validExecDocV4('v1', 'v1').replace(/\n*<!-- SIGMA:DEV_EXEC:SECTION:CHANGELOG -->[\s\S]*$/, '\n');
    expect(check(without).errors).toContain('Missing required section marker: CHANGELOG');
  });

  it('does not require it on schema 3, which stays valid unchanged', () => {
    const report = check(validExecDocV3('v1', 'v1'));
    expect(report.schema).toBe('3');
    expect(report.errors).toEqual([]);
  });

  it('flags the Changelog section out of order', () => {
    const doc = validExecDocV4('v1', 'v1');
    const block = doc.match(/<!-- SIGMA:DEV_EXEC:SECTION:CHANGELOG -->[\s\S]*$/)![0];
    const moved = doc.replace(block, '').replace('<!-- SIGMA:DEV_EXEC:SECTION:DEVIATIONS_ISSUES_LIMITATIONS -->', block + '\n<!-- SIGMA:DEV_EXEC:SECTION:DEVIATIONS_ISSUES_LIMITATIONS -->');
    expect(check(moved).errors).toContain('Section order invalid');
  });

  it('accepts the Changelog as the last section, after Director Observation Report', () => {
    const report = check(validExecDocV4('v1', 'v1'));
    expect(report.passes).toContain('Section order valid');
  });
});

describe('F17 changelog — destination', () => {
  it('records into the root file and reports the version and count', async () => {
    const { root } = await lockedExec();
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    const outcome = recordChangelogForLockedExec(root, V);
    expect(outcome).toMatchObject({ status: 'recorded', file: 'CHANGE-RECORD.md', version: V, entries: 2 });
    const text = read(root, 'CHANGE-RECORD.md');
    expect(text).toBe('## v1.1\n\n- Added CSV export of results.\n- Fixed the area calculation at region borders.\n');
    expect(text).not.toMatch(/DEV-EXEC|PLAN/);
  });

  it('skips with the Director-specified message when no CHANGE-RECORD.md exists, and creates nothing', async () => {
    const { root } = await lockedExec();
    const outcome = recordChangelogForLockedExec(root, V);
    expect(outcome.status).toBe('skipped');
    expect((outcome as { message: string }).message).toBe(
      'Changelog was not recorded because no CHANGE-RECORD.md exists in the project root or in dev/, ' + SKIP_TAIL,
    );
    expect(fs.existsSync(path.join(root, 'CHANGE-RECORD.md'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'dev'))).toBe(false);
    expect(readActiveChain(root).data.exec.versions[0].state).toBe('LOCKED');
  });

  it('ignores CHANGE-RECORD.md anywhere else', async () => {
    const { root } = await lockedExec();
    fs.outputFileSync(path.join(root, 'docs', 'CHANGE-RECORD.md'), '');
    fs.outputFileSync(path.join(root, 'dev', 'sub', 'CHANGE-RECORD.md'), '');
    expect(recordChangelogForLockedExec(root, V).status).toBe('skipped');
  });

  it('with two files and an ACTIVE workspace uses dev/, leaving the root file untouched', async () => {
    const { root } = await lockedExec();
    createDevWorkspace(root);
    fs.writeFileSync(path.join(root, 'dev', 'CHANGE-RECORD.md'), '');
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '## v0.9\n\n- Root.\n');
    expect(recordChangelogForLockedExec(root, V)).toMatchObject({ status: 'recorded', file: 'dev/CHANGE-RECORD.md' });
    expect(read(root, 'CHANGE-RECORD.md')).toBe('## v0.9\n\n- Root.\n');
  });

  it('with two files and the workspace off uses the root file even though dev/CHANGE-RECORD.md exists', async () => {
    const { root } = await lockedExec();
    fs.outputFileSync(path.join(root, 'dev', 'CHANGE-RECORD.md'), '');
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    expect(recordChangelogForLockedExec(root, V)).toMatchObject({ status: 'recorded', file: 'CHANGE-RECORD.md' });
    expect(read(root, 'dev/CHANGE-RECORD.md')).toBe('');
  });

  it('with only one file present uses it, even when it is not the workspace default', async () => {
    const { root } = await lockedExec();
    createDevWorkspace(root);
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    expect(recordChangelogForLockedExec(root, V)).toMatchObject({ status: 'recorded', file: 'CHANGE-RECORD.md' });
  });

  it('skips when the dev workspace is degraded', async () => {
    const { root } = await lockedExec();
    createDevWorkspace(root);
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    fs.removeSync(path.join(root, 'dev', '.sigma-workspace.json'));
    const outcome = recordChangelogForLockedExec(root, V);
    expect(outcome).toMatchObject({ status: 'skipped' });
    expect((outcome as { reason: string }).reason).toContain('degraded');
    expect(read(root, 'CHANGE-RECORD.md')).toBe('');
  });

  it('skips on a symlink or directory destination', async () => {
    const { root } = await lockedExec();
    fs.writeFileSync(path.join(root, 'real.md'), '');
    fs.symlinkSync(path.join(root, 'real.md'), path.join(root, 'CHANGE-RECORD.md'));
    const outcome = recordChangelogForLockedExec(root, V);
    expect((outcome as { reason: string }).reason).toContain('not a regular file');
    expect(read(root, 'real.md')).toBe('');
  });

  it('skips and leaves the file alone when its format is not recognised', async () => {
    const { root } = await lockedExec();
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '# Changelog\n\nHand written.\n');
    const outcome = recordChangelogForLockedExec(root, V);
    expect((outcome as { reason: string }).reason).toContain('not in the expected format');
    expect(read(root, 'CHANGE-RECORD.md')).toBe('# Changelog\n\nHand written.\n');
  });

  it('skips an EXEC on the older template, naming the schema', async () => {
    const { root } = await lockedExec(v => validExecDocV3(v, v, 'READY_FOR_APPROVAL'));
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    const outcome = recordChangelogForLockedExec(root, V);
    expect((outcome as { reason: string }).reason).toContain('template schema 3');
    expect(read(root, 'CHANGE-RECORD.md')).toBe('');
  });

  it('records nothing and reports it for a declared no-change EXEC', async () => {
    const { root } = await lockedExec(v => validExecDocV4(v, v, 'READY_FOR_APPROVAL', NO_PRODUCT_CHANGES));
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    expect(recordChangelogForLockedExec(root, V)).toEqual({ status: 'no_changes' });
    expect(read(root, 'CHANGE-RECORD.md')).toBe('');
  });

  it('refuses to record for an EXEC that is not LOCKED', async () => {
    const { root } = await readyExec();
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    expect(recordChangelogForLockedExec(root, V)).toMatchObject({ status: 'skipped', reason: 'the DEV-EXEC is not in LOCKED state' });
    expect(read(root, 'CHANGE-RECORD.md')).toBe('');
  });

  it('never throws, even without a chain', () => {
    const { root } = project();
    expect(recordChangelogForLockedExec(root, V).status).toBe('skipped');
  });

  it('message wording is fixed', () => {
    expect(changelogSkipMessage('X')).toBe('Changelog was not recorded because X, ' + SKIP_TAIL);
  });
});

describe('F17 changelog — creation by project start / sync', () => {
  it('creates an empty root file when neither location has one, and never overwrites', () => {
    const { root } = project();
    expect(planChangelogCreation(root)).toMatchObject({ action: 'create', rel: 'CHANGE-RECORD.md' });
    expect(ensureChangelogFile(root)).toMatchObject({ created: true, rel: 'CHANGE-RECORD.md' });
    expect(read(root, 'CHANGE-RECORD.md')).toBe('');
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '## v0.9\n\n- Kept.\n');
    expect(ensureChangelogFile(root).created).toBe(false);
    expect(read(root, 'CHANGE-RECORD.md')).toBe('## v0.9\n\n- Kept.\n');
  });

  it('creates in dev/ when the workspace is ACTIVE', () => {
    const { root } = project();
    createDevWorkspace(root);
    expect(ensureChangelogFile(root)).toMatchObject({ created: true, rel: 'dev/CHANGE-RECORD.md' });
    expect(fs.existsSync(path.join(root, 'CHANGE-RECORD.md'))).toBe(false);
  });

  it('creates nothing when either location already has a file, or the workspace is degraded', () => {
    const a = project();
    fs.outputFileSync(path.join(a.root, 'dev', 'CHANGE-RECORD.md'), '');
    expect(ensureChangelogFile(a.root).created).toBe(false);
    expect(fs.existsSync(path.join(a.root, 'CHANGE-RECORD.md'))).toBe(false);

    const b = project();
    createDevWorkspace(b.root);
    fs.removeSync(path.join(b.root, 'dev', '.sigma-workspace.json'));
    expect(ensureChangelogFile(b.root).created).toBe(false);
  });
});

describe('F17 changelog — approve paths', () => {
  it('CLI: exec approve locks, then records, and re-running changes nothing', async () => {
    const { env, root } = await readyExec();
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    const preview = runCli(`exec approve --v ${V}`, root, env.homeDir);
    expect(preview.exitCode).toBe(0);
    expect(read(root, 'CHANGE-RECORD.md')).toBe('');

    const done = runCli(`exec approve --v ${V} --director-confirm`, root, env.homeDir);
    expect(done.exitCode).toBe(0);
    expect(done.stdout).toContain('Changelog: 2 entries recorded under v1.1');
    const once = read(root, 'CHANGE-RECORD.md');
    expect(once.match(/- Added CSV export of results\./g)).toHaveLength(1);

    const again = runCli(`exec approve --v ${V} --director-confirm`, root, env.homeDir);
    expect(again.exitCode).not.toBe(0);
    expect(read(root, 'CHANGE-RECORD.md')).toBe(once);
  });

  it('CLI: a skipped changelog warns but the lock and exit code are unaffected', async () => {
    const { env, root } = await readyExec();
    // runCli does not capture stderr on success; merge it so the warning can be read.
    const done = runCli(`exec approve --v ${V} --director-confirm 2>&1`, root, env.homeDir);
    expect(done.exitCode).toBe(0);
    expect(done.stdout).toContain('LOCKED');
    expect(done.stdout).toContain('Changelog was not recorded because no CHANGE-RECORD.md exists in the project root or in dev/, ' + SKIP_TAIL);
    expect(readActiveChain(root).data.exec.versions[0].state).toBe('LOCKED');
  });

  async function session(root: string) {
    setBinding({ mode: 'control', kind: 'verified', root, projectId: 'TEST', rootFingerprint: fingerprintRoot(root), role: 'DEV', verified: true });
    const server = buildControlServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'f17-test', version: '1' });
    await Promise.all([server.connect(st), client.connect(ct)]);
    return {
      async call(name: string, args: Record<string, unknown>) {
        const res = await client.callTool({ name, arguments: args });
        return { ok: res.isError !== true, payload: JSON.parse((res.content as Array<{ text: string }>)[0].text) };
      },
      close: () => client.close(),
    };
  }

  function director(root: string, ticket: string): string {
    const t = readTicket(root, ticket)!;
    const approval = generateId('appr');
    writeApproval(root, {
      approval_id: approval, project_id: t.project_id, operation_ticket_id: ticket, operation_id: t.operation_id, arguments_hash: t.arguments_hash,
      target_artifact: t.target!.artifact, target_version: t.target!.version, target_sha256: t.target!.sha256, expected_state_revision: t.expected_state_revision,
      decision: 'approve', reason: null, director_identity: 'test-director', authentication_method: 'local_cli', channel: 'cli',
      issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), consumed_at: null,
    });
    return approval;
  }

  it('MCP: commit records once after the lock; an idempotent replay does not record again', async () => {
    const { root } = await readyExec();
    fs.writeFileSync(path.join(root, 'CHANGE-RECORD.md'), '');
    const s = await session(root);
    try {
      const prepared = await s.call('sigma_prepare_exec_approve', { version: V, idempotency_key: 'p' });
      expect(prepared.ok).toBe(true);
      const ticket = prepared.payload.operation_ticket_id ?? prepared.payload.data?.operation_ticket_id;
      const approval = director(root, ticket);
      const args = { operation_ticket_id: ticket, approval_id: approval, idempotency_key: 'c' };
      const first = await s.call('sigma_commit_exec_approve', args);
      expect(first.ok).toBe(true);
      expect(JSON.stringify(first.payload)).toContain('Changelog: 2 entries recorded under v1.1');
      const once = read(root, 'CHANGE-RECORD.md');
      expect(once.match(/- Added CSV export of results\./g)).toHaveLength(1);

      const replay = await s.call('sigma_commit_exec_approve', args);
      expect(replay.ok).toBe(true);
      expect(read(root, 'CHANGE-RECORD.md')).toBe(once);
    } finally {
      await s.close();
    }
  });

  it('MCP: a skipped changelog does not fail the commit and says why', async () => {
    const { root } = await readyExec();
    const s = await session(root);
    try {
      const prepared = await s.call('sigma_prepare_exec_approve', { version: V, idempotency_key: 'p' });
      const ticket = prepared.payload.operation_ticket_id ?? prepared.payload.data?.operation_ticket_id;
      const approval = director(root, ticket);
      const result = await s.call('sigma_commit_exec_approve', { operation_ticket_id: ticket, approval_id: approval, idempotency_key: 'c' });
      expect(result.ok).toBe(true);
      expect(JSON.stringify(result.payload)).toContain('Changelog was not recorded because no CHANGE-RECORD.md exists');
      expect(readActiveChain(root).data.exec.versions[0].state).toBe('LOCKED');
    } finally {
      await s.close();
    }
  });
});

describe('F17 changelog — CLI creation', () => {
  it('project start creates an empty CHANGE-RECORD.md; --reinit keeps its content', () => {
    const env = setupTestEnv();
    envs.push(env);
    const started = runCli('project start --id TEST --name Test --confirm', env.projectDir, env.homeDir);
    expect(started.exitCode).toBe(0);
    expect(started.stdout).toContain('Changelog: CHANGE-RECORD.md created (empty).');
    expect(read(env.projectDir, 'CHANGE-RECORD.md')).toBe('');

    fs.writeFileSync(path.join(env.projectDir, 'CHANGE-RECORD.md'), '## v0.9\n\n- Kept.\n');
    const reinit = runCli('project start --id TEST --name Test --confirm --reinit', env.projectDir, env.homeDir);
    expect(reinit.exitCode).toBe(0);
    expect(reinit.stdout).not.toContain('Changelog:');
    expect(read(env.projectDir, 'CHANGE-RECORD.md')).toBe('## v0.9\n\n- Kept.\n');
  });

  it('project sync shows the creation in the dry run and performs it only with --confirm', () => {
    const env = setupTestEnv();
    envs.push(env);
    expect(runCli('project start --id TEST --name Test --confirm', env.projectDir, env.homeDir).exitCode).toBe(0);
    fs.removeSync(path.join(env.projectDir, 'CHANGE-RECORD.md'));

    const preview = runCli('project sync', env.projectDir, env.homeDir);
    expect(preview.exitCode).toBe(0);
    expect(preview.stdout).toContain('CHANGE-RECORD.md (create empty product changelog');
    expect(fs.existsSync(path.join(env.projectDir, 'CHANGE-RECORD.md'))).toBe(false);

    const applied = runCli('project sync --confirm', env.projectDir, env.homeDir);
    expect(applied.exitCode).toBe(0);
    expect(applied.stdout).toContain('Created: CHANGE-RECORD.md');
    expect(read(env.projectDir, 'CHANGE-RECORD.md')).toBe('');

    const second = runCli('project sync --confirm', env.projectDir, env.homeDir);
    expect(second.stdout).not.toContain('Created: CHANGE-RECORD.md');
  });
});
