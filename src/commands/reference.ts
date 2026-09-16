import { Command } from 'commander';
import { findProjectRoot } from '../utils/fs';
import { updateReferenceList, ReferenceUpdateError } from '../services/referenceUpdateService';

export function referenceCommand(): Command {
  const cmd = new Command('reference');
  cmd.description('Manage the project-wide reference list (Comprehensive Research source index)');

  cmd
    .command('update')
    .description('Sync the Local Artifact table in Sigma/reference/reference-list.md from Sigma/reference/data/')
    .action(() => {
      try {
        const result = updateReferenceList(findProjectRoot());
        if (result.scaffolded) {
          console.log('  reference-list.md was missing — scaffolded from template (self-heal).');
        }
        console.log(`Reference list synced: ${result.relPath}`);
        console.log(`  New local artifact rows added: ${result.newRowsAdded}`);
        console.log('  Existing rows: never modified (Category/Notes are a manual/AI-role judgment call).');
        if (result.missingFiles.length > 0) {
          console.log('  [WARNING] Local Artifact rows pointing to files no longer on disk (not removed — review manually):');
          for (const missing of result.missingFiles) {
            console.log(`    - ${missing}`);
          }
        }
      } catch (e) {
        if (e instanceof ReferenceUpdateError) {
          console.error(e.message);
        } else {
          console.error((e as Error).message);
        }
        process.exit(1);
      }
    });

  return cmd;
}
