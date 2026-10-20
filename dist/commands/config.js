"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configCommand = configCommand;
const commander_1 = require("commander");
const fs_1 = require("../utils/fs");
const projectConfig_1 = require("../engine/projectConfig");
const gitignoreService_1 = require("../services/gitignoreService");
const output_1 = require("../utils/output");
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
        .option('--sigma-document', 'Set the Sigma document (INTENT/PLAN/EXEC/etc.) language')
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
            config.mailbox = { ...projectConfig_1.DEFAULT_MAILBOX, ...config.mailbox, auto_outdate_read_keep: value };
            (0, projectConfig_1.writeProjectConfig)(projectRoot, config);
            console.log(`Mailbox auto-outdate keep: ${prev ?? '(default)'} -> ${value}${value === 0 ? ' (auto-sweep disabled)' : ''}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    set.command('memo-limit <n>')
        .description('Set the max unread MEMO count per INTENT and role (GENERAL separate) before `sigma memo write` is blocked (default 5). ' +
        '0 disables the memo feature (mailbox.memo_unread_limit).')
        .action((n) => {
        try {
            const value = Number(n);
            if (!Number.isInteger(value) || value < 0) {
                throw new Error(`Expected a non-negative integer, got "${n}".`);
            }
            const projectRoot = (0, fs_1.findProjectRoot)();
            const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
            const prev = config.mailbox?.memo_unread_limit;
            config.mailbox = { ...projectConfig_1.DEFAULT_MAILBOX, ...config.mailbox, memo_unread_limit: value };
            (0, projectConfig_1.writeProjectConfig)(projectRoot, config);
            console.log(`Memo unread limit: ${prev ?? '(default)'} -> ${value}${value === 0 ? ' (memo disabled)' : ''}`);
        }
        catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    });
    set.command('gitignore <mode>')
        .description('Turn the Sigma .gitignore block on or off (git.gitignore_sigma, default on). ' +
        'on|activate|true|1: ignore every Sigma-generated file except .sigma-identity.json and detach already-tracked ones from the Git index (files stay on disk). ' +
        'off|deactivate|false|0: remove the block so Sigma files can be committed and pushed to another machine.')
        .action((mode) => {
        try {
            const normalized = mode.trim().toLowerCase();
            const ON = ['on', 'activate', 'true', '1'];
            const OFF = ['off', 'deactivate', 'false', '0'];
            if (!ON.includes(normalized) && !OFF.includes(normalized)) {
                throw new Error(`Unknown mode "${mode}". Use on|activate|true|1 or off|deactivate|false|0.`);
            }
            const enable = ON.includes(normalized);
            const projectRoot = (0, fs_1.findProjectRoot)();
            const prev = (0, projectConfig_1.resolveGitignoreSigma)((0, projectConfig_1.readProjectConfig)(projectRoot));
            (0, gitignoreService_1.persistGitignoreSetting)(projectRoot, enable);
            const report = enable ? (0, gitignoreService_1.enableSigmaGitignore)(projectRoot) : (0, gitignoreService_1.disableSigmaGitignore)(projectRoot);
            console.log(`Sigma Gitignore Mode: ${prev ? 'ON' : 'OFF'} -> ${enable ? 'ON' : 'OFF'}`);
            for (const line of report.lines)
                console.log('  ' + line);
            for (const line of report.warnings)
                (0, output_1.warn)(line);
            if (!enable) {
                console.log('  Next: commit and push the Sigma files from this machine, then `git pull` on the other machine.');
            }
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
            const keep = (0, projectConfig_1.resolveAutoOutdateKeep)(config);
            console.log(`Mailbox Auto-Outdate Keep:     ${keep === 0 ? 'OFF' : keep}`);
            const memoLimit = (0, projectConfig_1.resolveMemoLimit)(config);
            console.log(`Memo Unread Limit:             ${memoLimit === 0 ? 'OFF (memo disabled)' : memoLimit}`);
            const gitignoreOn = (0, projectConfig_1.resolveGitignoreSigma)(config);
            const applied = (0, gitignoreService_1.isGitignoreBlockApplied)(projectRoot);
            const origin = (0, projectConfig_1.hasExplicitGitignoreSigma)(config) ? '' : ' [default]';
            console.log(`Sigma Gitignore Mode:          ${gitignoreOn
                ? 'ON (active — only .sigma-identity.json tracked in Git)'
                : 'OFF (inactive — Sigma files can be tracked in Git)'}${origin}`);
            if (gitignoreOn && !applied) {
                console.log('                               (block not yet in .gitignore — run: sigma config set gitignore on)');
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
//# sourceMappingURL=config.js.map