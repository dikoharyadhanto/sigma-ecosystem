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
  GLOBAL_PROJECTS_FILE,
  GLOBAL_CONFIG_FILE,
  GLOBAL_MEMORY_FILE,
  SIGMA_VERSION,
} from '../config';
import { success, info, warn, error } from '../utils/output';
import { ensureDir, copyDir, fileExists } from '../utils/fs';
import { writeMcpJson, writeVscodeMcpJson, createMcpConfig, writeReasonixMcpConfig, writeGeminiMcpConfig } from '../utils/mcp';
import { detectTools, targetPaths } from '../utils/detect';

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
const BUNDLE_MEMORY_SEED = path.join(PACKAGE_ROOT, 'setup', 'sigma-memory-seed.jsonl');

const BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md'];

const ROLE_FILES: Record<string, Record<string, string>> = {
  claudeCode:  { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', checkpoint: 'checkpoint.md', cso: 'cso.md', report: 'report.md', sigmaTest: 'sigma-test.md' },
  codex:       { arc: 'arc',    fmn: 'fmn',    dev: 'dev',    aud: 'aud',    checkpoint: 'checkpoint',    cso: 'cso',    report: 'report',    sigmaTest: 'sigma-test'    },
  reasonix:    { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', checkpoint: 'checkpoint.md', cso: 'cso.md', report: 'report.md', sigmaTest: 'sigma-test.md' },
  antigravity: { arc: 'sigma-arc', fmn: 'sigma-fmn', dev: 'sigma-dev', aud: 'sigma-aud', checkpoint: 'sigma-checkpoint', cso: 'sigma-cso', report: 'sigma-report', sigmaTest: 'sigma-test' },
  cursor:      { sigma: 'SIGMA.mdc' },
};

const PLATFORM_LABELS: Record<string, string> = {
  claudeCode:  'Claude Code  (~/.claude/commands/)',
  codex:       'Codex CLI    (~/.codex/skills/)',
  reasonix:    'Reasonix     (~/.reasonix/skills/)',
  antigravity: 'Antigravity  (~/.gemini/config/plugins/)',
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

  // Step B — Detect tools
  const detected = detectTools();
  const paths = targetPaths();
  const detectedPlatforms = (Object.entries(detected) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (detectedPlatforms.length === 0) {
    info('No AI tool directories detected. Skipping skill deployment.');
    info('Detected directories: ~/.claude/commands, ~/.codex/skills, ~/.reasonix/skills, ~/.gemini/agents');
  } else {
    // Step C — Select platforms
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

    // Step D — Deploy skill files
    const targetDirMap: Record<string, string> = {
      claudeCode:  paths.claudeCommands,
      codex:       paths.codexSkills,
      reasonix:    paths.reasonixSkills,
      antigravity: paths.antigravityAgents,
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
    }

    // Step E — Reasonix MCP config (when Reasonix is selected)
    if (selectedPlatforms.includes('reasonix')) {
      try {
        const { editModeChanged } = writeReasonixMcpConfig(paths.reasonixConfig);
        console.log(`  OK  Reasonix MCP: mcpServers + shellAllowed written to ${paths.reasonixConfig}`);
        if (editModeChanged) {
          console.log('  NOTE: editMode changed to "auto" — required for shell commands to execute in Reasonix.');
        }
      } catch (e) {
        warn(`  ERR: Reasonix MCP config — ${(e as Error).message}`);
      }
    }

    // Step E2 — Antigravity MCP config (when Antigravity is selected)
    if (selectedPlatforms.includes('antigravity')) {
      try {
        writeGeminiMcpConfig();
        const geminiMcpPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
        console.log(`  OK  Antigravity MCP: sigma-memory written to ${geminiMcpPath}`);
      } catch (e) {
        warn(`  ERR: Antigravity MCP config — ${(e as Error).message}`);
      }
    }

    // Step F — Hook deployment (Claude Code only)
    if (selectedPlatforms.includes('claudeCode')) {
      await deployHook(opts.yes);
    }
  }

  success('Sigma installed successfully.');
  console.log(`  Global dir: ${GLOBAL_SIGMA_DIR}`);
  console.log('  Run `sigma project start` to initialize a project.');
}

// ── Hook deployment ──────────────────────────────────────────────────────────

async function deployHook(yes?: boolean): Promise<void> {
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

  success('Sigma updated successfully.');
  console.log(`  Backup saved to: ${backupBase}`);
  console.log('  Note: existing project Sigma/ folders were NOT touched.');
  console.log('  Note: skill files in AI tool directories were NOT redeployed.');
  console.log('  To sync governance files into a project, run: sigma project sync --confirm');
}

// ── sigma setup memory ───────────────────────────────────────────────────────

function seedMemoryFile(): void {
  if (!fileExists(BUNDLE_MEMORY_SEED)) {
    warn('Memory seed file not found in package bundle. Skipping seed.');
    return;
  }
  const seedContent = fs.readFileSync(BUNDLE_MEMORY_SEED, 'utf-8');
  fs.writeFileSync(GLOBAL_MEMORY_FILE, seedContent, 'utf-8');
}

function runMemorySetup(opts: { vscode?: boolean; print?: boolean; reseed?: boolean; reasonix?: boolean; gemini?: boolean }): void {
  if (!fileExists(GLOBAL_SIGMA_DIR)) {
    error('Sigma is not installed. Run: sigma setup install');
  }

  const needsSigmaMemory = Boolean(opts.reseed || opts.reasonix || opts.gemini);

  if (needsSigmaMemory) {
    // Ensure memory file exists when a global sigma-memory adapter is requested.
    if (!fileExists(GLOBAL_MEMORY_FILE)) {
      fs.ensureFileSync(GLOBAL_MEMORY_FILE);
      seedMemoryFile();
      success(`Memory file created and seeded: ${GLOBAL_MEMORY_FILE}`);
    } else if (opts.reseed) {
      seedMemoryFile();
      success(`Memory file reseeded: ${GLOBAL_MEMORY_FILE}`);
    } else {
      const existing = fs.readFileSync(GLOBAL_MEMORY_FILE, 'utf-8').trim();
      if (existing.length === 0) {
        seedMemoryFile();
        success(`Memory file seeded: ${GLOBAL_MEMORY_FILE}`);
      } else {
        info(`Memory file: ${GLOBAL_MEMORY_FILE}`);
      }
    }
  }

  const projectRoot = process.cwd();

  // Write .mcp.json at project root
  const mcpJsonPath = path.join(projectRoot, '.mcp.json');
  writeMcpJson(mcpJsonPath);
  success(`Written: ${mcpJsonPath}`);

  // Optionally write .vscode/mcp.json
  if (opts.vscode) {
    const vscodeMcpPath = path.join(projectRoot, '.vscode', 'mcp.json');
    writeVscodeMcpJson(vscodeMcpPath);
    success(`Written: ${vscodeMcpPath}`);
  }

  // Optionally write ~/.reasonix/config.json (global, merged with existing)
  if (opts.reasonix) {
    const paths = targetPaths();
    const { editModeChanged } = writeReasonixMcpConfig(paths.reasonixConfig);
    success(`Written: ${paths.reasonixConfig}`);
    if (editModeChanged) {
      console.log('  NOTE: editMode changed to "yolo" — required for all gates (file edits + shell) to be skipped in Reasonix.');
    }
  }

  // Optionally write ~/.gemini/antigravity/mcp_config.json (global, merged with existing)
  if (opts.gemini) {
    writeGeminiMcpConfig();
    const geminiMcpPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
    success(`Written: ${geminiMcpPath}`);
  }

  if (opts.print) {
    console.log('\n=== Generated .mcp.json ===\n');
    console.log(JSON.stringify(createMcpConfig(), null, 2));
    console.log('');
  }

  console.log('\n  Local MCP servers configured:');
  console.log('    sequential-thinking  — structured multi-step reasoning');
  if (opts.reasonix || opts.gemini) {
    console.log('\n  Optional global Sigma memory adapters configured for selected tools.');
    console.log('  Sigma memory remains ecosystem-level only; role activation uses role memory first.');
  }
  console.log('\n  Project decision log: Sigma/memory/decisions.jsonl (per-project, CLI-written)');
  console.log('  Role activation memory: Sigma/role-memory/*.json (project-local or bundled)\n');
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
    .description('Update ~/.sigma/ templates, rules, governance, and bridge templates from package bundle')
    .action(() => {
      runUpdate().catch(err => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });
    });

  cmd
    .command('memory')
    .description('Write project MCP config (sequential-thinking by default) and optional global adapters')
    .option('--vscode', 'Also write .vscode/mcp.json for VS Code extension')
    .option('--reasonix', 'Also write MCP entries into ~/.reasonix/config.json (global, merged)')
    .option('--gemini', 'Also write MCP entries into ~/.gemini/antigravity/mcp_config.json (global, merged)')
    .option('--print', 'Print generated config to stdout in addition to writing files')
    .option('--reseed', 'Overwrite memory file with fresh seed from package bundle')
    .action((opts: { vscode?: boolean; print?: boolean; reseed?: boolean; reasonix?: boolean; gemini?: boolean }) => {
      try { runMemorySetup(opts); } catch (e) { error((e as Error).message); }
    });

  return cmd;
}
