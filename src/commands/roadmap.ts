import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  nextMajorVersion,
  registerRoadmapDraft,
  lockActiveRoadmap,
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

export function roadmapCommand(): Command {
  const cmd = new Command('roadmap');
  cmd.description('Manage ROADMAP artifact');

  cmd.command('new')
    .description('Create a new ROADMAP draft (requires locked DIR-INTENT)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);

        if (data.intent.active_state !== 'LOCKED') {
          throw new Error('ROADMAP requires a locked DIR-INTENT. Run: sigma intent lock');
        }

        const draftExists = data.roadmap.versions.some(v => v.state === 'DRAFT');
        if (draftExists) {
          throw new Error(
            'A ROADMAP DRAFT already exists. Lock it before creating a new version. Run: sigma roadmap lock'
          );
        }

        const version = nextMajorVersion(data.roadmap.versions);
        const templatePath = resolveTemplate('ROADMAP-TEMPLATE.md');
        const relPath = path.join('Sigma', 'build', `ROADMAP-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        fs.ensureDirSync(path.dirname(absPath));
        fs.copySync(templatePath, absPath);
        registerRoadmapDraft(data, version, relPath);
        writeProgress(projectRoot, data);
        console.log(`Created: ${relPath}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock active ROADMAP draft (auto-supersedes prior locked ROADMAP)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);

        const draft = data.roadmap.versions.find(v => v.state === 'DRAFT');
        if (!draft) {
          throw new Error('No ROADMAP DRAFT found. Run: sigma roadmap new');
        }

        const version = draft.version;
        lockActiveRoadmap(data);
        writeProgress(projectRoot, data);
        console.log(`ROADMAP ${version} LOCKED.`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('list')
    .description('List all ROADMAP versions')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        console.log('\n=== ROADMAP Versions ===\n');
        if (data.roadmap.versions.length === 0) {
          console.log('None. Run: sigma roadmap new');
        } else {
          console.log('Version    State        Created                    Locked');
          console.log('-'.repeat(75));
          for (const v of data.roadmap.versions) {
            const ver = v.version.padEnd(10);
            const st = v.state.padEnd(12);
            const cr = v.created_at.padEnd(26);
            const lo = v.locked_at ?? '—';
            console.log(`${ver} ${st} ${cr} ${lo}`);
          }
        }
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
