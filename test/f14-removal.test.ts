import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

import { readChain, writeChain } from '../src/engine/chain';
import { readProjectConfig, writeProjectConfig } from '../src/engine/projectConfig';
import { createCloseDraftUseCase } from '../src/services/closeNewService';
import {
  setupTestEnv,
  stubProjectIdentity,
  stubProjectRootAnchor,
  writeChainFixture,
  chainPath,
  makeChainWithLockedExec,
  runCli,
  TestEnv,
} from './helpers';

// F14 — the HUMAN projections, the Fidelity Ledger and the Notion
// integration were removed. These tests pin the two things that must hold
// afterwards: nothing left over from them blocks or breaks a project, and
// data written while they existed still reads and survives a rewrite.

const LEGACY_GATE_CONFIG = {
  schema_version: '1.2.0',
  document_language: 'English',
  interaction_language: 'English',
  output_document_language: 'English',
  notion: { enabled: true, parent_page_id: 'legacy-page', clean_local: false },
  notion_humanize_gate: { enabled: true },
};

describe('F14 — legacy data still works', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('close new is not blocked by a legacy notion_humanize_gate.enabled key', () => {
    env = setupTestEnv();
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1', 80));
    fs.writeJsonSync(path.join(env.sigmaDir, 'project.config.json'), LEGACY_GATE_CONFIG);

    expect(() => createCloseDraftUseCase(env.projectDir)).not.toThrow();
    expect(readChain(env.projectDir, 'v1').close?.state).toBe('DRAFT');
  });

  it('a chain carrying `human` bookkeeping fields still reads, and the fields survive a rewrite', () => {
    env = setupTestEnv();
    stubProjectIdentity(env);
    const chain = makeChainWithLockedExec('v1', 'v1.1', 80) as Record<string, any>;
    const human = { version: 'v1', generated_at: '2026-09-01T00:00:00.000Z', pushed_to_notion_at: '2026-09-02T00:00:00.000Z' };
    chain.intent.human = human;
    chain.exec.versions[0].human = human;
    writeChainFixture(env, 'v1', chain);

    const read = readChain(env.projectDir, 'v1') as Record<string, any>;
    expect(read.intent.state).toBe('RATIFIED');
    writeChain(env.projectDir, 'v1', read as any);

    const onDisk = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(onDisk.intent.human).toEqual(human);
    expect(onDisk.exec.versions[0].human).toEqual(human);
  });

  it('project.config.json keeps its notion keys when the config is rewritten', () => {
    env = setupTestEnv();
    stubProjectIdentity(env);
    fs.writeJsonSync(path.join(env.sigmaDir, 'project.config.json'), LEGACY_GATE_CONFIG);

    const cfg = readProjectConfig(env.projectDir);
    expect(cfg.document_language).toBe('English');
    cfg.interaction_language = 'Indonesia';
    writeProjectConfig(env.projectDir, cfg);

    const onDisk = fs.readJsonSync(path.join(env.sigmaDir, 'project.config.json'));
    expect(onDisk.interaction_language).toBe('Indonesia');
    expect(onDisk.notion).toEqual(LEGACY_GATE_CONFIG.notion);
    expect(onDisk.notion_humanize_gate).toEqual({ enabled: true });
  });

  it('`config set language` keeps the legacy keys on disk', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    fs.writeJsonSync(path.join(env.sigmaDir, 'project.config.json'), LEGACY_GATE_CONFIG);

    const result = runCli('config set language Indonesia --interaction', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const onDisk = fs.readJsonSync(path.join(env.sigmaDir, 'project.config.json'));
    expect(onDisk.interaction_language).toBe('Indonesia');
    expect(onDisk.notion).toEqual(LEGACY_GATE_CONFIG.notion);
    expect(onDisk.notion_humanize_gate).toEqual({ enabled: true });
  });
});

describe('F14 — removed commands are gone', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it.each([
    ['notion status'],
    ['notion push'],
    ['intent humanize'],
    ['exec humanize'],
    ['close humanize'],
  ])('`sigma %s` is an unknown command', (args) => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli(args, env.projectDir, env.homeDir);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/unknown command/i);
  });

  it('`project start --humanize-gate` is an unknown option', () => {
    env = setupTestEnv();
    fs.removeSync(env.sigmaDir);

    const result = runCli('project start --id GONE --name "Gone" --confirm --humanize-gate', env.projectDir, env.homeDir);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/unknown option/i);
  });
});

describe('F14 — project start', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('does not create Sigma/human/, does not mention Notion, and writes no Notion keys', () => {
    env = setupTestEnv();
    fs.removeSync(env.sigmaDir);

    const result = runCli('project start --id NOHUMAN --name "No Human" --confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/notion|humanize/i);
    expect(fs.existsSync(path.join(env.sigmaDir, 'human'))).toBe(false);
    expect(fs.existsSync(path.join(env.sigmaDir, 'notes'))).toBe(true);
    const cfg = fs.readJsonSync(path.join(env.sigmaDir, 'project.config.json'));
    expect(cfg).not.toHaveProperty('notion');
    expect(cfg).not.toHaveProperty('notion_humanize_gate');
  });
});

describe('F14 — registries', () => {
  it('the operation registry has 68 entries and none for notion or humanize', () => {
    const registry = fs.readJsonSync(path.resolve(__dirname, '..', 'Sigma', 'SIGMA-OPERATION-REGISTRY.json'));
    const ids: string[] = registry.operations.map((o: { operation_id: string }) => o.operation_id);

    expect(registry.total_operations).toBe(68);
    expect(ids).toHaveLength(68);
    expect(ids.filter((id) => /notion|humanize/.test(id))).toEqual([]);
  });

  it('the four HUMAN templates are no longer bundled', () => {
    const dir = path.resolve(__dirname, '..', 'Sigma', 'templates');
    const names = fs.readdirSync(dir);
    expect(names.filter((n) => /HUMAN/.test(n))).toEqual([]);
    expect(names).toHaveLength(8);
  });
});
