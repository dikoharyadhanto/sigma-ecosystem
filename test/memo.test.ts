import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv,
  runCli,
  stubProjectRootAnchor,
  writeChainFixture,
  makeChainWithLockedExec,
  TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF-20260902 — self-to-self operational
// brief. type: MEMO, from === to, own command group (`sigma memo`), excluded
// from the send-gate unread count and from `sigma inbox` listings.

function readIndex(env: TestEnv): any {
  const indexPath = path.join(env.projectDir, 'Sigma', 'messages', 'index.json');
  if (!fs.existsSync(indexPath)) return { messages: [] };
  return fs.readJsonSync(indexPath);
}

function entryOf(env: TestEnv, id: string): any {
  return readIndex(env).messages.find((m: any) => m.id === id);
}

function writeMemo(
  env: TestEnv,
  role: string,
  opts: { ref?: string; topic?: string; message?: string; subject?: string; to?: string } = {}
) {
  const ref = opts.ref !== undefined ? `--ref "${opts.ref}"` : '--ref GENERAL';
  const topic = opts.topic !== undefined ? `--topic "${opts.topic}"` : '--topic "test topic"';
  const message = opts.message !== undefined ? `--message "${opts.message}"` : '--message "test body"';
  const subject = opts.subject !== undefined ? `--subject "${opts.subject}"` : '';
  const to = opts.to !== undefined ? `--to ${opts.to}` : '';
  return runCli(`memo write --role ${role} ${ref} ${topic} ${message} ${subject} ${to}`, env.projectDir, env.homeDir);
}

function lastMemoId(env: TestEnv): string {
  const idx = readIndex(env);
  return idx.messages[idx.messages.length - 1].id;
}

