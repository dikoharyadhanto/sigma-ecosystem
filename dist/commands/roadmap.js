"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roadmapCommand = roadmapCommand;
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const progress_1 = require("../engine/progress");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const roadmap_1 = require("../utils/roadmap");
const docCheck_1 = require("../utils/docCheck");
// ── Internal helpers ──────────────────────────────────────────────────────────
function parseMajorFromVersion(version) {
    const match = version.match(/^v(\d+)/);
    if (!match)
        throw new Error(`Cannot parse major version from "${version}"`);
    return parseInt(match[1], 10);
}
function getActiveRoadmapEntry(data) {
    return data.roadmap.versions.find(v => v.state === 'ACTIVE') ?? null;
}
function getRoadmapFilePath(data, projectRoot, version) {
    const entry = data.roadmap.versions.find(v => v.version === version);
    return path_1.default.join(projectRoot, entry?.file ?? path_1.default.join('Sigma', 'build', `ROADMAP-${version}.md`));
}
function promptApprove(message) {
    return new Promise(resolve => {
        const rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`${message}\nType APPROVE to continue: `, answer => {
            rl.close();
            resolve(answer.trim().toUpperCase() === 'APPROVE');
        });
    });
}
// ── Command ───────────────────────────────────────────────────────────────────
function roadmapCommand() {
    const cmd = new commander_1.Command('roadmap');
    cmd.description('Manage ROADMAP artifact');
    // ── roadmap new ─────────────────────────────────────────────────────────────
    cmd.command('new')
        .description('Create a new ROADMAP (requires locked DIR-INTENT; auto-activates if no ACTIVE exists)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (data.intent.active_state !== 'LOCKED') {
                throw new Error('ROADMAP requires a locked DIR-INTENT. Run: sigma intent lock');
            }
            const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
            if (!lockedIntent)
                throw new Error('No locked DIR-INTENT found');
            const intentMajor = parseMajorFromVersion(lockedIntent.version);
            const version = `v${intentMajor}`;
            const hasActive = data.roadmap.versions.some(v => v.state === 'ACTIVE');
            const relPath = path_1.default.join('Sigma', 'build', `ROADMAP-${version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            (0, artifacts_1.copyTemplateToArtifact)('ROADMAP-TEMPLATE.md', absPath);
            (0, progress_1.registerRoadmapDraft)(data, version, relPath, lockedIntent.version);
            (0, progress_1.writeProgress)(projectRoot, data);
            if (hasActive) {
                console.log(`Created: ${relPath} (DRAFT — existing ACTIVE roadmap still in effect)`);
                console.log('Running automatic validation...\n');
                const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'roadmap');
                (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
                if (!report.ok)
                    process.exit(1);
                console.log(`Run: sigma roadmap activate --v ${version}  to activate and demote current ACTIVE to INACTIVE`);
            }
            else {
                console.log(`Created: ${relPath} (ACTIVE — plan new is now unblocked)`);
                console.log('Running automatic validation...\n');
                const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'roadmap');
                (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
                if (!report.ok)
                    process.exit(1);
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('check')
        .description('Validate the active ROADMAP structure and markers')
        .option('--v <version>', 'Check a specific ROADMAP version instead of the active one')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const absPath = (0, docCheck_1.resolveSigmaDocPath)(projectRoot, data, 'roadmap', opts.v);
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'roadmap');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    // ── roadmap activate ─────────────────────────────────────────────────────────
    cmd.command('activate')
        .description('Activate a DRAFT ROADMAP (demotes current ACTIVE to INACTIVE if one exists)')
        .requiredOption('--v <version>', 'ROADMAP version to activate (e.g. v2)')
        .option('--yes', 'Skip interactive APPROVE prompt')
        .action(async (opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const target = data.roadmap.versions.find(v => v.version === opts.v);
            if (!target) {
                throw new Error(`ROADMAP ${opts.v} not found. Run: sigma roadmap list`);
            }
            if (target.state !== 'DRAFT') {
                throw new Error(`ROADMAP ${opts.v} is in state "${target.state}"; activate requires a DRAFT version`);
            }
            const currentActive = getActiveRoadmapEntry(data);
            if (currentActive) {
                console.log('\nRoadmap Activation Preflight\n');
                console.log(`New active roadmap:   ROADMAP ${opts.v}`);
                console.log(`Currently active:     ROADMAP ${currentActive.version}`);
                console.log('\nEffect:');
                console.log(`  ROADMAP ${currentActive.version} will become INACTIVE.`);
                console.log(`  ROADMAP ${opts.v} will become ACTIVE.`);
                console.log(`  New FMN-PLAN artifacts will link to ROADMAP ${opts.v}.\n`);
                if (!opts.yes) {
                    const approved = await promptApprove('');
                    if (!approved) {
                        console.log('Activation cancelled.');
                        process.exit(0);
                    }
                }
            }
            (0, progress_1.activateRoadmap)(data, opts.v);
            (0, progress_1.writeProgress)(projectRoot, data);
            if (currentActive) {
                console.log(`ROADMAP ${currentActive.version} → INACTIVE`);
            }
            console.log(`ROADMAP ${opts.v} → ACTIVE`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    // ── roadmap render ───────────────────────────────────────────────────────────
    cmd.command('render')
        .description('Regenerate the derived Stage Overview table in the ACTIVE ROADMAP')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const active = getActiveRoadmapEntry(data);
            if (!active) {
                throw new Error('No ACTIVE ROADMAP found. Run: sigma roadmap new');
            }
            const roadmapPath = getRoadmapFilePath(data, projectRoot, active.version);
            (0, roadmap_1.renderRoadmapFile)(roadmapPath, data);
            console.log(`ROADMAP ${active.version} Stage Overview regenerated: ${active.file ?? roadmapPath}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    // ── roadmap list ─────────────────────────────────────────────────────────────
    cmd.command('list')
        .description('List all stages in the ACTIVE ROADMAP with title, focus, and plan status')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const active = getActiveRoadmapEntry(data);
            if (!active) {
                console.log('\nNo ACTIVE ROADMAP found. Run: sigma roadmap new\n');
                return;
            }
            const stagePlans = (0, roadmap_1.getStagePlansForRoadmap)(data, active.version);
            console.log(`\n=== ROADMAP ${active.version} — Stage List ===\n`);
            if (stagePlans.length === 0) {
                console.log('No stages found for this ROADMAP. Run: sigma plan new');
                console.log('');
                return;
            }
            const COL_STAGE = 7;
            const COL_STATUS = 10;
            const COL_TITLE = 38;
            const COL_FOCUS = 42;
            console.log('Stage'.padEnd(COL_STAGE) +
                'Status'.padEnd(COL_STATUS) +
                'Title'.padEnd(COL_TITLE) +
                'Focus');
            console.log('-'.repeat(COL_STAGE + COL_STATUS + COL_TITLE + COL_FOCUS));
            for (const plan of stagePlans) {
                const stage = plan.version.replace(/^v/, '');
                const title = plan.title ?? 'TBD';
                const focus = plan.focus ?? 'TBD';
                const stageCol = stage.padEnd(COL_STAGE);
                const statusCol = plan.state.padEnd(COL_STATUS);
                const titleCol = title.length > COL_TITLE - 2
                    ? title.substring(0, COL_TITLE - 4) + '... '
                    : title.padEnd(COL_TITLE);
                const focusCol = focus.length > COL_FOCUS - 2
                    ? focus.substring(0, COL_FOCUS - 4) + '...'
                    : focus;
                console.log(`${stageCol}${statusCol}${titleCol}${focusCol}`);
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
//# sourceMappingURL=roadmap.js.map