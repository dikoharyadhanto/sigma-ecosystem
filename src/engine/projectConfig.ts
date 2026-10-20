import fs from 'fs-extra';
import path from 'path';
import { PROJECT_CONFIG_FILE, SCHEMA_VERSION } from '../config';

// Bug-report follow-up 2026-08-30 (Phase 6). After a successful `sigma inbox
// read`, READ messages addressed to that role beyond the N most recent (by
// created_at) are flipped to OUTDATED, so AI roles stop re-scanning stale
// threads. 0 disables the auto-sweep (`sigma inbox clear` still works
// manually). Non-destructive: OUTDATED messages stay on disk and in the
// index, still reachable via `sigma inbox read <id>` and `sigma inbox
// --role <r> --outdated`.
// PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF §3/§9 poin 1 (Director 2026-09-12).
// Max unread MEMO entries per owning INTENT and role. GENERAL is separate.
// 0 disables the memo feature entirely (mirrors auto_outdate_read_keep's
// 0-disables convention).
export interface MailboxConfig {
  auto_outdate_read_keep: number;
  memo_unread_limit: number;
}

export const DEFAULT_MAILBOX: MailboxConfig = {
  auto_outdate_read_keep: 5,
  memo_unread_limit: 5,
};

// PLAN-IMPL-SIGMA-GITIGNORE-IDENTITY-AND-PORTABILITY §3.3. When true (default),
// every file Sigma generates is listed in the project's .gitignore except
// .sigma-identity.json, which stays tracked as the cross-machine guardrail.
export interface GitProjectConfig {
  gitignore_sigma: boolean;
}

export const DEFAULT_GIT: GitProjectConfig = { gitignore_sigma: true };

export interface ProjectConfig {
  schema_version: string;
  document_language: string;
  interaction_language: string;
  output_document_language: string;
  mailbox?: MailboxConfig;
  git?: GitProjectConfig;
}

const DEFAULTS: ProjectConfig = {
  schema_version: SCHEMA_VERSION,
  document_language: 'English',
  interaction_language: 'English',
  output_document_language: 'English',
  mailbox: { ...DEFAULT_MAILBOX },
  // `git` is deliberately absent: a config written before the field existed
  // must stay distinguishable from one that chose a value (hasExplicitGitignoreSigma).
};

export function readProjectConfig(projectRoot: string): ProjectConfig {
  const filePath = path.join(projectRoot, PROJECT_CONFIG_FILE);
  if (!fs.existsSync(filePath)) return { ...DEFAULTS };
  try {
    const raw = fs.readJsonSync(filePath) as Partial<ProjectConfig>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeProjectConfig(projectRoot: string, config: ProjectConfig): void {
  const filePath = path.join(projectRoot, PROJECT_CONFIG_FILE);
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeJsonSync(filePath, config, { spaces: 2 });
}

export function createDefaultProjectConfig(lang = 'English'): ProjectConfig {
  return {
    schema_version: SCHEMA_VERSION,
    document_language: lang,
    interaction_language: lang,
    output_document_language: lang,
    mailbox: { ...DEFAULT_MAILBOX },
    git: { ...DEFAULT_GIT },
  };
}

// Resolves the Sigma-gitignore switch, tolerating a missing or malformed `git`
// block (project.config.json written before this field existed). Anything that
// is not an explicit boolean falls back to the default (ON).
export function resolveGitignoreSigma(config: ProjectConfig): boolean {
  const raw = config.git?.gitignore_sigma;
  return typeof raw === 'boolean' ? raw : DEFAULT_GIT.gitignore_sigma;
}

/** True when project.config.json carries an explicit gitignore_sigma value (as opposed to the implicit default). */
export function hasExplicitGitignoreSigma(config: ProjectConfig): boolean {
  return typeof config.git?.gitignore_sigma === 'boolean';
}

// Resolves the auto-outdate keep-count, tolerating a missing or malformed
// `mailbox` block. An explicit 0 is honored (disables the sweep); anything
// non-numeric or negative falls back to the default.
export function resolveAutoOutdateKeep(config: ProjectConfig): number {
  const raw = config.mailbox?.auto_outdate_read_keep;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return DEFAULT_MAILBOX.auto_outdate_read_keep;
  }
  return Math.floor(raw);
}

// Resolves the per-INTENT/per-role (and separate GENERAL) MEMO quota, tolerating
// `mailbox` block (including project.config.json written before this field
// existed). An explicit 0 is honored (disables `sigma memo write` entirely);
// anything non-numeric or negative falls back to the default.
export function resolveMemoLimit(config: ProjectConfig): number {
  const raw = config.mailbox?.memo_unread_limit;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return DEFAULT_MAILBOX.memo_unread_limit;
  }
  return Math.floor(raw);
}
