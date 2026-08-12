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

describe('Intent ratify mutation', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma intent ratify transitions INTENT from DRAFT to RATIFIED in progress-v1.json', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));

    // Create a stub intent file so the harvester does not fail
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, validIntentDoc('v1'));

    const result = runCli('intent ratify', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);

    const updated = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, unknown>;
    const intent = updated.intent as Record<string, unknown>;
    expect(intent.state).toBe('RATIFIED');
    expect(intent.ratified_at).toBeDefined();

    const gates = updated.gates as Record<string, unknown>;
    expect(gates.gate_1_open).toBe(true);
  });

  it('sigma intent ratify fails when no DRAFT intent exists', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    // No chain at all — resolveActiveChainVersion() has nothing to default to.

    const result = runCli('intent ratify', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});

// `sigma intent lock` was removed outright (Director directive 2026-08-12,
// no alias) — this tombstone exists only so the old command name fails with
// a message pointing at `sigma intent ratify` instead of commander's generic
// "unknown command" error. See src/commands/intent.ts.
describe('Intent lock tombstone', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma intent lock fails and points at sigma intent ratify, without mutating state', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));
    const intentFile = path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md');
    fs.writeFileSync(intentFile, validIntentDoc('v1'));

    const before = fs.readFileSync(chainPath(env, 'v1'), 'utf8');
    const result = runCli('intent lock', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/has been removed/i);
    expect(result.stderr).toMatch(/sigma intent ratify/);

    const after = fs.readFileSync(chainPath(env, 'v1'), 'utf8');
    expect(after).toBe(before);
  });
});
