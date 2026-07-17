import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import {
  GLOBAL_SIGMA_DIR,
  GLOBAL_RULES_DIR,
  GLOBAL_GOVERNANCE_DIR,
  GLOBAL_BRIDGE_DIR,
  PROJECT_SIGMA_DIR,
  PROJECT_IDENTITY_FILE,
  SCHEMA_VERSION,
  BRIDGE_STUBS,
  SUBFOLDERS,
  MESSAGES_DIR,
  MESSAGES_INDEX_FILE,
  MESSAGE_SUBFOLDERS,
  REFERENCE_LIST_FILE,
} from '../config';
import { getBundledRoleMemoryDir } from '../engine/roleMemory';
import { findSigmaProjectRoot } from '../engine/reconstruct';
import { copyTemplateToArtifact } from '../utils/artifacts';
import { createInitialProgress } from '../engine/progress';
import {
  readActiveChain,
  readProjectIdentity,
  writeActivateStatus,
  listChainVersions,
  getNextValidOperations,
  getGateStatusLabel,
  getInvalidWarningLines,
  hasInvalidRuntime,
} from '../engine/chain';
import { createDefaultProjectConfig, writeProjectConfig } from '../engine/projectConfig';
import { promptLanguageWizard } from '../engine/languageWizard';
import { success, info, warn, error } from '../utils/output';
import { ensureDir, fileExists, findProjectRoot } from '../utils/fs';
import { ensureOperationsLog } from '../utils/operationLog';

// ── Bundle paths ─────────────────────────────────────────────────────────────

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_OP_REGISTRY = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json');
const BUNDLE_DOC_REGISTRY = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-REGISTRY.json');
const BUNDLE_ROLE_MEMORY_DIR = getBundledRoleMemoryDir();
const BUNDLE_BRIDGE_DIR = path.join(PACKAGE_ROOT, 'setup', 'targets', 'bridge');

// Resolve a bridge template the same way resolveTemplate() resolves doctrine templates:
// prefer the global (Director-editable) copy, fall back to the package bundle.
function resolveBridgeTemplate(fileName: string): string | null {
  const global = path.join(GLOBAL_BRIDGE_DIR, fileName);
  if (fileExists(global)) return global;
  const bundle = path.join(BUNDLE_BRIDGE_DIR, fileName);
  if (fileExists(bundle)) return bundle;
  return null;
}

// ── Validation ────────────────────────────────────────────────────────────────

const PROJECT_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,11}$/;

export function validateProjectId(id: string): string {
  const clean = id.trim().toUpperCase();
  if (!PROJECT_ID_PATTERN.test(clean)) {
    throw new Error(
      `Invalid project ID "${id}". Must be uppercase letters, digits, and hyphens only, max 12 chars. Example: MYPROJ`
    );
  }
  return clean;
}

export function validateProjectName(name: string): string {
  const clean = name.trim();
  if (clean.length === 0 || clean.length > 64) {
    throw new Error('Project name must be between 1 and 64 characters.');
  }
  return clean;
}

// ── .sigma-identity.json helpers ─────────────────────────────────────────────
//
// Root-level (sibling to Sigma/), not inside it, so it survives even if the
// Sigma/ folder itself needs to be reconstructed. Read by doctor.ts as a
// fallback identity source when progress.json is unreadable.

interface ProjectIdentity {
  schema_version: string;
  project_id: string;
  project_name: string;
  registered: true;
  logs_created_at: string;
}

// Preserves the existing logs_created_at unless the operations log was just
// (re)initialized — first-time creation and loss recovery are the same event
// and both get a fresh timestamp; an untouched, still-valid log keeps its
// original timestamp across repeated `start`/`register` calls.
function resolveLogsCreatedAt(projectRoot: string, logsReinitialized: boolean): string {
  if (!logsReinitialized) {
    const identityPath = path.join(projectRoot, PROJECT_IDENTITY_FILE);
    if (fileExists(identityPath)) {
      try {
        const existing = fs.readJsonSync(identityPath) as Partial<ProjectIdentity>;
        if (existing.logs_created_at) return existing.logs_created_at;
      } catch {
        // fall through to a fresh timestamp
      }
    }
  }
  return new Date().toISOString();
}

