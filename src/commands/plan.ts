import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  nextPlanVersion,
  registerPlanDraft,
  lockActivePlan,
  supersedePlanVersion,
  activatePlanDraft,
  assertProgressCanMutate,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { appendAuditFindings, copyTemplateToArtifact } from '../utils/artifacts';

export function planCommand(): Command {
  const cmd = new Command('plan');
  cmd.description('Manage FMN-PLAN artifact');

  cmd.command('new')
    .description('Create a new FMN-PLAN draft (requires locked DIR-INTENT)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        if (!data.gates.gate_1_open) {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        // Use the LOCKED intent version (single-active), not the active version which may be a newer DRAFT.
        const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
        if (!lockedIntent) {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        const existingDraft = data.plan.versions.find(v => v.state === 'DRAFT');
        if (existingDraft) {
          throw new Error(
            `DRAFT CONFLICT: FMN-PLAN ${existingDraft.version} is already in DRAFT state. ` +
            `Lock or supersede the existing draft before creating a new plan.\n` +
            `  Activate it first: sigma plan activate --v ${existingDraft.version}\n` +
            `  Then lock it:      sigma plan lock`
          );
        }
        const intentVersionRef = lockedIntent.version;
        const version = nextPlanVersion(data, intentVersionRef);
        const relPath = path.join('Sigma', 'build', `FMN-PLAN-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        copyTemplateToArtifact('FMN-PLAN-TEMPLATE.md', absPath);
        registerPlanDraft(data, version, relPath, intentVersionRef);
        writeProgress(projectRoot, data);
        console.log(`Created: ${relPath} (references INTENT ${intentVersionRef})`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('audit')
    .description('Append AUD advisory findings to active FMN-PLAN (no state change)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        if (!data.plan.active_version) {
          throw new Error('No active FMN-PLAN found. Run: sigma plan new');
        }
        const activeEntry = data.plan.versions.find(v => v.version === data.plan.active_version);
        const relPath = activeEntry?.file ?? path.join('Sigma', 'build', `FMN-PLAN-${data.plan.active_version}.md`);
        const absPath = path.join(projectRoot, relPath);
        if (!fs.existsSync(absPath)) throw new Error(`Active PLAN file not found: ${relPath}`);
        appendAuditFindings(absPath, 'plan', 'audit');
        console.log(`Advisory findings section appended to ${relPath}. Fill in the AUD findings — runtime state unchanged.`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock active FMN-PLAN (opens Gate 2)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        if (data.plan.active_state !== 'DRAFT') {
          throw new Error('Active FMN-PLAN is not in DRAFT state. Cannot lock.');
        }
        const version = data.plan.active_version!;
        lockActivePlan(data);
        writeProgress(projectRoot, data);
        console.log(`FMN-PLAN ${version} LOCKED. Gate 2 open. Next: sigma exec new`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('activate')
    .description('Set an existing DRAFT FMN-PLAN version as the active plan')
    .requiredOption('--v <version>', 'DRAFT version to activate (e.g. v1.10)')
    .action((opts: { v: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        activatePlanDraft(data, opts.v);
        writeProgress(projectRoot, data);
        console.log(`FMN-PLAN ${opts.v} is now the active draft. Run: sigma plan lock`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('supersede')
    .description('Supersede a locked FMN-PLAN version')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v1)')
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .action((opts: { v: string; reason: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        assertProgressCanMutate(data);
        supersedePlanVersion(data, opts.v, opts.reason);
        writeProgress(projectRoot, data);
        console.log(`FMN-PLAN ${opts.v} superseded. Reason: ${opts.reason}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show active FMN-PLAN status')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        console.log('\n=== FMN-PLAN Status ===\n');
        if (!data.plan.active_version) {
          console.log('No active PLAN. Run: sigma plan new');
        } else {
          const active = data.plan.versions.find(v => v.version === data.plan.active_version);
          console.log(`Version:          ${data.plan.active_version}`);
          console.log(`State:            ${data.plan.active_state}`);
          if (active?.intent_version_ref) console.log(`INTENT Ref:       ${active.intent_version_ref}`);
          if (active?.stale_intent) console.log(`Stale Intent:     YES`);
          if (active?.locked_at) console.log(`Locked at:        ${active.locked_at}`);
          if (active?.file) console.log(`File:             ${active.file}`);
        }
        console.log(`\nGate 2:           ${data.gates.gate_2_open ? 'OPEN' : 'BLOCKED'}`);
        console.log('');
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
        const data = readProgress(projectRoot);
        console.log('\n=== FMN-PLAN Versions ===\n');
        if (data.plan.versions.length === 0) {
          console.log('None. Run: sigma plan new');
        } else {
          console.log('Version    State        INTENT Ref  Stale  Created');
          console.log('-'.repeat(75));
          for (const v of data.plan.versions) {
            const ver = v.version.padEnd(10);
            const st = v.state.padEnd(12);
            const ir = (v.intent_version_ref ?? '—').padEnd(11);
            const stale = (v.stale_intent ? 'YES' : 'no').padEnd(6);
            console.log(`${ver} ${st} ${ir} ${stale} ${v.created_at}`);
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
