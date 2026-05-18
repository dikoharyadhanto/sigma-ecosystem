import fs from 'fs-extra';
import path from 'path';
import { GLOBAL_TEMPLATES_DIR } from '../config';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path.join(PACKAGE_ROOT, 'Sigma', 'templates');

export function resolveTemplate(name: string): string {
  const global = path.join(GLOBAL_TEMPLATES_DIR, name);
  if (fs.existsSync(global)) return global;
  const bundle = path.join(BUNDLE_TEMPLATES, name);
  if (fs.existsSync(bundle)) return bundle;
  throw new Error('Template not found. Run: sigma setup install');
}

export function copyTemplateToArtifact(templateName: string, absPath: string): void {
  const templatePath = resolveTemplate(templateName);
  fs.ensureDirSync(path.dirname(absPath));
  fs.copySync(templatePath, absPath);
}

export function appendAuditFindings(absPath: string, domain: string, action: string): void {
  const now = new Date().toISOString();
  const section = `\n---\n\n## AUD Advisory Findings\n\n*Appended: ${now}*\n*Operation: sigma ${domain} ${action}*\n*Status: ADVISORY ONLY — does not change runtime state*\n\n**Audit Scope**: [AUD fills this]\n\n**Findings**:\n\n[AUD fills this]\n\n**Recommendation**: [AUD fills this]\n`;
  fs.appendFileSync(absPath, section);
}
