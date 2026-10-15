import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import {
  setupTestEnv, writeChainFixture, makeChainWithLockedIntent, stubProjectIdentity, runCli, TestEnv,
} from './helpers';

// PLAN-IMPL-SIGMA-LEGACY-ISOLATION — TC-LEG-01/02/04/05/06.
//
// Principle (Director, 2026-10-15): Sigma v2 does not care whether LEGACY mail
// exists, is missing, or is damaged. It must not read it, report it, or be
// stopped by it. Only the v1 -> v2 isolation (migration) produces it, and the
// only way to read old mail is to open the file directly.
//
// Method: one v2 mailbox, four LEGACY variants. Every v2 operation must behave
// identically across them.

type Entry = Record<string, unknown>;
const envs: TestEnv[] = [];
afterEach(() => { for (const e of envs.splice(0)) e.cleanup(); });

const SIGMA = 'Sigma';
const rel = (...p: string[]) => p.join('/');

function liveEntry(id: string, to: string, from: string, type: 'NOTE' | 'MEMO' = 'NOTE', n = 0): Entry {
  const base = type === 'MEMO' ? 'memo' : 'messages';
  return {
    id, from, to, type, subject: `live ${id}`, status: 'UNREAD',
    created_at: new Date(1760000000000 + n * 1000).toISOString(),
    file: rel(SIGMA, base, to, 'GENERAL', `${id}.md`), attachments: [], action: 'FYI',
    related_artifact: 'GENERAL', intent_version: null, context: 'GENERAL',
  };
}

function legacyEntry(id: string, to: string, from: string, n: number, status = 'READ', type: 'NOTE' | 'MEMO' = 'NOTE'): Entry {
  const base = type === 'MEMO' ? 'memo' : 'messages';
  return {
    id, from, to, type, subject: `old ${id}`, status,
    created_at: new Date(1700000000000 + n * 1000).toISOString(),
    file: rel(SIGMA, base, to, 'LEGACY', `${id}.md`), attachments: [], action: 'FYI',
    related_artifact: 'GENERAL', intent_version: null, context: 'LEGACY',
    migration: { original_file: rel(SIGMA, 'messages', to, `${id}.md`), original_status: status, migrated_at: '2026-10-14T00:00:00.000Z' },
  };
}

type Variant = 'none' | 'present' | 'files-missing' | 'corrupt';

function build(variant: Variant): { env: TestEnv; legacyIds: string[]; liveIds: string[]; indexPath: string } {
  const env = setupTestEnv(); envs.push(env);
  writeChainFixture(env, 'v1', makeChainWithLockedIntent('v1'));
  stubProjectIdentity(env);
  const live = [
    liveEntry('MSG-LIVE-1', 'FMN', 'ARC', 'NOTE', 1),
    liveEntry('MSG-LIVE-2', 'FMN', 'DEV', 'NOTE', 2),
    liveEntry('MSG-LIVE-M', 'FMN', 'FMN', 'MEMO', 3),
  ];
  for (const e of live) fs.outputFileSync(path.join(env.projectDir, e.file as string), `# ${e.id}\n`);
  let legacy: Entry[] = [];
  if (variant !== 'none') {
    legacy = [
      ...[0, 1, 2, 3, 4, 5, 6].map(i => legacyEntry(`MSG-OLD-${i}`, 'FMN', 'ARC', i)),
      legacyEntry('MSG-OLD-MEMO', 'FMN', 'FMN', 9, 'READ', 'MEMO'),
      legacyEntry('MSG-OLD-UNREAD', 'FMN', 'ARC', 10, 'UNREAD'),
    ];
    for (const e of legacy) {
      if (variant === 'files-missing') continue;
      fs.outputFileSync(path.join(env.projectDir, e.file as string), `old ${e.id}\n`);
    }
    if (variant === 'files-missing') fs.removeSync(path.join(env.sigmaDir, 'messages', 'FMN', 'LEGACY'));
    if (variant === 'corrupt') {
      legacy.push(
        { ...legacyEntry('MSG-OLD-BADROLE', 'FMN', 'ARC', 11), from: 'NOBODY', type: 'WHATEVER' },
        { ...legacyEntry('MSG-OLD-BADSTATUS', 'FMN', 'ARC', 12), status: 'MAYBE' },
        { ...legacyEntry('MSG-LIVE-1', 'FMN', 'ARC', 13) },                       // duplicate of a live ID
        { ...legacyEntry('MSG-OLD-NOSUBJECT', 'FMN', 'ARC', 14), subject: '' },
        { ...legacyEntry('MSG-OLD-NOCONTEXT', 'FMN', 'ARC', 15), context: undefined, intent_version: undefined },
      );
    }
  }
  const indexPath = path.join(env.sigmaDir, 'messages', 'index.json');
  fs.outputJsonSync(indexPath, { mailbox_format: 2, messages: [...live, ...legacy] }, { spaces: 2 });
  return { env, legacyIds: legacy.map(e => e.id as string), liveIds: live.map(e => e.id as string), indexPath };
}