describe('sigma memo', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  function setup(): void {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
  }

  it('1. sigma memo write --role dev creates a MEMO entry, from===to===DEV, action FYI, status UNREAD, related_artifact = --ref', () => {
    setup();
    const r = writeMemo(env, 'dev', { ref: 'PLAN-v1' });
    expect(r.exitCode).toBe(0);
    const entry = entryOf(env, lastMemoId(env));
    expect(entry.type).toBe('MEMO');
    expect(entry.from).toBe('DEV');
    expect(entry.to).toBe('DEV');
    expect(entry.action).toBe('FYI');
    expect(entry.related_artifact).toBe('PLAN-v1');
    expect(entry.status).toBe('UNREAD');
  });

  it('2. --to is rejected outright and writes nothing', () => {
    setup();
    const before = readIndex(env).messages.length;
    const r = writeMemo(env, 'dev', { to: 'arc' });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/does not take --to/);
    expect(readIndex(env).messages.length).toBe(before);
  });

  it('3. quota: the (N+1)th unread memo is rejected with the unread list; 1..N succeed (default limit 5)', () => {
    setup();
    for (let i = 1; i <= 5; i++) {
      const r = writeMemo(env, 'dev', { topic: `topic ${i}` });
      expect(r.exitCode).toBe(0);
    }
    const blocked = writeMemo(env, 'dev', { topic: 'topic 6' });
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toMatch(/MEMO QUOTA FULL/);
    expect(blocked.stderr).toMatch(/5\/5/);
    expect(readIndex(env).messages.length).toBe(5);
  });

  it('4. a full memo quota does NOT block sigma send (regression on the send gate)', () => {
    setup();
    for (let i = 1; i <= 5; i++) expect(writeMemo(env, 'dev', { topic: `t${i}` }).exitCode).toBe(0);
    const send = runCli('send --from dev --to arc --message "hello"', env.projectDir, env.homeDir);
    expect(send.exitCode).toBe(0);
  });

  it('5. a full memo quota for DEV does NOT block memo write for another role (per-role isolation)', () => {
    setup();
    for (let i = 1; i <= 5; i++) expect(writeMemo(env, 'dev', { topic: `t${i}` }).exitCode).toBe(0);
    const arc = writeMemo(env, 'arc', { topic: 'arc topic' });
    expect(arc.exitCode).toBe(0);
  });

  it('6. sigma memo read <id> prints content, marks READ, and frees one quota slot', () => {
    setup();
    for (let i = 1; i <= 5; i++) expect(writeMemo(env, 'dev', { topic: `t${i}` }).exitCode).toBe(0);
    const id = lastMemoId(env);

    const read = runCli(`memo read ${id}`, env.projectDir, env.homeDir);
    expect(read.exitCode).toBe(0);
    expect(read.stdout).toMatch(/Topic/);
    expect(entryOf(env, id).status).toBe('READ');

    // Slot freed — a 6th write now succeeds.
    const next = writeMemo(env, 'dev', { topic: 't6' });
    expect(next.exitCode).toBe(0);
  });

  it('7. sigma memo read rejects an id that is not type MEMO', () => {
    setup();
    const send = runCli('send --from arc --to dev --message "hi"', env.projectDir, env.homeDir);
    expect(send.exitCode).toBe(0);
    const id = readIndex(env).messages[0].id;

    const r = runCli(`memo read ${id}`, env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/is not a memo/);
    expect(r.stderr).toMatch(/sigma inbox read/);
  });

  it('8. sigma inbox excludes MEMO from the listing but prints a pointer line when unread memos exist', () => {
    setup();
    expect(writeMemo(env, 'dev', { topic: 'a memo' }).exitCode).toBe(0);
    const memoId = lastMemoId(env);
    expect(runCli('send --from arc --to dev --subject "a real message" --message "body"', env.projectDir, env.homeDir).exitCode).toBe(0);

    const inbox = runCli('inbox --role dev', env.projectDir, env.homeDir);
    expect(inbox.exitCode).toBe(0);
    expect(inbox.stdout).not.toMatch(new RegExp(memoId));
    expect(inbox.stdout).toMatch(/a real message/);
    expect(inbox.stdout).toMatch(/1 unread memo — sigma memo list --role dev/);
  });

  it('9. auto-sweep: READ memos age to OUTDATED beyond auto_outdate_read_keep; UNREAD memos are never touched', () => {
    setup();
    const ids: string[] = [];
    for (let i = 1; i <= 7; i++) {
      expect(writeMemo(env, 'dev', { topic: `t${i}` }).exitCode).toBe(0);
      const id = lastMemoId(env);
      ids.push(id);
      expect(runCli(`memo read ${id}`, env.projectDir, env.homeDir).exitCode).toBe(0);
    }

    expect(entryOf(env, ids[0]).status).toBe('OUTDATED');
    expect(entryOf(env, ids[1]).status).toBe('OUTDATED');
    expect(entryOf(env, ids[2]).status).toBe('READ');
    expect(entryOf(env, ids[6]).status).toBe('READ');

    // One more, left UNREAD — must never be swept regardless of pool size.
    expect(writeMemo(env, 'dev', { topic: 'unread one' }).exitCode).toBe(0);
    const unreadId = lastMemoId(env);
    expect(entryOf(env, unreadId).status).toBe('UNREAD');
  });

  it('10. sigma inbox check accepts MEMO entries without flagging INVALID type', () => {
    setup();
    expect(writeMemo(env, 'dev', { topic: 'a memo' }).exitCode).toBe(0);
    const check = runCli('inbox check', env.projectDir, env.homeDir);
    expect(check.exitCode).toBe(0);
    expect(check.stdout).not.toMatch(/INVALID type/);
    expect(check.stdout).toMatch(/0 failure\(s\)/);
  });

  it('11. sigma config set memo-limit 0 disables memo write with an explicit message', () => {
    setup();
    expect(runCli('config set memo-limit 0', env.projectDir, env.homeDir).exitCode).toBe(0);
    const r = writeMemo(env, 'dev', {});
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/disabled/);
  });

  it('12. the Chain / Phase / Version line resolves from the active chain, and degrades gracefully with none', () => {
    setup();
    writeChainFixture(env, 'v1', makeChainWithLockedExec('v1', 'v1.1'));
    expect(writeMemo(env, 'dev', { ref: 'GENERAL' }).exitCode).toBe(0);
    const withChain = entryOf(env, lastMemoId(env));
    const contentWithChain = fs.readFileSync(path.join(env.projectDir, withChain.file), 'utf8');
    expect(contentWithChain).toMatch(/v1 \| BUILD \| INTENT v1 \(RATIFIED\) · PLAN v1\.1 \(LOCKED\) · EXEC v1\.1 \(LOCKED\)/);

    // No chain at all — degrade gracefully instead of failing.
    env.cleanup();
    setup();
    expect(writeMemo(env, 'dev', { ref: 'GENERAL' }).exitCode).toBe(0);
    const noChain = entryOf(env, lastMemoId(env));
    const contentNoChain = fs.readFileSync(path.join(env.projectDir, noChain.file), 'utf8');
    expect(contentNoChain).toMatch(/\(unresolved — no active chain\)/);
  });

  it('13. an invalid --ref is rejected and writes nothing', () => {
    setup();
    const before = readIndex(env).messages.length;
    const r = writeMemo(env, 'dev', { ref: 'BOGUS' });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Invalid --ref/);
    expect(readIndex(env).messages.length).toBe(before);
  });

  it('14. --ref GENERAL is accepted with no active chain', () => {
    setup();
    const r = writeMemo(env, 'dev', { ref: 'GENERAL' });
    expect(r.exitCode).toBe(0);
  });

  it('15. an empty --topic is rejected and writes nothing', () => {
    setup();
    const before = readIndex(env).messages.length;
    const r = writeMemo(env, 'dev', { topic: '' });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--topic is required/);
    expect(readIndex(env).messages.length).toBe(before);
  });

  it('16. an omitted --subject is auto-filled from --topic', () => {
    setup();
    expect(writeMemo(env, 'dev', { topic: 'auto subject from here' }).exitCode).toBe(0);
    const entry = entryOf(env, lastMemoId(env));
    expect(entry.subject).toBe('auto subject from here');
  });
});
