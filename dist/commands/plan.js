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
const memory_1 = require("../engine/memory");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
function planCommand() {
    const cmd = new commander_1.Command('plan');
    cmd.description('Manage FMN-PLAN artifact');
    cmd.command('new')
        .description('Create a new FMN-PLAN draft (requires locked DIR-INTENT)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (!data.gates.gate_1_open) {
                throw new Error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
            }
            const intentVersionRef = data.intent.active_version;
            const version = (0, progress_1.nextMajorVersion)(data.plan.versions);
            const relPath = path_1.default.join('Sigma', 'build', `FMN-PLAN-${version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            (0, artifacts_1.copyTemplateToArtifact)('FMN-PLAN-TEMPLATE.md', absPath);
            (0, progress_1.registerPlanDraft)(data, version, relPath, intentVersionRef);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`Created: ${relPath} (references INTENT ${intentVersionRef})`);
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
        .description('Lock active FMN-PLAN (opens Gate 2)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (data.plan.active_state !== 'DRAFT') {
                throw new Error('Active FMN-PLAN is not in DRAFT state. Cannot lock.');
            }
            const version = data.plan.active_version;
            (0, progress_1.lockActivePlan)(data);
            (0, progress_1.writeProgress)(projectRoot, data);
            const sourceFile = data.plan.versions.find(v => v.version === version)?.file ?? '';
            (0, memory_1.harvestPlanLock)(projectRoot, version, sourceFile);
            console.log(`FMN-PLAN ${version} LOCKED. Gate 2 open. Next: sigma exec new`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('supersede')
        .description('Supersede a locked FMN-PLAN version')
        .requiredOption('--v <version>', 'Version to supersede (e.g. v1)')
        .requiredOption('--reason <reason>', 'Reason for superseding')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            (0, progress_1.supersedePlanVersion)(data, opts.v, opts.reason);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`FMN-PLAN ${opts.v} superseded. Reason: ${opts.reason}`);
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
            console.log(`\nGate 2:           ${data.gates.gate_2_open ? 'OPEN' : 'BLOCKED'}`);
            console.log('');
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
            if (data.plan.versions.length === 0) {
                console.log('None. Run: sigma plan new');
            }
            else {
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