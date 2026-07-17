import { Command } from 'commander';
import path from 'path';
import readline from 'readline';
import {
  readProgress,
  writeProgress,
  nextMajorVersion,
  registerIntentDraft,
  lockActiveIntent,
  previewIntentSupersedeCascade,
  supersedeIntentVersion,
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

export function intentCommand(): Command {
  const cmd = new Command('intent');
  cmd.description('Manage DIR-INTENT artifact');

  cmd.command('new')
    .description('Create a new DIR-INTENT draft')
    .option('--yes', 'Skip interactive APPROVE prompt when reopening a CLOSED project')
    .action(async (opts: { yes?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        if (data.lifecycle_state === 'CLOSED') {
          console.log('\nReopen Preflight\n');
          console.log(
            'Project lifecycle is currently CLOSED. Running this command will automatically ' +
            'reopen the project and begin a new work cycle.\n'
          );
          if (!opts.yes) {
            const approved = await promptApprove('Do you wish to continue?');
            if (!approved) {
              console.log('Intent creation cancelled.');
              process.exit(0);
            }
          }
        }

        const version = nextMajorVersion(data.intent.versions);
        const relPath = path.join('Sigma', 'design', `DIR-INTENT-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        copyTemplateToArtifact('DIR-INTENT-TEMPLATE.md', absPath);
        registerIntentDraft(data, version, relPath);
        writeProgress(projectRoot, data);
        console.log(`Created: ${relPath} — open this file and fill in the intent.`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'intent');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock active DIR-INTENT (opens Gate 1, lifecycle → BUILD)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        if (data.intent.active_state !== 'DRAFT') {
          throw new Error('Active DIR-INTENT is not in DRAFT state. Cannot lock.');
        }
        const absPath = resolveSigmaDocPath(projectRoot, data, 'intent');
        const report = validateSigmaDocFile(absPath, 'intent');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'intent');
        const version = data.intent.active_version!;
        lockActiveIntent(data);
        writeProgress(projectRoot, data);
        console.log(`DIR-INTENT ${version} LOCKED. Gate 1 open. Lifecycle → BUILD. Next: sigma plan new`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('supersede')
    .description('Supersede a LOCKED or INACTIVE DIR-INTENT — cascades SUPERSEDED to its Roadmap/Plan/Exec/Close (requires --director-confirm)')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v1)')
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .option('--director-confirm', 'Required. Explicit Director authorization to execute the supersede.')
    .action((opts: { v: string; reason: string; directorConfirm?: boolean }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);

        const target = data.intent.versions.find(v => v.version === opts.v);
        if (!target) {
          throw new Error(`INTENT version ${opts.v} not found. Run: sigma intent list`);
        }
        if (target.state !== 'LOCKED' && target.state !== 'INACTIVE') {
          throw new Error(`INTENT ${opts.v} is in state "${target.state}"; supersede requires LOCKED or INACTIVE.`);
        }

        const cascade = previewIntentSupersedeCascade(data, opts.v);
        const total = cascade.roadmap.length + cascade.plan.length + cascade.exec.length + cascade.close.length;

        console.log('\nIntent Supersede Preflight\n');
        console.log(`Target:  DIR-INTENT ${opts.v} (${target.state})`);
        console.log(`Reason:  ${opts.reason}\n`);

        if (total === 0) {
          console.log('No downstream Roadmap/Plan/Exec/Close artifacts reference this INTENT version.');
        } else {
          console.log('The following artifacts will cascade to SUPERSEDED:');
          for (const v of cascade.roadmap) console.log(`  - ROADMAP ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
          for (const v of cascade.plan) console.log(`  - PLAN ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
          for (const v of cascade.exec) console.log(`  - EXEC ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
          for (const v of cascade.close) console.log(`  - CLOSE ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
        }
        console.log('');

        if (!opts.directorConfirm) {
          console.error('Error: --director-confirm is required to execute an intent supersede.');
          console.error('This command retires an entire INTENT chain and everything under it — Director authority only.');
          console.error('Add --director-confirm to proceed.');
          process.exit(1);
        }

        supersedeIntentVersion(data, opts.v, opts.reason);
        writeProgress(projectRoot, data);

        console.log(`DIR-INTENT ${opts.v} superseded. Reason: ${opts.reason}`);
        if (total > 0) {
          console.log(`Cascaded to SUPERSEDED: ${cascade.roadmap.length} roadmap, ${cascade.plan.length} plan, ${cascade.exec.length} exec, ${cascade.close.length} close.`);
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate the active DIR-INTENT structure and markers')
    .option('--v <version>', 'Check a specific DIR-INTENT version instead of the active one')
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        const absPath = resolveSigmaDocPath(projectRoot, data, 'intent', opts.v);
        const report = validateSigmaDocFile(absPath, 'intent');
        printSigmaDocReport(report, projectRoot);
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
        const data = readProgress(projectRoot);
        console.log('\n=== DIR-INTENT Status ===\n');
        if (!data.intent.active_version) {
          console.log('No active INTENT. Run: sigma intent new');
        } else {
          const active = data.intent.versions.find(v => v.version === data.intent.active_version);
          console.log(`Version:    ${data.intent.active_version}`);
          console.log(`State:      ${data.intent.active_state}`);
          if (active?.locked_at) console.log(`Locked at:  ${active.locked_at}`);
          if (active?.file) console.log(`File:       ${active.file}`);
        }
        console.log(`\nGate 1:     ${data.gates.gate_1_open ? 'OPEN' : 'BLOCKED'}`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('list')
    .description('List all DIR-INTENT versions')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        console.log('\n=== DIR-INTENT Versions ===\n');
        if (data.intent.versions.length === 0) {
          console.log('None. Run: sigma intent new');
        } else {
          console.log('Version    State        Created                    Locked                     Superseded By');
          console.log('-'.repeat(100));
          for (const v of data.intent.versions) {
            const ver = v.version.padEnd(10);
            const st = v.state.padEnd(12);
            const cr = v.created_at.padEnd(26);
            const lo = (v.locked_at ?? '—').padEnd(26);
            const sup = v.superseded_by ?? '—';
            console.log(`${ver} ${st} ${cr} ${lo} ${sup}`);
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
