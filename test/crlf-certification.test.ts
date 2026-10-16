// Bug BUG-20261015: certified INTENT hashes must survive core.autocrlf differences
// between hosts (Fedora LF <-> Windows CRLF) without UNCERTIFIED_EDIT and without
// a revision bump.

import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import { runCli, setupTestEnv, chainPath } from './helpers';
import { GitProject, setupGitProject, editIntent, git, gitTry, sha256, GitProjectOptions } from './f05-git-helpers';
import { matchesCertified, lfSha256, crlfSha256 } from '../src/engine/docHash';
import { certifyIntentDoc, isIntentDocUncertified, ChainState } from '../src/engine/chain';

let current: GitProject | null = null;

function project(options: GitProjectOptions = {}): GitProject {
  current = setupGitProject(setupTestEnv(), options);
  return current;
}

const cli = (p: GitProject, args: string) => runCli(args, p.projectDir, p.env.homeDir);
const chainOf = (p: GitProject): Record<string, any> => fs.readJsonSync(chainPath(p.env, 'v1'));
const writeChain = (p: GitProject, chain: Record<string, any>) => fs.writeJsonSync(chainPath(p.env, 'v1'), chain);

/** What a Windows checkout with core.autocrlf=true does to an LF blob. */
function windowsCheckout(p: GitProject): void {
  git(p.repoDir, 'config', 'core.autocrlf', 'true');
  fs.removeSync(p.intentFile);
  git(p.repoDir, 'checkout', '--', p.intentRel);
  expect(fs.readFileSync(p.intentFile).includes('\r\n')).toBe(true);
}

/** Back to LF bytes on disk (what a Fedora checkout of the same blob looks like). */
function linuxCheckout(p: GitProject): void {
  git(p.repoDir, 'config', 'core.autocrlf', 'false');
  fs.removeSync(p.intentFile);
  git(p.repoDir, 'checkout', '--', p.intentRel);
  expect(fs.readFileSync(p.intentFile).includes('\r\n')).toBe(false);
}

afterEach(() => {
  current?.cleanup();
  current = null;
});

describe('matchesCertified', () => {
  const lf = Buffer.from('# T\nline one\nline two\n');
  const crlf = Buffer.from('# T\r\nline one\r\nline two\r\n');

  it('treats LF and CRLF forms of the same content as equal for LF-folded, raw-LF and raw-CRLF certifications', () => {
    for (const certified of [lfSha256(lf), sha256(lf), sha256(crlf), 'sha256:' + lfSha256(lf)]) {
      expect(matchesCertified(lf, certified)).toBe(true);
      expect(matchesCertified(crlf, certified)).toBe(true);
    }
  });

  it('still rejects different content, an empty certification and a mixed-ending edit', () => {
    expect(matchesCertified(Buffer.from('# T\nline one\nline TWO\n'), lfSha256(lf))).toBe(false);
    expect(matchesCertified(lf, undefined)).toBe(false);
    expect(matchesCertified(lf, '')).toBe(false);
    expect(crlfSha256(lf)).toBe(sha256(crlf));
  });
});

describe('certifyIntentDoc / isIntentDocUncertified', () => {
  it('stamps the LF-folded hash, so a CRLF file certifies to the same value as its LF twin', () => {
    const p = project({ noGit: true });
    const chain = chainOf(p) as unknown as ChainState;
    const lfBytes = fs.readFileSync(p.intentFile);
    fs.writeFileSync(p.intentFile, lfBytes.toString('latin1').replace(/\n/g, '\r\n'), 'latin1');
    certifyIntentDoc(chain, p.intentFile);
    expect(chain.intent.certified_doc_sha256).toBe(lfSha256(lfBytes));
    expect(isIntentDocUncertified(chain, p.intentFile)).toBe(false);
  });

  it('accepts a legacy raw-CRLF certification when the file is read back as LF (device switch)', () => {
    const p = project({ noGit: true });
    const chain = chainOf(p) as unknown as ChainState;
    const lfBytes = fs.readFileSync(p.intentFile);
    chain.intent.certified_doc_sha256 = crlfSha256(lfBytes);
    expect(isIntentDocUncertified(chain, p.intentFile)).toBe(false);
  });

  it('still reports a real content edit, whatever the line endings', () => {
    const p = project({ noGit: true });
    const chain = chainOf(p) as unknown as ChainState;
    editIntent(p);
    expect(isIntentDocUncertified(chain, p.intentFile)).toBe(true);
    fs.writeFileSync(p.intentFile, fs.readFileSync(p.intentFile, 'latin1').replace(/\n/g, '\r\n'), 'latin1');
    expect(isIntentDocUncertified(chain, p.intentFile)).toBe(true);
  });
});

