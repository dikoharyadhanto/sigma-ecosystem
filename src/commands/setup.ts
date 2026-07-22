import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import {
  GLOBAL_SIGMA_DIR,
  GLOBAL_TEMPLATES_DIR,
  GLOBAL_RULES_DIR,
  GLOBAL_GOVERNANCE_DIR,
  GLOBAL_BRIDGE_DIR,
  GLOBAL_CONFIG_FILE,
  SIGMA_VERSION,
  BRIDGE_STUBS,
} from '../config';
import { success, info, warn, error } from '../utils/output';
import { ensureDir, copyDir, fileExists } from '../utils/fs';
import { detectTools, targetPaths } from '../utils/detect';
import {
  writeCodexMcpConfig,
  writeAntigravityMcpConfig,
  removeCodexMcpConfig,
  removeAntigravityMcpConfig,
  isSigmaMcpResolvable,
  tryMcpOp,
} from '../utils/mcpConfig';

// ── Bundle paths (files shipped inside the npm package) ─────────────────────

// __dirname resolves to dist/commands/ at runtime; walk up to package root
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path.join(PACKAGE_ROOT, 'Sigma', 'templates');
const BUNDLE_RULES = path.join(PACKAGE_ROOT, 'Sigma', 'rules');
const BUNDLE_CONSTITUTION = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA_CONSTITUTION.md');
const BUNDLE_PROTOCOL = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA_PROTOCOL.md');

const SETUP_TARGETS_DIR = path.join(PACKAGE_ROOT, 'setup', 'targets');
const BUNDLE_BRIDGE_DIR = path.join(SETUP_TARGETS_DIR, 'bridge');
const BUNDLE_HOOKS_DIR = path.join(SETUP_TARGETS_DIR, 'hooks');

