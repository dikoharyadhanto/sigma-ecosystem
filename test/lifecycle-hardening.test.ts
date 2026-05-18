import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  makeProgressWithLockedExec,
  TestEnv,
} from './helpers';

describe('Lifecycle hardening coverage', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma project start seeds project structure and an empty decision log', () => {
    env = setupTestEnv();

    const result = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(env.progressPath)).toBe(true);
    expect(fs.existsSync(path.join(env.sigmaDir, 'memory', 'decisions.jsonl'))).toBe(true);
    expect(fs.readFileSync(path.join(env.sigmaDir, 'memory', 'decisions.jsonl'), 'utf8')).toBe('');
    expect(fs.existsSync(path.join(env.sigmaDir, 'messages', 'index.json'))).toBe(true);
  });

  it('sigma session bootstrap reports gates and next operations from a locked chain', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedExec());

    const result = runCli('session bootstrap', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Lifecycle Phase:\s+BUILD/);
    expect(result.stdout).toMatch(/Gate 3 \(Build Evidence\):\s+SATISFIED/);
    expect(result.stdout).toMatch(/sigma close new/);
  });

  it('sigma close new creates a close draft for a clean locked chain', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedExec());

    const result = runCli('close new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Created: Sigma[\\/]close[\\/]DIR-CLOSE-v1\.md/);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'))).toBe(true);
  });

  it('sigma close new requires stale-chain acknowledgement when the qualifying chain is stale', () => {
    env = setupTestEnv();
    const progress = makeProgressWithLockedExec() as Record<string, any>;
    progress.plan.versions[0].stale_intent = true;
    progress.exec.versions[0].stale_intent = true;
    progress.gates.gate_3_satisfied = false;
    fs.writeJsonSync(env.progressPath, progress);

    const blocked = runCli('close new', env.projectDir, env.homeDir);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toMatch(/GATE 3 STALE/i);

    const acknowledged = runCli('close new --ack-stale-intent', env.projectDir, env.homeDir);
    expect(acknowledged.exitCode).toBe(0);
    const closeFile = fs.readFileSync(path.join(env.projectDir, 'Sigma', 'close', 'DIR-CLOSE-v1.md'), 'utf8');
    expect(closeFile).toMatch(/STALE INTENT ACKNOWLEDGED/);
  });
});
