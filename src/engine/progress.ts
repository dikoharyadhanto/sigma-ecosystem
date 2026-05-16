import fs from 'fs-extra';
import path from 'path';
import { PROGRESS_FILE, SCHEMA_VERSION } from '../config';

// ── Types ────────────────────────────────────────────────────────────────────

export type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';
export type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type PlanState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type ExecState = 'DRAFT' | 'BUILDING' | 'TESTING' | 'COMPLETED' | 'LOCKED' | 'SUPERSEDED';
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type RoadmapState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type CsoState = 'DRAFT' | 'COMPLETE';

export interface ArtifactVersion {
  version: string;
  state: string;
  created_at: string;
  updated_at: string;
  stale_intent?: boolean;
}

export interface ArtifactTracker {
  active_version: string | null;
  active_state: string | null;
  versions: ArtifactVersion[];
}

export interface CsoEntry {
  version: string;
  state: CsoState;
  file: string;
  created_at: string;
}

export interface Gates {
  gate_1_open: boolean;
  gate_2_open: boolean;
  gate_3_satisfied: boolean;
}

export interface ProgressJson {
  schema_version: string;
  project_id: string;
  project_name: string;
  lifecycle_state: LifecycleState;
  created_at: string;
  updated_at: string;
  intent: ArtifactTracker;
  plan: ArtifactTracker;
  exec: ArtifactTracker;
  close: ArtifactTracker;
  roadmap: ArtifactTracker;
  gates: Gates;
  cso: CsoEntry[];
}

export interface GateStatus {
  gate_1_open: boolean;
  gate_2_open: boolean;
  gate_3_satisfied: boolean;
}

export interface StaleIntentWarning {
  domain: string;
  version: string;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateProgress(data: unknown): ProgressJson {
  if (typeof data !== 'object' || data === null) {
    throw new Error('progress.json is not a valid JSON object');
  }

  const d = data as Record<string, unknown>;

  const required = [
    'schema_version', 'project_id', 'project_name', 'lifecycle_state',
    'created_at', 'updated_at', 'intent', 'plan', 'exec', 'close',
    'roadmap', 'gates', 'cso',
  ];

  for (const field of required) {
    if (!(field in d)) {
      throw new Error(`progress.json is missing required field: "${field}"`);
    }
  }

  const validLifecycleStates: LifecycleState[] = ['DESIGN', 'BUILD', 'CLOSE', 'CLOSED'];
  if (!validLifecycleStates.includes(d.lifecycle_state as LifecycleState)) {
    throw new Error(`progress.json has invalid lifecycle_state: "${d.lifecycle_state}"`);
  }

  const gates = d.gates as Record<string, unknown>;
  if (
    typeof gates.gate_1_open !== 'boolean' ||
    typeof gates.gate_2_open !== 'boolean' ||
    typeof gates.gate_3_satisfied !== 'boolean'
  ) {
    throw new Error('progress.json gates block is malformed');
  }

  if (!Array.isArray(d.cso)) {
    throw new Error('progress.json cso must be an array');
  }

  return data as ProgressJson;
}

// ── Read / Write ─────────────────────────────────────────────────────────────

export function readProgress(projectRoot: string): ProgressJson {
  const filePath = path.join(projectRoot, PROGRESS_FILE);

  if (!fs.existsSync(filePath)) {
    throw new Error(`No Sigma project found at ${projectRoot}. Run: sigma project start`);
  }

  let raw: unknown;
  try {
    raw = fs.readJsonSync(filePath);
  } catch {
    throw new Error(`Failed to parse ${filePath} — file may be corrupted`);
  }

  const data = validateProgress(raw);
  checkSchemaVersion(data);
  return data;
}

export function writeProgress(projectRoot: string, data: ProgressJson): void {
  const filePath = path.join(projectRoot, PROGRESS_FILE);
  const tmpPath = filePath + '.tmp';

  data.updated_at = new Date().toISOString();

  fs.writeJsonSync(tmpPath, data, { spaces: 2 });
  fs.moveSync(tmpPath, filePath, { overwrite: true });
}

// ── Schema Version ────────────────────────────────────────────────────────────

export function checkSchemaVersion(data: ProgressJson): void {
  if (data.schema_version !== SCHEMA_VERSION) {
    process.stderr.write(
      `Warning: progress.json schema_version is "${data.schema_version}", ` +
      `CLI expects "${SCHEMA_VERSION}". Some operations may behave unexpectedly.\n`
    );
  }
}

// ── Seed State ────────────────────────────────────────────────────────────────

export function createInitialProgress(projectId: string, projectName: string): ProgressJson {
  const now = new Date().toISOString();
  const emptyTracker: ArtifactTracker = {
    active_version: null,
    active_state: null,
    versions: [],
  };

  return {
    schema_version: SCHEMA_VERSION,
    project_id: projectId,
    project_name: projectName,
    lifecycle_state: 'DESIGN',
    created_at: now,
    updated_at: now,
    intent: { ...emptyTracker },
    plan: { ...emptyTracker },
    exec: { ...emptyTracker },
    close: { ...emptyTracker },
    roadmap: { ...emptyTracker },
    gates: {
      gate_1_open: false,
      gate_2_open: false,
      gate_3_satisfied: false,
    },
    cso: [],
  };
}

// ── Gate & State Queries ──────────────────────────────────────────────────────

export function getGateStatus(data: ProgressJson): GateStatus {
  return {
    gate_1_open: data.gates.gate_1_open,
    gate_2_open: data.gates.gate_2_open,
    gate_3_satisfied: data.gates.gate_3_satisfied,
  };
}

export function isStaleIntentPresent(data: ProgressJson): StaleIntentWarning[] {
  const warnings: StaleIntentWarning[] = [];

  for (const domain of ['plan', 'exec'] as const) {
    for (const v of data[domain].versions) {
      if ((v as ArtifactVersion & { stale_intent?: boolean }).stale_intent) {
        warnings.push({ domain, version: v.version });
      }
    }
  }

  return warnings;
}

export function getNextValidOperations(data: ProgressJson): string[] {
  const ops: string[] = [];
  const intentLocked = data.intent.active_state === 'LOCKED';
  const planLocked = data.plan.active_state === 'LOCKED';
  const roadmapDraftExists = data.roadmap.versions.some(v => v.state === 'DRAFT');

  // intent domain
  if (!intentLocked) {
    ops.push('intent new');
  }
  if (data.intent.active_state === 'DRAFT') {
    ops.push('intent lock');
  }
  if (intentLocked) {
    ops.push('intent review');
  }

  // roadmap domain (optional)
  if (intentLocked && !roadmapDraftExists) {
    ops.push('roadmap new');
  }
  if (roadmapDraftExists) {
    ops.push('roadmap lock');
  }

  // plan domain
  if (intentLocked) {
    ops.push('plan new');
  }
  if (data.plan.active_state === 'DRAFT') {
    ops.push('plan lock');
  }

  // exec domain
  if (planLocked) {
    ops.push('exec new');
  }
  if (data.exec.active_state === 'BUILDING' || data.exec.active_state === 'TESTING') {
    ops.push('exec complete');
  }

  // close domain
  if (data.lifecycle_state === 'BUILD' && data.gates.gate_3_satisfied) {
    ops.push('close new');
  }
  if (data.close.active_state === 'DRAFT') {
    ops.push('close lock');
  }

  // always available
  ops.push('session bootstrap');
  ops.push('project status');
  ops.push('gitignore generate');

  return ops;
}
