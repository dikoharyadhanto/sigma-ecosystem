// F05 — Git-based INTENT amendment, baseline, preview, doctor drift. CLI-level
// tests against real temporary Git repositories (U-01..U-06, U-08, U-09, U-11).

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { runCli, setupTestEnv, chainPath } from './helpers';
import { GitProject, setupGitProject, editIntent, commitIntent, amendArgs, git, gitTry, sha256, GitProjectOptions } from './f05-git-helpers';

let current: GitProject | null = null;

function project(options: GitProjectOptions = {}): GitProject {
  current = setupGitProject(setupTestEnv(), options);
  return current;
}

function cli(p: GitProject, args: string) {
  return runCli(args, p.projectDir, p.env.homeDir);
}

function chainOf(p: GitProject): Record<string, any> {
  return fs.readJsonSync(chainPath(p.env, 'v1'));
}

afterEach(() => {
  current?.cleanup();
  current = null;
});

describe('F05 baseline check and preflight (U-01)', () => {
  it('passes on a committed, certified INTENT with a recorded baseline', () => {
    const p = project();
    const r = cli(p, 'intent baseline check');
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/INTENT in Git matches the certified baseline/);
  });

  it('reports each failed condition separately when there is no baseline', () => {
    const p = project({ baseline: false });
    const r = cli(p, 'intent baseline check');
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toMatch(/\[FAIL\] baseline_recorded/);
    expect(r.stderr).toMatch(/baseline adopt/);
  });

  it('fails git_repository for a project without Git', () => {
    const p = project({ noGit: true });
    const r = cli(p, 'intent baseline check');
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toMatch(/\[FAIL\] git_repository/);
  });

  it('reports uncommitted INTENT changes (worktree_clean) and uncertified edits', () => {
    const p = project();
    editIntent(p);
    const r = cli(p, 'intent baseline check');
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toMatch(/\[FAIL\] worktree_clean/);
    expect(r.stdout).toMatch(/\[FAIL\] certified_matches_file/);
  });

  it('fails intent_tracked for an untracked INTENT', () => {
    const p = project();
    git(p.repoDir, 'rm', '-q', '--cached', '--', p.intentRel);
    const r = cli(p, 'intent baseline check');
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toMatch(/\[FAIL\] intent_tracked/);
  });

  it('fails when the baseline commit content no longer matches the recorded content', () => {
    const p = project();
    const chain = chainOf(p);
    chain.intent.git_baseline.doc_sha256_lf = sha256('something else');
    fs.writeJsonSync(chainPath(p.env, 'v1'), chain);
    const r = cli(p, 'intent baseline check');
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toMatch(/\[FAIL\] baseline_content/);
  });

  it('warns about a missing baseline tag without blocking, and flags a moved tag as blocking', () => {
    const p = project();
    git(p.repoDir, 'tag', '-d', 'sigma/intent-v1-base');
    const missing = cli(p, 'intent baseline check');
    expect(missing.exitCode).toBe(0);
    expect(missing.stdout).toMatch(/\[WARN\] baseline_tag/);
    expect(missing.stdout).toMatch(/\[DRIFT\].*tag sigma\/intent-v1-base is missing/);
    editIntent(p);
    const second = commitIntent(p);
    git(p.repoDir, 'tag', 'sigma/intent-v1-base', second);
    const moved = cli(p, 'intent baseline check');
    expect(moved.exitCode).toBe(1);
    expect(moved.stdout).toMatch(/\[FAIL\] baseline_tag/);
  });
});

