// F17 — product changelog recorded from the EXEC `Changelog` section at the
// moment a DEV-EXEC becomes LOCKED. Best-effort by design: this module never
// throws and never takes part in the lock transaction. Every failure becomes a
// "skipped" outcome carrying a reason; the lock is already committed.

import fs from 'fs-extra';
import path from 'path';
import { DEV_WORKSPACE_DIR } from '../config';
import { readActiveChain } from '../engine/chain';
import { getDevWorkspaceStatus } from '../engine/devWorkspace';
import { artifactFile } from '../engine/revisions';
import { atomicReplaceFileSync } from '../utils/fs';

/** Name of the Sigma-managed record. Deliberately not the conventional changelog name: tools and people rewrite that file, which would break the recording format. */
export const CHANGE_RECORD_FILE = 'CHANGE-RECORD.md';
/** First DEV_EXEC document schema that carries the Changelog section. */
export const CHANGELOG_MIN_EXEC_SCHEMA = 4;
export const CHANGELOG_SECTION_ID = 'CHANGELOG';
/** Exact statement a DEV writes instead of a list when there is nothing to record. */
export const NO_PRODUCT_CHANGES = 'No product changes.';

const PLACEHOLDER = '[...]';
const SECTION_MARKER = /^<!--\s*SIGMA:DEV_EXEC:SECTION:([A-Z0-9_]+)(?:\s+[^>]*)?\s*-->$/;
const DOC_MARKER = /^<!--\s*SIGMA:DOC\s+type=DEV_EXEC\s+schema=(\d+)\s*-->$/m;
const VERSION_HEADING = /^##\s+(v\d+(?:\.\d+)*)\s*$/;
// Sigma artifact identity must not leak into the product-facing file.
const ARTIFACT_REFERENCE = /\b(?:DIR-INTENT|FMN-PLAN|DEV-EXEC|DIR-CLOSE|DIR-ROADMAP)\b|\b(?:PLAN|EXEC|INTENT)[- ]?v?\d+\b/i;

export type ChangelogOutcome =
  | { status: 'recorded'; file: string; version: string; entries: number }
  | { status: 'no_changes' }
  | { status: 'skipped'; reason: string; message: string };

export function changelogSkipMessage(reason: string): string {
  return `Changelog was not recorded because ${reason}, so it was skipped. ` +
    'Update the changelog manually first, then resolve this issue; otherwise the next changelog record will fail again.';
}

function skipped(reason: string): ChangelogOutcome {
  return { status: 'skipped', reason, message: changelogSkipMessage(reason) };
}

export function describeChangelogOutcome(outcome: ChangelogOutcome): string {
  if (outcome.status === 'recorded') return `Changelog: ${outcome.entries} entr${outcome.entries === 1 ? 'y' : 'ies'} recorded under ${outcome.version} in ${outcome.file}.`;
  if (outcome.status === 'no_changes') return 'Changelog: the DEV-EXEC declares no product changes; nothing was recorded.';
  return outcome.message;
}

// ── Destination ────────────────────────────────────────────────────────────

type Candidate = { file: string; rel: string; presence: 'missing' | 'file' | 'unusable' };

function inspectCandidate(root: string, rel: string): Candidate {
  const file = path.join(root, rel);
  try {
    const stat = fs.lstatSync(file);
    return { file, rel, presence: stat.isFile() && !stat.isSymbolicLink() ? 'file' : 'unusable' };
  } catch {
    return { file, rel, presence: 'missing' };
  }
}

function candidates(root: string): { root: Candidate; dev: Candidate } {
  return {
    root: inspectCandidate(root, CHANGE_RECORD_FILE),
    dev: inspectCandidate(root, path.join(DEV_WORKSPACE_DIR, CHANGE_RECORD_FILE)),
  };
}

type Target = { ok: true; file: string; rel: string } | { ok: false; reason: string };

