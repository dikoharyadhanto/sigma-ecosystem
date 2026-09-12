import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// PLAN-IMPL-HUMANIZE-TECHNICAL-DETAIL-LEVELS-20260912 — regression test for
// the LOW/BALANCE/HIGH technical detail level contract and the Activation
// Scope invariant, ported identically across all four humanize skill
// targets. Content is checked via required substrings, not a literal diff,
// because the activation trigger word (`/humanize` vs `#humanize`) and the
// frontmatter `name:` value (`humanize` vs `sigma-humanize`) are allowed to
// differ per target.

const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  { name: 'claude_code', file: path.join(ROOT, 'setup/targets/claude_code/humanize.md'), activation: '/humanize' },
  { name: 'codex', file: path.join(ROOT, 'setup/targets/codex/humanize/SKILL.md'), activation: '#humanize' },
  { name: 'reasonix', file: path.join(ROOT, 'setup/targets/reasonix/humanize.md'), activation: '/humanize' },
  { name: 'antigravity', file: path.join(ROOT, 'setup/targets/antigravity/sigma-humanize/SKILL.md'), activation: '/humanize' },
];

describe('Humanize skill — Technical Detail Level parity', () => {
  for (const target of TARGETS) {
    describe(target.name, () => {
      const content = fs.readFileSync(target.file, 'utf-8');

      it('defines all three canonical levels', () => {
        expect(content).toContain('`LOW`');
        expect(content).toContain('`BALANCE`');
        expect(content).toContain('`HIGH`');
      });

      it('activates with the correct trigger word and an optional level', () => {
        expect(content).toContain(`${target.activation} LOW`);
        expect(content).toContain(`${target.activation} HIGH`);
      });

      it('defaults to BALANCE when no level is stated', () => {
        expect(content).toMatch(/no level is stated.*apply `BALANCE`/s);
      });

      it('requires explicit Director instruction to change level mid-revision', () => {
        expect(content).toMatch(/level change requires an explicit Director instruction/);
      });

      it('states Sigma terminology is forbidden at every level', () => {
        expect(content).toMatch(/applies without exception at every level/);
      });

      it('states Preserve\\/Compress\\/Rephrase\\/Infer applies identically at every level', () => {
        expect(content).toMatch(/Preserve\/Compress\/Rephrase\/Infer operations apply identically at every level/);
      });

      it('defines the Activation Scope invariant, locked per file and non-persistent', () => {
        expect(content).toContain('**Activation Scope:**');
        expect(content).toMatch(/never becomes a standing mode applied to other, unrelated files/);
        expect(content).toMatch(/never stored as a persistent memory/);
      });
    });
  }
});

describe('Humanize skill — setup mapping still resolves to the right files', () => {
  it('claudeCode/reasonix map to humanize.md, codex/antigravity map to a humanize skill directory', () => {
    const setupSrc = fs.readFileSync(path.join(ROOT, 'src/commands/setup.ts'), 'utf-8');
    expect(setupSrc).toMatch(/claudeCode:\s*\{[^}]*humanize: 'humanize\.md'/);
    expect(setupSrc).toMatch(/reasonix:\s*\{[^}]*humanize: 'humanize\.md'/);
    expect(setupSrc).toMatch(/codex:\s*\{[^}]*humanize: 'humanize'/);
    expect(setupSrc).toMatch(/antigravity:\s*\{[^}]*humanize: 'sigma-humanize'/);
  });

  for (const target of TARGETS) {
    it(`${target.name} humanize skill file exists on disk`, () => {
      expect(fs.existsSync(target.file)).toBe(true);
    });
  }
});
