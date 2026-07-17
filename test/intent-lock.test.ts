import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChainWithDraftIntent,
  validIntentDoc,
  chainPath,
  TestEnv,
} from './helpers';

describe('Intent lock mutation', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma intent lock transitions INTENT from DRAFT to LOCKED in progress-v1.json', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));

    // Create a stub intent file so the harvester does not fail
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, validIntentDoc('v1'));

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const intent = updated.intent as Record<string, unknown>;
    expect(intent.state).toBe('LOCKED');
    expect(intent.locked_at).toBeDefined();

    const gates = updated.gates as Record<string, unknown>;
    expect(gates.gate_1_open).toBe(true);
  });

  it('sigma intent lock fails when no DRAFT intent exists', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    // No chain at all — resolveActiveChainVersion() has nothing to default to.

    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
