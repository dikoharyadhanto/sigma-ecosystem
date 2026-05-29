"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configCommand = configCommand;
const commander_1 = require("commander");
const fs_1 = require("../utils/fs");
const projectConfig_1 = require("../engine/projectConfig");
function configCommand() {
    const cmd = new commander_1.Command('config');
    cmd.description('Manage project configuration (Sigma/project.config.json)');
    const set = cmd.command('set');
    set.description('Set a configuration value');
    set.command('language <lang>')
        .description('Set the Director interaction language (e.g., "en", "id"). ' +
        'Artifact content (FMN-PLAN, DEV-EXEC, ROADMAP) is always written in English regardless of this setting.')
        .action((lang) => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
            const prev = config.interaction_language;
            config.interaction_language = lang;
            (0, projectConfig_1.writeProjectConfig)(projectRoot, config);
            console.log(`Language preference updated.`);
            console.log(`  Interaction: ${prev} → ${lang} (${(0, projectConfig_1.langLabel)(lang)})`);
            console.log(`  Artifact content: English (unchanged)`);
            console.log('');
            console.log(`AI roles will read this setting at bootstrap and communicate in ${(0, projectConfig_1.langLabel)(lang)}.`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    cmd.command('show')
        .description('Show current project configuration')
        .action(() => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
            console.log('\n=== Project Config ===\n');
            console.log(`Interaction language:     ${config.interaction_language} (${(0, projectConfig_1.langLabel)(config.interaction_language)})`);
            console.log(`Document language:        ${config.document_language} (${(0, projectConfig_1.langLabel)(config.document_language)})`);
            console.log(`Formal identifiers:       ${config.formal_identifier_language} (${(0, projectConfig_1.langLabel)(config.formal_identifier_language)})`);
            console.log('');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    return cmd;
}
//# sourceMappingURL=config.js.map