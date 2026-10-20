// WP-4 (PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY-20261020 §3.4 item 1):
// INTENT baseline and amendment through local snapshots, for projects whose INTENT
// Git does not track (gitignore ON, or no Git at all). The Git flow keeps its own
// tests in f05-intent-git-amendment.test.ts and control-w2-batch.test.ts.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { setBinding, resetBindingForTest } from '../src/mcp/shared';
import { Binding, fingerprintRoot } from '../src/mcp/binding';
import { buildControlServer } from '../src/mcp/control/index';
import { readChain } from '../src/engine/chain';
import {
  ApprovalRecord, readTicket, writeApproval, generateId, APPROVAL_TTL_MS,
} from '../src/engine/controlStore';
import { diffDocuments, findSnapshotByHash } from '../src/engine/intentSnapshot';
import { lfSha256 } from '../src/engine/docHash';
import { runCli, setupTestEnv, chainPath } from './helpers';
import { GitProject, setupGitProject, editIntent, git, sha256 } from './f05-git-helpers';

let current: GitProject | null = null;

/** A RATIFIED, certified chain whose INTENT Git cannot track: no repository at all. */
function project(): GitProject {
  current = setupGitProject(setupTestEnv(), { noGit: true });
  return current;
}

function cli(p: GitProject, args: string) {
  return runCli(args, p.projectDir, p.env.homeDir);
}

function chainOf(p: GitProject): Record<string, any> {
  return fs.readJsonSync(chainPath(p.env, 'v1'));
}

const snapDir = (p: GitProject) => path.join(p.projectDir, 'Sigma', 'revisions', 'INTENT-v1');

function adopt(p: GitProject, extra = '') {
  return cli(p, `intent baseline adopt --director-confirm ${extra}`.trim());
}

function amend(p: GitProject, opts: { change?: string; hash?: string; extra?: string } = {}) {
  const hash = opts.hash ?? sha256(fs.readFileSync(p.intentFile));
  return cli(p, `intent amendment --change "${opts.change ?? 'Widen scope per Director'}" --purpose-changed no --doc-sha256 ${hash} --director-confirm ${opts.extra ?? ''}`.trim());
}

afterEach(() => {
  resetBindingForTest();
  current?.cleanup();
  current = null;
});

describe('snapshot baseline (adopt without --commit)', () => {
  it('requires --director-confirm', () => {
    const p = project();
    const r = cli(p, 'intent baseline adopt');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--director-confirm is required/);
    expect(fs.existsSync(snapDir(p))).toBe(false);
  });

  it('stores the certified bytes, records the baseline, and is idempotent', () => {
    const p = project();
    const bytes = fs.readFileSync(p.intentFile);
    const r = adopt(p);
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Snapshot baseline recorded for v1: Sigma\/revisions\/INTENT-v1\/base\.md \(adopted\)/);

    expect(fs.readFileSync(path.join(snapDir(p), 'base.md')).equals(bytes)).toBe(true);
    const ledger = fs.readJsonSync(path.join(snapDir(p), 'ledger.json'));
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({ id: 'BASE', file: 'Sigma/revisions/INTENT-v1/base.md', doc_sha256: sha256(bytes) });
    expect(chainOf(p).intent.snapshot_baseline).toMatchObject({ file: 'Sigma/revisions/INTENT-v1/base.md', doc_sha256: sha256(bytes), provenance: 'adopted' });
    expect(chainOf(p).intent.git_baseline).toBeUndefined();

    const again = adopt(p);
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toMatch(/already recorded/);
    expect(fs.readJsonSync(path.join(snapDir(p), 'ledger.json')).entries).toHaveLength(1);

    expect(cli(p, 'intent status').stdout).toMatch(/Snapshot baseline: Sigma\/revisions\/INTENT-v1\/base\.md/);
  });

  it('refuses UNCERTIFIED_EDIT content without --import-current and imports it with the flag', () => {
    const p = project();
    editIntent(p, 'edited after certification');
    const refused = adopt(p);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toMatch(/UNCERTIFIED_EDIT/);
    expect(fs.existsSync(snapDir(p))).toBe(false);

    const imported = adopt(p, '--import-current');
    expect(imported.exitCode, imported.stdout + imported.stderr).toBe(0);
    expect(chainOf(p).intent.snapshot_baseline.provenance).toBe('imported_current');
    expect(chainOf(p).intent.certified_doc_sha256).toBe(sha256(fs.readFileSync(p.intentFile)));
    expect(chainOf(p).intent.amendments ?? []).toHaveLength(0);
  });

  it('works inside a Git repository that ignores Sigma/ (the situation gitignore ON creates)', () => {
    const p = project();
    git(p.projectDir, 'init', '-q');
    fs.writeFileSync(path.join(p.projectDir, '.gitignore'), '/Sigma/\n');
    const r = adopt(p);
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stderr).not.toMatch(/tracked by Git/);
    expect(cli(p, 'intent baseline check').exitCode).toBe(0);
  });
});

