import { Command } from 'commander';
import path from 'path';
import {
  ChainState,
  readActiveChain,
  readChain,
  normalizeVersionArg,
} from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import { printSigmaDocReport, validateSigmaDocFile } from '../utils/docCheck';
import { createReviewDraft } from '../services/reviewNewService';
import { findProductReviewRel } from '../services/closeNewService';

// PRODUCT REVIEW is recognized by its file: Sigma/review/PRODUCT-REVIEW-vN.md,
// one per INTENT, version equal to the chain's INTENT version, no chain state.
// ARC creates it after the Director states that the final product is ready.

function reviewDocPath(projectRoot: string, chain: ChainState): string {
  const rel = findProductReviewRel(projectRoot, chain);
  if (!rel) throw new Error('No PRODUCT REVIEW found for this chain. Run: sigma review new');
  return path.join(projectRoot, rel);
}

export function reviewCommand(): Command {
  const cmd = new Command('review');
  cmd.description('Manage PRODUCT REVIEW artifact');

  cmd.command('new')
    .description('Create the PRODUCT REVIEW for the active chain (requires ratified INTENT; one per INTENT)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { relPath, docReport: report } = createReviewDraft(projectRoot);

        console.log(`Created: ${relPath}`);
        console.log('Open it with FMN\'s Review Request (from the `sigma send` message), then record ARC, AUD, and Director verdicts.');
        console.log('Running automatic validation...\n');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate a PRODUCT REVIEW structure and report whether its verdicts permit `sigma close new` (read-only)')
    .option('--v <version>', 'Check the PRODUCT REVIEW of a specific chain instead of the active one', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const chain = opts.v ? readChain(projectRoot, opts.v) : readActiveChain(projectRoot).data;
        const report = validateSigmaDocFile(reviewDocPath(projectRoot, chain), 'review');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
