import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { setupTestEnv, stubProjectRootAnchor, stubProjectIdentity, makeChainWithFullBuiltCycle, writeChainFixture, runCli, TestEnv } from './helpers';
import { MessageEntry, readIndex, writeIndex, getUnreadForRole, getUnreadMemosForRole, checkMailboxIntegrity } from '../src/engine/mailbox';
import { resolveMailboxReference, mailboxScope, assertMailboxMutable } from '../src/engine/mailboxContext';
import { migrateMailbox, mailboxMigrationDiagnosis, withMailboxLock } from '../src/engine/mailboxMigration';
import { computeOrientation } from '../src/mcp/tools/orientation';
import { computeDoctor } from '../src/mcp/tools/doctor';
import { readMailboxEntry, clearMailbox } from '../src/services/mailboxService';
import { archiveMessage } from '../src/services/inboxArchiveService';

const execute = promisify(execFile);
let envs: TestEnv[] = [];
afterEach(() => { delete process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT; for (const e of envs) e.cleanup(); envs = []; });
function project(): TestEnv { const e = setupTestEnv(); envs.push(e); stubProjectRootAnchor(e); stubProjectIdentity(e); return e; }
function chains(e: TestEnv): void {
  const old: any = makeChainWithFullBuiltCycle('v3', 'v2.1'); old.versioning_scheme = 'legacy_offset';
  const aligned: any = makeChainWithFullBuiltCycle('v4', 'v4.1');
  aligned.plan.versions.push({ ...aligned.plan.versions[0], version: 'v4.2', file: 'Sigma/contract/FMN-PLAN-v4.2.md' });
  writeChainFixture(e, 'v3', old, { activate: false }); writeChainFixture(e, 'v4', aligned);
}
function activate(e: TestEnv, v: string): void { fs.writeJsonSync(e.activateStatusPath, { active_chain: v }); }
function entry(e: TestEnv, id: string, intent: string | null, context: string, type: 'NOTE' | 'MEMO' = 'NOTE', status: MessageEntry['status'] = 'UNREAD', to: MessageEntry['to'] = 'DEV'): MessageEntry {
  const file = `Sigma/${type === 'MEMO' ? 'memo' : 'messages'}/${to}/${context}/${id}.md`;
  fs.outputFileSync(path.join(e.projectDir, file), `original ${id}\n`);
  return { id, from: type === 'MEMO' ? to : 'ARC', to, type, subject: id, file, status, created_at: new Date(1700000000000 + Number(id.replace(/\D/g, '') || 0)).toISOString(), attachments: [], intent_version: intent, context, related_artifact: intent ? `INTENT-${intent}` : 'GENERAL' };
}
function seed(e: TestEnv, entries: MessageEntry[]): void {
  // Versioned entries in fixtures use the artifact that matches their context.
  for (const m of entries) if (m.intent_version) m.related_artifact = m.context.includes('.') ? `PLAN-${m.context}` : `INTENT-${m.context}`;
  writeIndex(e.projectDir, { mailbox_format: 2, messages: entries });
}
function legacy(e: TestEnv): MessageEntry[] {
  const messages = (['UNREAD', 'READ', 'ARCHIVED', 'OUTDATED'] as const).map((status, i) => {
    const m = entry(e, `old${i}`, null, 'LEGACY', i === 0 ? 'MEMO' : 'NOTE', status);
    fs.removeSync(path.join(e.projectDir, m.file));
    m.file = `Sigma/messages/DEV/${m.id}.md`; delete m.context; delete m.intent_version;
    fs.outputFileSync(path.join(e.projectDir, m.file), `legacy evidence ${m.id}\n`);
    return m;
  });
  messages[2].reply_to = messages[1].id;
  messages[2].attachments = [messages[1].file];
  writeIndex(e.projectDir, { messages }); return messages;
}
const cli = (e: TestEnv, args: string) => runCli(args, e.projectDir, e.homeDir);

