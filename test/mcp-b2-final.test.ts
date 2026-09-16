// Stage B2 — final four tools: sigma_check_mailbox_integrity,
// sigma_get_config, sigma_get_operation_log, sigma_get_git_evidence.
// Covers: mailbox integrity findings (missing file, orphan file, missing
// attachment, duplicate ID, invalid field — never subject/content),
// config's safe surface (no credentials), operation log filtering, and
// git_evidence's full-working-tree parity (Director decision 2026-09-16).

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

import { resetBindingForTest } from '../src/mcp/shared';
import { computeCheckMailboxIntegrity } from '../src/mcp/tools/checkMailboxIntegrity';
import { computeGetConfig } from '../src/mcp/tools/getConfig';
import { computeGetOperationLog } from '../src/mcp/tools/getOperationLog';
import { computeGetGitEvidence } from '../src/mcp/tools/getGitEvidence';

import { setupTestEnv, stubProjectIdentity, stubProjectRootAnchor, TestEnv } from './helpers';

type Payload = Record<string, unknown>;

let envs: TestEnv[] = [];

function project(id = 'TEST'): TestEnv {
  const env = setupTestEnv();
  stubProjectIdentity(env, id, `${id} Project`);
  stubProjectRootAnchor(env);
  envs.push(env);
  return env;
}

beforeEach(() => {
  resetBindingForTest();
});

afterEach(() => {
  resetBindingForTest();
  for (const e of envs) e.cleanup();
  envs = [];
});

function writeIndex(env: TestEnv, messages: unknown[]): void {
  const indexPath = path.join(env.projectDir, 'Sigma', 'messages', 'index.json');
  fs.ensureDirSync(path.dirname(indexPath));
  fs.writeJsonSync(indexPath, { messages });
}

describe('sigma_check_mailbox_integrity', () => {
  it('reports ok:true, zero findings on an empty mailbox', () => {
    const env = project();
    writeIndex(env, []);
    const out = computeCheckMailboxIntegrity(env.projectDir) as Payload;
    expect(out.ok).toBe(true);
    expect(out.failures).toBe(0);
    expect(out.warnings).toBe(0);
  });

  it('detects a missing file, missing attachment, and invalid field — never returns subject/content', () => {
    const env = project();
    writeIndex(env, [
      { id: 'MSG-1', from: 'ARC', to: 'FMN', type: 'NOTE', subject: 'Secret subject line', file: 'Sigma/messages/FMN/MSG-1.md', status: 'UNREAD', created_at: new Date().toISOString(), attachments: ['Sigma/messages/attach/missing.txt'] },
      { id: 'MSG-2', from: 'ARC', to: 'BOGUS', type: 'NOTE', subject: 'x', file: 'Sigma/messages/FMN/MSG-2.md', status: 'UNREAD', created_at: new Date().toISOString(), attachments: [] },
    ]);
    const out = computeCheckMailboxIntegrity(env.projectDir) as Payload;
    expect(out.ok).toBe(false);
    const findings = out.findings as Payload;
    expect((findings.missing_files as unknown[]).length).toBeGreaterThan(0);
    expect((findings.missing_attachments as unknown[]).length).toBe(1);
    expect((findings.invalid_fields as unknown[]).length).toBeGreaterThan(0);
    expect(JSON.stringify(out)).not.toContain('Secret subject line');
  });

  // duplicate_ids in the compute function mirrors the CLI's own dead-code
  // path: readIndex() -> validateIndexData() already fails closed on a
  // duplicate ID (mailbox.ts's corruptionError) before either the CLI's or
  // this tool's own manual duplicate-scan loop ever runs. Confirmed by
  // reading the guard directly, not asserted as a passing scenario here —
  // there is no reachable state where this tool's own duplicate_ids array
  // is populated.
  it('propagates readIndex()\'s own corruption guard on a duplicate ID, rather than reaching this tool\'s duplicate-scan logic', () => {
    const env = project();
    writeIndex(env, [
      { id: 'MSG-1', from: 'ARC', to: 'FMN', type: 'NOTE', subject: 'x', file: 'Sigma/messages/FMN/MSG-1.md', status: 'UNREAD', created_at: new Date().toISOString(), attachments: [] },
      { id: 'MSG-1', from: 'ARC', to: 'FMN', type: 'NOTE', subject: 'x', file: 'Sigma/messages/FMN/MSG-1-dup.md', status: 'UNREAD', created_at: new Date().toISOString(), attachments: [] },
    ]);
    expect(() => computeCheckMailboxIntegrity(env.projectDir)).toThrow(/duplicate message ID/);
  });

  it('detects an orphan .md file not referenced by the index', () => {
    const env = project();
    writeIndex(env, []);
    const orphanPath = path.join(env.projectDir, 'Sigma', 'messages', 'FMN', 'ORPHAN.md');
    fs.ensureDirSync(path.dirname(orphanPath));
    fs.writeFileSync(orphanPath, 'orphan content\n');
    const out = computeCheckMailboxIntegrity(env.projectDir) as Payload;
    expect(out.warnings).toBe(1);
    const findings = out.findings as Payload;
    expect((findings.orphan_files as string[])[0]).toContain('ORPHAN.md');
  });
});

