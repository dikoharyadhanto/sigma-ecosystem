import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { ChainState, OverrideEntry, readActiveChain, writeChain, resolveTargetVersion, normalizeVersionArg } from '../engine/chain';
import { findProjectRoot } from '../utils/fs';
import { OVERRIDES_FILE } from '../config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function appendOverrideEntry(projectRoot: string, entry: OverrideEntry): void {
  const filePath = path.join(projectRoot, OVERRIDES_FILE);
  fs.ensureFileSync(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

// PLAN-IMPL-MULTIDRAFT-LOCK §8.4 (Director directive 2026-08-12) — override
// is a permanent, audited action, so the version it applies to may never be
// inferred from a display pointer when more than one candidate is open
// (§8.3's ambiguity rule, at its strictest here). DIR-INTENT is unambiguous
// by construction (one intent per chain). FMN-PLAN/DEV-EXEC resolve against
// their open DRAFTs and require --v once more than one exists.
function versionForArtifact(chain: ChainState, artifact: string, explicit: string | undefined): string | null {
  if (artifact === 'DIR-INTENT') return chain.intent.version;

  const versions = artifact === 'FMN-PLAN' ? chain.plan.versions
    : artifact === 'DEV-EXEC' ? chain.exec.versions
    : null;
  if (!versions) return null;

  const resolution = resolveTargetVersion(versions, explicit);
  if (resolution.kind === 'ambiguous') {
    const label = artifact === 'FMN-PLAN' ? 'FMN-PLANs' : 'DEV-EXECs';
    throw new Error(
      `${resolution.candidates.length} DRAFT ${label} are open: ${resolution.candidates.join(', ')}\n` +
      'An override is a permanent, audited action — specify which version it applies to: ' +
      `sigma override --v ${resolution.candidates[0]} --reason "..." --director-confirm`
    );
  }
  if (resolution.kind === 'resolved') return resolution.version;

  // No DRAFT open — fall back to the display pointer (matches prior
  // behavior for chains with no plan/exec created yet, or only SUPERSEDED
  // ones on record).
  return artifact === 'FMN-PLAN' ? chain.plan.active_version : chain.exec.active_version;
}

function describeBlockedGate(chain: ChainState): { artifact: string; gate: string; description: string } | null {
  if (!chain.gates.gate_1_open) {
    return {
      artifact: 'DIR-INTENT',
      gate: 'Gate 1',
      description: 'Intent Doc (DIR-INTENT) is not RATIFIED — Gate 1 is blocked.',
    };
  }
  if (!chain.gates.gate_2_open) {
    return {
      artifact: 'FMN-PLAN',
      gate: 'Gate 2',
      description: 'Plan Doc (FMN-PLAN) is not LOCKED — Gate 2 is blocked.',
    };
  }
  if (!chain.gates.gate_3_satisfied) {
    return {
      artifact: 'DEV-EXEC',
      gate: 'Gate 3',
      description: 'Execution Evidence (DEV-EXEC) is not LOCKED or evidence chain is incomplete — Gate 3 is not satisfied.',
    };
  }
  return null;
}

function applyOverride(chain: ChainState, artifact: string): void {
  if (artifact === 'DIR-INTENT') {
    chain.gates.gate_1_open = true;
    if (chain.lifecycle_state === 'DESIGN') chain.lifecycle_state = 'BUILD';
  } else if (artifact === 'FMN-PLAN') {
    chain.gates.gate_2_open = true;
  } else if (artifact === 'DEV-EXEC') {
    chain.gates.gate_3_satisfied = true;
  }
}

// ── Command handler ───────────────────────────────────────────────────────────

function runOverride(opts: { v?: string; reason?: string; dryRun?: boolean; directorConfirm?: boolean }): void {
  if (!opts.reason || opts.reason.trim().length === 0) {
    console.error('Error: --reason is required. Describe why this override is authorized.');
    console.error('Example: sigma override --reason "Director decision: ..." --director-confirm');
    process.exit(1);
  }

  if (!opts.dryRun && !opts.directorConfirm) {
    console.error('Error: --director-confirm is required to execute an override.');
    console.error('This command is restricted to Director authority.');
    console.error('Add --director-confirm to proceed, or --dry-run to preview.');
    process.exit(1);
  }

  const reason = opts.reason.trim();
  const projectRoot = findProjectRoot();
  const { chainVersion, data: chain } = readActiveChain(projectRoot);

  const blocked = describeBlockedGate(chain);

  if (!blocked) {
    console.log('No gate is currently blocked. Override is not needed.');
    console.log(`Lifecycle: ${chain.lifecycle_state} — all gates in expected state.`);
    return;
  }

  // Resolved before any output beyond the blocker summary — an ambiguous
  // target must fail the same way in --dry-run as it would for real, so the
  // preview is trustworthy.
  const version = versionForArtifact(chain, blocked.artifact, opts.v);

  console.log('\n=== Sigma Override ===\n');
  console.log(`Current phase:   ${chain.lifecycle_state}`);
  console.log(`Blocked gate:    ${blocked.gate}`);
  console.log(`Artifact:        ${blocked.artifact}${version ? ` ${version}` : ''}`);
  console.log(`\nBlocker:         ${blocked.description}`);
  console.log(`\nOverride reason: ${reason}`);

  if (opts.dryRun) {
    console.log('\n[Dry run] No changes applied. Remove --dry-run to execute.');
    return;
  }

  const entry: OverrideEntry = {
    type: 'override',
    timestamp: new Date().toISOString(),
    artifact: blocked.artifact,
    phase: chain.lifecycle_state,
    gate_bypassed: blocked.gate,
    reason,
    authorized_by: 'Director',
    version,
  };

  applyOverride(chain, blocked.artifact);
  writeChain(projectRoot, chainVersion, chain);
  appendOverrideEntry(projectRoot, entry);

  console.log(`\nOverride applied: ${blocked.gate} (${blocked.artifact}) bypassed.`);
  console.log('Audit record written to Sigma/memory/overrides.jsonl.');
  console.log(`Next valid operations: sigma project status`);
}

// ── Command builder ───────────────────────────────────────────────────────────

export function overrideCommand(): Command {
  const cmd = new Command('override');
  cmd.description('Bypass the current lifecycle gate under Director authority (recorded in Sigma/memory/overrides.jsonl)');

  cmd
    .option('--v <version>', 'Artifact version this override applies to. Required when more than one DRAFT is open for the blocked artifact.', normalizeVersionArg)
    .option('--reason <reason>', 'Required. Describe why this override is authorized.')
    .option('--director-confirm', 'Required. Explicit Director authorization to execute the override.')
    .option('--dry-run', 'Show what would be bypassed without modifying state.')
    .action((opts: { v?: string; reason?: string; dryRun?: boolean; directorConfirm?: boolean }) => {
      try {
        runOverride(opts);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
