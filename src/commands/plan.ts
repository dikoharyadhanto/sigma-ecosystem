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
  assertProgressCanMutate,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { appendAuditFindings, copyTemplateToArtifact } from '../utils/artifacts';
import { renderRoadmapFile, appendRoadmapSectionStub } from '../utils/roadmap';

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

function getActiveRoadmapPath(projectRoot: string, data: ReturnType<typeof readProgress>): string | null {
  const active = data.roadmap.versions.find(v => v.state === 'ACTIVE');
  if (!active) return null;
  return path.join(projectRoot, active.file ?? path.join('Sigma', 'build', `ROADMAP-${active.version}.md`));
}

export function planCommand(): Command {
  const cmd = new Command('plan');
  cmd.description('Manage FMN-PLAN artifact');

  cmd.command('new')
    .description('Create a new FMN-PLAN draft (requires locked DIR-INTENT + ACTIVE ROADMAP). Use --pending to stage a future plan without entering the version queue.')
    .option('--pending', 'Stage as a pending plan (no version assigned; not in lock queue)')
    .action((opts: { pending?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        if (opts.pending) {
          // Pending plan: no gate requirement, no version
          const id = generatePendingId();
          const relPath = path.join('Sigma', 'pending', `FMN-PLAN-${id}.md`);
          const absPath = path.join(projectRoot, relPath);
          fs.ensureDirSync(path.dirname(absPath));
          copyTemplateToArtifact('FMN-PLAN-TEMPLATE.md', absPath);
          registerPendingPlan(data, id, relPath);
          writeProgress(projectRoot, data);
          console.log(`Created: ${relPath} (pending — ID: ${id})`);
          console.log(`Run: sigma plan promote --id ${id}   to assign a version and enter the draft queue`);
          return;
        }

        if (!data.gates.gate_1_open) {
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
        const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
        if (roadmapAbsPath) {
          appendRoadmapSectionStub(roadmapAbsPath, version);
        }
        registerPlanDraft(data, version, relPath, intentVersionRef);
        writeProgress(projectRoot, data);

        // Render after state is written (idempotent re-sync)
        if (roadmapAbsPath) {
          renderRoadmapFile(roadmapAbsPath, data);
        }

        console.log(`Created: ${relPath} (references INTENT ${intentVersionRef})`);
        if (roadmapAbsPath) {
          console.log(`ROADMAP updated: Stage ${version.replace(/^v/, '')} appended + derived sections regenerated`);
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('audit')
    .description('Append AUD advisory findings to active FMN-PLAN (no state change)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        if (!data.plan.active_version) {
          throw new Error('No active FMN-PLAN found. Run: sigma plan new');
        }
        const activeEntry = data.plan.versions.find(v => v.version === data.plan.active_version);
        const relPath = activeEntry?.file ?? path.join('Sigma', 'build', `FMN-PLAN-${data.plan.active_version}.md`);
        const absPath = path.join(projectRoot, relPath);
        if (!fs.existsSync(absPath)) throw new Error(`Active PLAN file not found: ${relPath}`);
        appendAuditFindings(absPath, 'plan', 'audit');
        console.log(`Advisory findings section appended to ${relPath}. Fill in the AUD findings — runtime state unchanged.`);
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
    .description('Supersede a locked FMN-PLAN version')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v1)')
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .action((opts: { v: string; reason: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        supersedePlanVersion(data, opts.v, opts.reason);
        writeProgress(projectRoot, data);
        console.log(`FMN-PLAN ${opts.v} superseded. Reason: ${opts.reason}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('promote')
    .description('Promote a pending plan into the official draft queue with an assigned version')
    .requiredOption('--id <id>', 'Pending plan ID to promote (e.g. a3b9)')
    .action((opts: { id: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        const pending = data.plan.pending.find(p => p.id === opts.id);
        if (!pending) {
          throw new Error(
            `Pending plan ID "${opts.id}" not found.\n` +
            `Run: sigma plan queue   to list pending plans`
          );
        }

        if (!data.gates.gate_1_open) {
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

        // Artifact writes first: rename file + append ROADMAP stub
        fs.ensureDirSync(path.dirname(newAbsPath));
        fs.moveSync(oldAbsPath, newAbsPath);
        const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
        if (roadmapAbsPath) {
          appendRoadmapSectionStub(roadmapAbsPath, newVersion);
        }

        // Write progress last
        promotePendingPlan(data, opts.id, newVersion, newRelPath, lockedIntent.version);
        writeProgress(projectRoot, data);

        // Render after state is written (idempotent)
        if (roadmapAbsPath) {
          renderRoadmapFile(roadmapAbsPath, data);
        }

        console.log(`Promoted: ${pending.file} → ${newRelPath} (${newVersion})`);
        if (roadmapAbsPath) {
          console.log(`ROADMAP updated: Stage ${newVersion.replace(/^v/, '')} appended + derived sections regenerated`);
        }
        console.log(`Run: sigma plan lock   to lock ${newVersion} when ready`);
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
            const title = readPendingTitle(absPath);
            const date = p.created_at.slice(0, 10);
            console.log(`  ${p.id} — ${title}  (created ${date})`);
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
          if (active?.stale_intent) console.log(`Stale Intent:     YES`);
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
            console.log('Version    State        INTENT Ref  Stale  Created');
            console.log('-'.repeat(75));
            for (const v of data.plan.versions) {
              const ver = v.version.padEnd(10);
              const st = v.state.padEnd(12);
              const ir = (v.intent_version_ref ?? '—').padEnd(11);
              const stale = (v.stale_intent ? 'YES' : 'no').padEnd(6);
              console.log(`${ver} ${st} ${ir} ${stale} ${v.created_at}`);
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
