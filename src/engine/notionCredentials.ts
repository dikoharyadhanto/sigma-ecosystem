import fs from 'fs-extra';
import path from 'path';
import { GLOBAL_NOTION_CREDENTIALS_FILE, PROJECT_IDENTITY_FILE } from '../config';

// D-01 — per-machine Notion credentials, keyed by project_id. Never lives
// under a project root, so it can never end up in a Director's git history
// regardless of .gitignore discipline.
interface NotionCredentialsFile {
  [projectId: string]: { token: string };
}

export function getProjectId(projectRoot: string): string | undefined {
  const identityPath = path.join(projectRoot, PROJECT_IDENTITY_FILE);
  if (!fs.existsSync(identityPath)) return undefined;
  try {
    const identity = fs.readJsonSync(identityPath);
    return identity.project_id;
  } catch {
    return undefined;
  }
}

function readCredentialsFile(): NotionCredentialsFile {
  if (!fs.existsSync(GLOBAL_NOTION_CREDENTIALS_FILE)) return {};
  try {
    return fs.readJsonSync(GLOBAL_NOTION_CREDENTIALS_FILE) as NotionCredentialsFile;
  } catch {
    return {};
  }
}

export function readGlobalNotionToken(projectId: string): string | undefined {
  const all = readCredentialsFile();
  return all[projectId]?.token;
}

export function writeGlobalNotionToken(projectId: string, token: string): void {
  const all = readCredentialsFile();
  all[projectId] = { token };
  fs.ensureDirSync(path.dirname(GLOBAL_NOTION_CREDENTIALS_FILE));
  fs.writeJsonSync(GLOBAL_NOTION_CREDENTIALS_FILE, all, { spaces: 2 });
}

export function clearGlobalNotionToken(projectId: string): void {
  const all = readCredentialsFile();
  if (projectId in all) {
    delete all[projectId];
    fs.writeJsonSync(GLOBAL_NOTION_CREDENTIALS_FILE, all, { spaces: 2 });
  }
}

// Resolves the token for a project: env var override first (CI/scripting),
// then the project's entry in the global per-machine credentials file.
export function resolveNotionToken(projectRoot: string): string | undefined {
  const envToken = process.env.NOTION_TOKEN;
  if (envToken) return envToken;

  const projectId = getProjectId(projectRoot);
  if (!projectId) return undefined;
  return readGlobalNotionToken(projectId);
}
