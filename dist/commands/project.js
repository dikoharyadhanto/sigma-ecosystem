"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectCommand = projectCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("../config");
const mcp_1 = require("../utils/mcp");
const progress_1 = require("../engine/progress");
const memory_1 = require("../engine/memory");
const projectConfig_1 = require("../engine/projectConfig");
const output_1 = require("../utils/output");
const fs_1 = require("../utils/fs");
// ── Bundle paths ─────────────────────────────────────────────────────────────
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLE_OP_REGISTRY = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json');
const BUNDLE_DOC_REGISTRY = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-REGISTRY.json');
const BUNDLE_MEMORY_SEED = path_1.default.join(PACKAGE_ROOT, 'setup', 'sigma-memory-seed.jsonl');
// ── Validation ────────────────────────────────────────────────────────────────
const PROJECT_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,11}$/;
function validateProjectId(id) {
    const clean = id.trim().toUpperCase();
    if (!PROJECT_ID_PATTERN.test(clean)) {
        throw new Error(`Invalid project ID "${id}". Must be uppercase letters, digits, and hyphens only, max 12 chars. Example: MYPROJ`);
    }
    return clean;
}
function validateProjectName(name) {
    const clean = name.trim();
    if (clean.length === 0 || clean.length > 64) {
        throw new Error('Project name must be between 1 and 64 characters.');
    }
    return clean;
}
function registerProjectEntry(projectId, projectName, projectPath) {
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_PROJECTS_FILE))
        return;
    const data = fs_extra_1.default.readJsonSync(config_1.GLOBAL_PROJECTS_FILE);
    const idx = data.projects.findIndex(p => p.project_id === projectId);
    const entry = {
        project_id: projectId,
        project_name: projectName,
        path: projectPath,
        registered_at: new Date().toISOString(),
    };
    if (idx >= 0) {
        data.projects[idx] = entry;
    }
    else {
        data.projects.push(entry);
    }
    fs_extra_1.default.writeJsonSync(config_1.GLOBAL_PROJECTS_FILE, data, { spaces: 2 });
}
// ── Memory seed helper ────────────────────────────────────────────────────────
function ensureMemoryFileSeeded() {
    const hasSeed = (0, fs_1.fileExists)(BUNDLE_MEMORY_SEED);
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_MEMORY_FILE)) {
        fs_extra_1.default.ensureFileSync(config_1.GLOBAL_MEMORY_FILE);
        if (hasSeed) {
            fs_extra_1.default.writeFileSync(config_1.GLOBAL_MEMORY_FILE, fs_extra_1.default.readFileSync(BUNDLE_MEMORY_SEED, 'utf-8'), 'utf-8');
        }
    }
    else {
        const existing = fs_extra_1.default.readFileSync(config_1.GLOBAL_MEMORY_FILE, 'utf-8').trim();
        if (existing.length === 0 && hasSeed) {
            fs_extra_1.default.writeFileSync(config_1.GLOBAL_MEMORY_FILE, fs_extra_1.default.readFileSync(BUNDLE_MEMORY_SEED, 'utf-8'), 'utf-8');
        }
    }
}
// ── sigma project start ───────────────────────────────────────────────────────
async function runStart(opts) {
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_SIGMA_DIR)) {
        (0, output_1.error)('Sigma is not installed. Run: sigma setup install');
    }
    const projectRoot = process.cwd();
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    const progressPath = path_1.default.join(sigmaDir, 'progress.json');
    const logsDir = path_1.default.join(sigmaDir, 'logs');
    if ((0, fs_1.fileExists)(progressPath)) {
        if (!opts.reinit) {
            (0, output_1.error)('This directory is already a Sigma project. ' +
                'Use `sigma project status` to inspect, or pass --reinit to re-initialize.');
        }
        (0, fs_1.ensureDir)(logsDir);
        const backed = (0, fs_1.backupFile)(progressPath, logsDir);
        (0, output_1.warn)(`Existing progress.json backed up to: ${backed}`);
    }
    // Collect project_id and project_name
    let projectId;
    let projectName;
    if (opts.id && opts.name) {
        projectId = validateProjectId(opts.id);
        projectName = validateProjectName(opts.name);
    }
    else {
        const answers = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'projectId',
                message: 'Project ID (uppercase, max 12 chars, e.g. MYPROJ):',
                default: opts.id,
                validate: (input) => {
                    try {
                        validateProjectId(input);
                        return true;
                    }
                    catch (e) {
                        return e.message;
                    }
                },
            },
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name (max 64 chars):',
                default: opts.name,
                validate: (input) => {
                    try {
                        validateProjectName(input);
                        return true;
                    }
                    catch (e) {
                        return e.message;
                    }
                },
            },
        ]);
        projectId = validateProjectId(answers.projectId);
        projectName = validateProjectName(answers.projectName);
    }
    (0, output_1.info)(`Initializing Sigma project: ${projectName} (${projectId})...`);
    // Create Sigma/ folder and all subfolders
    (0, fs_1.ensureDir)(sigmaDir);
    for (const sub of config_1.SUBFOLDERS) {
        (0, fs_1.ensureDir)(path_1.default.join(sigmaDir, sub));
    }
    // Copy governance documents
    const constitution = path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md');
    const protocol = path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md');
    if ((0, fs_1.fileExists)(constitution)) {
        fs_extra_1.default.copySync(constitution, path_1.default.join(sigmaDir, 'SIGMA_CONSTITUTION.md'), { overwrite: true });
    }
    else {
        (0, output_1.warn)('SIGMA_CONSTITUTION.md not found in ~/.sigma/governance — skipping');
    }
    if ((0, fs_1.fileExists)(protocol)) {
        fs_extra_1.default.copySync(protocol, path_1.default.join(sigmaDir, 'SIGMA_PROTOCOL.md'), { overwrite: true });
    }
    else {
        (0, output_1.warn)('SIGMA_PROTOCOL.md not found in ~/.sigma/governance — skipping');
    }
    // Copy rule files
    if ((0, fs_1.fileExists)(config_1.GLOBAL_RULES_DIR)) {
        fs_extra_1.default.copySync(config_1.GLOBAL_RULES_DIR, path_1.default.join(sigmaDir, 'rules'), { overwrite: true });
    }
    else {
        (0, output_1.warn)('Rules not found in ~/.sigma/rules — skipping');
    }
    // Copy registry files from package bundle
    if ((0, fs_1.fileExists)(BUNDLE_OP_REGISTRY)) {
        fs_extra_1.default.copySync(BUNDLE_OP_REGISTRY, path_1.default.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json'), { overwrite: true });
    }
    else {
        (0, output_1.warn)('SIGMA-OPERATION-REGISTRY.json not found in bundle — skipping');
    }
    if ((0, fs_1.fileExists)(BUNDLE_DOC_REGISTRY)) {
        fs_extra_1.default.copySync(BUNDLE_DOC_REGISTRY, path_1.default.join(sigmaDir, 'SIGMA-REGISTRY.json'), { overwrite: true });
    }
    else {
        (0, output_1.warn)('SIGMA-REGISTRY.json not found in bundle — skipping');
    }
    // Create progress.json
    const initial = (0, progress_1.createInitialProgress)(projectId, projectName);
    fs_extra_1.default.writeJsonSync(progressPath, initial, { spaces: 2 });
    (0, memory_1.initDecisionsFile)(projectRoot);
    console.log('  Memory: Sigma/memory/decisions.jsonl initialized (empty).');
    // Write project.config.json with language preference
    const lang = opts.lang?.trim().toLowerCase() || 'en';
    (0, projectConfig_1.writeProjectConfig)(projectRoot, (0, projectConfig_1.createDefaultProjectConfig)(lang));
    console.log(`  Config: Sigma/project.config.json written (document language: ${(0, projectConfig_1.langLabel)(lang)})`);
    // Create messages folder tree
    const messagesDir = path_1.default.join(projectRoot, config_1.MESSAGES_DIR);
    fs_extra_1.default.ensureDirSync(messagesDir);
    for (const sub of config_1.MESSAGE_SUBFOLDERS) {
        fs_extra_1.default.ensureDirSync(path_1.default.join(messagesDir, sub));
    }
    const indexPath = path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE);
    fs_extra_1.default.writeJsonSync(indexPath, { messages: [] }, { spaces: 2 });
    console.log('  Mailbox: Sigma/messages/ initialized.');
    // Create bridge file stubs
    for (const bridgeFile of ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md']) {
        const bridgePath = path_1.default.join(projectRoot, bridgeFile);
        if (!(0, fs_1.fileExists)(bridgePath) || opts.overwriteBridge) {
            fs_extra_1.default.writeFileSync(bridgePath, `# ${bridgeFile}\n\n<!-- Sigma bridge stub — Phase 6 will write real content -->\n`);
        }
    }
    // Register in global projects.json
    registerProjectEntry(projectId, projectName, projectRoot);
    // Write .mcp.json so AI agents can reach sigma-memory and sequential-thinking
    const mcpJsonPath = path_1.default.join(projectRoot, '.mcp.json');
    (0, mcp_1.writeMcpJson)(mcpJsonPath);
    ensureMemoryFileSeeded();
    console.log(`  MCP: ${mcpJsonPath} written (sigma-memory + sequential-thinking).`);
    console.log(`  Memory file: ${config_1.GLOBAL_MEMORY_FILE}`);
    (0, output_1.success)(`Sigma project initialized: ${projectName} (${projectId})`);
    console.log(`  Location: ${sigmaDir}`);
    console.log('  Next: Run `sigma session bootstrap` to confirm state.');
}
// ── sigma project status ──────────────────────────────────────────────────────
function runStatus() {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const data = (0, progress_1.readProgress)(projectRoot);
    const gates = (0, progress_1.getGateStatus)(data);
    const stale = (0, progress_1.isStaleIntentPresent)(data);
    console.log('\n=== Sigma Project Status ===\n');
    console.log(`Project:          ${data.project_name} (${data.project_id})`);
    console.log(`Lifecycle Phase:  ${data.lifecycle_state}`);
    console.log(`Last Updated:     ${data.updated_at}`);
    const ARTIFACT_LABELS = {
        intent: { label: 'Intent Doc', code: 'DIR-INTENT' },
        plan: { label: 'Plan Doc', code: 'FMN-PLAN' },
        exec: { label: 'Execution Evidence', code: 'DEV-EXEC' },
        close: { label: 'Closure Doc', code: 'DIR-CLOSE' },
        roadmap: { label: 'Roadmap Doc', code: 'ROADMAP' },
    };
    console.log('\n--- Artifact Status ---');
    for (const domain of ['intent', 'plan', 'exec', 'close', 'roadmap']) {
        const tracker = data[domain];
        const version = tracker.active_version ?? 'none';
        const state = tracker.active_state ?? '—';
        const meta = ARTIFACT_LABELS[domain];
        const label = version !== 'none'
            ? `${meta.label} (${meta.code} ${version})`
            : `${meta.label} (${meta.code})`;
        console.log(`${label.padEnd(40)} [${state}]`);
    }
    console.log('\n--- Gate Status ---');
    console.log(`Gate 1 (Design Complete):   ${gates.gate_1_open ? 'OPEN' : 'BLOCKED'}`);
    console.log(`Gate 2 (Plan Locked):       ${gates.gate_2_open ? 'OPEN' : 'BLOCKED'}`);
    console.log(`Gate 3 (Build Evidence):    ${gates.gate_3_satisfied ? 'SATISFIED' : 'BLOCKED'}`);
    if (stale.length > 0) {
        console.log('\n--- STALE_INTENT Warnings ---');
        for (const w of stale) {
            (0, output_1.warn)(`  ${w.domain} ${w.version} has stale_intent=true`);
        }
    }
    const nextOps = (0, progress_1.getNextValidOperations)(data);
    console.log('\n--- Next Valid Operations ---');
    if (nextOps.length > 0) {
        for (const op of nextOps) {
            console.log(`  sigma ${op}`);
        }
    }
    else {
        console.log('  none');
    }
    console.log('');
}
// ── sigma project sync ────────────────────────────────────────────────────────
function runSync(opts) {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    const logsDir = path_1.default.join(sigmaDir, 'logs');
    const filesToSync = [
        { src: path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'), dest: path_1.default.join(sigmaDir, 'SIGMA_CONSTITUTION.md') },
        { src: path_1.default.join(config_1.GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'), dest: path_1.default.join(sigmaDir, 'SIGMA_PROTOCOL.md') },
    ];
    const rulesDestDir = path_1.default.join(sigmaDir, 'rules');
    if (!opts.confirm) {
        (0, output_1.info)('Dry run — files that would be updated:');
        for (const f of filesToSync) {
            console.log(`  ${f.src} → ${f.dest}`);
        }
        console.log(`  ${config_1.GLOBAL_RULES_DIR}/ → ${rulesDestDir}/`);
        if ((0, fs_1.fileExists)(BUNDLE_OP_REGISTRY)) {
            console.log(`  SIGMA-OPERATION-REGISTRY.json (from bundle)`);
        }
        if ((0, fs_1.fileExists)(BUNDLE_DOC_REGISTRY)) {
            console.log(`  SIGMA-REGISTRY.json (from bundle)`);
        }
        (0, output_1.warn)('Pass --confirm to apply.');
        return;
    }
    // Backup before sync
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path_1.default.join(logsDir, `sync-backup-${timestamp}`);
    (0, fs_1.ensureDir)(backupDir);
    const updated = [];
    for (const f of filesToSync) {
        if ((0, fs_1.fileExists)(f.dest)) {
            fs_extra_1.default.copySync(f.dest, path_1.default.join(backupDir, path_1.default.basename(f.dest)));
        }
        if ((0, fs_1.fileExists)(f.src)) {
            fs_extra_1.default.copySync(f.src, f.dest, { overwrite: true });
            updated.push(path_1.default.basename(f.dest));
        }
    }
    if ((0, fs_1.fileExists)(config_1.GLOBAL_RULES_DIR)) {
        if ((0, fs_1.fileExists)(rulesDestDir)) {
            fs_extra_1.default.copySync(rulesDestDir, path_1.default.join(backupDir, 'rules'));
        }
        fs_extra_1.default.copySync(config_1.GLOBAL_RULES_DIR, rulesDestDir, { overwrite: true });
        updated.push('rules/');
    }
    if ((0, fs_1.fileExists)(BUNDLE_OP_REGISTRY)) {
        const dest = path_1.default.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json');
        if ((0, fs_1.fileExists)(dest))
            fs_extra_1.default.copySync(dest, path_1.default.join(backupDir, 'SIGMA-OPERATION-REGISTRY.json'));
        fs_extra_1.default.copySync(BUNDLE_OP_REGISTRY, dest, { overwrite: true });
        updated.push('SIGMA-OPERATION-REGISTRY.json');
    }
    if ((0, fs_1.fileExists)(BUNDLE_DOC_REGISTRY)) {
        const dest = path_1.default.join(sigmaDir, 'SIGMA-REGISTRY.json');
        if ((0, fs_1.fileExists)(dest))
            fs_extra_1.default.copySync(dest, path_1.default.join(backupDir, 'SIGMA-REGISTRY.json'));
        fs_extra_1.default.copySync(BUNDLE_DOC_REGISTRY, dest, { overwrite: true });
        updated.push('SIGMA-REGISTRY.json');
    }
    (0, output_1.success)('Project synced successfully.');
    for (const f of updated) {
        console.log(`  Updated: ${f}`);
    }
    console.log(`  Backup saved to: ${backupDir}`);
}
// ── sigma project reset ───────────────────────────────────────────────────────
function runReset(opts) {
    if (!opts.confirm) {
        (0, output_1.error)('--confirm is required. This operation resets project state. Pass --confirm to proceed.');
    }
    const projectRoot = (0, fs_1.findProjectRoot)();
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    const logsDir = path_1.default.join(sigmaDir, 'logs');
    const progressPath = path_1.default.join(sigmaDir, 'progress.json');
    // Read existing to preserve project_id and project_name
    const existing = (0, progress_1.readProgress)(projectRoot);
    (0, fs_1.ensureDir)(logsDir);
    const backed = (0, fs_1.backupFile)(progressPath, logsDir);
    (0, output_1.warn)(`progress.json backed up to: ${backed}`);
    const fresh = (0, progress_1.createInitialProgress)(existing.project_id, existing.project_name);
    fs_extra_1.default.writeJsonSync(progressPath, fresh, { spaces: 2 });
    if (opts.wipe) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveDir = path_1.default.join(logsDir, `reset-archive-${timestamp}`);
        (0, fs_1.ensureDir)(archiveDir);
        for (const folder of ['design', 'build', 'close']) {
            const src = path_1.default.join(sigmaDir, folder);
            if ((0, fs_1.fileExists)(src)) {
                fs_extra_1.default.copySync(src, path_1.default.join(archiveDir, folder));
                fs_extra_1.default.emptyDirSync(src);
                console.log(`  Archived and cleared: ${folder}/`);
            }
        }
        (0, output_1.success)('Project hard reset complete. Artifact files archived.');
        console.log(`  Archive: ${archiveDir}`);
    }
    else {
        (0, output_1.success)('Project soft reset complete. Artifact files preserved.');
    }
    console.log('  progress.json reset to initial state.');
}
// ── sigma project register ────────────────────────────────────────────────────
function runRegister() {
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_PROJECTS_FILE)) {
        (0, output_1.error)('~/.sigma/projects.json not found. Run: sigma setup install');
    }
    const projectRoot = (0, fs_1.findProjectRoot)();
    const data = (0, progress_1.readProgress)(projectRoot);
    registerProjectEntry(data.project_id, data.project_name, projectRoot);
    (0, output_1.success)(`Project registered: ${data.project_name} (${data.project_id})`);
    console.log(`  Path: ${projectRoot}`);
}
// ── Command builder ───────────────────────────────────────────────────────────
function projectCommand() {
    const cmd = new commander_1.Command('project');
    cmd.description('Manage Sigma projects');
    cmd
        .command('start')
        .description('Initialize a Sigma project in the current directory')
        .option('--id <PROJECT_ID>', 'Project ID (uppercase, max 12 chars)')
        .option('--name <name>', 'Project name (max 64 chars)')
        .option('--lang <code>', 'Document language ISO 639-1 code (default: en). Use "id" for Bahasa Indonesia.')
        .option('--confirm', 'Skip interactive prompts (requires --id and --name)')
        .option('--reinit', 'Re-initialize an existing Sigma project (backs up progress.json)')
        .option('--overwrite-bridge', 'Overwrite existing bridge files (CLAUDE.md, GEMINI.md, AGENTS.md)')
        .action((opts) => {
        runStart(opts).catch(err => {
            console.error(err instanceof Error ? err.message : String(err));
            process.exit(1);
        });
    });
    cmd
        .command('status')
        .description('Show current project state (lifecycle, artifacts, gates)')
        .action(() => {
        try {
            runStatus();
        }
        catch (e) {
            (0, output_1.error)(e.message);
        }
    });
    cmd
        .command('sync')
        .description('Sync governance files from ~/.sigma/ into this project')
        .option('--confirm', 'Apply changes (without this flag, dry-run only)')
        .action((opts) => {
        try {
            runSync(opts);
        }
        catch (e) {
            (0, output_1.error)(e.message);
        }
    });
    cmd
        .command('reset')
        .description('Reset project state (soft or archive)')
        .option('--confirm', 'Required — confirms the reset')
        .option('--wipe', 'Archive and clear artifact folders (design/, build/, close/)')
        .action((opts) => {
        try {
            runReset(opts);
        }
        catch (e) {
            (0, output_1.error)(e.message);
        }
    });
    cmd
        .command('register')
        .description('Register this project in ~/.sigma/projects.json')
        .action(() => {
        try {
            runRegister();
        }
        catch (e) {
            (0, output_1.error)(e.message);
        }
    });
    return cmd;
}
//# sourceMappingURL=project.js.map