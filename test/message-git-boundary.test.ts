import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  setupTestEnv, writeChainFixture, makeChainWithLockedIntent, stubProjectIdentity, TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-REPORT-DIAGNOSTIC-MESSAGE-GIT-BOUNDARY — WP-MSG-01.
//
// Creating a Sigma message is a local filesystem mutation. It must never stage,
// commit, tag, or push, and it must say so. These tests prove that from two
// sides: no `git` process is started at all while a message is sent (a shim
// first on PATH records every invocation), and a real local repository with a
// bare remote shows no ref, index, or remote change afterwards.
//
// TC-MSG-03 (CONTRACT_CHANGE side effects) lives in f04-lifecycle.test.ts next
// to the notice fixtures it needs.

const CLI = path.resolve(__dirname, '..', process.env.SIGMA_TEST_DIST ?? 'dist', 'cli.js');
const dirs: string[] = [];
let env: TestEnv | undefined;

afterEach(() => {
  env?.cleanup();
  env = undefined;
  for (const d of dirs.splice(0)) fs.removeSync(d);
});

function tmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
}

function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
}

function project(): TestEnv {
  const e = setupTestEnv();
  writeChainFixture(e, 'v1', makeChainWithLockedIntent('v1'));
  stubProjectIdentity(e);
  return e;
}

function send(e: TestEnv, extra: string, pathPrefix?: string): { stdout: string; status: number } {
  const envVars = { ...process.env, HOME: e.homeDir, USERPROFILE: e.homeDir };
  if (pathPrefix) envVars.PATH = `${pathPrefix}${path.delimiter}${process.env.PATH}`;
  try {
    const stdout = execSync(
      `node "${CLI}" send --from arc --to fmn --related-artifact GENERAL --message "boundary check" ${extra}`,
      { cwd: e.projectDir, env: envVars, encoding: 'utf8' });
    return { stdout, status: 0 };
  } catch (err) {
    const x = err as { stdout?: string; status?: number };
    return { stdout: x.stdout ?? '', status: x.status ?? 1 };
  }
}

describe('message creation and the Git boundary', () => {
  it('TC-MSG-01: never starts a git process, with or without an attachment', () => {
    env = project();
    const attach = path.join(env.projectDir, 'evidence.txt');
    fs.writeFileSync(attach, 'attached evidence\n');

    // `git` shim: records the call, then fails, so any use is both visible and fatal.
    const shimDir = tmp('sigma-git-shim-');
    const calls = path.join(shimDir, 'calls.log');
    const shim = path.join(shimDir, 'git');
    fs.writeFileSync(shim, `#!/bin/sh\necho "$@" >> "${calls}"\nexit 1\n`, { mode: 0o755 });

    const plain = send(env, '', shimDir);
    const withAttachment = send(env, `--attach "${attach}"`, shimDir);

    expect(plain.status).toBe(0);
    expect(withAttachment.status).toBe(0);
    expect(fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8') : '').toBe('');
  });

  it('TC-MSG-02: leaves local refs, the index, and a bare remote byte-identical', () => {
    env = project();
    const remote = tmp('sigma-git-remote-');
    git(remote, 'init -q --bare');
    git(env.projectDir, 'init -q');
    git(env.projectDir, 'config user.email t@example.invalid');
    git(env.projectDir, 'config user.name t');
    git(env.projectDir, 'add -A');
    git(env.projectDir, 'commit -q -m base');
    git(env.projectDir, `remote add origin "${remote}"`);
    git(env.projectDir, 'push -q origin HEAD');

    const gitState = () => ({
      head: git(env!.projectDir, 'rev-parse HEAD'),
      refs: git(env!.projectDir, 'for-each-ref'),
      tags: git(env!.projectDir, 'tag --list'),
      staged: git(env!.projectDir, 'diff --cached --name-only'),
      remote: git(remote, 'for-each-ref'),
    });
    const before = gitState();

    const result = send(env, '');
    expect(result.status).toBe(0);

    expect(gitState()).toEqual(before);
    // The message exists locally and is merely untracked, not staged or committed.
    expect(git(env.projectDir, 'status --porcelain')).toMatch(/^\?\? .*Sigma\//m);
  });

  it('AC-MSG-02: output separates local writes from Git publication', () => {
    env = project();
    const result = send(env, '');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Message sent.');
    expect(result.stdout).toMatch(/Local\s+: wrote message file, mailbox index/);
    expect(result.stdout).toMatch(/Git\s+: nothing staged, committed, tagged, or pushed/);
  });
});

// TC-MSG-04 — deferred design guard (WP-MSG-02, AC-MSG-04).
//
// The shape of message tooling over MCP (query/control split, prepare/commit,
// audience and sender rules, attachment policy) is intentionally undecided.
// Until a Director decision record exists, the mailbox-family tools registered
// today are the only ones allowed. Adding another must be a deliberate edit to
// this list, in the same change as its decision record.
const APPROVED_MAILBOX_TOOLS = ['sigma_check_mailbox_integrity', 'sigma_inbox_archive'];

function collectRegisteredToolNames(dir: string): string[] {
  const names: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) names.push(...collectRegisteredToolNames(abs));
    else if (entry.name.endsWith('.ts')) {
      for (const m of fs.readFileSync(abs, 'utf8').matchAll(/registerTool\(\s*'([^']+)'/g)) names.push(m[1]);
    }
  }
  return names;
}

describe('deferred message/MCP design', () => {
  it('TC-MSG-04: registers no mailbox-family MCP tool beyond the approved set', () => {
    const all = collectRegisteredToolNames(path.resolve(__dirname, '..', 'src', 'mcp'));
    expect(all.length, 'tool discovery found nothing; the scan pattern is stale').toBeGreaterThan(20);
    const mailbox = all.filter(n => /message|inbox|memo(?!ry)|mailbox|send/.test(n)).sort();
    expect(mailbox,
      'mailbox MCP tools need an approved decision record (PLAN-IMPL-SIGMA-REPORT-DIAGNOSTIC-MESSAGE-GIT-BOUNDARY WP-MSG-02) before they are registered')
      .toEqual([...APPROVED_MAILBOX_TOOLS].sort());
  });
});
