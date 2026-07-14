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