const cli = (e: TestEnv, args: string) => runCli(args, e.projectDir, e.homeDir);
// Fixture timestamps differ between builds; they are not what is under test.
const norm = (s: string) => s
  .replace(/\/tmp\/sigma-(?:test|home)-[A-Za-z0-9]+/g, '<TMP>')
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<TS>')
  .replace(/last synced at [^\n]+/g, '');
const VARIANTS: Variant[] = ['present', 'files-missing', 'corrupt'];

// Read-only operations whose output must not depend on LEGACY at all.
const READ_OPS = [
  'inbox --role fmn',
  'inbox --role fmn --all',
  'inbox --role fmn --outdated',
  'inbox --role fmn --all-intents',
  'memo list --role fmn --all',
  'inbox check',
  'session bootstrap',
  'project status',
  'inbox clear --role fmn --keep 0 --dry-run',
];

describe('TC-LEG-01/02: v2 operations ignore LEGACY entirely', () => {
  it.each(READ_OPS)('`sigma %s` is identical with no LEGACY and with any LEGACY variant', op => {
    const baseline = build('none');
    const expected = cli(baseline.env, op);
    for (const variant of VARIANTS) {
      const { env } = build(variant);
      const got = cli(env, op);
      expect(got.exitCode, `${variant}: exit code`).toBe(expected.exitCode);
      expect(norm(got.stdout), `${variant}: stdout`).toBe(norm(expected.stdout));
      expect(norm(got.stderr), `${variant}: stderr`).toBe(norm(expected.stderr));
    }
  });

  it.each(VARIANTS)('%s: no output mentions legacy, its counts, or its files', variant => {
    const { env } = build(variant);
    for (const op of READ_OPS) {
      const r = cli(env, op);
      // Case-sensitive on purpose: "Legacy lifecycle" / legacy_lock are tolerated v1 governance text.
      expect(`${r.stdout}\n${r.stderr}`, `\`sigma ${op}\``).not.toMatch(/LEGACY|MSG-OLD/);
    }
  });

  it.each(VARIANTS)('%s: live mailbox still works (read, send, memo, archive)', variant => {
    const { env } = build(variant);
    expect(cli(env, 'inbox read MSG-LIVE-2').exitCode).toBe(0);
    expect(cli(env, 'send --from arc --to fmn --related-artifact GENERAL --message "still works"').exitCode).toBe(0);
    expect(cli(env, 'inbox archive MSG-LIVE-1').exitCode).toBe(0);
    expect(cli(env, 'memo write --role fmn --ref GENERAL --topic "t" --message "m"').exitCode).toBe(0);
  });
});

