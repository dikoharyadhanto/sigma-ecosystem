"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCommand = execCommand;
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const docCheck_1 = require("../utils/docCheck");
const execDraftService_1 = require("../services/execDraftService");
const execHumanizeService_1 = require("../services/execHumanizeService");
const execLockService_1 = require("../services/execLockService");
function execDocPath(projectRoot, chain, version) {
    const entry = version
        ? chain.exec.versions.find(v => v.version === version)
        : chain.exec.versions.find(v => v.version === chain.exec.active_version);
    if (!entry)
        throw new Error(version ? `DEV-EXEC ${version} not found.` : 'No active DEV-EXEC found. Run: sigma exec new');
    return path_1.default.join(projectRoot, entry.file ?? path_1.default.join('Sigma', 'evidence', `DEV-EXEC-${entry.version}.md`));
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
        .option('--plan <version>', 'Explicitly specify which locked plan to execute (required when multiple unexecuted locked plans exist)', chain_1.normalizeVersionArg)
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { relPath, planVersionRef } = (0, execDraftService_1.createExecDraft)({ projectRoot, planVersion: opts.plan });
            const absPath = path_1.default.join(projectRoot, relPath);
            console.log(`Created: ${relPath} (references PLAN ${planVersionRef})`);
            console.log('Running automatic validation...\n');
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'exec');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            if (e instanceof execDraftService_1.ExecDraftError) {
                console.error(e.message);
            }
            else {
                console.error(e.message);
            }
            process.exit(1);
        }
    });
    cmd.command('lock')
        .description('Lock a DRAFT DEV-EXEC (re-evaluates Gate 3). Requires --v when more than one DRAFT is open.')
        .option('--v <version>', 'DRAFT version to lock (required when more than one DRAFT is open)', chain_1.normalizeVersionArg)
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            // Printed unconditionally when a resolvable target exists, pass or
            // fail on what follows — same precedent as `intent ratify`.
            // lockExecDraftUseCase() re-validates internally rather than
            // trusting this report object, so there is no staleness risk from
            // computing it twice.
            const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            const previewVersion = (0, execLockService_1.resolveExecLockTarget)(chain, opts.v);
            (0, docCheck_1.printSigmaDocReport)((0, docCheck_1.validateSigmaDocFile)(execDocPath(projectRoot, chain, previewVersion), 'exec'), projectRoot);
            const result = (0, execLockService_1.lockExecDraftUseCase)(projectRoot, opts.v);
            const gate3 = result.gate3Satisfied ? 'SATISFIED' : 'not satisfied — open work remains';
            console.log(`DEV-EXEC ${result.version} LOCKED. Gate 3: ${gate3}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.1/§4 Fase 3 — one PLAN-EXEC-HUMAN
    // document per plan+exec version pair, keyed on the exec side (exec
    // always mirrors its plan's version — nextExecVersion() guarantees it).
    // Requires the exec to be LOCKED, same reasoning as `intent humanize`
    // requiring RATIFIED: never scaffold a human projection whose source can
    // still change out from under it. `exec lock` itself is never gated on
    // this (§3.4 / CR-01 — the gate belongs at the next `plan new`/`close new`).
    cmd.command('humanize')
        .description('Generate a human-readable projection of a LOCKED plan+exec pair for Notion (Sigma Humanize Operation)')
        .option('--v <version>', 'EXEC version to humanize instead of the active one', chain_1.normalizeVersionArg)
        .option('--force', 'Overwrite an already-generated human projection for this version')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { version, planVersionRef, humanRelPath, ledgerRelPath } = (0, execHumanizeService_1.humanizeExec)({ projectRoot, version: opts.v, force: opts.force });
            console.log(`Created: ${humanRelPath} (sources: FMN-PLAN ${planVersionRef} + DEV-EXEC ${version})`);
            console.log(`Created: ${ledgerRelPath} (internal — never published, never pushed to Notion)`);
            console.log('');
            console.log('Reading /humanize writing rules (setup/targets/claude_code/humanize.md)...');
            console.log(`Drafting ${humanRelPath} using /humanize style rules.`);
            console.log('Fill in both files, then run: sigma notion push');
        }
        catch (e) {
            if (e instanceof execHumanizeService_1.ExecHumanizeError) {
                console.error(e.message);
            }
            else {
                console.error(e.message);
            }
            process.exit(1);
        }
    });
    cmd.command('check')
        .description('Validate a DEV-EXEC structure and markers')
        .option('--v <version>', 'Check a specific DEV-EXEC version. Required when more than one DRAFT is open.', chain_1.normalizeVersionArg)
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