/** Only `<root>/CHANGE-RECORD.md` and `<root>/dev/CHANGE-RECORD.md` are valid; anything else is ignored. */
export function resolveChangelogTarget(root: string): Target {
  const workspace = getDevWorkspaceStatus(root);
  if (workspace.state === 'ACTIVE_DEGRADED') {
    return { ok: false, reason: 'the dev workspace is degraded (repair it with `sigma doctor --repair-workspace`)' };
  }
  const found = candidates(root);
  const existing = [found.root, found.dev].filter(c => c.presence !== 'missing');
  if (existing.length === 0) {
    return { ok: false, reason: `no ${CHANGE_RECORD_FILE} exists in the project root or in ${DEV_WORKSPACE_DIR}/` };
  }
  const chosen = existing.length === 2 ? (workspace.state === 'ACTIVE' ? found.dev : found.root) : existing[0];
  if (chosen.presence === 'unusable') {
    return { ok: false, reason: `${chosen.rel.split(path.sep).join('/')} is not a regular file` };
  }
  return { ok: true, file: chosen.file, rel: chosen.rel.split(path.sep).join('/') };
}

// ── Source section ─────────────────────────────────────────────────────────

type Section = { ok: true; entries: string[] } | { ok: false; none?: true; reason: string };

export function readChangelogSection(markdown: string): Section {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex(l => {
    const m = l.trim().match(SECTION_MARKER);
    return m !== null && m[1] === CHANGELOG_SECTION_ID;
  });
  if (start < 0) return { ok: false, reason: 'the DEV-EXEC has no Changelog section' };

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (SECTION_MARKER.test(line)) break;
    // Guidance and layout: heading, blockquote, rule, comment, blank.
    if (line === '' || line.startsWith('#') || line.startsWith('>') || line === '---' || line.startsWith('<!--')) continue;
    body.push(line);
  }
  if (body.length === 0) return { ok: false, reason: 'the Changelog section is empty' };
  if (body.some(l => l.includes(PLACEHOLDER))) return { ok: false, reason: 'the Changelog section still contains the placeholder [...]' };

  const bullets = body.filter(l => /^[-*]\s+\S/.test(l));
  const statement = body.filter(l => l === NO_PRODUCT_CHANGES);
  if (statement.length > 0) {
    if (bullets.length > 0 || body.length > statement.length) {
      return { ok: false, reason: `the Changelog section mixes "${NO_PRODUCT_CHANGES}" with other content` };
    }
    return { ok: false, none: true, reason: NO_PRODUCT_CHANGES };
  }
  if (bullets.length !== body.length) return { ok: false, reason: 'the Changelog section is not a flat list of entries' };

  const entries = bullets.map(l => l.replace(/^[-*]\s+/, '').trim());
  if (entries.some(e => ARTIFACT_REFERENCE.test(e))) {
    return { ok: false, reason: 'a Changelog entry refers to a Sigma artifact identity' };
  }
  return { ok: true, entries };
}

// ── Target file update ─────────────────────────────────────────────────────

/**
 * Returns the new file text, or null when the existing file is not in the
 * version-heading format. A version not yet present is added at the top
 * (most recently locked first); a version already present is appended to.
 */
export function addChangelogEntries(existing: string, version: string, entries: string[]): string | null {
  const eol = existing.includes('\r\n') ? '\r\n' : '\n';
  const lines = existing.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  const bullets = entries.map(e => `- ${e}`);
  if (lines.length === 0) return ['## ' + version, '', ...bullets].join(eol) + eol;

  const heads: Array<{ index: number; version: string }> = [];
  lines.forEach((line, index) => {
    const m = VERSION_HEADING.exec(line);
    if (m) heads.push({ index, version: m[1] });
  });
  const firstContent = lines.findIndex(l => l.trim() !== '');
  if (heads.length === 0 || heads[0].index !== firstContent) return null;

  const same = heads.findIndex(h => h.version === version);
  if (same >= 0) {
    const start = heads[same].index;
    const end = same + 1 < heads.length ? heads[same + 1].index : lines.length;
    let last = end - 1;
    while (last > start && lines[last].trim() === '') last--;
    lines.splice(last + 1, 0, ...bullets);
  } else {
    lines.splice(0, 0, '## ' + version, '', ...bullets, '');
  }
  return lines.join(eol) + eol;
}

