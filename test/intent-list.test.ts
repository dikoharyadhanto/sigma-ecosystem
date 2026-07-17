import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChainWithDraftIntent,
  makeChainWithLockedIntent,
  makeChainWithFullBuiltCycle,
  validIntentDoc,
  TestEnv,
} from './helpers';

// PLAN-EVAL-01 — `intent list` is the cross-chain projection that replaces
// both the old single-file version table and the deleted
// getInactiveIntentWarnings() mechanism (§3.4): a chain that isn't active
// but still has live descendants is visible here, not via a separate
// warning. Nothing is cached — every call re-reads every progress-v*.json.

describe('sigma intent list', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('reports none when no chain exists yet', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('intent list', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/None\. Run: sigma intent new/);
  });

  it('lists every chain found on disk, ascending, marking exactly the active one', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithFullBuiltCycle('v1', 'v1.1'), { activate: false });
    writeChainFixture(env, 'v2', makeChainWithDraftIntent('v2'), { activate: true });

    const result = runCli('intent list', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const lines = result.stdout.split('\n').filter(l => l.startsWith('v1') || l.startsWith('v2'));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^v1\s+LOCKED/);
    expect(lines[0]).not.toMatch(/\*\s*$/); // v1 is not active
    expect(lines[1]).toMatch(/^v2\s+DRAFT/);
    expect(lines[1]).toMatch(/\*\s*$/); // v2 is active
  });

  it('still lists a non-active chain with a still-open gate — the replacement for the deleted getInactiveIntentWarnings()', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    // v1 has LOCKED plan/exec hanging (never closed) while v2 is the active chain.
    writeChainFixture(env, 'v1', makeChainWithFullBuiltCycle('v1', 'v1.1'), { activate: false });
    writeChainFixture(env, 'v2', makeChainWithLockedIntent('v2'), { activate: true });

    const result = runCli('intent list', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    // v1's Gate 2/3 are visibly still OPEN in the listing even though it's
    // not the active chain — nothing about it is hidden or summarized away.
    const v1Line = result.stdout.split('\n').find(l => l.startsWith('v1'));
    expect(v1Line).toMatch(/OPEN\s+OPEN\s+OPEN/);
  });

  it('marks no chain as active when every chain is SUPERSEDED, without crashing', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const superseded = makeChainWithLockedIntent('v1') as Record<string, any>;
    superseded.intent.state = 'SUPERSEDED';
    superseded.intent.supersede_reason = 'abandoned';
    writeChainFixture(env, 'v1', superseded);

    const result = runCli('intent list', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const v1Line = result.stdout.split('\n').find(l => l.startsWith('v1'));
    expect(v1Line).toMatch(/SUPERSEDED/);
    expect(v1Line).not.toMatch(/\*\s*$/);
  });
});

describe('sigma intent check --v — cross-chain resolution (PLAN-EVAL-01 §3.7)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('checks a non-active chain by version, leaving activate_status.json untouched', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'), { activate: false });
    writeChainFixture(env, 'v2', makeChainWithDraftIntent('v2'), { activate: true });

    fs.writeFileSync(
      path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md'),
      validIntentDoc('v1')
    );

    const result = runCli('intent check --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.readJsonSync(env.activateStatusPath).active_chain).toBe('v2');
  });

  it('fails clearly when the requested chain does not exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));

    const result = runCli('intent check --v v9', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });
});

describe('sigma intent activate — manual chain switch (git checkout analog)', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('switches the active chain without requiring --director-confirm', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'), { activate: false });
    writeChainFixture(env, 'v2', makeChainWithDraftIntent('v2'), { activate: true });

    const result = runCli('intent activate --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.readJsonSync(env.activateStatusPath).active_chain).toBe('v1');
  });

  it('refuses to activate a SUPERSEDED chain', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const superseded = makeChainWithLockedIntent('v1') as Record<string, any>;
    superseded.intent.state = 'SUPERSEDED';
    superseded.intent.supersede_reason = 'abandoned';
    writeChainFixture(env, 'v1', superseded, { activate: false });
    writeChainFixture(env, 'v2', makeChainWithDraftIntent('v2'), { activate: true });

    const result = runCli('intent activate --v v1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/SUPERSEDED/);
    expect(fs.readJsonSync(env.activateStatusPath).active_chain).toBe('v2');
  });

  it('fails clearly when the target chain does not exist', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));

    const result = runCli('intent activate --v v9', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found/i);
  });
});
