// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY §3.4 item 1 / WP-4.
//
// Snapshot mode for the INTENT baseline and amendment flow (F05). With Sigma
// gitignore ON, `Sigma/charter/INTENT-v<N>.md` is not tracked by Git, so the
// Git baseline (commit + annotated tag) cannot exist. The certified bytes are
// kept as local files instead:
//
//   Sigma/revisions/INTENT-v<N>/base.md        content at `baseline adopt`
//   Sigma/revisions/INTENT-v<N>/amd-<NNN>.md   content certified by each amendment
//   Sigma/revisions/INTENT-v<N>/ledger.json    ordered list of the above with hashes
//
// Same governance shape as the Git mode: the Director reviews a diff against
// the last certified content and approves a file hash; only the anchor differs
// (a local snapshot instead of a commit). The snapshot is evidence kept beside
// the chain, not a replacement for it — the chain's `snapshot_baseline` and the
// amendment entries remain the record. Snapshots are append-only: Sigma never
// rewrites or deletes one.

import fs from 'fs-extra';
import path from 'path';
import { ChainState, IntentSnapshotBaseline } from './chain';
import { sha256Hex, lfSha256, isTracked, repoToplevel, repoRelativePath, gitAvailable } from './gitRepo';
import { matchesCertified, lineEndingHint } from './docHash';
import { atomicReplaceFileSync } from '../utils/fs';
import { artifactFile } from './revisions';
import type { GitCheck, IntentGitReport } from './intentGit';

export interface SnapshotLedgerEntry {
  /** `BASE` or an amendment id such as `AMD-001`. */
  id: string;
  file: string;
  doc_sha256: string;
  doc_sha256_lf: string;
  revision: number;
  provenance: IntentSnapshotBaseline['provenance'];
  recorded_at: string;
}

export interface SnapshotLedger {
  schema_version: 1;
  chain: string;
  entries: SnapshotLedgerEntry[];
}

export type IntentVerificationMode = 'git' | 'snapshot';

// ── Paths ────────────────────────────────────────────────────────────────────

export function snapshotDirRel(chainVersion: string): string {
  if (!/^v\d+$/.test(chainVersion)) throw new Error(`Invalid chain version: ${chainVersion}`);
  return `Sigma/revisions/INTENT-${chainVersion}`;
}

export function snapshotLedgerRel(chainVersion: string): string {
  return `${snapshotDirRel(chainVersion)}/ledger.json`;
}

export function snapshotFileRel(chainVersion: string, id: 'BASE' | string): string {
  if (id === 'BASE') return `${snapshotDirRel(chainVersion)}/base.md`;
  const match = /^AMD-(\d{3,})$/.exec(id);
  if (!match) throw new Error(`Invalid amendment id: ${id}`);
  return `${snapshotDirRel(chainVersion)}/amd-${match[1]}.md`;
}

/** Files an adopt or amendment transaction may create or replace, so the journal can roll them back. */
export function intentSnapshotTransactionFiles(root: string, chainVersion: string, id: 'BASE' | string): string[] {
  return [snapshotLedgerRel(chainVersion), snapshotFileRel(chainVersion, id)].map(rel => path.join(root, rel));
}

// ── Mode resolution ──────────────────────────────────────────────────────────

/**
 * Which anchor verifies this chain's INTENT:
 *  - a recorded snapshot baseline wins (it is the newer decision);
 *  - otherwise a recorded Git baseline keeps Git mode;
 *  - with neither, Git mode only if the INTENT file is actually tracked by Git,
 *    because that is the only case where a commit can hold it.
 */
export function resolveIntentVerificationMode(root: string, chain: ChainState): IntentVerificationMode {
  if (chain.intent.snapshot_baseline) return 'snapshot';
  if (chain.intent.git_baseline) return 'git';
  try {
    if (!gitAvailable(root).ok) return 'snapshot';
    const top = repoToplevel(root);
    if (!top.ok) return 'snapshot';
    const abs = artifactFile(root, chain, 'intent', chain.intent.version);
    return isTracked(top.root, repoRelativePath(top.root, abs)) ? 'git' : 'snapshot';
  } catch {
    return 'snapshot';
  }
}

// ── Ledger ───────────────────────────────────────────────────────────────────

export function readSnapshotLedger(root: string, chainVersion: string): SnapshotLedger {
  const file = path.join(root, snapshotLedgerRel(chainVersion));
  if (!fs.existsSync(file)) return { schema_version: 1, chain: chainVersion, entries: [] };
  const raw: unknown = fs.readJsonSync(file);
  const ledger = raw as Partial<SnapshotLedger>;
  if (!ledger || ledger.schema_version !== 1 || ledger.chain !== chainVersion || !Array.isArray(ledger.entries)) {
    throw new Error(`INTENT snapshot ledger is malformed: ${snapshotLedgerRel(chainVersion)}`);
  }
  return ledger as SnapshotLedger;
}