describe('F05 amendment preview (U-02)', () => {
  it('shows diff, hash and impact without writing the document or the chain', () => {
    const p = project();
    editIntent(p, 'Scope: ARC drafted this line.');
    const docBefore = fs.readFileSync(p.intentFile);
    const chainBefore = fs.readFileSync(chainPath(p.env, 'v1'));
    const r = cli(p, 'intent amendment preview');
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain(sha256(docBefore));
    expect(r.stdout).toMatch(/Scope: ARC drafted this line\./);
    expect(r.stdout).toMatch(/AMD-001 -> tag sigma\/intent-v1-amd-001/);
    expect(r.stdout).toMatch(/INTENT revision: 1 -> 2/);
    expect(fs.readFileSync(p.intentFile).equals(docBefore)).toBe(true);
    expect(fs.readFileSync(chainPath(p.env, 'v1')).equals(chainBefore)).toBe(true);
  });

  it('is blocked when nothing changed relative to the baseline', () => {
    const p = project();
    const r = cli(p, 'intent amendment preview');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/changed_since_baseline/);
  });
});

describe('F05 amendment recording (U-03, U-04)', () => {
  it('records AMD-001: tag, chain references, certification, log; the document is not rewritten', () => {
    const p = project();
    editIntent(p);
    const edited = fs.readFileSync(p.intentFile);
    const commit = commitIntent(p);
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/AMD-001 recorded/);
    expect(r.stdout).toMatch(/git push --follow-tags/);

    expect(fs.readFileSync(p.intentFile).equals(edited)).toBe(true);
    expect(git(p.repoDir, 'cat-file', '-t', 'sigma/intent-v1-amd-001')).toBe('tag');
    expect(git(p.repoDir, 'rev-parse', 'sigma/intent-v1-amd-001^{commit}')).toBe(commit);

    const chain = chainOf(p);
    expect(chain.intent.amendments).toHaveLength(1);
    expect(chain.intent.amendments[0]).toMatchObject({
      id: 'AMD-001', change: 'Widen scope per Director', purpose_changed: false,
      baseline_commit: p.baselineCommit, result_commit: commit, result_tag: 'sigma/intent-v1-amd-001',
    });
    expect(chain.intent.certified_doc_sha256).toBe(sha256(edited));
    expect(chain.intent.revision).toBe(2);
    expect(chain.intent.effective_amendment).toBe('AMD-001');
    expect(chain.intent.git_baseline).toMatchObject({ commit, tag: 'sigma/intent-v1-amd-001', provenance: 'amendment', amendment: 'AMD-001', revision: 2 });

    const log = fs.readFileSync(path.join(p.projectDir, 'Sigma', 'logs', 'intent_amendment.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ event: 'amendment', id: 'AMD-001', result_commit: commit, purpose_changed: false });

    const status = cli(p, 'intent status');
    expect(status.stdout).not.toMatch(/UNCERTIFIED_EDIT/);
    expect(status.stdout).toMatch(/Last amendment: AMD-001/);
    expect(cli(p, 'intent baseline check').exitCode).toBe(0);
  });

  it('chains a second amendment from the advanced baseline', () => {
    const p = project();
    editIntent(p, 'first');
    expect(cli(p, amendArgs(p, commitIntent(p))).exitCode).toBe(0);
    editIntent(p, 'second');
    const c2 = commitIntent(p);
    const r = cli(p, amendArgs(p, c2, { change: 'second change', purpose: 'yes' }));
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    const chain = chainOf(p);
    expect(chain.intent.amendments.map((a: any) => a.id)).toEqual(['AMD-001', 'AMD-002']);
    expect(chain.intent.amendments[1]).toMatchObject({ purpose_changed: true, result_tag: 'sigma/intent-v1-amd-002' });
    expect(chain.intent.amendments[1].baseline_commit).toBe(chain.intent.amendments[0].result_commit);
  });

  it('stops with the list of steps when required options are missing', () => {
    const p = project();
    editIntent(p);
    const r = cli(p, 'intent amendment --change "x"');
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Missing: --purpose-changed yes\|no, --commit <ref>, --doc-sha256 <hash from preview>, --director-confirm/);
  });

  it('requires --director-confirm', () => {
    const p = project();
    editIntent(p);
    const commit = commitIntent(p);
    const r = cli(p, amendArgs(p, commit, { confirm: false }));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--director-confirm/);
    expect(chainOf(p).intent.amendments ?? []).toHaveLength(0);
  });

  it('rejects an invalid --purpose-changed value', () => {
    const p = project();
    editIntent(p);
    const commit = commitIntent(p);
    const r = cli(p, amendArgs(p, commit, { purpose: 'maybe' }));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/must be yes or no/);
  });

  it('rejects when the reviewed hash does not match the file', () => {
    const p = project();
    editIntent(p);
    const commit = commitIntent(p);
    const r = cli(p, amendArgs(p, commit, { hash: sha256('not the file') }));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/differs from the reviewed hash/);
    expect(chainOf(p).intent.amendments ?? []).toHaveLength(0);
    expect(gitTry(p.repoDir, 'rev-parse', '--verify', '--quiet', 'refs/tags/sigma/intent-v1-amd-001').ok).toBe(false);
  });

  it('rejects the baseline commit itself (edit not committed yet) and does not accept HEAD blindly', () => {
    const p = project();
    editIntent(p);
    const r = cli(p, amendArgs(p, p.baselineCommit!));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Amendment cannot be completed/);
    expect(r.stderr).toMatch(/baseline commit|differs from the working-tree|uncommitted/);
    const head = cli(p, amendArgs(p, 'HEAD'));
    expect(head.exitCode).toBe(1);
    expect(chainOf(p).intent.amendments ?? []).toHaveLength(0);
  });

  it('rejects when the file changed after the result commit (uncommitted edit)', () => {
    const p = project();
    editIntent(p);
    const commit = commitIntent(p);
    editIntent(p, 'late edit after commit');
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/differs from the working-tree file|uncommitted changes/);
  });

  it('rejects an unknown or malformed commit reference', () => {
    const p = project();
    editIntent(p);
    commitIntent(p);
    expect(cli(p, amendArgs(p, 'deadbeefdeadbeef')).exitCode).toBe(1);
    const bad = cli(p, amendArgs(p, '--upload-pack=x'));
    expect(bad.exitCode).toBe(1);
  });

  it('rejects a result commit that is not reachable from HEAD', () => {
    const p = project();
    editIntent(p);
    const commit = commitIntent(p);
    git(p.repoDir, 'checkout', '-q', '--detach', p.baselineCommit!); // commit still exists, HEAD moved back
    editIntent(p); // same content again, uncommitted
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/not reachable from HEAD|uncommitted/);
  });

  it('never moves a tag that sits on another commit, and leaves the chain untouched', () => {
    const p = project();
    editIntent(p);
    const commit = commitIntent(p);
    git(p.repoDir, 'tag', 'sigma/intent-v1-amd-001', p.baselineCommit!);
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/never moves or overwrites tags/);
    expect(chainOf(p).intent.amendments ?? []).toHaveLength(0);
    expect(git(p.repoDir, 'rev-parse', 'sigma/intent-v1-amd-001^{commit}')).toBe(p.baselineCommit);
  });

  it('adopts a tag left by an interrupted attempt on the same commit (idempotent rerun)', () => {
    const p = project();
    editIntent(p);
    const commit = commitIntent(p);
    git(p.repoDir, 'tag', '-a', 'sigma/intent-v1-amd-001', commit, '-m', 'left behind');
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/adopted/);
    expect(chainOf(p).intent.amendments).toHaveLength(1);
  });

  it('flags APPROVED PLANs for review and leaves LOCKED PLANs unchanged (non-retroactive)', () => {
    const p = project();
    const chain = chainOf(p);
    const now = new Date().toISOString();
    chain.versioning_scheme = 'intent_aligned';
    chain.lifecycle_model = 'paired_approval';
    chain.plan = {
      active_version: 'v1.2', active_state: 'APPROVED', pending: [],
      versions: [
        { version: 'v1.1', state: 'LOCKED', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        { version: 'v1.2', state: 'APPROVED', created_at: now, updated_at: now, intent_version_ref: 'v1' },
      ],
    };
    fs.writeJsonSync(chainPath(p.env, 'v1'), chain);
    editIntent(p);
    const preview = cli(p, 'intent amendment preview');
    expect(preview.stdout).toMatch(/flagged for INTENT review: v1\.2/);
    expect(preview.stdout).toMatch(/LOCKED pairs, unchanged \(not retroactive\): v1\.1/);
    const commit = commitIntent(p);
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    const after = chainOf(p);
    const byVersion = (v: string) => after.plan.versions.find((x: any) => x.version === v);
    expect(byVersion('v1.2').needs_intent_review).toBe(true);
    expect(byVersion('v1.1').needs_intent_review).toBeUndefined();
    expect(byVersion('v1.1').state).toBe('LOCKED');
  });

  it('refuses an amendment on a chain without a Git baseline', () => {
    const p = project({ baseline: false });
    editIntent(p);
    const commit = commitIntent(p);
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/baseline_recorded/);
  });
});

