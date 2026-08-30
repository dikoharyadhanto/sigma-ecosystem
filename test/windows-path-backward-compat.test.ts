import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectIdentity,
  writeChainFixture,
  chainPath,
  makeChain,
  validIntentDoc,
  validExecDoc,
  TestEnv,
} from './helpers';

// Bug report (2026-08-30, KLHK_JasaLingkunganHidup project): a progress-v<N>.json
// written/edited on Windows stores `entry.file` with backslash separators
// (e.g. "Sigma\build\DEV-EXEC-v3.6.md"). On Linux/macOS, path.join() treats
// "\" as a literal filename character rather than a separator, so every
// command reading that entry (exec check, exec lock, ...) throws ENOENT for
// a file that does exist on disk, just under its real forward-slash path.
// readChain()'s normalizeFilePathsOnRead() now rewrites "\" to "/" on every
// read, and doctor persists the fix (same choke-point pattern as the
// RATIFIED schema migration covered in doctor-schema-migration.test.ts).

describe('Windows backslash file paths — read-time normalization', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('exec check reads DEV-EXEC via a backslash-separated entry.file on Linux', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma\\charter\\DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
      plan: {
        active_version: 'v1.1', active_state: 'LOCKED', pending: [],
        versions: [{ version: 'v1.1', state: 'LOCKED', file: 'Sigma\\contract\\FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
      },
      exec: {
        active_version: 'v1.1', active_state: 'DRAFT',
        versions: [{ version: 'v1.1', state: 'DRAFT', file: 'Sigma\\evidence\\DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1' }],
      },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md'), validExecDoc('v1.1', 'v1.1'));

    const result = runCli('exec check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/ENOENT|not found/i);
    expect(result.stdout).toMatch(/Lock readiness: Eligible/);
  });

  it('doctor persists backslash entry.file fields to disk as forward slashes, reporting the migration', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma\\charter\\DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/file path normalized to forward slashes.*Sigma\\charter\\DIR-INTENT-v1\.md/);

    const data = fs.readJsonSync(chainPath(env, 'v1')) as Record<string, any>;
    expect(data.intent.file).toBe('Sigma/charter/DIR-INTENT-v1.md');
  });

  it('is idempotent — a second doctor run reports no further path migration', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma\\charter\\DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const first = runCli('doctor', env.projectDir, env.homeDir);
    expect(first.stdout).toMatch(/file path normalized to forward slashes/);

    const second = runCli('doctor', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).not.toMatch(/file path normalized to forward slashes/);
  });

  it('does not touch a chain whose entry.file already uses forward slashes (no false-positive migration report)', () => {
    env = setupTestEnv();
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      intent: { version: 'v1', state: 'DRAFT', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'charter', 'DIR-INTENT-v1.md'), validIntentDoc('v1'));

    const result = runCli('doctor', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/file path normalized to forward slashes/);
  });
});
