"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCommand = execCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const docCheck_1 = require("../utils/docCheck");
function execDocPath(projectRoot, chain, version) {
    const entry = version
        ? chain.exec.versions.find(v => v.version === version)
        : chain.exec.versions.find(v => v.version === chain.exec.active_version);
    if (!entry)
        throw new Error(version ? `DEV-EXEC ${version} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
    return path_1.default.join(projectRoot, entry.file ?? path_1.default.join('Sigma', 'build', `DEV-EXEC-${entry.version}.md`));
}
// PLAN-IMPL-MULTIDRAFT-LOCK §8.3 (Director directive 2026-08-12) — same
// ambiguity rule as plan.ts's assertPlanCheckUnambiguous(): `check` defaults
// to the active pointer only while unambiguous (0 or 1 open DRAFT).
function assertExecCheckUnambiguous(chain, explicit) {
    if (explicit)
        return;
    const resolution = (0, chain_1.resolveTargetVersion)(chain.exec.versions, undefined);
    if (resolution.kind === 'ambiguous') {
        throw new Error(`${resolution.candidates.length} DRAFT DEV-EXECs are open: ${resolution.candidates.join(', ')}\n` +
            `Specify which one to check: sigma exec check --v ${resolution.candidates[0]}`);
    }
}
function execCommand() {
    const cmd = new commander_1.Command('exec');
    cmd.description('Manage DEV-EXEC artifact');
    cmd.command('new')
        .description('Create a new DEV-EXEC draft (requires a LOCKED FMN-PLAN with no open exec)')
        .option('--plan <version>', 'Explicitly specify which locked plan to execute (required when multiple unexecuted locked plans exist)')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            (0, chain_1.assertChainCanMutate)(chain);
            if (!(0, chain_1.getOperationalGate)(chain, 'gate_2_open')) {
                throw new Error('GATE 2 BLOCKED: No locked FMN-PLAN. Run: sigma plan lock');
            }
            // PLAN-IMPL-MULTIDRAFT-LOCK §4 — the old chain-wide guard ("any exec
            // not LOCKED/SUPERSEDED blocks every new exec, regardless of which
            // plan it references") is replaced by a per-PLAN guard: at most one
            // non-final exec per plan (§2.2 of the source discussion,
            // Director-confirmed cardinality invariant), evaluated against the
            // specific plan being targeted. Candidates for auto-resolution are
            // LOCKED plans with no exec at all in a non-SUPERSEDED state — a
            // plan with an open DRAFT exec is not a candidate for a *new* exec,
            // it already has one to continue.
            const lockedPlans = chain.plan.versions.filter(v => v.state === 'LOCKED');
            const plansWithOpenExec = new Set(chain.exec.versions
                .filter(v => v.state !== 'SUPERSEDED')
                .map(v => v.plan_version_ref)
                .filter((ref) => Boolean(ref)));
            const unexecutedPlans = lockedPlans.filter(p => !plansWithOpenExec.has(p.version));
            let planVersionRef;
            if (opts.plan) {
                planVersionRef = opts.plan;
                const target = lockedPlans.find(p => p.version === planVersionRef);
                if (!target) {
                    const available = lockedPlans.map(p => p.version).join(', ') || '(none)';
                    throw new Error(`FMN-PLAN ${planVersionRef} is not a LOCKED plan.\n` +
                        `LOCKED plans: ${available}`);
                }
                const openExecForPlan = chain.exec.versions.find(v => v.plan_version_ref === planVersionRef && v.state !== 'SUPERSEDED');
                if (openExecForPlan) {
                    throw new Error(`EXEC CONFLICT: FMN-PLAN ${planVersionRef} already has DEV-EXEC ${openExecForPlan.version} in ${openExecForPlan.state} state.\n` +
                        'A plan has at most one execution — continue that DEV-EXEC instead of creating a new one:\n' +
                        `  ${openExecForPlan.file ?? `Sigma/build/DEV-EXEC-${openExecForPlan.version}.md`}\n` +
                        `  sigma exec check --v ${openExecForPlan.version}\n` +
                        'To abandon it instead, supersede its plan and open a new plan version:\n' +
                        `  sigma plan supersede --v ${planVersionRef} --reason "..."`);
                }
            }
            else if (unexecutedPlans.length === 0) {
                throw new Error('All locked plans already have an exec.\n' +
                    'Run: sigma plan new   to create a new plan');
            }
            else if (unexecutedPlans.length === 1) {
                planVersionRef = unexecutedPlans[0].version;
            }
            else {
                const versions = unexecutedPlans.map(p => p.version).join(', ');
                throw new Error(`${unexecutedPlans.length} unexecuted locked plans found: ${versions}\n` +
                    `Specify which to execute: sigma exec new --plan ${unexecutedPlans[0].version}`);
            }
            const version = (0, chain_1.nextExecVersion)(chain, planVersionRef);
            const relPath = path_1.default.join('Sigma', 'build', `DEV-EXEC-${version}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            if (chain.exec.versions.some(v => v.version === version)) {
                throw new Error(`EXEC CONFLICT: DEV-EXEC ${version} already exists in progress-${chainVersion}.json`);
            }
            if (fs_extra_1.default.existsSync(absPath)) {
                throw new Error(`EXEC FILE CONFLICT: ${relPath} already exists. Refusing to overwrite existing DEV-EXEC artifact.`);
            }
            (0, artifacts_1.copyTemplateToArtifact)('DEV-EXEC-TEMPLATE.md', absPath);
            (0, chain_1.registerExecDraft)(chain, version, relPath, planVersionRef);
            (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
            console.log(`Created: ${relPath} (references PLAN ${planVersionRef})`);
            console.log('Running automatic validation...\n');
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'exec');
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
        .description('Lock a DRAFT DEV-EXEC (re-evaluates Gate 3). Requires --v when more than one DRAFT is open.')
        .option('--v <version>', 'DRAFT version to lock (required when more than one DRAFT is open)')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            (0, chain_1.assertChainCanMutate)(chain);
            const resolution = (0, chain_1.resolveTargetVersion)(chain.exec.versions, opts.v);
            if (resolution.kind === 'empty') {
                throw new Error('No DRAFT DEV-EXEC to lock. Run: sigma exec new');
            }
            if (resolution.kind === 'ambiguous') {
                const described = resolution.candidates
                    .map(v => {
                    const entry = chain.exec.versions.find(e => e.version === v);
                    return entry?.plan_version_ref ? `${v} (plan ${entry.plan_version_ref})` : v;
                })
                    .join(', ');
                throw new Error(`${resolution.candidates.length} DRAFT DEV-EXECs are open: ${described}\n` +
                    `Specify which one to lock: sigma exec lock --v ${resolution.candidates[0]}`);
            }
            const lockTargetVersion = resolution.version;
            const absPath = execDocPath(projectRoot, chain, lockTargetVersion);
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'exec');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            (0, docCheck_1.ensureSigmaDocEligible)(report, 'exec');
            (0, chain_1.lockExecVersion)(chain, lockTargetVersion);
            (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
            const gate3 = chain.gates.gate_3_satisfied
                ? 'SATISFIED'
                : 'not satisfied — open work remains';
            console.log(`DEV-EXEC ${lockTargetVersion} LOCKED. Gate 3: ${gate3}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('check')
        .description('Validate a DEV-EXEC structure and markers')
        .option('--v <version>', 'Check a specific DEV-EXEC version. Required when more than one DRAFT is open.')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            assertExecCheckUnambiguous(chain, opts.v);
            const absPath = execDocPath(projectRoot, chain, opts.v);
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'exec');
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
        .description('Show DEV-EXEC chain state: open DRAFTs with plan pairing, LOCKED execs, Gate 3')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            console.log('\n=== DEV-EXEC Status ===\n');
            const drafts = chain.exec.versions
                .filter(v => v.state === 'DRAFT')
                .sort((a, b) => a.created_at.localeCompare(b.created_at));
            const locked = chain.exec.versions
                .filter(v => v.state === 'LOCKED')
                .sort((a, b) => a.created_at.localeCompare(b.created_at));
            const supersededCount = chain.exec.versions.filter(v => v.state === 'SUPERSEDED').length;
            if (drafts.length === 0) {
                console.log('DRAFT: none');
            }
            else {
                console.log(`DRAFT (${drafts.length}):`);
                for (const d of drafts) {
                    console.log(`  ${d.version}  (plan ${d.plan_version_ref ?? '—'})  (created ${d.created_at.slice(0, 10)})`);
                }
            }
            console.log('');
            if (locked.length === 0) {
                console.log('LOCKED: none');
            }
            else {
                console.log(`LOCKED (${locked.length}):`);
                for (const e of locked) {
                    console.log(`  ${e.version}  (plan ${e.plan_version_ref ?? '—'})`);
                }
            }
            console.log(`\nGate 3: ${chain.gates.gate_3_satisfied ? 'SATISFIED' : 'not satisfied'}`);
            if (supersededCount > 0) {
                console.log(`(${supersededCount} SUPERSEDED exec(s) not shown above — run: sigma exec list)`);
            }
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('list')
        .description('List all DEV-EXEC versions')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            console.log('\n=== DEV-EXEC Versions ===\n');
            if (chain.exec.versions.length === 0) {
                console.log('None. Run: sigma exec new');
            }
            else {
                console.log('Version    State        PLAN Ref    Created');
                console.log('-'.repeat(75));
                for (const v of chain.exec.versions) {
                    const ver = v.version.padEnd(10);
                    const st = v.state.padEnd(12);
                    const pr = (v.plan_version_ref ?? '—').padEnd(11);
                    console.log(`${ver} ${st} ${pr} ${v.created_at}`);
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
//# sourceMappingURL=exec.js.map