const ROLE_FILES: Record<string, Record<string, string>> = {
  claudeCode:  { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', report: 'report.md', sigmaTest: 'sigma-test.md' },
  codex:       { arc: 'arc',    fmn: 'fmn',    dev: 'dev',    aud: 'aud',    report: 'report',    sigmaTest: 'sigma-test'    },
  reasonix:    { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', report: 'report.md', sigmaTest: 'sigma-test.md' },
  antigravity: { arc: 'sigma-arc', fmn: 'sigma-fmn', dev: 'sigma-dev', aud: 'sigma-aud', report: 'sigma-report', sigmaTest: 'sigma-test' },
  cursor:      { sigma: 'SIGMA.mdc' },
};

const PLATFORM_LABELS: Record<string, string> = {
  claudeCode:  'Claude Code  (~/.claude/commands/)',
  codex:       'Codex CLI    (~/.codex/skills/)',
  reasonix:    'Reasonix     (~/.reasonix/skills/)',
  antigravity: 'Antigravity  (~/.gemini/config/skills/)',
  cursor:      'Cursor       (~/.cursor/rules/)',
};

const PLATFORM_SOURCE_DIR: Record<string, string> = {
  claudeCode:  'claude_code',
  codex:       'codex',
  reasonix:    'reasonix',
  antigravity: 'antigravity',
  cursor:      'cursor',
};

// ── sigma setup install ──────────────────────────────────────────────────────

async function runInstall(opts: { force?: boolean; yes?: boolean }): Promise<void> {
  if (fileExists(GLOBAL_SIGMA_DIR) && !opts.force && !opts.yes) {
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

  // Step A — Bridge file templates (always overwrite — templates, not user-modified)
  if (fileExists(BUNDLE_BRIDGE_DIR)) {
    ensureDir(GLOBAL_BRIDGE_DIR);
    copyDir(BUNDLE_BRIDGE_DIR, GLOBAL_BRIDGE_DIR);
    console.log('  Installed: bridge/ templates');
  } else {
    // Fall back to seeding stubs for backward compatibility
    for (const stub of BRIDGE_STUBS) {
      const stubPath = path.join(GLOBAL_BRIDGE_DIR, stub);
      if (!fileExists(stubPath)) {
        fs.writeFileSync(stubPath, `# ${stub}\n\n<!-- Sigma bridge stub -->\n`);
      }
    }
  }

  // Seed sigma.config.json
  if (!fileExists(GLOBAL_CONFIG_FILE)) {
    fs.writeJsonSync(GLOBAL_CONFIG_FILE, {
      schema_version: '1.0.0',
      cli_version: SIGMA_VERSION,
      installed_at: new Date().toISOString(),
    }, { spaces: 2 });
  }

  // Detect tools
  const detected = detectTools();
  const detectedPlatforms = (Object.entries(detected) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (detectedPlatforms.length === 0) {
    info('No AI tool directories detected. Skipping skill deployment.');
    info('Detected directories: ~/.claude/commands, ~/.codex/skills, ~/.reasonix/skills, ~/.gemini/agents');
  } else {
    // Select platforms (interactive checkbox, unless --yes)
    let selectedPlatforms: string[];

    if (opts.yes) {
      selectedPlatforms = detectedPlatforms;
    } else {
      const { chosen } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'chosen',
          message: 'Select AI tools to configure with Sigma skills:',
          choices: detectedPlatforms.map(p => ({ name: PLATFORM_LABELS[p], value: p, checked: true })),
        },
      ]);
      selectedPlatforms = chosen as string[];
    }

    await deploySkillsAndHook(selectedPlatforms);
  }

  success('Sigma installed successfully.');
  console.log(`  Global dir: ${GLOBAL_SIGMA_DIR}`);
  console.log('  Run `sigma project start` to initialize a project.');

  // Stage 3 — Tulis global MCP config untuk Codex dan Antigravity
  {
    const err = tryMcpOp(() => writeCodexMcpConfig(), '~/.codex/config.toml');
    if (err) warn(`MCP (Codex): ${err}`);
    else console.log('  MCP: ~/.codex/config.toml updated (sigma-mcp — Codex).');
  }
  {
    const err = tryMcpOp(() => writeAntigravityMcpConfig(), '~/.gemini/config/mcp_config.json');
    if (err) warn(`MCP (Antigravity): ${err}`);
    else console.log('  MCP: ~/.gemini/config/mcp_config.json updated (sigma-mcp — Antigravity).');
  }
  if (!isSigmaMcpResolvable()) {
    warn('sigma-mcp is not found in PATH. MCP config was written but will not work until sigma-mcp is resolvable. Make sure sigma-ecosystem is installed globally: npm install -g sigma-ecosystem');
  }
}

// ── Shared skill + hook deployment (install & update) ───────────────────────

async function deploySkillsAndHook(selectedPlatforms: string[]): Promise<void> {
  if (selectedPlatforms.length === 0) return;

  const paths = targetPaths();
  const targetDirMap: Record<string, string> = {
    claudeCode:  paths.claudeCommands,
    codex:       paths.codexSkills,
    reasonix:    paths.reasonixSkills,
    antigravity: paths.antigravitySkills,
    cursor:      paths.cursorRules,
  };

  for (const platform of selectedPlatforms) {
    const sourceDir = path.join(SETUP_TARGETS_DIR, PLATFORM_SOURCE_DIR[platform]);
    const targetDir = targetDirMap[platform];

    if (!fileExists(sourceDir)) {
      warn(`Skill source not found for ${platform} — skipping`);
      continue;
    }

    ensureDir(targetDir);
    const roles = ROLE_FILES[platform];
    let ok = 0;
    let failed = 0;

    for (const [, fileName] of Object.entries(roles)) {
      const src = path.join(sourceDir, fileName);
      const dst = path.join(targetDir, fileName);
      try {
        // Remove dst if its type conflicts with src (directory vs file).
        // A previous install may have left a flat file where a directory is now expected
        // (Sigma codex skills were flat files before; they are now directories).
        // Delta's directory-based skills at this path are also handled.
        if (fileExists(dst)) {
          const srcIsDir = fs.statSync(src).isDirectory();
          const dstIsDir = fs.statSync(dst).isDirectory();
          if (srcIsDir !== dstIsDir) {
            fs.removeSync(dst);
          }
        }
        fs.copySync(src, dst, { overwrite: true });
        ok++;
      } catch {
        warn(`  ERR: ${dst}`);
        failed++;
      }
    }

    const label = PLATFORM_LABELS[platform];
    if (failed === 0) {
      console.log(`  OK  ${label} (${ok} skills)`);
    } else {
      console.log(`  PARTIAL ${label} (${ok} OK, ${failed} ERR)`);
    }

    if (platform === 'antigravity') {
      const manifestPath = path.join(targetDir, 'manifest.json');
      let manifest: any = { skills: {} };
      if (fileExists(manifestPath)) {
        try {
          manifest = fs.readJsonSync(manifestPath);
        } catch {
          warn(`  WARN: Could not parse ${manifestPath} — recreating manifest`);
        }
      }
      if (!manifest.skills) manifest.skills = {};
      
      for (const [, fileName] of Object.entries(roles)) {
        manifest.skills[fileName] = {
          ...(manifest.skills[fileName] || {}),
          status: 'installed',
          disabled: false,
        };
      }
      
      try {
        fs.writeJsonSync(manifestPath, manifest, { spaces: 2 });
        console.log(`  OK  Antigravity manifest.json updated`);
      } catch (e) {
        warn(`  ERR: Could not write ${manifestPath}`);
      }
    }
  }

  // Hook deployment (Claude Code only)
  if (selectedPlatforms.includes('claudeCode')) {
    await deployHook();
  }
}

// ── Hook deployment ──────────────────────────────────────────────────────────

async function deployHook(): Promise<void> {
  const hookSrc = path.join(BUNDLE_HOOKS_DIR, 'protect-sigma.js');
  const hooksDir = path.join(GLOBAL_SIGMA_DIR, 'hooks');
  const hookDst = path.join(hooksDir, 'protect-sigma.js');

  if (!fileExists(hookSrc)) {
    warn('protect-sigma.js not found in bundle — skipping hook deployment');
    return;
  }

  ensureDir(hooksDir);
  fs.copySync(hookSrc, hookDst, { overwrite: true });

  // Patch ~/.claude/settings.json
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const hookCommand = `node "${hookDst}"`;
  const hookEntry = { type: 'command', command: hookCommand };

  let settings: Record<string, unknown> = {};
  if (fileExists(settingsPath)) {
    try {
      settings = fs.readJsonSync(settingsPath) as Record<string, unknown>;
    } catch {
      warn('Could not parse ~/.claude/settings.json — skipping hook patch');
      return;
    }
  }

  // Navigate / create the hooks structure
  if (!settings.hooks) settings.hooks = {};
  const hooks = settings.hooks as Record<string, unknown>;
  if (!hooks.PreToolUse) hooks.PreToolUse = [];
  const preToolUse = hooks.PreToolUse as Array<Record<string, unknown>>;

  // Find or create the Edit|Write matcher entry (idempotent)
  let matcherEntry = preToolUse.find(
    e => typeof e.matcher === 'string' && /Edit\|Write|Write\|Edit/.test(e.matcher as string),
  );

  if (!matcherEntry) {
    matcherEntry = { matcher: 'Edit|Write', hooks: [] };
    preToolUse.push(matcherEntry);
  }

  const existingHooks = (matcherEntry.hooks as Array<Record<string, unknown>>) ?? [];
  const alreadyInstalled = existingHooks.some(
    h => typeof h.command === 'string' && (h.command as string).includes('protect-sigma.js'),
  );

  if (!alreadyInstalled) {
    existingHooks.push(hookEntry);
    matcherEntry.hooks = existingHooks;
    fs.ensureDirSync(path.dirname(settingsPath));
    fs.writeJsonSync(settingsPath, settings, { spaces: 2 });
    console.log('  OK  Hook: protect-sigma.js deployed + settings.json patched');
  } else {
    console.log('  OK  Hook: protect-sigma.js already installed (no duplicate)');
  }
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
  if (fileExists(GLOBAL_BRIDGE_DIR)) {
    fs.copySync(GLOBAL_BRIDGE_DIR, path.join(backupBase, 'bridge'));
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

  // Update bridge file templates (managed, not user-modified)
  if (fileExists(BUNDLE_BRIDGE_DIR)) {
    ensureDir(GLOBAL_BRIDGE_DIR);
    copyDir(BUNDLE_BRIDGE_DIR, GLOBAL_BRIDGE_DIR);
    console.log('  Updated: bridge/ templates');
  }

  // Update cli_version in config
  if (fileExists(GLOBAL_CONFIG_FILE)) {
    const cfg = fs.readJsonSync(GLOBAL_CONFIG_FILE) as Record<string, unknown>;
    cfg.cli_version = SIGMA_VERSION;
    fs.writeJsonSync(GLOBAL_CONFIG_FILE, cfg, { spaces: 2 });
    console.log('  Updated: sigma.config.json (cli_version)');
  }

  // Redeploy skill files + hook to every detected AI tool directory.
  // No interactive selection here — update refreshes whatever is already
  // present (or newly detected), it does not ask "reinstall?" like install does.
  const detected = detectTools();
  const detectedPlatforms = (Object.entries(detected) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (detectedPlatforms.length === 0) {
    info('No AI tool directories detected. Skipping skill deployment.');
  } else {
    await deploySkillsAndHook(detectedPlatforms);
  }

  success('Sigma updated successfully.');
  console.log(`  Backup saved to: ${backupBase}`);
  console.log('  Note: existing project Sigma/ folders were NOT touched.');
  console.log('  To sync governance files into a project, run: sigma project sync --confirm');

  // Stage 3 — Refresh global MCP config untuk Codex dan Antigravity
  {
    const err = tryMcpOp(() => writeCodexMcpConfig(), '~/.codex/config.toml');
    if (err) warn(`MCP (Codex): ${err}`);
    else console.log('  MCP: ~/.codex/config.toml refreshed (sigma-mcp — Codex).');
  }
  {
    const err = tryMcpOp(() => writeAntigravityMcpConfig(), '~/.gemini/config/mcp_config.json');
    if (err) warn(`MCP (Antigravity): ${err}`);
    else console.log('  MCP: ~/.gemini/config/mcp_config.json refreshed (sigma-mcp — Antigravity).');
  }
  if (!isSigmaMcpResolvable()) {
    warn('sigma-mcp is not found in PATH. MCP config was written but will not work until sigma-mcp is resolvable. Make sure sigma-ecosystem is installed globally: npm install -g sigma-ecosystem');
  }
}

// ── sigma setup uninstall ────────────────────────────────────────────────────
//
// Global-only by construction: every path here is derived from GLOBAL_SIGMA_DIR,
// targetPaths(), or os.homedir() — this function never resolves a project-local
// path (no findProjectRoot(), no process.cwd(), no PROJECT_SIGMA_DIR). That is
// what guarantees local project folders are never touched, not a runtime check.

function readClaudeSettings(settingsPath: string): Record<string, unknown> | null {
  if (!fileExists(settingsPath)) return null;
  try {
    return fs.readJsonSync(settingsPath) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hookEntryExists(settingsPath: string): boolean {
  const settings = readClaudeSettings(settingsPath);
  const preToolUse = (settings?.hooks as Record<string, unknown> | undefined)?.PreToolUse as
    | Array<Record<string, unknown>>
    | undefined;
  if (!preToolUse) return false;

  return preToolUse.some(entry => {
    const entryHooks = entry.hooks as Array<Record<string, unknown>> | undefined;
    return entryHooks?.some(h => typeof h.command === 'string' && (h.command as string).includes('protect-sigma.js')) ?? false;
  });
}

// Idempotent mirror of deployHook()'s idempotent-add logic: removes only the
// Sigma-owned hook entry, then cleans up any container left empty as a
// consequence — never touches unrelated keys/entries in settings.json.
function removeHookEntry(settingsPath: string): void {
  const settings = readClaudeSettings(settingsPath);
  const hooks = settings?.hooks as Record<string, unknown> | undefined;
  const preToolUse = hooks?.PreToolUse as Array<Record<string, unknown>> | undefined;
  if (!settings || !hooks || !preToolUse) return;

  for (const entry of preToolUse) {
    const entryHooks = entry.hooks as Array<Record<string, unknown>> | undefined;
    if (!entryHooks) continue;
    entry.hooks = entryHooks.filter(
      h => !(typeof h.command === 'string' && (h.command as string).includes('protect-sigma.js')),
    );
  }

  hooks.PreToolUse = preToolUse.filter(entry => ((entry.hooks as unknown[] | undefined)?.length ?? 0) > 0);
  if ((hooks.PreToolUse as unknown[]).length === 0) delete hooks.PreToolUse;
  if (Object.keys(hooks).length === 0) delete settings.hooks;

  fs.writeJsonSync(settingsPath, settings, { spaces: 2 });
}

async function runUninstall(opts: { confirm?: boolean }): Promise<void> {
  const paths = targetPaths();
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

  const targetDirMap: Record<string, string> = {
    claudeCode:  paths.claudeCommands,
    codex:       paths.codexSkills,
    reasonix:    paths.reasonixSkills,
    antigravity: paths.antigravitySkills,
    cursor:      paths.cursorRules,
  };

  const skillFilesToRemove: string[] = [];
  for (const platform of Object.keys(ROLE_FILES)) {
    const targetDir = targetDirMap[platform];
    for (const fileName of Object.values(ROLE_FILES[platform])) {
      const dst = path.join(targetDir, fileName);
      if (fileExists(dst)) skillFilesToRemove.push(dst);
    }
  }

  const hasGlobalDir = fileExists(GLOBAL_SIGMA_DIR);
  const hasHookEntry = hookEntryExists(settingsPath);

  if (!hasGlobalDir && skillFilesToRemove.length === 0 && !hasHookEntry) {
    info('Nothing to uninstall — no Sigma global installation, skill files, or hook entry found.');
    return;
  }

  if (!opts.confirm) {
    info('Dry run — the following would be removed:');
    if (hasGlobalDir) console.log(`  ${GLOBAL_SIGMA_DIR}/ (entire directory)`);
    for (const f of skillFilesToRemove) console.log(`  ${f}`);
    if (hasHookEntry) console.log(`  protect-sigma.js hook entry in ${settingsPath}`);
    console.log('  Key "sigma" from ~/.codex/config.toml [mcp_servers] (if exists)');
    console.log('  Key "sigma" from ~/.gemini/config/mcp_config.json [mcpServers] (if exists)');
    warn('Pass --confirm to apply. Local project folders (Sigma/, .sigma-identity.json) are never touched.');
    warn('NOTE: .mcp.json and .cursor/mcp.json in individual project folders cannot be cleaned automatically — remove them manually if sigma is no longer needed.');
    return;
  }

  info('Uninstalling Sigma...');

  if (hasGlobalDir) {
    fs.removeSync(GLOBAL_SIGMA_DIR);
    console.log(`  Removed: ${GLOBAL_SIGMA_DIR}/`);
  }

  if (skillFilesToRemove.length > 0) {
    for (const f of skillFilesToRemove) fs.removeSync(f);
    console.log(`  Removed: ${skillFilesToRemove.length} skill file(s) from AI tool directories`);
    
    const manifestPath = path.join(paths.antigravitySkills, 'manifest.json');
    if (fileExists(manifestPath)) {
      try {
        const manifest = fs.readJsonSync(manifestPath) as any;
        if (manifest.skills) {
          for (const fileName of Object.values(ROLE_FILES.antigravity)) {
            delete manifest.skills[fileName];
          }
          fs.writeJsonSync(manifestPath, manifest, { spaces: 2 });
          console.log(`  Removed: Sigma entries from ${manifestPath}`);
        }
      } catch {
        // ignore errors on uninstall
      }
    }
  }

  if (hasHookEntry) {
    removeHookEntry(settingsPath);
    console.log(`  Removed: protect-sigma.js hook entry from ${settingsPath}`);
  }

  // Stage 8 — Hapus entri sigma dari global MCP configs
  {
    const err = tryMcpOp(() => removeCodexMcpConfig(), '~/.codex/config.toml');
    if (err) warn(`MCP cleanup (Codex): ${err}`);
    else console.log('  Removed: sigma entry from ~/.codex/config.toml (if existed).');
  }
  {
    const err = tryMcpOp(() => removeAntigravityMcpConfig(), '~/.gemini/config/mcp_config.json');
    if (err) warn(`MCP cleanup (Antigravity): ${err}`);
    else console.log('  Removed: sigma entry from ~/.gemini/config/mcp_config.json (if existed).');
  }

  success('Sigma uninstalled successfully.');
  console.log('  Local project folders (Sigma/, .sigma-identity.json) were not touched.');
  console.log('  The `sigma` command will no longer function until reinstalled.');
  warn('NOTICE: .mcp.json and .cursor/mcp.json in individual Sigma project folders were NOT cleaned automatically.');
  warn('  If sigma is no longer needed, remove the "sigma" entry from mcpServers in each project\'s .mcp.json and .cursor/mcp.json manually.');
}

// ── Command builder ──────────────────────────────────────────────────────────

export function setupCommand(): Command {
  const cmd = new Command('setup');
  cmd.description('Install or update the Sigma global installation');

  cmd
    .command('install')
    .description('Install Sigma globally to ~/.sigma/')
    .option('--force', 'Skip reinstall confirmation')
    .option('--yes', 'Non-interactive: select all detected tools without prompts')
    .action((opts: { force?: boolean; yes?: boolean }) => {
      runInstall(opts).catch(err => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });
    });

  cmd
    .command('update')
    .description('Update ~/.sigma/ templates, rules, governance, bridge templates, and redeploy skill files + hook')
    .action(() => {
      runUpdate().catch(err => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });
    });

  cmd
    .command('uninstall')
    .description('Remove the Sigma global installation (~/.sigma/), deployed skill files, and the protect-sigma hook entry — never touches local project folders')
    .option('--confirm', 'Apply changes (without this flag, dry-run only)')
    .action((opts: { confirm?: boolean }) => {
      runUninstall(opts).catch(err => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });
    });

  return cmd;
}