function writeSnapshotLedger(root: string, ledger: SnapshotLedger): void {
  const file = path.join(root, snapshotLedgerRel(ledger.chain));
  fs.ensureDirSync(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeJsonSync(tmp, ledger, { spaces: 2 });
  atomicReplaceFileSync(tmp, file);
}

/**
 * Writes `bytes` as the snapshot for `id` and appends it to the ledger. An
 * existing snapshot is adopted only when its bytes are identical (a rerun after
 * an interrupted attempt); a different file is never overwritten.
 */
export function writeSnapshot(
  root: string,
  chainVersion: string,
  id: 'BASE' | string,
  bytes: Buffer,
  meta: { revision: number; provenance: IntentSnapshotBaseline['provenance']; recorded_at: string },
): { entry: SnapshotLedgerEntry; created: boolean } {
  const rel = snapshotFileRel(chainVersion, id);
  const abs = path.join(root, rel);
  let created = true;
  if (fs.existsSync(abs)) {
    if (!fs.readFileSync(abs).equals(bytes)) {
      throw new Error(`Snapshot ${rel} already exists with different content; Sigma never overwrites a snapshot.`);
    }
    created = false;
  } else {
    fs.ensureDirSync(path.dirname(abs));
    const tmp = `${abs}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, bytes);
    atomicReplaceFileSync(tmp, abs);
  }

  const entry: SnapshotLedgerEntry = {
    id,
    file: rel,
    doc_sha256: sha256Hex(bytes),
    doc_sha256_lf: lfSha256(bytes),
    revision: meta.revision,
    provenance: meta.provenance,
    recorded_at: meta.recorded_at,
  };
  const ledger = readSnapshotLedger(root, chainVersion);
  const existing = ledger.entries.find(e => e.id === id);
  if (existing) {
    if (existing.doc_sha256 !== entry.doc_sha256) throw new Error(`Ledger already holds ${id} with a different hash.`);
  } else {
    ledger.entries.push(entry);
    writeSnapshotLedger(root, ledger);
  }
  return { entry: existing ?? entry, created };
}

/** The recorded snapshot content, verified against its recorded hash. Null when missing or altered. */
export function readBaselineSnapshot(root: string, baseline: IntentSnapshotBaseline): Buffer | null {
  const abs = path.join(root, baseline.file);
  if (!fs.existsSync(abs)) return null;
  const bytes = fs.readFileSync(abs);
  return lfSha256(bytes) === baseline.doc_sha256_lf ? bytes : null;
}

/**
 * Looks through every snapshot of a chain for content that is the certified document `hash`
 * (raw, LF-folded or CRLF-expanded form, optional `sha256:` prefix — see matchesCertified).
 */
export function findSnapshotByHash(root: string, chainVersion: string, hash: string): Buffer | null {
  let ledger: SnapshotLedger;
  try { ledger = readSnapshotLedger(root, chainVersion); } catch { return null; }
  for (const entry of ledger.entries) {
    const abs = path.join(root, entry.file);
    if (!fs.existsSync(abs)) continue;
    const bytes = fs.readFileSync(abs);
    if (matchesCertified(bytes, hash)) return bytes;
  }
  return null;
}

// ── Inspection (same report shape as the Git mode) ───────────────────────────

/**
 * `clean`  — the INTENT must equal its certified/snapshot content (before ARC starts editing).
 * `edited` — the INTENT is expected to differ from the snapshot (preview and commit verification).
 *
 * Returns an IntentGitReport so the CLI and MCP printers need no second shape:
 * `repo_root` stays null and `repo_path` carries the project-relative INTENT path.
 */
export function inspectIntentSnapshot(root: string, chainVersion: string, chain: ChainState, mode: 'clean' | 'edited'): IntentGitReport {
  const checks: GitCheck[] = [];
  const report: IntentGitReport = {
    chain: chainVersion, file: chain.intent.file ?? null, repo_path: chain.intent.file ?? null, repo_root: null, checks, blockers: [],
    baseline: null, working_sha256: null, working_sha256_lf: null,
    certified_sha256: chain.intent.certified_doc_sha256 ?? null, revision: chain.intent.revision ?? null,
  };
  const add = (id: string, ok: boolean, detail: string, blocking = true): boolean => { checks.push({ id, ok, blocking, detail }); return ok; };
  const finish = (): IntentGitReport => { report.blockers = checks.filter(c => !c.ok && c.blocking).map(c => `${c.id}: ${c.detail}`); return report; };

  add('verification_mode', true, 'snapshot (local copies under Sigma/revisions/; Git is not used for this INTENT)', false);
  add('intent_ratified', chain.intent.state === 'RATIFIED', `INTENT ${chain.intent.version} is ${chain.intent.state}; amendment requires RATIFIED`);

  let abs: string;
  try {
    abs = artifactFile(root, chain, 'intent', chain.intent.version);
    if (!fs.existsSync(abs)) throw new Error('INTENT file is not present on disk');
    add('intent_file', true, chain.intent.file ?? abs);
  } catch (e) {
    add('intent_file', false, (e as Error).message);
    return finish();
  }
  const bytes = fs.readFileSync(abs);
  report.working_sha256 = sha256Hex(bytes);
  report.working_sha256_lf = lfSha256(bytes);

  const baseline = chain.intent.snapshot_baseline;
  if (!add('baseline_recorded', !!baseline, 'No snapshot baseline recorded for this chain. Run: sigma intent baseline adopt --director-confirm')) return finish();
  const b = baseline!;
  const snapshot = readBaselineSnapshot(root, b);
  add('baseline_snapshot', !!snapshot, snapshot
    ? `${b.file} matches the recorded baseline content`
    : `${b.file} is missing or no longer matches the recorded baseline hash (snapshots are append-only; restore it from backup)`);

  if (mode === 'clean') {
    // Line-ending-only differences (core.autocrlf) are not an edit: same tolerance as the Git mode.
    add('certified_matches_file', matchesCertified(bytes, report.certified_sha256), `UNCERTIFIED_EDIT: the INTENT file differs from its certified content (${lineEndingHint(bytes, report.certified_sha256)})`);
    add('file_matches_baseline', report.working_sha256_lf === b.doc_sha256_lf, 'The INTENT file does not match the recorded snapshot baseline content');
  } else {
    add('changed_since_baseline', report.working_sha256_lf !== b.doc_sha256_lf, 'The INTENT file has no change relative to the baseline; nothing to amend');
  }
  return finish();
}

// ── Diff (no Git required) ───────────────────────────────────────────────────

const MAX_DIFF_CELLS = 4_000_000;

function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized === '') return [];
  const lines = normalized.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Unified-style line diff of two documents (CRLF folded). Mechanical evidence only. */
export function diffDocuments(before: string, after: string, labelBefore: string, labelAfter: string): { stat: string; patch: string } {
  const a = splitLines(before);
  const b = splitLines(after);
  if (a.length * b.length > MAX_DIFF_CELLS) {
    return { stat: `(diff skipped: ${a.length} -> ${b.length} lines is too large for the built-in differ)`, patch: '' };
  }

  // Longest common subsequence table, then walk it into hunks.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Array<{ kind: ' ' | '-' | '+'; line: string }> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { ops.push({ kind: ' ', line: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { ops.push({ kind: '-', line: a[i] }); i++; }
    else { ops.push({ kind: '+', line: b[j] }); j++; }
  }
  while (i < a.length) ops.push({ kind: '-', line: a[i++] });
  while (j < b.length) ops.push({ kind: '+', line: b[j++] });

  const added = ops.filter(o => o.kind === '+').length;
  const removed = ops.filter(o => o.kind === '-').length;
  const stat = added === 0 && removed === 0
    ? '(no changes)'
    : `${labelAfter} | ${added + removed} changed (+${added} -${removed})`;

  const CONTEXT = 3;
  const keep = new Array<boolean>(ops.length).fill(false);
  ops.forEach((op, index) => {
    if (op.kind === ' ') return;
    for (let k = Math.max(0, index - CONTEXT); k <= Math.min(ops.length - 1, index + CONTEXT); k++) keep[k] = true;
  });
  const out: string[] = [`--- ${labelBefore}`, `+++ ${labelAfter}`];
  let index = 0;
  while (index < ops.length) {
    if (!keep[index]) { index++; continue; }
    let end = index;
    while (end < ops.length && keep[end]) end++;
    const hunk = ops.slice(index, end);
    const startA = ops.slice(0, index).filter(o => o.kind !== '+').length + 1;
    const startB = ops.slice(0, index).filter(o => o.kind !== '-').length + 1;
    out.push(`@@ -${startA},${hunk.filter(o => o.kind !== '+').length} +${startB},${hunk.filter(o => o.kind !== '-').length} @@`);
    for (const op of hunk) out.push(op.kind + op.line);
    index = end;
  }
  return { stat, patch: added === 0 && removed === 0 ? '' : out.join('\n') + '\n' };
}
