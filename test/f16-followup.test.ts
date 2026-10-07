/**
 * f16-followup.test.ts — two findings raised while executing F16, fixed afterwards:
 *   (a) deployed bridge/skill text still named the tombstoned `sigma plan lock` / `sigma exec lock`,
 *       and two bridges lacked the `--related-artifact` handoff rule that AGENTS.md carried;
 *   (b) `project start` / `project sync` wrote ~/.codex and ~/.gemini MCP config for tools that are
 *       not installed (setup install already skipped them).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { runCli, setupTestEnv, TestEnv } from './helpers';

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGETS = path.join(REPO_ROOT, 'setup', 'targets');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('deployed text names the commands that exist today', () => {
  const mdFiles = walk(TARGETS).filter((f) => f.endsWith('.md'));

  it('no bridge or skill tells an AI to run the removed `sigma plan lock` / `sigma exec lock`', () => {
    const offenders: string[] = [];
    for (const file of mdFiles) {
      fs.readFileSync(file, 'utf-8').split(/\r?\n/).forEach((line, i) => {
        // The FMN/DEV skills deliberately explain that these two are retired tombstones.
        if (/\b(plan|exec) lock\b/.test(line) && !line.includes('retired tom')) {
          offenders.push(`${path.relative(REPO_ROOT, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('the retired-tombstone explanation in FMN/DEV skills is kept', () => {
    const fmn = fs.readFileSync(path.join(TARGETS, 'claude_code', 'fmn.md'), 'utf-8');
    expect(fmn).toMatch(/plan lock and exec lock are retired tom/);
  });

  it('replacements name approve, and `close lock` (still valid) is untouched', () => {
    const claude = fs.readFileSync(path.join(TARGETS, 'bridge', 'CLAUDE.md'), 'utf-8');
    expect(claude).toContain('`plan approve`');
    expect(claude).toContain('`exec approve`');
    expect(claude).toContain('`close lock`');
    expect(fs.readFileSync(path.join(TARGETS, 'bridge', 'REASONIX.md'), 'utf-8')).toMatch(/^sigma close lock\r?$/m);
  });

  it('every bridge that has an Inter-Role Context Handoff section carries the related-artifact rule', () => {
    const bridges = fs.readdirSync(path.join(TARGETS, 'bridge')).filter((f) => f.endsWith('.md'));
    const withSection = bridges.filter((f) =>
      fs.readFileSync(path.join(TARGETS, 'bridge', f), 'utf-8').includes('## Inter-Role Context Handoff'));
    expect(withSection.sort()).toEqual(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);
    for (const f of withSection) {
      expect(fs.readFileSync(path.join(TARGETS, 'bridge', f), 'utf-8'), f).toContain('--related-artifact');
    }
  });
});

describe('project start / sync write global MCP config only for detected tools', () => {
  let env: TestEnv;
  beforeEach(() => { env = setupTestEnv(); });
  afterEach(() => env.cleanup());

  const codexConfig = () => path.join(env.homeDir, '.codex', 'config.toml');
  const antigravityConfig = () => path.join(env.homeDir, '.gemini', 'config', 'mcp_config.json');

  it('project start leaves ~/.codex and ~/.gemini alone when neither tool is detected', () => {
    const r = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.existsSync(path.join(env.homeDir, '.codex'))).toBe(false);
    expect(fs.existsSync(path.join(env.homeDir, '.gemini'))).toBe(false);
    expect(r.stdout).toContain('~/.codex/config.toml skipped (Codex not detected)');
    expect(r.stdout).toContain('~/.gemini/config/mcp_config.json skipped (Antigravity not detected)');
    // Project-local configs are unaffected.
    expect(fs.existsSync(path.join(env.projectDir, '.mcp.json'))).toBe(true);
    expect(fs.existsSync(path.join(env.projectDir, 'opencode.json'))).toBe(true);
  });

  it('project start writes the bound Codex and Antigravity entries when they are detected', () => {
    fs.ensureDirSync(path.join(env.homeDir, '.codex', 'skills'));
    fs.ensureDirSync(path.join(env.homeDir, '.gemini'));

    const r = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(r.exitCode).toBe(0);
    expect(fs.readFileSync(codexConfig(), 'utf-8')).toContain('--project-id');
    const ag = fs.readJsonSync(antigravityConfig());
    expect(ag.mcpServers.sigma.args).toContain('--project-id');
  });

  it('project sync --confirm follows the same rule', () => {
    runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    const without = runCli('project sync --confirm', env.projectDir, env.homeDir);
    expect(without.exitCode).toBe(0);
    expect(fs.existsSync(codexConfig())).toBe(false);
    expect(fs.existsSync(antigravityConfig())).toBe(false);
    expect(without.stdout).toContain('Codex not detected');

    fs.ensureDirSync(path.join(env.homeDir, '.codex', 'skills'));
    fs.ensureDirSync(path.join(env.homeDir, '.gemini'));
    const withTools = runCli('project sync --confirm', env.projectDir, env.homeDir);
    expect(withTools.exitCode).toBe(0);
    expect(fs.existsSync(codexConfig())).toBe(true);
    expect(fs.existsSync(antigravityConfig())).toBe(true);
  });
});
