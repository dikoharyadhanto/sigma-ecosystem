import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectIdentity,
  writeChainFixture,
  chainPath,
  makeChainWithLockedIntent,
  makeChainWithLockedExec,
  makeChainWithDraftExec,
  validIntentDoc,
  validExecDoc,
  TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §3.4/§4 Fase 6 (CR-01) — the gate
// belongs at `plan new`/`close new`, never at `intent ratify`/`exec lock`
// themselves. These tests are the regression guard against the exact
// deadlock the external audit found in an earlier revision.

function chainWithRoadmap(version = 'v1') {
  const chain = makeChainWithLockedIntent(version) as any;
  const now = new Date().toISOString();
  chain.roadmap = { version, state: 'LOCKED', file: `Sigma/roadmap/ROADMAP-${version}.md`, created_at: now, updated_at: now, locked_at: now };
  return chain;
}

// `plan new` reads the ROADMAP file from disk (renderRoadmapFile), not just
// chain state — needed only in tests that expect `plan new` to actually
// succeed and reach that step.
function writeRoadmapFile(env: TestEnv, version = 'v1') {
  const src = path.join(__dirname, '..', 'Sigma', 'templates', 'ROADMAP-TEMPLATE.md');
  const dest = path.join(env.projectDir, 'Sigma', 'roadmap', `ROADMAP-${version}.md`);
  fs.ensureDirSync(path.dirname(dest));
  fs.copySync(src, dest);
}

function enableHumanizeGate(env: TestEnv) {
  fs.writeJsonSync(path.join(env.projectDir, 'Sigma', 'project.config.json'), {
    schema_version: '1.2.0',
    document_language: 'English',
    interaction_language: 'English',
    output_document_language: 'English',
    notion_humanize_gate: { enabled: true },
  });
}

describe('humanize gate — disabled by default (regression guard)', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('plan new is unaffected when notion_humanize_gate.enabled is not set', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', chainWithRoadmap('v1'));
    stubProjectIdentity(env);
    writeRoadmapFile(env);

    const result = runCli('plan new --title "T" --focus "F"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).not.toMatch(/HUMANIZE GATE/);
  });
});

describe('humanize gate — CR-01 regression: ratify/lock are never blocked', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('intent ratify succeeds even with the gate enabled and no human projection generated', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', {
      schema_version: '1.2.0', chain_version: 'v1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      lifecycle_state: 'DESIGN',
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      roadmap: null,
      plan: { active_version: null, active_state: null, versions: [], pending: [] },
      exec: { active_version: null, active_state: null, versions: [] },
      close: null,
      gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    });
    stubProjectIdentity(env);
    enableHumanizeGate(env);
    // A valid intent doc is required for `ratify`'s own structural check —
    // independent of the humanize gate being tested here.
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('intent ratify', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).not.toMatch(/HUMANIZE GATE/);
    const chain = fs.readJsonSync(chainPath(env, 'v1'));
    expect(chain.intent.state).toBe('RATIFIED');
  });
});

