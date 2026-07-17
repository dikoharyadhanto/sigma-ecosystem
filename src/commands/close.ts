import { Command } from 'commander';
import path from 'path';
import readline from 'readline';
import {
  readProgress,
  writeProgress,
  nextMajorVersion,
  registerCloseDraft,
  lockActiveClose,
  lockActiveRoadmap,
  ProgressJson,
  assertProgressCanMutate,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import {
  ensureSigmaDocEligible,
  printSigmaDocReport,
  resolveSigmaDocPath,
  validateSigmaDocFile,
} from '../utils/docCheck';

function promptApprove(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message}\nType APPROVE to continue: `, answer => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'APPROVE');
    });
  });
}

interface CloseChain {
  hasChain: boolean;
  intentVersionRef?: string;
}

function evaluateCloseChain(data: ProgressJson): CloseChain {
  const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
  if (!lockedIntent) return { hasChain: false };

  const qualifyingPlan = data.plan.versions.find(
    v => v.state === 'LOCKED' && v.intent_version_ref === lockedIntent.version
  );
  if (!qualifyingPlan) return { hasChain: false };

  const qualifyingExec = data.exec.versions.find(
    v => v.state === 'LOCKED' && v.plan_version_ref === qualifyingPlan.version
  );
  if (!qualifyingExec) return { hasChain: false };

  return { hasChain: true, intentVersionRef: lockedIntent.version };
}

export function closeCommand(): Command {
  const cmd = new Command('close');
  cmd.description('Manage DIR-CLOSE artifact');

  cmd.command('new')
    .description('Create a new DIR-CLOSE draft (requires INTENT → PLAN → EXEC locked chain)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        const chain = evaluateCloseChain(data);
        if (!chain.hasChain) {
          throw new Error(
            'GATE 3 BLOCKED: Requires INTENT → PLAN → EXEC chain all LOCKED (same version chain). Run: sigma exec lock'
          );
        }

        const version = nextMajorVersion(data.close.versions);
        const relPath = path.join('Sigma', 'close', `DIR-CLOSE-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        copyTemplateToArtifact('DIR-CLOSE-TEMPLATE.md', absPath);

        registerCloseDraft(data, version, relPath, chain.intentVersionRef!);
        writeProgress(projectRoot, data);
        console.log(`Created: ${relPath}`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'close');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock active DIR-CLOSE (lifecycle → CLOSED); auto-locks the ACTIVE ROADMAP as a side effect')
    .option('--yes', 'Skip interactive APPROVE prompt')
    .action(async (opts: { yes?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        if (data.close.active_state !== 'DRAFT') {
          throw new Error('Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
        }
        const closeVersion = data.close.active_version!;
        const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
        const absPath = resolveSigmaDocPath(projectRoot, data, 'close');
        const report = validateSigmaDocFile(absPath, 'close');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'close');

        console.log('\nClose Lock Preflight\n');
        console.log(`Artifact to lock:  DIR-CLOSE ${closeVersion}`);
        if (activeRoadmap) {
          console.log(`Linked roadmap:    ROADMAP ${activeRoadmap.version} ACTIVE`);
          console.log('\nSide effects:');
          console.log(`  - DIR-CLOSE ${closeVersion} will become LOCKED`);
          console.log(`  - ROADMAP ${activeRoadmap.version} will become LOCKED`);
          console.log('  - No more plans can be added to this ROADMAP');
          console.log('  - Project lifecycle will be considered CLOSED\n');
        } else {
          console.log('Linked roadmap:    none (no ACTIVE ROADMAP)\n');
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

        if (activeRoadmap) {
          lockActiveRoadmap(data);
        }
        lockActiveClose(data);
        writeProgress(projectRoot, data);

        if (activeRoadmap) {
          console.log(`ROADMAP ${activeRoadmap.version} LOCKED.`);
        }
        console.log(`DIR-CLOSE ${closeVersion} LOCKED. Lifecycle → CLOSED. Project is complete.`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate the active DIR-CLOSE structure and markers')
    .option('--v <version>', 'Check a specific DIR-CLOSE version instead of the active one')
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        const absPath = resolveSigmaDocPath(projectRoot, data, 'close', opts.v);
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
        const data = readProgress(projectRoot);
        console.log('\n=== DIR-CLOSE Status ===\n');
        if (!data.close.active_version) {
          console.log('No active CLOSE. Run: sigma close new');
        } else {
          const active = data.close.versions.find(v => v.version === data.close.active_version);
          console.log(`Version:    ${data.close.active_version}`);
          console.log(`State:      ${data.close.active_state}`);
          if (active?.locked_at) console.log(`Locked at:  ${active.locked_at}`);
          if (active?.file) console.log(`File:       ${active.file}`);
        }
        console.log(`\nLifecycle:  ${data.lifecycle_state}`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
