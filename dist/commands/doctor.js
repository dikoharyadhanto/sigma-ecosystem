"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorCommand = doctorCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const progress_1 = require("../engine/progress");
const reconstruct_1 = require("../engine/reconstruct");
const fs_1 = require("../utils/fs");
const config_1 = require("../config");
const project_1 = require("./project");
function runDefaultDoctor() {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const data = (0, progress_1.readProgress)(projectRoot);
    const overrides = (0, progress_1.readOverrides)(projectRoot);
    const report = (0, progress_1.runDoctorReconciliation)(data, overrides);
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
    const inactiveIntentWarnings = (0, progress_1.getInactiveIntentWarnings)(data);
    if (inactiveIntentWarnings.length > 0) {
        console.log('\n--- INACTIVE Intent Warnings (non-blocking) ---');
        for (const w of inactiveIntentWarnings) {
            console.log(`  - DIR-INTENT ${w.intentVersion} is INACTIVE but still has: ${w.hangingArtifacts.join(', ')}`);
        }
        console.log('  Run `sigma intent supersede --v <version> --reason ... --director-confirm` if this INTENT is truly retired.');
    }
    console.log('');
}
// ── --reconstruct ────────────────────────────────────────────────────────────
function resolveProjectIdentity(projectRoot, opts) {
    const progressPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'progress.json');
    if (fs_extra_1.default.existsSync(progressPath)) {
        try {
            const raw = fs_extra_1.default.readJsonSync(progressPath);
            if (raw.project_id && raw.project_name) {
                return { id: raw.project_id, name: raw.project_name };
            }
        }
        catch {
            // progress.json is unreadable — fall through to other identity sources
        }
    }
    const identityPath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
    if (fs_extra_1.default.existsSync(identityPath)) {
        try {
            const identity = fs_extra_1.default.readJsonSync(identityPath);
            if (identity.project_id && identity.project_name) {
                return { id: identity.project_id, name: identity.project_name };
            }
        }
        catch {
            // identity file is unreadable — fall through
        }
    }
    if (opts.id && opts.name) {
        return { id: (0, project_1.validateProjectId)(opts.id), name: (0, project_1.validateProjectName)(opts.name) };
    }
    throw new Error('Cannot determine project identity (project_id/project_name) — progress.json is unreadable and ' +
        '.sigma-identity.json is missing or unreadable. Pass --id <PROJECT_ID> --name <name> to proceed, ' +
        'or run `sigma project register` first if progress.json can still be read.');
}
function runReconstruct(opts) {
    const projectRoot = (0, reconstruct_1.findSigmaProjectRoot)();
    const identity = resolveProjectIdentity(projectRoot, opts);
    const progressPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'progress.json');
    if (fs_extra_1.default.existsSync(progressPath)) {
        const logsDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'logs');
        (0, fs_1.ensureDir)(logsDir);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path_1.default.join(logsDir, `reconstruct-backup-${timestamp}.json`);
        fs_extra_1.default.copySync(progressPath, backupPath);
        console.log(`Existing progress.json backed up to: ${path_1.default.relative(projectRoot, backupPath)}`);
    }
    const { data, notes } = (0, reconstruct_1.reconstructProgress)(projectRoot, identity.id, identity.name);
    (0, progress_1.writeProgress)(projectRoot, data);
    console.log('\n=== Sigma Doctor — Reconstruct ===\n');
    console.log(`Project:    ${data.project_name} (${data.project_id})`);
    console.log(`Lifecycle:  ${data.lifecycle_state}`);
    console.log(`Gates:      gate_1_open=${data.gates.gate_1_open} gate_2_open=${data.gates.gate_2_open} ` +
        `gate_3_satisfied=${data.gates.gate_3_satisfied}`);
    for (const domain of ['intent', 'roadmap', 'plan', 'exec', 'close']) {
        const tracker = data[domain];
        console.log(`\n${domain.toUpperCase()}: ${tracker.versions.length} version(s) found`);
        for (const v of tracker.versions) {
            console.log(`  - ${v.version} (${v.state})${v.file ? ` — ${v.file}` : ''}`);
        }
    }
    if (notes.length > 0) {
        console.log('\n--- Notes ---');
        for (const note of notes)
            console.log(`  - ${note}`);
    }
    const markers = (0, progress_1.getInvalidMarkers)(data);
    if (markers.length > 0) {
        console.log('\n--- Marked INVALID (needs Director review) ---');
        for (const marker of markers) {
            console.log(`  - ${marker.id}: ${marker.reason}`);
        }
        console.log('\nGate enforcement is relaxed for affected chains until these are resolved. ' +
            'Run the appropriate lock/supersede command, then `sigma doctor` again.');
    }
    else {
        console.log('\nNo ambiguous state — reconstruct is confident in the result above.');
    }
    console.log('');
}
// ── Command ───────────────────────────────────────────────────────────────────
function doctorCommand() {
    const cmd = new commander_1.Command('doctor');
    cmd
        .description('Diagnose and reconcile Sigma runtime state')
        .option('--recovery', 'Explicit alias for the default reconciliation behavior (same as running with no flag)')
        .option('--reconstruct', 'Rebuild progress.json from artifact files on disk (use when progress.json is missing or corrupted)')
        .option('--id <PROJECT_ID>', 'Project ID, only used with --reconstruct if it cannot be recovered automatically')
        .option('--name <name>', 'Project name, only used with --reconstruct if it cannot be recovered automatically')
        .action((opts) => {
        try {
            if (opts.reconstruct) {
                runReconstruct({ id: opts.id, name: opts.name });
            }
            else {
                runDefaultDoctor();
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=doctor.js.map