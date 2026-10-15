import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

// PLAN-IMPL-SIGMA-REPORT-DIAGNOSTIC-MESSAGE-GIT-BOUNDARY — TC-RPT-01 / WP-TST-01.
//
// `report` and `sigma-test` are instructions to a model, so they rot silently:
// a renamed command still reads fine. This audit holds every platform variant
// to the live operation registry and to the contracts the plan fixed.

const ROOT = path.resolve(__dirname, '..');
const TARGETS = path.join(ROOT, 'setup', 'targets');

const VARIANTS: Record<'report' | 'sigma-test', string[]> = {
  report: [
    'claude_code/report.md',
    'opencode/report.md',
    'reasonix/report.md',
    'codex/report/SKILL.md',
    'antigravity/sigma-report/SKILL.md',
  ],
  'sigma-test': [
    'claude_code/sigma-test.md',
    'opencode/sigma-test.md',
    'reasonix/sigma-test.md',
    'codex/sigma-test/SKILL.md',
    'antigravity/sigma-test/SKILL.md',
  ],
};

const registry = fs.readJsonSync(path.join(ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json')) as {
  operations: Array<{ operation_id: string; level: string; description: string }>;
};
const TOMBSTONES = new Set(['intent_lock', 'plan_lock', 'exec_lock']);
const ACTIVE_IDS = new Set(registry.operations.map(o => o.operation_id).filter(id => !TOMBSTONES.has(id)));

function read(rel: string): string {
  return fs.readFileSync(path.join(TARGETS, rel), 'utf8');
}

// `sigma a b --flag` inside inline code -> the operation id it names, or null
// when it is only a flag (`sigma --help`). Longest registry match wins.
function citedOperations(text: string): Array<{ cited: string; id: string | null }> {
  const out: Array<{ cited: string; id: string | null }> = [];
  for (const span of text.matchAll(/`(sigma(?: [^`]*)?)`/g)) {
    const words = span[1].split(/\s+/).slice(1).filter(w => w.length > 0);
    const path: string[] = [];
    for (const w of words) {
      if (!/^[a-z][a-z-]*$/.test(w)) break;
      path.push(w);
    }
    if (path.length === 0) continue;
    let id: string | null = null;
    for (let n = Math.min(path.length, 3); n >= 1 && id === null; n--) {
      const candidate = path.slice(0, n).join('_').replace(/-/g, '_');
      if (ACTIVE_IDS.has(candidate) || TOMBSTONES.has(candidate)) id = candidate;
    }
    out.push({ cited: span[1], id });
  }
  return out;
}

const OBSOLETE = [
  'sigma exec supersede', 'sigma project reset', 'sigma intent lock', 'sigma plan lock', 'sigma exec lock',
  'stale-intent', 'stale intent', 'sigma message send',
];

describe.each(Object.entries(VARIANTS))('%s skill variants', (skill, files) => {
  for (const rel of files) {
    describe(rel, () => {
      const text = read(rel);

      it('cites only operations that exist and are active', () => {
        const unknown = citedOperations(text).filter(c => c.id === null).map(c => c.cited);
        const retired = citedOperations(text).filter(c => c.id && TOMBSTONES.has(c.id)).map(c => c.cited);
        expect(unknown, 'commands not in the operation registry').toEqual([]);
        expect(retired, 'commands naming a retired tombstone').toEqual([]);
      });

      it('names no obsolete operation', () => {
        const lower = text.toLowerCase();
        expect(OBSOLETE.filter(o => lower.includes(o.toLowerCase()))).toEqual([]);
      });

      it('bounds the prohibition to the invocation, not "after"', () => {
        expect(text).not.toMatch(/during or after/i);
        expect(text).toMatch(/During the `[#/][a-z-]+` invocation/);
      });

      it('forbids Git mutation and network operations, including fetch', () => {
        expect(text).toMatch(/Git mutation or network operation/);
        expect(text).toMatch(/\bfetch\b/);
      });
    });
  }
});

describe('report: Git progress evidence contract', () => {
  for (const rel of VARIANTS.report) {
    it(`${rel} requires read-only status and last-commit evidence`, () => {
      const text = read(rel);
      expect(text).toContain("git --no-optional-locks status --short --branch");
      expect(text).toContain("git --no-optional-locks log -1 --format='%h|%cI|%an|%s'");
      expect(text).toMatch(/Never run `git fetch`/);
      expect(text).toMatch(/clean worktree proves only/i);
      expect(text).toMatch(/does not prove that tests, acceptance criteria, or lifecycle work are complete/);
      expect(text).toMatch(/`N\/A`/);
      expect(text).toContain('Git progress:');
    });
  }
});

describe('sigma-test: layered diagnostic contract', () => {
  const IDS = ['A1.cli', 'A2.bootstrap', 'A3.skills', 'A4.assets', 'A5.global', 'A6.project', 'A7.mcp', 'A8.clean',
    'B1.classified', 'B2.tombstones', 'B3.count', 'B4.mcp_status'];
  for (const rel of VARIANTS['sigma-test']) {
    it(`${rel} defines every layer and check id`, () => {
      const text = read(rel);
      for (const id of IDS) expect(text, `missing check ${id}`).toContain(id);
      for (const heading of ['Layer A', 'Layer B', 'Layer C', 'Layer D']) expect(text).toContain(heading);
    });

    it(`${rel} reports drift through the read-only asset check and never executes remediation`, () => {
      const text = read(rel);
      expect(text).toContain('sigma doctor --check-assets');
      expect(text).toMatch(/Remediation is \*\*recommended, never executed\*\*/);
      expect(text).toMatch(/Do \*\*not\*\* run `sigma project start`/);
    });

    it(`${rel} treats absent prerequisites as N/A, never as repair`, () => {
      const text = read(rel);
      expect(text).toMatch(/`N\/A` is valid only when the prerequisite is stated/);
      expect(text).toMatch(/never downgraded to `N\/A`/);
    });
  }

  // PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015: B4 compares the
  // manifest's declared tools with the introspected list instead of reporting
  // "unverifiable until a manifest exists".
  for (const rel of VARIANTS['sigma-test']) {
    it(`${rel} verifies mcp_status against the introspected tools (B4) and points B1 at the manifest`, () => {
      const text = read(rel);
      const b4 = text.slice(text.indexOf('- `B4.mcp_status`'), text.indexOf('### Layer C'));
      expect(b4).toContain('mcp_tools');
      expect(b4).toContain('A7');
      expect(b4).toMatch(/Never PASS this check from `mcp_status` alone/);
      expect(b4).toMatch(/N\/A: control server not connected/);
      expect(text).not.toMatch(/unverifiable until manifest exists/);
      expect(text).not.toMatch(/hand-maintained table/);
      expect(text).toContain('src/mcp/capabilityManifest.ts');
      expect(text).toContain('test/mcp-capability-manifest.test.ts');
    });
  }

  it('smoke-layer CLI commands are all registry read_only operations', () => {
    const readOnly = new Set(registry.operations.filter(o => o.level === 'read_only').map(o => o.operation_id));
    const text = read('claude_code/sigma-test.md');
    const layerC = text.slice(text.indexOf('### Layer C'), text.indexOf('### Layer D'));
    const notReadOnly = citedOperations(layerC)
      .filter(c => c.id !== null && !readOnly.has(c.id))
      .map(c => `${c.cited} (${c.id})`);
    expect(notReadOnly, 'a smoke call must be an observational operation').toEqual([]);
  });
});
