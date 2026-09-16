import { Command } from 'commander';
import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  lockExecVersion,
  resolveTargetVersion,
  assertChainCanMutate,
  normalizeVersionArg,
} from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import {
  ensureSigmaDocEligible,
  printSigmaDocReport,
  validateSigmaDocFile,
} from '../utils/docCheck';
import { createExecDraft, ExecDraftError } from '../services/execDraftService';
import { humanizeExec, ExecHumanizeError } from '../services/execHumanizeService';

function execDocPath(projectRoot: string, chain: ChainState, version?: string): string {
  const entry = version
    ? chain.exec.versions.find(v => v.version === version)
    : chain.exec.versions.find(v => v.version === chain.exec.active_version);
  if (!entry) throw new Error(version ? `DEV-EXEC ${version} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'evidence', `DEV-EXEC-${entry.version}.md`));
}

// PLAN-IMPL-MULTIDRAFT-LOCK §8.3 (Director directive 2026-08-12) — same
// ambiguity rule as plan.ts's assertPlanCheckUnambiguous(): `check` defaults
// to the active pointer only while unambiguous (0 or 1 open DRAFT).
function assertExecCheckUnambiguous(chain: ChainState, explicit: string | undefined): void {
  if (explicit) return;
  const resolution = resolveTargetVersion(chain.exec.versions, undefined);
  if (resolution.kind === 'ambiguous') {
    throw new Error(
      `${resolution.candidates.length} DRAFT DEV-EXECs are open: ${resolution.candidates.join(', ')}\n` +
      `Specify which one to check: sigma exec check --v ${resolution.candidates[0]}`
    );
  }
}

export function execCommand(): Command {
  const cmd = new Command('exec');
  cmd.description('Manage DEV-EXEC artifact');

  cmd.command('new')
    .description('Create a new DEV-EXEC draft (requires a LOCKED FMN-PLAN with no open exec)')
    .option('--plan <version>', 'Explicitly specify which locked plan to execute (required when multiple unexecuted locked plans exist)', normalizeVersionArg)
    .action((opts: { plan?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { relPath, planVersionRef } = createExecDraft({ projectRoot, planVersion: opts.plan });
        const absPath = path.join(projectRoot, relPath);

        console.log(`Created: ${relPath} (references PLAN ${planVersionRef})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'exec');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        if (e instanceof ExecDraftError) {
          console.error(e.message);
        } else {
          console.error((e as Error).message);
        }
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock a DRAFT DEV-EXEC (re-evaluates Gate 3). Requires --v when more than one DRAFT is open.')
    .option('--v <version>', 'DRAFT version to lock (required when more than one DRAFT is open)', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);

        const resolution = resolveTargetVersion(chain.exec.versions, opts.v);
        if (resolution.kind === 'empty') {
          throw new Error('No DRAFT DEV-EXEC to lock. Run: sigma exec new');
        }
        if (resolution.kind === 'ambiguous') {
          const described = resolution.candidates
            .map(v => {
              const entry = chain.exec.versions.find(e => e.version === v);
              return entry?.plan_version_ref ? `${v} (plan ${entry.plan_version_ref})` : v;
            })
            .join(', ');
          throw new Error(
            `${resolution.candidates.length} DRAFT DEV-EXECs are open: ${described}\n` +
            `Specify which one to lock: sigma exec lock --v ${resolution.candidates[0]}`
          );
        }
        const lockTargetVersion = resolution.version;

        const absPath = execDocPath(projectRoot, chain, lockTargetVersion);
        const report = validateSigmaDocFile(absPath, 'exec');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'exec');
        lockExecVersion(chain, lockTargetVersion);
        writeChain(projectRoot, chainVersion, chain);
        const gate3 = chain.gates.gate_3_satisfied
          ? 'SATISFIED'
          : 'not satisfied — open work remains';
        console.log(`DEV-EXEC ${lockTargetVersion} LOCKED. Gate 3: ${gate3}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.1/§4 Fase 3 — one PLAN-EXEC-HUMAN
  // document per plan+exec version pair, keyed on the exec side (exec
  // always mirrors its plan's version — nextExecVersion() guarantees it).
  // Requires the exec to be LOCKED, same reasoning as `intent humanize`
  // requiring RATIFIED: never scaffold a human projection whose source can
  // still change out from under it. `exec lock` itself is never gated on
  // this (§3.4 / CR-01 — the gate belongs at the next `plan new`/`close new`).
  cmd.command('humanize')
    .description('Generate a human-readable projection of a LOCKED plan+exec pair for Notion (Sigma Humanize Operation)')
    .option('--v <version>', 'EXEC version to humanize instead of the active one', normalizeVersionArg)
    .option('--force', 'Overwrite an already-generated human projection for this version')
    .action((opts: { v?: string; force?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const { version, planVersionRef, humanRelPath, ledgerRelPath } = humanizeExec({ projectRoot, version: opts.v, force: opts.force });

        console.log(`Created: ${humanRelPath} (sources: FMN-PLAN ${planVersionRef} + DEV-EXEC ${version})`);
        console.log(`Created: ${ledgerRelPath} (internal — never published, never pushed to Notion)`);
        console.log('');
        console.log('Reading /humanize writing rules (setup/targets/claude_code/humanize.md)...');
        console.log(`Drafting ${humanRelPath} using /humanize style rules.`);
        console.log('Fill in both files, then run: sigma notion push');
      } catch (e) {
        if (e instanceof ExecHumanizeError) {
          console.error(e.message);
        } else {
          console.error((e as Error).message);
        }
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate a DEV-EXEC structure and markers')
    .option('--v <version>', 'Check a specific DEV-EXEC version. Required when more than one DRAFT is open.', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        assertExecCheckUnambiguous(chain, opts.v);
        const absPath = execDocPath(projectRoot, chain, opts.v);
        const report = validateSigmaDocFile(absPath, 'exec');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show DEV-EXEC chain state: open DRAFTs with plan pairing, LOCKED execs, Gate 3')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== DEV-EXEC Status ===\n');

        const drafts = chain.exec.versions
          .filter(v => v.state === 'DRAFT')
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const locked = chain.exec.versions
          .filter(v => v.state === 'LOCKED')
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const supersededCount = chain.exec.versions.filter(v => v.state === 'SUPERSEDED').length;

        if (drafts.length === 0) {
          console.log('DRAFT: none');
        } else {
          console.log(`DRAFT (${drafts.length}):`);
          for (const d of drafts) {
            console.log(`  ${d.version}  (plan ${d.plan_version_ref ?? '—'})  (created ${d.created_at.slice(0, 10)})`);
          }
        }

        console.log('');
        if (locked.length === 0) {
          console.log('LOCKED: none');
        } else {
          console.log(`LOCKED (${locked.length}):`);
          for (const e of locked) {
            console.log(`  ${e.version}  (plan ${e.plan_version_ref ?? '—'})`);
          }
        }

        console.log(`\nGate 3: ${chain.gates.gate_3_satisfied ? 'SATISFIED' : 'not satisfied'}`);
        if (supersededCount > 0) {
          console.log(`(${supersededCount} SUPERSEDED exec(s) not shown above — run: sigma exec list)`);
        }
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('list')
    .description('List all DEV-EXEC versions')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== DEV-EXEC Versions ===\n');
        if (chain.exec.versions.length === 0) {
          console.log('None. Run: sigma exec new');
        } else {
          console.log('Version    State        PLAN Ref    Created');
          console.log('-'.repeat(75));
          for (const v of chain.exec.versions) {
            const ver = v.version.padEnd(10);
            const st = v.state.padEnd(12);
            const pr = (v.plan_version_ref ?? '—').padEnd(11);
            console.log(`${ver} ${st} ${pr} ${v.created_at}`);
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
