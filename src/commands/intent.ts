import { Command } from 'commander';
import path from 'path';
import readline from 'readline';
import {
  ChainState,
  listChainVersions,
  resolveActiveChainVersion,
  readChain,
  readActiveChain,
  writeActivateStatus,
  assertChainCanMutate,
  previewIntentSupersedeCascade,
  arcScoreBand,
  isIntentDocUncertified,
  normalizeVersionArg,
} from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import {
  printSigmaDocReport,
  validateSigmaDocFile,
} from '../utils/docCheck';
import { renderIntentHistoryFile } from '../utils/intentHistory';
import { createIntentDraft, IntentDraftError } from '../services/intentDraftService';
import { ratifyIntentDraft } from '../services/intentRatifyService';
import { humanizeIntent, IntentHumanizeError } from '../services/intentHumanizeService';
import { recordIntentAmendmentUseCase } from '../services/intentAmendmentService';
import { recordArcScoreUseCase } from '../services/intentScoreService';
import { supersedeIntentUseCase } from '../services/intentSupersedeService';

// PLAN-EVAL-01 Fase 2 — first command migrated off progress.ts/readProgress
// onto chain.ts. `--v <version>` on `check`/`supersede` now selects a CHAIN
// (a different progress-v<N>.json), not an array entry within one file —
// PLAN-EVAL-01 §3.7.

