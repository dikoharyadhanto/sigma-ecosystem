import fs from 'fs-extra';
import path from 'path';
import { PROJECT_CONFIG_FILE, SCHEMA_VERSION } from '../config';

export interface ProjectConfig {
  schema_version: string;
  document_language: string;
  interaction_language: string;
  output_document_language: string;
}

const DEFAULTS: ProjectConfig = {
  schema_version: SCHEMA_VERSION,
  document_language: 'English',
  interaction_language: 'English',
  output_document_language: 'English',
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
  };
}
