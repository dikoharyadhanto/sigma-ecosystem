import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

// F09 — distribution support: orphan adoption during mailbox migration, removal
// of retired assets by `setup update`, and bridge files in `project sync`.
// Everything runs against a throwaway HOME and project directory.

const CLI = path.resolve(__dirname, '..', process.env.SIGMA_TEST_DIST ?? 'dist', 'cli.js');

interface Run { stdout: string; stderr: string; exitCode: number }

function sigma(args: string[], cwd: string, home: string): Run {
  const r = spawnSync('node', [CLI, ...args], {
    cwd, env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf-8', input: '',
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', exitCode: r.status ?? 1 };
}

const cleanups: string[] = [];
function tmp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(dir);
  return dir;
}
afterEach(() => { while (cleanups.length) fs.removeSync(cleanups.pop()!); });

function world(): { home: string; project: string } {
  const home = tmp('sigma-f09-home-');
  const project = tmp('sigma-f09-proj-');
  expect(sigma(['setup', 'install', '--yes'], project, home).exitCode).toBe(0);
  expect(sigma(['project', 'start', '--id', 'F09T', '--name', 'F09 test', '--confirm'], project, home).exitCode).toBe(0);
  return { home, project };
}

function message(id: string, opts: { type?: string; from?: string; to?: string; created?: string; attachments?: string } = {}): string {
  return [
    `# MSG-${id}`, '', '## Metadata', '',
    '| Field          | Value |', '| :---           | :---  |',
    `| Message ID     | ${id} |`, `| Type           | ${opts.type ?? 'NOTE'} |`,
    `| From           | ${opts.from ?? 'FMN'} |`, `| To             | ${opts.to ?? 'DEV'} |`,
    '| Subject        | Hello |', '| Status         | UNREAD |',
    `| Created At     | ${opts.created ?? '2026-06-01T08:00:00.000Z'} |`,
    '| Related Artifact | DEV-EXEC-v0.1 |', '| In Reply To    | — |',
    `| Attachments    | ${opts.attachments ?? '—'} |`, '', '---', '',
    '## Action Required', '', '- [ ] FYI', '- [x] RESPOND', '- [ ] REVIEW', '', '---', '', '## Message', '', 'Body.', '',
  ].join('\n');
}

function legacyMailbox(project: string, files: Array<{ role: string; name: string; text: string; indexed?: boolean }>): void {
  const messages: unknown[] = [];
  for (const f of files) {
    const rel = `Sigma/messages/${f.role}/${f.name}`;
    fs.ensureDirSync(path.join(project, 'Sigma', 'messages', f.role));
    fs.writeFileSync(path.join(project, rel), f.text);
    if (f.indexed) {
      const id = /Message ID\s*\|\s*([^|\s]+)/.exec(f.text)![1];
      messages.push({ id, from: 'FMN', to: f.role, type: 'NOTE', subject: 'Hello', file: rel, status: 'READ', created_at: '2026-06-01T08:00:00.000Z', attachments: [] });
    }
  }
  // Legacy index: no mailbox_format key.
  fs.writeJsonSync(path.join(project, 'Sigma', 'messages', 'index.json'), { messages }, { spaces: 2 });
}

const indexOf = (project: string) => fs.readJsonSync(path.join(project, 'Sigma', 'messages', 'index.json'));

describe('F09 orphan adoption', () => {
  it('migration without the flag still refuses on an orphan', () => {
    const { home, project } = world();
    legacyMailbox(project, [{ role: 'DEV', name: 'orphan.md', text: message('MSG-20260601-080000000-AAAA-FMN-DEV') }]);
    const run = sigma(['doctor', '--migrate-mailbox'], project, home);
    expect(run.exitCode).not.toBe(0);
    expect(run.stdout + run.stderr).toContain('preflight failed');
  });

  it('previews adoptable and rejected files without writing', () => {
    const { home, project } = world();
    legacyMailbox(project, [
      { role: 'DEV', name: 'good.md', text: message('MSG-20260601-080000000-AAAA-FMN-DEV') },
      { role: 'DEV', name: 'bad.md', text: message('MSG-20260601-080100000-BBBB-FMN-DEV', { type: 'NOPE' }) },
    ]);
    const before = fs.readFileSync(path.join(project, 'Sigma', 'messages', 'index.json'), 'utf8');
    const run = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--dry-run'], project, home);
    expect(run.exitCode).toBe(0);
    const out = JSON.parse(run.stdout);
    expect(out.adopt_orphans.adoptable).toBe(1);
    expect(out.adopt_orphans.rejected).toHaveLength(1);
    expect(out.adopt_orphans.rejected[0].file).toContain('bad.md');
    expect(fs.readFileSync(path.join(project, 'Sigma', 'messages', 'index.json'), 'utf8')).toBe(before);
  });

  it('needs --director-confirm and changes nothing when any file cannot be adopted', () => {
    const { home, project } = world();
    legacyMailbox(project, [
      { role: 'DEV', name: 'good.md', text: message('MSG-20260601-080000000-AAAA-FMN-DEV') },
      { role: 'DEV', name: 'bad.md', text: message('MSG-20260601-080100000-BBBB-FMN-DEV', { to: 'ARC' }) },
    ]);
    const noConfirm = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans'], project, home);
    expect(noConfirm.exitCode).not.toBe(0);
    expect(noConfirm.stdout + noConfirm.stderr).toContain('--director-confirm');
    const before = fs.readFileSync(path.join(project, 'Sigma', 'messages', 'index.json'), 'utf8');
    const refused = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], project, home);
    expect(refused.exitCode).not.toBe(0);
    expect(refused.stdout + refused.stderr).toContain('Orphan adoption refused');
    expect(fs.readFileSync(path.join(project, 'Sigma', 'messages', 'index.json'), 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(project, 'Sigma', 'messages', 'DEV', 'good.md'))).toBe(true);
  });

  it('adopts parsable orphans as READ legacy entries, migrates them, and is idempotent', () => {
    const { home, project } = world();
    legacyMailbox(project, [
      { role: 'DEV', name: 'indexed.md', text: message('MSG-20260601-070000000-IIII-FMN-DEV'), indexed: true },
      { role: 'DEV', name: 'orphan.md', text: message('MSG-20260601-080000000-AAAA-FMN-DEV') },
    ]);
    const run = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], project, home);
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
    const out = JSON.parse(run.stdout);
    expect(out).toMatchObject({ applied: true, moved: 2, adopted_orphans: 1, reset_unread: 0 });
    const index = indexOf(project);
    expect(index.mailbox_format).toBe(2);
    const adopted = index.messages.find((m: { id: string }) => m.id === 'MSG-20260601-080000000-AAAA-FMN-DEV');
    expect(adopted).toMatchObject({ status: 'READ', context: 'LEGACY', type: 'NOTE', from: 'FMN', to: 'DEV' });
    expect(fs.existsSync(path.join(project, 'Sigma', 'messages', 'DEV', 'LEGACY', 'orphan.md'))).toBe(true);
    expect(fs.existsSync(path.join(project, 'Sigma', 'messages', 'DEV', 'orphan.md'))).toBe(false);
    const log = fs.readJsonSync(path.join(project, 'Sigma', 'messages', 'migrations', 'v2', 'adopted-orphans.json'));
    expect(log.files).toHaveLength(1);
    expect(log.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    // The mailbox is usable afterwards and a second run changes nothing.
    const again = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], project, home);
    expect(JSON.parse(again.stdout).applied).toBe(false);
  });

  it('reads the earliest message format and records a retired type as NOTE with the original kept', () => {
    const { home, project } = world();
    const old = (id: string, type: string) => [
      '# Sigma Role Message', '', '## Metadata', '', '| Field | Value |', '| :--- | :--- |',
      `| Message ID | ${id} |`, `| Type | ${type} |`, '| From Role | DEV |', '| To Role | FMN |',
      '| Ref Message | MSG-20260527-143503670-FMN1-FMN-DEV |', '| Subject | RE: gate |', '| Status | SENT |',
      '| Created At | 2026-05-27T15:00:00.000+07:00 |', '| Authority Level | Context Only |', '', '---', '', '## Message', '', 'Body', '',
    ].join('\n');
    legacyMailbox(project, [
      { role: 'FMN', name: 'reply.md', text: old('MSG-20260527-150000000-DEV1-DEV-FMN', 'REPLY') },
      { role: 'FMN', name: 'note.md', text: old('MSG-20260521-113612944-PYNS-DEV-FMN', 'NOTE') },
    ]);
    const run = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], project, home);
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
    const index = indexOf(project);
    const reply = index.messages.find((m: { id: string }) => m.id === 'MSG-20260527-150000000-DEV1-DEV-FMN');
    expect(reply).toMatchObject({ type: 'NOTE', from: 'DEV', to: 'FMN', status: 'READ', reply_to: 'MSG-20260527-143503670-FMN1-FMN-DEV' });
    const log = fs.readJsonSync(path.join(project, 'Sigma', 'messages', 'migrations', 'v2', 'adopted-orphans.json'));
    expect(log.files.find((f: { id: string }) => f.id === 'MSG-20260527-150000000-DEV1-DEV-FMN')).toMatchObject({ original_type: 'REPLY', indexed_type: 'NOTE' });
    expect(log.files.find((f: { id: string }) => f.id === 'MSG-20260521-113612944-PYNS-DEV-FMN').original_type).toBeUndefined();
  });

  it('registers an attachment that exists under Sigma/messages/attachments and refuses one that does not', () => {
    const { home, project } = world();
    const attDir = path.join(project, 'Sigma', 'messages', 'attachments');
    fs.ensureDirSync(attDir);
    fs.writeFileSync(path.join(attDir, 'plan-copy.md'), 'attachment');
    legacyMailbox(project, [
      { role: 'DEV', name: 'with.md', text: message('MSG-20260601-080000000-AAAA-FMN-DEV', { attachments: 'Sigma/messages/attachments/plan-copy.md' }) },
    ]);
    const ok = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], project, home);
    expect(ok.exitCode, ok.stdout + ok.stderr).toBe(0);
    const entry = indexOf(project).messages[0];
    expect(entry.attachments).toEqual(['Sigma/messages/attachments/plan-copy.md']);

    const text = world();
    legacyMailbox(text.project, [
      { role: 'DEV', name: 'free.md', text: message('MSG-20260601-080000000-CCCC-FMN-DEV', { attachments: 'Section 15 update in DEV-EXEC-v1.24' }) },
    ]);
    const free = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], text.project, text.home);
    expect(free.exitCode, free.stdout + free.stderr).toBe(0);
    expect(indexOf(text.project).messages[0].attachments).toEqual([]);

    const second = world();
    legacyMailbox(second.project, [
      { role: 'DEV', name: 'missing.md', text: message('MSG-20260601-080000000-BBBB-FMN-DEV', { attachments: 'Sigma/messages/attachments/gone.md' }) },
    ]);
    const bad = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], second.project, second.home);
    expect(bad.exitCode).not.toBe(0);
    expect(bad.stdout + bad.stderr).toContain('attachment does not exist');
  });

  it('refuses a duplicate message id', () => {
    const { home, project } = world();
    legacyMailbox(project, [
      { role: 'DEV', name: 'a.md', text: message('MSG-20260601-070000000-IIII-FMN-DEV'), indexed: true },
      { role: 'DEV', name: 'b.md', text: message('MSG-20260601-070000000-IIII-FMN-DEV') },
    ]);
    const run = sigma(['doctor', '--migrate-mailbox', '--adopt-orphans', '--director-confirm'], project, home);
    expect(run.exitCode).not.toBe(0);
    expect(run.stdout + run.stderr).toContain('duplicate Message ID');
  });
});