describe('snapshot baseline check and preview', () => {
  it('check passes right after adopt and reports an edit as drift from the baseline', () => {
    const p = project();
    adopt(p);
    const ok = cli(p, 'intent baseline check');
    expect(ok.exitCode, ok.stdout + ok.stderr).toBe(0);
    expect(ok.stdout).toMatch(/verification_mode: snapshot/);
    expect(ok.stdout).toMatch(/matches the certified baseline/);

    editIntent(p);
    const dirty = cli(p, 'intent baseline check');
    expect(dirty.exitCode).toBe(1);
    expect(dirty.stdout).toMatch(/\[FAIL\] certified_matches_file/);
    expect(dirty.stdout).toMatch(/\[FAIL\] file_matches_baseline/);
  });

  it('preview shows mode, diff and hash, writes nothing, and is blocked when nothing changed', () => {
    const p = project();
    adopt(p);
    const unchanged = cli(p, 'intent amendment preview');
    expect(unchanged.exitCode).toBe(1);
    expect(unchanged.stderr).toMatch(/changed_since_baseline/);

    editIntent(p, 'Scope: ARC drafted this line.');
    const doc = fs.readFileSync(p.intentFile);
    const chainBefore = fs.readFileSync(chainPath(p.env, 'v1'));
    const r = cli(p, 'intent amendment preview');
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain(sha256(doc));
    expect(r.stdout).toMatch(/Mode: snapshot/);
    expect(r.stdout).toMatch(/AMD-001 -> snapshot Sigma\/revisions\/INTENT-v1\/amd-001\.md/);
    expect(r.stdout).toMatch(/\+Scope: ARC drafted this line\./);
    expect(fs.readFileSync(chainPath(p.env, 'v1')).equals(chainBefore)).toBe(true);
    expect(fs.existsSync(path.join(snapDir(p), 'amd-001.md'))).toBe(false);
  });
});

