import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  ChainState,
  readActiveChain,
  writeChain,
  nextExecVersion,
  registerExecDraft,
  lockActiveExec,
  assertChainCanMutate,
  getOperationalGate,
} from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import { copyTemplateToArtifact } from '../utils/artifacts';
import {
  ensureSigmaDocEligible,
  printSigmaDocReport,
  validateSigmaDocFile,
} from '../utils/docCheck';

function execDocPath(projectRoot: string, chain: ChainState, version?: string): string {
  const entry = version
    ? chain.exec.versions.find(v => v.version === version)
    : chain.exec.versions.find(v => v.version === chain.exec.active_version);
  if (!entry) throw new Error(version ? `DEV-EXEC ${version} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
  return path.join(projectRoot, entry.file ?? path.join('Sigma', 'build', `DEV-EXEC-${entry.version}.md`));
}

export function execCommand(): Command {
  const cmd = new Command('exec');
  cmd.description('Manage DEV-EXEC artifact');

  cmd.command('new')
    .description('Create a new DEV-EXEC draft (requires locked FMN-PLAN)')
    .option('--plan <version>', 'Explicitly specify which locked plan to execute (required when multiple unexecuted locked plans exist)')
    .action((opts: { plan?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);

        if (!getOperationalGate(chain, 'gate_2_open')) {
          throw new Error('GATE 2 BLOCKED: No locked FMN-PLAN. Run: sigma plan lock');
        }

        // Guard: block if any exec is in a non-final state (not LOCKED or SUPERSEDED)
        const activeExec = chain.exec.versions.find(
          v => v.state !== 'LOCKED' && v.state !== 'SUPERSEDED'
        );
        if (activeExec) {
          throw new Error(
            `EXEC CONFLICT: DEV-EXEC ${activeExec.version} is in ${activeExec.state} state.\n` +
            `Lock it before creating a new exec: sigma exec lock`
          );
        }

        // Find LOCKED plans that do NOT have a corresponding LOCKED exec
        const lockedPlans = chain.plan.versions.filter(v => v.state === 'LOCKED');
        const lockedExecPlanRefs = new Set(
          chain.exec.versions
            .filter(v => v.state === 'LOCKED')
            .map(v => v.plan_version_ref)
            .filter(Boolean)
        );
        const unexecutedPlans = lockedPlans.filter(p => !lockedExecPlanRefs.has(p.version));

        let planVersionRef: string;
        if (unexecutedPlans.length === 0) {
          throw new Error(
            'All locked plans already have locked execs.\n' +
            'Run: sigma plan new   to create a new plan'
          );
        } else if (opts.plan) {
          const specified = unexecutedPlans.find(p => p.version === opts.plan);
          if (!specified) {
            const available = unexecutedPlans.map(p => p.version).join(', ');
            throw new Error(
              `FMN-PLAN ${opts.plan} is not an unexecuted locked plan.\n` +
              `Unexecuted locked plans: ${available}`
            );
          }
          planVersionRef = opts.plan;
        } else if (unexecutedPlans.length === 1) {
          planVersionRef = unexecutedPlans[0].version;
        } else {
          const versions = unexecutedPlans.map(p => p.version).join(', ');
          throw new Error(
            `${unexecutedPlans.length} unexecuted locked plans found: ${versions}\n` +
            `Specify which to execute: sigma exec new --plan ${unexecutedPlans[0].version}`
          );
        }

        const version = nextExecVersion(chain, planVersionRef);
        const relPath = path.join('Sigma', 'build', `DEV-EXEC-${version}.md`);
        const absPath = path.join(projectRoot, relPath);
        if (chain.exec.versions.some(v => v.version === version)) {
          throw new Error(`EXEC CONFLICT: DEV-EXEC ${version} already exists in progress-${chainVersion}.json`);
        }
        if (fs.existsSync(absPath)) {
          throw new Error(`EXEC FILE CONFLICT: ${relPath} already exists. Refusing to overwrite existing DEV-EXEC artifact.`);
        }
        copyTemplateToArtifact('DEV-EXEC-TEMPLATE.md', absPath);
        registerExecDraft(chain, version, relPath, planVersionRef);
        writeChain(projectRoot, chainVersion, chain);
        console.log(`Created: ${relPath} (references PLAN ${planVersionRef})`);
        console.log('Running automatic validation...\n');
        const report = validateSigmaDocFile(absPath, 'exec');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
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
        const { chainVersion, data: chain } = readActiveChain(projectRoot);
        assertChainCanMutate(chain);
        if (chain.exec.active_state !== 'DRAFT') {
          throw new Error('Active DEV-EXEC is not in DRAFT state. Cannot lock.');
        }
        const absPath = execDocPath(projectRoot, chain);
        const report = validateSigmaDocFile(absPath, 'exec');
        printSigmaDocReport(report, projectRoot);
        ensureSigmaDocEligible(report, 'exec');
        const version = chain.exec.active_version!;
        lockActiveExec(chain);
        writeChain(projectRoot, chainVersion, chain);
        const gate3 = chain.gates.gate_3_satisfied
          ? 'SATISFIED'
          : 'not satisfied — stale chain or incomplete chain';
        console.log(`DEV-EXEC ${version} LOCKED. Gate 3: ${gate3}`);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  cmd.command('check')
    .description('Validate the active DEV-EXEC structure and markers')
    .option('--v <version>', 'Check a specific DEV-EXEC version instead of the active one')
    .action((opts: { v?: string }) => {
      try {
        const projectRoot = findProjectRoot();
        const { data: chain } = readActiveChain(projectRoot);
        const absPath = execDocPath(projectRoot, chain, opts.v);
        const report = validateSigmaDocFile(absPath, 'exec');
        printSigmaDocReport(report, projectRoot);
        if (!report.ok) process.exit(1);
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
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== DEV-EXEC Status ===\n');
        if (!chain.exec.active_version) {
          console.log('No active EXEC. Run: sigma exec new');
        } else {
          const active = chain.exec.versions.find(v => v.version === chain.exec.active_version);
          console.log(`Version:          ${chain.exec.active_version}`);
          console.log(`State:            ${chain.exec.active_state}`);
          if (active?.plan_version_ref) console.log(`PLAN Ref:         ${active.plan_version_ref}`);
          if (active?.locked_at) console.log(`Locked at:        ${active.locked_at}`);
          if (active?.file) console.log(`File:             ${active.file}`);
        }
        console.log(`\nGate 3:           ${chain.gates.gate_3_satisfied ? 'SATISFIED' : 'not satisfied'}`);
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
        const { data: chain } = readActiveChain(projectRoot);
        console.log('\n=== DEV-EXEC Versions ===\n');
        if (chain.exec.versions.length === 0) {
          console.log('None. Run: sigma exec new');
        } else {
          console.log('Version    State        PLAN Ref    Created');
          console.log('-'.repeat(75));
          for (const v of chain.exec.versions) {
            const ver = v.version.padEnd(10);
            const st = v.state.padEnd(12);
            const pr = (v.plan_version_ref ?? '—').padEnd(11);
            console.log(`${ver} ${st} ${pr} ${v.created_at}`);
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
