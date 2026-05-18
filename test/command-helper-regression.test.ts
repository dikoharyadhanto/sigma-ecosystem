import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, makeProgressWithDraftIntent, TestEnv } from './helpers';

describe('Shared artifact command helpers', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('template helper preserves intent new output and artifact path', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, {
      ...makeProgressWithDraftIntent(),
      intent: { active_version: null, active_state: null, versions: [] },
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('intent new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]design[\\/]DIR-INTENT-v1\.md/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md'))).toBe(true);
  });

  it('audit helper preserves advisory append content', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, '# DIR-INTENT v1\n');

    const result = runCli('intent review', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const content = fs.readFileSync(intentFile, 'utf8');
    expect(content).toMatch(/## AUD Advisory Findings/);
    expect(content).toMatch(/Operation: sigma intent review/);
    expect(content).toMatch(/Status: ADVISORY ONLY/);
  });
});