describe('snapshot amendment recording', () => {
  it('records AMD-001 with a snapshot instead of a commit and tag', () => {
    const p = project();
    adopt(p);
    editIntent(p);
    const edited = fs.readFileSync(p.intentFile);
    const r = amend(p);
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/AMD-001 recorded/);
    expect(r.stdout).toMatch(/Snapshot: Sigma\/revisions\/INTENT-v1\/amd-001\.md \(written\)/);
    expect(r.stdout).not.toMatch(/git push/);

    expect(fs.readFileSync(p.intentFile).equals(edited)).toBe(true); // document is never rewritten
    expect(fs.readFileSync(path.join(snapDir(p), 'amd-001.md')).equals(edited)).toBe(true);

    const chain = chainOf(p);
    expect(chain.intent.amendments).toHaveLength(1);
    expect(chain.intent.amendments[0]).toMatchObject({
      id: 'AMD-001', change: 'Widen scope per Director', purpose_changed: false,
      snapshot_file: 'Sigma/revisions/INTENT-v1/amd-001.md', doc_sha256: sha256(edited),
    });
    expect(chain.intent.amendments[0].result_commit).toBeUndefined();
    expect(chain.intent.amendments[0].result_tag).toBeUndefined();
    expect(chain.intent.certified_doc_sha256).toBe(sha256(edited));
    expect(chain.intent.revision).toBe(2);
    expect(chain.intent.effective_amendment).toBe('AMD-001');
    expect(chain.intent.snapshot_baseline).toMatchObject({ file: 'Sigma/revisions/INTENT-v1/amd-001.md', provenance: 'amendment', amendment: 'AMD-001', revision: 2 });

    const log = fs.readFileSync(path.join(p.projectDir, 'Sigma', 'logs', 'intent_amendment.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(log.map(l => l.event)).toEqual(['baseline', 'amendment']);
    expect(log[1]).toMatchObject({ id: 'AMD-001', mode: 'snapshot', result_snapshot: 'Sigma/revisions/INTENT-v1/amd-001.md' });

    expect(fs.readJsonSync(path.join(snapDir(p), 'ledger.json')).entries.map((e: any) => e.id)).toEqual(['BASE', 'AMD-001']);
    expect(cli(p, 'intent baseline check').exitCode).toBe(0);
    expect(cli(p, 'intent status').stdout).toMatch(/Last amendment: AMD-001 .* Sigma\/revisions\/INTENT-v1\/amd-001\.md/);
  });

  it('chains a second amendment from the advanced baseline and keeps both snapshots', () => {
    const p = project();
    adopt(p);
    editIntent(p, 'first');
    expect(amend(p).exitCode).toBe(0);
    const first = fs.readFileSync(path.join(snapDir(p), 'amd-001.md'));

    editIntent(p, 'second');
    const preview = cli(p, 'intent amendment preview');
    expect(preview.stdout).toMatch(/\+second/);
    expect(preview.stdout).not.toMatch(/\+first/); // diff is against AMD-001, not the original baseline
    const r = amend(p, { change: 'second change' });
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(chainOf(p).intent.revision).toBe(3);
    expect(fs.readFileSync(path.join(snapDir(p), 'amd-001.md')).equals(first)).toBe(true);
    expect(fs.existsSync(path.join(snapDir(p), 'amd-002.md'))).toBe(true);
  });

  it('rejects --commit, a stale hash and a missing hash, leaving no snapshot or chain change behind', () => {
    const p = project();
    adopt(p);
    editIntent(p);
    const chainBefore = fs.readFileSync(chainPath(p.env, 'v1'));

    const withCommit = amend(p, { extra: '--commit HEAD' });
    expect(withCommit.exitCode).toBe(1);
    expect(withCommit.stderr).toMatch(/--commit is not used/);

    const stale = amend(p, { hash: '0'.repeat(64) });
    expect(stale.exitCode).toBe(1);
    expect(stale.stderr).toMatch(/differs from the reviewed hash/);

    const noHash = cli(p, 'intent amendment --change "x" --purpose-changed no --director-confirm');
    expect(noHash.exitCode).toBe(1);
    expect(noHash.stderr).toMatch(/Missing: --doc-sha256/);

    expect(fs.existsSync(path.join(snapDir(p), 'amd-001.md'))).toBe(false);
    expect(fs.readFileSync(chainPath(p.env, 'v1')).equals(chainBefore)).toBe(true);
  });

  it('refuses without a baseline and without --director-confirm', () => {
    const p = project();
    editIntent(p);
    const noBaseline = amend(p);
    expect(noBaseline.exitCode).toBe(1);
    expect(noBaseline.stderr).toMatch(/baseline_recorded/);

    adopt(p, '--import-current');
    editIntent(p, 'another');
    const noConfirm = cli(p, `intent amendment --change "x" --purpose-changed no --doc-sha256 ${sha256(fs.readFileSync(p.intentFile))}`);
    expect(noConfirm.exitCode).toBe(1);
    expect(noConfirm.stderr).toMatch(/--director-confirm/);
  });

  it('reports a tampered or missing snapshot as drift and blocks the amendment', () => {
    const p = project();
    adopt(p);
    fs.appendFileSync(path.join(snapDir(p), 'base.md'), 'tampered\n');
    editIntent(p);
    const check = cli(p, 'intent baseline check');
    expect(check.exitCode).toBe(1);
    expect(check.stdout).toMatch(/\[DRIFT\] baseline: snapshot .* no longer matches/);
    const r = amend(p);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/baseline_snapshot/);
    expect(fs.existsSync(path.join(snapDir(p), 'amd-001.md'))).toBe(false);
  });

  it('keeps a chain with a Git baseline in Git mode instead of silently switching to snapshots', () => {
    current = setupGitProject(setupTestEnv());
    const p = current;
    expect(chainOf(p).intent.git_baseline).toBeDefined();
    // Still Git mode: the preview reports it and asks for a commit.
    editIntent(p);
    expect(cli(p, 'intent amendment preview').stdout).toMatch(/Mode: git/);
    // Without --commit the Git use-case refuses instead of falling back.
    const r = amend(p);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--commit is required/);
  });
});

