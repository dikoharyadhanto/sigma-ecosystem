import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { setupTestEnv, runCli, TestEnv } from './helpers';
import {
  slugify,
  noteStamp,
  validateTitle,
  loadRegistry,
  createNote,
  NotesError,
} from '../src/services/notesService';

const execAsync = promisify(exec);

function startProject(env: TestEnv): void {
  const r = runCli('project start --id TEST --name "Test Project" --confirm', env.projectDir, env.homeDir);
  expect(r.exitCode).toBe(0);
}

const notesDir = (env: TestEnv) => path.join(env.projectDir, 'Sigma', 'notes');
const registryPath = (env: TestEnv) => path.join(env.projectDir, 'Sigma', 'notes-registry.json');
const catalogPath = (env: TestEnv) => path.join(notesDir(env), 'note-list.md');
const readRegistry = (env: TestEnv) => fs.readJsonSync(registryPath(env));

describe('sigma notes — pure helpers (U-01)', () => {
  it('slugify lowercases, collapses separators, strips diacritics and caps at 60 chars', () => {
    expect(slugify('Evaluasi  Alur   Sigma!!')).toBe('evaluasi-alur-sigma');
    expect(slugify('  --Café Crème--  ')).toBe('cafe-creme');
    expect(slugify('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    const long = slugify('x'.repeat(40) + ' ' + 'y'.repeat(40));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('-')).toBe(false);
  });

  it('slugify returns empty for titles with no ASCII letters or digits', () => {
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('日本語')).toBe('');
  });

  it('validateTitle rejects empty titles and titles containing a newline', () => {
    expect(() => validateTitle('   ')).toThrow(NotesError);
    expect(() => validateTitle('line one\nline two')).toThrow(/newline/);
    expect(validateTitle('  Judul  ')).toBe('Judul');
  });

  it('noteStamp is YYMMDDHHMM in local time', () => {
    expect(noteStamp(new Date(2026, 9, 9, 15, 30))).toBe('2610091530');
    expect(noteStamp(new Date(2027, 0, 2, 3, 4))).toBe('2701020304');
  });
});

describe('sigma notes new / list (U-02, U-03, U-12)', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('project start creates note-list/, unregistered-notes/, an empty registry and an initial catalog', () => {
    env = setupTestEnv();
    startProject(env);
    expect(fs.existsSync(path.join(notesDir(env), 'note-list'))).toBe(true);
    expect(fs.existsSync(path.join(notesDir(env), 'unregistered-notes'))).toBe(true);
    expect(readRegistry(env)).toEqual({ notes_format: 1, last_id: 0, notes: [] });
    const catalog = fs.readFileSync(catalogPath(env), 'utf8');
    expect(catalog).toMatch(/\| ID \| Nama file \| Title \|/);
  });

  it('new creates the file, registers N01, and refreshes note-list.md in the same run', () => {
    env = setupTestEnv();
    startProject(env);
    const r = runCli('notes new --title "Evaluasi alur Sigma" --role arc', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Note N01 created: Sigma\/notes\/note-list\/NOTE-\d{10}-evaluasi-alur-sigma\.md/);

    const reg = readRegistry(env);
    expect(reg.last_id).toBe(1);
    expect(reg.notes).toHaveLength(1);
    const entry = reg.notes[0];
    expect(entry.id).toBe('N01');
    expect(entry.title).toBe('Evaluasi alur Sigma');
    expect(entry.created_by_role).toBe('ARC');
    expect(entry.path).toBe(`notes/note-list/${entry.file}`);

    const body = fs.readFileSync(path.join(notesDir(env), 'note-list', entry.file), 'utf8');
    expect(body).toMatch(/^# Evaluasi alur Sigma\n\nDibuat: \d{4}-\d{2}-\d{2} \d{2}:\d{2}\n$/);

    const catalog = fs.readFileSync(catalogPath(env), 'utf8');
    expect(catalog).toContain(`| N01 | [${entry.file}](note-list/${entry.file}) | Evaluasi alur Sigma |`);
  });

  it('new rejects empty and symbol-only titles and newline titles without writing anything', () => {
    env = setupTestEnv();
    startProject(env);
    expect(runCli('notes new --title "!!!"', env.projectDir, env.homeDir).exitCode).toBe(1);
    expect(runCli('notes new --title "   "', env.projectDir, env.homeDir).exitCode).toBe(1);
    expect(fs.readdirSync(path.join(notesDir(env), 'note-list'))).toEqual([]);
    expect(readRegistry(env).notes).toEqual([]);
    expect(runCli('notes new', env.projectDir, env.homeDir).exitCode).not.toBe(0);
  });

  it('new rejects an invalid --role', () => {
    env = setupTestEnv();
    startProject(env);
    const r = runCli('notes new --title "x" --role wizard', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Invalid role/);
  });

  it('same title in the same minute gets a -2 / -3 suffix and never overwrites; IDs increase', () => {
    env = setupTestEnv();
    startProject(env);
    const now = new Date(2026, 9, 9, 15, 30);
    const a = createNote(env.projectDir, 'Catatan rapat', { now });
    const b = createNote(env.projectDir, 'Catatan rapat', { now });
    const c = createNote(env.projectDir, 'Catatan rapat', { now });
    expect(a.entry.file).toBe('NOTE-2610091530-catatan-rapat.md');
    expect(b.entry.file).toBe('NOTE-2610091530-catatan-rapat-2.md');
    expect(c.entry.file).toBe('NOTE-2610091530-catatan-rapat-3.md');
    expect([a.entry.id, b.entry.id, c.entry.id]).toEqual(['N01', 'N02', 'N03']);
  });

  it('IDs are not reused after a registered file disappears', () => {
    env = setupTestEnv();
    startProject(env);
    const a = createNote(env.projectDir, 'Satu', { now: new Date(2026, 9, 9, 10, 0) });
    fs.removeSync(path.join(notesDir(env), 'note-list', a.entry.file));
    const b = createNote(env.projectDir, 'Dua', { now: new Date(2026, 9, 9, 10, 1) });
    expect(b.entry.id).toBe('N02');
    // the vanished note stays in the registry but is hidden from the catalog
    expect(readRegistry(env).notes.map((n: { id: string }) => n.id)).toEqual(['N01', 'N02']);
    const catalog = fs.readFileSync(catalogPath(env), 'utf8');
    expect(catalog).not.toContain('| N01 |');
    expect(catalog).toContain('| N02 |');
  });

  it('list is newest first, filters by title case-insensitively, flags missing files, and writes nothing', () => {
    env = setupTestEnv();
    startProject(env);
    createNote(env.projectDir, 'Alpha Report', { now: new Date(2026, 9, 9, 10, 0) });
    const b = createNote(env.projectDir, 'beta analysis', { now: new Date(2026, 9, 9, 11, 0) });
    createNote(env.projectDir, 'Gamma', { now: new Date(2026, 9, 9, 12, 0) });
    fs.removeSync(path.join(notesDir(env), 'note-list', b.entry.file));

    const before = fs.readFileSync(registryPath(env), 'utf8');
    const all = runCli('notes list', env.projectDir, env.homeDir);
    expect(all.exitCode).toBe(0);
    const lines = all.stdout.trim().split('\n');
    expect(lines[0]).toMatch(/^N03 /);
    expect(lines[1]).toMatch(/^N02 .*\(missing\)$/);
    expect(lines[2]).toMatch(/^N01 /);

    const filtered = runCli('notes list --search REPORT', env.projectDir, env.homeDir);
    expect(filtered.stdout.trim().split('\n')).toHaveLength(1);
    expect(filtered.stdout).toMatch(/Alpha Report/);
    expect(fs.readFileSync(registryPath(env), 'utf8')).toBe(before);
  });

  it('list works without a chain and without a registry (project that never used notes) and writes nothing', () => {
    env = setupTestEnv();
    startProject(env);
    fs.removeSync(registryPath(env));
    fs.removeSync(catalogPath(env));
    const r = runCli('notes list', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/No notes registered/);
    expect(fs.existsSync(registryPath(env))).toBe(false);
    expect(fs.existsSync(catalogPath(env))).toBe(false);
  });

  it('list warns about unregistered Markdown and non-Markdown files', async () => {
    env = setupTestEnv();
    startProject(env);
    fs.writeFileSync(path.join(notesDir(env), 'loose.md'), '# loose\n');
    fs.writeFileSync(path.join(notesDir(env), 'diagram.png'), 'x');
    const dist = path.resolve(__dirname, '..', process.env.SIGMA_TEST_DIST ?? 'dist', 'cli.js');
    // runCli drops stderr on success, so capture it directly
    const { stderr } = await execAsync(`node "${dist}" notes list`, {
      cwd: env.projectDir,
      env: { ...process.env, HOME: env.homeDir, USERPROFILE: env.homeDir },
    });
    expect(stderr).toMatch(/1 non-Markdown/);
    expect(stderr).toMatch(/1 Markdown file\(s\)/);
  });

  it('project sync / start --reinit do not touch an existing notes registry', () => {
    env = setupTestEnv();
    startProject(env);
    createNote(env.projectDir, 'Tetap ada', { now: new Date(2026, 9, 9, 9, 0) });
    const before = fs.readFileSync(registryPath(env), 'utf8');
    runCli('project sync --confirm', env.projectDir, env.homeDir);
    expect(fs.readFileSync(registryPath(env), 'utf8')).toBe(before);
  });
});

describe('sigma notes update (U-04..U-08)', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('refuses the whole run when a non-Markdown file exists, listing every path, with no move or write', () => {
    env = setupTestEnv();
    startProject(env);
    fs.writeFileSync(path.join(notesDir(env), 'loose.md'), '# loose\n');
    fs.writeFileSync(path.join(notesDir(env), 'report.pdf'), 'x');
    fs.ensureDirSync(path.join(notesDir(env), 'unregistered-notes', 'old'));
    fs.writeFileSync(path.join(notesDir(env), 'unregistered-notes', 'old', 'data.xlsx'), 'x');
    const regBefore = fs.readFileSync(registryPath(env), 'utf8');

    const r = runCli('notes update', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Sigma\/notes\/report\.pdf/);
    expect(r.stderr).toMatch(/Sigma\/notes\/unregistered-notes\/old\/data\.xlsx/);
    expect(fs.existsSync(path.join(notesDir(env), 'loose.md'))).toBe(true);
    expect(fs.existsSync(path.join(notesDir(env), 'unregistered-notes', 'loose.md'))).toBe(false);
    expect(fs.readFileSync(registryPath(env), 'utf8')).toBe(regBefore);
  });

  it('ignores .gitkeep, desktop.ini, Thumbs.db and .DS_Store', () => {
    env = setupTestEnv();
    startProject(env);
    for (const name of ['.gitkeep', 'desktop.ini', 'Thumbs.db', '.DS_Store']) {
      fs.writeFileSync(path.join(notesDir(env), name), '');
    }
    const r = runCli('notes update', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
  });

  it('moves unregistered Markdown (root, note-list/, subfolders) without changing content or mtime', () => {
    env = setupTestEnv();
    startProject(env);
    const reg = createNote(env.projectDir, 'Terdaftar', { now: new Date(2026, 9, 9, 10, 0) });
    const reader = path.join(notesDir(env), 'note-list', reg.entry.file);
    fs.appendFileSync(reader, '\nisi tambahan setelah dibuat\n'); // editing a registered note keeps it registered

    fs.writeFileSync(path.join(notesDir(env), 'root.md'), '# root\n');
    fs.writeFileSync(path.join(notesDir(env), 'note-list', 'manual.md'), '# manual\n');
    fs.ensureDirSync(path.join(notesDir(env), 'arsip', 'lama'));
    fs.writeFileSync(path.join(notesDir(env), 'arsip', 'lama', 'x.md'), '# x\n');
    const mtime = fs.statSync(path.join(notesDir(env), 'root.md')).mtimeMs;

    const r = runCli('notes update', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/moved to unregistered-notes\/: 3/);

    const un = path.join(notesDir(env), 'unregistered-notes');
    expect(fs.readFileSync(path.join(un, 'root.md'), 'utf8')).toBe('# root\n');
    expect(fs.statSync(path.join(un, 'root.md')).mtimeMs).toBe(mtime);
    expect(fs.existsSync(path.join(un, 'manual.md'))).toBe(true); // leading note-list/ segment dropped
    expect(fs.existsSync(path.join(un, 'arsip', 'lama', 'x.md'))).toBe(true); // relative path kept
    expect(fs.existsSync(path.join(notesDir(env), 'root.md'))).toBe(false);
    // the registered note was not moved
    expect(fs.existsSync(reader)).toBe(true);
    expect(readRegistry(env).notes).toHaveLength(1);
  });

  it('never overwrites: a name collision in unregistered-notes/ gets a -2 suffix', () => {
    env = setupTestEnv();
    startProject(env);
    fs.writeFileSync(path.join(notesDir(env), 'unregistered-notes', 'same.md'), 'old\n');
    fs.writeFileSync(path.join(notesDir(env), 'same.md'), 'new\n');
    fs.writeFileSync(path.join(notesDir(env), 'note-list', 'same.md'), 'newer\n');
    const r = runCli('notes update', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    const un = path.join(notesDir(env), 'unregistered-notes');
    expect(fs.readFileSync(path.join(un, 'same.md'), 'utf8')).toBe('old\n');
    const names = fs.readdirSync(un).sort();
    expect(names).toEqual(['same-2.md', 'same-3.md', 'same.md']);
  });

  it('does not treat note-list.md as a note and does not re-move unregistered-notes/', () => {
    env = setupTestEnv();
    startProject(env);
    fs.ensureDirSync(path.join(notesDir(env), 'unregistered-notes', 'sub'));
    fs.writeFileSync(path.join(notesDir(env), 'unregistered-notes', 'sub', 'keep.md'), 'k\n');
    const r = runCli('notes update', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/moved to unregistered-notes\/: 0/);
    expect(fs.existsSync(path.join(notesDir(env), 'unregistered-notes', 'sub', 'keep.md'))).toBe(true);
    expect(fs.existsSync(catalogPath(env))).toBe(true);
  });

  it('is idempotent: a second update changes nothing', () => {
    env = setupTestEnv();
    startProject(env);
    createNote(env.projectDir, 'Satu', { now: new Date(2026, 9, 9, 10, 0) });
    fs.writeFileSync(path.join(notesDir(env), 'loose.md'), '# l\n');
    expect(runCli('notes update', env.projectDir, env.homeDir).exitCode).toBe(0);
    const reg = fs.readFileSync(registryPath(env), 'utf8');
    const cat = fs.readFileSync(catalogPath(env), 'utf8');
    const second = runCli('notes update', env.projectDir, env.homeDir);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toMatch(/moved to unregistered-notes\/: 0/);
    expect(second.stdout).toMatch(/already up to date/);
    expect(fs.readFileSync(registryPath(env), 'utf8')).toBe(reg);
    expect(fs.readFileSync(catalogPath(env), 'utf8')).toBe(cat);
  });

  it('--dry-run prints the plan and violations without changing anything', () => {
    env = setupTestEnv();
    startProject(env);
    fs.writeFileSync(path.join(notesDir(env), 'loose.md'), '# l\n');
    const r = runCli('notes update --dry-run', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Dry run/);
    expect(r.stdout).toMatch(/Sigma\/notes\/loose\.md -> Sigma\/notes\/unregistered-notes\/loose\.md/);
    expect(fs.existsSync(path.join(notesDir(env), 'loose.md'))).toBe(true);

    fs.writeFileSync(path.join(notesDir(env), 'x.pdf'), 'x');
    const refused = runCli('notes update --dry-run', env.projectDir, env.homeDir);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toMatch(/x\.pdf/);
  });

  it('on a project that never used notes (no registry, no catalog) update creates an empty registry', () => {
    env = setupTestEnv();
    startProject(env);
    fs.removeSync(registryPath(env));
    fs.removeSync(catalogPath(env));
    fs.writeFileSync(path.join(notesDir(env), 'legacy.md'), '# legacy\n');
    const r = runCli('notes update', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(readRegistry(env)).toEqual({ notes_format: 1, last_id: 0, notes: [] });
    expect(fs.existsSync(path.join(notesDir(env), 'unregistered-notes', 'legacy.md'))).toBe(true);
  });
});

describe('sigma notes — catalog and registry safety (U-09, U-10)', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('catalog has exactly the three columns, escapes "|" in titles, and the registry keeps the original title', () => {
    env = setupTestEnv();
    startProject(env);
    createNote(env.projectDir, 'A | B', { now: new Date(2026, 9, 9, 10, 0) });
    const catalog = fs.readFileSync(catalogPath(env), 'utf8');
    expect(catalog).toMatch(/^\| ID \| Nama file \| Title \|$/m);
    expect(catalog).toContain('| A \\| B |');
    expect(readRegistry(env).notes[0].title).toBe('A | B');
  });

  it('manual edits to note-list.md are overwritten and neither register nor deregister anything', () => {
    env = setupTestEnv();
    startProject(env);
    const a = createNote(env.projectDir, 'Asli', { now: new Date(2026, 9, 9, 10, 0) });
    fs.writeFileSync(
      catalogPath(env),
      '# hacked\n\n| ID | Nama file | Title |\n|---|---|---|\n| N99 | [fake.md](note-list/fake.md) | Palsu |\n'
    );
    const r = runCli('notes update', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    const catalog = fs.readFileSync(catalogPath(env), 'utf8');
    expect(catalog).not.toContain('N99');
    expect(catalog).toContain(`| N01 | [${a.entry.file}]`);
    expect(readRegistry(env).notes).toHaveLength(1);
  });

  it('a missing catalog is regenerated by update', () => {
    env = setupTestEnv();
    startProject(env);
    createNote(env.projectDir, 'Satu', { now: new Date(2026, 9, 9, 10, 0) });
    fs.removeSync(catalogPath(env));
    expect(runCli('notes update', env.projectDir, env.homeDir).exitCode).toBe(0);
    expect(fs.readFileSync(catalogPath(env), 'utf8')).toContain('| N01 |');
  });

  it('an unreadable registry is refused by new, list and update and is never overwritten', () => {
    env = setupTestEnv();
    startProject(env);
    fs.writeFileSync(registryPath(env), '{ not json');
    for (const cmd of ['notes new --title "x"', 'notes list', 'notes update']) {
      const r = runCli(cmd, env.projectDir, env.homeDir);
      expect(r.exitCode, cmd).toBe(1);
      expect(r.stderr).toMatch(/unreadable/);
    }
    expect(fs.readFileSync(registryPath(env), 'utf8')).toBe('{ not json');
  });

  it('a missing registry with a populated catalog is refused (previously used project)', () => {
    env = setupTestEnv();
    startProject(env);
    createNote(env.projectDir, 'Pernah ada', { now: new Date(2026, 9, 9, 10, 0) });
    fs.removeSync(registryPath(env));
    for (const cmd of ['notes new --title "x"', 'notes update']) {
      const r = runCli(cmd, env.projectDir, env.homeDir);
      expect(r.exitCode, cmd).toBe(1);
      expect(r.stderr).toMatch(/--rebuild-registry/);
    }
    expect(fs.existsSync(registryPath(env))).toBe(false);
  });

  it('loadRegistry rejects a registry from a newer format', () => {
    env = setupTestEnv();
    startProject(env);
    fs.writeJsonSync(registryPath(env), { notes_format: 2, last_id: 0, notes: [] });
    const st = loadRegistry(env.projectDir);
    expect(st.state).toBe('unreadable');
  });
});

describe('sigma notes update --rebuild-registry (U-09b)', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  function seed(): { a: string; b: string } {
    startProject(env);
    const a = createNote(env.projectDir, 'Alpha | pipe', { now: new Date(2026, 9, 9, 10, 0) });
    const b = createNote(env.projectDir, 'Beta', { now: new Date(2026, 9, 9, 11, 0) });
    return { a: a.entry.file, b: b.entry.file };
  }

  it('is refused when the registry is healthy', () => {
    env = setupTestEnv();
    seed();
    const r = runCli('notes update --rebuild-registry --director-confirm', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/readable/);
  });

  it('without --director-confirm it only previews', () => {
    env = setupTestEnv();
    seed();
    fs.removeSync(registryPath(env));
    const r = runCli('notes update --rebuild-registry', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Preview only/);
    expect(r.stdout).toMatch(/Restorable rows: 2/);
    expect(fs.existsSync(registryPath(env))).toBe(false);
  });

  it('with --director-confirm it restores valid rows, marks them recovered and derives created_at from the file name', () => {
    env = setupTestEnv();
    const { a } = seed();
    fs.removeSync(registryPath(env));
    const r = runCli('notes update --rebuild-registry --director-confirm', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    const reg = readRegistry(env);
    expect(reg.last_id).toBe(2);
    expect(reg.notes.map((n: { id: string }) => n.id)).toEqual(['N01', 'N02']);
    const first = reg.notes[0];
    expect(first.file).toBe(a);
    expect(first.title).toBe('Alpha | pipe'); // escape restored
    expect(first.recovered).toBe(true);
    expect(first.created_by_role).toBeUndefined();
    expect(new Date(first.created_at).getTime()).toBe(new Date(2026, 9, 9, 10, 0).getTime());
    // normal operation resumes and the next ID follows
    const next = runCli('notes new --title "Gamma"', env.projectDir, env.homeDir);
    expect(next.stdout).toMatch(/Note N03 created/);
  });

  it('rejects rows with an invalid ID, bad file name, missing file, or duplicate, and never reuses their IDs', () => {
    env = setupTestEnv();
    const { b } = seed();
    fs.removeSync(registryPath(env));
    fs.writeFileSync(
      catalogPath(env),
      [
        '# Note List',
        '',
        '| ID | Nama file | Title |',
        '|---|---|---|',
        `| N02 | [${b}](note-list/${b}) | Beta |`,
        `| N02 | [${b}](note-list/${b}) | Beta again |`,
        '| X07 | [NOTE-2610091200-x.md](note-list/NOTE-2610091200-x.md) | Bad id |',
        '| N05 | [random.md](note-list/random.md) | Bad name |',
        '| N09 | [NOTE-2610091200-ghost.md](note-list/NOTE-2610091200-ghost.md) | Ghost |',
        '',
      ].join('\n')
    );
    const r = runCli('notes update --rebuild-registry --director-confirm', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Rejected rows: 4/);
    expect(r.stdout).toMatch(/duplicate ID/);
    expect(r.stdout).toMatch(/N<number>/);
    expect(r.stdout).toMatch(/does not match/);
    expect(r.stdout).toMatch(/not present/);
    const reg = readRegistry(env);
    expect(reg.notes).toHaveLength(1);
    expect(reg.last_id).toBe(9); // highest ID seen in the catalog, even on a rejected row
    const next = runCli('notes new --title "Baru"', env.projectDir, env.homeDir);
    expect(next.stdout).toMatch(/Note N10 created/);
  });

  it('does not register or move files that are absent from the catalog', () => {
    env = setupTestEnv();
    seed();
    fs.removeSync(registryPath(env));
    fs.writeFileSync(path.join(notesDir(env), 'note-list', 'NOTE-2610091300-stray.md'), '# stray\n');
    const r = runCli('notes update --rebuild-registry --director-confirm', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    expect(readRegistry(env).notes.map((n: { file: string }) => n.file)).not.toContain('NOTE-2610091300-stray.md');
    expect(fs.existsSync(path.join(notesDir(env), 'note-list', 'NOTE-2610091300-stray.md'))).toBe(true);
    // the next plain update treats it as unregistered
    const upd = runCli('notes update', env.projectDir, env.homeDir);
    expect(upd.stdout).toMatch(/moved to unregistered-notes\/: 1/);
  });

  it('keeps an unreadable registry as .corrupt-<time> before writing the new one', () => {
    env = setupTestEnv();
    seed();
    fs.writeFileSync(registryPath(env), '{ broken');
    const r = runCli('notes update --rebuild-registry --director-confirm', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(0);
    const backups = fs.readdirSync(path.join(env.projectDir, 'Sigma')).filter(n => n.startsWith('notes-registry.json.corrupt-'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(env.projectDir, 'Sigma', backups[0]), 'utf8')).toBe('{ broken');
    expect(readRegistry(env).notes).toHaveLength(2);
  });

  it('fails clearly when there is no catalog to rebuild from', () => {
    env = setupTestEnv();
    startProject(env);
    fs.removeSync(registryPath(env));
    fs.removeSync(catalogPath(env));
    const r = runCli('notes update --rebuild-registry --director-confirm', env.projectDir, env.homeDir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/nothing to rebuild from/);
  });
});

describe('sigma notes — concurrency (U-11)', () => {
  let env: TestEnv;
  afterEach(() => env?.cleanup());

  it('two simultaneous "notes new" processes both register and get distinct IDs', async () => {
    env = setupTestEnv();
    startProject(env);
    const dist = path.resolve(__dirname, '..', process.env.SIGMA_TEST_DIST ?? 'dist', 'cli.js');
    const run = (title: string) =>
      execAsync(`node "${dist}" notes new --title "${title}"`, {
        cwd: env.projectDir,
        env: { ...process.env, HOME: env.homeDir, USERPROFILE: env.homeDir },
      });
    await Promise.all([run('Paralel satu'), run('Paralel dua')]);
    const reg = readRegistry(env);
    expect(reg.notes).toHaveLength(2);
    expect(new Set(reg.notes.map((n: { id: string }) => n.id)).size).toBe(2);
    expect(reg.last_id).toBe(2);
    const catalog = fs.readFileSync(catalogPath(env), 'utf8');
    expect(catalog).toContain('| N01 |');
    expect(catalog).toContain('| N02 |');
  }, 30000);
});

describe('sigma notes — scope guards (U-13, U-16)', () => {
  it('notes new has no --ref option (notes never reference an artifact, K-10)', () => {
    const env = setupTestEnv();
    try {
      startProject(env);
      const r = runCli('notes new --title "x" --ref FMN-PLAN-v1.0', env.projectDir, env.homeDir);
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toMatch(/unknown option/);
    } finally {
      env.cleanup();
    }
  });
});
