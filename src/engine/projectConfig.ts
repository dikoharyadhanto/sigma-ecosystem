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

export interface ProjectConfig {
  schema_version: string;
  document_language: string;
  interaction_language: string;
  output_document_language: string;
  notion?: NotionConfig;
  notion_humanize_gate?: NotionHumanizeGateConfig;
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
  };
}
