import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { normalizeVersionArg } from '../src/engine/chain';
import {
  setupTestEnv,
  runCli,
  stubProjectIdentity,
  writeChainFixture,
  makeChain,
  validExecDoc,
  TestEnv,
} from './helpers';

// Bug report 2026-08-30, Priority 5a: `sigma exec check --v 3.4` and
// `sigma exec check --v v3.4` took different code paths — stored version
// strings always carry a leading "v", so the bare-number form silently
// missed the lookup and reported "not found". normalizeVersionArg() is wired
// as a commander coercion fn on every `--v` / `--plan` option so both forms
// resolve identically.

describe('normalizeVersionArg', () => {
  it('adds the "v" prefix to a bare numeric version', () => {
    expect(normalizeVersionArg('3')).toBe('v3');
    expect(normalizeVersionArg('3.4')).toBe('v3.4');
    expect(normalizeVersionArg('1.15')).toBe('v1.15');
  });

  it('passes an already-prefixed version through unchanged (idempotent)', () => {
    expect(normalizeVersionArg('v3')).toBe('v3');
    expect(normalizeVersionArg('v3.4')).toBe('v3.4');
  });

  it('lowercases an uppercase "V" prefix', () => {
    expect(normalizeVersionArg('V3.4')).toBe('v3.4');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeVersionArg('  3.4  ')).toBe('v3.4');
    expect(normalizeVersionArg(' v3.4 ')).toBe('v3.4');
  });

  it('leaves undefined and non-version text alone', () => {
    expect(normalizeVersionArg(undefined)).toBeUndefined();
    expect(normalizeVersionArg('latest')).toBe('latest');
  });
});

describe('sigma exec check — --v accepts both "3.4" and "v3.4"', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  function seedChainWithTwoExecDrafts(env: TestEnv) {
    const now = new Date().toISOString();
    writeChainFixture(env, 'v1', makeChain('v1', {
      lifecycle_state: 'BUILD',
      intent: { version: 'v1', state: 'RATIFIED', file: 'Sigma/charter/DIR-INTENT-v1.md', created_at: now, updated_at: now, ratified_at: now },
      plan: {
        active_version: 'v1.2', active_state: 'LOCKED', pending: [],
        versions: [
          { version: 'v1.1', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
          { version: 'v1.2', state: 'LOCKED', file: 'Sigma/contract/FMN-PLAN-v1.2.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' },
        ],
      },
      exec: {
        active_version: 'v1.2', active_state: 'DRAFT',
        versions: [
          { version: 'v1.1', state: 'DRAFT', file: 'Sigma/evidence/DEV-EXEC-v1.1.md', created_at: now, updated_at: now, plan_version_ref: 'v1.1' },
          { version: 'v1.2', state: 'DRAFT', file: 'Sigma/evidence/DEV-EXEC-v1.2.md', created_at: now, updated_at: now, plan_version_ref: 'v1.2' },
        ],
      },
    }));
    stubProjectIdentity(env);
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.1.md'), validExecDoc('v1.1', 'v1.1'));
    fs.writeFileSync(path.join(env.projectDir, 'Sigma', 'evidence', 'DEV-EXEC-v1.2.md'), validExecDoc('v1.2', 'v1.2'));
  }

  it('resolves the same DEV-EXEC whether the prefix is given or not', () => {
    env = setupTestEnv();
    seedChainWithTwoExecDrafts(env);

    const withPrefix = runCli('exec check --v v1.1', env.projectDir, env.homeDir);
    const withoutPrefix = runCli('exec check --v 1.1', env.projectDir, env.homeDir);

    expect(withPrefix.exitCode).toBe(0);
    expect(withoutPrefix.exitCode).toBe(0);
    expect(withoutPrefix.stdout).not.toMatch(/not found/i);
    // Both forms target v1.1 — the check output names the version it read.
    expect(withoutPrefix.stdout).toMatch(/v1\.1/);
  });
});