function writeProjectIdentity(
  projectRoot: string,
  projectId: string,
  projectName: string,
  logsCreatedAt: string
): void {
  const identity: ProjectIdentity = {
    schema_version: SCHEMA_VERSION,
    project_id: projectId,
    project_name: projectName,
    registered: true,
    logs_created_at: logsCreatedAt,
  };
  fs.writeJsonSync(path.join(projectRoot, PROJECT_IDENTITY_FILE), identity, { spaces: 2 });
}

// ── sigma project start ───────────────────────────────────────────────────────

async function runStart(opts: {
  id?: string;
  name?: string;
  lang?: string;
  confirm?: boolean;
  reinit?: boolean;
  overwriteBridge?: boolean;
}): Promise<void> {
  if (!fileExists(GLOBAL_SIGMA_DIR)) {
    error('Sigma is not installed. Run: sigma setup install');
  }

  const projectRoot = process.cwd();
  const sigmaDir = path.join(projectRoot, PROJECT_SIGMA_DIR);
  const progressPath = path.join(sigmaDir, 'progress.json');

  if (fileExists(progressPath)) {
    if (!opts.reinit) {
      error(
        'This directory is already a Sigma project. ' +
        'Use `sigma project status` to inspect, or pass --reinit to re-initialize.'
      );
    }
  }

  // Collect project_id and project_name
  let projectId: string;
  let projectName: string;
  let projectConfig = createDefaultProjectConfig(opts.lang?.trim() || 'English');

  if (opts.id && opts.name) {
    projectId = validateProjectId(opts.id);
    projectName = validateProjectName(opts.name);
  } else {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectId',
        message: 'Project ID (uppercase, max 12 chars, e.g. MYPROJ):',
        default: opts.id,
        validate: (input: string) => {
          try { validateProjectId(input); return true; } catch (e) { return (e as Error).message; }
        },
      },
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name (max 64 chars):',
        default: opts.name,
        validate: (input: string) => {
          try { validateProjectName(input); return true; } catch (e) { return (e as Error).message; }
        },
      },
    ]);

    projectId = validateProjectId(answers.projectId as string);
    projectName = validateProjectName(answers.projectName as string);

    console.log('');
    projectConfig = await promptLanguageWizard(projectConfig);
  }

  info(`Initializing Sigma project: ${projectName} (${projectId})...`);

  // Create Sigma/ folder and all subfolders
  ensureDir(sigmaDir);
  for (const sub of SUBFOLDERS) {
    ensureDir(path.join(sigmaDir, sub));
  }

  // Operation history log — created empty here so it exists from the very
  // first operation onward. Result feeds logs_created_at on the identity
  // file below.
  const logsReinitialized = ensureOperationsLog(projectRoot);

  // Scaffold the project-wide reference list (Comprehensive Research source index)
  copyTemplateToArtifact('REFERENCE-LIST-TEMPLATE.md', path.join(projectRoot, REFERENCE_LIST_FILE));
  console.log('  Reference: Sigma/reference/reference-list.md initialized.');

  // Copy governance documents
  const constitution = path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md');
  const protocol = path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md');

  if (fileExists(constitution)) {
    fs.copySync(constitution, path.join(sigmaDir, 'SIGMA_CONSTITUTION.md'), { overwrite: true });
  } else {
    warn('SIGMA_CONSTITUTION.md not found in ~/.sigma/governance — skipping');
  }

  if (fileExists(protocol)) {
    fs.copySync(protocol, path.join(sigmaDir, 'SIGMA_PROTOCOL.md'), { overwrite: true });
  } else {
    warn('SIGMA_PROTOCOL.md not found in ~/.sigma/governance — skipping');
  }

  // Copy rule files
  if (fileExists(GLOBAL_RULES_DIR)) {
    fs.copySync(GLOBAL_RULES_DIR, path.join(sigmaDir, 'rules'), { overwrite: true });
  } else {
    warn('Rules not found in ~/.sigma/rules — skipping');
  }

  // Copy registry files from package bundle
  if (fileExists(BUNDLE_OP_REGISTRY)) {
    fs.copySync(BUNDLE_OP_REGISTRY, path.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json'), { overwrite: true });
  } else {
    warn('SIGMA-OPERATION-REGISTRY.json not found in bundle — skipping');
  }

  if (fileExists(BUNDLE_DOC_REGISTRY)) {
    fs.copySync(BUNDLE_DOC_REGISTRY, path.join(sigmaDir, 'SIGMA-REGISTRY.json'), { overwrite: true });
  } else {
    warn('SIGMA-REGISTRY.json not found in bundle — skipping');
  }

  // Create progress.json — PLAN-EVAL-01: this file is legacy/inert now.
  // Nothing reads its content anymore (only findProjectRoot() checks it
  // exists, until Fase 5 moves that anchor to activate_status.json). Kept
  // exactly as before to avoid unrelated churn before that fase lands.
  const initial = createInitialProgress(projectId, projectName);
  fs.writeJsonSync(progressPath, initial, { spaces: 2 });

  // PLAN-EVAL-01 §5.9 — the real per-chain state lives in
  // Sigma/progress-v<N>.json files, created lazily by `sigma intent new`.
  // The manifest is created here, upfront, with no chain active yet, so
  // findProjectRoot() (post-Fase-5) and `sigma intent list` always have
  // something to read even before the first `intent new`.
  writeActivateStatus(projectRoot, null);

  // Write .sigma-identity.json (root-level, used by `sigma doctor --reconstruct`
  // as a fallback if progress.json is ever lost or corrupted)
  writeProjectIdentity(projectRoot, projectId, projectName, resolveLogsCreatedAt(projectRoot, logsReinitialized));
  console.log('  Identity: .sigma-identity.json written.');

  // Write project.config.json with language preferences
  writeProjectConfig(projectRoot, projectConfig);
  console.log(`  Config: Sigma/project.config.json written (Sigma docs language: ${projectConfig.document_language})`);

  // Create messages folder tree
  const messagesDir = path.join(projectRoot, MESSAGES_DIR);
  fs.ensureDirSync(messagesDir);
  for (const sub of MESSAGE_SUBFOLDERS) {
    fs.ensureDirSync(path.join(messagesDir, sub));
  }
  const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
  fs.writeJsonSync(indexPath, { messages: [] }, { spaces: 2 });
  console.log('  Mailbox: Sigma/messages/ initialized.');

  if (fileExists(BUNDLE_ROLE_MEMORY_DIR)) {
    fs.copySync(BUNDLE_ROLE_MEMORY_DIR, path.join(sigmaDir, 'role-memory'), { overwrite: true });
    console.log('  Role memory: Sigma/role-memory/ copied from bundle.');
  } else {
    warn('Sigma/role-memory bundle not found — skipping');
  }

  // Copy bridge file templates (CLAUDE.md, GEMINI.md, AGENTS.md, DEEPSEEK.md, REASONIX.md)
  let bridgeCopied = 0;
  for (const bridgeFile of BRIDGE_STUBS) {
    const bridgePath = path.join(projectRoot, bridgeFile);
    if (fileExists(bridgePath) && !opts.overwriteBridge) continue;

    const template = resolveBridgeTemplate(bridgeFile);
    if (template) {
      fs.copySync(template, bridgePath, { overwrite: true });
      bridgeCopied++;
    } else {
      warn(`Bridge template not found for ${bridgeFile} — skipping`);
    }
  }
  if (bridgeCopied > 0) {
    console.log(`  Bridge: ${bridgeCopied} file(s) written from template.`);
  }

  success(`Sigma project initialized: ${projectName} (${projectId})`);
  console.log(`  Location: ${sigmaDir}`);
  console.log('  Next: Run `sigma session bootstrap` or `sigma project status` to confirm state.');
}

