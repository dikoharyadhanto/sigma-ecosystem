import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  nextPlanVersion,
  registerPlanDraft,
  lockOldestPlanDraft,
  supersedePlanVersion,
  activatePlanDraft,
  registerPendingPlan,
  promotePendingPlan,
  updatePlanMetadata,
  assertChainCanMutate,
  getOperationalGate,
} from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { renderRoadmapFile } from '../utils/roadmap';
import {
  ensureSigmaDocEligible,
  printSigmaDocReport,
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

// PLAN-EVAL-01 §3.5 — Gate 1.5 redefined to match the single-object roadmap
// (no more ACTIVE state to search for): a chain's roadmap unblocks `plan
// new` once it exists and hasn't been cascaded to SUPERSEDED.
function getRoadmapPathIfEligible(projectRoot: string, chain: ChainState): string | null {
  if (!chain.roadmap || chain.roadmap.state === 'SUPERSEDED') return null;
  return path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'build', `ROADMAP-${chain.roadmap.version}.md`));
}

function getOldestDraftPlanVersion(chain: ChainState): string | null {
  const drafts = chain.plan.versions
    .filter(v => v.state === 'DRAFT')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return drafts[0]?.version ?? null;
}

function planDocPath(projectRoot: string, chain: ChainState, version?: string): string {
  const entry = version
    ? chain.plan.versions.find(v => v.version === version)
    : chain.plan.versions.find(v => v.version === chain.plan.active_version);
  if (!entry) throw new Error(version ? `FMN-PLAN ${version} not found.` : 'No active FMN-PLAN found. Run: sigma plan new');
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'build', `FMN-PLAN-${entry.version}.md`));
}

