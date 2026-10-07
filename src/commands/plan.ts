import { lifecycleView, effectiveLifecycleGates } from '../engine/lifecycleView';
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  resolveTargetVersion,
  registerPendingPlan,
  updatePlanMetadata,
  assertChainCanMutate,
  normalizeVersionArg,
} from '../engine/chain';
import { findProjectRoot, toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { renderRoadmapFile } from '../utils/roadmap';
import {
  printSigmaDocReport,
  validateSigmaDocFile,
} from '../utils/docCheck';
import { createPlanDraft, PlanDraftError } from '../services/planDraftService';
import { registerApprovalCommands } from './approval';
import { supersedePlanUseCase } from '../services/planSupersedeService';
import { promotePlanUseCase } from '../services/planPromoteService';

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

function planDocPath(projectRoot: string, chain: ChainState, version?: string): string {
  const entry = version
    ? chain.plan.versions.find(v => v.version === version)
    : chain.plan.versions.filter(v => v.state === 'DRAFT' || v.state === 'APPROVED').length === 1
      ? chain.plan.versions.find(v => v.state === 'DRAFT' || v.state === 'APPROVED')
      : chain.plan.versions.find(v => v.version === chain.plan.active_version);
  if (!entry) throw new Error(version ? `FMN-PLAN ${version} not found.` : 'No active FMN-PLAN found. Run: sigma plan new');
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'contract', `FMN-PLAN-${entry.version}.md`));
}

// Check selects the sole DRAFT/APPROVED contract; multiple open contracts require --v.
function assertPlanCheckUnambiguous(chain: ChainState, explicit: string | undefined): void {
  if (explicit) return;
  const resolution = resolveTargetVersion(chain.plan.versions.filter(p=>p.state==='DRAFT'||p.state==='APPROVED').map(p=>({...p,state:'DRAFT'})), undefined);
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
          const relPath = toPosix(path.join('Sigma', 'pending', `FMN-PLAN-${id}.md`));
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

        const { version, relPath, intentVersionRef } = createPlanDraft({
          projectRoot,
          title: opts.title ?? '',
          focus: opts.focus ?? '',
        });
        const absPath = path.join(projectRoot, relPath);

        console.log(`Created: ${relPath} (references INTENT ${intentVersionRef})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
        console.log(`ROADMAP updated: Stage Overview regenerated with Stage ${version.replace(/^v/, '')}`);
      } catch (e) {
        if (e instanceof PlanDraftError) {
          console.error(e.message);
        } else {
          console.error((e as Error).message);
        }
        process.exit(1);
      }
    });

  registerApprovalCommands(cmd, 'plan');

  cmd.command('supersede')
    .description('Supersede an FMN-PLAN version, DRAFT, APPROVED or LOCKED (auto-supersedes any linked non-final DEV-EXEC)')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v1.2)', normalizeVersionArg)
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .action((opts: { v: string; reason: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chainBefore } = readActiveChain(projectRoot);
        const roadmapVersion = chainBefore.roadmap?.version;

        const result = supersedePlanUseCase(projectRoot, opts.v, opts.reason);

        console.log(`FMN-PLAN ${result.version} superseded. Reason: ${opts.reason}`);
        if (result.cascadedExecs.length > 0) {
          console.log(`Auto-superseded DEV-EXEC: ${result.cascadedExecs.join(', ')}`);
        }
        if (roadmapVersion) {
          console.log(`ROADMAP ${roadmapVersion} re-rendered with SUPERSEDED status.`);
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
        assertRequiredStageMetadata(opts.title, opts.focus, 'promote');
        const result = promotePlanUseCase(projectRoot, opts.id, opts.title ?? '', opts.focus ?? '');

        console.log(`Promoted: ${result.oldRelPath} → ${result.newRelPath} (${result.version})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(path.join(projectRoot, result.newRelPath), 'plan');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
        console.log(`ROADMAP updated: Stage Overview regenerated with Stage ${result.version.replace(/^v/, '')}`);
        console.log(`Run: sigma plan approve --v ${result.version} --director-confirm   after Director review`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate an FMN-PLAN structure and markers')
    .option('--v <version>', 'Check a specific FMN-PLAN version. Required when more than one DRAFT/APPROVED contract is open.', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        assertPlanCheckUnambiguous(chain, opts.v);
        const absPath = planDocPath(projectRoot, chain, opts.v);
        const report = validateSigmaDocFile(absPath, 'plan');
        printSigmaDocReport(report, projectRoot);
        console.log(JSON.stringify(lifecycleView(projectRoot,chain),null,2));
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show FMN-PLAN chain state: open DRAFTs, APPROVED and LOCKED plans with exec pairing, pending plans, Gate 2')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== FMN-PLAN Status ===\n');
        console.log(JSON.stringify(lifecycleView(projectRoot,chain),null,2));

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

        console.log(`\nGate 2: ${effectiveLifecycleGates(projectRoot,chain).gate_2_open ? 'OPEN' : 'BLOCKED'}`);
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
    .requiredOption('--v <version>', 'Plan version to update (e.g. v1.15)', normalizeVersionArg)
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
        const roadmapAbsPath = path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));

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
