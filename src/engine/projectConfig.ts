import fs from 'fs-extra';
import path from 'path';
import { PROJECT_CONFIG_FILE, SCHEMA_VERSION } from '../config';

// D-01 — deliberately no `token` field here. Tokens live in
// GLOBAL_NOTION_CREDENTIALS_FILE (~/.sigma/notion.credentials.json), never
// inside a project directory. `enabled` here means "Notion is configured
// (parent page set) for this project" — distinct from whether a working
// token is currently resolvable, which getResolvedNotionConfig() checks
// separately.
export interface NotionConfig {
  enabled: boolean;
  parent_page_id?: string;
  database_id?: string;
  clean_local?: boolean;
}

// PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §3 — deliberately a separate field from
// `notion.enabled` above (that one means "Notion is configured/connected"),
// so the two never get confused despite similar names. This one governs
// whether the humanize+push Lock Requirement (§3.4) applies at all — it can
// be true even if `notion` isn't configured yet (the requirement just can't
// be satisfied until it is), and false even if `notion` is fully configured
// (Director opted the gate off).
export interface NotionHumanizeGateConfig {
  enabled: boolean;
}

// Bug-report follow-up 2026-08-30 (Phase 6). After a successful `sigma inbox
// read`, READ messages addressed to that role beyond the N most recent (by
// created_at) are flipped to OUTDATED, so AI roles stop re-scanning stale
// threads. 0 disables the auto-sweep (`sigma inbox clear` still works
// manually). Non-destructive: OUTDATED messages stay on disk and in the
// index, still reachable via `sigma inbox read <id>` and `sigma inbox
// --role <r> --outdated`.
export interface MailboxConfig {
  auto_outdate_read_keep: number;
}

const DEFAULT_MAILBOX: MailboxConfig = {
  auto_outdate_read_keep: 5,
};

export interface ProjectConfig {
  schema_version: string;
  document_language: string;
  interaction_language: string;
  output_document_language: string;
  notion?: NotionConfig;
  notion_humanize_gate?: NotionHumanizeGateConfig;
  mailbox?: MailboxConfig;
}

const DEFAULTS: ProjectConfig = {
  schema_version: SCHEMA_VERSION,
  document_language: 'English',
  interaction_language: 'English',
  output_document_language: 'English',
  notion: {
    enabled: false,
    clean_local: false,
  },
  notion_humanize_gate: {
    enabled: false,
  },
  mailbox: { ...DEFAULT_MAILBOX },
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
    notion: {
      enabled: false,
      clean_local: false,
    },
    notion_humanize_gate: {
      enabled: false,
    },
    mailbox: { ...DEFAULT_MAILBOX },
  };
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
