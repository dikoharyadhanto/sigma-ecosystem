"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeCommand = closeCommand;
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const progress_1 = require("../engine/progress");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const docCheck_1 = require("../utils/docCheck");
function promptApprove(message) {
    return new Promise(resolve => {
        const rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`${message}\nType APPROVE to continue: `, answer => {
            rl.close();
            resolve(answer.trim().toUpperCase() === 'APPROVE');
        });
    });
}
function evaluateCloseChain(data) {
    const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
    if (!lockedIntent)
        return { hasChain: false };
    const qualifyingPlan = data.plan.versions.find(v => v.state === 'LOCKED' && v.intent_version_ref === lockedIntent.version);
    if (!qualifyingPlan)
        return { hasChain: false };
    const qualifyingExec = data.exec.versions.find(v => v.state === 'LOCKED' && v.plan_version_ref === qualifyingPlan.version);
    if (!qualifyingExec)
        return { hasChain: false };
    return { hasChain: true, intentVersionRef: lockedIntent.version };
}
function closeCommand() {
    const cmd = new commander_1.Command('close');
    cmd.description('Manage DIR-CLOSE artifact');
    cmd.command('new')
        .description('Create a new DIR-CLOSE draft (requires INTENT → PLAN → EXEC locked chain)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const chain = evaluateCloseChain(data);
            if (!chain.hasChain) {
                throw new Error('GATE 3 BLOCKED: Requires INTENT → PLAN → EXEC chain all LOCKED (same version chain). Run: sigma exec lock');
            }
            const version = (0, progress_1.nextMajorVersion)(data.close.versions);
            const relPath = path_1.default.join('Sigma', 'close', `DIR-CLOSE-${version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            (0, artifacts_1.copyTemplateToArtifact)('DIR-CLOSE-TEMPLATE.md', absPath);
            (0, progress_1.registerCloseDraft)(data, version, relPath, chain.intentVersionRef);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`Created: ${relPath}`);
            console.log('Running automatic validation...\n');
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'close');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('lock')
        .description('Lock active DIR-CLOSE (lifecycle → CLOSED); auto-locks the ACTIVE ROADMAP as a side effect')
        .option('--yes', 'Skip interactive APPROVE prompt')
        .action(async (opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (data.close.active_state !== 'DRAFT') {
                throw new Error('Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
            }
            const closeVersion = data.close.active_version;
            const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
            const absPath = (0, docCheck_1.resolveSigmaDocPath)(projectRoot, data, 'close');
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'close');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            (0, docCheck_1.ensureSigmaDocEligible)(report, 'close');
            console.log('\nClose Lock Preflight\n');
            console.log(`Artifact to lock:  DIR-CLOSE ${closeVersion}`);
            if (activeRoadmap) {
                console.log(`Linked roadmap:    ROADMAP ${activeRoadmap.version} ACTIVE`);
                console.log('\nSide effects:');
                console.log(`  - DIR-CLOSE ${closeVersion} will become LOCKED`);
                console.log(`  - ROADMAP ${activeRoadmap.version} will become LOCKED`);
                console.log('  - No more plans can be added to this ROADMAP');
                console.log('  - Project lifecycle will be considered CLOSED\n');
            }
            else {
                console.log('Linked roadmap:    none (no ACTIVE ROADMAP)\n');
                console.log('Side effects:');
                console.log(`  - DIR-CLOSE ${closeVersion} will become LOCKED`);
                console.log('  - Project lifecycle will be considered CLOSED\n');
            }
            if (!opts.yes) {
                const approved = await promptApprove('');
                if (!approved) {
                    console.log('Close lock cancelled.');
                    process.exit(0);
                }
            }
            if (activeRoadmap) {
                (0, progress_1.lockActiveRoadmap)(data);
            }
            (0, progress_1.lockActiveClose)(data);
            (0, progress_1.writeProgress)(projectRoot, data);
            if (activeRoadmap) {
                console.log(`ROADMAP ${activeRoadmap.version} LOCKED.`);
            }
            console.log(`DIR-CLOSE ${closeVersion} LOCKED. Lifecycle → CLOSED. Project is complete.`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('check')
        .description('Validate the active DIR-CLOSE structure and markers')
        .option('--v <version>', 'Check a specific DIR-CLOSE version instead of the active one')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const absPath = (0, docCheck_1.resolveSigmaDocPath)(projectRoot, data, 'close', opts.v);
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'close');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('status')
        .description('Show active DIR-CLOSE status')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            console.log('\n=== DIR-CLOSE Status ===\n');
            if (!data.close.active_version) {
                console.log('No active CLOSE. Run: sigma close new');
            }
            else {
                const active = data.close.versions.find(v => v.version === data.close.active_version);
                console.log(`Version:    ${data.close.active_version}`);
                console.log(`State:      ${data.close.active_state}`);
                if (active?.locked_at)
                    console.log(`Locked at:  ${active.locked_at}`);
                if (active?.file)
                    console.log(`File:       ${active.file}`);
            }
            console.log(`\nLifecycle:  ${data.lifecycle_state}`);
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=close.js.map