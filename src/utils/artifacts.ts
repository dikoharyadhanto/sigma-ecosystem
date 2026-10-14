import fs from 'fs-extra';
import path from 'path';
import { journaledWriteIfActive } from '../engine/controlStore';
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

export function copyTemplateToArtifact(templateName: string, absPath: string, projectRoot?: string): void {
  const templatePath = resolveTemplate(templateName);
  fs.ensureDirSync(path.dirname(absPath));
  if (projectRoot && journaledWriteIfActive(projectRoot, absPath, fs.readFileSync(templatePath))) return;
  fs.copySync(templatePath, absPath);
}
