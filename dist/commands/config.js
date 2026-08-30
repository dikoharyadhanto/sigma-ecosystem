"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configCommand = configCommand;
const commander_1 = require("commander");
const fs_1 = require("../utils/fs");
const projectConfig_1 = require("../engine/projectConfig");
const languageWizard_1 = require("../engine/languageWizard");
function configCommand() {
    const cmd = new commander_1.Command('config');
    cmd.description('Manage project configuration (Sigma/project.config.json)');
    // `sigma config` with no subcommand — interactive language wizard.
    cmd.action(async () => {
        try {
            const projectRoot = (0, fs_1.findProjectRoot)();
            const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
            console.log('\n=== Sigma Language Preferences ===\n');
            const updated = await (0, languageWizard_1.promptLanguageWizard)(config);
            (0, projectConfig_1.writeProjectConfig)(projectRoot, updated);
            console.log('\nLanguage preferences updated.');
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    const set = cmd.command('set');
    set.description('Set a configuration value (non-interactive)');
    set.command('language <name>')
        .description('Set a language preference to a free-form language name (e.g. "English", "Indonesia") — not an ISO code. ' +
        'Requires exactly one of --interaction, --sigma-document, or --output-document.')
        .option('--interaction', 'Set the AI communication (Director-facing) language')
        .option('--sigma-document', 'Set the Sigma document (DIR-INTENT/FMN-PLAN/DEV-EXEC/etc.) language')
        .option('--output-document', 'Set the non-Sigma output document language')
        .action((name, flags) => {
        try {
            const selected = [flags.interaction, flags.sigmaDocument, flags.outputDocument].filter(Boolean).length;
            if (selected !== 1) {
                throw new Error('Specify exactly one of --interaction, --sigma-document, or --output-document.');
            }
            const projectRoot = (0, fs_1.findProjectRoot)();
            const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
            if (flags.interaction) {
                const prev = config.interaction_language;
                config.interaction_language = name;
                (0, projectConfig_1.writeProjectConfig)(projectRoot, config);
                console.log(`AI Communication Language: ${prev} -> ${name}`);
            }
            else if (flags.sigmaDocument) {
                const prev = config.document_language;
                config.document_language = name;
                (0, projectConfig_1.writeProjectConfig)(projectRoot, config);
                console.log(`Sigma Docs Language: ${prev} -> ${name}`);
            }
            else {
                const prev = config.output_document_language;
                config.output_document_language = name;
                (0, projectConfig_1.writeProjectConfig)(projectRoot, config);
                console.log(`Output Doc Written Language: ${prev} -> ${name}`);
            }
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    set.command('mailbox-outdate-keep <n>')
        .description('Set how many most-recent READ messages `sigma inbox read` keeps before aging the rest to OUTDATED. ' +
        '0 disables the auto-sweep (mailbox.auto_outdate_read_keep).')
        .action((n) => {
        try {
            const value = Number(n);
            if (!Number.isInteger(value) || value < 0) {
                throw new Error(`Expected a non-negative integer, got "${n}".`);
            }
            const projectRoot = (0, fs_1.findProjectRoot)();
            const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
            const prev = config.mailbox?.auto_outdate_read_keep;
            config.mailbox = { ...config.mailbox, auto_outdate_read_keep: value };
            (0, projectConfig_1.writeProjectConfig)(projectRoot, config);
            console.log(`Mailbox auto-outdate keep: ${prev ?? '(default)'} -> ${value}${value === 0 ? ' (auto-sweep disabled)' : ''}`);
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
            console.log(`AI Communication Language:     ${config.interaction_language}`);
            console.log(`Sigma Docs Language:           ${config.document_language}`);
            console.log(`Output Doc Written Language:   ${config.output_document_language}`);
            console.log(`Notion Humanize Gate:          ${config.notion_humanize_gate?.enabled ? 'ON' : 'OFF'}`);
            const keep = (0, projectConfig_1.resolveAutoOutdateKeep)(config);
            console.log(`Mailbox Auto-Outdate Keep:     ${keep === 0 ? 'OFF' : keep}`);
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