describe('F05 baseline adopt (U-06)', () => {
  it('adopts a certified, committed INTENT (ratified_commit) with an annotated tag', () => {
    const p = project({ baseline: false });
    const r = cli(p, `intent baseline adopt --commit ${p.baselineCommit} --director-confirm`);
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    const chain = chainOf(p);
    expect(chain.intent.git_baseline).toMatchObject({ commit: p.baselineCommit, tag: 'sigma/intent-v1-base', provenance: 'ratified_commit', revision: 1 });
    expect(git(p.repoDir, 'cat-file', '-t', 'sigma/intent-v1-base')).toBe('tag');
    expect(cli(p, 'intent baseline check').exitCode).toBe(0);
    const log = fs.readFileSync(path.join(p.projectDir, 'Sigma', 'logs', 'intent_amendment.log'), 'utf8');
    expect(JSON.parse(log.trim().split('\n')[0])).toMatchObject({ event: 'baseline', provenance: 'ratified_commit' });
  });

  it('requires --director-confirm', () => {
    const p = project({ baseline: false });
    const r = cli(p, `intent baseline adopt --commit ${p.baselineCommit}`);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--director-confirm is required/);
    expect(chainOf(p).intent.git_baseline).toBeUndefined();
  });

  it('is idempotent for the same commit and refuses to replace an existing baseline', () => {
    const p = project({ baseline: false });
    expect(cli(p, `intent baseline adopt --commit ${p.baselineCommit} --director-confirm`).exitCode).toBe(0);
    const again = cli(p, `intent baseline adopt --commit ${p.baselineCommit} --director-confirm`);
    expect(again.exitCode).toBe(0);
    expect(again.stdout).toMatch(/already recorded/);
    editIntent(p);
    const other = commitIntent(p);
    const replace = cli(p, `intent baseline adopt --commit ${other} --director-confirm`);
    expect(replace.exitCode).toBe(1);
    expect(replace.stderr).toMatch(/already recorded/);
  });

  it('refuses a commit whose content differs from the working tree', () => {
    const p = project({ baseline: false });
    editIntent(p);
    const r = cli(p, `intent baseline adopt --commit ${p.baselineCommit} --director-confirm`);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/differs from the working-tree file/);
  });

  it('refuses UNCERTIFIED_EDIT content without --import-current, imports it with the flag and invents no amendment', () => {
    const p = project({ baseline: false });
    editIntent(p); // edited after certification, then committed
    const commit = commitIntent(p);
    const refused = cli(p, `intent baseline adopt --commit ${commit} --director-confirm`);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toMatch(/--import-current/);
    expect(chainOf(p).intent.git_baseline).toBeUndefined();

    const r = cli(p, `intent baseline adopt --commit ${commit} --import-current --director-confirm`);
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    const chain = chainOf(p);
    expect(chain.intent.git_baseline).toMatchObject({ commit, provenance: 'imported_current', revision: 2 });
    expect(chain.intent.certified_doc_sha256).toBe(sha256(fs.readFileSync(p.intentFile)));
    expect(chain.intent.revision_provenance).toBe('imported_current_certification');
    expect(chain.intent.amendments ?? []).toHaveLength(0);
    expect(cli(p, 'intent status').stdout).not.toMatch(/UNCERTIFIED_EDIT/);
  });

  it('requires --import-current for a RATIFIED chain that was never certified', () => {
    const p = project({ baseline: false, uncertified: true });
    const refused = cli(p, `intent baseline adopt --commit ${p.baselineCommit} --director-confirm`);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toMatch(/no certified hash/);
    expect(cli(p, `intent baseline adopt --commit ${p.baselineCommit} --import-current --director-confirm`).exitCode).toBe(0);
    expect(chainOf(p).intent.certified_doc_sha256).toBe(sha256(fs.readFileSync(p.intentFile)));
  });
});

