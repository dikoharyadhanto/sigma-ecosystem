import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  stubProjectIdentity,
  writeChainFixture,
  makeChainWithDraftIntent,
  makeChainWithLockedIntent,
  validIntentDoc,
  chainPath,
  TestEnv,
} from './helpers';

// Guards of `sigma intent amendment` and the effective-state (UNCERTIFIED_EDIT)
// hash certification. The Git-based recording flow (F05) is covered by
// f05-intent-git-amendment.test.ts.

function intentDocFile(env: TestEnv, version = 'v1'): string {
  return path.join(env.projectDir, 'Sigma', 'charter', `DIR-INTENT-${version}.md`);
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
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithDraftIntent('v1'));

    const result = runCli('intent amendment --change "test" --purpose-changed no --commit HEAD --doc-sha256 abc --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/amendment requires RATIFIED/);
  });

  it('fails when the intent is SUPERSEDED', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
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

    const result = runCli('intent amendment --v v1 --change "test" --purpose-changed no --commit HEAD --doc-sha256 abc --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/amendment requires RATIFIED|RATIFIED INTENT/);
  });

  it('rejects --change containing "|"', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1'));

    const result = runCli('intent amendment --change "bad | change" --purpose-changed no --commit HEAD --doc-sha256 abc --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/cannot contain/i);
  });

  it('rejects an empty/whitespace-only --change', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
    writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
    fs.writeFileSync(intentDocFile(env), validIntentDoc('v1'));

    const result = runCli('intent amendment --change "   " --purpose-changed no --commit HEAD --doc-sha256 abc --director-confirm', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/cannot be empty/i);
  });
});

describe('Effective-state certification — UNCERTIFIED_EDIT', () => {
  let env: TestEnv;

  afterEach(() => env?.cleanup());

  it('sigma intent ratify certifies the doc hash; status/check show no drift immediately after', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
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
    stubProjectIdentity(env);
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
    expect(check.stdout).toMatch(/sigma intent amendment preview/);
  });

  it('sigma doctor reports UNCERTIFIED_EDIT-causing drift without touching certified_doc_sha256 (no self-heal)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    stubProjectIdentity(env);
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
