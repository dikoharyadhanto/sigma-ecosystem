import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
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

// Coverage for the Amendment mechanism (Discussion 2026-08-11_0115 §3 item 4,
// Director directive 2026-08-12): `sigma intent amendment`, Section 14
// auto-render, and the effective-state (UNCERTIFIED_EDIT) hash certification
// that backs it.

function intentDocFile(env: TestEnv, version = 'v1'): string {
  return path.join(env.projectDir, 'Sigma', 'design', `DIR-INTENT-${version}.md`);
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('sigma intent amendment — guards', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('fails when the intent is DRAFT', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));

    const result = runCli('intent amendment --change "test"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/amendment requires RATIFIED/);
  });

  it('fails when the intent is SUPERSEDED', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const superseded = makeChainWithLockedIntent('v1') as Record<string, any>;
    superseded.intent.state = 'SUPERSEDED';
    superseded.intent.supersede_reason = 'abandoned';
    // supersedeIntentVersion() never resets gates.gate_1_open (chain.ts) — a
    // real superseded chain still carries it as true, which trips
    // assertChainCanMutate()'s general semantic guard before this command's
    // own `intent.state !== 'RATIFIED'` guard is even reached. Both are
    // legitimate rejections of the same thing: a SUPERSEDED intent can't be
    // written to. Match on that closed set of possible error text rather
    // than asserting exactly which layer caught it.
    writeChainFixture(env, 'v1', superseded, { activate: false });
    writeChainFixture(env, 'v2', makeChainWithDraftIntent('v2'), { activate: true });

    const result = runCli('intent amendment --v v1 --change "test"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/amendment requires RATIFIED|RATIFIED INTENT/);
  });

  it('rejects --change containing "|"', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1'));

    const result = runCli('intent amendment --change "bad | change"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/cannot contain/i);
  });

  it('rejects an empty/whitespace-only --change', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1'));

    const result = runCli('intent amendment --change "   "', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/cannot be empty/i);
  });
});

describe('sigma intent amendment — recording and rendering', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('records AMD-001, then AMD-002 on a second call, in order', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1'));

    const first = runCli('intent amendment --change "first change"', env.projectDir, env.homeDir);
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toMatch(/AMD-001 recorded/);

    const second = runCli('intent amendment --change "second change"', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toMatch(/AMD-002 recorded/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.amendments).toHaveLength(2);
    expect(data.intent.amendments[0]).toMatchObject({ id: 'AMD-001', change: 'first change' });
    expect(data.intent.amendments[1]).toMatchObject({ id: 'AMD-002', change: 'second change' });
    expect(data.intent.effective_amendment).toBe('AMD-002');
  });

  it('renders Section 14 with the recorded amendment, leaving the rest of the document untouched', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    const original = validIntentDoc('v1');
    fs.writeFileSync(intentDocFile(env), original);

    const result = runCli('intent amendment --change "§6.3 Non-Goals: removed X"', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const rendered = fs.readFileSync(intentDocFile(env), 'utf8');
    expect(rendered).toMatch(/\| AMD-001 \| \d{4}-\d{2}-\d{2} \| §6\.3 Non-Goals: removed X \|/);
    // Everything that existed before Section 14 is byte-for-byte unchanged.
    expect(rendered.startsWith(original)).toBe(true);
  });

  it('auto-injects Section 14 into a DIR-INTENT document that predates the Amendment mechanism', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1')); // no Section 14 marker
    expect(fs.readFileSync(intentDocFile(env), 'utf8')).not.toMatch(/AMENDMENT_HISTORY/);

    const result = runCli('intent amendment --change "first amendment on a legacy doc"', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    const rendered = fs.readFileSync(intentDocFile(env), 'utf8');
    expect(rendered).toMatch(/SIGMA:DIR_INTENT:SECTION:AMENDMENT_HISTORY/);
    expect(rendered).toMatch(/## 14\. Amendment History/);
    expect(rendered).toMatch(/first amendment on a legacy doc/);
  });

  it('appends one JSONL record per amendment to Sigma/logs/intent_amendment.log', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1'));

    runCli('intent amendment --change "logged change"', env.projectDir, env.homeDir);

    const logPath = path.join(env.projectDir, 'Sigma', 'logs', 'intent_amendment.log');
    expect(fs.existsSync(logPath)).toBe(true);
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record).toMatchObject({ chain: 'v1', id: 'AMD-001', change: 'logged change' });
    expect(record.doc_sha256).toBeTruthy();
    expect(record.created_at).toBeTruthy();
    expect(record.director_approved_at).toBeTruthy();
  });
});

