"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentCommand = intentCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const progress_1 = require("../engine/progress");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const docCheck_1 = require("../utils/docCheck");
function intentCommand() {
    const cmd = new commander_1.Command('intent');
    cmd.description('Manage DIR-INTENT artifact');
    cmd.command('new')
        .description('Create a new DIR-INTENT draft')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            const version = (0, progress_1.nextMajorVersion)(data.intent.versions);
            const relPath = path_1.default.join('Sigma', 'design', `DIR-INTENT-${version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            (0, artifacts_1.copyTemplateToArtifact)('DIR-INTENT-TEMPLATE.md', absPath);
            (0, progress_1.registerIntentDraft)(data, version, relPath);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`Created: ${relPath} — open this file and fill in the intent.`);
            console.log('Running automatic validation...\n');
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'intent');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('review')
        .description('Append AUD advisory findings to active DIR-INTENT (no state change)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (!data.intent.active_version) {
                throw new Error('No active DIR-INTENT found. Run: sigma intent new');
            }
            const activeEntry = data.intent.versions.find(v => v.version === data.intent.active_version);
            const relPath = activeEntry?.file ?? path_1.default.join('Sigma', 'design', `DIR-INTENT-${data.intent.active_version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            if (!fs_extra_1.default.existsSync(absPath))
                throw new Error(`Active INTENT file not found: ${relPath}`);
            (0, artifacts_1.appendAuditFindings)(absPath, 'intent', 'review');
            console.log(`Advisory findings section appended to ${relPath}. Fill in the AUD findings — runtime state unchanged.`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('lock')
        .description('Lock active DIR-INTENT (opens Gate 1, lifecycle → BUILD)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            (0, progress_1.assertProgressCanMutate)(data);
            if (data.intent.active_state !== 'DRAFT') {
                throw new Error('Active DIR-INTENT is not in DRAFT state. Cannot lock.');
            }
            const absPath = (0, docCheck_1.resolveSigmaDocPath)(projectRoot, data, 'intent');
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'intent');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            (0, docCheck_1.ensureSigmaDocEligible)(report, 'intent');
            const version = data.intent.active_version;
            (0, progress_1.lockActiveIntent)(data);
            (0, progress_1.writeProgress)(projectRoot, data);
            console.log(`DIR-INTENT ${version} LOCKED. Gate 1 open. Lifecycle → BUILD. Next: sigma plan new`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('check')
        .description('Validate the active DIR-INTENT structure and markers')
        .option('--v <version>', 'Check a specific DIR-INTENT version instead of the active one')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            const absPath = (0, docCheck_1.resolveSigmaDocPath)(projectRoot, data, 'intent', opts.v);
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'intent');
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
        .description('Show active DIR-INTENT status')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            console.log('\n=== DIR-INTENT Status ===\n');
            if (!data.intent.active_version) {
                console.log('No active INTENT. Run: sigma intent new');
            }
            else {
                const active = data.intent.versions.find(v => v.version === data.intent.active_version);
                console.log(`Version:    ${data.intent.active_version}`);
                console.log(`State:      ${data.intent.active_state}`);
                if (active?.locked_at)
                    console.log(`Locked at:  ${active.locked_at}`);
                if (active?.file)
                    console.log(`File:       ${active.file}`);
            }
            console.log(`\nGate 1:     ${data.gates.gate_1_open ? 'OPEN' : 'BLOCKED'}`);
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('list')
        .description('List all DIR-INTENT versions')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const data = (0, progress_1.readProgress)(projectRoot);
            console.log('\n=== DIR-INTENT Versions ===\n');
            if (data.intent.versions.length === 0) {
                console.log('None. Run: sigma intent new');
            }
            else {
                console.log('Version    State        Created                    Locked                     Superseded By');
                console.log('-'.repeat(100));
                for (const v of data.intent.versions) {
                    const ver = v.version.padEnd(10);
                    const st = v.state.padEnd(12);
                    const cr = v.created_at.padEnd(26);
                    const lo = (v.locked_at ?? '—').padEnd(26);
                    const sup = v.superseded_by ?? '—';
                    console.log(`${ver} ${st} ${cr} ${lo} ${sup}`);
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
//# sourceMappingURL=intent.js.map