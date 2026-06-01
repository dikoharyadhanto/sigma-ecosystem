import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  makeProgress,
  makeProgressWithLockedExec,
  makeProgressWithLockedPlan,
  TestEnv,
} from './helpers';

const REPO_ROOT = path.resolve(__dirname, '..');

function copyDocumentRegistry(env: TestEnv) {
  fs.copyFileSync(
    path.join(REPO_ROOT, 'Sigma', 'SIGMA-REGISTRY.json'),
    path.join(env.sigmaDir, 'SIGMA-REGISTRY.json')
  );
}

describe('Role memory and bootstrap regressions', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('project start seeds role-memory files and writes local MCP config without sigma-memory', () => {
    env = setupTestEnv();

    const result = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(path.join(env.projectDir, 'Sigma', 'role-memory', 'arc-memory.json'))).toBe(true);
    const mcp = fs.readJsonSync(path.join(env.projectDir, '.mcp.json'));
    expect(mcp.mcpServers['sequential-thinking']).toBeTruthy();
    expect(mcp.mcpServers['sigma-memory']).toBeUndefined();
  });

  it('sigma memory prints authority note, general reminders, and role-specific reminders', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('memory --arc', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Sigma Role Memory/);
    expect(result.stdout).toMatch(/Role:\s+ARC/);
    expect(result.stdout).toMatch(/Reminder only\./);
    expect(result.stdout).toMatch(/Use Sigma CLI for all runtime operations/);
    expect(result.stdout).toMatch(/stop immediately and ask whether the Director wants to open a new DIR-INTENT/i);
    expect(result.stdout).not.toMatch(/FMN-PLAN-v\d/i);
    expect(result.stdout).not.toMatch(/DEV-EXEC-v\d/i);
  });

  it('sigma memory requires exactly one role flag', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('memory', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/Exactly one role flag is required/i);
  });

  it('sigma memory is read-only and does not mutate progress.json', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    const before = JSON.stringify(fs.readJsonSync(env.progressPath));

    const result = runCli('memory --dev', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(JSON.stringify(fs.readJsonSync(env.progressPath))).toBe(before);
  });

  it('session bootstrap --role arc omits document-reading prompts by default', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('session bootstrap --role arc', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/CLI-Valid Runtime Operations/);
    expect(result.stdout).toMatch(/Current Stop Point/);
    expect(result.stdout).toMatch(/do not inspect broader artifacts unless the Director explicitly asks/i);
    expect(result.stdout).not.toMatch(/Documents to Read/);
    expect(result.stdout).not.toMatch(/Sigma\/SIGMA_PROTOCOL\.md/);
  });

  it('session bootstrap --role aud stays passive and scope-bound', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());

    const result = runCli('session bootstrap --role aud', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Review only the files or evidence explicitly provided or authorized/i);
    expect(result.stdout).toMatch(/Stop until the Director provides or authorizes the exact audit evidence scope/i);
    expect(result.stdout).not.toMatch(/Documents to Read/);
  });

  it('session bootstrap --role fmn includes planning brief and stop guidance', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedExec());

    const result = runCli('session bootstrap --role fmn', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Brief the Director on pending plans, roadmap direction, latest progress, and planning options/i);
    expect(result.stdout).toMatch(/Stop after briefing planning options/i);
  });

  it('session bootstrap --role dev includes locked-plan and Gate 2 guidance', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedPlan());

    const result = runCli('session bootstrap --role dev', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Gate 2 is open/i);
    expect(result.stdout).toMatch(/prepare DEV-EXEC pre-implementation planning/i);
    expect(result.stdout).toMatch(/Material implementation after pre-build review/i);
  });

  it('session bootstrap --role arc --show-docs prints role-specific reference documents', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgress());
    copyDocumentRegistry(env);

    const result = runCli('session bootstrap --role arc --show-docs', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Reference Documents/);
    expect(result.stdout).toMatch(/Sigma\/role-memory\/arc-memory\.json/);
    expect(result.stdout).toMatch(/Sigma\/rules\/ARC-RULE\.md/);
  });

  it('project status keeps runtime state read-only and labels CLI-valid operations clearly', () => {
    env = setupTestEnv();
    fs.writeJsonSync(env.progressPath, makeProgressWithLockedExec());
    const before = JSON.stringify(fs.readJsonSync(env.progressPath));

    const result = runCli('project status', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/CLI-Valid Runtime Operations/);
    expect(result.stdout).toMatch(/sigma close new/);
    expect(result.stdout).not.toMatch(/Documents to Read/);
    expect(JSON.stringify(fs.readJsonSync(env.progressPath))).toBe(before);
  });
});