describe('Effective-state certification — UNCERTIFIED_EDIT', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma intent ratify certifies the doc hash; status/check show no drift immediately after', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1'));

    const ratified = runCli('intent ratify', env.projectDir, env.homeDir);
    expect(ratified.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.certified_doc_sha256).toBe(sha256(validIntentDoc('v1')));
    expect(data.intent.certified_at).toBeTruthy();

    const status = runCli('intent status', env.projectDir, env.homeDir);
    expect(status.stdout).not.toMatch(/UNCERTIFIED_EDIT/);

    const check = runCli('intent check', env.projectDir, env.homeDir);
    expect(check.stdout).not.toMatch(/UNCERTIFIED_EDIT/);
  });

  it('a manual edit after ratify surfaces UNCERTIFIED_EDIT in status and check, referencing ratification', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    const chain = makeChainWithLockedIntent('v1') as Record<string, any>;
    const originalDoc = validIntentDoc('v1');
    chain.intent.certified_doc_sha256 = sha256(originalDoc);
    chain.intent.certified_at = now;
    writeChainFixture(env, 'v1', chain);
    fs.writeFileSync(intentDocFile(env), originalDoc + '\n<!-- manual edit, no amendment -->');

    const status = runCli('intent status', env.projectDir, env.homeDir);
    expect(status.stdout).toMatch(/UNCERTIFIED_EDIT \(edited after ratification\)/);

    const check = runCli('intent check', env.projectDir, env.homeDir);
    expect(check.stdout).toMatch(/UNCERTIFIED_EDIT/);
    expect(check.stdout).toMatch(/sigma intent amendment/);
  });

  it('recording an amendment clears UNCERTIFIED_EDIT (re-certifies against the rendered document)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    const chain = makeChainWithLockedIntent('v1') as Record<string, any>;
    const originalDoc = validIntentDoc('v1');
    chain.intent.certified_doc_sha256 = sha256(originalDoc);
    chain.intent.certified_at = now;
    writeChainFixture(env, 'v1', chain);
    fs.writeFileSync(intentDocFile(env), originalDoc + '\n<!-- manual edit, no amendment yet -->');

    const preCheck = runCli('intent status', env.projectDir, env.homeDir);
    expect(preCheck.stdout).toMatch(/UNCERTIFIED_EDIT/);

    const amended = runCli('intent amendment --change "folds in the manual edit above"', env.projectDir, env.homeDir);
    expect(amended.exitCode).toBe(0);

    const postCheck = runCli('intent status', env.projectDir, env.homeDir);
    expect(postCheck.stdout).not.toMatch(/UNCERTIFIED_EDIT/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    const onDisk = fs.readFileSync(intentDocFile(env), 'utf8');
    expect(data.intent.certified_doc_sha256).toBe(sha256(onDisk));
  });

  it('sigma doctor reports UNCERTIFIED_EDIT-causing drift without touching certified_doc_sha256 (no self-heal)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    const now = new Date().toISOString();
    const chain = makeChainWithLockedIntent('v1') as Record<string, any>;
    const originalDoc = validIntentDoc('v1');
    const originalHash = sha256(originalDoc);
    chain.intent.certified_doc_sha256 = originalHash;
    chain.intent.certified_at = now;
    writeChainFixture(env, 'v1', chain);
    fs.writeFileSync(intentDocFile(env), originalDoc + '\n<!-- drift -->');

    const result = runCli('doctor', env.projectDir, env.homeDir);
    expect(result.exitCode).toBe(0);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.certified_doc_sha256).toBe(originalHash);

    const status = runCli('intent status', env.projectDir, env.homeDir);
    expect(status.stdout).toMatch(/UNCERTIFIED_EDIT/);
  });
});
