import { Command } from 'commander';
import { loadRoleMemory, ROLE_MEMORY_ROLES, RoleMemoryRole } from '../engine/roleMemory';
import { findProjectRoot } from '../utils/fs';

function detectProjectRoot(): string | undefined {
  try {
    return findProjectRoot();
  } catch {
    return undefined;
  }
}

function selectedRoleFromFlags(opts: { arc?: boolean; fmn?: boolean; dev?: boolean; aud?: boolean }): RoleMemoryRole {
  const selected = ROLE_MEMORY_ROLES.filter(role => opts[role.toLowerCase() as 'arc' | 'fmn' | 'dev' | 'aud']);

  if (selected.length !== 1) {
    throw new Error('Exactly one role flag is required: --arc, --fmn, --dev, or --aud.');
  }

  return selected[0];
}

function runMemory(opts: { arc?: boolean; fmn?: boolean; dev?: boolean; aud?: boolean }): void {
  const role = selectedRoleFromFlags(opts);
  const projectRoot = detectProjectRoot();
  const { memory } = loadRoleMemory(role, projectRoot);

  console.log('\n=== Sigma Role Memory ===\n');
  console.log(`Role:       ${memory.role}`);
  console.log(`Authority:  ${memory.authority}`);
  console.log(`Source:     ${memory.source_rule} (${memory.source_rule_version})`);
  console.log(`Updated:    ${memory.memory_updated_at}`);

  console.log('\n--- General Reminders ---');
  memory.general.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item}`);
  });

  console.log(`\n--- ${memory.role} Role Reminders ---`);
  memory.role_specific.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item}`);
  });

  console.log('');
}

export function memoryCommand(): Command {
  const cmd = new Command('memory');
  cmd
    .description('Show Sigma role memory reminders (read-only)')
    .option('--arc', 'Show ARC role memory')
    .option('--fmn', 'Show FMN role memory')
    .option('--dev', 'Show DEV role memory')
    .option('--aud', 'Show AUD role memory')
    .action((opts: { arc?: boolean; fmn?: boolean; dev?: boolean; aud?: boolean }) => {
      try {
        runMemory(opts);
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
