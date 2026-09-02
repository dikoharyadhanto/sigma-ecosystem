"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notionCommand = notionCommand;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("../utils/fs");
const projectConfig_1 = require("../engine/projectConfig");
const notionCredentials_1 = require("../engine/notionCredentials");
const notionService_1 = require("../engine/notionService");
const humanizePush_1 = require("../engine/humanizePush");
const chain_1 = require("../engine/chain");
function notionCommand() {
    const notion = new commander_1.Command('notion').description('Sigma Notion remote governance dashboard & state backup');
    notion
        .command('setup')
        .description('Configure Notion integration for this project')
        .option('--token <token>', 'Notion integration secret token (secret_...) — stored per-machine, never inside this project')
        .option('--parent-id <id>', 'Parent page ID in Notion (required for push/pull)')
        .option('--db-id <id>', 'Database ID in Notion (reserved; not yet used by sync/resolve)')
        .option('--clean-local', 'Purge Sigma/ locally after a fully successful `sigma notion push`')
        .option('--no-clean-local', 'Keep local Sigma/ files after push')
        .option('--gitignore-sigma', 'Add Sigma/ to .gitignore so governance files never enter Git')
        .option('--enable', 'Enable Notion integration for this project')
        .option('--disable', 'Disable Notion integration for this project')
        .action(async (options) => {
        const root = (0, fs_1.findProjectRoot)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project. Run `sigma project start` first.'));
            process.exit(1);
        }
        const cfg = (0, projectConfig_1.readProjectConfig)(root);
        const existingNotion = cfg.notion || { enabled: false, clean_local: false };
        if (options.parentId)
            existingNotion.parent_page_id = options.parentId;
        if (options.dbId)
            existingNotion.database_id = options.dbId;
        if (options.enable)
            existingNotion.enabled = true;
        if (options.disable)
            existingNotion.enabled = false;
        if (options.cleanLocal)
            existingNotion.clean_local = true;
        if (options.noCleanLocal)
            existingNotion.clean_local = false;
        if (options.gitignoreSigma) {
            const gitRes = (0, notionService_1.ensureGitignoreNotion)(root);
            if (gitRes.added) {
                console.log(chalk_1.default.green('✓ Added `Sigma/` to .gitignore'));
            }
        }
        if (options.token) {
            console.log(chalk_1.default.blue('Testing connection to Notion API...'));
            const testRes = await (0, notionService_1.testNotionConnection)(options.token);
            if (!testRes.success) {
                console.error(chalk_1.default.red(`Notion connection test failed: ${testRes.error}`));
                process.exit(1);
            }
            console.log(chalk_1.default.green(`✓ Connection successful! Bot: ${testRes.botName} (${testRes.workspaceName})`));
            const projectId = (0, notionCredentials_1.getProjectId)(root);
            if (!projectId) {
                console.error(chalk_1.default.red('Error: .sigma-identity.json not found — cannot associate a token with this project.'));
                process.exit(1);
            }
            (0, notionCredentials_1.writeGlobalNotionToken)(projectId, options.token);
            console.log(chalk_1.default.gray('  Token stored per-machine in ~/.sigma/notion.credentials.json (never inside this project).'));
            existingNotion.enabled = true;
        }
        cfg.notion = existingNotion;
        (0, projectConfig_1.writeProjectConfig)(root, cfg);
        console.log(chalk_1.default.green('✓ Notion configuration updated in Sigma/project.config.json'));
        console.log(`  Enabled: ${existingNotion.enabled ? chalk_1.default.green('Yes') : chalk_1.default.yellow('No')}`);
        console.log(`  Clean Local: ${existingNotion.clean_local ? chalk_1.default.green('Yes') : chalk_1.default.gray('No')}`);
        if (existingNotion.parent_page_id)
            console.log(`  Parent Page ID: ${existingNotion.parent_page_id}`);
        if (existingNotion.database_id)
            console.log(`  Database ID: ${existingNotion.database_id} (reserved, not yet used)`);
    });
    // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §3.2 — toggling the humanize gate
    // mid-project requires Director Authorization Language, same tier as
    // `intent supersede`/`override` — never a plain config edit. Not
    // retroactive: this only changes what `sigma plan new`/`sigma close new`
    // check from this point on, it never rewrites past chain state. Every
    // invocation is captured by the existing automatic operations.jsonl log,
    // so no separate audit trail mechanism is needed here.
    notion
        .command('enable')
        .description('Turn on the Notion humanize gate for this project (requires --director-confirm)')
        .option('--director-confirm', 'Required. Explicit Director authorization to change the humanize gate.')
        .option('--reason <text>', 'Optional. Why the gate is being turned on.')
        .action((options) => {
        const root = (0, fs_1.findProjectRoot)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project.'));
            process.exit(1);
        }
        if (!options.directorConfirm) {
            console.error(chalk_1.default.red('Error: --director-confirm is required to change the humanize gate.'));
            console.error('Example: sigma notion enable --director-confirm --reason "..."');
            process.exit(1);
        }
        const cfg = (0, projectConfig_1.readProjectConfig)(root);
        cfg.notion_humanize_gate = { enabled: true };
        (0, projectConfig_1.writeProjectConfig)(root, cfg);
        console.log(chalk_1.default.green('✓ Notion humanize gate: ON'));
        console.log(chalk_1.default.gray('  Applies from now on — does not retroactively affect artifacts already locked.'));
        if (options.reason)
            console.log(chalk_1.default.gray(`  Reason: ${options.reason}`));
    });
    notion
        .command('disable')
        .description('Turn off the Notion humanize gate for this project (requires --director-confirm)')
        .option('--director-confirm', 'Required. Explicit Director authorization to change the humanize gate.')
        .option('--reason <text>', 'Optional. Why the gate is being turned off.')
        .action((options) => {
        const root = (0, fs_1.findProjectRoot)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project.'));
            process.exit(1);
        }
        if (!options.directorConfirm) {
            console.error(chalk_1.default.red('Error: --director-confirm is required to change the humanize gate.'));
            console.error('Example: sigma notion disable --director-confirm --reason "..."');
            process.exit(1);
        }
        const cfg = (0, projectConfig_1.readProjectConfig)(root);
        cfg.notion_humanize_gate = { enabled: false };
        (0, projectConfig_1.writeProjectConfig)(root, cfg);
        console.log(chalk_1.default.green('✓ Notion humanize gate: OFF'));
        console.log(chalk_1.default.gray('  Applies from now on — does not retroactively affect artifacts already locked.'));
        if (options.reason)
            console.log(chalk_1.default.gray(`  Reason: ${options.reason}`));
    });
    notion
        .command('status')
        .description('Check Notion API connection and active configuration')
        .action(async () => {
        const root = (0, fs_1.findProjectRoot)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project.'));
            process.exit(1);
        }
        const resolved = (0, notionService_1.getResolvedNotionConfig)(root);
        const cfg = (0, projectConfig_1.readProjectConfig)(root);
        console.log(chalk_1.default.bold('\n--- Notion Integration Status ---'));
        console.log(`Status: ${resolved.enabled ? chalk_1.default.green('ACTIVE') : chalk_1.default.yellow('DISABLED')}`);
        console.log(`Humanize Gate: ${cfg.notion_humanize_gate?.enabled ? chalk_1.default.green('ON') : chalk_1.default.gray('OFF')}`);
        console.log(`Clean Local: ${resolved.clean_local ? chalk_1.default.green('ON') : chalk_1.default.gray('OFF')}`);
        console.log(`Token Source: ${process.env.NOTION_TOKEN ? 'Environment (NOTION_TOKEN)' : resolved.token ? '~/.sigma/notion.credentials.json' : 'None'}`);
        if (resolved.parent_page_id)
            console.log(`Parent Page ID: ${resolved.parent_page_id}`);
        if (resolved.token) {
            console.log('\nTesting API connection...');
            const testRes = await (0, notionService_1.testNotionConnection)(resolved.token);
            if (testRes.success) {
                console.log(chalk_1.default.green(`✓ Connected to Notion as "${testRes.botName}" (${testRes.workspaceName})`));
            }
            else {
                console.log(chalk_1.default.red(`✖ Connection failed: ${testRes.error}`));
            }
        }
        else {
            console.log(chalk_1.default.yellow('\nNo token configured. Run `sigma notion setup --token <your-notion-token>` to enable.'));
        }
    });
    notion
        .command('push')
        .description('Push generated human artifacts, the governance dashboard, and state backup to Notion (manual — never triggered automatically)')
        .action(async () => {
        const root = (0, fs_1.findProjectRoot)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project.'));
            process.exit(1);
        }
        // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §2.7/§4 Fase 4/6 — human
        // artifacts push first, before anything that could purge Sigma/human/
        // out from under it. A failure here (terminology leak, fidelity gap)
        // stops the whole command — dashboard/state push and any purge are
        // skipped, same "nothing purges unless everything succeeded" rule as
        // D-04 point 5 already applies to dashboard+state.
        const humanResults = await (0, humanizePush_1.pushAllHumanArtifacts)(root);
        if (humanResults.length > 0) {
            console.log(chalk_1.default.blue(`Pushing ${humanResults.length} human artifact(s) to Notion...`));
            for (const r of humanResults) {
                if (r.success) {
                    console.log(chalk_1.default.green(`✓ ${r.target.artifactType} ${r.target.version} pushed.`));
                    if (r.pageUrl)
                        console.log(chalk_1.default.cyan(`  URL: ${r.pageUrl}`));
                }
                else {
                    console.error(chalk_1.default.red(`✖ ${r.target.artifactType} ${r.target.version} failed:`));
                    console.error(chalk_1.default.red(`  ${r.error}`));
                }
            }
            if (humanResults.some(r => !r.success)) {
                console.error(chalk_1.default.red('\nOne or more human artifacts failed to push. Dashboard/state push skipped.'));
                process.exit(1);
            }
            console.log('');
        }
        // §2.5 — clean up Notion pages whose source is now SUPERSEDED. Only
        // ever touches artifacts that were actually pushed at least once;
        // never a hook on `intent supersede`/`plan supersede` themselves.
        const reconcileResults = await (0, humanizePush_1.reconcileSupersededHumanArtifacts)(root);
        const reconciledDeletes = reconcileResults.filter(r => r.deleted);
        const reconcileErrors = reconcileResults.filter(r => r.error);
        if (reconciledDeletes.length > 0) {
            console.log(chalk_1.default.blue(`Removing ${reconciledDeletes.length} superseded human artifact page(s) from Notion...`));
            for (const r of reconciledDeletes) {
                console.log(chalk_1.default.green(`✓ ${r.artifactType} ${r.version} archived in Notion (source is SUPERSEDED).`));
            }
            console.log('');
        }
        if (reconcileErrors.length > 0) {
            for (const r of reconcileErrors) {
                console.error(chalk_1.default.yellow(`⚠ Could not reconcile ${r.artifactType} ${r.version}: ${r.error}`));
            }
        }
        console.log(chalk_1.default.blue('Pushing dashboard and state backup to Notion...'));
        const res = await (0, notionService_1.runNotionPush)(root);
        if (!res.success) {
            console.error(chalk_1.default.red(`✖ Push failed: ${res.error}`));
            if (res.dashboardUrl)
                console.log(chalk_1.default.gray(`  (Dashboard was pushed before the failure: ${res.dashboardUrl})`));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✓ Dashboard and state backup pushed.'));
        if (res.dashboardUrl)
            console.log(chalk_1.default.cyan(`  URL: ${res.dashboardUrl}`));
        if (res.purged) {
            console.log(chalk_1.default.green('\n✓ Sigma/ purged locally — state is safely backed up in Notion.'));
            console.log(chalk_1.default.gray('  Run `sigma notion pull-state` to restore on this or another device.'));
        }
    });
    notion
        .command('pull-state [chain]')
        .description('Restore local state machine JSON from Notion Cloud (e.g. after switching devices)')
        .action(async (chain) => {
        const root = (0, notionService_1.findProjectRootForRemote)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project (no .sigma-identity.json found).'));
            process.exit(1);
        }
        const targetChain = chain || 'v1';
        console.log(chalk_1.default.blue(`Restoring state for chain ${targetChain} from Notion Cloud...`));
        const res = await (0, notionService_1.pullStateFromNotion)(root, targetChain);
        if (!res.success) {
            console.error(chalk_1.default.red(`✖ Failed to restore state from Notion: ${res.error}`));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✓ Local state restored from Notion Cloud.'));
        if (res.restoredFiles) {
            console.log('  Restored files:');
            res.restoredFiles.forEach((f) => console.log(`   - ${f}`));
        }
    });
    notion
        .command('pull <type> <version>')
        .description('Fetch a single page from Notion by type + version (read-only preview)')
        .action(async (type, version) => {
        version = (0, chain_1.normalizeVersionArg)(version) ?? version;
        const root = (0, notionService_1.findProjectRootForRemote)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project.'));
            process.exit(1);
        }
        console.log(chalk_1.default.blue(`Fetching "${type} - ${version}" from Notion Cloud...`));
        const res = await (0, notionService_1.fetchArtifactFromNotion)(root, type, version);
        if (!res.success) {
            console.error(chalk_1.default.red(`✖ Failed to pull from Notion: ${res.error}`));
            process.exit(1);
        }
        console.log(chalk_1.default.green('✓ Fetched from Notion.'));
        if (res.pageUrl)
            console.log(chalk_1.default.cyan(`  Source: ${res.pageUrl}`));
        console.log(chalk_1.default.bold('\n--- Content Preview ---'));
        console.log(res.contentMarkdown);
    });
    notion
        .command('progress [chain]')
        .description('Read progress & gate status from Notion Cloud without a local Sigma/ directory')
        .action(async (chain) => {
        const root = (0, notionService_1.findProjectRootForRemote)(process.cwd());
        if (!root) {
            console.error(chalk_1.default.red('Error: Not inside a Sigma project.'));
            process.exit(1);
        }
        const targetChain = chain || 'v1';
        console.log(chalk_1.default.blue(`Fetching progress for chain ${targetChain} from Notion Cloud...`));
        const res = await (0, notionService_1.fetchRemoteProgressFromNotion)(root, targetChain);
        if (!res.success || !res.data) {
            console.error(chalk_1.default.red(`✖ Failed to fetch progress from Notion: ${res.error}`));
            process.exit(1);
        }
        const payload = res.data;
        const identity = payload.identity || {};
        const state = payload.chain_state || {};
        const gates = state.gates || {};
        console.log(chalk_1.default.bold('\n=== Sigma Remote Progress (Notion Cloud) ===\n'));
        console.log(`Project:          ${identity.project_name || 'N/A'} (${identity.project_id || 'N/A'})`);
        console.log(`Active Chain:     ${payload.active_chain || targetChain}`);
        console.log(`Lifecycle Phase:  ${state.lifecycle_state || 'N/A'}`);
        if (res.pageUrl)
            console.log(`Source URL:       ${chalk_1.default.cyan(res.pageUrl)}`);
        console.log(chalk_1.default.bold('\n--- Gate Status ---'));
        console.log(`Gate 1 (Intent Ratified): ${gates.gate_1_open ? chalk_1.default.green('OPEN') : chalk_1.default.red('CLOSED')}`);
        console.log(`Gate 2 (Plan Locked):     ${gates.gate_2_open ? chalk_1.default.green('OPEN') : chalk_1.default.red('BLOCKED')}`);
        console.log(`Gate 3 (Build Evidence):  ${gates.gate_3_satisfied ? chalk_1.default.green('SATISFIED') : chalk_1.default.red('BLOCKED')}\n`);
    });
    return notion;
}
//# sourceMappingURL=notion.js.map