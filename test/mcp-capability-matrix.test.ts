import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { spawnSync } from 'child_process';
import { renderCapabilityMatrix } from '../src/mcp/capabilityMatrix';
import { CAPABILITY_MANIFEST, TOMBSTONES } from '../src/mcp/capabilityManifest';

// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — TC-MCP-10 / AC-MCP-11.
// The matrix is rendered from the manifest, so it has no state of its own.

const ROOT = path.resolve(__dirname, '..');
const registry = fs.readJsonSync(path.join(ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'));
const pkg = fs.readJsonSync(path.join(ROOT, 'package.json'));
const GENERATED = path.join(ROOT, 'Implementation', 'sigma-mcp', 'SIGMA-MCP-CAPABILITY-MATRIX.generated.md');
const input = { sigmaVersion: pkg.version as string, registry };

describe('TC-MCP-10 generated capability matrix', () => {
  it('renders identically twice from identical input', () => {
    expect(renderCapabilityMatrix(input)).toBe(renderCapabilityMatrix(input));
  });

  it('does not depend on the clock', () => {
    const real = Date.now;
    const first = renderCapabilityMatrix(input);
    Date.now = () => 0;
    try {
      expect(renderCapabilityMatrix(input)).toBe(first);
    } finally {
      Date.now = real;
    }
  });

  it('names every active operation exactly once and keeps tombstones out of the tables', () => {
    const text = renderCapabilityMatrix(input);
    for (const r of CAPABILITY_MANIFEST) {
      const hits = text.split('\n').filter((l) => l.startsWith(`| \`${r.operation_id}\` |`));
      expect(hits.length, r.operation_id).toBe(1);
    }
    for (const id of Object.keys(TOMBSTONES)) {
      const asOperationRow = text.split('\n').filter((l) => l.startsWith(`| \`${id}\` |`) && l.split('|').length > 6);
      expect(asOperationRow, `${id} must not be a capability row`).toEqual([]);
    }
  });

  it('states the baseline from the registry, not from the time of rendering', () => {
    const text = renderCapabilityMatrix(input);
    expect(text).toContain(`generated \`${registry.generated_at}\``);
    expect(text).toContain(`${registry.total_operations} entries`);
    expect(text).toContain(`Sigma version: \`${pkg.version}\``);
  });

  it('explains exact, functional, partial, and none, and how to start the control server', () => {
    const text = renderCapabilityMatrix(input);
    for (const word of ['`exact`', '`functional`', '`partial`', '`none`']) expect(text).toContain(word);
    expect(text).toMatch(/sigma-control --project-root/);
    expect(text).toMatch(/never registered automatically/);
  });

  it('matches the committed file (regenerate with scripts/generate-mcp-matrix.js)', () => {
    expect(fs.existsSync(GENERATED), 'run: npx tsc && node scripts/generate-mcp-matrix.js').toBe(true);
    expect(fs.readFileSync(GENERATED, 'utf8')).toBe(renderCapabilityMatrix(input));
  });

  it('is what the generator script writes (--check agrees)', () => {
    const run = spawnSync('node', [path.join(ROOT, 'scripts', 'generate-mcp-matrix.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
  });
});