// ── Entry point ────────────────────────────────────────────────────────────

/**
 * Record the Changelog section of a LOCKED DEV-EXEC under its EXEC version. Call only after the
 * transition to LOCKED has been committed, and only from the path that made
 * the transition (never from preview, status or an idempotent replay).
 */
export function recordChangelogForLockedExec(root: string, execVersion: string): ChangelogOutcome {
  try {
    const chain = readActiveChain(root).data;
    const entry = chain.exec.versions.find(e => e.version === execVersion);
    if (!entry || entry.state !== 'LOCKED') return skipped('the DEV-EXEC is not in LOCKED state');

    const markdown = fs.readFileSync(artifactFile(root, chain, 'exec', execVersion), 'utf8');
    const schema = DOC_MARKER.exec(markdown);
    if (!schema) return skipped('the DEV-EXEC has no document schema marker');
    if (Number(schema[1]) < CHANGELOG_MIN_EXEC_SCHEMA) {
      return skipped(`the DEV-EXEC uses template schema ${schema[1]}, which has no Changelog section (schema ${CHANGELOG_MIN_EXEC_SCHEMA} or later is required)`);
    }

    const section = readChangelogSection(markdown);
    if (!section.ok) return section.none ? { status: 'no_changes' } : skipped(section.reason);

    const target = resolveChangelogTarget(root);
    if (!target.ok) return skipped(target.reason);

    const next = addChangelogEntries(fs.readFileSync(target.file, 'utf8'), execVersion, section.entries);
    if (next === null) {
      return skipped(`${target.rel} is not in the expected format (version headings of the form "## v1.1")`);
    }
    const temporary = `${target.file}.sigma-tmp-${process.pid}`;
    try {
      fs.writeFileSync(temporary, next, 'utf8');
      atomicReplaceFileSync(temporary, target.file);
    } finally {
      fs.removeSync(temporary);
    }
    return { status: 'recorded', file: target.rel, version: execVersion, entries: section.entries.length };
  } catch (e) {
    return skipped(`an unexpected error occurred (${(e as Error).message.split(root).join('.')})`);
  }
}

// ── Creation (project start / project sync --confirm) ─────────────────────

export type ChangelogCreation =
  | { action: 'create'; file: string; rel: string }
  | { action: 'keep'; reason: string };

/** Decide whether a CHANGE-RECORD.md should be created. Creates nothing. */
export function planChangelogCreation(root: string): ChangelogCreation {
  let state: ReturnType<typeof getDevWorkspaceStatus>['state'];
  try {
    state = getDevWorkspaceStatus(root).state;
  } catch {
    state = 'INACTIVE';
  }
  const found = candidates(root);
  if (found.root.presence !== 'missing' || found.dev.presence !== 'missing') {
    return { action: 'keep', reason: `${CHANGE_RECORD_FILE} already present` };
  }
  if (state === 'ACTIVE_DEGRADED') return { action: 'keep', reason: 'dev workspace is degraded' };
  const chosen = state === 'ACTIVE' ? found.dev : found.root;
  return { action: 'create', file: chosen.file, rel: chosen.rel.split(path.sep).join('/') };
}

export function ensureChangelogFile(root: string): { created: boolean; rel?: string; reason?: string } {
  const plan = planChangelogCreation(root);
  if (plan.action !== 'create') return { created: false, reason: plan.reason };
  try {
    fs.writeFileSync(plan.file, '', { encoding: 'utf8', flag: 'wx' });
    return { created: true, rel: plan.rel };
  } catch {
    return { created: false, rel: plan.rel, reason: `${plan.rel} could not be created` };
  }
}