// Merge with BUG-20261015 (certified hashes independent of core.autocrlf): snapshot mode must
// accept the same raw / LF-folded / CRLF-expanded forms as the Git mode.
describe('snapshot mode and line endings', () => {
  function crlfProject(): GitProject {
    current = setupGitProject(setupTestEnv(), { noGit: true, crlf: true });
    return current;
  }

  it('adopts a CRLF INTENT that was certified with the raw hash, without --import-current', () => {
    const p = crlfProject();
    const r = adopt(p);
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(chainOf(p).intent.snapshot_baseline.provenance).toBe('adopted');
    expect(chainOf(p).intent.revision).toBe(1); // no re-certification, no revision bump
  });

  it('still passes the baseline check after the file is checked out with LF endings elsewhere', () => {
    const p = crlfProject();
    expect(adopt(p).exitCode).toBe(0);
    fs.writeFileSync(p.intentFile, fs.readFileSync(p.intentFile, 'utf8').replace(/\r\n/g, '\n'));
    const check = cli(p, 'intent baseline check');
    expect(check.exitCode, check.stdout + check.stderr).toBe(0);
    expect(cli(p, 'intent status').stdout).not.toMatch(/UNCERTIFIED_EDIT/);
  });

  it('accepts either the raw or the LF hash from the preview, and certifies the LF-folded hash', () => {
    const p = crlfProject();
    expect(adopt(p).exitCode).toBe(0);
    editIntent(p); // CRLF-preserving edit
    const bytes = fs.readFileSync(p.intentFile);
    expect(sha256(bytes)).not.toBe(lfSha256(bytes));

    const stale = amend(p, { hash: '1'.repeat(64) });
    expect(stale.exitCode).toBe(1);
    const r = amend(p, { hash: lfSha256(bytes) });
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(chainOf(p).intent.certified_doc_sha256).toBe(lfSha256(bytes));
    expect(fs.readFileSync(path.join(snapDir(p), 'amd-001.md')).equals(bytes)).toBe(true);
    expect(cli(p, 'intent baseline check').exitCode).toBe(0);

    editIntent(p, 'second');
    const raw = amend(p, { change: 'second', hash: sha256(fs.readFileSync(p.intentFile)) });
    expect(raw.exitCode, raw.stdout + raw.stderr).toBe(0);
  });

  it('finds certified content in snapshots by raw, LF or CRLF hash', () => {
    const p = crlfProject();
    expect(adopt(p).exitCode).toBe(0);
    const bytes = fs.readFileSync(p.intentFile);
    for (const hash of [sha256(bytes), 'sha256:' + lfSha256(bytes)]) {
      expect(findSnapshotByHash(p.projectDir, 'v1', hash)?.equals(bytes), hash).toBe(true);
    }
    expect(findSnapshotByHash(p.projectDir, 'v1', '0'.repeat(64))).toBeNull();
  });
});

describe('diffDocuments', () => {
  it('produces a unified-style diff with stats and folds CRLF', () => {
    const d = diffDocuments('a\r\nb\r\nc\r\n', 'a\nB\nc\nd\n', 'old', 'new');
    expect(d.stat).toMatch(/new \| 3 changed \(\+2 -1\)/);
    expect(d.patch).toContain('-b');
    expect(d.patch).toContain('+B');
    expect(d.patch).toContain('+d');
    expect(diffDocuments('x\n', 'x\r\n', 'a', 'b')).toEqual({ stat: '(no changes)', patch: '' });
  });
});

// ── MCP control plane ────────────────────────────────────────────────────────

