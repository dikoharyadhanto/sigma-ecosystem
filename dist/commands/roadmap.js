"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roadmapCommand = roadmapCommand;
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const progress_1 = require("../engine/progress");
const memory_1 = require("../engine/memory");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
function roadmapCommand() {
    const cmd = new commander_1.Command('roadmap');
    cmd.description('Manage ROADMAP artifact');
    cmd.command('new')
        .description('Create a new ROADMAP draft (requires locked DIR-INTENT)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (data.intent.active_state !== 'LOCKED') {
                throw new Error('ROADMAP requires a locked DIR-INTENT. Run: sigma intent lock');
            }
            const draftExists = data.roadmap.versions.some(v => v.state === 'DRAFT');
            if (draftExists) {
                throw new Error('A ROADMAP DRAFT already exists. Lock it before creating a new version. Run: sigma roadmap lock');
            }
            const version = (0, progress_1.nextMajorVersion)(data.roadmap.versions);
            const relPath = path_1.default.join('Sigma', 'build', `ROADMAP-${version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            (0, artifacts_1.copyTemplateToArtifact)('ROADMAP-TEMPLATE.md', absPath);
            (0, progress_1.registerRoadmapDraft)(data, version, relPath);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`Created: ${relPath}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('lock')
        .description('Lock active ROADMAP draft (auto-supersedes prior locked ROADMAP)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const draft = data.roadmap.versions.find(v => v.state === 'DRAFT');
            if (!draft) {
                throw new Error('No ROADMAP DRAFT found. Run: sigma roadmap new');
            }
            const version = draft.version;
            (0, progress_1.lockActiveRoadmap)(data);
            (0, progress_1.writeProgress)(projectRoot, data);
            const sourceFile = data.roadmap.versions.find(v => v.version === version)?.file ?? '';
            (0, memory_1.harvestRoadmapLock)(projectRoot, version, sourceFile);
            console.log(`ROADMAP ${version} LOCKED.`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('list')
        .description('List all ROADMAP versions')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            console.log('\n=== ROADMAP Versions ===\n');
            if (data.roadmap.versions.length === 0) {
                console.log('None. Run: sigma roadmap new');
            }
            else {
                console.log('Version    State        Created                    Locked');
                console.log('-'.repeat(75));
                for (const v of data.roadmap.versions) {
                    const ver = v.version.padEnd(10);
                    const st = v.state.padEnd(12);
                    const cr = v.created_at.padEnd(26);
                    const lo = v.locked_at ?? '—';
                    console.log(`${ver} ${st} ${cr} ${lo}`);
                }
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