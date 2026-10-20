"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProjectId = validateProjectId;
exports.validateProjectName = validateProjectName;
exports.projectCommand = projectCommand;
const lifecycleView_1 = require("../engine/lifecycleView");
const commander_1 = require("commander");
const child_process_1 = require("child_process");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const config_1 = require("../config");
const roleMemory_1 = require("../engine/roleMemory");
const reconstruct_1 = require("../engine/reconstruct");
const artifacts_1 = require("../utils/artifacts");
const changelogService_1 = require("../services/changelogService");
const chain_1 = require("../engine/chain");
const projectConfig_1 = require("../engine/projectConfig");
const gitignoreService_1 = require("../services/gitignoreService");
const languageWizard_1 = require("../engine/languageWizard");
const output_1 = require("../utils/output");
const fs_1 = require("../utils/fs");
const operationLog_1 = require("../utils/operationLog");
const notesService_1 = require("../services/notesService");
const assetConsistency_1 = require("../services/assetConsistency");
const detect_1 = require("../utils/detect");
const mcpConfig_1 = require("../utils/mcpConfig");
// ── Bundle paths ─────────────────────────────────────────────────────────────
const PACKAGE_ROOT = path_1.default.resolve(__dirname, '..', '..');
const BUNDLE_OP_REGISTRY = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json');
const BUNDLE_DOC_REGISTRY = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-REGISTRY.json');
const BUNDLE_ROLE_MEMORY_DIR = (0, roleMemory_1.getBundledRoleMemoryDir)();
const BUNDLE_TEMPLATES_DIR = path_1.default.join(PACKAGE_ROOT, 'Sigma', 'templates');
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
// ── Local Git setup ──────────────────────────────────────────────────────────
function getLocalGitRoot(projectRoot) {
    try {
        return (0, child_process_1.execFileSync)('git', ['rev-parse', '--show-toplevel'], {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null;
    }
    catch {
        return null;
    }
}
function initializeLocalGit(projectRoot) {
    try {
        (0, child_process_1.execFileSync)('git', ['init'], {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: 'pipe',
        });
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not initialize a local Git repository: ${detail}`);
    }
}
async function prepareLocalGit(projectRoot, opts) {
    const existingRoot = getLocalGitRoot(projectRoot);
    if (existingRoot) {
        console.log(`  Git: existing local repository detected (${existingRoot}).`);
        return;
    }
    let shouldInitialize = opts.initGit === true;
    const nonInteractive = opts.confirm === true || Boolean(opts.id && opts.name);
    if (!shouldInitialize && !nonInteractive) {
        const answer = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'initializeGit',
                message: 'No local Git repository found. Initialize one now? (local only; no remote or GitHub configuration)',
                default: false,
            },
        ]);
        shouldInitialize = Boolean(answer.initializeGit);
    }
    if (!shouldInitialize) {
        console.log('  Git: no local repository — project remains valid without Git.');
        return;
    }
    initializeLocalGit(projectRoot);
    console.log('  Git: local repository initialized (no remote, identity, branch policy, or commit configured).');
}
// Preserves the existing logs_created_at unless the operations log was just
// (re)initialized — first-time creation and loss recovery are the same event
// and both get a fresh timestamp; an untouched, still-valid log keeps its
// original timestamp across repeated `start`/`register` calls. Reads the new
// location first, then the copy older versions left on the identity file.
function resolveLogsCreatedAt(projectRoot, logsReinitialized) {
    if (!logsReinitialized) {
        const manifestPath = path_1.default.join(projectRoot, config_1.ACTIVATE_STATUS_FILE);
        const identityPath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
        for (const file of [manifestPath, identityPath]) {
            if (!(0, fs_1.fileExists)(file))
                continue;
            try {
                const existing = fs_extra_1.default.readJsonSync(file);
                if (typeof existing.logs_created_at === 'string')
                    return existing.logs_created_at;
            }
            catch {
                // try the next location, then fall through to a fresh timestamp
            }
        }
    }
    return new Date().toISOString();
}
function writeProjectIdentity(projectRoot, projectId, projectName, logsCreatedAt, gitignoreSigma) {
    // Read-merge-write: fields this function does not own (for example the DEV
    // workspace record) must survive a re-initialization.
    const existing = { ...readExistingIdentity(projectRoot) };
    // Legacy volatile fields move to the manifest; drop them from the tracked identity.
    delete existing.logs_created_at;
    const identity = {
        ...existing,
        schema_version: config_1.SCHEMA_VERSION,
        project_id: projectId,
        project_name: projectName,
        registered: true,
    };
    if (gitignoreSigma !== undefined)
        identity.git = { ...existing.git, gitignore_sigma: gitignoreSigma };
    fs_extra_1.default.writeJsonSync(path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE), identity, { spaces: 2 });
    // The manifest may not exist yet when `register` repairs a damaged project;
    // creating it here would make a broken Sigma/ look healthy, so only patch an existing one.
    if ((0, fs_1.fileExists)(path_1.default.join(projectRoot, config_1.ACTIVATE_STATUS_FILE))) {
        (0, chain_1.patchActivateStatus)(projectRoot, { logs_created_at: logsCreatedAt });
    }
}
function readExistingIdentity(projectRoot) {
    const identityPath = path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE);
    if (!(0, fs_1.fileExists)(identityPath))
        return {};
    try {
        const parsed = fs_extra_1.default.readJsonSync(identityPath);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        // A corrupt identity file is the case `project register` repairs; there is nothing to preserve.
        return {};
    }
}
// F12 — records the applied Sigma version on the identity, but only when every
// managed asset matches its source. A refusal is reported, never fatal.
function reportVersionStamp(projectRoot) {
    const result = (0, assetConsistency_1.stampProjectIfCurrent)(projectRoot);
    if (result.written)
        console.log(`  Version: Sigma ${config_1.SIGMA_VERSION} recorded in ${config_1.PROJECT_IDENTITY_FILE}.`);
    else
        console.log(`  Version: stamp not written (${result.reason}).`);
}
// ── sigma project start ───────────────────────────────────────────────────────
async function runStart(opts) {
    if (!(0, fs_1.fileExists)(config_1.GLOBAL_SIGMA_DIR)) {
        (0, output_1.error)('Sigma is not installed. Run: sigma setup install');
    }
    const projectRoot = process.cwd();
    // Defense in depth: the CLI hook already refused this, but the use-case must
    // not be re-registrable from any other entry point either.
    (0, fs_1.assertSigmaFilesPresentOrThrow)(projectRoot, { exact: true });
    const sigmaDir = path_1.default.join(projectRoot, config_1.PROJECT_SIGMA_DIR);
    // PLAN-EVAL-05 — anchor moved to activate_status.json now that
    // Sigma/progress.json is no longer written at all (findProjectRoot()
    // already anchored here since PLAN-EVAL-01 Fase 5; this reinit guard had
    // been left behind pointing at the old file).
    const activateStatusPath = path_1.default.join(projectRoot, config_1.ACTIVATE_STATUS_FILE);
    if ((0, fs_1.fileExists)(activateStatusPath)) {
        if (!opts.reinit) {
            (0, output_1.error)('This directory is already a Sigma project. ' +
                'Use `sigma project status` to inspect, or pass --reinit to re-initialize.');
        }
    }
    const existingAssetDifferences = (0, assetConsistency_1.inspectProjectAssets)(projectRoot)
        .filter(item => item.status === 'DIFF' || item.status === 'UNSAFE');
    if (existingAssetDifferences.length) {
        (0, output_1.error)('Existing managed files differ from the installation. Project start would overwrite them. ' +
            'Review and resolve these files before starting or re-initializing:\n' +
            existingAssetDifferences.map(item => (0, assetConsistency_1.formatAssetDifference)(item)).join('\n'));
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
    // `--reinit` rewrites project.config.json from defaults; an explicit earlier
    // choice about Git must not silently flip back to ON (and re-detach files).
    if ((0, fs_1.fileExists)(path_1.default.join(projectRoot, config_1.PROJECT_CONFIG_FILE))) {
        const previous = (0, projectConfig_1.readProjectConfig)(projectRoot);
        if ((0, projectConfig_1.hasExplicitGitignoreSigma)(previous))
            projectConfig.git = { gitignore_sigma: (0, projectConfig_1.resolveGitignoreSigma)(previous) };
    }
    (0, output_1.info)(`Initializing Sigma project: ${projectName} (${projectId})...`);
    await prepareLocalGit(projectRoot, opts);
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
    // Free-form notes: registry, note-list.md, note-list/ and unregistered-notes/ (F06)
    (0, notesService_1.initNotes)(projectRoot);
    console.log('  Notes: Sigma/notes/note-list.md initialized.');
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
    // PLAN-EVAL-05 — Sigma/progress.json is no longer written at all. The
    // real per-chain state lives in Sigma/progress-v<N>.json files, created
    // lazily by `sigma intent new`. The manifest below is created here,
    // upfront, with no chain active yet, so findProjectRoot() and
    // `sigma intent list` always have something to read even before the first
    // `intent new`.
    (0, chain_1.writeActivateStatus)(projectRoot, null);
    // Write .sigma-identity.json (root-level, used by `sigma doctor --reconstruct`
    // as a fallback if identity can't otherwise be determined)
    writeProjectIdentity(projectRoot, projectId, projectName, resolveLogsCreatedAt(projectRoot, logsReinitialized), (0, projectConfig_1.resolveGitignoreSigma)(projectConfig));
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
    fs_extra_1.default.writeJsonSync(indexPath, { mailbox_format: 2, messages: [] }, { spaces: 2 });
    for (const role of config_1.MESSAGING_ROLES)
        for (const context of ['GENERAL']) {
            fs_extra_1.default.ensureDirSync(path_1.default.join(messagesDir, role, context));
            fs_extra_1.default.ensureDirSync(path_1.default.join(projectRoot, 'Sigma', 'memo', role, context));
        }
    console.log('  Mailbox: Sigma/messages/ and Sigma/memo/ initialized.');
    if ((0, fs_1.fileExists)(BUNDLE_ROLE_MEMORY_DIR)) {
        fs_extra_1.default.copySync(BUNDLE_ROLE_MEMORY_DIR, path_1.default.join(sigmaDir, 'role-memory'), { overwrite: true });
        console.log('  Role memory: Sigma/role-memory/ copied from bundle.');
    }
    else {
        (0, output_1.warn)('Sigma/role-memory bundle not found — skipping');
    }
    // Copy doctrine templates. Cross-role skills (e.g. /write-memo) reference
    // files under Sigma/templates/ directly by project-relative path rather
    // than through resolveTemplate(), so the directory must physically exist
    // in every scaffolded project. Same precedence as resolveTemplate(): prefer
    // the global (Director-editable) copy, fall back to the package bundle.
    const templatesSource = (0, fs_1.fileExists)(config_1.GLOBAL_TEMPLATES_DIR) ? config_1.GLOBAL_TEMPLATES_DIR : BUNDLE_TEMPLATES_DIR;
    if ((0, fs_1.fileExists)(templatesSource)) {
        fs_extra_1.default.copySync(templatesSource, path_1.default.join(sigmaDir, 'templates'), { overwrite: true });
        console.log('  Templates: Sigma/templates/ copied.');
    }
    else {
        (0, output_1.warn)('Sigma/templates not found in ~/.sigma/templates or bundle — skipping');
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
    // F17: product changelog destination; created only when neither valid location has one.
    {
        const changelog = (0, changelogService_1.ensureChangelogFile)(projectRoot);
        if (changelog.created)
            console.log(`  Changelog: ${changelog.rel} created (empty).`);
    }
    reportVersionStamp(projectRoot);
    (0, output_1.success)(`Sigma project initialized: ${projectName} (${projectId})`);
    console.log(`  Location: ${sigmaDir}`);
    console.log('  Next: Run `sigma session bootstrap` or `sigma project status` to confirm state.');
    // Stage 2 & PLAN-EVAL-04 — Tulis local & global MCP config dengan explicit projectRoot
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeClaudeMcpConfig)(projectRoot), '.mcp.json');
        if (err)
            (0, output_1.warn)(`MCP (Claude/Reasonix): ${err}`);
        else
            console.log('  MCP: .mcp.json written (sigma-mcp — Claude Code / Reasonix).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeOpencodeMcpConfig)(projectRoot), 'opencode.json');
        if (err)
            (0, output_1.warn)(`MCP (opencode): ${err}`);
        else
            console.log(`  MCP: ${path_1.default.basename((0, mcpConfig_1.resolveOpencodeConfigPath)(projectRoot))} written (sigma-mcp — opencode).`);
    }
    // Global configs are written only for detected tools — same rule as `setup install`;
    // writing for an absent tool just leaves stray files in the home directory.
    const detected = (0, detect_1.detectTools)();
    if (detected.codex) {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeCodexMcpConfig)(projectRoot), '~/.codex/config.toml');
        if (err)
            (0, output_1.warn)(`MCP (Codex): ${err}`);
        else
            console.log('  MCP: ~/.codex/config.toml updated (sigma-mcp — Codex).');
    }
    else {
        console.log('  MCP: ~/.codex/config.toml skipped (Codex not detected).');
    }
    if (detected.antigravity) {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeAntigravityMcpConfig)(projectRoot), '~/.gemini/config/mcp_config.json');
        if (err)
            (0, output_1.warn)(`MCP (Antigravity): ${err}`);
        else
            console.log('  MCP: ~/.gemini/config/mcp_config.json updated (sigma-mcp — Antigravity).');
    }
    else {
        console.log('  MCP: ~/.gemini/config/mcp_config.json skipped (Antigravity not detected).');
    }
    if (!(0, mcpConfig_1.isSigmaMcpResolvable)()) {
        (0, output_1.warn)('sigma-mcp is not found in PATH. MCP config was written but will not work until sigma-mcp is resolvable. Make sure sigma-ecosystem is installed globally: npm install -g sigma-ecosystem');
    }
    // Last, so every generated file (bridges, MCP configs, changelog) already exists
    // and anything an earlier run left tracked in Git is detached in the same pass.
    reportGitignore((0, gitignoreService_1.applyGitignorePolicy)(projectRoot));
}
function reportGitignore(report) {
    for (const line of report.lines)
        console.log('  ' + line);
    for (const line of report.warnings)
        (0, output_1.warn)(line);
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
        console.log(JSON.stringify((0, lifecycleView_1.lifecycleView)(projectRoot, chain), null, 2));
        const openPlanDrafts = chain.plan.versions.filter(v => v.state === 'DRAFT');
        if (openPlanDrafts.length > 1) {
            console.log(`  [NOTE] ${openPlanDrafts.length} DRAFT FMN-PLANs are open: ${openPlanDrafts.map(v => v.version).join(', ')} — run: sigma plan status`);
        }
        artifactLine('Execution Evidence', 'DEV-EXEC', chain.exec.active_version, chain.exec.active_state);
        const openExecDrafts = chain.exec.versions.filter(v => v.state === 'DRAFT');
        if (openExecDrafts.length > 1) {
            console.log(`  [NOTE] ${openExecDrafts.length} DRAFT DEV-EXECs are open: ${openExecDrafts.map(v => v.version).join(', ')} — run: sigma exec status`);
        }
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
    (0, fs_1.assertSigmaFilesPresentOrThrow)(process.cwd());
    const projectRoot = (0, fs_1.findProjectRoot)();
    if (!opts.confirm && opts.accept?.length) {
        throw new Error('--accept requires --confirm after reviewing the dry run.');
    }
    const differences = (0, assetConsistency_1.inspectProjectAssets)(projectRoot);
    if (!opts.confirm) {
        (0, output_1.info)('Dry run — managed files, one line per difference:');
        const changed = differences.filter(item => item.status !== 'SAME');
        if (!changed.length)
            console.log('  All available managed files already match their sources.');
        for (const item of changed)
            console.log('  ' + (0, assetConsistency_1.formatAssetDifference)(item));
        console.log('  Review each DIFF source and target. A replacement requires --confirm and its exact --accept token.');
        console.log(`  ${config_1.PROJECT_IDENTITY_FILE} (version stamp — written only when every managed file matches its source after sync)`);
        console.log('  .mcp.json (sigma-mcp — upsert key sigma)');
        console.log('  opencode.jsonc / opencode.json (sigma-mcp — upsert key mcp.sigma)');
        if ((0, projectConfig_1.hasExplicitGitignoreSigma)((0, projectConfig_1.readProjectConfig)(projectRoot)) && (0, projectConfig_1.resolveGitignoreSigma)((0, projectConfig_1.readProjectConfig)(projectRoot))) {
            console.log('  .gitignore (refresh the sigma-managed block; already-tracked Sigma files are detached from the Git index, never from disk)');
        }
        {
            const plan = (0, changelogService_1.planChangelogCreation)(projectRoot);
            if (plan.action === 'create')
                console.log(`  ${plan.rel} (create empty product changelog; none exists in the project root or dev/)`);
        }
        (0, output_1.warn)('Pass --confirm to apply.');
        return;
    }
    const result = (0, assetConsistency_1.syncManagedAssets)(projectRoot, opts.accept ?? []);
    (0, output_1.success)('Project synced successfully.');
    for (const item of result.copied)
        console.log('  Updated: ' + item);
    if (result.backupDir)
        console.log('  Previous files backed up at: ' + result.backupDir);
    {
        const changelog = (0, changelogService_1.ensureChangelogFile)(projectRoot);
        if (changelog.created)
            console.log(`  Created: ${changelog.rel} (empty product changelog).`);
    }
    reportVersionStamp(projectRoot);
    // Stage 2 & PLAN-EVAL-04 — Upsert local & global MCP config dengan explicit projectRoot
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeClaudeMcpConfig)(projectRoot), '.mcp.json');
        if (err)
            (0, output_1.warn)(`MCP (Claude/Reasonix): ${err}`);
        else
            console.log('  Updated: .mcp.json (sigma-mcp — upsert key sigma).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeOpencodeMcpConfig)(projectRoot), 'opencode.json');
        if (err)
            (0, output_1.warn)(`MCP (opencode): ${err}`);
        else
            console.log(`  Updated: ${path_1.default.basename((0, mcpConfig_1.resolveOpencodeConfigPath)(projectRoot))} (sigma-mcp — upsert key mcp.sigma).`);
    }
    const detected = (0, detect_1.detectTools)();
    if (detected.codex) {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeCodexMcpConfig)(projectRoot), '~/.codex/config.toml');
        if (err)
            (0, output_1.warn)(`MCP (Codex): ${err}`);
        else
            console.log('  Updated: ~/.codex/config.toml (sigma-mcp — upsert key sigma).');
    }
    else {
        console.log('  MCP: ~/.codex/config.toml skipped (Codex not detected).');
    }
    if (detected.antigravity) {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeAntigravityMcpConfig)(projectRoot), '~/.gemini/config/mcp_config.json');
        if (err)
            (0, output_1.warn)(`MCP (Antigravity): ${err}`);
        else
            console.log('  Updated: ~/.gemini/config/mcp_config.json (sigma-mcp — upsert key sigma).');
    }
    else {
        console.log('  MCP: ~/.gemini/config/mcp_config.json skipped (Antigravity not detected).');
    }
    if (!(0, mcpConfig_1.isSigmaMcpResolvable)()) {
        (0, output_1.warn)('sigma-mcp is not found in PATH. MCP config was written but will not work until sigma-mcp is resolvable. Make sure sigma-ecosystem is installed globally: npm install -g sigma-ecosystem');
    }
    // A project that never ran `sigma config set gitignore` keeps its Git layout
    // until the Director opts in; only an explicit ON is re-asserted here.
    const config = (0, projectConfig_1.readProjectConfig)(projectRoot);
    if ((0, projectConfig_1.hasExplicitGitignoreSigma)(config) && (0, projectConfig_1.resolveGitignoreSigma)(config))
        reportGitignore((0, gitignoreService_1.enableSigmaGitignore)(projectRoot));
}
// ── sigma project register ────────────────────────────────────────────────────
//
// Repurposed as a repair/harvest tool for .sigma-identity.json — `project start`
// already writes it once, so this command exists for: (a) restoring a
// missing/corrupted identity file, (b) backfilling projects created before this
// file existed. Uses findSigmaProjectRoot() (Sigma/ folder only) rather than
// findProjectRoot() (requires activate_status.json) so it still works when
// that file itself is the thing that's broken.
function resolveRegisterIdentity(opts) {
    if (opts.id && opts.name) {
        return { id: validateProjectId(opts.id), name: validateProjectName(opts.name) };
    }
    throw new Error('.sigma-identity.json is missing, unreadable, or incomplete — cannot determine project identity ' +
        'automatically. Pass --id <PROJECT_ID> --name <name> to proceed.');
}
function runRegister(opts) {
    (0, fs_1.assertSigmaFilesPresentOrThrow)(process.cwd());
    const projectRoot = (0, reconstruct_1.findSigmaProjectRoot)();
    const identity = resolveRegisterIdentity(opts);
    // Recreates Sigma/logs/operations.jsonl if it was lost or corrupted since
    // the last register/start. A still-valid log is left untouched.
    const logsReinitialized = (0, operationLog_1.ensureOperationsLog)(projectRoot);
    writeProjectIdentity(projectRoot, identity.id, identity.name, resolveLogsCreatedAt(projectRoot, logsReinitialized));
    (0, output_1.success)(`Project identity written: ${identity.name} (${identity.id})`);
    console.log(`  File: ${path_1.default.join(projectRoot, config_1.PROJECT_IDENTITY_FILE)}`);
    reportVersionStamp(projectRoot);
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
        .option('--init-git', 'Initialize a local Git repository when none exists (no remote, identity, branch policy, or commit)')
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
        .option('--confirm', 'Apply non-conflicting changes (without this flag, dry-run only)')
        .option('--accept <token>', 'Approve one exact file replacement shown by the dry run; repeat for each DIFF', (token, values) => [...values, token], [])
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
        .requiredOption('--id <PROJECT_ID>', 'Project ID')
        .requiredOption('--name <name>', 'Project name')
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