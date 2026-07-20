"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentCommand = intentCommand;
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const artifacts_1 = require("../utils/artifacts");
const docCheck_1 = require("../utils/docCheck");
const intentHistory_1 = require("../utils/intentHistory");
// PLAN-EVAL-01 Fase 2 — first command migrated off progress.ts/readProgress
// onto chain.ts. `--v <version>` on `check`/`supersede` now selects a CHAIN
// (a different progress-v<N>.json), not an array entry within one file —
// PLAN-EVAL-01 §3.7.
function promptApprove(message) {
    return new Promise(resolve => {
        const rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`${message}\nType APPROVE to continue: `, answer => {
            rl.close();
            resolve(answer.trim().toUpperCase() === 'APPROVE');
        });
    });
}
function intentDocPath(projectRoot, chain) {
    return path_1.default.join(projectRoot, chain.intent.file ?? path_1.default.join('Sigma', 'design', `DIR-INTENT-${chain.intent.version}.md`));
}
// PLAN-EVAL-06 §6.2 — intent-history.md is a plain pipe-split table, and
// doctor --reconstruct parses it back to recover title/focus. "|"/newlines would
// corrupt both the render and the recovery parser.
function assertRequiredIntentMetadata(title, focus) {
    if (!title?.trim())
        throw new Error('sigma intent new requires --title <title>');
    if (!focus?.trim())
        throw new Error('sigma intent new requires --focus <focus>');
    if (/[|\n\r]/.test(title)) {
        throw new Error('--title cannot contain "|" or a newline (breaks the intent-history.md table and its recovery parser)');
    }
    if (/[|\n\r]/.test(focus)) {
        throw new Error('--focus cannot contain "|" or a newline (breaks the intent-history.md table and its recovery parser)');
    }
}
function intentCommand() {
    const cmd = new commander_1.Command('intent');
    cmd.description('Manage DIR-INTENT artifact');
    cmd.command('new')
        .description('Create a new DIR-INTENT draft (auto-creates and auto-activates a new chain)')
        .requiredOption('--title <title>', 'Intent title written into Sigma/design/intent-history.md')
        .requiredOption('--focus <focus>', 'Intent focus summary written into Sigma/design/intent-history.md')
        .option('--yes', 'Skip interactive APPROVE prompt when reopening a CLOSED project')
        .action(async (opts) => {
        try {
            assertRequiredIntentMetadata(opts.title, opts.focus);
            const projectRoot = (0, fs_1.findProjectRoot)();
            // Preflight is read-only and best-effort — a brand-new project with
            // no chain yet has nothing to check CLOSED-ness against (PLAN-EVAL-01
            // §4).
            let activeForPreflight = null;
            try {
                activeForPreflight = (0, chain_1.readActiveChain)(projectRoot).data;
            }
            catch {
                // no chain exists yet — first `intent new` on this project
            }
            if (activeForPreflight?.lifecycle_state === 'CLOSED') {
                console.log('\nReopen Preflight\n');
                console.log('The active chain is currently CLOSED. Running this command will create a new, ' +
                    'fully isolated chain and activate it — the CLOSED chain is left untouched.\n');
                if (!opts.yes) {
                    const approved = await promptApprove('Do you wish to continue?');
                    if (!approved) {
                        console.log('Intent creation cancelled.');
                        process.exit(0);
                    }
                }
            }
            const chainVersion = (0, chain_1.nextChainVersion)(projectRoot);
            const relPath = path_1.default.join('Sigma', 'design', `DIR-INTENT-${chainVersion}.md`);
            const absPath = path_1.default.join(projectRoot, relPath);
            (0, artifacts_1.copyTemplateToArtifact)('DIR-INTENT-TEMPLATE.md', absPath);
            const chain = (0, chain_1.createInitialChain)(chainVersion, relPath, opts.title, opts.focus);
            (0, chain_1.writeChain)(projectRoot, chainVersion, chain); // chain file first
            (0, chain_1.writeActivateStatus)(projectRoot, chainVersion); // manifest last — PLAN-EVAL-01 §5.9 write order
            (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — trigger 1/4
            console.log(`Created: ${relPath} — open this file and fill in the intent.`);
            console.log(`Chain ${chainVersion} is now active.`);
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
    cmd.command('lock')
        .description('Lock active DIR-INTENT (opens Gate 1, lifecycle → BUILD)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            (0, chain_1.assertChainCanMutate)(chain);
            if (chain.intent.state !== 'DRAFT') {
                throw new Error('Active DIR-INTENT is not in DRAFT state. Cannot lock.');
            }
            const absPath = intentDocPath(projectRoot, chain);
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'intent');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            (0, docCheck_1.ensureSigmaDocEligible)(report, 'intent');
            const version = chain.intent.version;
            (0, chain_1.lockActiveIntent)(chain);
            (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
            (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — trigger 2/4
            console.log(`DIR-INTENT ${version} LOCKED. Gate 1 open. Lifecycle → BUILD. Next: sigma roadmap new`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('score <n>')
        .description('Record ARC Satisfaction Score for a LOCKED DIR-INTENT (Gate 3.5 pre-condition for `sigma close new` — does not gate `close lock`)')
        .requiredOption('--notes <notes>', 'Rationale for the score')
        .option('--v <version>', 'Chain version to score instead of the active one')
        .action((n, opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { chainVersion, data: chain } = opts.v
                ? { chainVersion: opts.v, data: (0, chain_1.readChain)(projectRoot, opts.v) }
                : (0, chain_1.readActiveChain)(projectRoot);
            (0, chain_1.assertChainCanMutate)(chain);
            const score = Number(n);
            (0, chain_1.recordArcScore)(chain, score, opts.notes);
            (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
            (0, intentHistory_1.renderIntentHistoryFile)(projectRoot);
            const band = (0, chain_1.arcScoreBand)(score);
            console.log(`ARC Score recorded: ${band} (${score})`);
            console.log(`Notes: ${opts.notes}`);
            console.log(`Gate 3.5 (close new): ${(0, chain_1.hasGate35Score)(chain) ? 'OPEN' : 'BLOCKED'}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('supersede')
        .description('Supersede a LOCKED DIR-INTENT chain — cascades SUPERSEDED to its Roadmap/Plan/Exec/Close (requires --director-confirm)')
        .requiredOption('--v <version>', 'Chain version to supersede (e.g. v1) — need not be the active chain')
        .requiredOption('--reason <reason>', 'Reason for superseding')
        .option('--director-confirm', 'Required. Explicit Director authorization to execute the supersede.')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const chain = (0, chain_1.readChain)(projectRoot, opts.v);
            (0, chain_1.assertChainCanMutate)(chain);
            if (chain.intent.state !== 'LOCKED') {
                throw new Error(`INTENT ${opts.v} is in state "${chain.intent.state}"; supersede requires LOCKED.`);
            }
            const cascade = (0, chain_1.previewIntentSupersedeCascade)(chain);
            const total = (cascade.roadmap ? 1 : 0) + cascade.plan.length + cascade.exec.length + (cascade.close ? 1 : 0);
            console.log('\nIntent Supersede Preflight\n');
            console.log(`Target:  DIR-INTENT ${opts.v} (${chain.intent.state})`);
            console.log(`Reason:  ${opts.reason}\n`);
            if (total === 0) {
                console.log('No downstream Roadmap/Plan/Exec/Close artifacts reference this INTENT version.');
            }
            else {
                console.log('The following artifacts will cascade to SUPERSEDED:');
                if (cascade.roadmap)
                    console.log(`  - ROADMAP ${cascade.roadmap.version} [${cascade.roadmap.state}]${cascade.roadmap.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
                for (const v of cascade.plan)
                    console.log(`  - PLAN ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
                for (const v of cascade.exec)
                    console.log(`  - EXEC ${v.version} [${v.state}]${v.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
                if (cascade.close)
                    console.log(`  - CLOSE ${cascade.close.version} [${cascade.close.state}]${cascade.close.state === 'LOCKED' ? '  (LOCKED work)' : ''}`);
            }
            console.log('');
            if (!opts.directorConfirm) {
                console.error('Error: --director-confirm is required to execute an intent supersede.');
                console.error('This command retires an entire INTENT chain and everything under it — Director authority only.');
                console.error('Add --director-confirm to proceed.');
                process.exit(1);
            }
            (0, chain_1.supersedeIntentVersion)(chain, opts.reason);
            (0, chain_1.writeChain)(projectRoot, opts.v, chain);
            (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — trigger 3/4
            console.log(`DIR-INTENT ${opts.v} superseded. Reason: ${opts.reason}`);
            if (total > 0) {
                console.log(`Cascaded to SUPERSEDED: ${cascade.roadmap ? 1 : 0} roadmap, ${cascade.plan.length} plan, ${cascade.exec.length} exec, ${cascade.close ? 1 : 0} close.`);
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('activate')
        .description('Switch which chain is active (analog `git checkout <branch>`) — no --director-confirm required (DISCUSSION "Konsolidasi Lanjutan" bagian 6): default-to-latest + mandatory session bootstrap visibility are the compensating safety net')
        .requiredOption('--v <version>', 'Chain version to activate (e.g. v2)')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const chain = (0, chain_1.readChain)(projectRoot, opts.v); // throws a clear error if the chain doesn't exist
            if (chain.intent.state === 'SUPERSEDED') {
                throw new Error(`INTENT ${opts.v} is SUPERSEDED — permanently ineligible to become active again. Run: sigma intent list`);
            }
            (0, chain_1.writeActivateStatus)(projectRoot, opts.v);
            (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — trigger 4/4 (no-op on content: see plan §3.4)
            console.log(`Active chain switched to ${opts.v}.`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('check')
        .description('Validate a DIR-INTENT structure and markers')
        .option('--v <version>', 'Check a specific chain instead of the active one')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const chain = opts.v ? (0, chain_1.readChain)(projectRoot, opts.v) : (0, chain_1.readActiveChain)(projectRoot).data;
            const absPath = intentDocPath(projectRoot, chain);
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
            console.log('\n=== DIR-INTENT Status ===\n');
            if ((0, chain_1.listChainVersions)(projectRoot).length === 0) {
                console.log('No active INTENT. Run: sigma intent new');
                console.log('\nGate 1:     BLOCKED');
                console.log('');
                return;
            }
            const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            console.log(`Chain:      ${chainVersion}`);
            console.log(`Version:    ${chain.intent.version}`);
            console.log(`State:      ${chain.intent.state}`);
            if (chain.intent.locked_at)
                console.log(`Locked at:  ${chain.intent.locked_at}`);
            if (chain.intent.file)
                console.log(`File:       ${chain.intent.file}`);
            console.log(`\nGate 1:     ${chain.gates.gate_1_open ? 'OPEN' : 'BLOCKED'}`);
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('list')
        .description('List all chains (projection across every progress-v<N>.json — DISCUSSION "Konsolidasi Lanjutan" bagian 2)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            console.log('\n=== DIR-INTENT / Chains ===\n');
            const versions = (0, chain_1.listChainVersions)(projectRoot);
            if (versions.length === 0) {
                console.log('None. Run: sigma intent new');
                console.log('');
                return;
            }
            let activeChainVersion = null;
            try {
                activeChainVersion = (0, chain_1.resolveActiveChainVersion)(projectRoot);
            }
            catch {
                // No chain is eligible to be active (e.g. every chain SUPERSEDED) —
                // still list everything, just without an ACTIVE marker.
            }
            console.log('Chain      Intent State   Lifecycle    Gate1  Gate2  Gate3  Active');
            console.log('-'.repeat(72));
            for (const v of versions) {
                const chain = (0, chain_1.readChain)(projectRoot, v);
                const active = v === activeChainVersion ? '*' : '';
                console.log(`${v.padEnd(10)} ${chain.intent.state.padEnd(14)} ${chain.lifecycle_state.padEnd(12)} ` +
                    `${(chain.gates.gate_1_open ? 'OPEN' : '—').padEnd(6)} ${(chain.gates.gate_2_open ? 'OPEN' : '—').padEnd(6)} ` +
                    `${(chain.gates.gate_3_satisfied ? 'OPEN' : '—').padEnd(6)} ${active}`);
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