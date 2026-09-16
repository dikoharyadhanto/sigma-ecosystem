"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referenceCommand = referenceCommand;
const commander_1 = require("commander");
const fs_1 = require("../utils/fs");
const referenceUpdateService_1 = require("../services/referenceUpdateService");
function referenceCommand() {
    const cmd = new commander_1.Command('reference');
    cmd.description('Manage the project-wide reference list (Comprehensive Research source index)');
    cmd
        .command('update')
        .description('Sync the Local Artifact table in Sigma/reference/reference-list.md from Sigma/reference/data/')
        .action(() => {
        try {
            const result = (0, referenceUpdateService_1.updateReferenceList)((0, fs_1.findProjectRoot)());
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
        }
        catch (e) {
            if (e instanceof referenceUpdateService_1.ReferenceUpdateError) {
                console.error(e.message);
            }
            else {
                console.error(e.message);
            }
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=reference.js.map