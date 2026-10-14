import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

// The operation registry drifted from the CLI by 11 operations without anyone
// noticing, because the only guard was an operation count written by hand into
// several tests. This test compares the registry with the compiled command tree
// through the same walker the maintenance script uses, so a command added or
// removed without a registry change fails here.

const ROOT = path.resolve(__dirname, '..');

describe('operation registry stays in step with the CLI', () => {
  it('registers every executable operation and nothing else', () => {
    const run = spawnSync('node', [path.join(ROOT, 'scripts', 'refresh-registries.js'), '--dry-run'], {
      cwd: ROOT, encoding: 'utf-8',
    });
    expect(run.status).toBe(0);
    const line = run.stdout.split('\n').find(l => l.includes('Registered:') && l.includes('Detected:'));
    expect(line, run.stdout).toBeDefined();
    expect(line).toMatch(/New: 0\s*\|\s*Removed: 0/);
  });

  it('leaves no entry marked for review', () => {
    const registry = fs.readJsonSync(path.join(ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json')) as {
      total_operations: number;
      operations: Array<{ operation_id: string; NEEDS_REVIEW?: boolean }>;
    };
    expect(registry.operations.filter(o => o.NEEDS_REVIEW).map(o => o.operation_id)).toEqual([]);
    expect(registry.total_operations).toBe(registry.operations.length);
  });
});