describe('F03 mailbox identity and scopes', () => {
  it('resolves legacy/aligned and role prefixes by membership, and rejects the inactive owner', () => {
    const e = project(); chains(e);
    expect(resolveMailboxReference(e.projectDir, 'PLAN-v4.1')).toMatchObject({ intent_version: 'v4', context: 'v4.1' });
    expect(() => resolveMailboxReference(e.projectDir, 'DEV-EXEC-v2.1')).toThrow(/Cross-intent/);
    activate(e, 'v3');
    expect(resolveMailboxReference(e.projectDir, 'FMN-PLAN-v2.1')).toMatchObject({ intent_version: 'v3', context: 'v2.1' });
    expect(resolveMailboxReference(e.projectDir, 'v2.1')).toMatchObject({ intent_version: 'v3' });
    expect(resolveMailboxReference(e.projectDir, 'ROADMAP-v3')).toMatchObject({ intent_version: 'v3', context: 'v3' });
    expect(resolveMailboxReference(e.projectDir, 'DIR-CLOSE-v3')).toMatchObject({ intent_version: 'v3' });
  });
  it('unknown references use GENERAL without reclassifying, malformed/ambiguous references fail', () => {
    const e = project(); chains(e);
    expect(resolveMailboxReference(e.projectDir, 'PLAN-v99.1')).toMatchObject({ context: 'GENERAL', warning: expect.any(String) });
    expect(() => resolveMailboxReference(e.projectDir, '../PLAN-v4.1')).toThrow(/Invalid/);
    const duplicate: any = makeChainWithFullBuiltCycle('v5', 'v4.1'); duplicate.versioning_scheme = 'legacy_offset';
    writeChainFixture(e, 'v5', duplicate, { activate: false });
    expect(() => resolveMailboxReference(e.projectDir, 'PLAN-v4.1')).toThrow(/Ambiguous/);
  });
  it('minor queues aggregate per intent; GENERAL unread is always visible; switches never reset status', () => {
    const e = project(); chains(e);
    seed(e, [entry(e, 'm1', 'v3', 'v2.1'), entry(e, 'm2', 'v4', 'v4.1'), entry(e, 'm3', 'v4', 'v4.2'), entry(e, 'm4', null, 'GENERAL'), entry(e, 'm5', null, 'LEGACY', 'NOTE', 'READ')]);
    const before = fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json'));
    expect(getUnreadForRole(readIndex(e.projectDir), 'DEV', { scope: mailboxScope(e.projectDir) }).map(m => m.id)).toEqual(['m2', 'm3', 'm4']);
    activate(e, 'v3');
    expect(getUnreadForRole(readIndex(e.projectDir), 'DEV', { scope: mailboxScope(e.projectDir) }).map(m => m.id)).toEqual(['m1', 'm4']);
    expect(fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json')).equals(before)).toBe(true);
    expect(cli(e, 'inbox --role dev --intent v4 --all').stdout).toContain('m3');
    expect(cli(e, 'inbox --role dev --context LEGACY --all').stdout).toContain('m5');
  });
  it('GENERAL is available without a chain and has its own quota', () => {
    const e = project();
    for (let i = 0; i < 5; i++) expect(cli(e, `memo write --role dev --ref GENERAL --topic t${i} --message body`).exitCode).toBe(0);
    expect(cli(e, 'memo write --role dev --ref GENERAL --topic full --message body').exitCode).toBe(1);
    const id = readIndex(e.projectDir).messages[0].id;
    expect(cli(e, `memo read ${id}`).exitCode).toBe(0);
    expect(cli(e, 'memo write --role dev --ref GENERAL --topic freed --message body').exitCode).toBe(0);
    chains(e);
    expect(cli(e, 'memo write --role dev --ref PLAN-v4.1 --topic intent --message body').exitCode).toBe(0);
    expect(getUnreadMemosForRole(readIndex(e.projectDir), 'DEV', { intent: 'v4' })).toHaveLength(1);
  });
  it('same-intent FYI on another minor blocks send, other intent does not; GENERAL blocks all sends', () => {
    const e = project(); chains(e);
    seed(e, [entry(e, 'old1', 'v3', 'v2.1')]);
    expect(cli(e, 'send --from dev --to fmn --related-artifact PLAN-v4.2 --message ok').exitCode).toBe(0);
    seed(e, [entry(e, 'minor1', 'v4', 'v4.1')]);
    expect(cli(e, 'send --from dev --to fmn --related-artifact PLAN-v4.2 --action review --message blocked').stderr).toContain('SEND BLOCKED');
    seed(e, [entry(e, 'general1', null, 'GENERAL')]);
    expect(cli(e, 'send --from dev --to fmn --related-artifact PLAN-v4.2 --message blocked').stderr).toContain('SEND BLOCKED');
  });
  it.each(['fyi', 'respond', 'review', 'unblock', 'other'])('all actions use the same gate: %s', action => {
    const e = project(); chains(e); seed(e, [entry(e, 'm1', 'v4', 'v4.1')]);
    expect(cli(e, `send --from dev --to fmn --related-artifact PLAN-v4.2 --action ${action} --message body`).exitCode).toBe(1);
    expect(readIndex(e.projectDir).messages).toHaveLength(1);
  });
  it('legacy send/memo folders store the artifact number but identify its INTENT; wrong owner writes nothing', () => {
    const e = project(); chains(e); activate(e, 'v3');
    expect(cli(e, 'send --from dev --to fmn --related-artifact PLAN-v2.1 --message old').exitCode).toBe(0);
    expect(cli(e, 'memo write --role dev --ref EXEC-v2.1 --topic old --message body').exitCode).toBe(0);
    const [message, memo] = readIndex(e.projectDir).messages;
    expect(message.file).toContain('/messages/FMN/v2.1/'); expect(memo.file).toContain('/memo/DEV/v2.1/');
    expect(message.intent_version).toBe('v3'); expect(memo.intent_version).toBe('v3');
    const before = fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json'));
    expect(cli(e, 'send --from dev --to fmn --related-artifact PLAN-v4.1 --attach package.json --message wrong').exitCode).toBe(1);
    expect(fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json')).equals(before)).toBe(true);
  });
  it('CLI/MCP orientation use identical relevant counts and queries do not write', () => {
    const e = project(); chains(e); seed(e, [entry(e, 'm1', 'v3', 'v2.1'), entry(e, 'm2', 'v4', 'v4.1'), entry(e, 'm3', null, 'GENERAL', 'MEMO')]);
    const before = fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json'));
    const out: any = computeOrientation(e.projectDir, 'DEV');
    expect(out.inbox_unread).toEqual({ DEV: 1 }); expect(out.memo_unread).toEqual({ DEV: 1 }); expect(out.mailbox_status).toBe('ready');
    const bootstrap = cli(e, 'session bootstrap --role dev');
    expect(bootstrap.stdout).toContain('1 unread message'); expect(bootstrap.stdout).toContain('1 unread memo');
    expect(bootstrap.stdout).not.toContain('m1'); expect(fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json')).equals(before)).toBe(true);
  });
  it('corrupt identity produces unavailable counts and blocks mutations', () => {
    const e = project(); chains(e); seed(e, [entry(e, 'm1', 'v4', 'v4.1')]);
    const idx: any = readIndex(e.projectDir); idx.messages[0].context = 'v99.1';
    fs.writeJsonSync(path.join(e.sigmaDir, 'messages/index.json'), idx);
    const out: any = computeOrientation(e.projectDir);
    expect(out.mailbox_status).toBe('invalid'); expect(out.mailbox_warnings.join(' ')).toContain('unavailable');
    expect(cli(e, 'send --from dev --to fmn --message nope').exitCode).toBe(1);
  });
});

describe('F03 replies, retention and integrity', () => {
  it('reply inherits parent, explicit same-intent minor is accepted, missing/inactive/GENERAL mismatch are rejected', () => {
    const e = project(); chains(e); seed(e, [entry(e, 'parent1', 'v4', 'v4.1', 'NOTE', 'READ')]);
    expect(cli(e, 'send --from dev --to fmn --reply-to parent1 --message reply').exitCode).toBe(0);
    expect(readIndex(e.projectDir).messages[1]).toMatchObject({ context: 'v4.1', reply_to: 'parent1' });
    expect(cli(e, 'send --from dev --to fmn --reply-to parent1 --related-artifact PLAN-v4.2 --message reply').exitCode).toBe(0);
    expect(cli(e, 'send --from dev --to fmn --reply-to missing --message nope').exitCode).toBe(1);
    expect(cli(e, 'send --from dev --to fmn --reply-to parent1 --related-artifact GENERAL --message nope').exitCode).toBe(1);
    activate(e, 'v3'); expect(cli(e, 'send --from dev --to fmn --reply-to parent1 --message nope').exitCode).toBe(1);
  });
  it('retention groups messages and memos independently, does not sweep another intent or GENERAL', () => {
    const e = project(); chains(e);
    seed(e, [...Array.from({ length: 7 }, (_, i) => entry(e, `m${i}`, 'v4', 'v4.1', 'NOTE', 'READ')), ...Array.from({ length: 7 }, (_, i) => entry(e, `memo${i}`, 'v4', 'v4.1', 'MEMO', 'READ')), entry(e, 'old99', 'v3', 'v2.1', 'NOTE', 'READ'), entry(e, 'general99', null, 'GENERAL', 'NOTE', 'READ')]);
    readMailboxEntry(e.projectDir, 'm6', false);
    expect(readIndex(e.projectDir).messages.filter(m => m.status === 'OUTDATED').map(m => m.id)).toEqual(['m0', 'm1']);
    clearMailbox(e.projectDir, ['DEV'], 0, { intent: 'v4' }, true, false);
    expect(readIndex(e.projectDir).messages.find(m => m.id === 'old99')!.status).toBe('READ');
    expect(readIndex(e.projectDir).messages.find(m => m.id === 'general99')!.status).toBe('READ');
    expect(readIndex(e.projectDir).messages.filter(m => m.type === 'MEMO' && m.status === 'OUTDATED')).toHaveLength(7);
  });
  it('clear defaults to active intent; history selectors and destructive breadth require explicit confirmation', () => {
    const e = project(); chains(e); seed(e, [entry(e, 'm1', 'v4', 'v4.1', 'NOTE', 'READ'), entry(e, 'm2', 'v3', 'v2.1', 'NOTE', 'READ')]);
    expect(cli(e, 'inbox clear --role dev --keep 0 --dry-run').exitCode).toBe(0);
    expect(readIndex(e.projectDir).messages.every(m => m.status === 'READ')).toBe(true);
    expect(cli(e, 'inbox clear --role dev --keep 0').exitCode).toBe(0);
    expect(readIndex(e.projectDir).messages.find(m => m.id === 'm2')!.status).toBe('READ');
    expect(cli(e, 'inbox clear --role dev --all-intents --keep 0').exitCode).toBe(1);
    expect(cli(e, 'inbox clear --role dev --all-intents --director-confirm --keep 0').exitCode).toBe(0);
    expect(cli(e, 'inbox --role dev --all --outdated').exitCode).toBe(1);
  });
  it('an explicit minor clear never sweeps another minor of the same INTENT', () => {
    const e = project(); chains(e); seed(e, [entry(e, 'm1', 'v4', 'v4.1', 'NOTE', 'READ'), entry(e, 'm2', 'v4', 'v4.2', 'NOTE', 'READ')]);
    clearMailbox(e.projectDir, ['DEV'], 0, { intent: 'v4', context: 'v4.2' }, false, false);
    expect(readIndex(e.projectDir).messages.map(m => m.status)).toEqual(['READ', 'OUTDATED']);
  });
  it('a junction outside the project cannot receive a message or memo', () => {
    const e = project(); seed(e, []);
    fs.ensureDirSync(path.join(e.sigmaDir, 'messages'));
    fs.symlinkSync(e.homeDir, path.join(e.sigmaDir, 'messages/DEV'), 'junction');
    fs.outputFileSync(path.join(e.projectDir, 'attachment.txt'), 'attachment');
    expect(cli(e, 'send --from arc --to dev --attach attachment.txt --message boundary').exitCode).toBe(1);
    expect(fs.existsSync(path.join(e.sigmaDir, 'messages/attachments'))).toBe(false);
    expect(readIndex(e.projectDir).messages).toHaveLength(0);
    expect(fs.existsSync(path.join(e.homeDir, 'GENERAL'))).toBe(false);
  });
  it('nested memo/message orphan files are found, and a boundary escape is rejected', () => {
    const e = project(); seed(e, [entry(e, 'm1', null, 'GENERAL')]);
    fs.outputFileSync(path.join(e.sigmaDir, 'memo/DEV/v3.1/orphan.md'), 'orphan');
    expect(checkMailboxIntegrity(e.projectDir).findings.orphan_files).toContain('Sigma/memo/DEV/v3.1/orphan.md');
    const idx: any = readIndex(e.projectDir); idx.messages[0].file = '../outside.md';
    fs.writeJsonSync(path.join(e.sigmaDir, 'messages/index.json'), idx);
    expect(() => readIndex(e.projectDir)).toThrow();
  });
});

describe('F03 migration and concurrent writes', () => {
  it('migrates all old entries, only resets UNREAD, keeps bytes/IDs/replies and updates moved attachment references', async () => {
    const e = project(); const old = legacy(e), before = old.map(m => fs.readFileSync(path.join(e.projectDir, m.file)));
    const diagnosis: any = computeDoctor(e.projectDir); expect(diagnosis.applied).toBe(false); expect(diagnosis.mailbox.required).toBe(true);
    expect((await migrateMailbox(e.projectDir, true)).applied).toBe(false); expect(readIndex(e.projectDir).mailbox_format).toBeUndefined();
    expect(() => assertMailboxMutable(e.projectDir, readIndex(e.projectDir))).toThrow(/migration required/);
    const result: any = await migrateMailbox(e.projectDir); expect(result.moved).toBe(4); expect(result.reset_unread).toBe(1);
    const migrated = readIndex(e.projectDir); expect(migrated.mailbox_format).toBe(2);
    migrated.messages.forEach((m, i) => { expect(m.id).toBe(old[i].id); expect(m.context).toBe('LEGACY'); expect(fs.readFileSync(path.join(e.projectDir, m.file)).equals(before[i])).toBe(true); expect(fs.existsSync(path.join(e.projectDir, old[i].file))).toBe(false); });
    expect(migrated.messages.map(m => m.status)).toEqual(['READ', 'READ', 'ARCHIVED', 'OUTDATED']);
    expect(migrated.messages[2].reply_to).toBe(old[1].id); expect(migrated.messages[2].attachments).toEqual([migrated.messages[1].file]);
    expect(checkMailboxIntegrity(e.projectDir).ok).toBe(true);
    const bytes = fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json'));
    expect((await migrateMailbox(e.projectDir) as any).moved).toBe(0); expect(fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json')).equals(bytes)).toBe(true);
    expect(cli(e, 'memo read old0').stdout).toContain('administratively');
  });
  it.each(['after_journal', 'after_copy', 'after_index', 'after_commit'])('recovers an interrupted migration at %s without losing or duplicating entries', async point => {
    const e = project(); legacy(e); process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT = point;
    await expect(migrateMailbox(e.projectDir)).rejects.toThrow(/failpoint/);
    expect(mailboxMigrationDiagnosis(e.projectDir).interrupted).toBe(true);
    delete process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT;
    await migrateMailbox(e.projectDir);
    expect(readIndex(e.projectDir).messages).toHaveLength(4); expect(checkMailboxIntegrity(e.projectDir)).toMatchObject({ ok: true, warnings: 0 });
    expect(mailboxMigrationDiagnosis(e.projectDir).interrupted).toBe(false);
  });
  it('source missing/orphan/collision/corruption stops before index changes; no orphan is assigned a guessed identity', async () => {
    for (const failure of ['missing', 'orphan', 'collision', 'corrupt']) {
      const e = project(); const old = legacy(e), indexPath = path.join(e.sigmaDir, 'messages/index.json');
      if (failure === 'missing') fs.removeSync(path.join(e.projectDir, old[0].file));
      if (failure === 'orphan') fs.outputFileSync(path.join(e.sigmaDir, 'messages/DEV/unknown.md'), 'unindexed');
      if (failure === 'collision') fs.outputFileSync(path.join(e.sigmaDir, 'memo/DEV/LEGACY/old0.md'), 'do not overwrite');
      if (failure === 'corrupt') fs.writeFileSync(indexPath, '{broken');
      const bytes = fs.readFileSync(indexPath);
      await expect(migrateMailbox(e.projectDir)).rejects.toThrow(); expect(fs.readFileSync(indexPath).equals(bytes)).toBe(true);
    }
  });
  it('changed source after interruption requires manual recovery and is never overwritten', async () => {
    const e = project(); const old = legacy(e); process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT = 'after_copy';
    await expect(migrateMailbox(e.projectDir)).rejects.toThrow(); delete process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT;
    fs.writeFileSync(path.join(e.projectDir, old[0].file), 'Director edit');
    await expect(migrateMailbox(e.projectDir)).rejects.toThrow(/hash conflict/);
    expect(fs.readFileSync(path.join(e.projectDir, old[0].file), 'utf8')).toBe('Director edit');
  });
  it('a corrupt journal snapshot cannot overwrite the index during recovery', async () => {
    const e = project(); legacy(e); process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT = 'after_index';
    await expect(migrateMailbox(e.projectDir)).rejects.toThrow(); delete process.env.SIGMA_TEST_MAILBOX_MIGRATION_FAILPOINT;
    const journalPath = path.join(e.sigmaDir, 'messages/migrations/v2/journal.json');
    const journal = fs.readJsonSync(journalPath); journal.before = Buffer.from('corrupt backup').toString('base64'); fs.writeJsonSync(journalPath, journal);
    const bytes = fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json'));
    await expect(migrateMailbox(e.projectDir)).rejects.toThrow();
    expect(fs.readFileSync(path.join(e.sigmaDir, 'messages/index.json')).equals(bytes)).toBe(true);
  });
  it('format-v2 entries are not remigrated or reset', async () => {
    const e = project(); seed(e, [entry(e, 'm1', null, 'GENERAL')]);
    expect((await migrateMailbox(e.projectDir) as any).moved).toBe(0); expect(readIndex(e.projectDir).messages[0].status).toBe('UNREAD');
  });
  it('two CLI writers share the lock and do not lose index entries', async () => {
    const e = project(); const cliPath = path.resolve(__dirname, '../dist/cli.js');
    const opts = { cwd: e.projectDir, env: { ...process.env, HOME: e.homeDir, USERPROFILE: e.homeDir } };
    await Promise.all([execute(process.execPath, [cliPath, 'send', '--from', 'arc', '--to', 'fmn', '--message', 'one'], opts), execute(process.execPath, [cliPath, 'memo', 'write', '--role', 'dev', '--ref', 'GENERAL', '--topic', 'two', '--message', 'body'], opts)]);
    expect(readIndex(e.projectDir).messages).toHaveLength(2); expect(checkMailboxIntegrity(e.projectDir)).toMatchObject({ ok: true, warnings: 0 });
  });
  it.each(['after_index', 'after_commit'])('recovers after a real process exit at %s and a stale lease', async point => {
    const e = project(); legacy(e);
    const cliPath = path.resolve(__dirname, '../dist/cli.js');
    const opts = { cwd: e.projectDir, env: { ...process.env, HOME: e.homeDir, USERPROFILE: e.homeDir, NODE_ENV: 'test', SIGMA_TEST_MAILBOX_MIGRATION_CRASH_AT: point } };
    await expect(execute(process.execPath, [cliPath, 'doctor', '--migrate-mailbox'], opts)).rejects.toMatchObject({ code: 91 });
    expect(mailboxMigrationDiagnosis(e.projectDir).interrupted).toBe(true);
    const retry = await execute(process.execPath, [cliPath, 'doctor', '--migrate-mailbox'], { ...opts, env: { ...opts.env, SIGMA_TEST_MAILBOX_MIGRATION_CRASH_AT: '' } });
    expect(retry.stderr).toBe(''); expect(readIndex(e.projectDir).messages).toHaveLength(4);
    expect(checkMailboxIntegrity(e.projectDir)).toMatchObject({ ok: true, warnings: 0 });
    expect(mailboxMigrationDiagnosis(e.projectDir).interrupted).toBe(false);
  }, 20000);
  it('archive preserves ownership and shared lock serializes archive with migration', async () => {
    const e = project(); legacy(e); await migrateMailbox(e.projectDir);
    expect(() => archiveMessage({ projectRoot: e.projectDir, messageId: 'old1', actorRole: 'FMN' })).toThrow(/addressed to DEV/);
    await withMailboxLock(e.projectDir, () => archiveMessage({ projectRoot: e.projectDir, messageId: 'old1', actorRole: 'DEV' }));
    expect(readIndex(e.projectDir).messages.find(m => m.id === 'old1')!.status).toBe('ARCHIVED');
  });
});
