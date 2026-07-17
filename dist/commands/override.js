"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.overrideCommand = overrideCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const chain_1 = require("../engine/chain");
const fs_1 = require("../utils/fs");
const config_1 = require("../config");
// ── Helpers ───────────────────────────────────────────────────────────────────
function appendOverrideEntry(projectRoot, entry) {
    const filePath = path_1.default.join(projectRoot, config_1.OVERRIDES_FILE);
    fs_extra_1.default.ensureFileSync(filePath);
    fs_extra_1.default.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}
function versionForArtifact(chain, artifact) {
    if (artifact === 'DIR-INTENT')
        return chain.intent.version;
    if (artifact === 'FMN-PLAN')
        return chain.plan.active_version;
    if (artifact === 'DEV-EXEC')
        return chain.exec.active_version;
    return null;
}
function describeBlockedGate(chain) {
    if (!chain.gates.gate_1_open) {
        return {
            artifact: 'DIR-INTENT',
            gate: 'Gate 1',
            description: 'Intent Doc (DIR-INTENT) is not LOCKED — Gate 1 is blocked.',
        };
    }
    if (!chain.gates.gate_2_open) {
        return {
            artifact: 'FMN-PLAN',
            gate: 'Gate 2',
            description: 'Plan Doc (FMN-PLAN) is not LOCKED — Gate 2 is blocked.',
        };
    }
    if (!chain.gates.gate_3_satisfied) {
        return {
            artifact: 'DEV-EXEC',
            gate: 'Gate 3',
            description: 'Execution Evidence (DEV-EXEC) is not LOCKED or evidence chain is incomplete — Gate 3 is not satisfied.',
        };
    }
    return null;
}
function applyOverride(chain, artifact) {
    if (artifact === 'DIR-INTENT') {
        chain.gates.gate_1_open = true;
        if (chain.lifecycle_state === 'DESIGN')
            chain.lifecycle_state = 'BUILD';
    }
    else if (artifact === 'FMN-PLAN') {
        chain.gates.gate_2_open = true;
    }
    else if (artifact === 'DEV-EXEC') {
        chain.gates.gate_3_satisfied = true;
    }
}
// ── Command handler ───────────────────────────────────────────────────────────
function runOverride(opts) {
    if (!opts.reason || opts.reason.trim().length === 0) {
        console.error('Error: --reason is required. Describe why this override is authorized.');
        console.error('Example: sigma override --reason "Director decision: ..." --director-confirm');
        process.exit(1);
    }
    if (!opts.dryRun && !opts.directorConfirm) {
        console.error('Error: --director-confirm is required to execute an override.');
        console.error('This command is restricted to Director authority.');
        console.error('Add --director-confirm to proceed, or --dry-run to preview.');
        process.exit(1);
    }
    const reason = opts.reason.trim();
    const projectRoot = (0, fs_1.findProjectRoot)();
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(projectRoot);
    const blocked = describeBlockedGate(chain);
    if (!blocked) {
        console.log('No gate is currently blocked. Override is not needed.');
        console.log(`Lifecycle: ${chain.lifecycle_state} — all gates in expected state.`);
        return;
    }
    console.log('\n=== Sigma Override ===\n');
    console.log(`Current phase:   ${chain.lifecycle_state}`);
    console.log(`Blocked gate:    ${blocked.gate}`);
    console.log(`Artifact:        ${blocked.artifact}`);
    console.log(`\nBlocker:         ${blocked.description}`);
    console.log(`\nOverride reason: ${reason}`);
    if (opts.dryRun) {
        console.log('\n[Dry run] No changes applied. Remove --dry-run to execute.');
        return;
    }
    const entry = {
        type: 'override',
        timestamp: new Date().toISOString(),
        artifact: blocked.artifact,
        phase: chain.lifecycle_state,
        gate_bypassed: blocked.gate,
        reason,
        authorized_by: 'Director',
        version: versionForArtifact(chain, blocked.artifact),
    };
    applyOverride(chain, blocked.artifact);
    (0, chain_1.writeChain)(projectRoot, chainVersion, chain);
    appendOverrideEntry(projectRoot, entry);
    console.log(`\nOverride applied: ${blocked.gate} (${blocked.artifact}) bypassed.`);
    console.log('Audit record written to Sigma/memory/overrides.jsonl.');
    console.log(`Next valid operations: sigma project status`);
}
// ── Command builder ───────────────────────────────────────────────────────────
function overrideCommand() {
    const cmd = new commander_1.Command('override');
    cmd.description('Bypass the current lifecycle gate under Director authority (recorded in Sigma/memory/overrides.jsonl)');
    cmd
        .option('--reason <reason>', 'Required. Describe why this override is authorized.')
        .option('--director-confirm', 'Required. Explicit Director authorization to execute the override.')
        .option('--dry-run', 'Show what would be bypassed without modifying state.')
        .action((opts) => {
        try {
            runOverride(opts);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=override.js.map