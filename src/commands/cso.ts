import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  registerCsoEntry,
  CsoEntry,
  assertProgressCanMutate,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';

const CSO_VALID_ROLES = ['ARC', 'FMN', 'DEV', 'AUD'] as const;
type CsoRole = typeof CSO_VALID_ROLES[number];

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
    .option('--role <role>', `Role label for filename (${CSO_VALID_ROLES.map(r => r.toLowerCase()).join('|')})`)
    .option('--from <file>', 'Seed content from an existing draft file')
    .action((opts: { role?: string; from?: string }) => {
      try {
        if (!opts.role) {
          console.error('--role is required. Use: sigma cso new --role <role>');
          console.error(`Valid roles: ${CSO_VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`);
          process.exit(1);
        }
        const role = opts.role.toUpperCase() as CsoRole;
        if (!(CSO_VALID_ROLES as readonly string[]).includes(role)) {
          console.error(`Invalid role "${opts.role}". Valid roles: ${CSO_VALID_ROLES.map(r => r.toLowerCase()).join(', ')}`);
          process.exit(1);
        }
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
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
          copyTemplateToArtifact('CSO-TEMPLATE.md', absPath);
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