describe('device switch through the CLI', () => {
  it('LF-certified INTENT checked out with CRLF: no UNCERTIFIED_EDIT, baseline check passes', () => {
    const p = project();
    windowsCheckout(p);
    const check = cli(p, 'intent check');
    expect(check.stdout + check.stderr).not.toMatch(/UNCERTIFIED_EDIT/);
    const base = cli(p, 'intent baseline check');
    expect(base.exitCode, base.stdout + base.stderr).toBe(0);
    expect(base.stdout).toMatch(/\[OK  \] certified_matches_file/);
  });

  it('Windows-adopted (raw CRLF) certification stays valid after returning to LF', () => {
    const p = project();
    windowsCheckout(p);
    const chain = chainOf(p);
    chain.intent.certified_doc_sha256 = sha256(fs.readFileSync(p.intentFile)); // what 2.0.0 stamped on Windows
    writeChain(p, chain);
    expect(cli(p, 'intent baseline check').exitCode).toBe(0);
    linuxCheckout(p);
    const back = cli(p, 'intent baseline check');
    expect(back.exitCode, back.stdout + back.stderr).toBe(0);
    expect(back.stdout).toMatch(/\[OK  \] certified_matches_file/);
  });

  it('a real edit on the CRLF host is still UNCERTIFIED_EDIT and shows both hashes', () => {
    const p = project();
    windowsCheckout(p);
    editIntent(p);
    const r = cli(p, 'intent baseline check');
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toMatch(/\[FAIL\] certified_matches_file/);
    expect(r.stdout).toMatch(/file_raw=[a-f0-9]{64} file_lf=[a-f0-9]{64}/);
  });

  it('baseline adopt on a CRLF checkout needs no --import-current and does not bump the revision', () => {
    const p = project({ baseline: false });
    windowsCheckout(p);
    const r = cli(p, `intent baseline adopt --commit ${p.baselineCommit} --director-confirm`);
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
    const chain = chainOf(p);
    expect(chain.intent.revision).toBe(1);
    expect(chain.intent.git_baseline.provenance).toBe('ratified_commit');
    expect(chain.intent.revision_provenance).toBe('certification');
  });
});

describe('doctor line-ending advice', () => {
  it('warns when core.autocrlf=true and the INTENT has no eol=lf attribute', () => {
    const p = project({ autocrlf: 'true' });
    const r = cli(p, 'doctor');
    expect(r.stdout + r.stderr).toMatch(/line endings: core\.autocrlf=true/);
  });

  it('is silent once .gitattributes pins eol=lf, or when autocrlf is off', () => {
    const p = project({ autocrlf: 'true' });
    fs.writeFileSync(`${p.repoDir}/.gitattributes`, 'Sigma/** text eol=lf\n');
    expect(gitTry(p.repoDir, 'check-attr', 'eol', '--', p.intentRel).out).toMatch(/eol: lf/);
    expect(cli(p, 'doctor').stdout).not.toMatch(/line endings:/);

    const q = project({ autocrlf: 'false' });
    expect(cli(q, 'doctor').stdout).not.toMatch(/line endings:/);
  });
});
