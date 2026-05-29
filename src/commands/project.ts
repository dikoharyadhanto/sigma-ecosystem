import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import {
  GLOBAL_SIGMA_DIR,
  GLOBAL_RULES_DIR,
  GLOBAL_GOVERNANCE_DIR,
  GLOBAL_PROJECTS_FILE,
  GLOBAL_MEMORY_FILE,
  PROJECT_SIGMA_DIR,
  SUBFOLDERS,
  MESSAGES_DIR,
  MESSAGES_INDEX_FILE,
  MESSAGE_SUBFOLDERS,
} from '../config';
import { writeMcpJson, writeVscodeMcpJson } from '../utils/mcp';
import {
  readProgress,
  writeProgress,
  createInitialProgress,
  getGateStatus,
  isStaleIntentPresent,
  getNextValidOperations,
} from '../engine/progress';
import { createDefaultProjectConfig, writeProjectConfig, langLabel } from '../engine/projectConfig';
import { success, info, warn, error } from '../utils/output';
import { ensureDir, fileExists, findProjectRoot, backupFile } from '../utils/fs';

// ── Bundle paths ─────────────────────────────────────────────────────────────

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE_OP_REGISTRY = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-OPERATION-REGISTRY.json');
const BUNDLE_DOC_REGISTRY = path.join(PACKAGE_ROOT, 'Sigma', 'SIGMA-REGISTRY.json');
const BUNDLE_MEMORY_SEED = path.join(PACKAGE_ROOT, 'setup', 'sigma-memory-seed.jsonl');

// ── Validation ────────────────────────────────────────────────────────────────

const PROJECT_ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,11}$/;

function validateProjectId(id: string): string {
  const clean = id.trim().toUpperCase();
  if (!PROJECT_ID_PATTERN.test(clean)) {
    throw new Error(
      `Invalid project ID "${id}". Must be uppercase letters, digits, and hyphens only, max 12 chars. Example: MYPROJ`
    );
  }
  return clean;
}

function validateProjectName(name: string): string {
  const clean = name.trim();
  if (clean.length === 0 || clean.length > 64) {
    throw new Error('Project name must be between 1 and 64 characters.');
  }
  return clean;
}

// ── projects.json helpers ────────────────────────────────────────────────────

interface ProjectEntry {
  project_id: string;
  project_name: string;
  path: string;
  registered_at: string;
}

interface ProjectsFile {
  schema_version: string;
  projects: ProjectEntry[];
}

function registerProjectEntry(projectId: string, projectName: string, projectPath: string): void {
  if (!fileExists(GLOBAL_PROJECTS_FILE)) return;

  const data = fs.readJsonSync(GLOBAL_PROJECTS_FILE) as ProjectsFile;
  const idx = data.projects.findIndex(p => p.project_id === projectId);

  const entry: ProjectEntry = {
    project_id: projectId,
    project_name: projectName,
    path: projectPath,
    registered_at: new Date().toISOString(),
  };

  if (idx >= 0) {
    data.projects[idx] = entry;
  } else {
    data.projects.push(entry);
  }

  fs.writeJsonSync(GLOBAL_PROJECTS_FILE, data, { spaces: 2 });
}

// ── Memory seed helper ────────────────────────────────────────────────────────

