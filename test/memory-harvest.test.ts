import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { harvestPlanLock } from '../src/engine/memory';
import { setupTestEnv, TestEnv } from './helpers';

describe('Decision harvesting hardening', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('normalizes harvested markdown sections and writes stable decision entries', () => {
    env = setupTestEnv();
    const relPath = path.join('Sigma', 'build', 'FMN-PLAN-v1.md');
    const absPath = path.join(env.projectDir, relPath);
    fs.ensureDirSync(path.dirname(absPath));
    fs.writeFileSync(absPath, [
      '# FMN-PLAN v1',
      '',
      '## 2. Work Order',
      '',
      'Build the thing.',
      '',
      '',
      '',
      'Keep the contract tight.',
      '',
      '## 5. Pre-Build Test Contract',
      '',
      'Run tests.',
      '',
      '## 10. Director Notes',
      '',
      'Approved.',
      '',
    ].join('\n'));

    harvestPlanLock(env.projectDir, 'v1', relPath);

    const lines = fs.readFileSync(path.join(env.sigmaDir, 'memory', 'decisions.jsonl'), 'utf8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]) as Record<string, string>;
    expect(entry.artifact).toBe('PLAN');
    expect(entry.task_plan_summary).toBe('Build the thing.\n\nKeep the contract tight.');
    expect(entry.test_contract_summary).toBe('Run tests.');
    expect(entry.director_notes).toBe('Approved.');
  });

  it('does not crash when expected harvest sections are missing', () => {
    env = setupTestEnv();
    const relPath = path.join('Sigma', 'build', 'FMN-PLAN-v1.md');
    const absPath = path.join(env.projectDir, relPath);
    fs.ensureDirSync(path.dirname(absPath));
    fs.writeFileSync(absPath, '# FMN-PLAN v1\n\nNo recognized sections.\n');

    harvestPlanLock(env.projectDir, 'v1', relPath);

    const raw = fs.readFileSync(path.join(env.sigmaDir, 'memory', 'decisions.jsonl'), 'utf8').trim();
    expect(raw.length).toBeGreaterThan(0);
    const entry = JSON.parse(raw) as Record<string, string>;
    expect(entry.task_plan_summary).toBe('');
    expect(entry.test_contract_summary).toBe('');
  });
});
