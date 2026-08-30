import { describe, it, expect, afterEach } from 'vitest';
import { setupTestEnv, runCli, stubProjectRootAnchor, TestEnv } from './helpers';
import { writeProjectConfig, readProjectConfig } from '../src/engine/projectConfig';

// Director request (2026-08-30): `sigma config show` only surfaced the three
// language fields, forcing a separate `sigma notion status` call just to see
// whether the humanize gate was on. `sigma notion status` keeps its own full
// report (connection test, token source, clean-local, ...) unchanged — this
// only adds the gate's on/off state as a fourth line in `config show`, since
// both fields already live in the same Sigma/project.config.json.

describe('sigma config show — Notion Humanize Gate line', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('reports OFF when notion_humanize_gate is disabled (the default)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('config show', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Notion Humanize Gate:\s+OFF/);
  });

  it('reports ON when notion_humanize_gate.enabled is true', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const cfg = readProjectConfig(env.projectDir);
    cfg.notion_humanize_gate = { enabled: true };
    writeProjectConfig(env.projectDir, cfg);

    const result = runCli('config show', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Notion Humanize Gate:\s+ON/);
  });
});
