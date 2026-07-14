"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCommand = setupCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("../config");
const output_1 = require("../utils/output");
const fs_1 = require("../utils/fs");
const detect_1 = require("../utils/detect");
// ── Bundle paths (files shipped inside the npm package) ─────────────────────
// __dirname resolves to dist/commands/ at runtime; walk up to package root
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLE_TEMPLATES = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'templates');
const BUNDLE_RULES = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'rules');
const BUNDLE_CONSTITUTION = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA_CONSTITUTION.md');
const BUNDLE_PROTOCOL = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA_PROTOCOL.md');
const SETUP_TARGETS_DIR = path_1.default.join(PACKAGE_ROOT, 'setup', 'targets');
const BUNDLE_BRIDGE_DIR = path_1.default.join(SETUP_TARGETS_DIR, 'bridge');
const BUNDLE_HOOKS_DIR = path_1.default.join(SETUP_TARGETS_DIR, 'hooks');
const BRIDGE_STUBS = ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'DEEPSEEK.md', 'REASONIX.md'];
const ROLE_FILES = {
    claudeCode: { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', report: 'report.md', sigmaTest: 'sigma-test.md' },
    codex: { arc: 'arc', fmn: 'fmn', dev: 'dev', aud: 'aud', report: 'report', sigmaTest: 'sigma-test' },
    reasonix: { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', report: 'report.md', sigmaTest: 'sigma-test.md' },
    antigravity: { arc: 'sigma-arc', fmn: 'sigma-fmn', dev: 'sigma-dev', aud: 'sigma-aud', report: 'sigma-report', sigmaTest: 'sigma-test' },
    cursor: { sigma: 'SIGMA.mdc' },
};
const PLATFORM_LABELS = {
    claudeCode: 'Claude Code  (~/.claude/commands/)',
    codex: 'Codex CLI    (~/.codex/skills/)',
    reasonix: 'Reasonix     (~/.reasonix/skills/)',
    antigravity: 'Antigravity  (~/.gemini/config/plugins/)',
    cursor: 'Cursor       (~/.cursor/rules/)',
};
const PLATFORM_SOURCE_DIR = {
    claudeCode: 'claude_code',
    codex: 'codex',
    reasonix: 'reasonix',
    antigravity: 'antigravity',
    cursor: 'cursor',
};
// ── sigma setup install ──────────────────────────────────────────────────────
async function runInstall(opts) {
    if ((0, fs_1.fileExists)(config_1.GLOBAL_SIGMA_DIR) && !opts.force && !opts.yes) {
        const { confirmed } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirmed',
                message: 'Sigma is already installed. Reinstall?',
                default: false,
            },
        ]);
        if (!confirmed) {
            (0, output_1.info)('Install cancelled.');
            return;
        }
    }
    (0, output_1.info)('Installing Sigma...');
    (0, fs_1.ensureDir)(config_1.GLOBAL_TEMPLATES_DIR);
    (0, fs_1.ensureDir)(config_1.GLOBAL_RULES_DIR);
    (0, fs_1.ensureDir)(config_1.GLOBAL_GOVERNANCE_DIR);
    (0, fs_1.ensureDir)(config_1.GLOBAL_BRIDGE_DIR);
    // Copy templates
    if ((0, fs_1.fileExists)(BUNDLE_TEMPLATES)) {
        (0, fs_1.copyDir)(BUNDLE_TEMPLATES, config_1.GLOBAL_TEMPLATES_DIR);
    }
    else {
        (0, output_1.warn)(`Template bundle not found at ${BUNDLE_TEMPLATES} — skipping`);
    }
    // Copy rules
    if ((0, fs_1.fileExists)(BUNDLE_RULES)) {
        (0, fs_1.copyDir)(BUNDLE_RULES, config_1.GLOBAL_RULES_DIR);
    }
    else {
        (0, output_1.warn)(`Rules bundle not found at ${BUNDLE_RULES} — skipping`);
    }
    // Copy governance documents
    if ((0, fs_1.fileExists)(BUNDLE_CONSTITUTION)) {
        fs_extra_1.default.copySync(BUNDLE_CONSTITUTION, path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'), { overwrite: true });
    }
    else {
        (0, output_1.warn)('SIGMA_CONSTITUTION.md not found in bundle — skipping');
    }
    if ((0, fs_1.fileExists)(BUNDLE_PROTOCOL)) {
        fs_extra_1.default.copySync(BUNDLE_PROTOCOL, path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'), { overwrite: true });
    }
    else {
        (0, output_1.warn)('SIGMA_PROTOCOL.md not found in bundle — skipping');
    }
    // Step A — Bridge file templates (always overwrite — templates, not user-modified)
    if ((0, fs_1.fileExists)(BUNDLE_BRIDGE_DIR)) {
        (0, fs_1.ensureDir)(config_1.GLOBAL_BRIDGE_DIR);
        (0, fs_1.copyDir)(BUNDLE_BRIDGE_DIR, config_1.GLOBAL_BRIDGE_DIR);
        console.log('  Installed: bridge/ templates');
    }
    else {
        // Fall back to seeding stubs for backward compatibility
        for (const stub of BRIDGE_STUBS) {
            const stubPath = path_1.default.join(config_1.GLOBAL_BRIDGE_DIR, stub);
            if (!(0, fs_1.fileExists)(stubPath)) {
                fs_extra_1.default.writeFileSync(stubPath, `# ${stub}\n\n<!-- Sigma bridge stub -->\n`);
            }
        }
    }
    // Seed projects.json
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_PROJECTS_FILE)) {
        fs_extra_1.default.writeJsonSync(config_1.GLOBAL_PROJECTS_FILE, { schema_version: '1.0.0', projects: [] }, { spaces: 2 });
    }
    // Seed sigma.config.json
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_CONFIG_FILE)) {
        fs_extra_1.default.writeJsonSync(config_1.GLOBAL_CONFIG_FILE, {
            schema_version: '1.0.0',
            cli_version: config_1.SIGMA_VERSION,
            installed_at: new Date().toISOString(),
        }, { spaces: 2 });
    }
    // Step B — Detect tools
    const detected = (0, detect_1.detectTools)();
    const paths = (0, detect_1.targetPaths)();
    const detectedPlatforms = Object.entries(detected)
        .filter(([, v]) => v)
        .map(([k]) => k);
    if (detectedPlatforms.length === 0) {
        (0, output_1.info)('No AI tool directories detected. Skipping skill deployment.');
        (0, output_1.info)('Detected directories: ~/.claude/commands, ~/.codex/skills, ~/.reasonix/skills, ~/.gemini/agents');
    }
    else {
        // Step C — Select platforms
        let selectedPlatforms;
        if (opts.yes) {
            selectedPlatforms = detectedPlatforms;
        }
        else {
            const { chosen } = await inquirer_1.default.prompt([
                {
                    type: 'checkbox',
                    name: 'chosen',
                    message: 'Select AI tools to configure with Sigma skills:',
                    choices: detectedPlatforms.map(p => ({ name: PLATFORM_LABELS[p], value: p, checked: true })),
                },
            ]);
            selectedPlatforms = chosen;
        }
        // Step D — Deploy skill files
        const targetDirMap = {
            claudeCode: paths.claudeCommands,
            codex: paths.codexSkills,
            reasonix: paths.reasonixSkills,
            antigravity: paths.antigravityAgents,
            cursor: paths.cursorRules,
        };
        for (const platform of selectedPlatforms) {
            const sourceDir = path_1.default.join(SETUP_TARGETS_DIR, PLATFORM_SOURCE_DIR[platform]);
            const targetDir = targetDirMap[platform];
            if (!(0, fs_1.fileExists)(sourceDir)) {
                (0, output_1.warn)(`Skill source not found for ${platform} — skipping`);
                continue;
            }
            (0, fs_1.ensureDir)(targetDir);
            const roles = ROLE_FILES[platform];
            let ok = 0;
            let failed = 0;
            for (const [, fileName] of Object.entries(roles)) {
                const src = path_1.default.join(sourceDir, fileName);
                const dst = path_1.default.join(targetDir, fileName);
                try {
                    // Remove dst if its type conflicts with src (directory vs file).
                    // A previous install may have left a flat file where a directory is now expected
                    // (Sigma codex skills were flat files before; they are now directories).
                    // Delta's directory-based skills at this path are also handled.
                    if ((0, fs_1.fileExists)(dst)) {
                        const srcIsDir = fs_extra_1.default.statSync(src).isDirectory();
                        const dstIsDir = fs_extra_1.default.statSync(dst).isDirectory();
                        if (srcIsDir !== dstIsDir) {
                            fs_extra_1.default.removeSync(dst);
                        }
                    }
                    fs_extra_1.default.copySync(src, dst, { overwrite: true });
                    ok++;
                }
                catch {
                    (0, output_1.warn)(`  ERR: ${dst}`);
                    failed++;
                }
            }
            const label = PLATFORM_LABELS[platform];
            if (failed === 0) {
                console.log(`  OK  ${label} (${ok} skills)`);
            }
            else {
                console.log(`  PARTIAL ${label} (${ok} OK, ${failed} ERR)`);
            }
        }
        // Step F — Hook deployment (Claude Code only)
        if (selectedPlatforms.includes('claudeCode')) {
            await deployHook(opts.yes);
        }
    }
    (0, output_1.success)('Sigma installed successfully.');
    console.log(`  Global dir: ${config_1.GLOBAL_SIGMA_DIR}`);
    console.log('  Run `sigma project start` to initialize a project.');
}
// ── Hook deployment ──────────────────────────────────────────────────────────
async function deployHook(yes) {
    const hookSrc = path_1.default.join(BUNDLE_HOOKS_DIR, 'protect-sigma.js');
    const hooksDir = path_1.default.join(config_1.GLOBAL_SIGMA_DIR, 'hooks');
    const hookDst = path_1.default.join(hooksDir, 'protect-sigma.js');
    if (!(0, fs_1.fileExists)(hookSrc)) {
        (0, output_1.warn)('protect-sigma.js not found in bundle — skipping hook deployment');
        return;
    }
    (0, fs_1.ensureDir)(hooksDir);
    fs_extra_1.default.copySync(hookSrc, hookDst, { overwrite: true });
    // Patch ~/.claude/settings.json
    const settingsPath = path_1.default.join(os_1.default.homedir(), '.claude', 'settings.json');
    const hookCommand = `node "${hookDst}"`;
    const hookEntry = { type: 'command', command: hookCommand };
    let settings = {};
    if ((0, fs_1.fileExists)(settingsPath)) {
        try {
            settings = fs_extra_1.default.readJsonSync(settingsPath);
        }
        catch {
            (0, output_1.warn)('Could not parse ~/.claude/settings.json — skipping hook patch');
            return;
        }
    }
    // Navigate / create the hooks structure
    if (!settings.hooks)
        settings.hooks = {};
    const hooks = settings.hooks;
    if (!hooks.PreToolUse)
        hooks.PreToolUse = [];
    const preToolUse = hooks.PreToolUse;
    // Find or create the Edit|Write matcher entry (idempotent)
    let matcherEntry = preToolUse.find(e => typeof e.matcher === 'string' && /Edit\|Write|Write\|Edit/.test(e.matcher));
    if (!matcherEntry) {
        matcherEntry = { matcher: 'Edit|Write', hooks: [] };
        preToolUse.push(matcherEntry);
    }
    const existingHooks = matcherEntry.hooks ?? [];
    const alreadyInstalled = existingHooks.some(h => typeof h.command === 'string' && h.command.includes('protect-sigma.js'));
    if (!alreadyInstalled) {
        existingHooks.push(hookEntry);
        matcherEntry.hooks = existingHooks;
        fs_extra_1.default.ensureDirSync(path_1.default.dirname(settingsPath));
        fs_extra_1.default.writeJsonSync(settingsPath, settings, { spaces: 2 });
        console.log('  OK  Hook: protect-sigma.js deployed + settings.json patched');
    }
    else {
        console.log('  OK  Hook: protect-sigma.js already installed (no duplicate)');
    }
}
// ── sigma setup update ───────────────────────────────────────────────────────
async function runUpdate() {
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_SIGMA_DIR)) {
        (0, output_1.error)('Sigma is not installed. Run: sigma setup install');
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupBase = path_1.default.join(config_1.GLOBAL_SIGMA_DIR, 'backups', timestamp);
    (0, output_1.info)('Backing up current installation...');
    if ((0, fs_1.fileExists)(config_1.GLOBAL_TEMPLATES_DIR)) {
        fs_extra_1.default.copySync(config_1.GLOBAL_TEMPLATES_DIR, path_1.default.join(backupBase, 'templates'));
    }
    if ((0, fs_1.fileExists)(config_1.GLOBAL_RULES_DIR)) {
        fs_extra_1.default.copySync(config_1.GLOBAL_RULES_DIR, path_1.default.join(backupBase, 'rules'));
    }
    if ((0, fs_1.fileExists)(config_1.GLOBAL_GOVERNANCE_DIR)) {
        fs_extra_1.default.copySync(config_1.GLOBAL_GOVERNANCE_DIR, path_1.default.join(backupBase, 'governance'));
    }
    if ((0, fs_1.fileExists)(config_1.GLOBAL_BRIDGE_DIR)) {
        fs_extra_1.default.copySync(config_1.GLOBAL_BRIDGE_DIR, path_1.default.join(backupBase, 'bridge'));
    }
    (0, output_1.info)('Updating files from package bundle...');
    if ((0, fs_1.fileExists)(BUNDLE_TEMPLATES)) {
        (0, fs_1.ensureDir)(config_1.GLOBAL_TEMPLATES_DIR);
        (0, fs_1.copyDir)(BUNDLE_TEMPLATES, config_1.GLOBAL_TEMPLATES_DIR);
        console.log('  Updated: templates/');
    }
    if ((0, fs_1.fileExists)(BUNDLE_RULES)) {
        (0, fs_1.ensureDir)(config_1.GLOBAL_RULES_DIR);
        (0, fs_1.copyDir)(BUNDLE_RULES, config_1.GLOBAL_RULES_DIR);
        console.log('  Updated: rules/');
    }
    if ((0, fs_1.fileExists)(BUNDLE_CONSTITUTION)) {
        (0, fs_1.ensureDir)(config_1.GLOBAL_GOVERNANCE_DIR);
        fs_extra_1.default.copySync(BUNDLE_CONSTITUTION, path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'), { overwrite: true });
        console.log('  Updated: governance/SIGMA_CONSTITUTION.md');
    }
    if ((0, fs_1.fileExists)(BUNDLE_PROTOCOL)) {
        (0, fs_1.ensureDir)(config_1.GLOBAL_GOVERNANCE_DIR);
        fs_extra_1.default.copySync(BUNDLE_PROTOCOL, path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'), { overwrite: true });
        console.log('  Updated: governance/SIGMA_PROTOCOL.md');
    }
    // Update bridge file templates (managed, not user-modified)
    if ((0, fs_1.fileExists)(BUNDLE_BRIDGE_DIR)) {
        (0, fs_1.ensureDir)(config_1.GLOBAL_BRIDGE_DIR);
        (0, fs_1.copyDir)(BUNDLE_BRIDGE_DIR, config_1.GLOBAL_BRIDGE_DIR);
        console.log('  Updated: bridge/ templates');
    }
    // Update cli_version in config
    if ((0, fs_1.fileExists)(config_1.GLOBAL_CONFIG_FILE)) {
        const cfg = fs_extra_1.default.readJsonSync(config_1.GLOBAL_CONFIG_FILE);
        cfg.cli_version = config_1.SIGMA_VERSION;
        fs_extra_1.default.writeJsonSync(config_1.GLOBAL_CONFIG_FILE, cfg, { spaces: 2 });
        console.log('  Updated: sigma.config.json (cli_version)');
    }
    (0, output_1.success)('Sigma updated successfully.');
    console.log(`  Backup saved to: ${backupBase}`);
    console.log('  Note: existing project Sigma/ folders were NOT touched.');
    console.log('  Note: skill files in AI tool directories were NOT redeployed.');
    console.log('  To sync governance files into a project, run: sigma project sync --confirm');
}
// ── Command builder ──────────────────────────────────────────────────────────
function setupCommand() {
    const cmd = new commander_1.Command('setup');
    cmd.description('Install or update the Sigma global installation');
    cmd
        .command('install')
        .description('Install Sigma globally to ~/.sigma/')
        .option('--force', 'Skip reinstall confirmation')
        .option('--yes', 'Non-interactive: select all detected tools without prompts')
        .action((opts) => {
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
    return cmd;
}
//# sourceMappingURL=setup.js.map