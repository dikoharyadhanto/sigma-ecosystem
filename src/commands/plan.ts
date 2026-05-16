import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  nextMajorVersion,
  registerPlanDraft,
  lockActivePlan,
  supersedePlanVersion,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';
import { GLOBAL_TEMPLATES_DIR } from '../config';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path.join(PACKAGE_ROOT, 'Sigma', 'templates');

function resolveTemplate(name: string): string {
  const global = path.join(GLOBAL_TEMPLATES_DIR, name);
  if (fs.existsSync(global)) return global;
  const bundle = path.join(BUNDLE_TEMPLATES, name);
  if (fs.existsSync(bundle)) return bundle;
  throw new Error('Template not found. Run: sigma setup install');
}

function appendAuditFindings(absPath: string, domain: string, action: string): void {
  const now = new Date().toISOString();
  const section = `\n---\n\n## AUD Advisory Findings\n\n*Appended: ${now}*\n*Operation: sigma ${domain} ${action}*\n*Status: ADVISORY ONLY — does not change runtime state*\n\n**Audit Scope**: [AUD fills this]\n\n**Findings**:\n\n[AUD fills this]\n\n**Recommendation**: [AUD fills this]\n`;
  fs.appendFileSync(absPath, section);
}

export function planCommand(): Command {
  const cmd = new Command('plan');
  cmd.description('Manage FMN-PLAN artifact');

  cmd.command('new')
    .description('Create a new FMN-PLAN draft (requires locked DIR-INTENT)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        if (!data.gates.gate_1_open) {
          throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
        }
        const intentVersionRef = data.intent.active_version!;
        const version = nextMajorVersion(data.plan.versions);
        const templatePath = resolveTemplate('FMN-PLAN-TEMPLATE.md');
        const relPath = path.join('Sigma', 'build', `FMN-PLAN-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        fs.ensureDirSync(path.dirname(absPath));
        fs.copySync(templatePath, absPath);
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

  cmd.command('supersede')
    .description('Supersede a locked FMN-PLAN version')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v1)')
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .action((opts: { v: string; reason: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
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
