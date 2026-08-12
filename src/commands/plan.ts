import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  nextPlanVersion,
  registerPlanDraft,
  lockPlanVersion,
  resolveTargetVersion,
  supersedePlanVersion,
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

function planDocPath(projectRoot: string, chain: ChainState, version?: string): string {
  const entry = version
    ? chain.plan.versions.find(v => v.version === version)
    : chain.plan.versions.find(v => v.version === chain.plan.active_version);
  if (!entry) throw new Error(version ? `FMN-PLAN ${version} not found.` : 'No active FMN-PLAN found. Run: sigma plan new');
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'build', `FMN-PLAN-${entry.version}.md`));
}

// PLAN-IMPL-MULTIDRAFT-LOCK §8.3 (Director directive 2026-08-12) — no
// command may act on an implicit target when ambiguity exists. `check`
// still defaults to the active pointer when unambiguous (0 or 1 open
// DRAFT), but must refuse and list candidates once more than one DRAFT is
// open, exactly like `lock`.
function assertPlanCheckUnambiguous(chain: ChainState, explicit: string | undefined): void {
  if (explicit) return;
  const resolution = resolveTargetVersion(chain.plan.versions, undefined);
  if (resolution.kind === 'ambiguous') {
    throw new Error(
      `${resolution.candidates.length} DRAFT FMN-PLANs are open: ${resolution.candidates.join(', ')}\n` +
      `Specify which one to check: sigma plan check --v ${resolution.candidates[0]}`
    );
  }
}

export function planCommand(): Command {
  const cmd = new Command('plan');
  cmd.description('Manage FMN-PLAN artifact');

  cmd.command('new')
    .description('Create a new FMN-PLAN draft (requires ratified DIR-INTENT + ROADMAP). Use --pending to stage a future plan without entering the version queue.')
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
          throw new Error('GATE 1 BLOCKED: No ratified DIR-INTENT. Run: sigma intent ratify');
        }
        if (chain.intent.state !== 'RATIFIED') {
          throw new Error('GATE 1 BLOCKED: No ratified DIR-INTENT. Run: sigma intent ratify');
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
    .description('Lock a DRAFT FMN-PLAN (opens Gate 2). Requires --v when more than one DRAFT is open.')
    .option('--v <version>', 'DRAFT version to lock (required when more than one DRAFT is open)')
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);

        const resolution = resolveTargetVersion(chain.plan.versions, opts.v);
        if (resolution.kind === 'empty') {
          throw new Error('No DRAFT FMN-PLAN to lock. Run: sigma plan new');
        }
        if (resolution.kind === 'ambiguous') {
          throw new Error(
            `${resolution.candidates.length} DRAFT FMN-PLANs are open: ${resolution.candidates.join(', ')}\n` +
            `Specify which one to lock: sigma plan lock --v ${resolution.candidates[0]}\n` +
            'Draft plans are no longer locked in creation order — selection is explicit.'
          );
        }
        const lockTargetVersion = resolution.version;

        const absPath = planDocPath(projectRoot, chain, lockTargetVersion);
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'plan');
        const version = lockPlanVersion(chain, lockTargetVersion);
        writeChain(projectRoot, chainVersion, chain);
        console.log(`FMN-PLAN ${version} LOCKED. Gate 2 open. Next: sigma exec new`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('supersede')
    .description('Supersede an FMN-PLAN version, DRAFT or LOCKED (auto-supersedes any linked non-final DEV-EXEC)')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v1.2)')
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
            `Run: sigma plan status   to list pending plans`
          );
        }

        if (!getOperationalGate(chain, 'gate_1_open') || chain.intent.state !== 'RATIFIED') {
          throw new Error('GATE 1 BLOCKED: No ratified DIR-INTENT. Run: sigma intent ratify');
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
        console.log(`Run: sigma plan lock --v ${newVersion}   to lock it when ready`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate an FMN-PLAN structure and markers')
    .option('--v <version>', 'Check a specific FMN-PLAN version. Required when more than one DRAFT is open.')
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        assertPlanCheckUnambiguous(chain, opts.v);
        const absPath = planDocPath(projectRoot, chain, opts.v);
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show FMN-PLAN chain state: open DRAFTs, LOCKED plans with exec pairing, pending plans, Gate 2')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== FMN-PLAN Status ===\n');

        const drafts = chain.plan.versions
          .filter(v => v.state === 'DRAFT')
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const locked = chain.plan.versions
          .filter(v => v.state === 'LOCKED')
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const supersededCount = chain.plan.versions.filter(v => v.state === 'SUPERSEDED').length;

        if (drafts.length === 0) {
          console.log('DRAFT: none');
        } else {
          console.log(`DRAFT (${drafts.length}):`);
          for (const d of drafts) {
            console.log(`  ${d.version}  ${d.title ?? '(no title)'}  (created ${d.created_at.slice(0, 10)})`);
          }
        }

        console.log('');
        if (locked.length === 0) {
          console.log('LOCKED: none');
        } else {
          console.log(`LOCKED (${locked.length}):`);
          for (const p of locked) {
            const lockedExec = chain.exec.versions.find(e => e.plan_version_ref === p.version && e.state === 'LOCKED');
            const openExec = chain.exec.versions.find(e => e.plan_version_ref === p.version && e.state !== 'LOCKED' && e.state !== 'SUPERSEDED');
            const pairing = lockedExec
              ? `paired with DEV-EXEC ${lockedExec.version} (LOCKED)`
              : openExec
                ? `DEV-EXEC ${openExec.version} (${openExec.state}) — not yet locked`
                : 'no DEV-EXEC yet';
            console.log(`  ${p.version}  ${p.title ?? '(no title)'}  — ${pairing}`);
          }
        }

        console.log('');
        if (chain.plan.pending.length === 0) {
          console.log('Pending: none');
        } else {
          console.log(`Pending (${chain.plan.pending.length}):`);
          for (const p of chain.plan.pending) {
            const absPath = path.join(projectRoot, p.file);
            const title = p.title ?? readPendingTitle(absPath);
            const focus = p.focus ?? '(no focus)';
            console.log(`  ${p.id}  ${title}  [${focus}]  (created ${p.created_at.slice(0, 10)})`);
          }
          console.log(`Run: sigma plan promote --id ${chain.plan.pending[0].id}   to promote a pending plan`);
        }

        console.log(`\nGate 2: ${chain.gates.gate_2_open ? 'OPEN' : 'BLOCKED'}`);
        if (supersededCount > 0) {
          console.log(`(${supersededCount} SUPERSEDED plan(s) not shown above — run: sigma plan list)`);
        }
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
