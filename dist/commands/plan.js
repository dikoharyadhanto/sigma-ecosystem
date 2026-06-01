"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planCommand = planCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const progress_1 = require("../engine/progress");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const roadmap_1 = require("../utils/roadmap");
function generatePendingId() {
    return Math.random().toString(36).slice(2, 6).toLowerCase();
}
function readPendingTitle(absPath) {
    if (!fs_extra_1.default.existsSync(absPath))
        return '(no file)';
    try {
        const firstLine = fs_extra_1.default.readFileSync(absPath, 'utf8').split('\n')[0] ?? '';
        return firstLine.startsWith('# ') ? firstLine.slice(2).trim() : absPath;
    }
    catch {
        return absPath;
    }
}
function getActiveRoadmapPath(projectRoot, data) {
    const active = data.roadmap.versions.find(v => v.state === 'ACTIVE');
    if (!active)
        return null;
    return path_1.default.join(projectRoot, active.file ?? path_1.default.join('Sigma', 'build', `ROADMAP-${active.version}.md`));
}
function planCommand() {
    const cmd = new commander_1.Command('plan');
    cmd.description('Manage FMN-PLAN artifact');
    cmd.command('new')
        .description('Create a new FMN-PLAN draft (requires locked DIR-INTENT + ACTIVE ROADMAP). Use --pending to stage a future plan without entering the version queue.')
        .option('--pending', 'Stage as a pending plan (no version assigned; not in lock queue)')
        .option('--title <title>', 'Stage title written into the ROADMAP stage heading and stage overview table')
        .option('--focus <focus>', 'Stage focus summary written into the ROADMAP stage overview table')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (opts.pending) {
                // Pending plan: no gate requirement, no version
                const id = generatePendingId();
                const relPath = path_1.default.join('Sigma', 'pending', `FMN-PLAN-${id}.md`);
                const absPath = path_1.default.join(projectRoot, relPath);
                fs_extra_1.default.ensureDirSync(path_1.default.dirname(absPath));
                (0, artifacts_1.copyTemplateToArtifact)('FMN-PLAN-TEMPLATE.md', absPath);
                (0, progress_1.registerPendingPlan)(data, id, relPath);
                (0, progress_1.writeProgress)(projectRoot, data);
                console.log(`Created: ${relPath} (pending — ID: ${id})`);
                console.log(`Run: sigma plan promote --id ${id}   to assign a version and enter the draft queue`);
                return;
            }
            if (!(0, progress_1.getOperationalGate)(data, 'gate_1_open')) {
                throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
            }
            const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
            if (!lockedIntent) {
                throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
            }
            // Gate 1.5: require ACTIVE ROADMAP
            const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
            if (!activeRoadmap) {
                throw new Error('Gate 1.5 blocked: An ACTIVE ROADMAP must exist before FMN-PLAN can be created.\n' +
                    'Run: sigma roadmap new\n' +
                    'If another ROADMAP is already ACTIVE, create the new one as DRAFT then run:\n' +
                    '  sigma roadmap activate --v <ver>');
            }
            const intentVersionRef = lockedIntent.version;
            const version = (0, progress_1.nextPlanVersion)(data, intentVersionRef);
            const relPath = path_1.default.join('Sigma', 'build', `FMN-PLAN-${version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            // Artifact writes first, writeProgress last
            (0, artifacts_1.copyTemplateToArtifact)('FMN-PLAN-TEMPLATE.md', absPath);
            const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
            if (roadmapAbsPath) {
                (0, roadmap_1.appendRoadmapSectionStub)(roadmapAbsPath, version, opts.title, opts.focus);
            }
            (0, progress_1.registerPlanDraft)(data, version, relPath, intentVersionRef, opts.title, opts.focus);
            (0, progress_1.writeProgress)(projectRoot, data);
            // Render after state is written (idempotent re-sync)
            if (roadmapAbsPath) {
                (0, roadmap_1.renderRoadmapFile)(roadmapAbsPath, data);
            }
            console.log(`Created: ${relPath} (references INTENT ${intentVersionRef})`);
            if (roadmapAbsPath) {
                console.log(`ROADMAP updated: Stage ${version.replace(/^v/, '')} appended + derived sections regenerated`);
                console.log(`NOTE: Roadmap has been updated. FMN needs to update the content in the Roadmap.`);
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('audit')
        .description('Append AUD advisory findings to active FMN-PLAN (no state change)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (!data.plan.active_version) {
                throw new Error('No active FMN-PLAN found. Run: sigma plan new');
            }
            const activeEntry = data.plan.versions.find(v => v.version === data.plan.active_version);
            const relPath = activeEntry?.file ?? path_1.default.join('Sigma', 'build', `FMN-PLAN-${data.plan.active_version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            if (!fs_extra_1.default.existsSync(absPath))
                throw new Error(`Active PLAN file not found: ${relPath}`);
            (0, artifacts_1.appendAuditFindings)(absPath, 'plan', 'audit');
            console.log(`Advisory findings section appended to ${relPath}. Fill in the AUD findings — runtime state unchanged.`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('lock')
        .description('Lock oldest DRAFT FMN-PLAN in FIFO order (opens Gate 2)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const version = (0, progress_1.lockOldestPlanDraft)(data);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`FMN-PLAN ${version} LOCKED. Gate 2 open. Next: sigma exec new`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('activate')
        .description('Set an existing DRAFT FMN-PLAN version as the active plan (for display/status only; lock order remains FIFO)')
        .requiredOption('--v <version>', 'DRAFT version to activate (e.g. v1.10)')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            (0, progress_1.activatePlanDraft)(data, opts.v);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`FMN-PLAN ${opts.v} set as active draft (lock order remains FIFO — sigma plan lock will lock the oldest DRAFT).`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('supersede')
        .description('Supersede a locked FMN-PLAN version (auto-supersedes all linked DEV-EXEC versions)')
        .requiredOption('--v <version>', 'Version to supersede (e.g. v1)')
        .requiredOption('--reason <reason>', 'Reason for superseding')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const cascadedExecs = data.exec.versions
                .filter(v => v.plan_version_ref === opts.v && v.state !== 'SUPERSEDED')
                .map(v => v.version);
            (0, progress_1.supersedePlanVersion)(data, opts.v, opts.reason);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`FMN-PLAN ${opts.v} superseded. Reason: ${opts.reason}`);
            if (cascadedExecs.length > 0) {
                console.log(`Auto-superseded DEV-EXEC: ${cascadedExecs.join(', ')}`);
            }
            const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
            if (activeRoadmap) {
                const roadmapPath = path_1.default.join(projectRoot, activeRoadmap.file ?? path_1.default.join('Sigma', 'build', `ROADMAP-${activeRoadmap.version}.md`));
                if (fs_extra_1.default.existsSync(roadmapPath)) {
                    (0, roadmap_1.renderRoadmapFile)(roadmapPath, data);
                    console.log(`ROADMAP ${activeRoadmap.version} re-rendered with SUPERSEDED status.`);
                }
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('promote')
        .description('Promote a pending plan into the official draft queue with an assigned version')
        .requiredOption('--id <id>', 'Pending plan ID to promote (e.g. a3b9)')
        .option('--title <title>', 'Stage title written into the ROADMAP stage heading and stage overview table')
        .option('--focus <focus>', 'Stage focus summary written into the ROADMAP stage overview table')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const pending = data.plan.pending.find(p => p.id === opts.id);
            if (!pending) {
                throw new Error(`Pending plan ID "${opts.id}" not found.\n` +
                    `Run: sigma plan queue   to list pending plans`);
            }
            if (!(0, progress_1.getOperationalGate)(data, 'gate_1_open')) {
                throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
            }
            const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
            if (!lockedIntent)
                throw new Error('No locked DIR-INTENT found');
            const activeRoadmap = data.roadmap.versions.find(v => v.state === 'ACTIVE');
            if (!activeRoadmap) {
                throw new Error('Gate 1.5 blocked: An ACTIVE ROADMAP must exist to promote a plan.\n' +
                    'Run: sigma roadmap new');
            }
            // Compute next version before any writes
            const newVersion = (0, progress_1.nextPlanVersion)(data, lockedIntent.version);
            const oldAbsPath = path_1.default.join(projectRoot, pending.file);
            const newRelPath = path_1.default.join('Sigma', 'build', `FMN-PLAN-${newVersion}.md`);
            const newAbsPath = path_1.default.join(projectRoot, newRelPath);
            // Artifact writes first: rename file + append ROADMAP stub
            fs_extra_1.default.ensureDirSync(path_1.default.dirname(newAbsPath));
            fs_extra_1.default.moveSync(oldAbsPath, newAbsPath);
            const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
            if (roadmapAbsPath) {
                (0, roadmap_1.appendRoadmapSectionStub)(roadmapAbsPath, newVersion, opts.title, opts.focus);
            }
            // Write progress last
            (0, progress_1.promotePendingPlan)(data, opts.id, newVersion, newRelPath, lockedIntent.version, opts.title, opts.focus);
            (0, progress_1.writeProgress)(projectRoot, data);
            // Render after state is written (idempotent)
            if (roadmapAbsPath) {
                (0, roadmap_1.renderRoadmapFile)(roadmapAbsPath, data);
            }
            console.log(`Promoted: ${pending.file} → ${newRelPath} (${newVersion})`);
            if (roadmapAbsPath) {
                console.log(`ROADMAP updated: Stage ${newVersion.replace(/^v/, '')} appended + derived sections regenerated`);
                console.log(`NOTE: Roadmap has been updated. FMN needs to update the content in the Roadmap.`);
            }
            console.log(`Run: sigma plan lock   to lock ${newVersion} when ready`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('queue')
        .description('Show the FIFO draft lock queue and pending plans (read-only diagnostic)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const drafts = data.plan.versions
                .filter(v => v.state === 'DRAFT')
                .sort((a, b) => a.created_at.localeCompare(b.created_at));
            const pending = data.plan.pending;
            console.log('\n=== FMN-PLAN Queue ===\n');
            if (drafts.length === 0) {
                console.log('Official Draft Queue: empty');
            }
            else {
                console.log('Official Draft Queue (FIFO — oldest locks first):');
                drafts.forEach((d, i) => {
                    const date = d.created_at.slice(0, 10);
                    console.log(`  ${i + 1}. FMN-PLAN ${d.version}  DRAFT  (created ${date})`);
                });
                console.log(`\nNext lock target: FMN-PLAN ${drafts[0].version}`);
            }
            console.log('');
            if (pending.length === 0) {
                console.log('Pending Plans: none');
            }
            else {
                console.log('Pending Plans (not in lock queue):');
                for (const p of pending) {
                    const absPath = path_1.default.join(projectRoot, p.file);
                    const title = readPendingTitle(absPath);
                    const date = p.created_at.slice(0, 10);
                    console.log(`  ${p.id} — ${title}  (created ${date})`);
                }
            }
            console.log('');
            if (pending.length > 0) {
                console.log(`Run: sigma plan promote --id ${pending[0].id}    to promote a pending plan to the draft queue`);
            }
            if (drafts.length > 0) {
                console.log('Run: sigma plan lock                  to lock the oldest draft');
            }
            if (pending.length === 0 && drafts.length === 0) {
                console.log('No plans in queue. Run: sigma plan new');
            }
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('status')
        .description('Show active FMN-PLAN status')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            console.log('\n=== FMN-PLAN Status ===\n');
            if (!data.plan.active_version) {
                console.log('No active PLAN. Run: sigma plan new');
            }
            else {
                const active = data.plan.versions.find(v => v.version === data.plan.active_version);
                console.log(`Version:          ${data.plan.active_version}`);
                console.log(`State:            ${data.plan.active_state}`);
                if (active?.intent_version_ref)
                    console.log(`INTENT Ref:       ${active.intent_version_ref}`);
                if (active?.stale_intent)
                    console.log(`Stale Intent:     YES`);
                if (active?.locked_at)
                    console.log(`Locked at:        ${active.locked_at}`);
                if (active?.file)
                    console.log(`File:             ${active.file}`);
            }
            const drafts = data.plan.versions.filter(v => v.state === 'DRAFT');
            if (drafts.length > 1) {
                console.log(`\nDraft queue:      ${drafts.length} drafts (run: sigma plan queue)`);
            }
            if (data.plan.pending.length > 0) {
                console.log(`Pending plans:    ${data.plan.pending.length} (run: sigma plan queue)`);
            }
            console.log(`\nGate 2:           ${data.gates.gate_2_open ? 'OPEN' : 'BLOCKED'}`);
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('update')
        .description('Update title and/or focus for an existing FMN-PLAN stage in the active ROADMAP')
        .requiredOption('--v <version>', 'Plan version to update (e.g. v1.15)')
        .option('--title <title>', 'New stage title')
        .option('--focus <focus>', 'New stage focus summary')
        .action((opts) => {
        try {
            if (!opts.title && !opts.focus) {
                throw new Error('Provide at least one of --title or --focus');
            }
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const planEntry = data.plan.versions.find(v => v.version === opts.v);
            if (!planEntry) {
                throw new Error(`FMN-PLAN ${opts.v} not found. Run: sigma plan list`);
            }
            const roadmapAbsPath = getActiveRoadmapPath(projectRoot, data);
            if (!roadmapAbsPath) {
                throw new Error('No ACTIVE ROADMAP found. Run: sigma roadmap new');
            }
            (0, progress_1.updatePlanMetadata)(data, opts.v, opts.title, opts.focus);
            (0, progress_1.writeProgress)(projectRoot, data);
            const stageVersion = opts.v.replace(/^v/, '');
            (0, roadmap_1.updateStageMetadata)(roadmapAbsPath, stageVersion, opts.title, opts.focus);
            (0, roadmap_1.renderRoadmapFile)(roadmapAbsPath, data);
            const parts = [];
            if (opts.title)
                parts.push(`title → "${opts.title}"`);
            if (opts.focus)
                parts.push(`focus → "${opts.focus}"`);
            console.log(`FMN-PLAN ${opts.v}: ${parts.join(', ')}`);
            console.log(`ROADMAP updated: Stage ${stageVersion} metadata updated + derived sections regenerated`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('list')
        .description('List all FMN-PLAN versions')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            console.log('\n=== FMN-PLAN Versions ===\n');
            if (data.plan.versions.length === 0 && data.plan.pending.length === 0) {
                console.log('None. Run: sigma plan new');
            }
            else {
                if (data.plan.versions.length > 0) {
                    console.log('Version    State        INTENT Ref  Stale  Created');
                    console.log('-'.repeat(75));
                    for (const v of data.plan.versions) {
                        const ver = v.version.padEnd(10);
                        const st = v.state.padEnd(12);
                        const ir = (v.intent_version_ref ?? '—').padEnd(11);
                        const stale = (v.stale_intent ? 'YES' : 'no').padEnd(6);
                        console.log(`${ver} ${st} ${ir} ${stale} ${v.created_at}`);
                    }
                }
                if (data.plan.pending.length > 0) {
                    console.log('\nPending Plans (ID / file / created):');
                    for (const p of data.plan.pending) {
                        console.log(`  ${p.id}  ${p.file}  ${p.created_at}`);
                    }
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
//# sourceMappingURL=plan.js.map