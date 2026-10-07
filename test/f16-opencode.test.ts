/**
 * f16-opencode.test.ts — F16: opencode target added, Cursor target removed.
 *
 * Contracts (F16 §9): U-01 detection, U-02 command deploy, U-03 protection plugin,
 * U-05 uninstall, U-06 project start/sync, U-07 Cursor removal.
 * U-04 (MCP writer) lives in mcp-config.test.ts; U-08 in f16-opencode-integration.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { parse as parseJsonc } from 'jsonc-parser';
import { runCli, setupTestEnv, TestEnv } from './helpers';

const REPO_ROOT = path.resolve(__dirname, '..');
const OPENCODE_SOURCE = path.join(REPO_ROOT, 'setup', 'targets', 'opencode');
const CLAUDE_SOURCE = path.join(REPO_ROOT, 'setup', 'targets', 'claude_code');
const ROLE_FILES = [
  'arc.md', 'fmn.md', 'dev.md', 'aud.md', 'report.md',
  'sigma-test.md', 'humanize.md', 'write-memo.md', 'read-memo.md',
];

const lf = (s: string) => s.replace(/\r\n/g, '\n');

function ocDir(env: TestEnv) { return path.join(env.homeDir, '.config', 'opencode'); }
function commandsDir(env: TestEnv) { return path.join(ocDir(env), 'commands'); }
function pluginFile(env: TestEnv) { return path.join(ocDir(env), 'plugins', 'protect-sigma.js'); }

let env: TestEnv;
beforeEach(() => { env = setupTestEnv(); });
afterEach(() => env.cleanup());

// ── U-01 ─────────────────────────────────────────────────────────────────────

describe('F16 U-01 detectTools', () => {
  let savedHome: string | undefined;
  let savedProfile: string | undefined;
  beforeEach(() => {
    savedHome = process.env['HOME'];
    savedProfile = process.env['USERPROFILE'];
    process.env['HOME'] = env.homeDir;
    process.env['USERPROFILE'] = env.homeDir;
  });
  afterEach(() => {
    if (savedHome === undefined) delete process.env['HOME']; else process.env['HOME'] = savedHome;
    if (savedProfile === undefined) delete process.env['USERPROFILE']; else process.env['USERPROFILE'] = savedProfile;
  });

  it('detects opencode from ~/.config/opencode and not otherwise', async () => {
    const { detectTools } = await import('../src/utils/detect');
    expect(detectTools().opencode).toBe(false);
    fs.ensureDirSync(ocDir(env));
    expect(detectTools().opencode).toBe(true);
  });

  it('no longer reports cursor, even when ~/.cursor/rules exists', async () => {
    const { detectTools, targetPaths } = await import('../src/utils/detect');
    fs.ensureDirSync(path.join(env.homeDir, '.cursor', 'rules'));
    expect(Object.keys(detectTools())).not.toContain('cursor');
    expect(Object.keys(targetPaths())).not.toContain('cursorRules');
  });

  it('exposes the opencode command and plugin directories', async () => {
    const { targetPaths } = await import('../src/utils/detect');
    const p = targetPaths();
    expect(p.opencodeCommands).toBe(commandsDir(env));
    expect(p.opencodePlugins).toBe(path.join(ocDir(env), 'plugins'));
  });
});

// ── U-02 ─────────────────────────────────────────────────────────────────────

describe('F16 U-02 command deploy', () => {
  it('writes the nine commands and the plugin when opencode is detected', () => {
    fs.ensureDirSync(ocDir(env));

    const r = runCli('setup install --yes --force', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.readdirSync(commandsDir(env)).sort()).toEqual([...ROLE_FILES].sort());
    expect(fs.existsSync(pluginFile(env))).toBe(true);
    expect(r.stdout).toContain('opencode');
  });

  it('does not create ~/.config/opencode when opencode is absent', () => {
    fs.ensureDirSync(path.join(env.homeDir, '.claude'));

    const r = runCli('setup install --yes --force', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.existsSync(ocDir(env))).toBe(false);
  });

  it('overwrites Sigma commands but leaves other files in the same folder alone', () => {
    fs.ensureDirSync(commandsDir(env));
    fs.writeFileSync(path.join(commandsDir(env), 'arc.md'), 'stale\n');
    fs.writeFileSync(path.join(commandsDir(env), 'mine.md'), 'my own command\n');

    const r = runCli('setup install --yes --force', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(lf(fs.readFileSync(path.join(commandsDir(env), 'arc.md'), 'utf-8')))
      .toBe(lf(fs.readFileSync(path.join(OPENCODE_SOURCE, 'arc.md'), 'utf-8')));
    expect(fs.readFileSync(path.join(commandsDir(env), 'mine.md'), 'utf-8')).toBe('my own command\n');
  });

  it('keeps content parity with claude_code/ for every command except sigma-test', () => {
    for (const file of ROLE_FILES.filter((f) => f !== 'sigma-test.md')) {
      expect(lf(fs.readFileSync(path.join(OPENCODE_SOURCE, file), 'utf-8')), file)
        .toBe(lf(fs.readFileSync(path.join(CLAUDE_SOURCE, file), 'utf-8')));
    }
  });

  it('sigma-test points at opencode paths and platform label', () => {
    const text = fs.readFileSync(path.join(OPENCODE_SOURCE, 'sigma-test.md'), 'utf-8');
    expect(text).toContain('~/.config/opencode/commands/');
    expect(text).toContain('Platform: opencode');
    expect(text).not.toContain('~/.claude');
    expect(text).not.toContain('Claude Code');
  });

  it('contains no opencode template-injection syntax and has readable frontmatter', () => {
    for (const file of ROLE_FILES) {
      const text = lf(fs.readFileSync(path.join(OPENCODE_SOURCE, file), 'utf-8'));
      expect(text, `${file}: !\`cmd\``).not.toMatch(/!`/);
      expect(text, `${file}: $ARGUMENTS`).not.toContain('$ARGUMENTS');
      expect(text, `${file}: $1..$9`).not.toMatch(/\$[1-9]\b/);
      expect(text, `${file}: @path`).not.toMatch(/(^|[\s(`"'])@[A-Za-z0-9_.~/\\-]+/);

      const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
      expect(fm, `${file}: frontmatter`).not.toBeNull();
      expect(fm![1], `${file}: description`).toMatch(/^description:\s*\S/m);
    }
  });

  it('install is idempotent', () => {
    fs.ensureDirSync(ocDir(env));
    runCli('setup install --yes --force', env.projectDir, env.homeDir);
    const before = fs.readFileSync(pluginFile(env), 'utf-8');

    const r = runCli('setup install --yes --force', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.readFileSync(pluginFile(env), 'utf-8')).toBe(before);
    expect(fs.readdirSync(commandsDir(env))).toHaveLength(ROLE_FILES.length);
  });
});

// ── U-03 ─────────────────────────────────────────────────────────────────────

describe('F16 U-03 protection plugin', () => {
  type Hooks = { 'tool.execute.before': (input: unknown, output: unknown) => Promise<void> };

  async function loadHook(): Promise<Hooks['tool.execute.before']> {
    const mod = await import(path.join(OPENCODE_SOURCE, 'plugins', 'protect-sigma.js'));
    // opencode treats every export as a plugin function — the module must have exactly one.
    expect(Object.keys(mod)).toEqual(['SigmaProtect']);
    const hooks = (await mod.SigmaProtect({})) as Hooks;
    return hooks['tool.execute.before'];
  }

  const call = async (tool: string, args: unknown) => {
    const hook = await loadHook();
    return hook({ tool, sessionID: 's', callID: 'c' }, { args });
  };

  it.each([
    ['edit', 'filePath', 'Sigma/progress.json'],
    ['edit', 'filePath', 'Sigma/progress-v2.json'],
    ['write', 'filePath', 'C:\\work\\proj\\Sigma\\progress-v12.json'],
    ['write', 'filePath', '/home/me/proj/Sigma/progress-v1.json'],
    ['edit', 'path', 'Sigma/progress-v1.json'],
    ['edit', 'file_path', 'Sigma/progress-v1.json'],
    ['multiedit', 'filePath', 'Sigma/progress-v1.json'],
  ])('blocks %s on %s=%s', async (tool, key, value) => {
    await expect(call(tool, { [key]: value, oldString: 'a', newString: 'b' })).rejects.toThrow(/CLI-managed/);
  });

  it.each([
    'Sigma/notes/progress.json.md',
    'Sigma/progress-draft.json',
    'src/progress.json',
    'Sigma/progress-v1.json.bak',
    'docs/Sigma-progress-v1.json',
  ])('allows edit/write on %s', async (value) => {
    await expect(call('edit', { filePath: value })).resolves.toBeUndefined();
    await expect(call('write', { filePath: value, content: 'x' })).resolves.toBeUndefined();
  });

  const patch = (...lines: string[]) => ['*** Begin Patch', ...lines, '*** End Patch'].join('\n');

  it.each([
    ['Update File', 'Sigma/progress-v3.json'],
    ['Add File', 'Sigma/progress-v4.json'],
    ['Delete File', 'Sigma\\progress.json'],
    ['Move to', 'Sigma/progress-v5.json'],
  ])('blocks apply_patch with a "%s" header on %s', async (header, file) => {
    const text = header === 'Move to'
      ? patch('*** Update File: notes.json', `*** Move to: ${file}`, '@@', '-a', '+b')
      : patch(`*** ${header}: ${file}`, '@@', '-a', '+b');
    await expect(call('apply_patch', { patchText: text })).rejects.toThrow(/CLI-managed/);
  });

  it('blocks a multi-file patch if any one file is protected, including CRLF input', async () => {
    const text = patch('*** Update File: src/a.ts', '@@', '-a', '+b', '*** Update File: Sigma/progress-v1.json', '@@', '-x', '+y')
      .replace(/\n/g, '\r\n');
    await expect(call('apply_patch', { patchText: text })).rejects.toThrow(/CLI-managed/);
  });

  it('does not block a patch that only mentions the file name in its content', async () => {
    const text = patch(
      '*** Update File: docs/notes.md', '@@',
      '-old', '+see Sigma/progress-v1.json for the state',
      '+*** Update File: Sigma/progress-v1.json',
    );
    await expect(call('apply_patch', { patchText: text })).resolves.toBeUndefined();
  });

  it('never throws on unknown tools or argument shapes (fail-open)', async () => {
    await expect(call('bash', { command: 'rm Sigma/progress-v1.json' })).resolves.toBeUndefined();
    await expect(call('read', { filePath: 'Sigma/progress-v1.json' })).resolves.toBeUndefined();
    await expect(call('edit', undefined)).resolves.toBeUndefined();
    await expect(call('edit', null)).resolves.toBeUndefined();
    await expect(call('edit', { filePath: 42 })).resolves.toBeUndefined();
    await expect(call('apply_patch', { patchText: 42 })).resolves.toBeUndefined();
    await expect(call('apply_patch', {})).resolves.toBeUndefined();
    const hook = await loadHook();
    await expect(hook(undefined, undefined)).resolves.toBeUndefined();
  });

  it('names the commands that apply today, not the removed plan lock', async () => {
    const err = await call('edit', { filePath: 'Sigma/progress-v1.json' }).catch((e: Error) => e);
    expect((err as Error).message).toContain('sigma intent ratify');
    expect((err as Error).message).toContain('sigma plan approve');
    expect((err as Error).message).not.toContain('plan lock');
  });

  it('the Claude hook message was updated the same way (O-6)', () => {
    const text = fs.readFileSync(path.join(REPO_ROOT, 'setup', 'targets', 'hooks', 'protect-sigma.js'), 'utf-8');
    expect(text).toContain('sigma plan approve');
    expect(text).not.toContain('plan lock');
  });
});

// ── U-05 ─────────────────────────────────────────────────────────────────────

describe('F16 U-05 uninstall', () => {
  function installOpencode() {
    fs.ensureDirSync(ocDir(env));
    expect(runCli('setup install --yes --force', env.projectDir, env.homeDir).exitCode).toBe(0);
  }

  it('dry-run lists the opencode commands and plugin and removes nothing', () => {
    installOpencode();

    const r = runCli('setup uninstall', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain(path.join(commandsDir(env), 'arc.md'));
    expect(r.stdout).toContain(pluginFile(env));
    expect(fs.existsSync(pluginFile(env))).toBe(true);
    expect(fs.existsSync(path.join(commandsDir(env), 'arc.md'))).toBe(true);
  });

  it('removes Sigma commands and plugin; keeps user files and project config', () => {
    installOpencode();
    fs.writeFileSync(path.join(commandsDir(env), 'mine.md'), 'mine\n');
    fs.writeFileSync(path.join(ocDir(env), 'plugins', 'other.js'), 'export const X = async () => ({})\n');
    fs.writeFileSync(path.join(ocDir(env), 'opencode.jsonc'), '{ "theme": "dark" }\n');
    const projectConfig = path.join(env.projectDir, 'opencode.json');
    fs.writeJsonSync(projectConfig, { mcp: { sigma: { type: 'local', command: ['sigma-mcp'] } } });

    const r = runCli('setup uninstall --confirm', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    for (const f of ROLE_FILES) expect(fs.existsSync(path.join(commandsDir(env), f)), f).toBe(false);
    expect(fs.existsSync(pluginFile(env))).toBe(false);
    expect(fs.readFileSync(path.join(commandsDir(env), 'mine.md'), 'utf-8')).toBe('mine\n');
    expect(fs.existsSync(path.join(ocDir(env), 'plugins', 'other.js'))).toBe(true);
    expect(fs.readFileSync(path.join(ocDir(env), 'opencode.jsonc'), 'utf-8')).toBe('{ "theme": "dark" }\n');
    expect(fs.readJsonSync(projectConfig).mcp.sigma.command).toEqual(['sigma-mcp']);
    expect(r.stdout + r.stderr).toContain('opencode.json');
    expect(r.stdout + r.stderr).not.toMatch(/\.cursor\/mcp\.json/);
  });

  it('does not remove a protect-sigma.js that Sigma did not write', () => {
    fs.ensureDirSync(path.join(ocDir(env), 'plugins'));
    fs.writeFileSync(pluginFile(env), '// somebody else\nexport const X = async () => ({})\n');

    runCli('setup uninstall --confirm', env.projectDir, env.homeDir);

    expect(fs.existsSync(pluginFile(env))).toBe(true);
  });
});

// ── U-06 ─────────────────────────────────────────────────────────────────────

describe('F16 U-06 project start / sync', () => {
  it('project start writes opencode.json (bound, with $schema) and no .cursor/mcp.json', () => {
    const r = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    const cfg = fs.readJsonSync(path.join(env.projectDir, 'opencode.json'));
    expect(cfg.$schema).toBe('https://opencode.ai/config.json');
    expect(cfg.mcp.sigma.type).toBe('local');
    expect(cfg.mcp.sigma.enabled).toBe(true);
    expect(cfg.mcp.sigma.command.slice(0, 3)).toEqual(['sigma-mcp', '--mode', 'query']);
    expect(cfg.mcp.sigma.command).toContain('--project-root');
    expect(cfg.mcp.sigma.command).toContain('--project-id');
    expect(cfg.mcp.sigma.command[cfg.mcp.sigma.command.indexOf('--project-id') + 1]).toBe('TEST');
    expect(fs.existsSync(path.join(env.projectDir, '.cursor'))).toBe(false);
    expect(r.stdout).toContain('opencode');
  });

  it('project sync --confirm upserts into opencode.jsonc and keeps its comments', () => {
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);
    fs.removeSync(path.join(env.projectDir, 'opencode.json'));
    fs.writeFileSync(
      path.join(env.projectDir, 'opencode.jsonc'),
      '{\n  // team settings\n  "theme": "dark",\n}\n',
    );

    const r = runCli('project sync --confirm', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    const text = fs.readFileSync(path.join(env.projectDir, 'opencode.jsonc'), 'utf-8');
    expect(text).toContain('// team settings');
    expect(parseJsonc(text, [], { allowTrailingComma: true }).mcp.sigma.command[0]).toBe('sigma-mcp');
    expect(fs.existsSync(path.join(env.projectDir, 'opencode.json'))).toBe(false);
    expect(fs.existsSync(path.join(env.projectDir, '.cursor'))).toBe(false);
  });

  it('project sync warns and leaves an unparseable opencode.json untouched', () => {
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);
    const broken = '{ "mcp": ';
    fs.writeFileSync(path.join(env.projectDir, 'opencode.json'), broken);

    const r = runCli('project sync --confirm', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.readFileSync(path.join(env.projectDir, 'opencode.json'), 'utf-8')).toBe(broken);
    expect(r.stdout + r.stderr).toContain('left unchanged');
  });

  it('project sync dry-run names the opencode config instead of .cursor/mcp.json', () => {
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const r = runCli('project sync', env.projectDir, env.homeDir);

    expect(r.stdout).toContain('opencode.jsonc / opencode.json');
    expect(r.stdout).not.toContain('.cursor');
  });

  it('the AGENTS.md bridge is neutral for Codex and opencode', () => {
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const text = fs.readFileSync(path.join(env.projectDir, 'AGENTS.md'), 'utf-8');

    expect(text).toContain('Codex and opencode');
    expect(text).not.toMatch(/apply strictly to the Codex model/);
    for (const role of ['arc', 'fmn', 'dev', 'aud']) {
      expect(text).toContain(`\`#${role}\` in Codex, \`/${role}\` in opencode`);
    }
  });
});

// ── U-07 ─────────────────────────────────────────────────────────────────────

describe('F16 U-07 Cursor removal', () => {
  const MARKED = '---\ndescription: Sigma governance protocol for Cursor — provides lifecycle state awareness\nalwaysApply: true\n---\nbody\n';
  const rulesDir = () => path.join(env.homeDir, '.cursor', 'rules');

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else out.push(full);
    }
    return out;
  }

  it('the Cursor target and its writers are gone from the source tree', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'setup', 'targets', 'cursor'))).toBe(false);

    const hits = walk(path.join(REPO_ROOT, 'src'))
      .filter((f) => /cursor/i.test(fs.readFileSync(f, 'utf-8')))
      .map((f) => path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
    // The only legitimate mention is the legacy-file cleanup in setup.ts (O-8).
    expect(hits).toEqual(['src/commands/setup.ts']);

    const setupSrc = fs.readFileSync(path.join(REPO_ROOT, 'src', 'commands', 'setup.ts'), 'utf-8');
    expect(setupSrc).not.toMatch(/writeCursorMcpConfig|cursorRules|\.cursor\/mcp\.json/);
    expect(fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf-8')).not.toMatch(/cursor/i);
    for (const f of walk(path.join(REPO_ROOT, 'setup'))) {
      expect(fs.readFileSync(f, 'utf-8'), f).not.toMatch(/cursor/i);
    }
  });

  it('setup update removes a Sigma-marked SIGMA.mdc and nothing else under ~/.cursor', () => {
    fs.ensureDirSync(rulesDir());
    fs.writeFileSync(path.join(rulesDir(), 'SIGMA.mdc'), MARKED);
    fs.writeFileSync(path.join(rulesDir(), 'mine.mdc'), 'mine\n');

    const r = runCli('setup update', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.existsSync(path.join(rulesDir(), 'SIGMA.mdc'))).toBe(false);
    expect(fs.readFileSync(path.join(rulesDir(), 'mine.mdc'), 'utf-8')).toBe('mine\n');
    expect(r.stdout).toContain('legacy Cursor rules file');
  });

  it('setup update leaves a SIGMA.mdc without the Sigma marker alone', () => {
    fs.ensureDirSync(rulesDir());
    fs.writeFileSync(path.join(rulesDir(), 'SIGMA.mdc'), 'my own SIGMA rules\n');

    runCli('setup update', env.projectDir, env.homeDir);

    expect(fs.readFileSync(path.join(rulesDir(), 'SIGMA.mdc'), 'utf-8')).toBe('my own SIGMA rules\n');
  });

  it('setup uninstall lists then removes the marked file; ~/.cursor itself stays', () => {
    fs.ensureDirSync(rulesDir());
    fs.writeFileSync(path.join(rulesDir(), 'SIGMA.mdc'), MARKED);

    const dry = runCli('setup uninstall', env.projectDir, env.homeDir);
    expect(dry.stdout).toContain(path.join(rulesDir(), 'SIGMA.mdc'));
    expect(fs.existsSync(path.join(rulesDir(), 'SIGMA.mdc'))).toBe(true);

    const r = runCli('setup uninstall --confirm', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(fs.existsSync(path.join(rulesDir(), 'SIGMA.mdc'))).toBe(false);
    expect(fs.existsSync(rulesDir())).toBe(true);
  });

  it('setup install no longer deploys anything to ~/.cursor', () => {
    fs.ensureDirSync(rulesDir());

    const r = runCli('setup install --yes --force', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.readdirSync(rulesDir())).toEqual([]);
  });
});
