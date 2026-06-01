"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorCommand = doctorCommand;
const commander_1 = require("commander");
const progress_1 = require("../engine/progress");
const fs_1 = require("../utils/fs");
function doctorCommand() {
    const cmd = new commander_1.Command('doctor');
    cmd
        .description('Diagnose and reconcile Sigma runtime state')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const report = (0, progress_1.runDoctorReconciliation)(data);
            (0, progress_1.writeProgress)(projectRoot, data);
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
            const remaining = (0, progress_1.getInvalidMarkers)(data);
            console.log('\n--- Current Runtime State ---');
            if (remaining.length === 0) {
                console.log('  VALID');
            }
            else {
                console.log('  INVALID recovery mode active for affected chains:');
                for (const marker of remaining) {
                    console.log(`  - ${marker.id}: ${marker.reason}`);
                }
                console.log('\n  Gate enforcement is temporarily relaxed for affected chains while INVALID markers remain.');
            }
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=doctor.js.map