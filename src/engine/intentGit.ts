// F05 — Git verification for the INTENT amendment flow (read-only except for
// the tag Sigma creates at the effective point, see services/). Reports every
// precondition separately instead of stopping at the first failure so ARC and
// the Director see the whole picture (F05 §4.1).

import fs from 'fs';
import { ChainState, IntentGitBaseline } from './chain';
import { artifactFile } from './revisions';
import * as git from './gitRepo';

export interface GitCheck {
  id: string;
  ok: boolean;
  /** Non-blocking checks are informational or drift warnings. */
  blocking: boolean;
  detail: string;
}

export interface IntentGitReport {
  chain: string;
  file: string | null;
  repo_path: string | null;
  repo_root: string | null;
  checks: GitCheck[];
  blockers: string[];
  baseline: IntentGitBaseline | null;
  working_sha256: string | null;
  working_sha256_lf: string | null;
  certified_sha256: string | null;
  revision: number | null;
}

export type InspectMode = 'clean' | 'edited';

export function intentTagName(chainVersion: string, kind: 'base' | string): string {
  return kind === 'base' ? `sigma/intent-${chainVersion}-base` : `sigma/intent-${chainVersion}-${kind.toLowerCase()}`;
}

export function intentAbsPath(root: string, chain: ChainState): string {
  return artifactFile(root, chain, 'intent', chain.intent.version);
}

/**
 * `clean`  — the INTENT must equal its certified/baseline content and be committed (before ARC starts editing, and before Petition).
 * `edited` — the INTENT is expected to differ from the baseline (preview and commit verification).
 */
export function inspectIntentGit(root: string, chainVersion: string, chain: ChainState, mode: InspectMode): IntentGitReport {
  const checks: GitCheck[] = [];
  const report: IntentGitReport = {
    chain: chainVersion, file: chain.intent.file ?? null, repo_path: null, repo_root: null, checks, blockers: [],
    baseline: chain.intent.git_baseline ?? null, working_sha256: null, working_sha256_lf: null,
    certified_sha256: chain.intent.certified_doc_sha256 ?? null, revision: chain.intent.revision ?? null,
  };
  const add = (id: string, ok: boolean, detail: string, blocking = true): boolean => { checks.push({ id, ok, blocking, detail }); return ok; };
  const finish = (): IntentGitReport => { report.blockers = checks.filter(c => !c.ok && c.blocking).map(c => `${c.id}: ${c.detail}`); return report; };

  const avail = git.gitAvailable(root);
  if (!add('git_available', avail.ok, avail.ok ? avail.version! : `Git is not available: ${avail.error}`)) return finish();
  const top = git.repoToplevel(root);
  if (!top.ok) {
    add('git_repository', false, `No usable Git working tree: ${top.error}`);
    return finish();
  }
  add('git_repository', true, top.root);
  report.repo_root = top.root;

  add('intent_ratified', chain.intent.state === 'RATIFIED', `INTENT ${chain.intent.version} is ${chain.intent.state}; amendment requires RATIFIED`);
  let abs: string;
  try {
    abs = intentAbsPath(root, chain);
    if (!fs.existsSync(abs)) throw new Error('INTENT file is not present on disk');
    add('intent_file', true, chain.intent.file ?? abs);
  } catch (e) {
    add('intent_file', false, (e as Error).message);
    return finish();
  }
  let rel: string;
  try {
    rel = git.repoRelativePath(top.root, abs);
    report.repo_path = rel;
  } catch (e) {
    add('intent_in_repository', false, (e as Error).message);
    return finish();
  }
  const bytes = fs.readFileSync(abs);
  report.working_sha256 = git.sha256Hex(bytes);
  report.working_sha256_lf = git.lfSha256(bytes);
  add('intent_tracked', git.isTracked(top.root, rel), `${rel} must be tracked by Git (not untracked or ignored)`);

  const baseline = chain.intent.git_baseline;
  if (!add('baseline_recorded', !!baseline, 'No Git baseline recorded for this chain. Run: sigma intent baseline adopt --commit <ref> --director-confirm')) return finish();
  const b = baseline!;
  const resolved = git.resolveCommit(root, b.commit);
  if (add('baseline_commit', resolved.ok, resolved.ok ? b.commit : `Baseline commit ${b.commit} is not available in this repository`)) {
    const blob = git.blobAt(root, b.commit, rel);
    add('baseline_content', !!blob && git.lfSha256(blob) === b.doc_sha256_lf, blob
      ? `INTENT at baseline commit ${b.commit.slice(0, 12)} must match the recorded baseline content`
      : `${rel} does not exist at baseline commit ${b.commit.slice(0, 12)}`);
    add('baseline_reachable', git.isAncestor(root, b.commit, 'HEAD'), `Baseline commit ${b.commit.slice(0, 12)} must be an ancestor of HEAD (history rewritten or other branch checked out?)`);
    const after = git.commitsTouching(top.root, b.commit, rel);
    add('commits_after_baseline', true, after.length ? `${after.length} commit(s) touched ${rel} after the baseline: ${after.map(c => c.slice(0, 12)).join(', ')}` : 'none', false);
  }
  const tag = git.readTag(root, b.tag);
  if (!tag.exists) add('baseline_tag', false, `Tag ${b.tag} is missing (drift; Sigma will not recreate or move it)`, false);
  else add('baseline_tag', tag.commit === b.commit, tag.commit === b.commit ? `${b.tag} -> ${b.commit.slice(0, 12)}${tag.annotated ? '' : ' (lightweight)'}` : `Tag ${b.tag} points to ${String(tag.commit).slice(0, 12)}, not the recorded ${b.commit.slice(0, 12)}`);

  if (mode === 'clean') {
    add('certified_matches_file', report.certified_sha256 === report.working_sha256, 'UNCERTIFIED_EDIT: the INTENT file differs from its certified content');
    add('worktree_clean', git.pathStatus(top.root, rel) === '', `${rel} has uncommitted changes (staged or unstaged)`);
    add('file_matches_baseline', report.working_sha256_lf === b.doc_sha256_lf, 'The INTENT file does not match the recorded Git baseline content');
  } else {
    add('changed_since_baseline', report.working_sha256_lf !== b.doc_sha256_lf, 'The INTENT file has no change relative to the baseline; nothing to amend');
  }
  return finish();
}

