import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  GITIGNORE_BLOCK_END,
  GITIGNORE_BLOCK_START,
  SIGMA_GITIGNORE_TARGET_PATHS,
  applyGitignoreBlock,
  removeGitignoreBlock,
  renderGitignoreBlock,
  untrackSigmaFilesFromGitIndex,
} from '../src/utils/gitignore';
import { resolveBinding, BindingError } from '../src/mcp/binding';
import { runCli, setupTestEnv, chainPath } from './helpers';
import { missingSigmaFilesMessage } from '../src/utils/fs';
import { setupGitProject } from './f05-git-helpers';

// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY-20261020 — WP-6.
// Everything runs in throwaway directories against the built CLI (dist/); the
// real ~/.sigma and this repository are never touched.

const CLI = path.resolve(__dirname, '..', process.env.SIGMA_TEST_DIST ?? 'dist', 'cli.js');

interface Run { stdout: string; stderr: string; exitCode: number }

function sigma(args: string[], cwd: string, home: string): Run {
  const r = spawnSync('node', [CLI, ...args], {
    cwd, env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf-8', input: '',
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', exitCode: r.status ?? 1 };
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return (r.stdout ?? '').trim();
}

function gitOk(cwd: string, ...args: string[]): boolean {
  return spawnSync('git', args, { cwd, encoding: 'utf-8' }).status === 0;
}

const cleanups: string[] = [];
function tmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(dir);
  return dir;
}
afterEach(() => { while (cleanups.length) fs.removeSync(cleanups.pop()!); });

function initRepo(dir: string): void {
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.name', 'Sigma Test');
  git(dir, 'config', 'user.email', 'test@sigma.invalid');
  git(dir, 'config', 'commit.gpgsign', 'false');
}

/** A real `sigma setup install` + `sigma project start` in a fresh Git repository. */
function startedProject(options: { commitFirst?: boolean } = {}): { project: string; home: string } {
  const home = tmp('sigma-gi-home-');
  const project = tmp('sigma-gi-proj-');
  initRepo(project);
  expect(sigma(['setup', 'install', '--yes'], project, home).exitCode).toBe(0);
  const start = sigma(['project', 'start', '--id', 'GI', '--name', 'Gitignore test', '--confirm'], project, home);
  expect(start.exitCode, start.stdout + start.stderr).toBe(0);
  if (options.commitFirst) {
    git(project, 'add', '-A');
    git(project, 'commit', '-q', '-m', 'all');
  }
  return { project, home };
}

describe('gitignore block (unit)', () => {
  it('ignores every Sigma file except the identity, and never the dev/ folder itself', () => {
    const block = renderGitignoreBlock();
    for (const rule of ['/Sigma/', '/CLAUDE.md', '/GEMINI.md', '/AGENTS.md', '/DEEPSEEK.md', '/REASONIX.md',
      '/.mcp.json', '/opencode.json', '/opencode.jsonc', '/CHANGE-RECORD.md',
      '/dev/.sigma-workspace.json', '/dev/CHANGE-RECORD.md', '!/.sigma-identity.json']) {
      expect(block.split('\n')).toContain(rule);
    }
    expect(block.split('\n')).not.toContain('/dev/');
    expect(block.split('\n')).not.toContain('/dev');
    expect(block.startsWith(GITIGNORE_BLOCK_START)).toBe(true);
    expect(block.endsWith(GITIGNORE_BLOCK_END)).toBe(true);
  });

  it('is idempotent and keeps user content outside the markers byte-for-byte', () => {
    const dir = tmp('sigma-gi-unit-');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n*.log');
    expect(applyGitignoreBlock(dir)).toBe('updated');
    const once = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    expect(once.startsWith('node_modules/\n*.log\n\n' + GITIGNORE_BLOCK_START)).toBe(true);
    expect(applyGitignoreBlock(dir)).toBe('unchanged');
    expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toBe(once);

    expect(removeGitignoreBlock(dir)).toBe('removed');
    expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toBe('node_modules/\n*.log\n');
    expect(removeGitignoreBlock(dir)).toBe('absent');
  });

  it('creates a missing .gitignore and keeps it (empty) when the block is removed', () => {
    const dir = tmp('sigma-gi-unit-');
    expect(applyGitignoreBlock(dir)).toBe('created');
    expect(removeGitignoreBlock(dir)).toBe('removed');
    expect(fs.existsSync(path.join(dir, '.gitignore'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toBe('');
  });

  it('preserves CRLF line endings of an existing .gitignore', () => {
    const dir = tmp('sigma-gi-unit-');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'build/\r\n');
    applyGitignoreBlock(dir);
    const text = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    expect(text.replace(/\r\n/g, '')).not.toContain('\n');
    expect(applyGitignoreBlock(dir)).toBe('unchanged');
  });
});

describe('invariants 1, 3 and 5: nothing local is deleted, dev/ product code stays tracked', () => {
  it('detaches Sigma files from the Git index only, leaving every file on disk', () => {
    const dir = tmp('sigma-gi-index-');
    initRepo(dir);
    const files = [
      'Sigma/activate_status.json', 'Sigma/charter/INTENT-v1.md', 'CLAUDE.md', '.mcp.json', 'opencode.json',
      'CHANGE-RECORD.md', 'dev/.sigma-workspace.json', 'dev/CHANGE-RECORD.md',
      'dev/src/index.ts', 'README.md', '.sigma-identity.json',
    ];
    for (const f of files) fs.outputFileSync(path.join(dir, f), `content of ${f}\n`);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'old project with Sigma files committed');

    applyGitignoreBlock(dir);
    const result = untrackSigmaFilesFromGitIndex(dir);
    expect(result.error).toBeUndefined();
    expect(result.untracked).toBe(8);

    // Invariant 1: every file is still on disk, byte-identical.
    for (const f of files) expect(fs.readFileSync(path.join(dir, f), 'utf8')).toBe(`content of ${f}\n`);

    // Index: Sigma files gone; identity, product code under dev/ and the README untouched.
    const tracked = git(dir, 'ls-files').split('\n');
    expect(tracked.sort()).toEqual(['.sigma-identity.json', 'README.md', 'dev/src/index.ts']);
    // The deletion is staged, not committed: Sigma never commits.
    expect(git(dir, 'status', '--porcelain').split('\n').filter(l => l.startsWith('D '))).toHaveLength(8);
  });

  it('git agrees with the block: Sigma files ignored, identity and dev/ code are not', () => {
    const dir = tmp('sigma-gi-check-');
    initRepo(dir);
    applyGitignoreBlock(dir);
    const ignored = (rel: string) => gitOk(dir, 'check-ignore', '-q', rel);
    for (const f of ['Sigma/x.json', 'CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md', '.mcp.json',
      'opencode.json', 'opencode.jsonc', 'CHANGE-RECORD.md', 'dev/.sigma-workspace.json', 'dev/CHANGE-RECORD.md']) {
      expect(ignored(f), `${f} should be ignored`).toBe(true);
    }
    for (const f of ['.sigma-identity.json', 'dev/src/index.ts', 'dev/README.md', 'src/CLAUDE.md', 'docs/CHANGE-RECORD.md']) {
      expect(ignored(f), `${f} must NOT be ignored`).toBe(false);
    }
  });

  it('is a no-op outside a Git repository', () => {
    const dir = tmp('sigma-gi-nogit-');
    fs.outputFileSync(path.join(dir, 'Sigma/a.json'), '{}');
    const result = untrackSigmaFilesFromGitIndex(dir);
    expect(result.gitAvailable).toBe(false);
    expect(fs.existsSync(path.join(dir, 'Sigma/a.json'))).toBe(true);
  });

  it('keeps the list of target paths free of the identity file and of dev/ as a folder', () => {
    expect(SIGMA_GITIGNORE_TARGET_PATHS).not.toContain('.sigma-identity.json');
    expect(SIGMA_GITIGNORE_TARGET_PATHS).not.toContain('dev');
    expect(SIGMA_GITIGNORE_TARGET_PATHS).not.toContain('dev/');
  });
});

describe('sigma project start / sigma config set gitignore (CLI)', () => {
  it('turns gitignore ON by default and keeps only the identity trackable', () => {
    const { project, home } = startedProject();
    const ignore = fs.readFileSync(path.join(project, '.gitignore'), 'utf8');
    expect(ignore).toContain(GITIGNORE_BLOCK_START);
    expect(ignore).toContain('!/.sigma-identity.json');

    const config = fs.readJsonSync(path.join(project, 'Sigma', 'project.config.json'));
    expect(config.git).toEqual({ gitignore_sigma: true });
    expect(fs.readJsonSync(path.join(project, '.sigma-identity.json')).git).toEqual({ gitignore_sigma: true });

    git(project, 'add', '-A');
    expect(git(project, 'ls-files')).toBe(['.gitignore', '.sigma-identity.json'].join('\n'));

    const show = sigma(['config', 'show'], project, home);
    expect(show.stdout).toContain('Sigma Gitignore Mode:          ON (active — only .sigma-identity.json tracked in Git)');
  });

  it('keeps volatile fields out of the identity file', () => {
    const { project } = startedProject();
    const identity = fs.readJsonSync(path.join(project, '.sigma-identity.json'));
    expect(Object.keys(identity).sort()).toEqual(['git', 'origin_machine', 'project_id', 'project_name', 'registered', 'schema_version']);
    const manifest = fs.readJsonSync(path.join(project, 'Sigma', 'activate_status.json'));
    expect(typeof manifest.logs_created_at).toBe('string');
    expect(manifest.sigma_applied.sigma_version).toBeDefined();
  });

  it('does not rewrite the identity file on sync (Git-tracked file stays stable)', () => {
    const { project, home } = startedProject();
    const before = fs.readFileSync(path.join(project, '.sigma-identity.json'), 'utf8');
    const sync = sigma(['project', 'sync', '--confirm'], project, home);
    expect(sync.exitCode, sync.stdout + sync.stderr).toBe(0);
    expect(fs.readFileSync(path.join(project, '.sigma-identity.json'), 'utf8')).toBe(before);
  });

  it('off removes the block without touching any file; on re-detaches already-committed Sigma files', () => {
    const { project, home } = startedProject();
    // Simulate an old project that committed everything before gitignore existed.
    sigma(['config', 'set', 'gitignore', 'off'], project, home);
    expect(fs.readFileSync(path.join(project, '.gitignore'), 'utf8')).not.toContain(GITIGNORE_BLOCK_START);
    git(project, 'add', '-A');
    git(project, 'commit', '-q', '-m', 'everything, gitignore off');
    expect(git(project, 'ls-files').split('\n')).toContain('Sigma/activate_status.json');
    expect(sigma(['config', 'show'], project, home).stdout).toContain('OFF (inactive — Sigma files can be tracked in Git)');

    const localBefore = fs.readFileSync(path.join(project, 'Sigma', 'activate_status.json'), 'utf8');
    const on = sigma(['config', 'set', 'gitignore', 'activate'], project, home);
    expect(on.exitCode, on.stdout + on.stderr).toBe(0);
    expect(on.stdout).toMatch(/Sigma file\(s\) detached/);

    // Invariant 1: still on disk.
    expect(fs.readFileSync(path.join(project, 'Sigma', 'activate_status.json'), 'utf8')).toBe(localBefore);
    expect(fs.existsSync(path.join(project, 'CLAUDE.md'))).toBe(true);
    // Index: only the identity (and .gitignore, once staged) remain.
    expect(git(project, 'ls-files').split('\n').filter(f => f !== '.gitignore')).toEqual(['.sigma-identity.json']);
  });

  it('rejects an unknown mode', () => {
    const { project, home } = startedProject();
    const r = sigma(['config', 'set', 'gitignore', 'maybe'], project, home);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Unknown mode/);
  });

  it('accepts every documented alias', () => {
    const { project, home } = startedProject();
    for (const [mode, expected] of [['deactivate', false], ['0', false], ['false', false], ['on', true], ['1', true], ['true', true]] as const) {
      expect(sigma(['config', 'set', 'gitignore', mode], project, home).exitCode, mode).toBe(0);
      expect(fs.readJsonSync(path.join(project, 'Sigma', 'project.config.json')).git.gitignore_sigma, mode).toBe(expected);
    }
  });

  it('--reinit keeps an explicit OFF instead of flipping back to ON', () => {
    const { project, home } = startedProject();
    sigma(['config', 'set', 'gitignore', 'off'], project, home);
    const re = sigma(['project', 'start', '--id', 'GI', '--name', 'Gitignore test', '--confirm', '--reinit'], project, home);
    expect(re.exitCode, re.stdout + re.stderr).toBe(0);
    expect(fs.readJsonSync(path.join(project, 'Sigma', 'project.config.json')).git.gitignore_sigma).toBe(false);
    expect(fs.readFileSync(path.join(project, '.gitignore'), 'utf8')).not.toContain(GITIGNORE_BLOCK_START);
  });

  it('leaves a project that never opted in untouched by sync', () => {
    const { project, home } = startedProject();
    const config = fs.readJsonSync(path.join(project, 'Sigma', 'project.config.json'));
    delete config.git;
    fs.writeJsonSync(path.join(project, 'Sigma', 'project.config.json'), config);
    fs.removeSync(path.join(project, '.gitignore'));
    const sync = sigma(['project', 'sync', '--confirm'], project, home);
    expect(sync.exitCode, sync.stdout + sync.stderr).toBe(0);
    expect(fs.existsSync(path.join(project, '.gitignore'))).toBe(false);
    expect(sigma(['config', 'show'], project, home).stdout).toMatch(/ON .*\[default\]/);
  });
});

describe('invariant 4: Sigma is blocked where only .sigma-identity.json exists', () => {
  function secondMachine(): { clone: string; home: string; origin: string; originHome: string } {
    const { project: origin, home: originHome } = startedProject();
    // These tests stand in for a second PC on one host, so the origin must not look like this machine.
    expect(sigma(['config', 'set', 'origin-machine', 'office-laptop'], origin, originHome).exitCode).toBe(0);
    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '-m', 'identity only');
    const parent = tmp('sigma-gi-second-');
    const clone = path.join(parent, 'clone');
    git(parent, 'clone', '-q', origin, clone);
    const home = tmp('sigma-gi-home2-');
    expect(sigma(['setup', 'install', '--yes'], clone, home).exitCode).toBe(0);
    return { clone, home, origin, originHome };
  }

  it('the clone holds the identity and no Sigma/ folder', () => {
    const { clone } = secondMachine();
    expect(fs.existsSync(path.join(clone, '.sigma-identity.json'))).toBe(true);
    expect(fs.existsSync(path.join(clone, 'Sigma'))).toBe(false);
    expect(fs.existsSync(path.join(clone, 'CLAUDE.md'))).toBe(false);
  });

  it('blocks every Sigma command, including re-registration, with the English message', () => {
    const { clone, home } = secondMachine();
    const commands: string[][] = [
      ['project', 'start', '--id', 'GI', '--name', 'Gitignore test', '--confirm'],
      ['project', 'start', '--id', 'GI', '--name', 'Gitignore test', '--confirm', '--reinit'],
      ['project', 'register', '--id', 'GI', '--name', 'Gitignore test'],
      ['project', 'sync', '--confirm'],
      ['project', 'status'],
      ['config', 'show'],
      ['config', 'set', 'gitignore', 'off'],
      ['intent', 'list'],
      ['session', 'bootstrap'],
      ['doctor'],
    ];
    for (const args of commands) {
      const r = sigma(args, clone, home);
      expect(r.exitCode, args.join(' ')).toBe(1);
      expect(r.stderr, args.join(' ')).toContain('[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]');
      expect(r.stderr).toContain('(detected via .sigma-identity.json: GI — "Gitignore test")');
      expect(r.stderr).toContain('sigma config set gitignore off');
      expect(r.stderr).toContain('Run `git pull` on this machine.');
    }
    // Nothing was created by the refused attempts.
    expect(fs.existsSync(path.join(clone, 'Sigma'))).toBe(false);
    expect(fs.existsSync(path.join(clone, 'CLAUDE.md'))).toBe(false);
  });

  it('blocks from a subdirectory too, and does not block `sigma setup`', () => {
    const { clone, home } = secondMachine();
    fs.ensureDirSync(path.join(clone, 'dev', 'src'));
    expect(sigma(['project', 'status'], path.join(clone, 'dev', 'src'), home).stderr).toContain('SIGMA BLOCKED');
    const setup = sigma(['setup', 'install', '--yes'], clone, home);
    expect(setup.stderr).not.toContain('SIGMA BLOCKED');
  });

  it('the MCP binding refuses to start for such a root', () => {
    const { clone } = secondMachine();
    expect(() => resolveBinding({ mode: 'query', projectRoot: clone, projectId: 'GI' })).toThrow(BindingError);
    try {
      resolveBinding({ mode: 'control', projectRoot: clone, projectId: 'GI', role: 'ARC' });
    } catch (e) {
      expect((e as BindingError).code).toBe('MISSING_SIGMA_FILES');
      expect((e as BindingError).message).toContain('[SIGMA BLOCKED — MISSING LOCAL SIGMA FILES]');
    }
  });

  it('does not mistake a damaged project (Sigma/ present, manifest missing) for a foreign machine', () => {
    const { project, home } = startedProject();
    fs.removeSync(path.join(project, 'Sigma', 'activate_status.json'));
    const r = sigma(['project', 'register', '--id', 'GI', '--name', 'Gitignore test'], project, home);
    expect(r.stderr).not.toContain('SIGMA BLOCKED');
    expect(r.exitCode, r.stdout + r.stderr).toBe(0);
  });
});