function ensureMemoryFileSeeded(): void {
  const hasSeed = fileExists(BUNDLE_MEMORY_SEED);
  if (!fileExists(GLOBAL_MEMORY_FILE)) {
    fs.ensureFileSync(GLOBAL_MEMORY_FILE);
    if (hasSeed) {
      fs.writeFileSync(GLOBAL_MEMORY_FILE, fs.readFileSync(BUNDLE_MEMORY_SEED, 'utf-8'), 'utf-8');
    }
  } else {
    const existing = fs.readFileSync(GLOBAL_MEMORY_FILE, 'utf-8').trim();
    if (existing.length === 0 && hasSeed) {
      fs.writeFileSync(GLOBAL_MEMORY_FILE, fs.readFileSync(BUNDLE_MEMORY_SEED, 'utf-8'), 'utf-8');
    }
  }
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
  const logsDir = path.join(sigmaDir, 'logs');

  if (fileExists(progressPath)) {
    if (!opts.reinit) {
      error(
        'This directory is already a Sigma project. ' +
        'Use `sigma project status` to inspect, or pass --reinit to re-initialize.'
      );
    }
    ensureDir(logsDir);
    const backed = backupFile(progressPath, logsDir);
    warn(`Existing progress.json backed up to: ${backed}`);
  }

  // Collect project_id and project_name
  let projectId: string;
  let projectName: string;

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
  }

  info(`Initializing Sigma project: ${projectName} (${projectId})...`);

  // Create Sigma/ folder and all subfolders
  ensureDir(sigmaDir);
  for (const sub of SUBFOLDERS) {
    ensureDir(path.join(sigmaDir, sub));
  }

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

  // Create progress.json
  const initial = createInitialProgress(projectId, projectName);
  fs.writeJsonSync(progressPath, initial, { spaces: 2 });

  // Write project.config.json with language preference
  const lang = opts.lang?.trim().toLowerCase() || 'en';
  writeProjectConfig(projectRoot, createDefaultProjectConfig(lang));
  console.log(`  Config: Sigma/project.config.json written (document language: ${langLabel(lang)})`);

  // Create messages folder tree
  const messagesDir = path.join(projectRoot, MESSAGES_DIR);
  fs.ensureDirSync(messagesDir);
  for (const sub of MESSAGE_SUBFOLDERS) {
    fs.ensureDirSync(path.join(messagesDir, sub));
  }
  const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
  fs.writeJsonSync(indexPath, { messages: [] }, { spaces: 2 });
  console.log('  Mailbox: Sigma/messages/ initialized.');

  // Create bridge file stubs
  for (const bridgeFile of ['CLAUDE.md', 'GEMINI.md', 'AGENTS.md']) {
    const bridgePath = path.join(projectRoot, bridgeFile);
    if (!fileExists(bridgePath) || opts.overwriteBridge) {
      fs.writeFileSync(
        bridgePath,
        `# ${bridgeFile}\n\n<!-- Sigma bridge stub — Phase 6 will write real content -->\n`
      );
    }
  }

  // Register in global projects.json
  registerProjectEntry(projectId, projectName, projectRoot);

  // Write .mcp.json so AI agents can reach sigma-memory and sequential-thinking
  const mcpJsonPath = path.join(projectRoot, '.mcp.json');
  writeMcpJson(mcpJsonPath);
  ensureMemoryFileSeeded();
  console.log(`  MCP: ${mcpJsonPath} written (sigma-memory + sequential-thinking).`);

  // Write .vscode/mcp.json for VS Code/Antigravity integration
  const vscodeMcpPath = path.join(projectRoot, '.vscode', 'mcp.json');
  writeVscodeMcpJson(vscodeMcpPath);
  console.log(`  VS Code MCP: ${vscodeMcpPath} written.`);
  console.log(`  Memory file: ${GLOBAL_MEMORY_FILE}`);

  success(`Sigma project initialized: ${projectName} (${projectId})`);
  console.log(`  Location: ${sigmaDir}`);
  console.log('  Next: Run `sigma session bootstrap` to confirm state.');
}

// ── sigma project status ──────────────────────────────────────────────────────

function runStatus(): void {
  const projectRoot = findProjectRoot();
  const data = readProgress(projectRoot);
  const gates = getGateStatus(data);
  const stale = isStaleIntentPresent(data);

  console.log('\n=== Sigma Project Status ===\n');
  console.log(`Project:          ${data.project_name} (${data.project_id})`);
  console.log(`Lifecycle Phase:  ${data.lifecycle_state}`);
  console.log(`Last Updated:     ${data.updated_at}`);

  const ARTIFACT_LABELS: Record<string, { label: string; code: string }> = {
    intent:  { label: 'Intent Doc',         code: 'DIR-INTENT' },
    plan:    { label: 'Plan Doc',           code: 'FMN-PLAN'   },
    exec:    { label: 'Execution Evidence', code: 'DEV-EXEC'   },
    close:   { label: 'Closure Doc',        code: 'DIR-CLOSE'  },
    roadmap: { label: 'Roadmap Doc',        code: 'ROADMAP'    },
  };

  console.log('\n--- Artifact Status ---');
  for (const domain of ['intent', 'plan', 'exec', 'close', 'roadmap'] as const) {
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
      warn(`  ${w.domain} ${w.version} has stale_intent=true`);
    }
  }

  const nextOps = getNextValidOperations(data);
  console.log('\n--- Next Valid Operations ---');
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
  const logsDir = path.join(sigmaDir, 'logs');

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
    warn('Pass --confirm to apply.');
    return;
  }

  // Backup before sync
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(logsDir, `sync-backup-${timestamp}`);
  ensureDir(backupDir);

  const updated: string[] = [];

  for (const f of filesToSync) {
    if (fileExists(f.dest)) {
      fs.copySync(f.dest, path.join(backupDir, path.basename(f.dest)));
    }
    if (fileExists(f.src)) {
      fs.copySync(f.src, f.dest, { overwrite: true });
      updated.push(path.basename(f.dest));
    }
  }

  if (fileExists(GLOBAL_RULES_DIR)) {
    if (fileExists(rulesDestDir)) {
      fs.copySync(rulesDestDir, path.join(backupDir, 'rules'));
    }
    fs.copySync(GLOBAL_RULES_DIR, rulesDestDir, { overwrite: true });
    updated.push('rules/');
  }

  if (fileExists(BUNDLE_OP_REGISTRY)) {
    const dest = path.join(sigmaDir, 'SIGMA-OPERATION-REGISTRY.json');
    if (fileExists(dest)) fs.copySync(dest, path.join(backupDir, 'SIGMA-OPERATION-REGISTRY.json'));
    fs.copySync(BUNDLE_OP_REGISTRY, dest, { overwrite: true });
    updated.push('SIGMA-OPERATION-REGISTRY.json');
  }

  if (fileExists(BUNDLE_DOC_REGISTRY)) {
    const dest = path.join(sigmaDir, 'SIGMA-REGISTRY.json');
    if (fileExists(dest)) fs.copySync(dest, path.join(backupDir, 'SIGMA-REGISTRY.json'));
    fs.copySync(BUNDLE_DOC_REGISTRY, dest, { overwrite: true });
    updated.push('SIGMA-REGISTRY.json');
  }

  success('Project synced successfully.');
  for (const f of updated) {
    console.log(`  Updated: ${f}`);
  }
  console.log(`  Backup saved to: ${backupDir}`);
}