describe('MCP prepare / commit in snapshot mode', () => {
  function bind(root: string): void {
    const binding: Binding = { mode: 'control', kind: 'verified', root, projectId: 'TEST', rootFingerprint: fingerprintRoot(root), role: 'ARC', verified: true };
    setBinding(binding);
  }

  async function connect(root: string) {
    bind(root);
    const server = buildControlServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'snapshot-test', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return {
      client,
      async call(name: string, args: Record<string, unknown>) {
        const res = await client.callTool({ name, arguments: args });
        const text = (res.content as Array<{ type: string; text: string }>)[0].text;
        return { payload: JSON.parse(text) as Record<string, any>, isError: res.isError === true };
      },
    };
  }

  function approve(root: string, ticketId: string): ApprovalRecord {
    const ticket = readTicket(root, ticketId)!;
    const now = new Date();
    const approval: ApprovalRecord = {
      approval_id: generateId('appr'), project_id: ticket.project_id, operation_ticket_id: ticket.operation_ticket_id,
      operation_id: ticket.operation_id, arguments_hash: ticket.arguments_hash,
      target_artifact: ticket.target?.artifact ?? null, target_version: ticket.target?.version ?? null,
      target_sha256: ticket.target?.sha256 ?? null, expected_state_revision: ticket.expected_state_revision,
      decision: 'approve', reason: null, director_identity: 'test-director', authentication_method: 'local_cli', channel: 'cli',
      issued_at: now.toISOString(), expires_at: new Date(now.getTime() + APPROVAL_TTL_MS).toISOString(), consumed_at: null,
    };
    writeApproval(root, approval);
    return approval;
  }

  it('end-to-end without a commit: prepare freezes the snapshot plan, commit stores and certifies it', async () => {
    const p = project();
    expect(adopt(p).exitCode).toBe(0);
    editIntent(p);
    const edited = fs.readFileSync(p.intentFile);
    const s = await connect(p.projectDir);

    const prep = await s.call('sigma_prepare_intent_amendment', { change: 'Scope widened per Director', purpose_changed: false, idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).toBe(false);
    expect(JSON.stringify(prep.payload.effects)).toMatch(/local snapshot Sigma\/revisions\/INTENT-v1\/amd-001\.md/);
    expect(readChain(p.projectDir, 'v1').intent.amendments ?? []).toHaveLength(0);
    expect(fs.existsSync(path.join(snapDir(p), 'amd-001.md'))).toBe(false);

    const approval = approve(p.projectDir, prep.payload.operation_ticket_id as string);
    const withCommit = await s.call('sigma_commit_intent_amendment', {
      operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id,
      change: 'Scope widened per Director', purpose_changed: false, commit: 'HEAD', idempotency_key: 'c0',
    });
    expect(withCommit.isError).toBe(true);
    expect(JSON.stringify(withCommit.payload)).toMatch(/--commit is not used/);

    const commit = await s.call('sigma_commit_intent_amendment', {
      operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id,
      change: 'Scope widened per Director', purpose_changed: false, idempotency_key: 'c1',
    });
    expect(commit.isError, JSON.stringify(commit.payload)).toBe(false);
    expect(commit.payload.mode).toBe('snapshot');
    expect(commit.payload.result_snapshot).toBe('Sigma/revisions/INTENT-v1/amd-001.md');
    expect(commit.payload.result_commit).toBeUndefined();

    const after = readChain(p.projectDir, 'v1');
    expect(after.intent.amendments).toHaveLength(1);
    expect(after.intent.snapshot_baseline).toMatchObject({ provenance: 'amendment', amendment: 'AMD-001' });
    expect(fs.readFileSync(path.join(snapDir(p), 'amd-001.md')).equals(edited)).toBe(true);
    expect(fs.readFileSync(p.intentFile).equals(edited)).toBe(true);
    await s.client.close();
  });

  it('commit refuses when the INTENT changed after the Director approved the reviewed content', async () => {
    const p = project();
    expect(adopt(p).exitCode).toBe(0);
    editIntent(p);
    const s = await connect(p.projectDir);
    const prep = await s.call('sigma_prepare_intent_amendment', { change: 'x', purpose_changed: false, idempotency_key: 'p1' });
    expect(prep.isError, JSON.stringify(prep.payload)).toBe(false);
    const approval = approve(p.projectDir, prep.payload.operation_ticket_id as string);
    editIntent(p, 'a line the Director never reviewed');

    const commit = await s.call('sigma_commit_intent_amendment', {
      operation_ticket_id: prep.payload.operation_ticket_id, approval_id: approval.approval_id,
      change: 'x', purpose_changed: false, idempotency_key: 'c1',
    });
    expect(commit.isError).toBe(true);
    expect(JSON.stringify(commit.payload)).toMatch(/STALE_ARTIFACT|changed since/);
    expect(fs.existsSync(path.join(snapDir(p), 'amd-001.md'))).toBe(false);
    expect(readChain(p.projectDir, 'v1').intent.amendments ?? []).toHaveLength(0);
    await s.client.close();
  });
});
