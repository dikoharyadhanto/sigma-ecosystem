import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot } from '../utils/fs';
import { readProjectConfig, writeProjectConfig } from '../engine/projectConfig';
import { getProjectId, writeGlobalNotionToken } from '../engine/notionCredentials';
import {
  getResolvedNotionConfig,
  testNotionConnection,
  syncProjectStateToNotion,
  fetchArtifactFromNotion,
  pushStateToNotion,
  pullStateFromNotion,
  fetchRemoteProgressFromNotion,
  ensureGitignoreNotion,
  purgeSigmaDir,
  findProjectRootForRemote,
} from '../engine/notionService';
import { resolveActiveChainVersion, readChain, readProjectIdentity } from '../engine/chain';

export function notionCommand(): Command {
  const notion = new Command('notion').description('Sigma Notion remote governance dashboard & state backup');

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
      const root = findProjectRoot(process.cwd());
      if (!root) {
        console.error(chalk.red('Error: Not inside a Sigma project. Run `sigma project start` first.'));
        process.exit(1);
      }

      const cfg = readProjectConfig(root);
      const existingNotion = cfg.notion || { enabled: false, clean_local: false };

      if (options.parentId) existingNotion.parent_page_id = options.parentId;
      if (options.dbId) existingNotion.database_id = options.dbId;
      if (options.enable) existingNotion.enabled = true;
      if (options.disable) existingNotion.enabled = false;
      if (options.cleanLocal) existingNotion.clean_local = true;
      if (options.noCleanLocal) existingNotion.clean_local = false;

      if (options.gitignoreSigma) {
        const gitRes = ensureGitignoreNotion(root);
        if (gitRes.added) {
          console.log(chalk.green('✓ Added `Sigma/` to .gitignore'));
        }
      }

      if (options.token) {
        console.log(chalk.blue('Testing connection to Notion API...'));
        const testRes = await testNotionConnection(options.token);
        if (!testRes.success) {
          console.error(chalk.red(`Notion connection test failed: ${testRes.error}`));
          process.exit(1);
        }
        console.log(chalk.green(`✓ Connection successful! Bot: ${testRes.botName} (${testRes.workspaceName})`));

        const projectId = getProjectId(root);
        if (!projectId) {
          console.error(chalk.red('Error: .sigma-identity.json not found — cannot associate a token with this project.'));
          process.exit(1);
        }
        writeGlobalNotionToken(projectId, options.token);
        console.log(chalk.gray('  Token stored per-machine in ~/.sigma/notion.credentials.json (never inside this project).'));
        existingNotion.enabled = true;
      }

      cfg.notion = existingNotion;
      writeProjectConfig(root, cfg);

      console.log(chalk.green('✓ Notion configuration updated in Sigma/project.config.json'));
      console.log(`  Enabled: ${existingNotion.enabled ? chalk.green('Yes') : chalk.yellow('No')}`);
      console.log(`  Clean Local: ${existingNotion.clean_local ? chalk.green('Yes') : chalk.gray('No')}`);
      if (existingNotion.parent_page_id) console.log(`  Parent Page ID: ${existingNotion.parent_page_id}`);
      if (existingNotion.database_id) console.log(`  Database ID: ${existingNotion.database_id} (reserved, not yet used)`);
    });

  notion
    .command('status')
    .description('Check Notion API connection and active configuration')
    .action(async () => {
      const root = findProjectRoot(process.cwd());
      if (!root) {
        console.error(chalk.red('Error: Not inside a Sigma project.'));
        process.exit(1);
      }

      const resolved = getResolvedNotionConfig(root);
      console.log(chalk.bold('\n--- Notion Integration Status ---'));
      console.log(`Status: ${resolved.enabled ? chalk.green('ACTIVE') : chalk.yellow('DISABLED')}`);
      console.log(`Clean Local: ${resolved.clean_local ? chalk.green('ON') : chalk.gray('OFF')}`);
      console.log(`Token Source: ${process.env.NOTION_TOKEN ? 'Environment (NOTION_TOKEN)' : resolved.token ? '~/.sigma/notion.credentials.json' : 'None'}`);
      if (resolved.parent_page_id) console.log(`Parent Page ID: ${resolved.parent_page_id}`);

      if (resolved.token) {
        console.log('\nTesting API connection...');
        const testRes = await testNotionConnection(resolved.token);
        if (testRes.success) {
          console.log(chalk.green(`✓ Connected to Notion as "${testRes.botName}" (${testRes.workspaceName})`));
        } else {
          console.log(chalk.red(`✖ Connection failed: ${testRes.error}`));
        }
      } else {
        console.log(chalk.yellow('\nNo token configured. Run `sigma notion setup --token <your-notion-token>` to enable.'));
      }
    });

  notion
    .command('push')
    .description('Push the governance dashboard and state backup to Notion (manual — never triggered automatically)')
    .action(async () => {
      const root = findProjectRoot(process.cwd());
      if (!root) {
        console.error(chalk.red('Error: Not inside a Sigma project.'));
        process.exit(1);
      }

      const resolved = getResolvedNotionConfig(root);
      if (!resolved.enabled || !resolved.token) {
        console.error(chalk.red('Error: Notion integration is not enabled or token is missing.'));
        console.log('Run `sigma notion setup --token <secret_...> --parent-id <id>` first.');
        process.exit(1);
      }
      if (!resolved.parent_page_id) {
        console.error(chalk.red('Error: Notion parent_page_id is not configured.'));
        console.log('Run `sigma notion setup --parent-id <id>`.');
        process.exit(1);
      }

      try {
        const activeVersion = resolveActiveChainVersion(root);
        const chain = readChain(root, activeVersion);
        const identity = readProjectIdentity(root);

        console.log(chalk.blue(`Pushing dashboard (chain ${chain.chain_version}) to Notion...`));
        const dashboardRes = await syncProjectStateToNotion(root, {
          phase: chain.lifecycle_state,
          active_chain: chain.chain_version,
          gates: chain.gates,
          projectName: identity.project_name,
          projectId: identity.project_id,
        });
        if (!dashboardRes.success) {
          console.error(chalk.red(`✖ Dashboard push failed: ${dashboardRes.error}`));
          process.exit(1);
        }
        console.log(chalk.green('✓ Dashboard pushed.'));
        if (dashboardRes.pageUrl) console.log(chalk.cyan(`  URL: ${dashboardRes.pageUrl}`));

        console.log(chalk.blue('Backing up state JSON to Notion...'));
        const stateRes = await pushStateToNotion(root, chain.chain_version);
        if (!stateRes.success) {
          console.error(chalk.red(`✖ State backup failed: ${stateRes.error}`));
          process.exit(1);
        }
        console.log(chalk.green('✓ State JSON backed up.'));

        const cleanLocal = resolved.clean_local;
        if (cleanLocal) {
          const purged = purgeSigmaDir(root, { chain_version: chain.chain_version, dashboard_url: dashboardRes.pageUrl });
          if (purged) {
            console.log(chalk.green('\n✓ Sigma/ purged locally — state is safely backed up in Notion.'));
            console.log(chalk.gray('  Run `sigma notion pull-state` to restore on this or another device.'));
          }
        }
      } catch (err: any) {
        console.error(chalk.red(`Error reading chain state: ${err.message}`));
        process.exit(1);
      }
    });

  notion
    .command('pull-state [chain]')
    .description('Restore local state machine JSON from Notion Cloud (e.g. after switching devices)')
    .action(async (chain?: string) => {
      const root = findProjectRootForRemote(process.cwd());
      if (!root) {
        console.error(chalk.red('Error: Not inside a Sigma project (no .sigma-identity.json found).'));
        process.exit(1);
      }

      const targetChain = chain || 'v1';
      console.log(chalk.blue(`Restoring state for chain ${targetChain} from Notion Cloud...`));
      const res = await pullStateFromNotion(root, targetChain);

      if (!res.success) {
        console.error(chalk.red(`✖ Failed to restore state from Notion: ${res.error}`));
        process.exit(1);
      }

      console.log(chalk.green('✓ Local state restored from Notion Cloud.'));
      if (res.restoredFiles) {
        console.log('  Restored files:');
        res.restoredFiles.forEach((f) => console.log(`   - ${f}`));
      }
    });

  notion
    .command('pull <type> <version>')
    .description('Fetch a single page from Notion by type + version (read-only preview)')
    .action(async (type: string, version: string) => {
      const root = findProjectRootForRemote(process.cwd());
      if (!root) {
        console.error(chalk.red('Error: Not inside a Sigma project.'));
        process.exit(1);
      }

      console.log(chalk.blue(`Fetching "${type} - ${version}" from Notion Cloud...`));
      const res = await fetchArtifactFromNotion(root, type, version);

      if (!res.success) {
        console.error(chalk.red(`✖ Failed to pull from Notion: ${res.error}`));
        process.exit(1);
      }

      console.log(chalk.green('✓ Fetched from Notion.'));
      if (res.pageUrl) console.log(chalk.cyan(`  Source: ${res.pageUrl}`));
      console.log(chalk.bold('\n--- Content Preview ---'));
      console.log(res.contentMarkdown);
    });

  notion
    .command('progress [chain]')
    .description('Read progress & gate status from Notion Cloud without a local Sigma/ directory')
    .action(async (chain?: string) => {
      const root = findProjectRootForRemote(process.cwd());
      if (!root) {
        console.error(chalk.red('Error: Not inside a Sigma project.'));
        process.exit(1);
      }

      const targetChain = chain || 'v1';
      console.log(chalk.blue(`Fetching progress for chain ${targetChain} from Notion Cloud...`));
      const res = await fetchRemoteProgressFromNotion(root, targetChain);

      if (!res.success || !res.data) {
        console.error(chalk.red(`✖ Failed to fetch progress from Notion: ${res.error}`));
        process.exit(1);
      }

      const payload = res.data;
      const identity = payload.identity || {};
      const state = payload.chain_state || {};
      const gates = state.gates || {};

      console.log(chalk.bold('\n=== Sigma Remote Progress (Notion Cloud) ===\n'));
      console.log(`Project:          ${identity.project_name || 'N/A'} (${identity.project_id || 'N/A'})`);
      console.log(`Active Chain:     ${payload.active_chain || targetChain}`);
      console.log(`Lifecycle Phase:  ${state.lifecycle_state || 'N/A'}`);
      if (res.pageUrl) console.log(`Source URL:       ${chalk.cyan(res.pageUrl)}`);

      console.log(chalk.bold('\n--- Gate Status ---'));
      console.log(`Gate 1 (Intent Ratified): ${gates.gate_1_open ? chalk.green('OPEN') : chalk.red('CLOSED')}`);
      console.log(`Gate 2 (Plan Locked):     ${gates.gate_2_open ? chalk.green('OPEN') : chalk.red('BLOCKED')}`);
      console.log(`Gate 3 (Build Evidence):  ${gates.gate_3_satisfied ? chalk.green('SATISFIED') : chalk.red('BLOCKED')}\n`);
    });

  return notion;
}
