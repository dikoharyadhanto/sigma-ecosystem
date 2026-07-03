import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CLI = path.resolve(__dirname, '..', 'dist', 'cli.js');
const SCHEMA_VERSION = '1.0.0';

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runCli(args: string, cwd: string, homeDir: string, input?: string): CliResult {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, {
      cwd,
      env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
      encoding: 'utf-8',
      input: input ?? '',
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

export interface TestEnv {
  projectDir: string;
  homeDir: string;
  sigmaDir: string;
  progressPath: string;
  cleanup: () => void;
}

export function setupTestEnv(): TestEnv {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-test-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigma-home-'));

  // Minimal ~/.sigma global installation
  const sigmaGlobal = path.join(homeDir, '.sigma');
  fs.mkdirSync(sigmaGlobal);
  fs.writeJsonSync(path.join(sigmaGlobal, 'sigma.config.json'), {
    schema_version: SCHEMA_VERSION,
    cli_version: '0.9.0',
    installed_at: new Date().toISOString(),
  });
  fs.writeJsonSync(path.join(sigmaGlobal, 'projects.json'), {
    schema_version: SCHEMA_VERSION,
    projects: [],
  });

  // Project Sigma/ structure
  const sigmaDir = path.join(projectDir, 'Sigma');
  for (const sub of ['design', 'build', 'close', 'rules', 'logs', 'memory']) {
    fs.mkdirSync(path.join(sigmaDir, sub), { recursive: true });
  }

  const progressPath = path.join(sigmaDir, 'progress.json');

  return {
    projectDir,
    homeDir,
    sigmaDir,
    progressPath,
    cleanup: () => {
      fs.removeSync(projectDir);
      fs.removeSync(homeDir);
    },
  };
}

export function makeProgress(overrides: Partial<ReturnType<typeof baseProgress>> = {}): object {
  return { ...baseProgress(), ...overrides };
}

function baseProgress() {
  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    project_id: 'TEST',
    project_name: 'Test Project',
    lifecycle_state: 'DESIGN',
    created_at: now,
    updated_at: now,
    intent: { active_version: null, active_state: null, versions: [] },
    plan: { active_version: null, active_state: null, versions: [] },
    exec: { active_version: null, active_state: null, versions: [] },
    close: { active_version: null, active_state: null, versions: [] },
    roadmap: { active_version: null, active_state: null, versions: [] },
    gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
    cso: [],
  };
}

export function makeProgressWithDraftIntent() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'DESIGN',
    intent: {
      active_version: 'v1',
      active_state: 'DRAFT',
      versions: [{ version: 'v1', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now }],
    },
    gates: { gate_1_open: false, gate_2_open: false, gate_3_satisfied: false },
  });
}

export function makeProgressWithLockedIntent() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
    },
    gates: { gate_1_open: true, gate_2_open: false, gate_3_satisfied: false },
  });
}

export function makeProgressWithLockedPlan() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
    },
    plan: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: false },
  });
}

export function makeProgressWithLockedExec() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now }],
    },
    plan: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v0.1',
      active_state: 'LOCKED',
      versions: [{ version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
  });
}

export function makeProgressWithDraftIntentAfterLockedChain() {
  const now = new Date().toISOString();
  return makeProgress({
    lifecycle_state: 'BUILD',
    intent: {
      active_version: 'v2',
      active_state: 'DRAFT',
      versions: [
        { version: 'v1', state: 'LOCKED', file: 'Sigma/design/DIR-INTENT-v1.md', created_at: now, updated_at: now, locked_at: now },
        { version: 'v2', state: 'DRAFT', file: 'Sigma/design/DIR-INTENT-v2.md', created_at: now, updated_at: now },
      ],
    },
    plan: {
      active_version: 'v1',
      active_state: 'LOCKED',
      versions: [{ version: 'v1', state: 'LOCKED', file: 'Sigma/build/FMN-PLAN-v1.md', created_at: now, updated_at: now, locked_at: now, intent_version_ref: 'v1' }],
    },
    exec: {
      active_version: 'v0.1',
      active_state: 'LOCKED',
      versions: [{ version: 'v0.1', state: 'LOCKED', file: 'Sigma/build/DEV-EXEC-v0.1.md', created_at: now, updated_at: now, locked_at: now, plan_version_ref: 'v1' }],
    },
    gates: { gate_1_open: true, gate_2_open: true, gate_3_satisfied: true },
  });
}
