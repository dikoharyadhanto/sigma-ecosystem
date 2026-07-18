import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import {
  makeChainWithLockedExec,
  runCli,
  setupTestEnv,
  stubProjectRootAnchor,
  writeChainFixture,
  chainPath,
  TestEnv,
} from './helpers';

describe('intent new on a CLOSED project', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  function closedChain() {
    const chain = makeChainWithLockedExec('v1') as Record<string, unknown>;
    chain.lifecycle_state = 'CLOSED';
    return chain;
  }

  it('shows the reopen preflight and cancels when not approved', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', closedChain());

    const result = runCli('intent new --title "Reopen Attempt" --focus "Reopen focus"', env.projectDir, env.homeDir, 'n\n');

    expect(result.stdout).toMatch(/Reopen Preflight/);
    expect(result.stdout).toMatch(/CLOSED/);
    expect(result.stdout).toMatch(/cancelled/i);

    // Cancelling must leave the CLOSED chain's own file untouched, and must
    // not create a v2 chain file at all.
    const v1 = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(v1.lifecycle_state).toBe('CLOSED');
    expect(fs.existsSync(chainPath(env, 'v2'))).toBe(false);
  });

  it('succeeds with --yes and reports the new work cycle', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', closedChain());

    const result = runCli('intent new --title "Reopen v2" --focus "Reopen focus" --yes', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Reopen Preflight/);

    // A brand-new, fully isolated chain file — the CLOSED chain is
    // untouched, not mutated in place (PLAN-EVAL-01 §3.4/§4).
    const v1 = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(v1.lifecycle_state).toBe('CLOSED');
    expect(v1.intent.state).toBe('LOCKED');

    const v2 = fs.readJsonSync(chainPath(env, 'v2')) as Record<string, any>;
    expect(v2.intent.version).toBe('v2');
    expect(v2.intent.state).toBe('DRAFT');

    const activateStatus = fs.readJsonSync(env.activateStatusPath) as Record<string, unknown>;
    expect(activateStatus.active_chain).toBe('v2');
  });
});
