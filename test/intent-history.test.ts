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
  validIntentDoc,
  chainPath,
  TestEnv,
} from './helpers';

// Coverage for PLAN-EVAL-06: `--title`/`--focus` become required on `sigma intent
// new`, and Sigma/design/intent-history.md is a 100% auto-render projection across
// every chain — kept in sync at 4 trigger points (new/lock/supersede/activate) plus
// `sigma doctor` (default/--all-versions/--reconstruct) as a self-heal net.
// `doctor --reconstruct` additionally recovers title/focus from an existing
// intent-history.md when progress-v<N>.json itself is missing/corrupted (§6) —
// the only other place these fields persist.

function historyPath(env: TestEnv): string {
  return path.join(env.sigmaDir, 'design', 'intent-history.md');
}

function withIntentMeta(chain: object, title: string, focus: string): object {
  const c = chain as Record<string, unknown>;
  return { ...c, intent: { ...(c.intent as object), title, focus } };
}

function writeArtifact(sigmaDir: string, subdir: string, filename: string, content: string): void {
  const dir = path.join(sigmaDir, subdir);
  fs.ensureDirSync(dir);
  fs.writeFileSync(path.join(dir, filename), content);
}

describe('sigma intent new — required --title/--focus', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('fails when --title/--focus are missing', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('intent new', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
  });

  it('rejects --title containing "|"', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('intent new --title "Bad|Value" --focus "ok"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/cannot contain/i);
  });

  it('rejects --focus containing "|"', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('intent new --title "ok" --focus "Bad|Value"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/cannot contain/i);
  });
});

describe('Sigma/design/intent-history.md auto-render', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('creates intent-history.md with a DRAFT row after intent new', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    const result = runCli('intent new --title "First Intent" --focus "Cover the basics"', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const filePath = historyPath(env);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toMatch(/\| v1 \| First Intent \| Cover the basics \| DRAFT \| — \|/);
  });

  it('lists multiple chains in ascending version order', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);

    runCli('intent new --title "Intent One" --focus "Focus one"', env.projectDir, env.homeDir);
    runCli('intent new --title "Intent Two" --focus "Focus two"', env.projectDir, env.homeDir);

    const content = fs.readFileSync(historyPath(env), 'utf8');
    const v1Index = content.indexOf('| v1 |');
    const v2Index = content.indexOf('| v2 |');
    expect(v1Index).toBeGreaterThan(-1);
    expect(v2Index).toBeGreaterThan(v1Index);
  });

  it('updates the row to RATIFIED after intent ratify', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', withIntentMeta(makeChainWithDraftIntent('v1'), 'Foo Intent', 'Foo focus'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'design', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('intent ratify', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const content = fs.readFileSync(historyPath(env), 'utf8');
    expect(content).toMatch(/\| v1 \| Foo Intent \| Foo focus \| RATIFIED \| — \|/);
  });

  it('updates the row to SUPERSEDED with the reason after intent supersede', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', withIntentMeta(makeChainWithLockedIntent('v1'), 'Foo Intent', 'Foo focus'));

    const result = runCli('intent supersede --v v1 --reason "pivoted scope" --director-confirm', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const content = fs.readFileSync(historyPath(env), 'utf8');
    expect(content).toMatch(/\| v1 \| Foo Intent \| Foo focus \| SUPERSEDED \| pivoted scope \|/);
  });

  it('re-renders intent-history.md on activate without changing its content (no Active column — plan §3.4)', () => {
    env = setupTestEnv();
    writeChainFixture(env, 'v1', withIntentMeta(makeChainWithLockedIntent('v1'), 'Intent One', 'Focus one'), { activate: false });
    writeChainFixture(env, 'v2', withIntentMeta(makeChainWithDraftIntent('v2'), 'Intent Two', 'Focus two'));

    const seed = runCli('doctor', env.projectDir, env.homeDir);
    expect(seed.exitCode).toBe(0);
    const before = fs.readFileSync(historyPath(env), 'utf8');

    const result = runCli('intent activate --v v1', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const after = fs.readFileSync(historyPath(env), 'utf8');
    expect(after).toBe(before);
  });
});

describe('sigma doctor — intent-history.md self-heal', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('regenerates a deleted intent-history.md (default mode)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', withIntentMeta(makeChainWithLockedIntent('v1'), 'Intent One', 'Focus one'));

    const seed = runCli('doctor', env.projectDir, env.homeDir);
    expect(seed.exitCode).toBe(0);
    fs.removeSync(historyPath(env));
    expect(fs.existsSync(historyPath(env))).toBe(false);

    const result = runCli('doctor', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(historyPath(env))).toBe(true);
    expect(fs.readFileSync(historyPath(env), 'utf8')).toMatch(/\| v1 \| Intent One \| Focus one \| RATIFIED \| — \|/);
  });

  it('regenerates a deleted intent-history.md (--all-versions)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', withIntentMeta(makeChainWithLockedIntent('v1'), 'Intent One', 'Focus one'));

    const seed = runCli('doctor --all-versions', env.projectDir, env.homeDir);
    expect(seed.exitCode).toBe(0);
    fs.removeSync(historyPath(env));

    const result = runCli('doctor --all-versions', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);
    expect(fs.readFileSync(historyPath(env), 'utf8')).toMatch(/\| v1 \| Intent One \| Focus one \| RATIFIED \| — \|/);
  });

  it('doctor --reconstruct recovers title/focus from a legacy 5-column intent-history.md when progress-v<N>.json is missing', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', validIntentDoc('v1'));
    fs.writeFileSync(historyPath(env), [
      '# Intent History',
      '',
      '| Version | Title | Focus | Status | Reason |',
      '| :--- | :--- | :--- | :--- | :--- |',
      '| v1 | Recovered Title | Recovered Focus | DRAFT | — |',
      '',
    ].join('\n'));

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const chain = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, { title?: string; focus?: string }>;
    expect(chain.intent.title).toBe('Recovered Title');
    expect(chain.intent.focus).toBe('Recovered Focus');
  });

  it('doctor --reconstruct recovers title/focus from a current 7-column intent-history.md (with Score/Notes) when progress-v<N>.json is missing', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', validIntentDoc('v1'));
    fs.writeFileSync(historyPath(env), [
      '# Intent History',
      '',
      '| Version | Title | Focus | Status | Reason | Score | Notes |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
      '| v1 | Recovered Title | Recovered Focus | DRAFT | — | SATISFIED_RECOMMENDED (80) | test notes |',
      '',
    ].join('\n'));

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const chain = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, { title?: string; focus?: string }>;
    expect(chain.intent.title).toBe('Recovered Title');
    expect(chain.intent.focus).toBe('Recovered Focus');
  });

  it('doctor --reconstruct falls back to undefined title/focus when no intent-history.md exists', () => {
    env = setupTestEnv();
    writeArtifact(env.sigmaDir, 'design', 'DIR-INTENT-v1.md', validIntentDoc('v1'));

    const result = runCli('doctor --reconstruct --v v1', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const chain = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, { title?: string; focus?: string }>;
    expect(chain.intent.title).toBeUndefined();
    expect(chain.intent.focus).toBeUndefined();
  });
});
