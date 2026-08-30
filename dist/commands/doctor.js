"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorCommand = doctorCommand;
const commander_1 = require("commander");
const chain_1 = require("../engine/chain");
const reconstruct_1 = require("../engine/reconstruct");
const fs_1 = require("../utils/fs");
const intentHistory_1 = require("../utils/intentHistory");
// PLAN-EVAL-01 Fase 4 / PLAN-EVAL-05 — every mode below now targets
// Sigma/progress-v<N>.json via chain.ts. `--reconstruct` (3 modes) and
// `--all-versions` are PLAN-EVAL-05 additions; the default mode is
// unchanged since PLAN-EVAL-01.
function runDefaultDoctor() {
    const projectRoot = (0, fs_1.findProjectRoot)();
    // No chain yet (fresh project, before the first `intent new`) is a valid,
    // doctor-able state — nothing to reconcile, not an error.
    if ((0, chain_1.listChainVersions)(projectRoot).length === 0) {
        console.log('\n=== Sigma Doctor ===\n');
        console.log('No chain exists yet. Nothing to reconcile. Run: sigma intent new');
        console.log('');
        return;
    }
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const overrides = (0, chain_1.readOverrides)(projectRoot);
    const report = (0, chain_1.runDoctorReconciliation)(chain, overrides, projectRoot);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — self-heal net
    console.log('\n=== Sigma Doctor ===\n');
    if (report.repaired.length > 0) {
        console.log('--- Repaired ---');
        for (const line of report.repaired) {
            console.log(`  - ${line}`);
        }
    }
    if (report.invalidMarked.length > 0) {
        console.log('\n--- Marked INVALID ---');
        for (const marker of report.invalidMarked) {
            console.log(`  - ${marker.id}: ${marker.reason}`);
        }
    }
    if (report.invalidCleared.length > 0) {
        console.log('\n--- Cleared INVALID ---');
        for (const marker of report.invalidCleared) {
            console.log(`  - ${marker.id}`);
        }
    }
    const remaining = (0, chain_1.getInvalidMarkers)(chain);
    console.log('\n--- Current Runtime State ---');
    if (remaining.length === 0) {
        console.log('  VALID');
    }
    else {
        console.log('  INVALID recovery mode active for affected chains:');
        for (const marker of remaining) {
            console.log(`  - ${marker.id}: ${marker.reason}`);
        }
        console.log('\n  Gate enforcement is temporarily relaxed for affected chains while INVALID markers remain.');
    }
    console.log('');
}
// ── --all-versions (without --reconstruct) ─────────────────────────────────
// PLAN-EVAL-05 §5.5 — pure loop over runDoctorReconciliation(), no new
// reconciliation logic. Targets chain files already on disk (not a
// disaster-recovery scan), so it anchors like the default mode.
function runAllVersionsDoctor() {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const versions = (0, chain_1.listChainVersions)(projectRoot);
    console.log('\n=== Sigma Doctor — All Versions ===\n');
    if (versions.length === 0) {
        console.log('No chain exists yet. Nothing to reconcile. Run: sigma intent new');
        console.log('');
        return;
    }
    const overrides = (0, chain_1.readOverrides)(projectRoot);
    for (const chainVersion of versions) {
        const chain = (0, chain_1.readChain)(projectRoot, chainVersion);
        const report = (0, chain_1.runDoctorReconciliation)(chain, overrides, projectRoot);
        (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
        console.log(`--- Chain ${chainVersion} ---`);
        if (report.repaired.length > 0) {
            console.log('  Repaired:');
            for (const line of report.repaired)
                console.log(`    - ${line}`);
        }
        if (report.invalidMarked.length > 0) {
            console.log('  Marked INVALID:');
            for (const marker of report.invalidMarked)
                console.log(`    - ${marker.id}: ${marker.reason}`);
        }
        if (report.invalidCleared.length > 0) {
            console.log('  Cleared INVALID:');
            for (const marker of report.invalidCleared)
                console.log(`    - ${marker.id}`);
        }
        const remaining = (0, chain_1.getInvalidMarkers)(chain);
        console.log(`  Runtime state: ${remaining.length === 0 ? 'VALID' : 'INVALID recovery mode active'}`);
        console.log('');
    }
    (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — self-heal net
}
// ── --reconstruct (3 modes: default/active, --v, --all-versions) ───────────
// PLAN-EVAL-05 §5.2/§5.4 — migrated off progress.ts/reconstruct.ts's old
// single-ProgressJson algorithm onto per-chain ChainState reconstruction.
// Project identity (--id/--name on the pre-PLAN-EVAL-05 version of this
// command) is no longer needed here: ChainState never carried
// project_id/project_name (PLAN-EVAL-01 §3.3 — that lives only in
// .sigma-identity.json), so there is nothing left for --id/--name to recover
// into. Both flags and the resolveProjectIdentity() fallback chain that used
// to read Sigma/progress.json are removed entirely, not just updated.
function resolveReconstructTargets(projectRoot, result, opts) {
    if (opts.allVersions) {
        return [...result.chains.keys()].sort((a, b) => a - b);
    }
    if (opts.v) {
        const major = (0, chain_1.parseMajorVersion)(opts.v);
        if (!result.chains.has(major)) {
            throw new Error(`No DIR-INTENT-${opts.v}.md found on disk — nothing to reconstruct for chain ${opts.v}.`);
        }
        return [major];
    }
    let activeVersion;
    try {
        activeVersion = (0, chain_1.resolveActiveChainVersion)(projectRoot);
    }
    catch (e) {
        // Only the "no chain files at all" case gets rewritten into --v/--all-versions
        // guidance — any other failure (e.g. an existing chain file that's
        // corrupted) is a distinct, more specific problem and should surface with
        // its own message rather than being masked by a generic one.
        if (e.message.includes('No DIR-INTENT exists yet')) {
            throw new Error('No chain files exist yet and no --v/--all-versions was given — cannot determine which chain to reconstruct. ' +
                'Use --v <version> to target one chain, or --all-versions to reconstruct every chain found on disk.');
        }
        throw e;
    }
    const major = (0, chain_1.parseMajorVersion)(activeVersion);
    if (!result.chains.has(major)) {
        throw new Error(`No DIR-INTENT-${activeVersion}.md found on disk for the active chain (${activeVersion}) — nothing to reconstruct.`);
    }
    return [major];
}
function printChainReconstructReport(chainVersion, chain) {
    console.log(`\n--- Chain ${chainVersion} ---\n`);
    console.log(`Lifecycle:  ${chain.lifecycle_state}`);
    console.log(`Gates:      gate_1_open=${chain.gates.gate_1_open} gate_2_open=${chain.gates.gate_2_open} ` +
        `gate_3_satisfied=${chain.gates.gate_3_satisfied}`);
    console.log(`\nINTENT:  ${chain.intent.version} (${chain.intent.state})${chain.intent.file ? ` — ${chain.intent.file}` : ''}`);
    console.log(`ROADMAP: ${chain.roadmap ? `${chain.roadmap.version} (${chain.roadmap.state})${chain.roadmap.file ? ` — ${chain.roadmap.file}` : ''}` : 'none'}`);
    console.log(`PLAN:    ${chain.plan.versions.length} version(s) found`);
    for (const v of chain.plan.versions)
        console.log(`  - ${v.version} (${v.state})${v.file ? ` — ${v.file}` : ''}`);
    console.log(`EXEC:    ${chain.exec.versions.length} version(s) found`);
    for (const v of chain.exec.versions)
        console.log(`  - ${v.version} (${v.state})${v.file ? ` — ${v.file}` : ''}`);
    console.log(`CLOSE:   ${chain.close ? `${chain.close.version} (${chain.close.state})${chain.close.file ? ` — ${chain.close.file}` : ''}` : 'none'}`);
    const markers = (0, chain_1.getInvalidMarkers)(chain);
    if (markers.length > 0) {
        console.log('\n--- Marked INVALID (needs Director review) ---');
        for (const marker of markers) {
            console.log(`  - ${marker.id}: ${marker.reason}`);
        }
    }
    else {
        console.log('\nNo ambiguous state — reconstruct is confident in the result above.');
    }
}
function runReconstruct(opts) {
    const projectRoot = (0, reconstruct_1.findSigmaProjectRoot)();
    const result = (0, reconstruct_1.reconstructAllChains)(projectRoot);
    const targets = resolveReconstructTargets(projectRoot, result, opts);
    console.log('\n=== Sigma Doctor — Reconstruct ===');
    for (const major of targets) {
        const { chainVersion, data } = result.chains.get(major);
        (0, chain_1.writeChain)(projectRoot, chainVersion, data);
        printChainReconstructReport(chainVersion, data);
    }
    if (result.unresolved.length > 0) {
        console.log('\n--- Unresolved Artifact Groups (no matching DIR-INTENT found) ---');
        for (const group of result.unresolved) {
            console.log(`  - v${group.major}: ${group.artifacts.join(', ')}`);
        }
        console.log('\nThese cannot be reconstructed without a DIR-INTENT-v<N>.md — restore it from git history if this ' +
            'chain should exist, or ignore if these are stray artifacts.');
    }
    if (result.skipped.length > 0) {
        console.log('\n--- Skipped (SIGMA:DOC marker mismatch) ---');
        for (const note of result.skipped)
            console.log(`  - ${note}`);
    }
    (0, intentHistory_1.renderIntentHistoryFile)(projectRoot); // PLAN-EVAL-06 — self-heal net
    console.log('');
}
// ── Command ───────────────────────────────────────────────────────────────────
function doctorCommand() {
    const cmd = new commander_1.Command('doctor');
    cmd
        .description('Diagnose and reconcile Sigma runtime state')
        .option('--recovery', 'Explicit alias for the default reconciliation behavior (same as running with no flag)')
        .option('--all-versions', 'Apply to every chain found on disk instead of just the active one')
        .option('--reconstruct', 'Rebuild chain file(s) from artifact files on disk (use when a progress-v<N>.json is missing or corrupted)')
        .option('--v <version>', 'With --reconstruct, target one specific chain instead of the active one (e.g. v2)')
        .action((opts) => {
        try {
            if (opts.v && !opts.reconstruct) {
                throw new Error('--v is only valid combined with --reconstruct.');
            }
            if (opts.v && opts.allVersions) {
                throw new Error('--v and --all-versions are mutually exclusive.');
            }
            if (opts.reconstruct) {
                runReconstruct({ v: opts.v, allVersions: opts.allVersions });
            }
            else if (opts.allVersions) {
                runAllVersionsDoctor();
            }
            else {
                runDefaultDoctor();
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=doctor.js.map