// ── sigma project reset ───────────────────────────────────────────────────────

function runReset(opts: { confirm?: boolean; wipe?: boolean }): void {
  if (!opts.confirm) {
    error('--confirm is required. This operation resets project state. Pass --confirm to proceed.');
  }

  const projectRoot = findProjectRoot();
  const sigmaDir = path.join(projectRoot, PROJECT_SIGMA_DIR);
  const logsDir = path.join(sigmaDir, 'logs');
  const progressPath = path.join(sigmaDir, 'progress.json');

  // Read existing to preserve project_id and project_name
  const existing = readProgress(projectRoot);
  ensureDir(logsDir);

  const backed = backupFile(progressPath, logsDir);
  warn(`progress.json backed up to: ${backed}`);

  const fresh = createInitialProgress(existing.project_id, existing.project_name);
  fs.writeJsonSync(progressPath, fresh, { spaces: 2 });

  if (opts.wipe) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(logsDir, `reset-archive-${timestamp}`);
    ensureDir(archiveDir);

    for (const folder of ['design', 'build', 'close']) {
      const src = path.join(sigmaDir, folder);
      if (fileExists(src)) {
        fs.copySync(src, path.join(archiveDir, folder));
        fs.emptyDirSync(src);
        console.log(`  Archived and cleared: ${folder}/`);
      }
    }

    success('Project hard reset complete. Artifact files archived.');
    console.log(`  Archive: ${archiveDir}`);
  } else {
    success('Project soft reset complete. Artifact files preserved.');
  }

  console.log('  progress.json reset to initial state.');
}

// ── sigma project register ────────────────────────────────────────────────────

function runRegister(): void {
  if (!fileExists(GLOBAL_PROJECTS_FILE)) {
    error('~/.sigma/projects.json not found. Run: sigma setup install');
  }

  const projectRoot = findProjectRoot();
  const data = readProgress(projectRoot);

  registerProjectEntry(data.project_id, data.project_name, projectRoot);

  success(`Project registered: ${data.project_name} (${data.project_id})`);
  console.log(`  Path: ${projectRoot}`);
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
    .option('--lang <code>', 'Document language ISO 639-1 code (default: en). Use "id" for Bahasa Indonesia.')
    .option('--confirm', 'Skip interactive prompts (requires --id and --name)')
    .option('--reinit', 'Re-initialize an existing Sigma project (backs up progress.json)')
    .option('--overwrite-bridge', 'Overwrite existing bridge files (CLAUDE.md, GEMINI.md, AGENTS.md)')
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
    .command('reset')
    .description('Reset project state (soft or archive)')
    .option('--confirm', 'Required — confirms the reset')
    .option('--wipe', 'Archive and clear artifact folders (design/, build/, close/)')
    .action((opts: { confirm?: boolean; wipe?: boolean }) => {
      try { runReset(opts); } catch (e) { error((e as Error).message); }
    });

  cmd
    .command('register')
    .description('Register this project in ~/.sigma/projects.json')
    .action(() => {
      try { runRegister(); } catch (e) { error((e as Error).message); }
    });

  return cmd;
}
