import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  registerCsoEntry,
  CsoEntry,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { GLOBAL_TEMPLATES_DIR } from '../config';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path.join(PACKAGE_ROOT, 'Sigma', 'templates');

function resolveTemplate(name: string): string {
  const global = path.join(GLOBAL_TEMPLATES_DIR, name);
  if (fs.existsSync(global)) return global;
  const bundle = path.join(BUNDLE_TEMPLATES, name);
  if (fs.existsSync(bundle)) return bundle;
  throw new Error('Template not found. Run: sigma setup install');
}

function buildTimestamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}`;
}

export function csoCommand(): Command {
  const cmd = new Command('cso');
  cmd.description('Manage CSO (Close-out Session Output) artifacts');

  cmd.command('new')
    .description('Create a new CSO file in Sigma/logs/')
    .option('--role <role>', 'Role label for filename (e.g. DEV, FMN, ARC)', 'ANON')
    .option('--from <file>', 'Seed content from an existing draft file')
    .action((opts: { role: string; from?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);

        const role = opts.role.toUpperCase();
        const ts = buildTimestamp();
        const baseName = `CSO-${role}-${ts}`;
        const fileName = `${baseName}.md`;
        const relPath = path.join('Sigma', 'logs', fileName);
        const absPath = path.join(projectRoot, relPath);
        fs.ensureDirSync(path.dirname(absPath));

        if (opts.from) {
          const srcPath = path.resolve(opts.from);
          if (!fs.existsSync(srcPath)) {
            throw new Error(`Source file not found: ${opts.from}`);
          }
          fs.copySync(srcPath, absPath);
        } else {
          const templatePath = resolveTemplate('CSO-TEMPLATE.md');
          fs.copySync(templatePath, absPath);
        }

        const now = new Date().toISOString();
        const entry: CsoEntry = {
          version: baseName,
          state: 'COMPLETE',
          file: relPath,
          created_at: now,
        };

        registerCsoEntry(data, entry);
        writeProgress(projectRoot, data);
        console.log(`CSO created: ${relPath}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