describe('TC-LEG-04: LEGACY IDs and contexts are simply unknown to v2', () => {
  it.each(VARIANTS)('%s: read, archive, reply and --context LEGACY behave like unknown input', variant => {
    const { env, indexPath } = build(variant);
    const before = fs.readFileSync(indexPath, 'utf8');
    const probes: Array<[string, string]> = [
      ['inbox read MSG-OLD-1', 'inbox read MSG-NO-SUCH-ID'],
      ['inbox archive MSG-OLD-1', 'inbox archive MSG-NO-SUCH-ID'],
      ['memo read MSG-OLD-MEMO', 'memo read MSG-NO-SUCH-ID'],
      ['send --from dev --to fmn --reply-to MSG-OLD-1 --message x', 'send --from dev --to fmn --reply-to MSG-NO-SUCH-ID --message x'],
    ];
    for (const [legacyCall, unknownCall] of probes) {
      const a = cli(env, legacyCall), b = cli(env, unknownCall);
      expect(a.exitCode, legacyCall).not.toBe(0);
      expect(a.exitCode, legacyCall).toBe(b.exitCode);
      const strip = (s: string) => norm(s).replace(/MSG-OLD-MEMO|MSG-OLD-1|MSG-NO-SUCH-ID/g, '<ID>');
      expect(strip(a.stderr + a.stdout), legacyCall).toBe(strip(b.stderr + b.stdout));
    }
    const ctx = cli(env, 'inbox --role fmn --context LEGACY --all');
    expect(ctx.exitCode).not.toBe(0);
    expect(`${ctx.stdout}${ctx.stderr}`).not.toMatch(/legacy/i);
    expect(fs.readFileSync(indexPath, 'utf8'), 'index untouched by refused operations').toBe(before);
  });
});

describe('TC-LEG-05: LEGACY never takes part in sweep, clear, or quota', () => {
  it('auto-sweep and clear leave every LEGACY status and file untouched', () => {
    const { env, indexPath, legacyIds } = build('present');
    const snapshot = () => {
      const idx = fs.readJsonSync(indexPath) as { messages: Entry[] };
      const entries = idx.messages.filter(m => legacyIds.includes(m.id as string));
      const files = entries.map(m => fs.readFileSync(path.join(env.projectDir, m.file as string), 'utf8'));
      return JSON.stringify({ entries, files });
    };
    const before = snapshot();
    expect(JSON.parse(before).entries.length).toBe(legacyIds.length);
    expect(cli(env, 'inbox read MSG-LIVE-1').exitCode).toBe(0);               // triggers auto-sweep
    expect(cli(env, 'inbox clear --role fmn --keep 0').exitCode).toBe(0);
    expect(cli(env, 'memo clear --role fmn --keep 0').exitCode).toBe(0);
    expect(snapshot()).toBe(before);
  });
});

describe('TC-LEG-06: new projects have nothing to isolate', () => {
  it('project start creates no LEGACY folder; only GENERAL', () => {
    const env = setupTestEnv(); envs.push(env);
    fs.removeSync(env.sigmaDir);
    const started = cli(env, 'project start --id TEST --name Test --confirm');
    expect(started.exitCode, started.stderr).toBe(0);
    for (const base of ['messages', 'memo']) for (const role of ['ARC', 'FMN', 'DEV', 'AUD']) {
      expect(fs.existsSync(path.join(env.projectDir, 'Sigma', base, role, 'GENERAL')), `${base}/${role}/GENERAL`).toBe(true);
      expect(fs.existsSync(path.join(env.projectDir, 'Sigma', base, role, 'LEGACY')), `${base}/${role}/LEGACY`).toBe(false);
    }
  });
});

// TC-LEG-08 — the only code allowed to name the isolated area is the isolation
// step itself and the one predicate that recognises it. Any other mention is a
// v2 operation starting to care about legacy again.
describe('TC-LEG-08: LEGACY is named only by the isolation step and its predicate', () => {
  const ALLOWED = [
    'src/engine/mailboxMigration.ts',   // producer: the v1 -> v2 isolation
    'src/engine/mailboxContext.ts',     // isIsolatedLegacy / isLegacyPath, and the format-1 default identity
    'src/commands/doctor.ts',           // help text of --migrate-mailbox
  ];
  const IGNORED_TOKENS = /LEGACY_CURSOR|LEGACY_ARTIFACT_NAME|LEGACY_FIELD_ALIASES/g;

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
      const abs = path.join(dir, d.name);
      return d.isDirectory() ? walk(abs) : abs.endsWith('.ts') ? [abs] : [];
    });
  }

  it('no other source file mentions LEGACY', () => {
    const root = path.resolve(__dirname, '..');
    const offenders = walk(path.join(root, 'src'))
      .map(f => path.relative(root, f))
      .filter(f => !ALLOWED.includes(f))
      .filter(f => fs.readFileSync(path.join(root, f), 'utf8').replace(IGNORED_TOKENS, '').includes('LEGACY'));
    expect(offenders, 'move the logic behind isIsolatedLegacy() or add the file to ALLOWED with a reason').toEqual([]);
  });
});