function promptApprove(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message}\nType APPROVE to continue: `, answer => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'APPROVE');
    });
  });
}

function intentDocPath(projectRoot: string, chain: ChainState): string {
  return path.join(projectRoot, chain.intent.file ?? path.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
}

export function intentCommand(): Command {
  const cmd = new Command('intent');
  cmd.description('Manage DIR-INTENT artifact');

  cmd.command('new')
    .description('Create a new DIR-INTENT draft (auto-creates and auto-activates a new chain)')
    .requiredOption('--title <title>', 'Intent title written into Sigma/design/intent-history.md')
    .requiredOption('--focus <focus>', 'Intent focus summary written into Sigma/design/intent-history.md')
    .option('--yes', 'Skip interactive APPROVE prompt when reopening a CLOSED project')
    .action(async (opts: { title?: string; focus?: string; yes?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();

        // Preflight is read-only and best-effort — a brand-new project with
        // no chain yet has nothing to check CLOSED-ness against (PLAN-EVAL-01
        // §4). Only used here to decide whether to show the interactive
        // prompt; createIntentDraft() enforces the rule itself regardless of
        // what this preflight finds.
        let activeForPreflight: ChainState | null = null;
        try {
          activeForPreflight = readActiveChain(projectRoot).data;
        } catch {
          // no chain exists yet — first `intent new` on this project
        }

        // Not CLOSED → nothing to confirm; createIntentDraft()'s check is a
        // no-op either way. CLOSED → this flag is only ever set true once
        // confirmation (interactive or --yes) has actually happened below.
        let allowReopenClosed = activeForPreflight?.lifecycle_state !== 'CLOSED';
        if (activeForPreflight?.lifecycle_state === 'CLOSED') {
          console.log('\nReopen Preflight\n');
          console.log(
            'The active chain is currently CLOSED. Running this command will create a new, ' +
            'fully isolated chain and activate it — the CLOSED chain is left untouched.\n'
          );
          if (opts.yes) {
            allowReopenClosed = true;
          } else {
            const approved = await promptApprove('Do you wish to continue?');
            if (!approved) {
              console.log('Intent creation cancelled.');
              process.exit(0);
            }
            allowReopenClosed = true;
          }
        }

        const { chainVersion, relPath } = createIntentDraft({
          projectRoot,
          title: opts.title ?? '',
          focus: opts.focus ?? '',
          allowReopenClosed,
        });
        const absPath = path.join(projectRoot, relPath);

        console.log(`Created: ${relPath} — open this file and fill in the intent.`);
        console.log(`Chain ${chainVersion} is now active.`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'intent');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        if (e instanceof IntentDraftError) {
          console.error(e.message);
        } else {
          console.error((e as Error).message);
        }
        process.exit(1);
      }
    });

  cmd.command('ratify')
    .description('Ratify active DIR-INTENT (opens Gate 1, lifecycle → BUILD)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        // Same guard ratifyIntentDraft() runs internally — called here too,
        // ahead of the doc report below, so a semantically corrupted chain
        // (e.g. intent.version/chain_version mismatch) fails with its own
        // clear error instead of an ENOENT from trying to read a doc path
        // that guard would have refused to trust in the first place.
        // Read-only, so duplicating it costs nothing beyond one extra call.
        assertChainCanMutate(chain);

        // Printed unconditionally when DRAFT, pass or fail on what follows —
        // Director needs to see why a ratify was refused. ratifyIntentDraft()
        // re-validates internally rather than trusting this report object, so
        // there is no staleness risk from computing it twice.
        if (chain.intent.state === 'DRAFT') {
          const absPath = intentDocPath(projectRoot, chain);
          printSigmaDocReport(validateSigmaDocFile(absPath, 'intent'), projectRoot);
        }

        const { version } = ratifyIntentDraft(projectRoot);
        console.log(`DIR-INTENT ${version} RATIFIED. Gate 1 open. Lifecycle → BUILD. Next: sigma roadmap new`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.1/§4 Fase 3 — scaffolds the human
  // projection + its (never-published) Fidelity Ledger from a RATIFIED
  // intent. Mirrors `intent new`'s scaffold shape, but writes no DRAFT
  // governance state — chain.intent.human is a bookkeeping record, not a
  // gate transition, and `intent ratify` itself is never gated on this (§3.4
  // / CR-01: the gate belongs at `plan new`, not here).
  cmd.command('humanize')
    .description('Generate a human-readable projection of a RATIFIED DIR-INTENT for Notion (Sigma Humanize Operation)')
    .option('--v <version>', 'Chain version to humanize instead of the active one', normalizeVersionArg)
    .option('--force', 'Overwrite an already-generated human projection for this version')
    .action((opts: { v?: string; force?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const { humanRelPath, ledgerRelPath } = humanizeIntent({ projectRoot, version: opts.v, force: opts.force });

        console.log(`Created: ${humanRelPath}`);
        console.log(`Created: ${ledgerRelPath} (internal — never published, never pushed to Notion)`);
        console.log('');
        console.log('Reading /humanize writing rules (setup/targets/claude_code/humanize.md)...');
        console.log(`Drafting ${humanRelPath} using /humanize style rules.`);
        console.log('Fill in both files, then run: sigma notion push');
      } catch (e) {
        if (e instanceof IntentHumanizeError) {
          console.error(e.message);
        } else {
          console.error((e as Error).message);
        }
        process.exit(1);
      }
    });

  // Tombstone — `sigma intent lock` was renamed to `sigma intent ratify`
  // (Director directive 2026-08-12), removed outright with no alias. This
  // does not ratify anything; it exists only so the old command name fails
  // with a message pointing at the new one, instead of commander's generic
  // "unknown command" error.
  cmd.command('lock')
    .description('Removed — use `sigma intent ratify`')
    .action(() => {
      console.error('Error: `sigma intent lock` has been removed. Use `sigma intent ratify`.');
      console.error('DIR-INTENT is ratified, not locked — see SIGMA_PROTOCOL §5.1.');
      process.exit(1);
    });

  // Amendment mechanism (Discussion 2026-08-11_0115 §3 item 4, Director
  // directive 2026-08-12). Approval-class like `intent ratify`/`intent score`
  // — no --director-confirm: the blast radius is one append-only entry on one
  // chain, not the cross-domain cascade --director-confirm exists for
  // (override, intent supersede). What Director authorizes here is the act of
  // *recording* an amendment ARC has already classified as Operationalization
  // — not a judgment on the content itself.
  cmd.command('amendment')
    .description('Record a Director-approved Amendment against a RATIFIED DIR-INTENT (Operationalization only — see SIGMA_PROTOCOL §5.1.1)')
    .requiredOption('--change <change>', 'Free-text description of the change, commit-message style')
    .option('--v <version>', 'Chain version to amend instead of the active one', normalizeVersionArg)
    .action((opts: { change: string; v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { chainVersion, entry } = recordIntentAmendmentUseCase(projectRoot, opts.change, opts.v);

        console.log(`${entry.id} recorded for DIR-INTENT ${chainVersion}.`);
        console.log(`Change: ${entry.change}`);
        console.log('Section 14 (Amendment History) re-rendered. Document re-certified.');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('score <n>')
    .description('Record ARC Satisfaction Score for a RATIFIED DIR-INTENT (Gate 3.5 pre-condition for `sigma close new` — does not gate `close lock`)')
    .requiredOption('--notes <notes>', 'Rationale for the score')
    .option('--v <version>', 'Chain version to score instead of the active one', normalizeVersionArg)
    .action((n: string, opts: { notes: string; v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const score = Number(n);
        const result = recordArcScoreUseCase(projectRoot, score, opts.notes, opts.v);

        const band = arcScoreBand(result.score);
        console.log(`ARC Score recorded: ${band} (${result.score})`);
        console.log(`Notes: ${result.notes}`);
        console.log(`Gate 3.5 (close new): ${result.score >= 50 ? 'OPEN' : 'BLOCKED'}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('supersede')
    .description('Supersede a RATIFIED DIR-INTENT chain — cascades SUPERSEDED to its Roadmap/Plan/Exec/Close (requires --director-confirm)')
    .requiredOption('--v <version>', 'Chain version to supersede (e.g. v1) — need not be the active chain', normalizeVersionArg)
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .option('--director-confirm', 'Required. Explicit Director authorization to execute the supersede.')
    .action((opts: { v: string; reason: string; directorConfirm?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const chain = readChain(projectRoot, opts.v);
        assertChainCanMutate(chain);

        if (chain.intent.state !== 'RATIFIED') {
          throw new Error(`INTENT ${opts.v} is in state "${chain.intent.state}"; supersede requires RATIFIED.`);
        }

        const cascade = previewIntentSupersedeCascade(chain);
        const total = (cascade.roadmap ? 1 : 0) + cascade.plan.length + cascade.exec.length + (cascade.close ? 1 : 0);

        console.log('\nIntent Supersede Preflight\n');
        console.log(`Target:  DIR-INTENT ${opts.v} (${chain.intent.state})`);
        console.log(`Reason:  ${opts.reason}\n`);

        if (total === 0) {
          console.log('No downstream Roadmap/Plan/Exec/Close artifacts reference this INTENT version.');
        } else {
          console.log('The following artifacts will cascade to SUPERSEDED:');
          if (cascade.roadmap) console.log(`  - ROADMAP ${cascade.roadmap.version} [${cascade.roadmap.state}]${cascade.roadmap.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
          for (const v of cascade.plan) console.log(`  - PLAN ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
          for (const v of cascade.exec) console.log(`  - EXEC ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
          if (cascade.close) console.log(`  - CLOSE ${cascade.close.version} [${cascade.close.state}]${cascade.close.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
        }
        console.log('');

        if (!opts.directorConfirm) {
          console.error('Error: --director-confirm is required to execute an intent supersede.');
          console.error('This command retires an entire INTENT chain and everything under it — Director authority only.');
          console.error('Add --director-confirm to proceed.');
          process.exit(1);
        }

        supersedeIntentUseCase(projectRoot, opts.reason, opts.v);

        console.log(`DIR-INTENT ${opts.v} superseded. Reason: ${opts.reason}`);
        if (total > 0) {
          console.log(`Cascaded to SUPERSEDED: ${cascade.roadmap ? 1 : 0} roadmap, ${cascade.plan.length} plan, ${cascade.exec.length} exec, ${cascade.close ? 1 : 0} close.`);
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('activate')
    .description('Switch which chain is active (analog `git checkout <branch>`) — no --director-confirm required (DISCUSSION "Konsolidasi Lanjutan" bagian 6): default-to-latest + mandatory session bootstrap visibility are the compensating safety net')
    .requiredOption('--v <version>', 'Chain version to activate (e.g. v2)', normalizeVersionArg)
    .action((opts: { v: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const chain = readChain(projectRoot, opts.v); // throws a clear error if the chain doesn't exist
        if (chain.intent.state === 'SUPERSEDED') {
          throw new Error(
            `INTENT ${opts.v} is SUPERSEDED — permanently ineligible to become active again. Run: sigma intent list`
          );
        }
        writeActivateStatus(projectRoot, opts.v);
        renderIntentHistoryFile(projectRoot); // PLAN-EVAL-06 — trigger 4/4 (no-op on content: see plan §3.4)
        console.log(`Active chain switched to ${opts.v}.`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate a DIR-INTENT structure and markers')
    .option('--v <version>', 'Check a specific chain instead of the active one', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const chain = opts.v ? readChain(projectRoot, opts.v) : readActiveChain(projectRoot).data;
        const absPath = intentDocPath(projectRoot, chain);
        const report = validateSigmaDocFile(absPath, 'intent');
        printSigmaDocReport(report, projectRoot);
        if (isIntentDocUncertified(chain, absPath)) {
          const since = chain.intent.effective_amendment ?? 'ratification';
          console.log(`[WARNING] Doc state: UNCERTIFIED_EDIT — file edited after ${since} without a recorded amendment. Run: sigma intent amendment --change "..."`);
        }
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show active DIR-INTENT status')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        console.log('\n=== DIR-INTENT Status ===\n');

        if (listChainVersions(projectRoot).length === 0) {
          console.log('No active INTENT. Run: sigma intent new');
          console.log('\nGate 1:     BLOCKED');
          console.log('');
          return;
        }

        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        console.log(`Chain:      ${chainVersion}`);
        console.log(`Version:    ${chain.intent.version}`);
        console.log(`State:      ${chain.intent.state}`);
        if (chain.intent.ratified_at) console.log(`Ratified at: ${chain.intent.ratified_at}`);
        if (chain.intent.file) console.log(`File:       ${chain.intent.file}`);
        if (isIntentDocUncertified(chain, intentDocPath(projectRoot, chain))) {
          const since = chain.intent.effective_amendment ?? 'ratification';
          console.log(`Doc state:  UNCERTIFIED_EDIT (edited after ${since})`);
        }
        console.log(`\nGate 1:     ${chain.gates.gate_1_open ? 'OPEN' : 'BLOCKED'}`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('list')
    .description('List all chains (projection across every progress-v<N>.json — DISCUSSION "Konsolidasi Lanjutan" bagian 2)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        console.log('\n=== DIR-INTENT / Chains ===\n');

        const versions = listChainVersions(projectRoot);
        if (versions.length === 0) {
          console.log('None. Run: sigma intent new');
          console.log('');
          return;
        }

        let activeChainVersion: string | null = null;
        try {
          activeChainVersion = resolveActiveChainVersion(projectRoot);
        } catch {
          // No chain is eligible to be active (e.g. every chain SUPERSEDED) —
          // still list everything, just without an ACTIVE marker.
        }

        console.log('Chain      Intent State   Lifecycle    Gate1  Gate2  Gate3  Active');
        console.log('-'.repeat(72));
        for (const v of versions) {
          const chain = readChain(projectRoot, v);
          const active = v === activeChainVersion ? '*' : '';
          console.log(
            `${v.padEnd(10)} ${chain.intent.state.padEnd(14)} ${chain.lifecycle_state.padEnd(12)} ` +
            `${(chain.gates.gate_1_open ? 'OPEN' : '—').padEnd(6)} ${(chain.gates.gate_2_open ? 'OPEN' : '—').padEnd(6)} ` +
            `${(chain.gates.gate_3_satisfied ? 'OPEN' : '—').padEnd(6)} ${active}`
          );
        }
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
