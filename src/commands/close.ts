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
  printSigmaDocReport,
  validateSigmaDocFile,
} from '../utils/docCheck';
import { assessCloseNewEligibility, createCloseDraftUseCase } from '../services/closeNewService';
import { lockCloseUseCase, assertCloseLockGate3 } from '../services/closeLockService';
import { defaultArtifactRel } from '../engine/artifactNames';

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
  return path.join(projectRoot, chain.close.file ?? defaultArtifactRel(projectRoot, 'close', 'close', chain.close.version));
}

export function closeCommand(): Command {
  const cmd = new Command('close');
  cmd.description('Manage CLOSE artifact');

  cmd.command('new')
    .description('Create a new CLOSE draft (requires Gate 3 and an accepted PRODUCT REVIEW; run `sigma close check` first)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const result = createCloseDraftUseCase(projectRoot);
        console.log(`Created: ${result.relPath}`);
        if (result.riskNotes.length > 0) {
          console.log(
            `Note: PASS_WITH_RISK was recorded by ${result.riskNotes.map(n => n.party).join(', ')}. ` +
            'State the final condition of those risks under Limitations in the CLOSE.\n'
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
    .description('Lock active CLOSE (lifecycle → CLOSED); auto-locks the chain\'s ROADMAP as a side effect')
    .option('--yes', 'Skip interactive APPROVE prompt')
    .action(async (opts: { yes?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);
        if (!chain.close || chain.close.state !== 'DRAFT') {
          throw new Error('Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
        }
        assertCloseLockGate3(projectRoot, chain);
        const closeVersion = chain.close.version;
        // Only a still-DRAFT roadmap gets swept into the cascade — one
        // already LOCKED (e.g. a retried close lock) or SUPERSEDED is left
        // alone, mirroring the pre-migration ACTIVE-only condition.
        const roadmapToLock = chain.roadmap && chain.roadmap.state === 'DRAFT' ? chain.roadmap : null;
        const absPath = closeDocPath(projectRoot, chain);
        // Locking is a stamp that the mandate is finished. The gate sits before
        // `close new`, so the document report below is informational only.
        const report = validateSigmaDocFile(absPath, 'close');
        printSigmaDocReport(report, projectRoot);

        console.log('\nClose Lock Preflight\n');
        console.log(`Artifact to lock:  DIR-CLOSE ${closeVersion}`);
        if (roadmapToLock) {
          console.log(`Linked roadmap:    ROADMAP ${roadmapToLock.version} DRAFT`);
          console.log('\nSide effects:');
          console.log(`  - DIR-CLOSE ${closeVersion} will become LOCKED`);
          console.log(`  - ROADMAP ${roadmapToLock.version} will become LOCKED`);
          console.log('  - New PLANs are not prevented: work that stays within this mandate may continue after the lock');
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

  cmd.command('check')
    .description('Check whether a CLOSE can be created: Gate 3 and the PRODUCT REVIEW verdicts (read-only)')
    .option('--v <version>', 'Check a specific chain instead of the active one', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const chain = opts.v ? readChain(projectRoot, opts.v) : readActiveChain(projectRoot).data;
        const result = assessCloseNewEligibility(chain, projectRoot);

        console.log('\n=== Sigma Close Check ===\n');
        console.log(`Gate 3:          ${result.gate3Satisfied ? 'satisfied' : 'BLOCKED'}`);
        console.log(`PRODUCT REVIEW:  ${result.reviewFile ?? 'MISSING'}`);
        if (result.review) {
          const { arc, aud, director, audSkipped } = result.review;
          console.log(`  ARC:      ${arc ?? 'not recorded'}`);
          console.log(`  AUD:      ${audSkipped ? 'SKIP_FOR_AUDIT' : aud ?? 'not recorded'}`);
          console.log(`  Director: ${director ?? 'not recorded'}`);
        }

        if (!result.eligible) {
          console.log('');
          for (const blocker of result.blockers) console.log(blocker.message + '\n');
          console.log('Closure readiness: Not eligible');
          process.exit(1);
        }

        const risks = result.review?.riskNotes ?? [];
        if (risks.length > 0) {
          console.log('\nPASS_WITH_RISK is present. Before `sigma close new`, ARC asks the Director whether to');
          console.log('create the CLOSE or to return to FMN to address the risks. The PRODUCT REVIEW is not changed either way.\n');
          for (const risk of risks) {
            console.log(`  ${risk.party}: ${risk.notes.length > 0 ? risk.notes.join(' | ') : '(no risk listed)'}`);
          }
        }
        console.log(`\nClosure readiness: ${risks.length > 0 ? 'Eligible with PASS_WITH_RISK' : 'Eligible'}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show active CLOSE status')
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