export interface AmendmentImpact {
  current_revision: number | null;
  next_revision: number;
  plans_flagged_for_review: string[];
  locked_pairs_unchanged: string[];
  drafts: { plan: string[]; exec: string[] };
}

export function amendmentImpact(chain: ChainState): AmendmentImpact {
  const plans = chain.plan.versions;
  return {
    current_revision: chain.intent.revision ?? null,
    next_revision: (chain.intent.revision ?? 0) + 1,
    plans_flagged_for_review: plans.filter(p => p.state === 'APPROVED').map(p => p.version),
    locked_pairs_unchanged: plans.filter(p => p.state === 'LOCKED').map(p => p.version),
    drafts: { plan: plans.filter(p => p.state === 'DRAFT').map(p => p.version), exec: chain.exec.versions.filter(e => e.state === 'DRAFT').map(e => e.version) },
  };
}

export interface AmendmentPreview {
  report: IntentGitReport;
  impact: AmendmentImpact;
  diff: { stat: string; patch: string };
  diff_sha256: string;
  next_amendment_id: string;
  next_tag: string;
}

export function nextAmendmentIdOf(chain: ChainState): string {
  return `AMD-${String((chain.intent.amendments?.length ?? 0) + 1).padStart(3, '0')}`;
}

export function previewIntentAmendment(root: string, chainVersion: string, chain: ChainState): AmendmentPreview {
  const report = inspectIntentGit(root, chainVersion, chain, 'edited');
  const diff = report.baseline && report.repo_path && report.checks.find(c => c.id === 'baseline_commit')?.ok
    ? git.diffAgainstWorktree(report.repo_root!, report.baseline.commit, report.repo_path)
    : { stat: '', patch: '' };
  const id = nextAmendmentIdOf(chain);
  return { report, impact: amendmentImpact(chain), diff, diff_sha256: git.sha256Hex(diff.patch), next_amendment_id: id, next_tag: intentTagName(chainVersion, id) };
}

export interface VerifiedResultCommit {
  commit: string;
  repo_root: string;
  repo_path: string;
  working_sha256: string;
  working_sha256_lf: string;
}

