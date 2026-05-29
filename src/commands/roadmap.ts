import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import {
  readProgress,
  writeProgress,
  registerRoadmapDraft,
  activateRoadmap,
  assertProgressCanMutate,
  ProgressJson,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import {
  parseStages,
  renderRoadmapFile,
  appendRoadmapSectionStub,
  STAGE_STUB_TEMPLATE,
} from '../utils/roadmap';

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseMajorFromVersion(version: string): number {
  const match = version.match(/^v(\d+)/);
  if (!match) throw new Error(`Cannot parse major version from "${version}"`);
  return parseInt(match[1], 10);
}

function getActiveRoadmapEntry(data: ProgressJson) {
  return data.roadmap.versions.find(v => v.state === 'ACTIVE') ?? null;
}

function getRoadmapFilePath(data: ProgressJson, projectRoot: string, version: string): string {
  const entry = data.roadmap.versions.find(v => v.version === version);
  return path.join(projectRoot, entry?.file ?? path.join('Sigma', 'build', `ROADMAP-${version}.md`));
}

function promptApprove(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message}\nType APPROVE to continue: `, answer => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'APPROVE');
    });
  });
}

// ── Command ───────────────────────────────────────────────────────────────────

export function roadmapCommand(): Command {
  const cmd = new Command('roadmap');
  cmd.description('Manage ROADMAP artifact');

  // ── roadmap new ─────────────────────────────────────────────────────────────

  cmd.command('new')
    .description('Create a new ROADMAP (requires locked DIR-INTENT; auto-activates if no ACTIVE exists)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        if (data.intent.active_state !== 'LOCKED') {
          throw new Error('ROADMAP requires a locked DIR-INTENT. Run: sigma intent lock');
        }

        const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
        if (!lockedIntent) throw new Error('No locked DIR-INTENT found');

        const intentMajor = parseMajorFromVersion(lockedIntent.version);
        const version = `v${intentMajor}`;

        const hasActive = data.roadmap.versions.some(v => v.state === 'ACTIVE');
        const relPath = path.join('Sigma', 'build', `ROADMAP-${version}.md`);
        const absPath = path.join(projectRoot, relPath);

        copyTemplateToArtifact('ROADMAP-TEMPLATE.md', absPath);
        registerRoadmapDraft(data, version, relPath, lockedIntent.version);
        writeProgress(projectRoot, data);

        if (hasActive) {
          console.log(`Created: ${relPath} (DRAFT — existing ACTIVE roadmap still in effect)`);
          console.log(`Run: sigma roadmap activate --v ${version}  to activate and demote current ACTIVE to INACTIVE`);
        } else {
          console.log(`Created: ${relPath} (ACTIVE — plan new is now unblocked)`);
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  // ── roadmap activate ─────────────────────────────────────────────────────────

  cmd.command('activate')
    .description('Activate a DRAFT ROADMAP (demotes current ACTIVE to INACTIVE if one exists)')
    .requiredOption('--v <version>', 'ROADMAP version to activate (e.g. v2)')
    .option('--yes', 'Skip interactive APPROVE prompt')
    .action(async (opts: { v: string; yes?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        const target = data.roadmap.versions.find(v => v.version === opts.v);
        if (!target) {
          throw new Error(`ROADMAP ${opts.v} not found. Run: sigma roadmap list`);
        }
        if (target.state !== 'DRAFT') {
          throw new Error(`ROADMAP ${opts.v} is in state "${target.state}"; activate requires a DRAFT version`);
        }

        const currentActive = getActiveRoadmapEntry(data);

        if (currentActive) {
          console.log('\nRoadmap Activation Preflight\n');
          console.log(`New active roadmap:   ROADMAP ${opts.v}`);
          console.log(`Currently active:     ROADMAP ${currentActive.version}`);
          console.log('\nEffect:');
          console.log(`  ROADMAP ${currentActive.version} will become INACTIVE.`);
          console.log(`  ROADMAP ${opts.v} will become ACTIVE.`);
          console.log(`  New FMN-PLAN artifacts will link to ROADMAP ${opts.v}.\n`);

          if (!opts.yes) {
            const approved = await promptApprove('');
            if (!approved) {
              console.log('Activation cancelled.');
              process.exit(0);
            }
          }
        }

        activateRoadmap(data, opts.v);
        writeProgress(projectRoot, data);

        if (currentActive) {
          console.log(`ROADMAP ${currentActive.version} → INACTIVE`);
        }
        console.log(`ROADMAP ${opts.v} → ACTIVE`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  // ── roadmap render ───────────────────────────────────────────────────────────

  cmd.command('render')
    .description('Regenerate derived sections (Stage Overview, Phase Dependencies, PLAN Breakdown) in the ACTIVE ROADMAP')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);

        const active = getActiveRoadmapEntry(data);
        if (!active) {
          throw new Error('No ACTIVE ROADMAP found. Run: sigma roadmap new');
        }

        const roadmapPath = getRoadmapFilePath(data, projectRoot, active.version);
        renderRoadmapFile(roadmapPath, data);
        console.log(`ROADMAP ${active.version} derived sections regenerated: ${active.file ?? roadmapPath}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  // ── roadmap reconcile ────────────────────────────────────────────────────────

  cmd.command('reconcile')
    .description('Check consistency between progress.json plan entries and ROADMAP H2 stage sections')
    .option('--check', 'Read-only consistency check (default)')
    .option('--fix', 'Append stub H2 sections for plans missing from ROADMAP')
    .action((opts: { check?: boolean; fix?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);

        const active = getActiveRoadmapEntry(data);
        if (!active) {
          throw new Error('No ACTIVE ROADMAP found. Run: sigma roadmap new');
        }

        const roadmapPath = getRoadmapFilePath(data, projectRoot, active.version);
        if (!fs.existsSync(roadmapPath)) {
          throw new Error(`ROADMAP file not found: ${roadmapPath}`);
        }

        const content = fs.readFileSync(roadmapPath, 'utf8');
        const roadmapStages = parseStages(content);
        const roadmapVersionSet = new Set(roadmapStages.map(s => `v${s.version}`));

        const planVersions = data.plan.versions.filter(v => v.state !== 'SUPERSEDED');
        const planVersionSet = new Set(planVersions.map(v => v.version));

        let mismatches = 0;
        const missingInRoadmap: string[] = [];

        console.log('\n=== sigma roadmap reconcile ===\n');
        console.log(`Checking progress.json → ROADMAP ${active.version} document...`);
        for (const plan of planVersions) {
          const stageVersion = plan.version.replace(/^v/, '');
          const found = roadmapVersionSet.has(plan.version);
          const mark = found ? '✓' : '✗';
          const note = found
            ? `Stage ${stageVersion} found in ROADMAP`
            : `Stage ${stageVersion} NOT found in ROADMAP`;
          console.log(`  FMN-PLAN ${plan.version}  ${mark}  ${note}`);
          if (!found) {
            mismatches++;
            missingInRoadmap.push(plan.version);
          }
        }

        console.log(`\nChecking ROADMAP ${active.version} document → progress.json...`);
        for (const stage of roadmapStages) {
          const planVer = `v${stage.version}`;
          const found = planVersionSet.has(planVer);
          const mark = found ? '✓' : '✗';
          const note = found
            ? `FMN-PLAN ${planVer} registered`
            : `FMN-PLAN ${planVer} NOT registered in progress.json`;
          console.log(`  Stage ${stage.version}  ${mark}  ${note}`);
          if (!found) mismatches++;
        }

        console.log('');
        if (mismatches === 0) {
          console.log('Result: All entries consistent. No mismatches found.');
        } else {
          console.log(`Result: ${mismatches} mismatch(es) found.`);
          if (!opts.fix) {
            console.log('  Run sigma roadmap reconcile --fix to append missing stage stubs,');
            console.log('  or manually add missing H2 headings to the ROADMAP file.');
          }
        }
        console.log('');

        // --fix: append stub sections for plans missing from ROADMAP
        if (opts.fix && missingInRoadmap.length > 0) {
          console.log(`Applying --fix: appending ${missingInRoadmap.length} missing stage stub(s)...`);
          for (const planVer of missingInRoadmap) {
            appendRoadmapSectionStub(roadmapPath, planVer);
            console.log(`  Appended: Stage ${planVer.replace(/^v/, '')} stub`);
          }
          renderRoadmapFile(roadmapPath, data);
          console.log('ROADMAP derived sections regenerated.');
          console.log('');
          // Re-check to confirm fix succeeded
          const fixedContent = fs.readFileSync(roadmapPath, 'utf8');
          const fixedStages = parseStages(fixedContent);
          const fixedSet = new Set(fixedStages.map(s => `v${s.version}`));
          const stillMissing = missingInRoadmap.filter(v => !fixedSet.has(v));
          if (stillMissing.length > 0) {
            console.log(`Warning: ${stillMissing.length} stage(s) still missing after fix: ${stillMissing.join(', ')}`);
            process.exit(1);
          } else {
            console.log('Fix applied successfully. All stages now consistent.');
          }
        } else if (mismatches > 0) {
          process.exit(1);
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  // ── roadmap list ─────────────────────────────────────────────────────────────

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
          console.log('Version    State        Intent Ref   Created                    Locked');
          console.log('-'.repeat(85));
          for (const v of data.roadmap.versions) {
            const ver = v.version.padEnd(10);
            const st = v.state.padEnd(12);
            const iref = (v.intent_version_ref ?? '—').padEnd(12);
            const cr = v.created_at.padEnd(26);
            const lo = v.locked_at ?? '—';
            console.log(`${ver} ${st} ${iref} ${cr} ${lo}`);
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
