import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  nextExecVersion,
  registerExecDraft,
  advanceExecState,
  lockActiveExec,
  supersedeExecVersion,
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

const STAGE_MAP: Record<string, 'BUILDING' | 'TESTING' | 'COMPLETED'> = {
  building: 'BUILDING',
  testing: 'TESTING',
  complete: 'COMPLETED',
};

export function execCommand(): Command {
  const cmd = new Command('exec');
  cmd.description('Manage DEV-EXEC artifact');

  cmd.command('new')
    .description('Create a new DEV-EXEC draft (requires locked FMN-PLAN)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        if (!data.gates.gate_2_open) {
          throw new Error('GATE 2 BLOCKED: No locked FMN-PLAN. Run: sigma plan lock');
        }
        const planVersionRef = data.plan.active_version!;
        const version = nextExecVersion(data.exec.versions);
        const templatePath = resolveTemplate('DEV-EXEC-TEMPLATE.md');
        const relPath = path.join('Sigma', 'build', `DEV-EXEC-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        fs.ensureDirSync(path.dirname(absPath));
        fs.copySync(templatePath, absPath);
        registerExecDraft(data, version, relPath, planVersionRef);
        writeProgress(projectRoot, data);
        console.log(`Created: ${relPath} (references PLAN ${planVersionRef})`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('audit')
    .description('Append AUD advisory findings to active DEV-EXEC (no state change)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        if (!data.exec.active_version) {
          throw new Error('No active DEV-EXEC found. Run: sigma exec new');
        }
        const activeEntry = data.exec.versions.find(v => v.version === data.exec.active_version);
        const relPath = activeEntry?.file ?? path.join('Sigma', 'build', `DEV-EXEC-${data.exec.active_version}.md`);
        const absPath = path.join(projectRoot, relPath);
        if (!fs.existsSync(absPath)) throw new Error(`Active EXEC file not found: ${relPath}`);
        appendAuditFindings(absPath, 'exec', 'audit');
        console.log(`Advisory findings section appended to ${relPath}. Fill in the AUD findings — runtime state unchanged.`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('advance <stage>')
    .description('Advance DEV-EXEC state: building → testing → complete')
    .action((stage: string) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);

        const validStages = Object.keys(STAGE_MAP);
        if (!validStages.includes(stage)) {
          throw new Error(`Invalid stage "${stage}". Must be one of: ${validStages.join(', ')}`);
        }

        const oldState = data.exec.active_state;
        const toState = STAGE_MAP[stage];
        advanceExecState(data, toState);
        writeProgress(projectRoot, data);
        console.log(`DEV-EXEC ${data.exec.active_version}: ${oldState} → ${toState}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('lock')
    .description('Lock active DEV-EXEC (re-evaluates Gate 3)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        if (data.exec.active_state !== 'COMPLETED') {
          throw new Error(
            'Active DEV-EXEC must be in COMPLETED state to lock. Run: sigma exec advance complete'
          );
        }
        const version = data.exec.active_version!;
        lockActiveExec(data);
        writeProgress(projectRoot, data);
        const gate3 = data.gates.gate_3_satisfied
          ? 'SATISFIED'
          : 'not satisfied — stale chain or incomplete chain';
        console.log(`DEV-EXEC ${version} LOCKED. Gate 3: ${gate3}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('supersede')
    .description('Supersede a locked DEV-EXEC version')
    .requiredOption('--v <version>', 'Version to supersede (e.g. v0.1)')
    .requiredOption('--reason <reason>', 'Reason for superseding')
    .action((opts: { v: string; reason: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        supersedeExecVersion(data, opts.v, opts.reason);
        writeProgress(projectRoot, data);
        console.log(`DEV-EXEC ${opts.v} superseded. Reason: ${opts.reason}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('status')
    .description('Show active DEV-EXEC status')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        console.log('\n=== DEV-EXEC Status ===\n');
        if (!data.exec.active_version) {
          console.log('No active EXEC. Run: sigma exec new');
        } else {
          const active = data.exec.versions.find(v => v.version === data.exec.active_version);
          console.log(`Version:          ${data.exec.active_version}`);
          console.log(`State:            ${data.exec.active_state}`);
          if (active?.plan_version_ref) console.log(`PLAN Ref:         ${active.plan_version_ref}`);
          if (active?.stale_intent) console.log(`Stale Intent:     YES`);
          if (active?.locked_at) console.log(`Locked at:        ${active.locked_at}`);
          if (active?.file) console.log(`File:             ${active.file}`);
        }
        console.log(`\nGate 3:           ${data.gates.gate_3_satisfied ? 'SATISFIED' : 'not satisfied'}`);
        console.log('');
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('list')
    .description('List all DEV-EXEC versions')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        console.log('\n=== DEV-EXEC Versions ===\n');
        if (data.exec.versions.length === 0) {
          console.log('None. Run: sigma exec new');
        } else {
          console.log('Version    State        PLAN Ref    Stale  Created');
          console.log('-'.repeat(75));
          for (const v of data.exec.versions) {
            const ver = v.version.padEnd(10);
            const st = v.state.padEnd(12);
            const pr = (v.plan_version_ref ?? '—').padEnd(11);
            const stale = (v.stale_intent ? 'YES' : 'no').padEnd(6);
            console.log(`${ver} ${st} ${pr} ${stale} ${v.created_at}`);
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