// ── sigma project status ──────────────────────────────────────────────────────

function runStatus(): void {
  const projectRoot = findProjectRoot();
  const identity = readProjectIdentity(projectRoot);

  // No chain yet (fresh project, before the first `intent new`) is a valid
  // state — matches today's graceful display rather than erroring out.
  const hasChain = listChainVersions(projectRoot).length > 0;
  const { chainVersion, data: chain } = hasChain
    ? readActiveChain(projectRoot)
    : { chainVersion: null, data: null };

  console.log('\n=== Sigma Project Status ===\n');
  console.log(`Project:          ${identity.project_name} (${identity.project_id})`);
  console.log(`Active Chain:     ${chainVersion ?? 'none — no DIR-INTENT yet'}`);
  console.log(`Lifecycle Phase:  ${chain?.lifecycle_state ?? '—'}`);
  console.log(`Last Updated:     ${chain?.updated_at ?? '—'}`);

  if (chain) {
    console.log('\n--- Artifact Status ---');
    const artifactLine = (label: string, code: string, version: string | null, state: string | null): void => {
      const display = version !== null ? `${label} (${code} ${version})` : `${label} (${code})`;
      console.log(`${display.padEnd(40)} [${state ?? '—'}]`);
    };
    artifactLine('Intent Doc',         'DIR-INTENT', chain.intent.version,           chain.intent.state);
    artifactLine('Plan Doc',           'FMN-PLAN',   chain.plan.active_version,      chain.plan.active_state);
    artifactLine('Execution Evidence', 'DEV-EXEC',   chain.exec.active_version,      chain.exec.active_state);
    artifactLine('Closure Doc',        'DIR-CLOSE',  chain.close?.version ?? null,   chain.close?.state ?? null);
    artifactLine('Roadmap Doc',        'ROADMAP',    chain.roadmap?.version ?? null, chain.roadmap?.state ?? null);

    console.log('\n--- Gate Status ---');
    console.log(`Gate 1 (Design Complete):   ${getGateStatusLabel(chain, 'gate_1_open')}`);
    console.log(`Gate 2 (Plan Locked):       ${getGateStatusLabel(chain, 'gate_2_open')}`);
    console.log(`Gate 3 (Build Evidence):    ${getGateStatusLabel(chain, 'gate_3_satisfied')}`);

    if (hasInvalidRuntime(chain)) {
      console.log('\n--- INVALID Runtime Warnings ---');
      for (const line of getInvalidWarningLines(chain)) {
        console.log(`  [INVALID] ${line}`);
      }
    }
  } else {
    console.log('\n--- Artifact Status ---');
    console.log('  No DIR-INTENT exists yet.');
  }

  const nextOps = chain ? getNextValidOperations(chain) : ['intent new'];
  console.log('\n--- CLI-Valid Runtime Operations ---');
  if (nextOps.length > 0) {
    for (const op of nextOps) {
      console.log(`  sigma ${op}`);
    }
  } else {
    console.log('  none');
  }

  console.log('');
}

