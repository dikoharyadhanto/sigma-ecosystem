import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  readProgress,
  writeProgress,
  nextMajorVersion,
  registerIntentDraft,
  lockActiveIntent,
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

export function intentCommand(): Command {
  const cmd = new Command('intent');
  cmd.description('Manage DIR-INTENT artifact');

  cmd.command('new')
    .description('Create a new DIR-INTENT draft')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        const version = nextMajorVersion(data.intent.versions);
        const templatePath = resolveTemplate('DIR-INTENT-TEMPLATE.md');
        const relPath = path.join('Sigma', 'design', `DIR-INTENT-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        fs.ensureDirSync(path.dirname(absPath));
        fs.copySync(templatePath, absPath);
        registerIntentDraft(data, version, relPath);
        writeProgress(projectRoot, data);
        console.log(`Created: ${relPath} — open this file and fill in the intent.`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('review')
    .description('Append AUD advisory findings to active DIR-INTENT (no state change)')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        if (!data.intent.active_version) {
          throw new Error('No active DIR-INTENT found. Run: sigma intent new');
        }
        const activeEntry = data.intent.versions.find(v => v.version === data.intent.active_version);
        const relPath = activeEntry?.file ?? path.join('Sigma', 'design', `DIR-INTENT-${data.intent.active_version}.md`);
        const absPath = path.join(projectRoot, relPath);
        if (!fs.existsSync(absPath)) throw new Error(`Active INTENT file not found: ${relPath}`);
        appendAuditFindings(absPath, 'intent', 'review');
        console.log(`Advisory findings section appended to ${relPath}. Fill in the AUD findings — runtime state unchanged.`);
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
        if (data.intent.active_state !== 'DRAFT') {
          throw new Error('Active DIR-INTENT is not in DRAFT state. Cannot lock.');
        }
        const version = data.intent.active_version!;
        lockActiveIntent(data);
        writeProgress(projectRoot, data);
        console.log(`DIR-INTENT ${version} LOCKED. Gate 1 open. Lifecycle → BUILD. Next: sigma plan new`);
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
