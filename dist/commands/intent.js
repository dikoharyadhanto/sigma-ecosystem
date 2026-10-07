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
const docCheck_1 = require("../utils/docCheck");
const intentHistory_1 = require("../utils/intentHistory");
const intentDraftService_1 = require("../services/intentDraftService");
const intentRatifyService_1 = require("../services/intentRatifyService");
const intentAmendmentService_1 = require("../services/intentAmendmentService");
const intentBaselineService_1 = require("../services/intentBaselineService");
const governanceTransaction_1 = require("../engine/governanceTransaction");
const intentGit_1 = require("../engine/intentGit");
const intentScoreService_1 = require("../services/intentScoreService");
const intentSupersedeService_1 = require("../services/intentSupersedeService");
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
function printGitReport(report) {
    for (const c of report.checks) {
        const tag = c.ok ? 'OK  ' : c.blocking ? 'FAIL' : 'WARN';
        console.log(`  [${tag}] ${c.id}: ${c.detail}`);
    }
}
function intentDocPath(projectRoot, chain) {
    return path_1.default.join(projectRoot, chain.intent.file ?? path_1.default.join('Sigma', 'charter', `DIR-INTENT-${chain.intent.version}.md`));
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
            const projectRoot = (0, fs_1.findProjectRoot)();
            // Preflight is read-only and best-effort — a brand-new project with
            // no chain yet has nothing to check CLOSED-ness against (PLAN-EVAL-01
            // §4). Only used here to decide whether to show the interactive
            // prompt; createIntentDraft() enforces the rule itself regardless of
            // what this preflight finds.
            let activeForPreflight = null;
            try {
                activeForPreflight = (0, chain_1.readActiveChain)(projectRoot).data;
            }
            catch {
                // no chain exists yet — first `intent new` on this project
            }
            // Not CLOSED → nothing to confirm; createIntentDraft()'s check is a
            // no-op either way. CLOSED → this flag is only ever set true once
            // confirmation (interactive or --yes) has actually happened below.
            let allowReopenClosed = activeForPreflight?.lifecycle_state !== 'CLOSED';
            if (activeForPreflight?.lifecycle_state === 'CLOSED') {
                console.log('\nReopen Preflight\n');
                console.log('The active chain is currently CLOSED. Running this command will create a new, ' +
                    'fully isolated chain and activate it — the CLOSED chain is left untouched.\n');
                if (opts.yes) {
                    allowReopenClosed = true;
                }
                else {
                    const approved = await promptApprove('Do you wish to continue?');
                    if (!approved) {
                        console.log('Intent creation cancelled.');
                        process.exit(0);
                    }
                    allowReopenClosed = true;
                }
            }
            const { chainVersion, relPath } = (0, intentDraftService_1.createIntentDraft)({
                projectRoot,
                title: opts.title ?? '',
                focus: opts.focus ?? '',
                allowReopenClosed,
            });
            const absPath = path_1.default.join(projectRoot, relPath);
            console.log(`Created: ${relPath} — open this file and fill in the intent.`);
            console.log(`Chain ${chainVersion} is now active.`);
            console.log('Running automatic validation...\n');
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'intent');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if (!report.ok)
                process.exit(1);
        }
        catch (e) {
            if (e instanceof intentDraftService_1.IntentDraftError) {
                console.error(e.message);
            }
            else {
                console.error(e.message);
            }
            process.exit(1);
        }
    });
    cmd.command('ratify')
        .description('Ratify active DIR-INTENT (opens Gate 1, lifecycle → BUILD)')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { data: chain } = (0, chain_1.readActiveChain)(projectRoot);
            // Same guard ratifyIntentDraft() runs internally — called here too,
            // ahead of the doc report below, so a semantically corrupted chain
            // (e.g. intent.version/chain_version mismatch) fails with its own
            // clear error instead of an ENOENT from trying to read a doc path
            // that guard would have refused to trust in the first place.
            // Read-only, so duplicating it costs nothing beyond one extra call.
            (0, chain_1.assertChainCanMutate)(chain);
            // Printed unconditionally when DRAFT, pass or fail on what follows —
            // Director needs to see why a ratify was refused. ratifyIntentDraft()
            // re-validates internally rather than trusting this report object, so
            // there is no staleness risk from computing it twice.
            if (chain.intent.state === 'DRAFT') {
                const absPath = intentDocPath(projectRoot, chain);
                (0, docCheck_1.printSigmaDocReport)((0, docCheck_1.validateSigmaDocFile)(absPath, 'intent'), projectRoot);
            }
            const { version } = (0, intentRatifyService_1.ratifyIntentDraft)(projectRoot);
            console.log(`DIR-INTENT ${version} RATIFIED. Gate 1 open. Lifecycle → BUILD. Next: sigma roadmap new`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    // Tombstone — `sigma intent lock` was renamed to `sigma intent ratify`
    // (Director directive 2026-08-12), removed outright with no alias. This
    // does not ratify anything; it exists only so the old command name fails
    // with a message pointing at the new one, instead of commander's generic
    // "unknown command" error.
    cmd.command('lock')
        .description('Removed — use `sigma intent ratify`')
        .action(() => {
        console.error('Error: `sigma intent lock` has been removed. Use `sigma intent ratify`.');
        console.error('DIR-INTENT is ratified, not locked — see SIGMA_PROTOCOL §5.1.');
        process.exit(1);
    });
    // Amendment (F05) — Git-based, option B (F05 §4.3). `preview` is read-only and
    // shows the baseline check, diff and impact; the recording command is the
    // single effective point: it verifies the result commit, creates the
    // annotated tag, then writes the chain. The document is never written.
    // Options are validated manually: Commander checks an ancestor's mandatory
    // options even when a subcommand (`preview`) runs.
    const amendment = cmd.command('amendment')
        .description('Record a Director-approved amendment of a RATIFIED DIR-INTENT from a Git commit; `amendment preview` is read-only')
        .option('--change <change>', 'Single-line summary of the change, commit-message style')
        .option('--purpose-changed <yes|no>', 'Director-reviewed declaration whether the purpose or core outcome changes (informational, never a gate)')
        .option('--commit <ref>', 'Commit that holds exactly the reviewed and approved INTENT content')
        .option('--doc-sha256 <hash>', 'INTENT file hash shown by `amendment preview` (binds the approval to the reviewed content)')
        .option('--v <version>', 'Chain version to amend instead of the active one', chain_1.normalizeVersionArg)
        .option('--director-confirm', 'Required. Explicit Director approval of the reviewed content and change list.')
        .action(async (opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const missing = [];
            if (!opts.change)
                missing.push('--change');
            if (!opts.purposeChanged)
                missing.push('--purpose-changed yes|no');
            else if (!['yes', 'no'].includes(opts.purposeChanged))
                throw new Error('--purpose-changed must be yes or no.');
            if (!opts.commit)
                missing.push('--commit <ref>');
            if (!opts.docSha256)
                missing.push('--doc-sha256 <hash from preview>');
            if (!opts.directorConfirm)
                missing.push('--director-confirm');
            if (missing.length) {
                console.error(`Amendment not completed. Missing: ${missing.join(', ')}.`);
                console.error('Steps: (1) sigma intent baseline check, (2) edit INTENT, (3) sigma intent amendment preview,');
                console.error('       (4) Director approves the reviewed content, (5) commit that content, (6) re-run this command with all options.');
                process.exit(1);
            }
            const request = { change: opts.change, purposeChanged: opts.purposeChanged === 'yes', commit: opts.commit, docSha256: opts.docSha256 };
            const result = await (0, governanceTransaction_1.withGovernanceTransaction)(projectRoot, 'intent_amendment', () => (0, intentAmendmentService_1.intentAmendmentTransactionFiles)(projectRoot, opts.v), () => (0, intentAmendmentService_1.recordIntentAmendmentUseCase)(projectRoot, request, opts.v));
            console.log(`${result.entry.id} recorded for DIR-INTENT ${result.chainVersion}.`);
            console.log(`Change: ${result.entry.change}`);
            console.log(`Purpose changed: ${request.purposeChanged ? 'yes' : 'no'}`);
            console.log(`Commit: ${result.commit}`);
            console.log(`Tag: ${result.tag}${result.tagCreated ? ' (created, local only)' : ' (existing tag at the same commit adopted)'}`);
            console.log('Document re-certified. APPROVED PLANs are flagged for INTENT review; LOCKED pairs are unchanged.');
            console.log(`Distribution: Sigma never pushes. Push is yours; "git push --follow-tags" sends annotated tags, otherwise "git push origin ${result.tag}".`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    amendment.command('preview')
        .description('Read-only review package: Git baseline check, diff against the baseline, hash to approve, impact on PLAN/EXEC')
        .option('--v <version>', 'Chain version instead of the active one', chain_1.normalizeVersionArg)
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { chainVersion, data: chain } = opts.v ? { chainVersion: opts.v, data: (0, chain_1.readChain)(projectRoot, opts.v) } : (0, chain_1.readActiveChain)(projectRoot);
            const preview = (0, intentGit_1.previewIntentAmendment)(projectRoot, chainVersion, chain);
            console.log(`\n=== Amendment Preview — INTENT ${chainVersion} ===\n`);
            printGitReport(preview.report);
            console.log(`\nINTENT file: ${preview.report.repo_path ?? preview.report.file ?? '(unknown)'}`);
            console.log(`SHA-256 (use as --doc-sha256 after approval): ${preview.report.working_sha256 ?? '(unavailable)'}`);
            console.log(`Next: ${preview.next_amendment_id} -> tag ${preview.next_tag}`);
            console.log('\n--- Impact ---');
            console.log(`INTENT revision: ${preview.impact.current_revision ?? '(none)'} -> ${preview.impact.next_revision}`);
            console.log(`PLAN APPROVED, flagged for INTENT review: ${preview.impact.plans_flagged_for_review.join(', ') || 'none'}`);
            console.log(`PLAN/EXEC LOCKED pairs, unchanged (not retroactive): ${preview.impact.locked_pairs_unchanged.join(', ') || 'none'}`);
            console.log(`Drafts (informational): PLAN ${preview.impact.drafts.plan.join(', ') || 'none'}; EXEC ${preview.impact.drafts.exec.join(', ') || 'none'}`);
            console.log('\n--- Diff against baseline (mechanical evidence, not a semantic judgment) ---');
            console.log(preview.diff.stat || '(no diff available)');
            console.log(preview.diff.patch || '');
            if (preview.report.blockers.length) {
                console.error('Blocked:\n' + preview.report.blockers.map(b => ` - ${b}`).join('\n'));
                process.exit(1);
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    const baseline = cmd.command('baseline').description('Git baseline of the certified INTENT content (F05)');
    baseline.command('check')
        .description('Read-only: verify that the INTENT in Git is the latest certified content (before editing an amendment and before a Petition)')
        .option('--v <version>', 'Chain version instead of the active one', chain_1.normalizeVersionArg)
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const { chainVersion, data: chain } = opts.v ? { chainVersion: opts.v, data: (0, chain_1.readChain)(projectRoot, opts.v) } : (0, chain_1.readActiveChain)(projectRoot);
            const report = (0, intentGit_1.inspectIntentGit)(projectRoot, chainVersion, chain, 'clean');
            console.log(`\n=== INTENT Git Baseline — ${chainVersion} ===\n`);
            printGitReport(report);
            for (const line of (0, intentGit_1.intentGitDrift)(projectRoot, chainVersion, chain))
                console.log(`  [DRIFT] ${line}`);
            if (report.blockers.length) {
                console.error('Not ready:\n' + report.blockers.map(b => ` - ${b}`).join('\n'));
                process.exit(1);
            }
            console.log('\nINTENT in Git matches the certified baseline.');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    baseline.command('adopt')
        .description('Bind the certified INTENT content to a commit and a local annotated tag (requires --director-confirm)')
        .requiredOption('--commit <ref>', 'Commit that holds exactly the current INTENT content')
        .option('--import-current', 'Adopt the reviewed current content when the certified content cannot be recovered from Git (no amendment is invented)')
        .option('--v <version>', 'Chain version instead of the active one', chain_1.normalizeVersionArg)
        .option('--director-confirm', 'Required. Explicit Director authorization.')
        .action(async (opts) => {
        try {
            if (!opts.directorConfirm) {
                console.error('Error: --director-confirm is required to adopt an INTENT Git baseline.');
                process.exit(1);
            }
            const projectRoot = (0, fs_1.findProjectRoot)();
            const result = await (0, governanceTransaction_1.withGovernanceTransaction)(projectRoot, 'intent_baseline_adopt', () => (0, intentBaselineService_1.adoptIntentBaselineTransactionFiles)(projectRoot, opts.v), () => (0, intentBaselineService_1.adoptIntentBaselineUseCase)(projectRoot, { commit: opts.commit, importCurrent: !!opts.importCurrent }, opts.v));
            if (result.alreadyRecorded) {
                console.log(`Baseline already recorded for ${result.chainVersion} at ${result.baseline.commit} (tag ${result.baseline.tag}).`);
                return;
            }
            console.log(`Baseline recorded for ${result.chainVersion}: ${result.baseline.commit} (${result.baseline.provenance}).`);
            console.log(`Tag: ${result.baseline.tag}${result.tagCreated ? ' (created, local only)' : ' (existing tag at the same commit adopted)'}`);
            console.log(`Distribution: Sigma never pushes. "git push --follow-tags" sends annotated tags, otherwise "git push origin ${result.baseline.tag}".`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('score <n>')
        .description('Record ARC Satisfaction Score for a RATIFIED DIR-INTENT (Gate 3.5 pre-condition for `sigma close new` — does not gate `close lock`)')
        .requiredOption('--notes <notes>', 'Rationale for the score')
        .option('--v <version>', 'Chain version to score instead of the active one', chain_1.normalizeVersionArg)
        .action((n, opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const score = Number(n);
            const result = (0, intentScoreService_1.recordArcScoreUseCase)(projectRoot, score, opts.notes, opts.v);
            const band = (0, chain_1.arcScoreBand)(result.score);
            console.log(`ARC Score recorded: ${band} (${result.score})`);
            console.log(`Notes: ${result.notes}`);
            console.log(`Gate 3.5 (close new): ${result.score >= 50 ? 'OPEN' : 'BLOCKED'}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('supersede')
        .description('Supersede a RATIFIED DIR-INTENT chain — cascades SUPERSEDED to its Roadmap/Plan/Exec/Close (requires --director-confirm)')
        .requiredOption('--v <version>', 'Chain version to supersede (e.g. v1) — need not be the active chain', chain_1.normalizeVersionArg)
        .requiredOption('--reason <reason>', 'Reason for superseding')
        .option('--director-confirm', 'Required. Explicit Director authorization to execute the supersede.')
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const chain = (0, chain_1.readChain)(projectRoot, opts.v);
            (0, chain_1.assertChainCanMutate)(chain);
            if (chain.intent.state !== 'RATIFIED') {
                throw new Error(`INTENT ${opts.v} is in state "${chain.intent.state}"; supersede requires RATIFIED.`);
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
            (0, intentSupersedeService_1.supersedeIntentUseCase)(projectRoot, opts.reason, opts.v);
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
        .requiredOption('--v <version>', 'Chain version to activate (e.g. v2)', chain_1.normalizeVersionArg)
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
        .option('--v <version>', 'Check a specific chain instead of the active one', chain_1.normalizeVersionArg)
        .action((opts) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const chain = opts.v ? (0, chain_1.readChain)(projectRoot, opts.v) : (0, chain_1.readActiveChain)(projectRoot).data;
            const absPath = intentDocPath(projectRoot, chain);
            const report = (0, docCheck_1.validateSigmaDocFile)(absPath, 'intent');
            (0, docCheck_1.printSigmaDocReport)(report, projectRoot);
            if ((0, chain_1.isIntentDocUncertified)(chain, absPath)) {
                const since = chain.intent.effective_amendment ?? 'ratification';
                console.log(`[WARNING] Doc state: UNCERTIFIED_EDIT — file edited after ${since} without a recorded amendment. Review it with: sigma intent amendment preview`);
            }
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
            if (chain.intent.ratified_at)
                console.log(`Ratified at: ${chain.intent.ratified_at}`);
            if (chain.intent.file)
                console.log(`File:       ${chain.intent.file}`);
            if ((0, chain_1.isIntentDocUncertified)(chain, intentDocPath(projectRoot, chain))) {
                const since = chain.intent.effective_amendment ?? 'ratification';
                console.log(`Doc state:  UNCERTIFIED_EDIT (edited after ${since})`);
            }
            const gitBaseline = chain.intent.git_baseline;
            console.log(gitBaseline
                ? `Git baseline: ${gitBaseline.commit.slice(0, 12)} (${gitBaseline.tag}, ${gitBaseline.provenance})`
                : 'Git baseline: none (run: sigma intent baseline adopt --commit <ref> --director-confirm)');
            const lastAmendment = chain.intent.amendments?.[chain.intent.amendments.length - 1];
            if (lastAmendment)
                console.log(`Last amendment: ${lastAmendment.id} (${lastAmendment.created_at.slice(0, 10)})${lastAmendment.result_tag ? ` ${lastAmendment.result_tag}` : ' — no Git reference (pre-F05)'}`);
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