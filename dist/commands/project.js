"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProjectId = validateProjectId;
exports.validateProjectName = validateProjectName;
exports.projectCommand = projectCommand;
const commander_1 = require("commander");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("../config");
const roleMemory_1 = require("../engine/roleMemory");
const reconstruct_1 = require("../engine/reconstruct");
const artifacts_1 = require("../utils/artifacts");
const progress_1 = require("../engine/progress");
const chain_1 = require("../engine/chain");
const projectConfig_1 = require("../engine/projectConfig");
const languageWizard_1 = require("../engine/languageWizard");
const output_1 = require("../utils/output");
const fs_1 = require("../utils/fs");
const operationLog_1 = require("../utils/operationLog");
// ── Bundle paths ─────────────────────────────────────────────────────────────
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLE_OP_REGISTRY = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json');
const BUNDLE_DOC_REGISTRY = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-REGISTRY.json');
const BUNDLE_ROLE_MEMORY_DIR = (0, roleMemory_1.getBundledRoleMemoryDir)();
const BUNDLE_BRIDGE_DIR = path_1.default.join(PACKAGE_ROOT, 'setup', 'targets', 'bridge');
// Resolve a bridge template the same way resolveTemplate() resolves doctrine templates:
// prefer the global (Director-editable) copy, fall back to the package bundle.
function resolveBridgeTemplate(fileName) {
    const global = path_1.default.join(config_1.GLOBAL_BRIDGE_DIR, fileName);
    if ((0, fs_1.fileExists)(global))
        return global;
    const bundle = path_1.default.join(BUNDLE_BRIDGE_DIR, fileName);
    if ((0, fs_1.fileExists)(bundle))
        return bundle;
    return null;
}
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
// Preserves the existing logs_created_at unless the operations log was just
// (re)initialized — first-time creation and loss recovery are the same event
// and both get a fresh timestamp; an untouched, still-valid log keeps its
// original timestamp across repeated `start`/`register` calls.
function resolveLogsCreatedAt(projectRoot, logsReinitialized) {
    if (!logsReinitialized) {
        const identityPath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
        if ((0, fs_1.fileExists)(identityPath)) {
            try {
                const existing = fs_extra_1.default.readJsonSync(identityPath);
                if (existing.logs_created_at)
                    return existing.logs_created_at;
            }
            catch {
                // fall through to a fresh timestamp
            }
        }
    }
    return new Date().toISOString();
}
function writeProjectIdentity(projectRoot, projectId, projectName, logsCreatedAt) {
    const identity = {
        schema_version: config_1.SCHEMA_VERSION,
        project_id: projectId,
        project_name: projectName,
        registered: true,
        logs_created_at: logsCreatedAt,
    };
    fs_extra_1.default.writeJsonSync(path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE), identity, { spaces: 2 });
}
// ── sigma project start ───────────────────────────────────────────────────────
async function runStart(opts) {
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_SIGMA_DIR)) {
        (0, output_1.error)('Sigma is not installed. Run: sigma setup install');
    }
    const projectRoot = process.cwd();
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    const progressPath = path_1.default.join(sigmaDir, 'progress.json');
    if ((0, fs_1.fileExists)(progressPath)) {
        if (!opts.reinit) {
            (0, output_1.error)('This directory is already a Sigma project. ' +
                'Use `sigma project status` to inspect, or pass --reinit to re-initialize.');
        }
    }
    // Collect project_id and project_name
    let projectId;
    let projectName;
    let projectConfig = (0, projectConfig_1.createDefaultProjectConfig)(opts.lang?.trim() || 'English');
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
        console.log('');
        projectConfig = await (0, languageWizard_1.promptLanguageWizard)(projectConfig);
    }
    (0, output_1.info)(`Initializing Sigma project: ${projectName} (${projectId})...`);
    // Create Sigma/ folder and all subfolders
    (0, fs_1.ensureDir)(sigmaDir);
    for (const sub of config_1.SUBFOLDERS) {
        (0, fs_1.ensureDir)(path_1.default.join(sigmaDir, sub));
    }
    // Operation history log — created empty here so it exists from the very
    // first operation onward. Result feeds logs_created_at on the identity
    // file below.
    const logsReinitialized = (0, operationLog_1.ensureOperationsLog)(projectRoot);
    // Scaffold the project-wide reference list (Comprehensive Research source index)
    (0, artifacts_1.copyTemplateToArtifact)('REFERENCE-LIST-TEMPLATE.md', path_1.default.join(projectRoot, config_1.REFERENCE_LIST_FILE));
    console.log('  Reference: Sigma/reference/reference-list.md initialized.');
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
    // Create progress.json — PLAN-EVAL-01: this file is legacy/inert now.
    // Nothing reads its content anymore (only findProjectRoot() checks it
    // exists, until Fase 5 moves that anchor to activate_status.json). Kept
    // exactly as before to avoid unrelated churn before that fase lands.
    const initial = (0, progress_1.createInitialProgress)(projectId, projectName);
    fs_extra_1.default.writeJsonSync(progressPath, initial, { spaces: 2 });
    // PLAN-EVAL-01 §5.9 — the real per-chain state lives in
    // Sigma/progress-v<N>.json files, created lazily by `sigma intent new`.
    // The manifest is created here, upfront, with no chain active yet, so
    // findProjectRoot() (post-Fase-5) and `sigma intent list` always have
    // something to read even before the first `intent new`.
    (0, chain_1.writeActivateStatus)(projectRoot, null);
    // Write .sigma-identity.json (root-level, used by `sigma doctor --reconstruct`
    // as a fallback if progress.json is ever lost or corrupted)
    writeProjectIdentity(projectRoot, projectId, projectName, resolveLogsCreatedAt(projectRoot, logsReinitialized));
    console.log('  Identity: .sigma-identity.json written.');
    // Write project.config.json with language preferences
    (0, projectConfig_1.writeProjectConfig)(projectRoot, projectConfig);
    console.log(`  Config: Sigma/project.config.json written (Sigma docs language: ${projectConfig.document_language})`);
    // Create messages folder tree
    const messagesDir = path_1.default.join(projectRoot, config_1.MESSAGES_DIR);
    fs_extra_1.default.ensureDirSync(messagesDir);
    for (const sub of config_1.MESSAGE_SUBFOLDERS) {
        fs_extra_1.default.ensureDirSync(path_1.default.join(messagesDir, sub));
    }
    const indexPath = path_1.default.join(projectRoot, config_1.MESSAGES_INDEX_FILE);
    fs_extra_1.default.writeJsonSync(indexPath, { messages: [] }, { spaces: 2 });
    console.log('  Mailbox: Sigma/messages/ initialized.');
    if ((0, fs_1.fileExists)(BUNDLE_ROLE_MEMORY_DIR)) {
        fs_extra_1.default.copySync(BUNDLE_ROLE_MEMORY_DIR, path_1.default.join(sigmaDir, 'role-memory'), { overwrite: true });
        console.log('  Role memory: Sigma/role-memory/ copied from bundle.');
    }
    else {
        (0, output_1.warn)('Sigma/role-memory bundle not found — skipping');
    }
    // Copy bridge file templates (CLAUDE.md, GEMINI.md, AGENTS.md, DEEPSEEK.md, REASONIX.md)
    let bridgeCopied = 0;
    for (const bridgeFile of config_1.BRIDGE_STUBS) {
        const bridgePath = path_1.default.join(projectRoot, bridgeFile);
        if ((0, fs_1.fileExists)(bridgePath) && !opts.overwriteBridge)
            continue;
        const template = resolveBridgeTemplate(bridgeFile);
        if (template) {
            fs_extra_1.default.copySync(template, bridgePath, { overwrite: true });
            bridgeCopied++;
        }
        else {
            (0, output_1.warn)(`Bridge template not found for ${bridgeFile} — skipping`);
        }
    }
    if (bridgeCopied > 0) {
        console.log(`  Bridge: ${bridgeCopied} file(s) written from template.`);
    }
    (0, output_1.success)(`Sigma project initialized: ${projectName} (${projectId})`);
    console.log(`  Location: ${sigmaDir}`);
    console.log('  Next: Run `sigma session bootstrap` or `sigma project status` to confirm state.');
}
// ── sigma project status ──────────────────────────────────────────────────────
function runStatus() {
    const projectRoot = (0, fs_1.findProjectRoot)();
    const identity = (0, chain_1.readProjectIdentity)(projectRoot);
    // No chain yet (fresh project, before the first `intent new`) is a valid
    // state — matches today's graceful display rather than erroring out.
    const hasChain = (0, chain_1.listChainVersions)(projectRoot).length > 0;
    const { chainVersion, data: chain } = hasChain
        ? (0, chain_1.readActiveChain)(projectRoot)
        : { chainVersion: null, data: null };
    console.log('\n=== Sigma Project Status ===\n');
    console.log(`Project:          ${identity.project_name} (${identity.project_id})`);
    console.log(`Active Chain:     ${chainVersion ?? 'none — no DIR-INTENT yet'}`);
    console.log(`Lifecycle Phase:  ${chain?.lifecycle_state ?? '—'}`);
    console.log(`Last Updated:     ${chain?.updated_at ?? '—'}`);
    if (chain) {
        console.log('\n--- Artifact Status ---');
        const artifactLine = (label, code, version, state) => {
            const display = version !== null ? `${label} (${code} ${version})` : `${label} (${code})`;
            console.log(`${display.padEnd(40)} [${state ?? '—'}]`);
        };
        artifactLine('Intent Doc', 'DIR-INTENT', chain.intent.version, chain.intent.state);
        artifactLine('Plan Doc', 'FMN-PLAN', chain.plan.active_version, chain.plan.active_state);
        artifactLine('Execution Evidence', 'DEV-EXEC', chain.exec.active_version, chain.exec.active_state);
        artifactLine('Closure Doc', 'DIR-CLOSE', chain.close?.version ?? null, chain.close?.state ?? null);
        artifactLine('Roadmap Doc', 'ROADMAP', chain.roadmap?.version ?? null, chain.roadmap?.state ?? null);
        console.log('\n--- Gate Status ---');
        console.log(`Gate 1 (Design Complete):   ${(0, chain_1.getGateStatusLabel)(chain, 'gate_1_open')}`);
        console.log(`Gate 2 (Plan Locked):       ${(0, chain_1.getGateStatusLabel)(chain, 'gate_2_open')}`);
        console.log(`Gate 3 (Build Evidence):    ${(0, chain_1.getGateStatusLabel)(chain, 'gate_3_satisfied')}`);
        if ((0, chain_1.hasInvalidRuntime)(chain)) {
            console.log('\n--- INVALID Runtime Warnings ---');
            for (const line of (0, chain_1.getInvalidWarningLines)(chain)) {
                console.log(`  [INVALID] ${line}`);
            }
        }
    }
    else {
        console.log('\n--- Artifact Status ---');
        console.log('  No DIR-INTENT exists yet.');
    }
    const nextOps = chain ? (0, chain_1.getNextValidOperations)(chain) : ['intent new'];
    console.log('\n--- CLI-Valid Runtime Operations ---');
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
        if ((0, fs_1.fileExists)(BUNDLE_ROLE_MEMORY_DIR)) {
            console.log('  role-memory/ (from bundle)');
        }
        (0, output_1.warn)('Pass --confirm to apply.');
        return;
    }
    const updated = [];
    for (const f of filesToSync) {
        if ((0, fs_1.fileExists)(f.src)) {
            fs_extra_1.default.copySync(f.src, f.dest, { overwrite: true });
            updated.push(path_1.default.basename(f.dest));
        }
    }
    if ((0, fs_1.fileExists)(config_1.GLOBAL_RULES_DIR)) {
        fs_extra_1.default.copySync(config_1.GLOBAL_RULES_DIR, rulesDestDir, { overwrite: true });
        updated.push('rules/');
    }
    if ((0, fs_1.fileExists)(BUNDLE_OP_REGISTRY)) {
        const dest = path_1.default.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json');
        fs_extra_1.default.copySync(BUNDLE_OP_REGISTRY, dest, { overwrite: true });
        updated.push('SIGMA-OPERATION-REGISTRY.json');
    }
    if ((0, fs_1.fileExists)(BUNDLE_DOC_REGISTRY)) {
        const dest = path_1.default.join(sigmaDir, 'SIGMA-REGISTRY.json');
        fs_extra_1.default.copySync(BUNDLE_DOC_REGISTRY, dest, { overwrite: true });
        updated.push('SIGMA-REGISTRY.json');
    }
    if ((0, fs_1.fileExists)(BUNDLE_ROLE_MEMORY_DIR)) {
        const dest = path_1.default.join(sigmaDir, 'role-memory');
        fs_extra_1.default.copySync(BUNDLE_ROLE_MEMORY_DIR, dest, { overwrite: true });
        updated.push('role-memory/');
    }
    (0, output_1.success)('Project synced successfully.');
    for (const f of updated) {
        console.log(`  Updated: ${f}`);
    }
}
// ── sigma project register ────────────────────────────────────────────────────
//
// Repurposed as a repair/harvest tool for .sigma-identity.json — `project start`
// already writes it once, so this command exists for: (a) restoring a
// missing/corrupted identity file, (b) backfilling projects created before this
// file existed. Uses findSigmaProjectRoot() (Sigma/ folder only) rather than
// findProjectRoot() (requires progress.json) so it still works when progress.json
// itself is the thing that's broken.
function resolveRegisterIdentity(projectRoot, opts) {
    const progressPath = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR, 'progress.json');
    if ((0, fs_1.fileExists)(progressPath)) {
        try {
            const data = fs_extra_1.default.readJsonSync(progressPath);
            if (data.project_id && data.project_name) {
                return { id: data.project_id, name: data.project_name };
            }
        }
        catch {
            // progress.json is unreadable — fall through to manual flags
        }
    }
    if (opts.id && opts.name) {
        return { id: validateProjectId(opts.id), name: validateProjectName(opts.name) };
    }
    throw new Error('Sigma/progress.json is missing, unreadable, or incomplete — cannot determine project identity ' +
        'automatically. Pass --id <PROJECT_ID> --name <name> to proceed.');
}
function runRegister(opts) {
    const projectRoot = (0, reconstruct_1.findSigmaProjectRoot)();
    const identity = resolveRegisterIdentity(projectRoot, opts);
    // Recreates Sigma/logs/operations.jsonl if it was lost or corrupted since
    // the last register/start. A still-valid log is left untouched.
    const logsReinitialized = (0, operationLog_1.ensureOperationsLog)(projectRoot);
    writeProjectIdentity(projectRoot, identity.id, identity.name, resolveLogsCreatedAt(projectRoot, logsReinitialized));
    (0, output_1.success)(`Project identity written: ${identity.name} (${identity.id})`);
    console.log(`  File: ${path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE)}`);
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
        .option('--lang <name>', 'Language name applied to all language preferences in non-interactive mode (default: "English"). Free-form, e.g. "Indonesia".')
        .option('--confirm', 'Skip interactive prompts (requires --id and --name)')
        .option('--reinit', 'Re-initialize an existing Sigma project')
        .option('--overwrite-bridge', 'Overwrite existing bridge files (CLAUDE.md, GEMINI.md, AGENTS.md, DEEPSEEK.md, REASONIX.md)')
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
        .command('register')
        .description('(Re)generate .sigma-identity.json for this project — repairs a missing/corrupted identity file, or backfills a project created before it existed')
        .option('--id <PROJECT_ID>', 'Project ID, used only if progress.json is unreadable')
        .option('--name <name>', 'Project name, used only if progress.json is unreadable')
        .action((opts) => {
        try {
            runRegister(opts);
        }
        catch (e) {
            (0, output_1.error)(e.message);
        }
    });
    return cmd;
}
//# sourceMappingURL=project.js.map