export function planCommand(): Command {
  const cmd = new Command('plan');
  cmd.description('Manage FMN-PLAN artifact');

  cmd.command('new')
    .description('Create a new FMN-PLAN draft (requires locked DIR-INTENT + ROADMAP). Use --pending to stage a future plan without entering the version queue.')
    .option('--pending', 'Stage as a pending plan (no version assigned; not in lock queue)')
    .requiredOption('--title <title>', 'Stage title written into the ROADMAP Stage Overview table')
    .requiredOption('--focus <focus>', 'Stage focus summary written into the ROADMAP Stage Overview table')
    .action((opts: { pending?: boolean; title?: string; focus?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);
        assertRequiredStageMetadata(opts.title, opts.focus, 'new');

        if (opts.pending) {
          // Pending plan: no gate requirement, no version
          const id = generatePendingId();
          const relPath = path.join('Sigma', 'pending', `FMN-PLAN-${id}.md`);
          const absPath = path.join(projectRoot, relPath);
          fs.ensureDirSync(path.dirname(absPath));
          copyTemplateToArtifact('FMN-PLAN-TEMPLATE.md', absPath);
          registerPendingPlan(chain, id, relPath, opts.title, opts.focus);
          writeChain(projectRoot, chainVersion, chain);
          console.log(`Created: ${relPath} (pending — ID: ${id})`);
          console.log('Running automatic validation...\n');
          const report = validateSigmaDocFile(absPath, 'plan');
          printSigmaDocReport(report, projectRoot);
          if (!report.ok) process.exit(1);
          console.log(`Run: sigma plan promote --id ${id}   to assign a version and enter the draft queue`);
          return;
        }

        if (!getOperationalGate(chain, 'gate_1_open')) {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        if (chain.intent.state !== 'LOCKED') {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        // Gate 1.5: require a ROADMAP that exists and isn't SUPERSEDED (§3.5)
        const roadmapAbsPathForGate = getRoadmapPathIfEligible(projectRoot, chain);
        if (!roadmapAbsPathForGate) {
          throw new Error(
            'Gate 1.5 blocked: A ROADMAP must exist for this chain before FMN-PLAN can be created.\n' +
            'Run: sigma roadmap new'
          );
        }

        const intentVersionRef = chain.intent.version;
        const version = nextPlanVersion(chain, intentVersionRef);
        const relPath = path.join('Sigma', 'build', `FMN-PLAN-${version}.md`);
        const absPath = path.join(projectRoot, relPath);

        // Artifact writes first, writeChain last
        copyTemplateToArtifact('FMN-PLAN-TEMPLATE.md', absPath);
        registerPlanDraft(chain, version, relPath, intentVersionRef, opts.title, opts.focus);
        writeChain(projectRoot, chainVersion, chain);

        // Render after state is written (idempotent re-sync)
        renderRoadmapFile(roadmapAbsPathForGate, chain);

        console.log(`Created: ${relPath} (references INTENT ${intentVersionRef})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
        console.log(`ROADMAP updated: Stage Overview regenerated with Stage ${version.replace(/^v/, '')}`);
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
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);
        const lockTargetVersion = getOldestDraftPlanVersion(chain);
        if (!lockTargetVersion) {
          throw new Error('No DRAFT FMN-PLAN to lock. Run: sigma plan new');
        }
        const absPath = planDocPath(projectRoot, chain, lockTargetVersion);
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'plan');
        const version = lockOldestPlanDraft(chain);
        writeChain(projectRoot, chainVersion, chain);
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
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);
        activatePlanDraft(chain, opts.v);
        writeChain(projectRoot, chainVersion, chain);
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
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);

        const cascadedExecs = chain.exec.versions
          .filter(v => v.plan_version_ref === opts.v && v.state !== 'SUPERSEDED')
          .map(v => v.version);

        supersedePlanVersion(chain, opts.v, opts.reason);
        writeChain(projectRoot, chainVersion, chain);

        console.log(`FMN-PLAN ${opts.v} superseded. Reason: ${opts.reason}`);
        if (cascadedExecs.length > 0) {
          console.log(`Auto-superseded DEV-EXEC: ${cascadedExecs.join(', ')}`);
        }

        if (chain.roadmap) {
          const roadmapPath = path.join(
            projectRoot,
            chain.roadmap.file ?? path.join('Sigma', 'build', `ROADMAP-${chain.roadmap.version}.md`),
          );
          if (fs.existsSync(roadmapPath)) {
            renderRoadmapFile(roadmapPath, chain);
            console.log(`ROADMAP ${chain.roadmap.version} re-rendered with SUPERSEDED status.`);
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
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);
        assertRequiredStageMetadata(opts.title, opts.focus, 'promote');

        const pending = chain.plan.pending.find(p => p.id === opts.id);
        if (!pending) {
          throw new Error(
            `Pending plan ID "${opts.id}" not found.\n` +
            `Run: sigma plan queue   to list pending plans`
          );
        }

        if (!getOperationalGate(chain, 'gate_1_open') || chain.intent.state !== 'LOCKED') {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }

        const roadmapAbsPathForGate = getRoadmapPathIfEligible(projectRoot, chain);
        if (!roadmapAbsPathForGate) {
          throw new Error(
            'Gate 1.5 blocked: A ROADMAP must exist for this chain to promote a plan.\n' +
            'Run: sigma roadmap new'
          );
        }

        // Compute next version before any writes
        const newVersion = nextPlanVersion(chain, chain.intent.version);
        const oldAbsPath = path.join(projectRoot, pending.file);
        const newRelPath = path.join('Sigma', 'build', `FMN-PLAN-${newVersion}.md`);
        const newAbsPath = path.join(projectRoot, newRelPath);

        // Artifact writes first: rename file
        fs.ensureDirSync(path.dirname(newAbsPath));
        fs.moveSync(oldAbsPath, newAbsPath);

        // Write chain last
        promotePendingPlan(chain, opts.id, newVersion, newRelPath, chain.intent.version, opts.title, opts.focus);
        writeChain(projectRoot, chainVersion, chain);

        // Render after state is written (idempotent)
        renderRoadmapFile(roadmapAbsPathForGate, chain);

        console.log(`Promoted: ${pending.file} → ${newRelPath} (${newVersion})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(newAbsPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
        console.log(`ROADMAP updated: Stage Overview regenerated with Stage ${newVersion.replace(/^v/, '')}`);
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
        const { data: chain } = readActiveChain(projectRoot);
        const absPath = planDocPath(projectRoot, chain, opts.v);
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
        const { data: chain } = readActiveChain(projectRoot);

        const drafts = chain.plan.versions
          .filter(v => v.state === 'DRAFT')
          .sort((a, b) => a.created_at.localeCompare(b.created_at));

        const pending = chain.plan.pending;

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
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== FMN-PLAN Status ===\n');
        if (!chain.plan.active_version) {
          console.log('No active PLAN. Run: sigma plan new');
        } else {
          const active = chain.plan.versions.find(v => v.version === chain.plan.active_version);
          console.log(`Version:          ${chain.plan.active_version}`);
          console.log(`State:            ${chain.plan.active_state}`);
          if (active?.intent_version_ref) console.log(`INTENT Ref:       ${active.intent_version_ref}`);
          if (active?.locked_at) console.log(`Locked at:        ${active.locked_at}`);
          if (active?.file) console.log(`File:             ${active.file}`);
        }
        const drafts = chain.plan.versions.filter(v => v.state === 'DRAFT');
        if (drafts.length > 1) {
          console.log(`\nDraft queue:      ${drafts.length} drafts (run: sigma plan queue)`);
        }
        if (chain.plan.pending.length > 0) {
          console.log(`Pending plans:    ${chain.plan.pending.length} (run: sigma plan queue)`);
        }
        console.log(`\nGate 2:           ${chain.gates.gate_2_open ? 'OPEN' : 'BLOCKED'}`);
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
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);

        const planEntry = chain.plan.versions.find(v => v.version === opts.v);
        if (!planEntry) {
          throw new Error(`FMN-PLAN ${opts.v} not found. Run: sigma plan list`);
        }

        if (!chain.roadmap) {
          throw new Error('No ROADMAP found for this chain. Run: sigma roadmap new');
        }
        const roadmapAbsPath = path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'build', `ROADMAP-${chain.roadmap.version}.md`));

        updatePlanMetadata(chain, opts.v, opts.title, opts.focus);
        writeChain(projectRoot, chainVersion, chain);

        renderRoadmapFile(roadmapAbsPath, chain);

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
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== FMN-PLAN Versions ===\n');
        if (chain.plan.versions.length === 0 && chain.plan.pending.length === 0) {
          console.log('None. Run: sigma plan new');
        } else {
          if (chain.plan.versions.length > 0) {
            console.log('Version    State        INTENT Ref  Created');
            console.log('-'.repeat(75));
            for (const v of chain.plan.versions) {
              const ver = v.version.padEnd(10);
              const st = v.state.padEnd(12);
              const ir = (v.intent_version_ref ?? '—').padEnd(11);
              console.log(`${ver} ${st} ${ir} ${v.created_at}`);
            }
          }
          if (chain.plan.pending.length > 0) {
            console.log('\nPending Plans (ID / file / created):');
            for (const p of chain.plan.pending) {
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
