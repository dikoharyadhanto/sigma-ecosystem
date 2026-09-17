import { Command } from 'commander';
import path from 'path';
import readline from 'readline';
import {
  ChainState,
  readActiveChain,
  readChain,
  assertChainCanMutate,
  normalizeVersionArg,
} from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import {
  ensureSigmaDocEligible,
  printSigmaDocReport,
  validateSigmaDocFile,
} from '../utils/docCheck';
import { humanizeClose, CloseHumanizeError } from '../services/closeHumanizeService';
import { createCloseDraftUseCase } from '../services/closeNewService';
import { lockCloseUseCase } from '../services/closeLockService';

// PLAN-EVAL-01 Fase 3 — `close lock` already auto-locks the chain's roadmap
// as a side effect *before* this migration (see `lockActiveRoadmap` call
// below) — this is existing behavior being preserved under the new storage,
// not new PLAN-EVAL-04 scope. Only the *state model* backing it changed
// (single roadmap object instead of searching for the ACTIVE entry, §3.5).

function promptApprove(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message}\nType APPROVE to continue: `, answer => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'APPROVE');
    });
  });
}

function closeDocPath(projectRoot: string, chain: ChainState): string {
  if (!chain.close) throw new Error('No active DIR-CLOSE found. Run: sigma close new');
  return path.join(projectRoot, chain.close.file ?? path.join('Sigma', 'close', `DIR-CLOSE-${chain.close.version}.md`));
}

export function closeCommand(): Command {
  const cmd = new Command('close');
  cmd.description('Manage DIR-CLOSE artifact');

  cmd.command('new')
    .description('Create a new DIR-CLOSE draft (requires INTENT RATIFIED and PLAN → EXEC chain all LOCKED)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const result = createCloseDraftUseCase(projectRoot);
        console.log(`Created: ${result.relPath}`);
        if (result.arcScoreBand === 'SATISFIED_NEEDS_REVIEW') {
          console.log(
            `Note: ARC Satisfaction Score is SATISFIED_NEEDS_REVIEW (${result.arcScore}) — ARC does not ` +
            'yet recommend closure. Director may still proceed via close lock through explicit authorization.\n'
          );
        }
        console.log('Running automatic validation...\n');
        printSigmaDocReport(result.docReport, projectRoot);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock active DIR-CLOSE (lifecycle → CLOSED); auto-locks the chain\'s ROADMAP as a side effect')
    .option('--yes', 'Skip interactive APPROVE prompt')
    .action(async (opts: { yes?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);
        if (!chain.close || chain.close.state !== 'DRAFT') {
          throw new Error('Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
        }
        const closeVersion = chain.close.version;
        // Only a still-DRAFT roadmap gets swept into the cascade — one
        // already LOCKED (e.g. a retried close lock) or SUPERSEDED is left
        // alone, mirroring the pre-migration ACTIVE-only condition.
        const roadmapToLock = chain.roadmap && chain.roadmap.state === 'DRAFT' ? chain.roadmap : null;
        const absPath = closeDocPath(projectRoot, chain);
        const report = validateSigmaDocFile(absPath, 'close');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'close');

        console.log('\nClose Lock Preflight\n');
        console.log(`Artifact to lock:  DIR-CLOSE ${closeVersion}`);
        if (roadmapToLock) {
          console.log(`Linked roadmap:    ROADMAP ${roadmapToLock.version} DRAFT`);
          console.log('\nSide effects:');
          console.log(`  - DIR-CLOSE ${closeVersion} will become LOCKED`);
          console.log(`  - ROADMAP ${roadmapToLock.version} will become LOCKED`);
          console.log('  - No more plans can be added to this ROADMAP');
          console.log('  - Project lifecycle will be considered CLOSED\n');
        } else {
          console.log('Linked roadmap:    none\n');
          console.log('Side effects:');
          console.log(`  - DIR-CLOSE ${closeVersion} will become LOCKED`);
          console.log('  - Project lifecycle will be considered CLOSED\n');
        }

        if (!opts.yes) {
          const approved = await promptApprove('');
          if (!approved) {
            console.log('Close lock cancelled.');
            process.exit(0);
          }
        }

        const result = lockCloseUseCase(projectRoot);
        if (result.roadmapLocked) {
          console.log(`ROADMAP ${result.roadmapLocked} LOCKED.`);
        }
        console.log(`DIR-CLOSE ${result.version} LOCKED. Lifecycle → CLOSED. Project is complete.`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.1/§4 Fase 3. Requires DIR-CLOSE
  // LOCKED — never scaffold a human projection from a closure decision that
  // could still change. `close lock` itself is never gated on this (§3.4 /
  // CR-01): there is no "next" governance command after CLOSE to gate, so
  // unlike intent/exec this one has no enforcement point at all yet — see
  // plan §6 poin 1c (open: who runs this, and whether it needs a gate).
  cmd.command('humanize')
    .description('Generate a human-readable projection of a LOCKED DIR-CLOSE for Notion (Sigma Humanize Operation)')
    .option('--force', 'Overwrite an already-generated human projection for this version')
    .action((opts: { force?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const { humanRelPath, ledgerRelPath } = humanizeClose({ projectRoot, force: opts.force });

        console.log(`Created: ${humanRelPath}`);
        console.log(`Created: ${ledgerRelPath} (internal — never published, never pushed to Notion)`);
        console.log('');
        console.log('Reading /humanize writing rules (setup/targets/claude_code/humanize.md)...');
        console.log(`Drafting ${humanRelPath} using /humanize style rules.`);
        console.log('Fill in both files, then run: sigma notion push');
      } catch (e) {
        if (e instanceof CloseHumanizeError) {
          console.error(e.message);
        } else {
          console.error((e as Error).message);
        }
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate a DIR-CLOSE structure and markers')
    .option('--v <version>', 'Check the DIR-CLOSE of a specific chain instead of the active one', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const chain = opts.v ? readChain(projectRoot, opts.v) : readActiveChain(projectRoot).data;
        const absPath = closeDocPath(projectRoot, chain);
        const report = validateSigmaDocFile(absPath, 'close');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show active DIR-CLOSE status')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== DIR-CLOSE Status ===\n');
        if (!chain.close) {
          console.log('No active CLOSE. Run: sigma close new');
        } else {
          console.log(`Version:    ${chain.close.version}`);
          console.log(`State:      ${chain.close.state}`);
          if (chain.close.locked_at) console.log(`Locked at:  ${chain.close.locked_at}`);
          if (chain.close.file) console.log(`File:       ${chain.close.file}`);
        }
        console.log(`\nLifecycle:  ${chain.lifecycle_state}`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
