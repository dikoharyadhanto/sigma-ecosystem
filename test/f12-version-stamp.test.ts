import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { SIGMA_VERSION } from '../src/config';
import { computeAssetsHash } from '../src/services/assetConsistency';
import { computeOrientation } from '../src/mcp/tools/orientation';

// F12 — Sigma version stamp on the global installation and on the project
// identity, and the one-line "outdated" warning. Everything runs against a
// throwaway HOME and project directory through the built CLI (dist/), so the
// real ~/.sigma is never read or written.

const CLI = path.resolve(__dirname, '..', process.env.SIGMA_TEST_DIST ?? 'dist', 'cli.js');

interface Run { stdout: string; stderr: string; exitCode: number }

function sigma(args: string[], cwd: string, home: string): Run {
  const result = spawnSync('node', [CLI, ...args], {
    cwd,
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf-8',
    input: '',
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', exitCode: result.status ?? 1 };
}

const cleanups: string[] = [];
function tmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(dir);
  return dir;
}
afterEach(() => { while (cleanups.length) fs.removeSync(cleanups.pop()!); });

interface World { home: string; project: string; identityPath: string; manifestPath: string; configPath: string }

function installedWorld(): World {
  const home = tmp('sigma-f12-home-');
  const project = tmp('sigma-f12-proj-');
  expect(sigma(['setup', 'install', '--yes'], project, home).exitCode).toBe(0);
  const start = sigma(['project', 'start', '--id', 'F12T', '--name', 'F12 test', '--confirm'], project, home);
  expect(start.exitCode).toBe(0);
  return {
    home, project,
    identityPath: path.join(project, '.sigma-identity.json'),
    manifestPath: path.join(project, 'Sigma', 'activate_status.json'),
    configPath: path.join(home, '.sigma', 'sigma.config.json'),
  };
}

const readJson = (file: string): Record<string, unknown> => fs.readJsonSync(file);

// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY §3.4 item 2: the stamp lives in
// Sigma/activate_status.json so the Git-tracked identity file stays stable.
function removeStamp(w: World): void {
  const manifest = readJson(w.manifestPath);
  delete manifest.sigma_applied;
  fs.writeJsonSync(w.manifestPath, manifest);
}
const stampOf = (w: World) => readJson(w.manifestPath).sigma_applied as Record<string, string> | undefined;

describe('F12 assets hash', () => {
  it('is stable across order and sensitive to content and label', () => {
    const dir = tmp('sigma-f12-hash-');
    const a = path.join(dir, 'a.txt'); const b = path.join(dir, 'b.txt');
    fs.writeFileSync(a, 'one'); fs.writeFileSync(b, 'two');
    const pairs = [
      { label: 'x/a', source: a, target: '' },
      { label: 'x/b', source: b, target: '' },
    ];
    const hash = computeAssetsHash(pairs);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(computeAssetsHash([...pairs].reverse())).toBe(hash);

    fs.writeFileSync(b, 'two!');
    expect(computeAssetsHash(pairs)).not.toBe(hash);
    fs.writeFileSync(b, 'two');

    const swapped = [
      { label: 'x/a', source: b, target: '' },
      { label: 'x/b', source: a, target: '' },
    ];
    expect(computeAssetsHash(swapped)).not.toBe(hash);
  });

  it('keeps package.json and SIGMA_VERSION in step', () => {
    const pkg = readJson(path.resolve(__dirname, '..', 'package.json'));
    expect(pkg.version).toBe(SIGMA_VERSION);
  });
});

describe('F12 stamps', () => {
  it('setup install writes the host stamp and project start writes the project stamp', () => {
    const w = installedWorld();
    const host = readJson(w.configPath);
    expect(host.cli_version).toBe(SIGMA_VERSION);
    expect(host.assets_hash).toMatch(/^sha256:/);
    expect(typeof host.synced_at).toBe('string');

    const applied = stampOf(w)!;
    expect(applied.sigma_version).toBe(SIGMA_VERSION);
    expect(applied.assets_hash).toMatch(/^sha256:/);
    expect(typeof applied.synced_at).toBe('string');
    // Existing identity fields are kept, and the identity carries no volatile stamp.
    expect(readJson(w.identityPath).project_id).toBe('F12T');
    expect(readJson(w.identityPath).sigma_applied).toBeUndefined();
  });

  it('setup update refreshes the host stamp and keeps installed_at', () => {
    const w = installedWorld();
    const config = readJson(w.configPath);
    delete config.assets_hash; delete config.synced_at; config.cli_version = '0.0.1';
    fs.writeJsonSync(w.configPath, config);
    const update = sigma(['setup', 'update'], w.project, w.home);
    expect(update.exitCode).toBe(0);
    const after = readJson(w.configPath);
    expect(after.cli_version).toBe(SIGMA_VERSION);
    expect(after.assets_hash).toMatch(/^sha256:/);
    expect(after.installed_at).toBe(config.installed_at);
  });

  it('project sync dry run writes nothing; sync --confirm stamps an unstamped project', () => {
    const w = installedWorld();
    removeStamp(w);

    const dry = sigma(['project', 'sync'], w.project, w.home);
    expect(dry.exitCode).toBe(0);
    expect(stampOf(w)).toBeUndefined();

    const confirmed = sigma(['project', 'sync', '--confirm'], w.project, w.home);
    expect(confirmed.exitCode).toBe(0);
    expect(stampOf(w)!.sigma_version).toBe(SIGMA_VERSION);
  });

  it('project register stamps only when assets match, and reports otherwise', () => {
    const w = installedWorld();
    removeStamp(w);
    // A project rule that differs from the host copy blocks the stamp.
    fs.appendFileSync(path.join(w.project, 'Sigma', 'rules', 'ARC-RULE.md'), '\nlocal edit\n');
    const registered = sigma(['project', 'register', '--id', 'F12T', '--name', 'F12 test'], w.project, w.home);
    expect(registered.exitCode).toBe(0);
    expect(registered.stdout).toContain('stamp not written');
    expect(stampOf(w)).toBeUndefined();
  });
});

describe('F12 warning', () => {
  it('is silent when host and project are current', () => {
    const w = installedWorld();
    const run = sigma(['config', 'show'], w.project, w.home);
    expect(run.stderr).not.toContain('Sigma:');
  });

  it('reports a project without a stamp as unknown', () => {
    const w = installedWorld();
    removeStamp(w);
    const run = sigma(['config', 'show'], w.project, w.home);
    expect(run.stderr).toContain('has no version stamp');
    expect(run.stderr).toContain('sigma project sync');
    expect(run.stderr.trim().split('\n').filter(l => l.startsWith('Sigma:'))).toHaveLength(1);
  });

  it('reports a project that is behind the host', () => {
    const w = installedWorld();
    fs.appendFileSync(path.join(w.home, '.sigma', 'rules', 'ARC-RULE.md'), '\nnewer rule\n');
    const run = sigma(['config', 'show'], w.project, w.home);
    expect(run.stderr).toContain('is behind ~/.sigma');
    expect(run.stderr).toContain('sigma project sync');
  });

  it('reports a host that is behind the CLI and does not suggest a project sync', () => {
    const w = installedWorld();
    const config = readJson(w.configPath);
    config.assets_hash = 'sha256:' + '0'.repeat(64);
    fs.writeJsonSync(w.configPath, config);
    const run = sigma(['config', 'show'], w.project, w.home);
    expect(run.stderr).toContain('is behind the installed CLI');
    expect(run.stderr).toContain('sigma setup update');
    expect(run.stderr).not.toContain('sigma project sync');
  });

  it('treats a host without a stamp as unknown', () => {
    const w = installedWorld();
    const config = readJson(w.configPath);
    delete config.assets_hash; delete config.synced_at;
    fs.writeJsonSync(w.configPath, config);
    const run = sigma(['config', 'show'], w.project, w.home);
    expect(run.stderr).toContain('has no version stamp');
    expect(run.stderr).toContain('sigma setup update');
  });

  it('does not warn outside a project and does not fail', () => {
    const home = tmp('sigma-f12-home-');
    const outside = tmp('sigma-f12-out-');
    const run = sigma(['config', 'show'], outside, home);
    expect(run.stderr).not.toContain('Sigma: ');
  });

  it('stays silent and does not fail the command when the hash cannot be computed', () => {
    const w = installedWorld();
    // Symbolic links are refused in managed assets, so hashing the host rules throws.
    // A Windows directory junction exercises the same lstat boundary without
    // requiring administrator/Developer Mode privileges to create a file symlink.
    const target = path.join(w.home, 'link-target');
    const link = path.join(w.home, '.sigma', 'rules', 'LINK');
    fs.ensureDirSync(target);
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    const run = sigma(['config', 'show'], w.project, w.home);
    expect(run.exitCode).toBe(0);
    expect(run.stderr).not.toContain('Sigma:');
  });

  it('is not printed by exempt commands', () => {
    const w = installedWorld();
    fs.appendFileSync(path.join(w.home, '.sigma', 'rules', 'ARC-RULE.md'), '\nnewer rule\n');
    const doctor = sigma(['doctor'], w.project, w.home);
    expect(doctor.stderr).not.toContain('is behind');
    const sync = sigma(['project', 'sync'], w.project, w.home);
    expect(sync.stderr).not.toContain('is behind');
  });

  it('is shown once by session bootstrap, on stdout, through the compatibility warnings', () => {
    const w = installedWorld();
    fs.appendFileSync(path.join(w.home, '.sigma', 'rules', 'ARC-RULE.md'), '\nnewer rule\n');
    const run = sigma(['session', 'bootstrap'], w.project, w.home);
    expect(run.exitCode).toBe(0);
    expect(run.stdout.match(/is behind ~\/\.sigma/g)).toHaveLength(1);
    expect(run.stderr).not.toContain('is behind');
  });

  it('doctor --check-assets reports the version status read-only', () => {
    const w = installedWorld();
    const before = fs.readFileSync(w.identityPath, 'utf8');
    const run = sigma(['doctor', '--check-assets'], w.project, w.home);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('Version: installed ' + SIGMA_VERSION);
    expect(run.stdout).toContain('status: current');
    expect(fs.readFileSync(w.identityPath, 'utf8')).toBe(before);
  });

  it('keeps a stamp from being written after a rejected sync', () => {
    const w = installedWorld();
    fs.appendFileSync(path.join(w.home, '.sigma', 'rules', 'ARC-RULE.md'), '\nnewer rule\n');
    const before = stampOf(w);
    const sync = sigma(['project', 'sync', '--confirm'], w.project, w.home);
    expect(sync.exitCode).not.toBe(0);
    expect(stampOf(w)).toEqual(before);
    expect(sigma(['config', 'show'], w.project, w.home).stderr).toContain('is behind ~/.sigma');
  });
});

describe('F12 MCP orientation', () => {
  it('exposes version_status next to the compatibility warnings', () => {
    const w = installedWorld();
    const orientation = computeOrientation(w.project) as { version_status: unknown; compatibility_warnings: string[] };
    expect('version_status' in orientation).toBe(true);
    expect(Array.isArray(orientation.compatibility_warnings)).toBe(true);
  });
});
