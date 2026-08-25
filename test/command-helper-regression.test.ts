import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, makeProgressWithDraftIntent, stubProjectRootAnchor, TestEnv } from './helpers';

describe('Shared artifact command helpers', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('template helper preserves intent new output and artifact path', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    fs.writeJsonSync(env.progressPath, {
      ...makeProgressWithDraftIntent(),
      intent: { active_version: null, active_state: null, versions: [] },
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });

    const result = runCli('intent new --title "Test Intent" --focus "Test focus"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]charter[\\/]DIR-INTENT-v1\.md/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'))).toBe(true);
  });
});
