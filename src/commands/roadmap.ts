import { Command } from 'commander';
import path from 'path';
import {
  ChainState,
  readActiveChain,
  readChain,
  writeChain,
  assertChainCanMutate,
  registerRoadmapDraft,
  normalizeVersionArg,
} from '../engine/chain';
import { findProjectRoot, toPosix } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { renderRoadmapFile, getStagePlansForRoadmap } from '../utils/roadmap';
import {
  printSigmaDocReport,
  validateSigmaDocFile,
} from '../utils/docCheck';

// PLAN-EVAL-01 Fase 3 — `roadmap activate` is REMOVED (§3.5): there is only
// ever one roadmap per chain now, so there is never a second DRAFT to
// activate or a current ACTIVE to demote. There is still no `roadmap lock`
// command — that was never a standalone command even before Opsi C; the
// existing roadmap already only ever becomes LOCKED as a side effect of
// `sigma close lock` (see close.ts) — unchanged behavior, just ported.

// ── Internal helpers ──────────────────────────────────────────────────────────

function roadmapDocPath(projectRoot: string, chain: ChainState): string {
  if (!chain.roadmap) throw new Error('No ROADMAP found for this chain. Run: sigma roadmap new');
  return path.join(projectRoot, chain.roadmap.file ?? path.join('Sigma', 'roadmap', `ROADMAP-${chain.roadmap.version}.md`));
}

// ── Command ───────────────────────────────────────────────────────────────────

export function roadmapCommand(): Command {
  const cmd = new Command('roadmap');
  cmd.description('Manage ROADMAP artifact');

  cmd.command('new')
    .description('Create the ROADMAP for the active chain (requires ratified DIR-INTENT; one per chain)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);

        if (chain.intent.state !== 'RATIFIED') {
          throw new Error('ROADMAP requires a ratified DIR-INTENT. Run: sigma intent ratify');
        }

        const version = chain.chain_version;
        const relPath = toPosix(path.join('Sigma', 'roadmap', `ROADMAP-${version}.md`));
        const absPath = path.join(projectRoot, relPath);

        copyTemplateToArtifact('ROADMAP-TEMPLATE.md', absPath);
        registerRoadmapDraft(chain, relPath);
        writeChain(projectRoot, chainVersion, chain);

        console.log(`Created: ${relPath} (DRAFT — plan new is now unblocked)`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'roadmap');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate a ROADMAP structure and markers')
    .option('--v <version>', 'Check the ROADMAP of a specific chain instead of the active one', normalizeVersionArg)
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const chain = opts.v ? readChain(projectRoot, opts.v) : readActiveChain(projectRoot).data;
        const absPath = roadmapDocPath(projectRoot, chain);
        const report = validateSigmaDocFile(absPath, 'roadmap');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('render')
    .description('Regenerate the derived Stage Overview table in the active chain\'s ROADMAP')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        const roadmapPath = roadmapDocPath(projectRoot, chain);
        renderRoadmapFile(roadmapPath, chain);
        console.log(`ROADMAP ${chain.roadmap!.version} Stage Overview regenerated: ${chain.roadmap!.file ?? roadmapPath}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('list')
    .description('List all stages in the active chain\'s ROADMAP with title, focus, and plan status')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);

        if (!chain.roadmap) {
          console.log('\nNo ROADMAP found for the active chain. Run: sigma roadmap new\n');
          return;
        }

        const stagePlans = getStagePlansForRoadmap(chain);

        console.log(`\n=== ROADMAP ${chain.roadmap.version} — Stage List ===\n`);

        if (stagePlans.length === 0) {
          console.log('No stages found for this ROADMAP. Run: sigma plan new');
          console.log('');
          return;
        }

        const COL_STAGE = 7;
        const COL_STATUS = 10;
        const COL_TITLE = 38;
        const COL_FOCUS = 42;

        console.log(
          'Stage'.padEnd(COL_STAGE) +
          'Status'.padEnd(COL_STATUS) +
          'Title'.padEnd(COL_TITLE) +
          'Focus',
        );
        console.log('-'.repeat(COL_STAGE + COL_STATUS + COL_TITLE + COL_FOCUS));

        for (const plan of stagePlans) {
          const stage = plan.version.replace(/^v/, '');
          const title = plan.title ?? 'TBD';
          const focus = plan.focus ?? 'TBD';

          const stageCol = stage.padEnd(COL_STAGE);
          const statusCol = plan.state.padEnd(COL_STATUS);
          const titleCol = title.length > COL_TITLE - 2
            ? title.substring(0, COL_TITLE - 4) + '... '
            : title.padEnd(COL_TITLE);
          const focusCol = focus.length > COL_FOCUS - 2
            ? focus.substring(0, COL_FOCUS - 4) + '...'
            : focus;

          console.log(`${stageCol}${statusCol}${titleCol}${focusCol}`);
        }

        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
