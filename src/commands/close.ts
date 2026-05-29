import { Command } from 'commander';
import fs from 'fs-extra';
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
import { appendAuditFindings, copyTemplateToArtifact } from '../utils/artifacts';

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
  isStale: boolean;
}

function evaluateCloseChain(data: ProgressJson): CloseChain {
  const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
  if (!lockedIntent) return { hasChain: false, isStale: false };

  const qualifyingPlan = data.plan.versions.find(
    v => v.state === 'LOCKED' && v.intent_version_ref === lockedIntent.version
  );
  if (!qualifyingPlan) return { hasChain: false, isStale: false };

  const qualifyingExec = data.exec.versions.find(
    v => v.state === 'LOCKED' && v.plan_version_ref === qualifyingPlan.version
  );
  if (!qualifyingExec) return { hasChain: false, isStale: false };

  const isStale = !!(qualifyingPlan.stale_intent || qualifyingExec.stale_intent);
  return { hasChain: true, isStale };
}

export function closeCommand(): Command {
  const cmd = new Command('close');
  cmd.description('Manage DIR-CLOSE artifact');

  cmd.command('new')
    .description('Create a new DIR-CLOSE draft (requires INTENT → PLAN → EXEC locked chain)')
    .option('--ack-stale-intent', 'Acknowledge that the qualifying chain has stale intent')
    .action((opts: { ackStaleIntent?: boolean }) => {
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
        if (chain.isStale && !opts.ackStaleIntent) {
          throw new Error(
            'GATE 3 STALE: Qualifying chain has stale intent. Add --ack-stale-intent to acknowledge.'
          );
        }

        const version = nextMajorVersion(data.close.versions);
        const relPath = path.join('Sigma', 'close', `DIR-CLOSE-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        copyTemplateToArtifact('DIR-CLOSE-TEMPLATE.md', absPath);

        if (opts.ackStaleIntent) {
          const ackNote = `> **STALE INTENT ACKNOWLEDGED**: This closure document was created with --ack-stale-intent. The qualifying INTENT → PLAN → EXEC chain contains stale intent.\n\n`;
          const existing = fs.readFileSync(absPath, 'utf8');
          fs.writeFileSync(absPath, ackNote + existing);
        }

        registerCloseDraft(data, version, relPath, !!opts.ackStaleIntent);
        writeProgress(projectRoot, data);
        console.log(`Created: ${relPath}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('audit')
    .description('Append AUD advisory findings to active DIR-CLOSE (no state change)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        if (!data.close.active_version) {
          throw new Error('No active DIR-CLOSE found. Run: sigma close new');
        }
        const activeEntry = data.close.versions.find(v => v.version === data.close.active_version);
        const relPath = activeEntry?.file ?? path.join('Sigma', 'close', `DIR-CLOSE-${data.close.active_version}.md`);
        const absPath = path.join(projectRoot, relPath);
        if (!fs.existsSync(absPath)) throw new Error(`Active CLOSE file not found: ${relPath}`);
        appendAuditFindings(absPath, 'close', 'audit');
        console.log(`Advisory findings section appended to ${relPath}. Fill in the AUD findings — runtime state unchanged.`);
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