// ── sigma project sync ────────────────────────────────────────────────────────

function runSync(opts: { confirm?: boolean }): void {
  const projectRoot = findProjectRoot();
  const sigmaDir = path.join(projectRoot, PROJECT_SIGMA_DIR);

  const filesToSync = [
    { src: path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_CONSTITUTION.md'), dest: path.join(sigmaDir, 'SIGMA_CONSTITUTION.md') },
    { src: path.join(GLOBAL_GOVERNANCE_DIR, 'SIGMA_PROTOCOL.md'), dest: path.join(sigmaDir, 'SIGMA_PROTOCOL.md') },
  ];

  const rulesDestDir = path.join(sigmaDir, 'rules');

  if (!opts.confirm) {
    info('Dry run — files that would be updated:');
    for (const f of filesToSync) {
      console.log(`  ${f.src} → ${f.dest}`);
    }
    console.log(`  ${GLOBAL_RULES_DIR}/ → ${rulesDestDir}/`);
    if (fileExists(BUNDLE_OP_REGISTRY)) {
      console.log(`  SIGMA-OPERATION-REGISTRY.json (from bundle)`);
    }
    if (fileExists(BUNDLE_DOC_REGISTRY)) {
      console.log(`  SIGMA-REGISTRY.json (from bundle)`);
    }
    if (fileExists(BUNDLE_ROLE_MEMORY_DIR)) {
      console.log('  role-memory/ (from bundle)');
    }
    warn('Pass --confirm to apply.');
    return;
  }

  const updated: string[] = [];

  for (const f of filesToSync) {
    if (fileExists(f.src)) {
      fs.copySync(f.src, f.dest, { overwrite: true });
      updated.push(path.basename(f.dest));
    }
  }

  if (fileExists(GLOBAL_RULES_DIR)) {
    fs.copySync(GLOBAL_RULES_DIR, rulesDestDir, { overwrite: true });
    updated.push('rules/');
  }

  if (fileExists(BUNDLE_OP_REGISTRY)) {
    const dest = path.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json');
    fs.copySync(BUNDLE_OP_REGISTRY, dest, { overwrite: true });
    updated.push('SIGMA-OPERATION-REGISTRY.json');
  }

  if (fileExists(BUNDLE_DOC_REGISTRY)) {
    const dest = path.join(sigmaDir, 'SIGMA-REGISTRY.json');
    fs.copySync(BUNDLE_DOC_REGISTRY, dest, { overwrite: true });
    updated.push('SIGMA-REGISTRY.json');
  }

  if (fileExists(BUNDLE_ROLE_MEMORY_DIR)) {
    const dest = path.join(sigmaDir, 'role-memory');
    fs.copySync(BUNDLE_ROLE_MEMORY_DIR, dest, { overwrite: true });
    updated.push('role-memory/');
  }

  success('Project synced successfully.');
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

function resolveRegisterIdentity(projectRoot: string, opts: { id?: string; name?: string }): { id: string; name: string } {
  const progressPath = path.join(projectRoot, PROJECT_SIGMA_DIR, 'progress.json');

  if (fileExists(progressPath)) {
    try {
      const data = fs.readJsonSync(progressPath) as { project_id?: string; project_name?: string };
      if (data.project_id && data.project_name) {
        return { id: data.project_id, name: data.project_name };
      }
    } catch {
      // progress.json is unreadable — fall through to manual flags
    }
  }

  if (opts.id && opts.name) {
    return { id: validateProjectId(opts.id), name: validateProjectName(opts.name) };
  }

  throw new Error(
    'Sigma/progress.json is missing, unreadable, or incomplete — cannot determine project identity ' +
    'automatically. Pass --id <PROJECT_ID> --name <name> to proceed.'
  );
}

function runRegister(opts: { id?: string; name?: string }): void {
  const projectRoot = findSigmaProjectRoot();
  const identity = resolveRegisterIdentity(projectRoot, opts);

  // Recreates Sigma/logs/operations.jsonl if it was lost or corrupted since
  // the last register/start. A still-valid log is left untouched.
  const logsReinitialized = ensureOperationsLog(projectRoot);

  writeProjectIdentity(projectRoot, identity.id, identity.name, resolveLogsCreatedAt(projectRoot, logsReinitialized));

  success(`Project identity written: ${identity.name} (${identity.id})`);
  console.log(`  File: ${path.join(projectRoot, PROJECT_IDENTITY_FILE)}`);
}

// ── Command builder ───────────────────────────────────────────────────────────

export function projectCommand(): Command {
  const cmd = new Command('project');
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
    .action((opts: { id?: string; name?: string; lang?: string; confirm?: boolean; reinit?: boolean; overwriteBridge?: boolean }) => {
      runStart(opts).catch(err => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });
    });

  cmd
    .command('status')
    .description('Show current project state (lifecycle, artifacts, gates)')
    .action(() => {
      try { runStatus(); } catch (e) { error((e as Error).message); }
    });

  cmd
    .command('sync')
    .description('Sync governance files from ~/.sigma/ into this project')
    .option('--confirm', 'Apply changes (without this flag, dry-run only)')
    .action((opts: { confirm?: boolean }) => {
      try { runSync(opts); } catch (e) { error((e as Error).message); }
    });

  cmd
    .command('register')
    .description('(Re)generate .sigma-identity.json for this project — repairs a missing/corrupted identity file, or backfills a project created before it existed')
    .option('--id <PROJECT_ID>', 'Project ID, used only if progress.json is unreadable')
    .option('--name <name>', 'Project name, used only if progress.json is unreadable')
    .action((opts: { id?: string; name?: string }) => {
      try { runRegister(opts); } catch (e) { error((e as Error).message); }
    });

  return cmd;
}
