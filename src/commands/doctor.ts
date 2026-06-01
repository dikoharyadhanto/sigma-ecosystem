import { Command } from 'commander';
import {
  readProgress,
  writeProgress,
  runDoctorReconciliation,
  getInvalidMarkers,
} from '../engine/progress';
import { findProjectRoot } from '../utils/fs';

export function doctorCommand(): Command {
  const cmd = new Command('doctor');
  cmd
    .description('Diagnose and reconcile Sigma runtime state')
    .action(() => {
      try {
        const projectRoot = findProjectRoot();
        const data = readProgress(projectRoot);
        const report = runDoctorReconciliation(data);
        writeProgress(projectRoot, data);

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

        const remaining = getInvalidMarkers(data);
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
      } catch (e) {
        console.error((e as Error).message);
        process.exit(1);
      }
    });

  return cmd;
}
