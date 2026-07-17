import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { readOverrides, writeProgress, getInvalidMarkers as getInvalidMarkersLegacy, ProgressJson } from '../engine/progress';
import { readActiveChain, writeChain, runDoctorReconciliation, getInvalidMarkers, listChainVersions } from '../engine/chain';
import { reconstructProgress, findSigmaProjectRoot } from '../engine/reconstruct';
import { findProjectRoot, ensureDir } from '../utils/fs';
import { PROJECT_SIGMA_DIR, PROJECT_IDENTITY_FILE } from '../config';
import { validateProjectId, validateProjectName } from './project';

// PLAN-EVAL-01 Fase 4 — only the default reconciliation mode is migrated to
// chain.ts here (targets the active chain only, matching today's
// single-target behavior). `--reconstruct` is deliberately left on the
// legacy progress.ts/reconstruct.ts path below, untouched: its actual job
// (`discoverArtifacts` scanning every DIR-INTENT-v*.md on disk, potentially
// spanning multiple chains) already *is* the multi-chain grouping work that
// belongs to PLAN-EVAL-05 (`--all-versions`/3-mode `--reconstruct`) — there
// is no smaller "single-chain-only" slice of it to carve out safely here.
// This does mean Fase 5 (deleting progress.ts) has a hidden prerequisite:
// `--reconstruct` needs its own chain.ts port (PLAN-EVAL-05 or a dedicated
// step) before the legacy path it depends on can be removed.

function runDefaultDoctor(): void {
  const projectRoot = findProjectRoot();

  // No chain yet (fresh project, before the first `intent new`) is a valid,
  // doctor-able state — nothing to reconcile, not an error. Matches today's
  // behavior of running cleanly against an empty progress.json.
  if (listChainVersions(projectRoot).length === 0) {
    console.log('\n=== Sigma Doctor ===\n');
    console.log('No chain exists yet. Nothing to reconcile. Run: sigma intent new');
    console.log('');
    return;
  }

  const { chainVersion, data: chain } = readActiveChain(projectRoot);
  const overrides = readOverrides(projectRoot);
  const report = runDoctorReconciliation(chain, overrides);
  writeChain(projectRoot, chainVersion, chain);

  console.log('\n=== Sigma Doctor ===\n');

  if (report.repaired.length > 0) {
    console.log('--- Repaired ---');
    for (const line of report.repaired) {
      console.log(`  - ${line}`);
    }
  }

  if (report.invalidMarked.length > 0) {
    console.log('\n--- Marked INVALID ---');
    for (const marker of report.invalidMarked) {
      console.log(`  - ${marker.id}: ${marker.reason}`);
    }
  }

  if (report.invalidCleared.length > 0) {
    console.log('\n--- Cleared INVALID ---');
    for (const marker of report.invalidCleared) {
      console.log(`  - ${marker.id}`);
    }
  }

  const remaining = getInvalidMarkers(chain);
  console.log('\n--- Current Runtime State ---');
  if (remaining.length === 0) {
    console.log('  VALID');
  } else {
    console.log('  INVALID recovery mode active for affected chains:');
    for (const marker of remaining) {
      console.log(`  - ${marker.id}: ${marker.reason}`);
    }
    console.log('\n  Gate enforcement is temporarily relaxed for affected chains while INVALID markers remain.');
  }

  console.log('');
}

// ── --reconstruct ────────────────────────────────────────────────────────────