/** Verifies that `ref` is a commit holding exactly the working-tree INTENT content (F05 §4.5). Throws with every failed condition. */
export function verifyResultCommit(root: string, chainVersion: string, chain: ChainState, ref: string, expectedSha256?: string): VerifiedResultCommit {
  const report = inspectIntentGit(root, chainVersion, chain, 'edited');
  const problems = [...report.blockers];
  const b = report.baseline;
  let commit = '';
  if (!problems.length && b && report.repo_path) {
    const resolved = git.resolveCommit(root, ref);
    if (!resolved.ok) problems.push(`commit: ${resolved.error}`);
    else {
      commit = resolved.sha;
      if (commit === b.commit) problems.push('commit: the result commit is the baseline commit; commit the amended INTENT first');
      if (!git.isAncestor(root, b.commit, commit)) problems.push(`commit: ${commit.slice(0, 12)} is not a descendant of the baseline commit ${b.commit.slice(0, 12)}`);
      if (!git.isAncestor(root, commit, 'HEAD')) problems.push(`commit: ${commit.slice(0, 12)} is not reachable from HEAD`);
      const blob = git.blobAt(root, commit, report.repo_path);
      if (!blob) problems.push(`commit: ${report.repo_path} does not exist at ${commit.slice(0, 12)}`);
      else if (git.lfSha256(blob) !== report.working_sha256_lf) problems.push(`commit: INTENT at ${commit.slice(0, 12)} differs from the working-tree file; commit exactly the reviewed content`);
      if (git.pathStatus(report.repo_root!, report.repo_path) !== '') problems.push(`worktree: ${report.repo_path} has uncommitted changes after the result commit`);
    }
    if (expectedSha256 && report.working_sha256 !== expectedSha256) problems.push(`doc_sha256: the INTENT file hash ${report.working_sha256} differs from the reviewed hash ${expectedSha256}; preview and obtain approval again`);
  }
  if (problems.length) throw new Error('Amendment cannot be completed; unfinished steps:\n' + problems.map(p => ` - ${p}`).join('\n'));
  return { commit, repo_root: report.repo_root!, repo_path: report.repo_path!, working_sha256: report.working_sha256!, working_sha256_lf: report.working_sha256_lf! };
}

export interface LocatedIntent {
  repoRoot: string;
  rel: string;
  abs: string;
  bytes: Buffer;
}

/** Shared by `baseline adopt`: finds the INTENT file in the Git working tree or throws with the reason. */
export function locateIntentInRepo(root: string, chain: ChainState): LocatedIntent {
  const avail = git.gitAvailable(root);
  if (!avail.ok) throw new Error(`Git is not available: ${avail.error}`);
  const top = git.repoToplevel(root);
  if (!top.ok) throw new Error(`No usable Git working tree: ${top.error}`);
  const abs = intentAbsPath(root, chain);
  if (!fs.existsSync(abs)) throw new Error('INTENT file is not present on disk');
  const rel = git.repoRelativePath(top.root, abs);
  if (!git.isTracked(top.root, rel)) throw new Error(`${rel} must be tracked by Git (not untracked or ignored)`);
  return { repoRoot: top.root, rel, abs, bytes: fs.readFileSync(abs) };
}

/**
 * Creates the annotated tag, or adopts an existing one that already points to the same commit.
 * A tag on any other commit is never moved or overwritten (F05 §2 item 6).
 */
export function ensureAnnotatedTag(root: string, name: string, commit: string, message: string): { created: boolean } {
  if (!git.validTagName(root, name)) throw new Error(`Invalid tag name: ${name}`);
  const existing = git.readTag(root, name);
  if (existing.exists) {
    if (existing.commit === commit) return { created: false };
    throw new Error(`Tag ${name} already exists on ${String(existing.commit).slice(0, 12)}; Sigma never moves or overwrites tags`);
  }
  const made = git.createAnnotatedTag(root, name, commit, message);
  if (!made.ok) throw new Error(`Could not create tag ${name}: ${made.error}`);
  return { created: true };
}

/** Read-only drift summary of recorded Git references (doctor/status). Never writes. */
export function intentGitDrift(root: string, chainVersion: string, chain: ChainState): string[] {
  if (!chain.intent.git_baseline) return [];
  const drift: string[] = [];
  const top = git.repoToplevel(root);
  if (!top.ok) return [`Git repository unavailable: ${top.error}`];
  const refs: Array<{ label: string; commit: string; tag: string }> = [{ label: 'baseline', commit: chain.intent.git_baseline.commit, tag: chain.intent.git_baseline.tag }];
  for (const a of chain.intent.amendments ?? []) if (a.result_commit && a.result_tag) refs.push({ label: a.id, commit: a.result_commit, tag: a.result_tag });
  for (const r of refs) {
    if (!git.resolveCommit(root, r.commit).ok) drift.push(`${r.label}: commit ${r.commit.slice(0, 12)} is not available`);
    const t = git.readTag(root, r.tag);
    if (!t.exists) drift.push(`${r.label}: tag ${r.tag} is missing`);
    else if (t.commit !== r.commit) drift.push(`${r.label}: tag ${r.tag} points to ${String(t.commit).slice(0, 12)}, recorded ${r.commit.slice(0, 12)}`);
  }
  const recorded = new Set(refs.map(r => r.tag));
  for (const name of git.listTags(root, `sigma/intent-${chainVersion}-*`)) {
    if (!recorded.has(name)) drift.push(`orphan tag ${name} is not recorded in the chain (Sigma does not delete tags)`);
  }
  return drift;
}