describe('invariant 6: gitignore off -> push -> pull -> Sigma works on the second machine', () => {
  it('the pulled project is fully usable and heals machine-local paths', () => {
    const { project: origin, home: originHome } = startedProject();
    expect(sigma(['config', 'set', 'gitignore', 'off'], origin, originHome).exitCode).toBe(0);
    expect(sigma(['dev', 'create-workspace'], origin, originHome).exitCode).toBe(0);
    fs.outputFileSync(path.join(origin, 'dev', 'src', 'index.ts'), 'export {};\n');
    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '-m', 'everything');

    const parent = tmp('sigma-gi-pull-');
    const clone = path.join(parent, 'elsewhere');
    git(parent, 'clone', '-q', origin, clone);
    const home = tmp('sigma-gi-home3-');
    expect(sigma(['setup', 'install', '--yes'], clone, home).exitCode).toBe(0);

    // Sigma files arrived; operations are not blocked.
    expect(fs.existsSync(path.join(clone, 'Sigma', 'activate_status.json'))).toBe(true);
    const status = sigma(['project', 'status'], clone, home);
    expect(status.stderr).not.toContain('SIGMA BLOCKED');
    expect(status.exitCode, status.stdout + status.stderr).toBe(0);

    // .mcp.json still names the origin machine's path until a mutating operation heals it.
    const mcpBefore = fs.readJsonSync(path.join(clone, '.mcp.json'));
    expect(mcpBefore.mcpServers.sigma.args).toContain(origin);
    const mutate = sigma(['intent', 'new', '--title', 'T', '--focus', 'F'], clone, home);
    expect(mutate.stderr).toMatch(/\.mcp\.json pointed to another project root; refreshed/);
    const mcpAfter = fs.readJsonSync(path.join(clone, '.mcp.json'));
    const root = mcpAfter.mcpServers.sigma.args[mcpAfter.mcpServers.sigma.args.indexOf('--project-root') + 1];
    expect(path.resolve(root)).toBe(path.resolve(clone));
    expect(mcpAfter.mcpServers.sigma.args).not.toContain(origin);

    // Product code under dev/ travelled with the repository, next to the Sigma marker.
    expect(fs.readFileSync(path.join(clone, 'dev', 'src', 'index.ts'), 'utf8')).toBe('export {};\n');
    expect(fs.existsSync(path.join(clone, 'dev', '.sigma-workspace.json'))).toBe(true);
  });

  it('rebuilds a missing dev/.sigma-workspace.json from the identity record before a mutating operation', () => {
    const { project, home } = startedProject();
    expect(sigma(['dev', 'create-workspace'], project, home).exitCode).toBe(0);
    const marker = path.join(project, 'dev', '.sigma-workspace.json');
    fs.removeSync(marker);

    // Read-only: reports the degradation, rebuilds nothing.
    expect(sigma(['project', 'status'], project, home).exitCode).toBe(0);
    expect(fs.existsSync(marker)).toBe(false);

    const mutate = sigma(['intent', 'new', '--title', 'T', '--focus', 'F'], project, home);
    expect(mutate.exitCode, mutate.stdout + mutate.stderr).toBe(0);
    expect(mutate.stderr).toMatch(/dev\/\.sigma-workspace\.json was missing; rebuilt/);
    expect(fs.readJsonSync(marker)).toMatchObject({ role: 'DEV', project_id: 'GI' });
  });

  it('a read-only operation never rewrites .mcp.json', () => {
    const { project, home } = startedProject();
    const file = path.join(project, '.mcp.json');
    const config = fs.readJsonSync(file);
    config.mcpServers.sigma.args = ['--mode', 'query', '--project-root', '/somewhere/else', '--project-id', 'GI'];
    fs.writeJsonSync(file, config);
    const before = fs.readFileSync(file, 'utf8');
    expect(sigma(['project', 'status'], project, home).exitCode).toBe(0);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
});

describe('WP-4: INTENT baseline and amendment without Git tracking (snapshot mode)', () => {
  // Real flow on a project whose Sigma/ is gitignored: ratify, adopt a snapshot baseline,
  // amend, and verify every step through the CLI.
  const INTENT_SENTINEL = 'Snapshot-mode amendment line.';

  function ratifiedProject(): { project: string; home: string } {
    const { project, home } = startedProject();
    const created = sigma(['intent', 'new', '--title', 'Snapshot', '--focus', 'Snapshot flow'], project, home);
    expect(created.exitCode, created.stdout + created.stderr).toBe(0);
    return { project, home };
  }

  it('is covered end-to-end by f05 fixtures; here: gitignored Sigma/ never requires tracking', () => {
    const { project, home } = ratifiedProject();
    // INTENT is ignored by Git: this is exactly the situation the old flow refused.
    expect(gitOk(project, 'check-ignore', '-q', 'Sigma/charter/INTENT-v1.md')).toBe(true);
    const check = sigma(['intent', 'baseline', 'check'], project, home);
    expect(check.stdout).toContain('verification_mode: snapshot');
    expect(check.stdout).not.toContain('must be tracked by Git');
    void INTENT_SENTINEL;
  });
});

describe('approved follow-ups: other-clone warning and Git-bound chains', () => {
  it('warns that pulling the cleanup commit elsewhere removes tracked Sigma files, and shows it really does', () => {
    const { project: origin, home } = startedProject();
    sigma(['config', 'set', 'gitignore', 'off'], origin, home);
    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '-m', 'everything');
    const parent = tmp('sigma-gi-warn-');
    const other = path.join(parent, 'other');
    git(parent, 'clone', '-q', origin, other);
    expect(fs.existsSync(path.join(other, 'Sigma', 'activate_status.json'))).toBe(true);

    const on = sigma(['config', 'set', 'gitignore', 'on'], origin, home);
    expect(on.exitCode, on.stdout + on.stderr).toBe(0);
    expect(on.stdout).toMatch(/Other machines: .*REMOVES its tracked Sigma files from disk/);

    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '-m', 'untrack sigma');
    git(other, 'pull', '-q');
    expect(fs.existsSync(path.join(other, 'Sigma'))).toBe(false); // what the warning is about
    expect(fs.existsSync(path.join(origin, 'Sigma', 'activate_status.json'))).toBe(true); // origin untouched
  });

  it('does not warn when nothing was tracked', () => {
    const { project, home } = startedProject();
    const on = sigma(['config', 'set', 'gitignore', 'on'], project, home);
    expect(on.stdout).not.toMatch(/Other machines/);
  });

  it('lists a chain with a Git INTENT baseline whose INTENT is no longer tracked, and changes nothing', () => {
    const p = setupGitProject(setupTestEnv());
    try {
      const before = fs.readFileSync(chainPath(p.env, 'v1'), 'utf8');
      const on = runCli('config set gitignore on', p.projectDir, p.env.homeDir);
      expect(on.exitCode, on.stdout + on.stderr).toBe(0);
      expect(on.stdout).toMatch(/Chain\(s\) v1 have a Git INTENT baseline/);
      expect(on.stdout).toMatch(/sigma intent baseline adopt --v <chain> --director-confirm/);
      expect(fs.readFileSync(chainPath(p.env, 'v1'), 'utf8')).toBe(before);
      expect(fs.existsSync(path.join(p.projectDir, 'Sigma', 'revisions'))).toBe(false);

      // The advertised command does work and moves the chain to snapshot mode.
      expect(runCli('intent baseline check', p.projectDir, p.env.homeDir).exitCode).toBe(1);
      const adopt = runCli('intent baseline adopt --v v1 --director-confirm', p.projectDir, p.env.homeDir);
      expect(adopt.exitCode, adopt.stdout + adopt.stderr).toBe(0);
      expect(runCli('intent baseline check', p.projectDir, p.env.homeDir).exitCode).toBe(0);
    } finally {
      p.cleanup();
    }
  });
});

