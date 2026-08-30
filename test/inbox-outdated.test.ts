import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { setupTestEnv, runCli, stubProjectRootAnchor, makeProgress, TestEnv } from './helpers';

// Bug-report follow-up 2026-08-30 (Phase 6): the OUTDATED message tier. READ
// messages aged out of the recent window — by `sigma inbox clear` or the
// auto-sweep in `sigma inbox read` — flip to OUTDATED. Non-destructive: the
// files and index entries stay, hidden from default/`--all` listings, still
// readable by id and via `--outdated`.

function readIndex(env: TestEnv): any {
  return fs.readJsonSync(path.join(env.projectDir, 'Sigma', 'messages', 'index.json'));
}

function sendToDev(env: TestEnv, subject: string): string {
  const r = runCli(`send --from arc --to dev --subject "${subject}" --message "body ${subject}"`, env.projectDir, env.homeDir);
  expect(r.exitCode).toBe(0);
  const idx = readIndex(env);
  return idx.messages[idx.messages.length - 1].id;
}

function statusOf(env: TestEnv, id: string): string {
  return readIndex(env).messages.find((m: any) => m.id === id).status;
}

describe('sigma inbox — OUTDATED tier', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  function setup(): void {
    env = setupTestEnv();
    stubProjectRootAnchor(env);
    fs.writeJsonSync(env.progressPath, makeProgress());
  }

  it('auto-sweeps surplus READ to OUTDATED on read, keeping the 5 most recent (default)', () => {
    setup();
    const ids: string[] = [];
    for (let i = 1; i <= 7; i++) ids.push(sendToDev(env, `m${i}`));

    const outputs = ids.map(id => runCli(`inbox read ${id}`, env.projectDir, env.homeDir).stdout);

    // 5 newest READ, 2 oldest OUTDATED
    expect(statusOf(env, ids[0])).toBe('OUTDATED');
    expect(statusOf(env, ids[1])).toBe('OUTDATED');
    expect(statusOf(env, ids[2])).toBe('READ');
    expect(statusOf(env, ids[6])).toBe('READ');
    // reading the 6th and 7th message each pushes one older READ to OUTDATED
    expect(outputs[6]).toMatch(/moved to OUTDATED/);
  });

  it('OUTDATED messages are hidden from default and --all, shown only by --outdated, still readable by id', () => {
    setup();
    const ids: string[] = [];
    for (let i = 1; i <= 7; i++) ids.push(sendToDev(env, `m${i}`));
    for (const id of ids) runCli(`inbox read ${id}`, env.projectDir, env.homeDir);

    const def = runCli('inbox --role dev', env.projectDir, env.homeDir);
    expect(def.stdout).not.toMatch(new RegExp(ids[0]));

    const all = runCli('inbox --role dev --all', env.projectDir, env.homeDir);
    expect(all.stdout).not.toMatch(new RegExp(ids[0]));
    expect(all.stdout).toMatch(new RegExp(ids[6]));

    const outdated = runCli('inbox --role dev --outdated', env.projectDir, env.homeDir);
    expect(outdated.stdout).toMatch(new RegExp(ids[0]));
    expect(outdated.stdout).not.toMatch(new RegExp(ids[6]));

    const read = runCli(`inbox read ${ids[0]}`, env.projectDir, env.homeDir);
    expect(read.exitCode).toBe(0);
    expect(read.stdout).toMatch(/body m1/);
    expect(statusOf(env, ids[0])).toBe('OUTDATED'); // re-read does not un-outdate
  });

  it('config mailbox-outdate-keep 0 disables the auto-sweep', () => {
    setup();
    runCli('config set mailbox-outdate-keep 0', env.projectDir, env.homeDir);
    const ids: string[] = [];
    for (let i = 1; i <= 7; i++) ids.push(sendToDev(env, `m${i}`));
    for (const id of ids) runCli(`inbox read ${id}`, env.projectDir, env.homeDir);

    for (const id of ids) expect(statusOf(env, id)).toBe('READ');
  });

  it('sigma inbox clear ages surplus READ to OUTDATED with an explicit --keep', () => {
    setup();
    runCli('config set mailbox-outdate-keep 0', env.projectDir, env.homeDir); // isolate from auto-sweep
    const ids: string[] = [];
    for (let i = 1; i <= 6; i++) ids.push(sendToDev(env, `m${i}`));
    for (const id of ids) runCli(`inbox read ${id}`, env.projectDir, env.homeDir);

    const dry = runCli('inbox clear --role dev --keep 2 --dry-run', env.projectDir, env.homeDir);
    expect(dry.exitCode).toBe(0);
    expect(dry.stdout).toMatch(/Dry run/);
    for (const id of ids) expect(statusOf(env, id)).toBe('READ'); // unchanged

    const real = runCli('inbox clear --role dev --keep 2', env.projectDir, env.homeDir);
    expect(real.exitCode).toBe(0);
    expect(statusOf(env, ids[0])).toBe('OUTDATED');
    expect(statusOf(env, ids[3])).toBe('OUTDATED');
    expect(statusOf(env, ids[4])).toBe('READ');
    expect(statusOf(env, ids[5])).toBe('READ');
  });

  it('sigma inbox clear --all-roles requires --director-confirm', () => {
    setup();
    const blocked = runCli('inbox clear --all-roles', env.projectDir, env.homeDir);
    expect(blocked.exitCode).toBe(1);
    expect(blocked.stderr).toMatch(/--director-confirm/);

    const ok = runCli('inbox clear --all-roles --director-confirm', env.projectDir, env.homeDir);
    expect(ok.exitCode).toBe(0);
  });

  it('sigma inbox check treats OUTDATED as a valid status', () => {
    setup();
    const ids: string[] = [];
    for (let i = 1; i <= 7; i++) ids.push(sendToDev(env, `m${i}`));
    for (const id of ids) runCli(`inbox read ${id}`, env.projectDir, env.homeDir);
    expect(statusOf(env, ids[0])).toBe('OUTDATED');

    const check = runCli('inbox check', env.projectDir, env.homeDir);
    expect(check.exitCode).toBe(0);
    expect(check.stdout).not.toMatch(/INVALID status/);
    expect(check.stdout).toMatch(/0 failure\(s\)/);
  });
});