describe('F05 line endings and repository layout (U-08, U-09)', () => {
  for (const autocrlf of ['true', 'false', 'input'] as const) {
    for (const crlf of [true, false]) {
      it(`full flow with core.autocrlf=${autocrlf} and a ${crlf ? 'CRLF' : 'LF'} INTENT`, () => {
        const p = project({ autocrlf, crlf });
        expect(cli(p, 'intent baseline check').exitCode, 'baseline check').toBe(0);
        editIntent(p);
        const preview = cli(p, 'intent amendment preview');
        expect(preview.exitCode, preview.stdout + preview.stderr).toBe(0);
        const commit = commitIntent(p);
        const r = cli(p, amendArgs(p, commit));
        expect(r.exitCode, r.stdout + r.stderr).toBe(0);
        expect(chainOf(p).intent.certified_doc_sha256).toBe(sha256(fs.readFileSync(p.intentFile)));
        expect(cli(p, 'intent baseline check').exitCode, 'check after amendment').toBe(0);
      });
    }
  }

  it('works when the repository root is above the project root', () => {
    const p = project({ nested: true });
    expect(p.repoDir).not.toBe(p.projectDir);
    expect(cli(p, 'intent baseline check').exitCode).toBe(0);
    editIntent(p);
    const commit = commitIntent(p);
    const r = cli(p, amendArgs(p, commit));
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    expect(git(p.repoDir, 'rev-parse', 'sigma/intent-v1-amd-001^{commit}')).toBe(commit);
  });
});

