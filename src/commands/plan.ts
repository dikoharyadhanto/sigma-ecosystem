import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  nextPlanVersion,
  registerPlanDraft,
  lockOldestPlanDraft,
  supersedePlanVersion,
  activatePlanDraft,
  registerPendingPlan,
  promotePendingPlan,
  updatePlanMetadata,
  assertProgressCanMutate,
  getOperationalGate,
  isGateInvalid,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { renderRoadmapFile } from '../utils/roadmap';
import {
  ensureSigmaDocEligible,
  printSigmaDocReport,
  resolveSigmaDocPath,
  validateSigmaDocFile,
} from '../utils/docCheck';

function generatePendingId(): string {
  return Math.random().toString(36).slice(2, 6).toLowerCase();
}

function readPendingTitle(absPath: string): string {
  if (!fs.existsSync(absPath)) return '(no file)';
  try {
    const firstLine = fs.readFileSync(absPath, 'utf8').split('\n')[0] ?? '';
    return firstLine.startsWith('# ') ? firstLine.slice(2).trim() : absPath;
  } catch {
    return absPath;
  }
}

function assertRequiredStageMetadata(title: string | undefined, focus: string | undefined, command: 'new' | 'promote'): void {
  if (!title?.trim()) {
    throw new Error(`sigma plan ${command} requires --title <title>`);
  }
  if (!focus?.trim()) {
    throw new Error(`sigma plan ${command} requires --focus <focus>`);
  }
}

function getActiveRoadmapPath(projectRoot: string, data: ReturnType<typeof readProgress>): string | null {
  const active = data.roadmap.versions.find(v => v.state === 'ACTIVE');
  if (!active) return null;
  return path.join(projectRoot, active.file ?? path.join('Sigma', 'build', `ROADMAP-${active.version}.md`));
}

function getOldestDraftPlanVersion(data: ReturnType<typeof readProgress>): string | null {
  const drafts = data.plan.versions
    .filter(v => v.state === 'DRAFT')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return drafts[0]?.version ?? null;
}

