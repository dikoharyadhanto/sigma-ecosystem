// F05 test fixtures: a Sigma project whose RATIFIED INTENT lives in a real,
// temporary Git repository. Nothing here touches the master repo or a real project.

import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  TestEnv,
  stubProjectIdentity,
  writeChainFixture,
  makeChainWithLockedIntent,
  validIntentDoc,
  chainPath,
} from './helpers';

export const sha256 = (bytes: string | Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function gitTry(cwd: string, ...args: string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: git(cwd, ...args) };
  } catch (e) {
    return { ok: false, out: String((e as { stderr?: string }).stderr ?? e) };
  }
}

export interface GitProject {
  env: TestEnv;
  /** Directory where `.git` lives (equal to env.projectDir unless nested). */
  repoDir: string;
  projectDir: string;
  intentFile: string;
  intentRel: string;
  baselineCommit: string | null;
  cleanup: () => void;
}

export interface GitProjectOptions {
  /** Record a Git baseline (commit + annotated tag) as `baseline adopt` would. Default true. */
  baseline?: boolean;
  autocrlf?: 'true' | 'false' | 'input';
  /** Write the INTENT with CRLF line endings. */
  crlf?: boolean;
  /** Put the project in a subfolder of the repository (repo root above the project root). */
  nested?: boolean;
  /** Skip `git init` entirely (project without Git). */
  noGit?: boolean;
  /** Omit the certified hash from the chain (pre-amendment-era chain). */
  uncertified?: boolean;
}

export function setupGitProject(env: TestEnv, options: GitProjectOptions = {}): GitProject {
  const baseline = options.baseline !== false;
  let projectDir = env.projectDir;
  let repoDir = env.projectDir;
  let outer: string | null = null;
  const real = { ...env };
  if (options.nested) {
    outer = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-outer-'));
    projectDir = path.join(outer, 'proj');
    repoDir = outer;
    fs.copySync(env.projectDir, projectDir);
    fs.removeSync(env.projectDir);
    real.projectDir = projectDir;
    real.sigmaDir = path.join(projectDir, 'Sigma');
    real.progressPath = path.join(real.sigmaDir, 'progress.json');
    real.activateStatusPath = path.join(real.sigmaDir, 'activate_status.json');
  }

  stubProjectIdentity(real);
  const text = validIntentDoc('v1');
  const body = options.crlf ? text.replace(/\r?\n/g, '\r\n') : text;
  const intentFile = path.join(projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md');
  const chain = makeChainWithLockedIntent('v1') as Record<string, any>;
  fs.writeFileSync(intentFile, body);
  if (!options.uncertified) {
    chain.intent.certified_doc_sha256 = sha256(fs.readFileSync(intentFile));
    chain.intent.certified_at = new Date().toISOString();
    chain.intent.revision = 1;
    chain.intent.revision_provenance = 'certification';
  }
  writeChainFixture(real, 'v1', chain);

  let baselineCommit: string | null = null;
  if (!options.noGit) {
    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.name', 'Sigma Test');
    git(repoDir, 'config', 'user.email', 'test@sigma.invalid');
    git(repoDir, 'config', 'core.autocrlf', options.autocrlf ?? 'false');
    git(repoDir, 'config', 'commit.gpgsign', 'false');
    git(repoDir, 'config', 'tag.gpgsign', 'false');
    git(repoDir, 'add', '-A');
    git(repoDir, 'commit', '-q', '-m', 'baseline');
    baselineCommit = git(repoDir, 'rev-parse', 'HEAD');
    if (baseline) {
      const lf = sha256(Buffer.from(fs.readFileSync(intentFile).toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
      git(repoDir, 'tag', '-a', 'sigma/intent-v1-base', baselineCommit, '-m', 'baseline');
      const written = fs.readJsonSync(chainPath(real, 'v1')) as Record<string, any>;
      written.intent.git_baseline = {
        commit: baselineCommit,
        tag: 'sigma/intent-v1-base',
        doc_sha256: written.intent.certified_doc_sha256 ?? sha256(fs.readFileSync(intentFile)),
        doc_sha256_lf: lf,
        revision: 1,
        provenance: 'ratified_commit',
        recorded_at: new Date().toISOString(),
      };
      fs.writeJsonSync(chainPath(real, 'v1'), written);
    }
  }

  return {
    env: real,
    repoDir,
    projectDir,
    intentFile,
    intentRel: path.relative(repoDir, intentFile).split(path.sep).join('/'),
    baselineCommit,
    cleanup: () => {
      fs.removeSync(projectDir);
      fs.removeSync(real.homeDir);
      if (outer) fs.removeSync(outer);
    },
  };
}

/** Appends a line to the INTENT (LF or CRLF to match the file). */
export function editIntent(p: GitProject, line = 'Scope: added an amendment line.'): void {
  const current = fs.readFileSync(p.intentFile, 'utf8');
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(p.intentFile, current + eol + line + eol);
}

export function commitIntent(p: GitProject, message = 'amend intent'): string {
  git(p.repoDir, 'add', '--', p.intentRel);
  git(p.repoDir, 'commit', '-q', '-m', message, '--', p.intentRel);
  return git(p.repoDir, 'rev-parse', 'HEAD');
}

export function amendArgs(p: GitProject, commit: string, extra: { change?: string; purpose?: string; hash?: string; confirm?: boolean } = {}): string {
  const hash = extra.hash ?? sha256(fs.readFileSync(p.intentFile));
  return [
    'intent amendment',
    `--change "${extra.change ?? 'Widen scope per Director'}"`,
    `--purpose-changed ${extra.purpose ?? 'no'}`,
    `--commit ${commit}`,
    `--doc-sha256 ${hash}`,
    extra.confirm === false ? '' : '--director-confirm',
  ].filter(Boolean).join(' ');
}