describe('F09 retired assets', () => {
  it('setup update removes the named retired assets and keeps a user command with the same name', () => {
    const { home, project } = world();
    const tpl = path.join(home, '.sigma', 'templates', 'DIR-CLOSE-HUMAN-TEMPLATE.md');
    fs.writeFileSync(tpl, 'old human template');
    const commands = path.join(home, '.claude', 'commands');
    fs.ensureDirSync(commands);
    fs.writeFileSync(path.join(commands, 'cso.md'), '---\nname: cso\ndescription: "Sigma CSO Handler — create artifacts"\n---\n');
    fs.writeFileSync(path.join(commands, 'checkpoint.md'), '---\nname: checkpoint\ndescription: "My own checkpoint helper"\n---\n');
    const codexCso = path.join(home, '.codex', 'skills', 'cso');
    fs.ensureDirSync(path.join(codexCso, 'agents'));
    fs.writeFileSync(path.join(codexCso, 'SKILL.md'), '---\nname: cso\ndescription: "Sigma CSO Handler — create artifacts"\n---\n');
    const run = sigma(['setup', 'update'], project, home);
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
    expect(fs.existsSync(tpl)).toBe(false);
    expect(fs.existsSync(path.join(commands, 'cso.md'))).toBe(false);
    expect(fs.existsSync(codexCso)).toBe(false);
    expect(fs.existsSync(path.join(commands, 'checkpoint.md'))).toBe(true);
    expect(run.stdout).toContain('retired');
  });

  it('lists host files the bundle does not contain, without removing them', () => {
    const { home, project } = world();
    const extra = path.join(home, '.sigma', 'templates', 'MY-OWN-TEMPLATE.md');
    fs.writeFileSync(extra, 'mine');
    const run = sigma(['setup', 'update'], project, home);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('MY-OWN-TEMPLATE.md');
    expect(fs.existsSync(extra)).toBe(true);
  });
});

