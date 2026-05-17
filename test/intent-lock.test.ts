import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, makeProgress, makeProgressWithDraftIntent, TestEnv } from './helpers';

describe('Intent lock mutation', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma intent lock transitions INTENT from DRAFT to LOCKED in progress.json', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithDraftIntent());

    // Create a stub intent file so the harvester does not fail
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, '# DIR-INTENT v1\n\n## Director Notes\n\nTest intent.\n');

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const updated = fs.readJsonSync(env.progressPath) as Record<string, unknown>;
    const intent = updated.intent as Record<string, unknown>;
    expect(intent.active_state).toBe('LOCKED');

    const versions = intent.versions as Array<Record<string, unknown>>;
    const v1 = versions.find(v => v.version === 'v1');
    expect(v1).toBeDefined();
    expect(v1!.state).toBe('LOCKED');
    expect(v1!.locked_at).toBeDefined();

    const gates = updated.gates as Record<string, unknown>;
    expect(gates.gate_1_open).toBe(true);
  });

  it('sigma intent lock fails when no DRAFT intent exists', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
