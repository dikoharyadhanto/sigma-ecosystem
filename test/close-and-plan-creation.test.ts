import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { readChain } from '../src/engine/chain';
import {
  makeChainWithDraftClose,
  runCli,
  setupTestEnv,
  stubProjectIdentity,
  stubProjectRootAnchor,
  TestEnv,
  validCloseDoc,
  writeChainFixture,
} from './helpers';

// A CLOSE does not stop new work. `close lock` still needs Gate 3: every
// LOCKED PLAN paired with a LOCKED EXEC and nothing left in DRAFT.

describe('PLAN creation next to a CLOSE', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  const roadmap = (state: string) => {
    const now = new Date().toISOString();
    return { version: 'v1', state, file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: now, updated_at: now, ...(state === 'LOCKED' ? { locked_at: now } : {}) };
  };

  const project = (closeState: 'DRAFT' | 'LOCKED') => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    const chain = makeChainWithDraftClose('v1') as Record<string, any>;
    chain.lifecycle_state = closeState === 'DRAFT' ? 'CLOSE' : 'CLOSED';
    chain.close.state = closeState;
    if (closeState === 'LOCKED') chain.close.locked_at = new Date().toISOString();
    chain.roadmap = roadmap(closeState === 'LOCKED' ? 'LOCKED' : 'DRAFT');
    writeChainFixture(env, 'v1', chain);
    fs.ensureDirSync(path.join(env.sigmaDir, 'roadmap'));
    fs.copySync(path.resolve(__dirname, '..', 'Sigma', 'templates', 'ROADMAP-TEMPLATE.md'), path.join(env.sigmaDir, 'roadmap', 'ROADMAP-v1.md'));
    fs.ensureDirSync(path.join(env.sigmaDir, 'close'));
    fs.writeFileSync(path.join(env.sigmaDir, 'close', 'DIR-CLOSE-v1.md'), validCloseDoc('v1'));
    return env;
  };

  it('plan new is allowed while the CLOSE is a DRAFT', () => {
    project('DRAFT');
    const created = runCli('plan new --title Fix --focus Corrections', env.projectDir, env.homeDir);
    expect(created.exitCode).toBe(0);
    expect(created.stdout).toMatch(/Created: Sigma[\\/]contract[\\/]PLAN-v0\.2\.md/);
  });

  it('close lock is refused while that new PLAN is still a DRAFT, and the CLOSE stays a DRAFT', () => {
    project('DRAFT');
    expect(runCli('plan new --title Fix --focus Corrections', env.projectDir, env.homeDir).exitCode).toBe(0);

    const lock = runCli('close lock --yes', env.projectDir, env.homeDir);
    expect(lock.exitCode).toBe(1);
    expect(lock.stderr).toMatch(/GATE 3 BLOCKED/);
    expect(readChain(env.projectDir, 'v1').close?.state).toBe('DRAFT');
    expect(readChain(env.projectDir, 'v1').lifecycle_state).toBe('CLOSE');
  });

  it('close lock succeeds when every PLAN is LOCKED with its EXEC', () => {
    project('DRAFT');
    const lock = runCli('close lock --yes', env.projectDir, env.homeDir);
    expect(lock.exitCode).toBe(0);
    expect(readChain(env.projectDir, 'v1').close?.state).toBe('LOCKED');
  });

  it('plan new is not prevented after the CLOSE is LOCKED (work within the mandate may continue)', () => {
    project('LOCKED');
    const created = runCli('plan new --title Fix --focus Corrections', env.projectDir, env.homeDir);
    expect(created.exitCode).toBe(0);
    expect(created.stdout).toMatch(/Created: Sigma[\\/]contract[\\/]PLAN-v0\.2\.md/);
    expect(readChain(env.projectDir, 'v1').close?.state).toBe('LOCKED');
  });
});
