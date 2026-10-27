import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { runCli, setupTestEnv, TestEnv } from './helpers';

const ROOT = path.resolve(__dirname, '..');
const SKILLS = ['aud-security', 'aud-ui-ux-design', 'aud-performance-cost', 'aud-code-logic'];

// Exercise the actual installer lifecycle in an isolated home. Merely shipping
// SKILL.md files does not make them discoverable if the setup allowlist omits them.
describe('AUD product-audit skill distribution', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it.each(SKILLS)('%s preserves the same audit instructions on all five platforms', (skill) => {
    const candidates = [
      `codex/${skill}/SKILL.md`, `antigravity/sigma-${skill}/SKILL.md`,
      `claude_code/${skill}.md`, `opencode/${skill}.md`, `reasonix/${skill}.md`,
    ].map(file => fs.readFileSync(path.join(ROOT, 'setup/targets', file), 'utf8').replace(/\r\n/g, '\n'));
    const body = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
    for (const text of candidates) expect(body(text)).toBe(body(candidates[0]));
    expect(candidates[2]).toMatch(/^disable-model-invocation: true$/m);
    expect(fs.readFileSync(path.join(ROOT, 'setup/targets/codex', skill, 'agents/openai.yaml'), 'utf8'))
      .toMatch(/^  allow_implicit_invocation: false$/m);
  });

  it('installs, restores on update and removes all four skills across platforms', () => {
    env = setupTestEnv();
    const families = [
      { source: 'claude_code', target: '.claude/commands', file: (s: string) => s + '.md' },
      { source: 'opencode', target: '.config/opencode/commands', file: (s: string) => s + '.md' },
      { source: 'reasonix', target: '.reasonix/skills', file: (s: string) => s + '.md' },
      { source: 'codex', target: '.codex/skills', file: (s: string) => s },
      { source: 'antigravity', target: '.gemini/config/skills', file: (s: string) => 'sigma-' + s },
    ];
    for (const family of families) fs.ensureDirSync(path.join(env.homeDir, family.target));
    const report = path.join(env.sigmaDir, 'Audit Product/Security/existing-AUDIT-sample.md');
    fs.outputFileSync(report, 'Director-owned audit report');
    const unrelated = path.join(env.homeDir, '.codex/skills/personal/SKILL.md');
    fs.outputFileSync(unrelated, 'unrelated personal skill');

    const installed = runCli('setup install --yes --force', env.projectDir, env.homeDir);
    expect(installed.exitCode, installed.stderr).toBe(0);

    const deployed: Array<{ source: string; target: string }> = [];
    for (const family of families) {
      for (const skill of SKILLS) {
        const relative = family.file(skill);
        const suffix = relative.endsWith('.md') ? '' : '/SKILL.md';
        const source = path.join(ROOT, 'setup/targets', family.source, relative + suffix);
        const target = path.join(env.homeDir, family.target, relative + suffix);
        expect(fs.readFileSync(target, 'utf8')).toBe(fs.readFileSync(source, 'utf8'));
        deployed.push({ source, target });
        // A missing skill must be restored by setup update, not silently skipped.
        fs.removeSync(target);
      }
    }

    const updated = runCli('setup update', env.projectDir, env.homeDir);
    expect(updated.exitCode, updated.stderr).toBe(0);
    for (const pair of deployed) {
      expect(fs.readFileSync(pair.target, 'utf8')).toBe(fs.readFileSync(pair.source, 'utf8'));
    }
    const manifestPath = path.join(env.homeDir, '.gemini/config/skills/manifest.json');
    const manifest = fs.readJsonSync(manifestPath);
    for (const skill of SKILLS) {
      expect(manifest.skills['sigma-' + skill]).toMatchObject({ status: 'installed', disabled: false });
      const policy = fs.readFileSync(path.join(env.homeDir, '.codex/skills', skill, 'agents/openai.yaml'), 'utf8');
      expect(policy).toContain('allow_implicit_invocation: false');
    }

    const uninstalled = runCli('setup uninstall --confirm', env.projectDir, env.homeDir);
    expect(uninstalled.exitCode, uninstalled.stderr).toBe(0);
    for (const pair of deployed) expect(fs.existsSync(pair.target)).toBe(false);
    const remaining = fs.readJsonSync(manifestPath);
    for (const skill of SKILLS) expect(remaining.skills['sigma-' + skill]).toBeUndefined();
    expect(fs.readFileSync(report, 'utf8')).toBe('Director-owned audit report');
    expect(fs.readFileSync(unrelated, 'utf8')).toBe('unrelated personal skill');
  }, 30000);
});
