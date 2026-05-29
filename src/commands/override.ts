import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { readProgress, writeProgress, ProgressJson } from '../engine/progress';
import { findProjectRoot } from '../utils/fs';

const OVERRIDE_LOG_FILE = path.join('Sigma', 'memory', 'overrides.jsonl');

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverrideEntry {
  type: 'override';
  timestamp: string;
  artifact: string;
  phase: string;
  gate_bypassed: string;
  reason: string;
  authorized_by: 'Director';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function appendOverrideEntry(projectRoot: string, entry: OverrideEntry): void {
  const filePath = path.join(projectRoot, OVERRIDE_LOG_FILE);
  fs.ensureFileSync(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

function describeBlockedGate(data: ProgressJson): { artifact: string; gate: string; description: string } | null {
  if (!data.gates.gate_1_open) {
    return {
      artifact: 'DIR-INTENT',
      gate: 'Gate 1',
      description: 'Intent Doc (DIR-INTENT) is not LOCKED — Gate 1 is blocked.',
    };
  }
  if (!data.gates.gate_2_open) {
    return {
      artifact: 'FMN-PLAN',
      gate: 'Gate 2',
      description: 'Plan Doc (FMN-PLAN) is not LOCKED — Gate 2 is blocked.',
    };
  }
  if (!data.gates.gate_3_satisfied) {
    return {
      artifact: 'DEV-EXEC',
      gate: 'Gate 3',
      description: 'Execution Evidence (DEV-EXEC) is not LOCKED or evidence chain is incomplete — Gate 3 is not satisfied.',
    };
  }
  return null;
}

function applyOverride(data: ProgressJson, artifact: string): void {
  if (artifact === 'DIR-INTENT') {
    data.gates.gate_1_open = true;
    if (data.lifecycle_state === 'DESIGN') data.lifecycle_state = 'BUILD';
  } else if (artifact === 'FMN-PLAN') {
    data.gates.gate_2_open = true;
  } else if (artifact === 'DEV-EXEC') {
    data.gates.gate_3_satisfied = true;
  }
}

// ── Command handler ───────────────────────────────────────────────────────────

function runOverride(opts: { reason?: string; dryRun?: boolean; directorConfirm?: boolean }): void {
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
  const data = readProgress(projectRoot);

  const blocked = describeBlockedGate(data);

  if (!blocked) {
    console.log('No gate is currently blocked. Override is not needed.');
    console.log(`Lifecycle: ${data.lifecycle_state} — all gates in expected state.`);
    return;
  }

  console.log('\n=== Sigma Override ===\n');
  console.log(`Current phase:   ${data.lifecycle_state}`);
  console.log(`Blocked gate:    ${blocked.gate}`);
  console.log(`Artifact:        ${blocked.artifact}`);
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
    phase: data.lifecycle_state,
    gate_bypassed: blocked.gate,
    reason,
    authorized_by: 'Director',
  };

  applyOverride(data, blocked.artifact);
  writeProgress(projectRoot, data);
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
    .option('--reason <reason>', 'Required. Describe why this override is authorized.')
    .option('--director-confirm', 'Required. Explicit Director authorization to execute the override.')
    .option('--dry-run', 'Show what would be bypassed without modifying state.')
    .action((opts: { reason?: string; dryRun?: boolean; directorConfirm?: boolean }) => {
      try {
        runOverride(opts);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
