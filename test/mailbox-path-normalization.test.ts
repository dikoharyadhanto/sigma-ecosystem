import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, stubProjectRootAnchor, TestEnv } from './helpers';

// Bug report 2026-08-30 (BUG B): Sigma/messages/index.json entries written on
// Windows store `file` with backslash separators (e.g.
// "Sigma\messages\DEV\...md"). On POSIX, path.join() treats "\" as a literal
// filename character, so `sigma inbox read` / `inbox check` look for a file
// whose name literally contains backslashes and fail even though the real
// forward-slash file exists. readIndex() now normalizes "\" → "/" on every
// read, before the duplicate-path check. index.json itself is not rewritten.

function writeIndex(env: TestEnv, messages: unknown[]): void {
  const indexPath = path.join(env.projectDir, 'Sigma', 'messages', 'index.json');
  fs.ensureDirSync(path.dirname(indexPath));
  fs.writeJsonSync(indexPath, { messages }, { spaces: 2 });
}

function writeMessageFile(env: TestEnv, role: string, filename: string, body = '# msg\n\nhi\n'): void {
  const dir = path.join(env.projectDir, 'Sigma', 'messages', role);
  fs.ensureDirSync(dir);
  fs.writeFileSync(path.join(dir, filename), body, 'utf8');
}

const baseEntry = {
  from: 'FMN',
  to: 'DEV',
  type: 'NOTE',
  subject: 'Historical handoff',
  status: 'READ',
  created_at: '2026-07-20T04:34:55.837Z',
  attachments: [] as string[],
};

describe('mailbox — Windows backslash path normalization on read', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('sigma inbox read resolves an entry whose file field uses backslashes', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeMessageFile(env, 'DEV', '20260720-043455837-KC06-NOTE-FMN-to-DEV.md');
    writeIndex(env, [{
      ...baseEntry,
      id: 'MSG-20260720-043455-KC06-FMN-DEV',
      file: 'Sigma\\messages\\DEV\\20260720-043455837-KC06-NOTE-FMN-to-DEV.md',
    }]);

    const result = runCli('inbox read MSG-20260720-043455-KC06-FMN-DEV', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/missing on disk|ENOENT/i);
    expect(result.stdout).toMatch(/hi/);
  });

  it('sigma inbox check passes for a backslash entry whose forward-slash file exists (no missing + no orphan)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeMessageFile(env, 'DEV', '20260720-043455837-KC06-NOTE-FMN-to-DEV.md');
    writeIndex(env, [{
      ...baseEntry,
      id: 'MSG-20260720-043455-KC06-FMN-DEV',
      file: 'Sigma\\messages\\DEV\\20260720-043455837-KC06-NOTE-FMN-to-DEV.md',
    }]);

    const result = runCli('inbox check', env.projectDir, env.homeDir);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toMatch(/MISSING FILE/);
    expect(result.stdout).not.toMatch(/ORPHAN FILE/);
    expect(result.stdout).toMatch(/0 failure\(s\)/);
  });

  it('index.json on disk is left untouched (normalization is in-memory only)', () => {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    writeMessageFile(env, 'DEV', '20260720-043455837-KC06-NOTE-FMN-to-DEV.md');
    const raw = 'Sigma\\messages\\DEV\\20260720-043455837-KC06-NOTE-FMN-to-DEV.md';
    writeIndex(env, [{ ...baseEntry, id: 'MSG-20260720-043455-KC06-FMN-DEV', file: raw }]);

    runCli('inbox read MSG-20260720-043455-KC06-FMN-DEV', env.projectDir, env.homeDir);

    const onDisk = fs.readJsonSync(path.join(env.projectDir, 'Sigma', 'messages', 'index.json'));
    expect(onDisk.messages[0].file).toBe(raw);
  });
});
