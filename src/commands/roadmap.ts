import { Command } from 'commander';
import path from 'path';
import {
  readProgress,
  writeProgress,
  nextMajorVersion,
  registerRoadmapDraft,
  lockActiveRoadmap,
  assertProgressCanMutate,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';

export function roadmapCommand(): Command {
  const cmd = new Command('roadmap');
  cmd.description('Manage ROADMAP artifact');

  cmd.command('new')
    .description('Create a new ROADMAP draft (requires locked DIR-INTENT)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

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
        const relPath = path.join('Sigma', 'build', `ROADMAP-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        copyTemplateToArtifact('ROADMAP-TEMPLATE.md', absPath);
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
        assertProgressCanMutate(data);

        const draft = data.roadmap.versions.find(v => v.state === 'DRAFT');
        if (!draft) {
          throw new Error('No ROADMAP DRAFT found. Run: sigma roadmap new');
        }

        lockActiveRoadmap(data);
        writeProgress(projectRoot, data);
        console.log(`ROADMAP ${draft.version} LOCKED.`);
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