describe('F09 bridge files in project sync', () => {
  it('previews a differing bridge file with a token and replaces it only when accepted', () => {
    const { home, project } = world();
    const claude = path.join(project, 'CLAUDE.md');
    fs.appendFileSync(claude, '\nproject specific line\n');
    const dry = sigma(['project', 'sync'], project, home);
    expect(dry.exitCode).toBe(0);
    const line = dry.stdout.split('\n').find(l => l.includes('DIFF bridge/CLAUDE.md'));
    expect(line, dry.stdout).toBeDefined();
    const token = /accept=([0-9a-f]+)/.exec(line!)![1];

    const blocked = sigma(['project', 'sync', '--confirm'], project, home);
    expect(blocked.exitCode).not.toBe(0);
    expect(fs.readFileSync(claude, 'utf8')).toContain('project specific line');

    const accepted = sigma(['project', 'sync', '--confirm', '--accept', token], project, home);
    expect(accepted.exitCode, accepted.stdout + accepted.stderr).toBe(0);
    expect(fs.readFileSync(claude, 'utf8')).not.toContain('project specific line');
    expect(accepted.stdout).toContain('backed up');
  });

  it('does not make a project outdated because its bridge text differs', () => {
    const { home, project } = world();
    fs.appendFileSync(path.join(project, 'CLAUDE.md'), '\nproject specific line\n');
    const run = sigma(['config', 'show'], project, home);
    expect(run.stderr).not.toContain('Sigma:');
  });
});