describe('humanize gate — plan new blocked until the RATIFIED intent is humanized and pushed', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('blocks when no human projection has been generated at all', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', chainWithRoadmap('v1'));
    stubProjectIdentity(env);
    enableHumanizeGate(env);

    const result = runCli('plan new --title "T" --focus "F"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/HUMANIZE GATE BLOCKED/);
    expect(result.stdout + result.stderr).toMatch(/sigma intent humanize/);
  });

  it('blocks when generated but not yet pushed to Notion', () => {
    env = setupTestEnv();
    const chain = chainWithRoadmap('v1') as any;
    chain.intent.human = { version: 'v1', generated_at: new Date().toISOString() }; // no pushed_to_notion_at
    writeChainFixture(env, 'v1', chain);
    stubProjectIdentity(env);
    enableHumanizeGate(env);

    const result = runCli('plan new --title "T" --focus "F"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/HUMANIZE GATE BLOCKED/);
  });

  it('succeeds once pushed_to_notion_at is set', () => {
    env = setupTestEnv();
    const chain = chainWithRoadmap('v1') as any;
    chain.intent.human = { version: 'v1', generated_at: new Date().toISOString(), pushed_to_notion_at: new Date().toISOString(), notion_page_url: 'https://notion.so/abc' };
    writeChainFixture(env, 'v1', chain);
    stubProjectIdentity(env);
    enableHumanizeGate(env);
    writeRoadmapFile(env);

    const result = runCli('plan new --title "T" --focus "F"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});

describe('humanize gate — second plan new also checks the latest LOCKED exec', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('blocks a follow-on plan new when the prior LOCKED exec has no pushed human projection', () => {
    env = setupTestEnv();
    const chain = makeChainWithLockedExec('v1', 'v1.1') as any;
    chain.roadmap = { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), locked_at: new Date().toISOString() };
    chain.intent.human = { version: 'v1', generated_at: new Date().toISOString(), pushed_to_notion_at: new Date().toISOString() };
    // exec.versions[0].human intentionally left unset.
    writeChainFixture(env, 'v1', chain);
    stubProjectIdentity(env);
    enableHumanizeGate(env);

    const result = runCli('plan new --title "T2" --focus "F2"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/DEV-EXEC v1\.1 has no human projection/);
    expect(result.stdout + result.stderr).toMatch(/sigma exec humanize --v v1\.1/);
  });

  it('succeeds when both intent and the latest locked exec are pushed', () => {
    env = setupTestEnv();
    const chain = makeChainWithLockedExec('v1', 'v1.1') as any;
    chain.roadmap = { version: 'v1', state: 'LOCKED', file: 'Sigma/roadmap/ROADMAP-v1.md', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), locked_at: new Date().toISOString() };
    chain.intent.human = { version: 'v1', generated_at: new Date().toISOString(), pushed_to_notion_at: new Date().toISOString() };
    chain.exec.versions[0].human = { version: 'v1.1', generated_at: new Date().toISOString(), pushed_to_notion_at: new Date().toISOString() };
    writeChainFixture(env, 'v1', chain);
    stubProjectIdentity(env);
    enableHumanizeGate(env);
    writeRoadmapFile(env);

    const result = runCli('plan new --title "T2" --focus "F2"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });
});

describe('humanize gate — close new checks the latest LOCKED exec', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('blocks close new when the latest LOCKED exec has no pushed human projection', () => {
    env = setupTestEnv();
    const chain = makeChainWithLockedExec('v1', 'v1.1', 60) as any; // arcScore 60 for Gate 3.5
    writeChainFixture(env, 'v1', chain);
    stubProjectIdentity(env);
    enableHumanizeGate(env);

    const result = runCli('close new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).toMatch(/HUMANIZE GATE BLOCKED/);
    expect(result.stdout + result.stderr).toMatch(/DEV-EXEC v1\.1/);
  });

  it('succeeds when the latest LOCKED exec has been pushed', () => {
    env = setupTestEnv();
    const chain = makeChainWithLockedExec('v1', 'v1.1', 60) as any;
    chain.exec.versions[0].human = { version: 'v1.1', generated_at: new Date().toISOString(), pushed_to_notion_at: new Date().toISOString() };
    writeChainFixture(env, 'v1', chain);
    stubProjectIdentity(env);
    enableHumanizeGate(env);

    const result = runCli('close new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
  });

  it('exec lock itself is never blocked by the humanize gate (CR-01 regression)', () => {
    env = setupTestEnv();
    const chain = makeChainWithDraftExec('v1') as any;
    writeChainFixture(env, 'v1', chain);
    stubProjectIdentity(env);
    enableHumanizeGate(env);
    fs.ensureDirSync(path.join(env.projectDir, 'Sigma', 'build'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v0.1.md'), validExecDoc('v0.1', 'v1'));

    const result = runCli('exec lock --v v0.1', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).not.toMatch(/HUMANIZE GATE/);
  });
});
