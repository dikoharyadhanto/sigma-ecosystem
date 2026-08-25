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
const chain_1 = require("../engine/chain");
const projectConfig_1 = require("../engine/projectConfig");
const languageWizard_1 = require("../engine/languageWizard");
const notionService_1 = require("../engine/notionService");
const output_1 = require("../utils/output");
const fs_1 = require("../utils/fs");
const operationLog_1 = require("../utils/operationLog");
const mcpConfig_1 = require("../utils/mcpConfig");
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
    // Collect project_id and project_name
    let projectId;
    let projectName;
    let projectConfig = (0, projectConfig_1.createDefaultProjectConfig)(opts.lang?.trim() || 'English');
    // PLAN-IMPL-SIGMA-HUMANIZE-OPERATION §3.1 — mandatory answer, both paths,
    // but only a real question when Notion is actually usable right now. At
    // `project start` time .sigma-identity.json doesn't exist yet, so the only
    // checkable signal is NOTION_TOKEN in the environment — see
    // isNotionApiDetectable()'s own comment for why.
    const humanizeGateApiDetectable = await (0, notionService_1.isNotionApiDetectable)();
    if (opts.id && opts.name) {
        projectId = validateProjectId(opts.id);
        projectName = validateProjectName(opts.name);
        const humanizeGateEnabled = !humanizeGateApiDetectable
            ? false
            : opts.humanizeGate !== false; // default ON when detectable and no explicit --no-humanize-gate
        projectConfig.notion_humanize_gate = { enabled: humanizeGateEnabled };
        if (!humanizeGateApiDetectable) {
            console.log('  Notion humanize gate: OFF (no working Notion token detected — set NOTION_TOKEN and run ' +
                '`sigma notion enable --director-confirm` later to turn it on).');
        }
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
        if (humanizeGateApiDetectable) {
            const gateAnswer = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'humanizeGate',
                    message: 'Enable the Notion humanize gate? (requires a human-readable version of locked artifacts ' +
                        'to be pushed to Notion before certain lock steps — see PLAN-IMPL-SIGMA-HUMANIZE-OPERATION)',
                    default: true,
                },
            ]);
            projectConfig.notion_humanize_gate = { enabled: Boolean(gateAnswer.humanizeGate) };
        }
        else {
            projectConfig.notion_humanize_gate = { enabled: false };
            console.log('  Notion humanize gate: OFF (no working Notion token detected — set NOTION_TOKEN and run ' +
                '`sigma notion enable --director-confirm` later to turn it on).');
        }
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
    // PLAN-EVAL-05 — Sigma/progress.json is no longer written at all. The
    // real per-chain state lives in Sigma/progress-v<N>.json files, created
    // lazily by `sigma intent new`. The manifest below is created here,
    // upfront, with no chain active yet, so findProjectRoot() and
    // `sigma intent list` always have something to read even before the first
    // `intent new`.
    (0, chain_1.writeActivateStatus)(projectRoot, null);
    // Write .sigma-identity.json (root-level, used by `sigma doctor --reconstruct`
    // as a fallback if identity can't otherwise be determined)
    writeProjectIdentity(projectRoot, projectId, projectName, resolveLogsCreatedAt(projectRoot, logsReinitialized));
    console.log('  Identity: .sigma-identity.json written.');
    // Write project.config.json with language preferences
    (0, projectConfig_1.writeProjectConfig)(projectRoot, projectConfig);
    console.log(`  Config: Sigma/project.config.json written (Sigma docs language: ${projectConfig.document_language})`);
    console.log(`  Notion humanize gate: ${projectConfig.notion_humanize_gate?.enabled ? 'ON' : 'OFF'}`);
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
    // Stage 2 & PLAN-EVAL-04 — Tulis local & global MCP config dengan explicit projectRoot
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeClaudeMcpConfig)(projectRoot), '.mcp.json');
        if (err)
            (0, output_1.warn)(`MCP (Claude/Reasonix): ${err}`);
        else
            console.log('  MCP: .mcp.json written (sigma-mcp — Claude Code / Reasonix).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeCursorMcpConfig)(projectRoot), '.cursor/mcp.json');
        if (err)
            (0, output_1.warn)(`MCP (Cursor): ${err}`);
        else
            console.log('  MCP: .cursor/mcp.json written (sigma-mcp — Cursor).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeCodexMcpConfig)(projectRoot), '~/.codex/config.toml');
        if (err)
            (0, output_1.warn)(`MCP (Codex): ${err}`);
        else
            console.log('  MCP: ~/.codex/config.toml updated (sigma-mcp — Codex).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeAntigravityMcpConfig)(projectRoot), '~/.gemini/config/mcp_config.json');
        if (err)
            (0, output_1.warn)(`MCP (Antigravity): ${err}`);
        else
            console.log('  MCP: ~/.gemini/config/mcp_config.json updated (sigma-mcp — Antigravity).');
    }
    if (!(0, mcpConfig_1.isSigmaMcpResolvable)()) {
        (0, output_1.warn)('sigma-mcp is not found in PATH. MCP config was written but will not work until sigma-mcp is resolvable. Make sure sigma-ecosystem is installed globally: npm install -g sigma-ecosystem');
    }
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
        console.log('  .mcp.json (sigma-mcp — upsert key sigma)');
        console.log('  .cursor/mcp.json (sigma-mcp — upsert key sigma)');
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
    // Stage 2 & PLAN-EVAL-04 — Upsert local & global MCP config dengan explicit projectRoot
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeClaudeMcpConfig)(projectRoot), '.mcp.json');
        if (err)
            (0, output_1.warn)(`MCP (Claude/Reasonix): ${err}`);
        else
            console.log('  Updated: .mcp.json (sigma-mcp — upsert key sigma).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeCursorMcpConfig)(projectRoot), '.cursor/mcp.json');
        if (err)
            (0, output_1.warn)(`MCP (Cursor): ${err}`);
        else
            console.log('  Updated: .cursor/mcp.json (sigma-mcp — upsert key sigma).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeCodexMcpConfig)(projectRoot), '~/.codex/config.toml');
        if (err)
            (0, output_1.warn)(`MCP (Codex): ${err}`);
        else
            console.log('  Updated: ~/.codex/config.toml (sigma-mcp — upsert key sigma).');
    }
    {
        const err = (0, mcpConfig_1.tryMcpOp)(() => (0, mcpConfig_1.writeAntigravityMcpConfig)(projectRoot), '~/.gemini/config/mcp_config.json');
        if (err)
            (0, output_1.warn)(`MCP (Antigravity): ${err}`);
        else
            console.log('  Updated: ~/.gemini/config/mcp_config.json (sigma-mcp — upsert key sigma).');
    }
    if (!(0, mcpConfig_1.isSigmaMcpResolvable)()) {
        (0, output_1.warn)('sigma-mcp is not found in PATH. MCP config was written but will not work until sigma-mcp is resolvable. Make sure sigma-ecosystem is installed globally: npm install -g sigma-ecosystem');
    }
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
    const projectRoot = (0, reconstruct_1.findSigmaProjectRoot)();
    const identity = resolveRegisterIdentity(opts);
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
        .option('--humanize-gate', 'Enable the Notion humanize gate (non-interactive mode; default ON when a working Notion token is detected)')
        .option('--no-humanize-gate', 'Disable the Notion humanize gate (non-interactive mode)')
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