function resolveProjectIdentity(projectRoot: string, opts: { id?: string; name?: string }): { id: string; name: string } {
  const progressPath = path.join(projectRoot, PROJECT_SIGMA_DIR, 'progress.json');
  if (fs.existsSync(progressPath)) {
    try {
      const raw = fs.readJsonSync(progressPath) as Partial<ProgressJson>;
      if (raw.project_id && raw.project_name) {
        return { id: raw.project_id, name: raw.project_name };
      }
    } catch {
      // progress.json is unreadable — fall through to other identity sources
    }
  }

  const identityPath = path.join(projectRoot, PROJECT_IDENTITY_FILE);
  if (fs.existsSync(identityPath)) {
    try {
      const identity = fs.readJsonSync(identityPath) as { project_id?: string; project_name?: string };
      if (identity.project_id && identity.project_name) {
        return { id: identity.project_id, name: identity.project_name };
      }
    } catch {
      // identity file is unreadable — fall through
    }
  }

  if (opts.id && opts.name) {
    return { id: validateProjectId(opts.id), name: validateProjectName(opts.name) };
  }

  throw new Error(
    'Cannot determine project identity (project_id/project_name) — progress.json is unreadable and ' +
    '.sigma-identity.json is missing or unreadable. Pass --id <PROJECT_ID> --name <name> to proceed, ' +
    'or run `sigma project register` first if progress.json can still be read.'
  );
}

function runReconstruct(opts: { id?: string; name?: string }): void {
  const projectRoot = findSigmaProjectRoot();
  const identity = resolveProjectIdentity(projectRoot, opts);

  const progressPath = path.join(projectRoot, PROJECT_SIGMA_DIR, 'progress.json');
  if (fs.existsSync(progressPath)) {
    const logsDir = path.join(projectRoot, PROJECT_SIGMA_DIR, 'logs');
    ensureDir(logsDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(logsDir, `reconstruct-backup-${timestamp}.json`);
    fs.copySync(progressPath, backupPath);
    console.log(`Existing progress.json backed up to: ${path.relative(projectRoot, backupPath)}`);
  }

  const { data, notes } = reconstructProgress(projectRoot, identity.id, identity.name);
  writeProgress(projectRoot, data);

  console.log('\n=== Sigma Doctor — Reconstruct ===\n');
  console.log(`Project:    ${data.project_name} (${data.project_id})`);
  console.log(`Lifecycle:  ${data.lifecycle_state}`);
  console.log(
    `Gates:      gate_1_open=${data.gates.gate_1_open} gate_2_open=${data.gates.gate_2_open} ` +
    `gate_3_satisfied=${data.gates.gate_3_satisfied}`
  );

  for (const domain of ['intent', 'roadmap', 'plan', 'exec', 'close'] as const) {
    const tracker = data[domain];
    console.log(`\n${domain.toUpperCase()}: ${tracker.versions.length} version(s) found`);
    for (const v of tracker.versions) {
      console.log(`  - ${v.version} (${v.state})${v.file ? ` — ${v.file}` : ''}`);
    }
  }

  if (notes.length > 0) {
    console.log('\n--- Notes ---');
    for (const note of notes) console.log(`  - ${note}`);
  }

  const markers = getInvalidMarkersLegacy(data);
  if (markers.length > 0) {
    console.log('\n--- Marked INVALID (needs Director review) ---');
    for (const marker of markers) {
      console.log(`  - ${marker.id}: ${marker.reason}`);
    }
    console.log(
      '\nGate enforcement is relaxed for affected chains until these are resolved. ' +
      'Run the appropriate lock/supersede command, then `sigma doctor` again.'
    );
  } else {
    console.log('\nNo ambiguous state — reconstruct is confident in the result above.');
  }

  console.log('');
}

// ── Command ───────────────────────────────────────────────────────────────────

export function doctorCommand(): Command {
  const cmd = new Command('doctor');
  cmd
    .description('Diagnose and reconcile Sigma runtime state')
    .option('--recovery', 'Explicit alias for the default reconciliation behavior (same as running with no flag)')
    .option('--reconstruct', 'Rebuild progress.json from artifact files on disk (use when progress.json is missing or corrupted)')
    .option('--id <PROJECT_ID>', 'Project ID, only used with --reconstruct if it cannot be recovered automatically')
    .option('--name <name>', 'Project name, only used with --reconstruct if it cannot be recovered automatically')
    .action((opts: { recovery?: boolean; reconstruct?: boolean; id?: string; name?: string }) => {
      try {
        if (opts.reconstruct) {
          runReconstruct({ id: opts.id, name: opts.name });
        } else {
          runDefaultDoctor();
        }
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