describe('sigma_get_config', () => {
  it('returns language/gate/mailbox settings with no credential fields', () => {
    const env = project();
    const out = computeGetConfig(env.projectDir) as Payload;
    expect(out.active).toBe(true);
    expect(out).toHaveProperty('interaction_language');
    expect(out).toHaveProperty('notion_humanize_gate_enabled');
    expect(JSON.stringify(out).toLowerCase()).not.toMatch(/token|secret|api_key|credential/);
  });
});

describe('sigma_get_operation_log', () => {
  function writeLog(env: TestEnv, entries: object[]): void {
    const logPath = path.join(env.sigmaDir, 'logs', 'operations.jsonl');
    fs.ensureDirSync(path.dirname(logPath));
    fs.writeFileSync(logPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  }

  it('returns an empty list when no log file exists', () => {
    const env = project();
    const out = computeGetOperationLog(env.projectDir, {}) as Payload;
    expect(out.entries).toEqual([]);
  });

  it('filters by status and operation substring', () => {
    const env = project();
    writeLog(env, [
      { operation: 'intent new', timestamp: new Date().toISOString(), status: 'success', exit_code: 0 },
      { operation: 'plan lock', timestamp: new Date().toISOString(), status: 'error', exit_code: 1 },
    ]);
    const out = computeGetOperationLog(env.projectDir, { status: 'error' }) as Payload;
    expect((out.entries as Payload[])).toHaveLength(1);
    expect((out.entries as Payload[])[0].operation).toBe('plan lock');

    const filtered = computeGetOperationLog(env.projectDir, { operation: 'intent' }) as Payload;
    expect((filtered.entries as Payload[])).toHaveLength(1);
  });

  it('applies limit to keep only the last N entries', () => {
    const env = project();
    writeLog(env, [
      { operation: 'a', timestamp: new Date().toISOString(), status: 'success', exit_code: 0 },
      { operation: 'b', timestamp: new Date().toISOString(), status: 'success', exit_code: 0 },
      { operation: 'c', timestamp: new Date().toISOString(), status: 'success', exit_code: 0 },
    ]);
    const out = computeGetOperationLog(env.projectDir, { limit: 2 }) as Payload;
    expect((out.entries as Payload[]).map((e) => e.operation)).toEqual(['b', 'c']);
  });

  it('skips corrupt lines rather than failing the whole report', () => {
    const env = project();
    const logPath = path.join(env.sigmaDir, 'logs', 'operations.jsonl');
    fs.ensureDirSync(path.dirname(logPath));
    fs.writeFileSync(logPath, 'not json\n{"operation":"a","timestamp":"2026-01-01T00:00:00.000Z","status":"success","exit_code":0}\n');
    const out = computeGetOperationLog(env.projectDir, {}) as Payload;
    expect((out.entries as Payload[])).toHaveLength(1);
  });
});

describe('sigma_get_git_evidence', () => {
  it('reports present:false when no git repository exists', () => {
    const env = project();
    const out = computeGetGitEvidence(env.projectDir) as Payload;
    expect(out.present).toBe(false);
  });

  it('reports branch/commit/status/diff for a real git repository', () => {
    const env = project();
    const opts = { cwd: env.projectDir, stdio: 'ignore' as const };
    execSync('git init -q', opts);
    execSync('git config user.email test@example.com', opts);
    execSync('git config user.name Test', opts);
    fs.writeFileSync(path.join(env.projectDir, 'a.txt'), 'hello\n');
    execSync('git add a.txt', opts);
    execSync('git commit -q -m "initial"', opts);
    fs.writeFileSync(path.join(env.projectDir, 'a.txt'), 'hello changed\n');

    const out = computeGetGitEvidence(env.projectDir) as Payload;
    expect(out.present).toBe(true);
    const commit = out.commit as Payload;
    expect(commit.subject).toBe('initial');
    expect(out.changed_files).toContain('a.txt');
    expect(out.diff_stat).toContain('a.txt');
  });
});