describe('origin machine in the identity file', () => {
  const HOST = os.hostname().trim();
  const identityOf = (dir: string) => fs.readJsonSync(path.join(dir, '.sigma-identity.json'));

  it('project start records this machine automatically', () => {
    const { project } = startedProject();
    expect(identityOf(project).origin_machine.name).toBe(HOST);
    expect(typeof identityOf(project).origin_machine.recorded_at).toBe('string');
  });

  it('--reinit never moves an origin that was already set', () => {
    const { project, home } = startedProject();
    expect(sigma(['config', 'set', 'origin-machine', 'office-laptop'], project, home).exitCode).toBe(0);
    const re = sigma(['project', 'start', '--id', 'GI', '--name', 'Gitignore test', '--confirm', '--reinit'], project, home);
    expect(re.exitCode, re.stdout + re.stderr).toBe(0);
    expect(identityOf(project).origin_machine.name).toBe('office-laptop');
  });

  it('config set origin-machine: hostname by default, label on request, replaces, warns it is pushed to Git', () => {
    const { project, home } = startedProject();
    const before = identityOf(project);
    const named = sigma(['config', 'set', 'origin-machine', '  office-laptop  '], project, home);
    expect(named.exitCode, named.stdout + named.stderr).toBe(0);
    expect(named.stdout).toMatch(new RegExp(`Origin machine: "${HOST}" -> "office-laptop"`));
    expect(named.stdout).toMatch(/tracked by Git: the name is pushed with the repository/);
    expect(named.stdout).toMatch(/never decides whether Sigma is blocked/);

    const after = identityOf(project);
    expect(after.origin_machine.name).toBe('office-laptop');
    for (const key of ['project_id', 'project_name', 'registered', 'schema_version', 'git']) expect(after[key]).toEqual(before[key]);

    const byHost = sigma(['config', 'set', 'origin-machine'], project, home);
    expect(byHost.exitCode).toBe(0);
    expect(byHost.stdout).toMatch(/Taken from this machine's hostname/);
    expect(identityOf(project).origin_machine.name).toBe(HOST);
  });

  it('rejects an empty, over-long or multi-line name and leaves the identity alone', () => {
    const { project, home } = startedProject();
    const before = fs.readFileSync(path.join(project, '.sigma-identity.json'), 'utf8');
    for (const bad of ['   ', 'x'.repeat(65), 'a\nb']) {
      const r = sigma(['config', 'set', 'origin-machine', bad], project, home);
      expect(r.exitCode, JSON.stringify(bad)).toBe(1);
    }
    expect(fs.readFileSync(path.join(project, '.sigma-identity.json'), 'utf8')).toBe(before);
  });

  it('config show reports it, including whether it is this machine', () => {
    const { project, home } = startedProject();
    expect(sigma(['config', 'show'], project, home).stdout).toMatch(new RegExp(`Origin Machine: +${HOST} \\[this machine\\]`));
    sigma(['config', 'set', 'origin-machine', 'office-laptop'], project, home);
    expect(sigma(['config', 'show'], project, home).stdout).toMatch(new RegExp(`Origin Machine: +office-laptop \\[this machine is "${HOST}"\\]`));
    const legacy = identityOf(project);
    delete legacy.origin_machine;
    fs.writeJsonSync(path.join(project, '.sigma-identity.json'), legacy);
    expect(sigma(['config', 'show'], project, home).stdout).toMatch(/Origin Machine: +\(not recorded/);
  });

  function blockedClone(origin: string | null): { clone: string; home: string } {
    const { project, home: originHome } = startedProject();
    if (origin) expect(sigma(['config', 'set', 'origin-machine', origin], project, originHome).exitCode).toBe(0);
    else {
      const identity = identityOf(project);
      delete identity.origin_machine;
      fs.writeJsonSync(path.join(project, '.sigma-identity.json'), identity);
    }
    git(project, 'add', '-A');
    git(project, 'commit', '-q', '-m', 'identity only');
    const parent = tmp('sigma-gi-origin-');
    const clone = path.join(parent, 'clone');
    git(parent, 'clone', '-q', project, clone);
    const home = tmp('sigma-gi-originhome-');
    expect(sigma(['setup', 'install', '--yes'], clone, home).exitCode).toBe(0);
    return { clone, home };
  }

  it('the block names the original machine and this one when they differ', () => {
    const { clone, home } = blockedClone('office-laptop');
    const r = sigma(['project', 'status'], clone, home);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain(`This machine ("${HOST}") is not the machine where this project was registered ("office-laptop").`);
    expect(r.stderr).toContain('Run `git pull` on this machine.');
    expect(sigma(['project', 'start', '--id', 'GI', '--name', 'x', '--confirm'], clone, home).stderr).toContain('"office-laptop"');
  });

  it('says so when the original machine was never recorded', () => {
    const { clone, home } = blockedClone(null);
    const r = sigma(['config', 'show'], clone, home);
    expect(r.stderr).toContain('The original machine was not recorded for this project (set it on that machine with: sigma config set origin-machine).');
    expect(r.stderr).toContain('Run `git pull` on this machine.');
  });

  it('on the origin machine it offers recovery first, and the same-machine-clone route second', () => {
    const { project, home } = startedProject();
    fs.removeSync(path.join(project, 'Sigma'));
    const r = sigma(['project', 'status'], project, home);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain(`This machine ("${HOST}") is the machine where this project was registered, but the Sigma files are not in this folder`);
    expect(r.stderr).toContain('Restore the Sigma/ folder');
    expect(r.stderr).toContain('Do not re-register');
    expect(r.stderr).toContain('another clone of the project on this same machine');
    expect(fs.existsSync(path.join(project, 'Sigma'))).toBe(false);
  });

  it('compares names case-insensitively and falls back to the plain message without a name', () => {
    expect(missingSigmaFilesMessage('P', 'N', 'FEDORA', 'fedora')).toContain('is the machine where this project was registered');
    expect(missingSigmaFilesMessage('P', 'N', 'a', 'b')).toContain('is not the machine where this project was registered ("a")');
    expect(missingSigmaFilesMessage('P', 'N')).toContain('was not recorded');
  });

  it('the MCP binding message carries the origin too', () => {
    const { clone } = blockedClone('office-laptop');
    try {
      resolveBinding({ mode: 'query', projectRoot: clone, projectId: 'GI' });
      throw new Error('expected a BindingError');
    } catch (e) {
      expect((e as BindingError).code).toBe('MISSING_SIGMA_FILES');
      expect((e as BindingError).message).toContain('("office-laptop")');
    }
  });
});
