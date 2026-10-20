// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY §3.3 — one place that
// turns the `git.gitignore_sigma` switch into effects on disk, shared by
// `sigma project start|sync` and `sigma config set gitignore`.
//
// Non-destructive by construction (plan invariant 1): the only operations are
// editing .gitignore, `git rm --cached`, and rewriting two config files. No
// Sigma file is ever deleted.

import fs from 'fs-extra';
import path from 'path';
import { PROJECT_IDENTITY_FILE } from '../config';
import { listChainVersions, readChain } from '../engine/chain';
import { readProjectConfig, writeProjectConfig, resolveGitignoreSigma } from '../engine/projectConfig';
import { atomicReplaceFileSync } from '../utils/fs';
import {
  applyGitignoreBlock,
  removeGitignoreBlock,
  hasGitignoreBlock,
  untrackSigmaFilesFromGitIndex,
  GitignoreChange,
  UntrackResult,
} from '../utils/gitignore';

export interface GitignoreApplyReport {
  enabled: boolean;
  block: GitignoreChange;
  untrack: UntrackResult | null;
  lines: string[];
  warnings: string[];
}

/** Records the switch in project.config.json and .sigma-identity.json (read-merge-write; other fields survive). */
export function persistGitignoreSetting(projectRoot: string, enabled: boolean): void {
  const config = readProjectConfig(projectRoot);
  config.git = { ...config.git, gitignore_sigma: enabled };
  writeProjectConfig(projectRoot, config);

  const identityPath = path.join(projectRoot, PROJECT_IDENTITY_FILE);
  if (!fs.existsSync(identityPath)) return;
  let identity: Record<string, unknown>;
  try {
    const parsed: unknown = fs.readJsonSync(identityPath);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    identity = parsed as Record<string, unknown>;
  } catch {
    return; // a corrupt identity is `sigma project register`'s job, not ours to overwrite
  }
  const previous = identity.git;
  const previousEnabled = previous !== null && typeof previous === 'object'
    ? (previous as { gitignore_sigma?: unknown }).gitignore_sigma
    : undefined;
  if (previousEnabled === enabled) return; // keep the tracked file byte-stable
  identity.git = { ...(previous !== null && typeof previous === 'object' ? previous : {}), gitignore_sigma: enabled };
  const tmp = `${identityPath}.${process.pid}.tmp`;
  fs.writeJsonSync(tmp, identity, { spaces: 2 });
  atomicReplaceFileSync(tmp, identityPath);
}

/** ON: write the managed block, then detach already-tracked Sigma files from the index (disk untouched). */
export function enableSigmaGitignore(projectRoot: string): GitignoreApplyReport {
  const report: GitignoreApplyReport = { enabled: true, block: 'unchanged', untrack: null, lines: [], warnings: [] };
  report.block = applyGitignoreBlock(projectRoot);
  report.lines.push(
    report.block === 'unchanged'
      ? '.gitignore: Sigma block already up to date.'
      : `.gitignore: Sigma block ${report.block} (everything except ${PROJECT_IDENTITY_FILE} is ignored).`,
  );

  const untrack = untrackSigmaFilesFromGitIndex(projectRoot);
  report.untrack = untrack;
  if (untrack.error) {
    report.warnings.push(
      `Could not detach Sigma files from the Git index: ${untrack.error}. ` +
      'Your files on disk are untouched. Commit or unstage the pending changes, then re-run: sigma config set gitignore on',
    );
  } else if (untrack.untracked > 0) {
    report.lines.push(
      `Git index: ${untrack.untracked} Sigma file(s) detached (git rm --cached; files kept on disk). ` +
      'Commit this change to finish — Sigma never commits for you.',
    );
    // Local files are safe here, but Git deletes tracked files that a commit removes
    // when it is pulled elsewhere. Sigma cannot know whether other clones exist.
    report.warnings.push(
      'Other machines: once you commit and push this change, `git pull` on any other clone of this repository ' +
      'REMOVES its tracked Sigma files from disk (Git deletes files a commit removes), and that clone is then blocked ' +
      '(only .sigma-identity.json remains). Before pulling there, copy its Sigma/ folder and the other Sigma files to a safe place.',
    );
  }

  // Chains verified against a Git baseline cannot be amended once their INTENT is untracked.
  // Moving them to snapshot mode replaces the Git proof, so it stays an explicit Director approval.
  const gitBound = chainsNeedingSnapshotAdoption(projectRoot);
  if (gitBound.length > 0) {
    report.warnings.push(
      `Chain(s) ${gitBound.join(', ')} have a Git INTENT baseline, and the INTENT is no longer tracked by Git, so amending them will fail. ` +
      'To verify them through a local snapshot instead, the Director runs, per chain: ' +
      'sigma intent baseline adopt --v <chain> --director-confirm (no --commit). Nothing was changed automatically.',
    );
  }
  return report;
}

function chainsNeedingSnapshotAdoption(projectRoot: string): string[] {
  const result: string[] = [];
  try {
    for (const version of listChainVersions(projectRoot)) {
      const chain = readChain(projectRoot, version);
      if (chain.intent.state === 'RATIFIED' && chain.intent.git_baseline && !chain.intent.snapshot_baseline) result.push(version);
    }
  } catch {
    // an unreadable chain is reported by `sigma doctor`, not by this notice
  }
  return result;
}

/** OFF: remove the managed block only. Nothing is staged or untracked; Sigma files become committable again. */
export function disableSigmaGitignore(projectRoot: string): GitignoreApplyReport {
  const block = removeGitignoreBlock(projectRoot);
  return {
    enabled: false,
    block,
    untrack: null,
    lines: [
      block === 'removed'
        ? '.gitignore: Sigma block removed. Sigma files can now be committed and pushed.'
        : '.gitignore: no Sigma block present; nothing to remove.',
    ],
    warnings: [],
  };
}

/** Applies whatever project.config.json currently says. */
export function applyGitignorePolicy(projectRoot: string): GitignoreApplyReport {
  return resolveGitignoreSigma(readProjectConfig(projectRoot))
    ? enableSigmaGitignore(projectRoot)
    : disableSigmaGitignore(projectRoot);
}

export function isGitignoreBlockApplied(projectRoot: string): boolean {
  return hasGitignoreBlock(projectRoot);
}
