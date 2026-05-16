import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import {
  GLOBAL_SIGMA_DIR,
  GLOBAL_TEMPLATES_DIR,
  GLOBAL_RULES_DIR,
  GLOBAL_GOVERNANCE_DIR,
  GLOBAL_BRIDGE_DIR,
  GLOBAL_PROJECTS_FILE,
  GLOBAL_CONFIG_FILE,
  SIGMA_VERSION,
} from '../config';
import { success, info, warn, error } from '../utils/output';
import { ensureDir, copyDir, fileExists } from '../utils/fs';

// ── Bundle paths (files shipped inside the npm package) ─────────────────────

// __dirname resolves to dist/commands/ at runtime; walk up to package root
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path.join(PACKAGE_ROOT, 'Sigma', 'templates');
const BUNDLE_RULES = path.join(PACKAGE_ROOT, 'Sigma', 'rules');
const BUNDLE_CONSTITUTION = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA_CONSTITUTION.md');
const BUNDLE_PROTOCOL = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA_PROTOCOL.md');

const BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md'];

// ── sigma setup install ──────────────────────────────────────────────────────

async function runInstall(opts: { force?: boolean }): Promise<void> {
  if (fileExists(GLOBAL_SIGMA_DIR) && !opts.force) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Sigma is already installed. Reinstall?',
        default: false,
      },
    ]);

    if (!confirmed) {
      info('Install cancelled.');
      return;
    }
  }

  info('Installing Sigma...');

  ensureDir(GLOBAL_TEMPLATES_DIR);
  ensureDir(GLOBAL_RULES_DIR);
  ensureDir(GLOBAL_GOVERNANCE_DIR);
  ensureDir(GLOBAL_BRIDGE_DIR);

  // Copy templates
  if (fileExists(BUNDLE_TEMPLATES)) {
    copyDir(BUNDLE_TEMPLATES, GLOBAL_TEMPLATES_DIR);
  } else {
    warn(`Template bundle not found at ${BUNDLE_TEMPLATES} — skipping`);
  }

  // Copy rules
  if (fileExists(BUNDLE_RULES)) {
    copyDir(BUNDLE_RULES, GLOBAL_RULES_DIR);
  } else {
    warn(`Rules bundle not found at ${BUNDLE_RULES} — skipping`);
  }

  // Copy governance documents
  if (fileExists(BUNDLE_CONSTITUTION)) {
    fs.copySync(BUNDLE_CONSTITUTION, path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'), { overwrite: true });
  } else {
    warn('SIGMA_CONSTITUTION.md not found in bundle — skipping');
  }

  if (fileExists(BUNDLE_PROTOCOL)) {
    fs.copySync(BUNDLE_PROTOCOL, path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'), { overwrite: true });
  } else {
    warn('SIGMA_PROTOCOL.md not found in bundle — skipping');
  }

  // Seed bridge stubs
  for (const stub of BRIDGE_STUBS) {
    const stubPath = path.join(GLOBAL_BRIDGE_DIR, stub);
    if (!fileExists(stubPath)) {
      fs.writeFileSync(stubPath, `# ${stub}\n\n<!-- Sigma bridge stub — Phase 6 will write real content -->\n`);
    }
  }

  // Seed projects.json
  if (!fileExists(GLOBAL_PROJECTS_FILE)) {
    fs.writeJsonSync(GLOBAL_PROJECTS_FILE, { schema_version: '1.0.0', projects: [] }, { spaces: 2 });
  }

  // Seed sigma.config.json
  if (!fileExists(GLOBAL_CONFIG_FILE)) {
    fs.writeJsonSync(GLOBAL_CONFIG_FILE, {
      schema_version: '1.0.0',
      cli_version: SIGMA_VERSION,
      installed_at: new Date().toISOString(),
    }, { spaces: 2 });
  }

  success('Sigma installed successfully.');
  console.log(`  Global dir: ${GLOBAL_SIGMA_DIR}`);
  console.log('  Run `sigma project start` to initialize a project.');
}

// ── sigma setup update ───────────────────────────────────────────────────────

async function runUpdate(): Promise<void> {
  if (!fileExists(GLOBAL_SIGMA_DIR)) {
    error('Sigma is not installed. Run: sigma setup install');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBase = path.join(GLOBAL_SIGMA_DIR, 'backups', timestamp);

  info('Backing up current installation...');
  if (fileExists(GLOBAL_TEMPLATES_DIR)) {
    fs.copySync(GLOBAL_TEMPLATES_DIR, path.join(backupBase, 'templates'));
  }
  if (fileExists(GLOBAL_RULES_DIR)) {
    fs.copySync(GLOBAL_RULES_DIR, path.join(backupBase, 'rules'));
  }
  if (fileExists(GLOBAL_GOVERNANCE_DIR)) {
    fs.copySync(GLOBAL_GOVERNANCE_DIR, path.join(backupBase, 'governance'));
  }

  info('Updating files from package bundle...');

  if (fileExists(BUNDLE_TEMPLATES)) {
    ensureDir(GLOBAL_TEMPLATES_DIR);
    copyDir(BUNDLE_TEMPLATES, GLOBAL_TEMPLATES_DIR);
    console.log('  Updated: templates/');
  }

  if (fileExists(BUNDLE_RULES)) {
    ensureDir(GLOBAL_RULES_DIR);
    copyDir(BUNDLE_RULES, GLOBAL_RULES_DIR);
    console.log('  Updated: rules/');
  }

  if (fileExists(BUNDLE_CONSTITUTION)) {
    ensureDir(GLOBAL_GOVERNANCE_DIR);
    fs.copySync(BUNDLE_CONSTITUTION, path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'), { overwrite: true });
    console.log('  Updated: governance/SIGMA_CONSTITUTION.md');
  }

  if (fileExists(BUNDLE_PROTOCOL)) {
    ensureDir(GLOBAL_GOVERNANCE_DIR);
    fs.copySync(BUNDLE_PROTOCOL, path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'), { overwrite: true });
    console.log('  Updated: governance/SIGMA_PROTOCOL.md');
  }

  // Update cli_version in config
  if (fileExists(GLOBAL_CONFIG_FILE)) {
    const cfg = fs.readJsonSync(GLOBAL_CONFIG_FILE) as Record<string, unknown>;
    cfg.cli_version = SIGMA_VERSION;
    fs.writeJsonSync(GLOBAL_CONFIG_FILE, cfg, { spaces: 2 });
    console.log('  Updated: sigma.config.json (cli_version)');
  }

  success('Sigma updated successfully.');
  console.log(`  Backup saved to: ${backupBase}`);
  console.log('  Note: existing project Sigma/ folders were NOT touched.');
  console.log('  To sync governance files into a project, run: sigma project sync --confirm');
}

// ── Command builder ──────────────────────────────────────────────────────────

export function setupCommand(): Command {
  const cmd = new Command('setup');
  cmd.description('Install or update the Sigma global installation');

  cmd
    .command('install')
    .description('Install Sigma globally to ~/.sigma/')
    .option('--force', 'Skip reinstall confirmation')
    .action((opts: { force?: boolean }) => {
      runInstall(opts).catch(err => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });
    });

  cmd
    .command('update')
    .description('Update ~/.sigma/ templates, rules, and governance from package bundle')
    .action(() => {
      runUpdate().catch(err => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });
    });

  return cmd;
}