describe('F05 doctor drift (U-11)', () => {
  it('reports missing, moved and orphan tags read-only', () => {
    const p = project();
    editIntent(p);
    expect(cli(p, amendArgs(p, commitIntent(p))).exitCode).toBe(0);
    const chainBefore = fs.readFileSync(chainPath(p.env, 'v1'));
    git(p.repoDir, 'tag', '-d', 'sigma/intent-v1-amd-001');
    git(p.repoDir, 'tag', 'sigma/intent-v1-amd-009', 'HEAD'); // orphan
    const r = cli(p, 'doctor');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/INTENT v1 Git: AMD-001: tag sigma\/intent-v1-amd-001 is missing/);
    expect(r.stdout).toMatch(/orphan tag sigma\/intent-v1-amd-009/);
    const chainAfter = JSON.parse(fs.readFileSync(chainPath(p.env, 'v1'), 'utf8'));
    expect(chainAfter.intent.git_baseline).toEqual(JSON.parse(chainBefore.toString()).intent.git_baseline);
    expect(chainAfter.intent.certified_doc_sha256).toBe(JSON.parse(chainBefore.toString()).intent.certified_doc_sha256);
    expect(gitTry(p.repoDir, 'rev-parse', '--verify', '--quiet', 'refs/tags/sigma/intent-v1-amd-009').ok).toBe(true); // doctor never deletes tags
  });
});
