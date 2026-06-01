"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryCommand = memoryCommand;
const commander_1 = require("commander");
const roleMemory_1 = require("../engine/roleMemory");
const fs_1 = require("../utils/fs");
function detectProjectRoot() {
    try {
        return (0, fs_1.findProjectRoot)();
    }
    catch {
        return undefined;
    }
}
function selectedRoleFromFlags(opts) {
    const selected = roleMemory_1.ROLE_MEMORY_ROLES.filter(role => opts[role.toLowerCase()]);
    if (selected.length !== 1) {
        throw new Error('Exactly one role flag is required: --arc, --fmn, --dev, or --aud.');
    }
    return selected[0];
}
function runMemory(opts) {
    const role = selectedRoleFromFlags(opts);
    const projectRoot = detectProjectRoot();
    const { memory } = (0, roleMemory_1.loadRoleMemory)(role, projectRoot);
    console.log('\n=== Sigma Role Memory ===\n');
    console.log(`Role:       ${memory.role}`);
    console.log(`Authority:  ${memory.authority}`);
    console.log(`Source:     ${memory.source_rule} (${memory.source_rule_version})`);
    console.log(`Updated:    ${memory.memory_updated_at}`);
    console.log('\n--- General Reminders ---');
    memory.general.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item}`);
    });
    console.log(`\n--- ${memory.role} Role Reminders ---`);
    memory.role_specific.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item}`);
    });
    console.log('');
}
function memoryCommand() {
    const cmd = new commander_1.Command('memory');
    cmd
        .description('Show Sigma role memory reminders (read-only)')
        .option('--arc', 'Show ARC role memory')
        .option('--fmn', 'Show FMN role memory')
        .option('--dev', 'Show DEV role memory')
        .option('--aud', 'Show AUD role memory')
        .action((opts) => {
        try {
            runMemory(opts);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=memory.js.map