export function planCommand(): Command {
  const cmd = new Command('plan');
  cmd.description('Manage FMN-PLAN artifact');

  cmd.command('new')
    .description('Create a new FMN-PLAN draft (requires locked DIR-INTENT + ACTIVE ROADMAP). Use --pending to stage a future plan without entering the version queue.')
    .option('--pending', 'Stage as a pending plan (no version assigned; not in lock queue)')
    .requiredOption('--title <title>', 'Stage title written into the ROADMAP Stage Overview table')
    .requiredOption('--focus <focus>', 'Stage focus summary written into the ROADMAP Stage Overview table')
    .action((opts: { pending?: boolean; title?: string; focus?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        assertRequiredStageMetadata(opts.title, opts.focus, 'new');

        if (opts.pending) {
          // Pending plan: no gate requirement, no version
          const id = generatePendingId();
          const relPath = path.join('Sigma', 'pending', `FMN-PLAN-${id}.md`);
          const absPath = path.join(projectRoot, relPath);
          fs.ensureDirSync(path.dirname(absPath));
          copyTemplateToArtifact('FMN-PLAN-TEMPLATE.md', absPath);
          registerPendingPlan(data, id, relPath, opts.title, opts.focus);
          writeProgress(projectRoot, data);
          console.log(`Created: ${relPath} (pending — ID: ${id})`);
          console.log('Running automatic validation...\n');
          const report = validateSigmaDocFile(absPath, 'plan');
          printSigmaDocReport(report, projectRoot);
          if (!report.ok) process.exit(1);
          console.log(`Run: sigma plan promote --id ${id}   to assign a version and enter the draft queue`);
          return;
        }

        if (!getOperationalGate(data, 'gate_1_open')) {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
        if (!lockedIntent) {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        // Gate 1.5: require ACTIVE ROADMAP
        const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
        if (!activeRoadmap) {
          throw new Error(
            'Gate 1.5 blocked: An ACTIVE ROADMAP must exist before FMN-PLAN can be created.\n' +
            'Run: sigma roadmap new\n' +
            'If another ROADMAP is already ACTIVE, create the new one as DRAFT then run:\n' +
            '  sigma roadmap activate --v <ver>'
          );
        }

        const intentVersionRef = lockedIntent.version;
        const version = nextPlanVersion(data, intentVersionRef);
        const relPath = path.join('Sigma', 'build', `FMN-PLAN-${version}.md`);
        const absPath = path.join(projectRoot, relPath);

        // Artifact writes first, writeProgress last
        copyTemplateToArtifact('FMN-PLAN-TEMPLATE.md', absPath);
        registerPlanDraft(data, version, relPath, intentVersionRef, opts.title, opts.focus);
        writeProgress(projectRoot, data);

        // Render after state is written (idempotent re-sync)
        const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
        if (roadmapAbsPath) {
          renderRoadmapFile(roadmapAbsPath, data);
        }

        console.log(`Created: ${relPath} (references INTENT ${intentVersionRef})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
        if (roadmapAbsPath) {
          console.log(`ROADMAP updated: Stage Overview regenerated with Stage ${version.replace(/^v/, '')}`);
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock oldest DRAFT FMN-PLAN in FIFO order (opens Gate 2)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        const lockTargetVersion = getOldestDraftPlanVersion(data);
        if (!lockTargetVersion) {
          throw new Error('No DRAFT FMN-PLAN to lock. Run: sigma plan new');
        }
        const absPath = resolveSigmaDocPath(projectRoot, data, 'plan', lockTargetVersion);
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'plan');
        const version = lockOldestPlanDraft(data);
        writeProgress(projectRoot, data);
        console.log(`FMN-PLAN ${version} LOCKED. Gate 2 open. Next: sigma exec new`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('activate')
    .description('Set an existing DRAFT FMN-PLAN version as the active plan (for display/status only; lock order remains FIFO)')
    .requiredOption('--v <version>', 'DRAFT version to activate (e.g. v1.10)')
    .action((opts: { v: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        activatePlanDraft(data, opts.v);
        writeProgress(projectRoot, data);
        console.log(`FMN-PLAN ${opts.v} set as active draft (lock order remains FIFO — sigma plan lock will lock the oldest DRAFT).`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('supersede')
    .description('Supersede a locked FMN-PLAN version (auto-supersedes all linked DEV-EXEC versions)')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v1)')
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .action((opts: { v: string; reason: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        const cascadedExecs = data.exec.versions
          .filter(v => v.plan_version_ref === opts.v && v.state !== 'SUPERSEDED')
          .map(v => v.version);

        supersedePlanVersion(data, opts.v, opts.reason);
        writeProgress(projectRoot, data);

        console.log(`FMN-PLAN ${opts.v} superseded. Reason: ${opts.reason}`);
        if (cascadedExecs.length > 0) {
          console.log(`Auto-superseded DEV-EXEC: ${cascadedExecs.join(', ')}`);
        }

        const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
        if (activeRoadmap) {
          const roadmapPath = path.join(
            projectRoot,
            activeRoadmap.file ?? path.join('Sigma', 'build', `ROADMAP-${activeRoadmap.version}.md`),
          );
          if (fs.existsSync(roadmapPath)) {
            renderRoadmapFile(roadmapPath, data);
            console.log(`ROADMAP ${activeRoadmap.version} re-rendered with SUPERSEDED status.`);
          }
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('promote')
    .description('Promote a pending plan into the official draft queue with an assigned version')
    .requiredOption('--id <id>', 'Pending plan ID to promote (e.g. a3b9)')
    .requiredOption('--title <title>', 'Stage title written into the ROADMAP Stage Overview table')
    .requiredOption('--focus <focus>', 'Stage focus summary written into the ROADMAP Stage Overview table')
    .action((opts: { id: string; title?: string; focus?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        assertRequiredStageMetadata(opts.title, opts.focus, 'promote');

        const pending = data.plan.pending.find(p => p.id === opts.id);
        if (!pending) {
          throw new Error(
            `Pending plan ID "${opts.id}" not found.\n` +
            `Run: sigma plan queue   to list pending plans`
          );
        }

        if (!getOperationalGate(data, 'gate_1_open')) {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
        if (!lockedIntent) throw new Error('No locked DIR-INTENT found');

        const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
        if (!activeRoadmap) {
          throw new Error(
            'Gate 1.5 blocked: An ACTIVE ROADMAP must exist to promote a plan.\n' +
            'Run: sigma roadmap new'
          );
        }

        // Compute next version before any writes
        const newVersion = nextPlanVersion(data, lockedIntent.version);
        const oldAbsPath = path.join(projectRoot, pending.file);
        const newRelPath = path.join('Sigma', 'build', `FMN-PLAN-${newVersion}.md`);
        const newAbsPath = path.join(projectRoot, newRelPath);

        // Artifact writes first: rename file
        fs.ensureDirSync(path.dirname(newAbsPath));
        fs.moveSync(oldAbsPath, newAbsPath);

        // Write progress last
        promotePendingPlan(data, opts.id, newVersion, newRelPath, lockedIntent.version, opts.title, opts.focus);
        writeProgress(projectRoot, data);

        // Render after state is written (idempotent)
        const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
        if (roadmapAbsPath) {
          renderRoadmapFile(roadmapAbsPath, data);
        }

        console.log(`Promoted: ${pending.file} → ${newRelPath} (${newVersion})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(newAbsPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
        if (roadmapAbsPath) {
          console.log(`ROADMAP updated: Stage Overview regenerated with Stage ${newVersion.replace(/^v/, '')}`);
        }
        console.log(`Run: sigma plan lock   to lock ${newVersion} when ready`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate an FMN-PLAN structure and markers')
    .option('--v <version>', 'Check a specific FMN-PLAN version instead of the active one')
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        const absPath = resolveSigmaDocPath(projectRoot, data, 'plan', opts.v);
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('queue')
    .description('Show the FIFO draft lock queue and pending plans (read-only diagnostic)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);

        const drafts = data.plan.versions
          .filter(v => v.state === 'DRAFT')
          .sort((a, b) => a.created_at.localeCompare(b.created_at));

        const pending = data.plan.pending;

        console.log('\n=== FMN-PLAN Queue ===\n');

        if (drafts.length === 0) {
          console.log('Official Draft Queue: empty');
        } else {
          console.log('Official Draft Queue (FIFO — oldest locks first):');
          drafts.forEach((d, i) => {
            const date = d.created_at.slice(0, 10);
            console.log(`  ${i + 1}. FMN-PLAN ${d.version}  DRAFT  (created ${date})`);
          });
          console.log(`\nNext lock target: FMN-PLAN ${drafts[0].version}`);
        }

        console.log('');

        if (pending.length === 0) {
          console.log('Pending Plans: none');
        } else {
          console.log('Pending Plans (not in lock queue):');
          for (const p of pending) {
            const absPath = path.join(projectRoot, p.file);
            const title = p.title ?? readPendingTitle(absPath);
            const focus = p.focus ?? '(no focus)';
            const date = p.created_at.slice(0, 10);
            console.log(`  ${p.id} — ${title}  [${focus}]  (created ${date})`);
          }
        }

        console.log('');
        if (pending.length > 0) {
          console.log(`Run: sigma plan promote --id ${pending[0].id}    to promote a pending plan to the draft queue`);
        }
        if (drafts.length > 0) {
          console.log('Run: sigma plan lock                  to lock the oldest draft');
        }
        if (pending.length === 0 && drafts.length === 0) {
          console.log('No plans in queue. Run: sigma plan new');
        }
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show active FMN-PLAN status')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        console.log('\n=== FMN-PLAN Status ===\n');
        if (!data.plan.active_version) {
          console.log('No active PLAN. Run: sigma plan new');
        } else {
          const active = data.plan.versions.find(v => v.version === data.plan.active_version);
          console.log(`Version:          ${data.plan.active_version}`);
          console.log(`State:            ${data.plan.active_state}`);
          if (active?.intent_version_ref) console.log(`INTENT Ref:       ${active.intent_version_ref}`);
          if (active?.locked_at) console.log(`Locked at:        ${active.locked_at}`);
          if (active?.file) console.log(`File:             ${active.file}`);
        }
        const drafts = data.plan.versions.filter(v => v.state === 'DRAFT');
        if (drafts.length > 1) {
          console.log(`\nDraft queue:      ${drafts.length} drafts (run: sigma plan queue)`);
        }
        if (data.plan.pending.length > 0) {
          console.log(`Pending plans:    ${data.plan.pending.length} (run: sigma plan queue)`);
        }
        console.log(`\nGate 2:           ${data.gates.gate_2_open ? 'OPEN' : 'BLOCKED'}`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('update')
    .description('Update title and/or focus for an existing FMN-PLAN stage in the active ROADMAP')
    .requiredOption('--v <version>', 'Plan version to update (e.g. v1.15)')
    .option('--title <title>', 'New stage title')
    .option('--focus <focus>', 'New stage focus summary')
    .action((opts: { v: string; title?: string; focus?: string }) => {
      try {
        if (!opts.title && !opts.focus) {
          throw new Error('Provide at least one of --title or --focus');
        }

        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        const planEntry = data.plan.versions.find(v => v.version === opts.v);
        if (!planEntry) {
          throw new Error(`FMN-PLAN ${opts.v} not found. Run: sigma plan list`);
        }

        const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
        if (!roadmapAbsPath) {
          throw new Error('No ACTIVE ROADMAP found. Run: sigma roadmap new');
        }

        updatePlanMetadata(data, opts.v, opts.title, opts.focus);
        writeProgress(projectRoot, data);

        renderRoadmapFile(roadmapAbsPath, data);

        const parts: string[] = [];
        if (opts.title) parts.push(`title → "${opts.title}"`);
        if (opts.focus) parts.push(`focus → "${opts.focus}"`);
        console.log(`FMN-PLAN ${opts.v}: ${parts.join(', ')}`);
        console.log(`ROADMAP updated: Stage Overview regenerated`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('list')
    .description('List all FMN-PLAN versions')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        console.log('\n=== FMN-PLAN Versions ===\n');
        if (data.plan.versions.length === 0 && data.plan.pending.length === 0) {
          console.log('None. Run: sigma plan new');
        } else {
          if (data.plan.versions.length > 0) {
            console.log('Version    State        INTENT Ref  Created');
            console.log('-'.repeat(75));
            for (const v of data.plan.versions) {
              const ver = v.version.padEnd(10);
              const st = v.state.padEnd(12);
              const ir = (v.intent_version_ref ?? '—').padEnd(11);
              console.log(`${ver} ${st} ${ir} ${v.created_at}`);
            }
          }
          if (data.plan.pending.length > 0) {
            console.log('\nPending Plans (ID / file / created):');
            for (const p of data.plan.pending) {
              console.log(`  ${p.id}  ${p.file}  ${p.created_at}`);
            }
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
