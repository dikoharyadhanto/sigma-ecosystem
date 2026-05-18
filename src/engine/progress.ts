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
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  superseded_by?: string;
  supersede_reason?: string;
  stale_intent?: boolean;
  intent_version_ref?: string;
  plan_version_ref?: string;
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

type ArtifactDomain = 'intent' | 'plan' | 'exec' | 'close' | 'roadmap';

const TRACKER_STATES: Record<ArtifactDomain, string[]> = {
  intent: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
  plan: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
  exec: ['DRAFT', 'BUILDING', 'TESTING', 'COMPLETED', 'LOCKED', 'SUPERSEDED'],
  close: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
  roadmap: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
};

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

function recoveryHint(field: string): string {
  return (
    `Recovery: run \`sigma session bootstrap\`, inspect Sigma/progress.json field "${field}", ` +
    'then repair by recreating or superseding the affected artifact.'
  );
}

function semanticError(field: string, message: string): Error {
  return new Error(`Invalid progress.json state at ${field}: ${message}. ${recoveryHint(field)}`);
}

function schemaVersionParts(version: string): number[] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function isNewerSchema(actual: string, expected: string): boolean {
  const a = schemaVersionParts(actual);
  const e = schemaVersionParts(expected);
  if (!a || !e) return actual !== expected;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > e[i]) return true;
    if (a[i] < e[i]) return false;
  }
  return false;
}

function validateTracker(data: ProgressJson, domain: ArtifactDomain): void {
  const tracker = data[domain];
  const field = domain;

  if (typeof tracker !== 'object' || tracker === null) {
    throw semanticError(field, 'tracker block is malformed');
  }

  if (!Array.isArray(tracker.versions)) {
    throw semanticError(`${field}.versions`, 'versions must be an array');
  }

  if ((tracker.active_version === null) !== (tracker.active_state === null)) {
    throw semanticError(field, 'active_version and active_state must either both be set or both be null');
  }

  const seen = new Set<string>();
  for (const v of tracker.versions) {
    if (!v.version) throw semanticError(`${field}.versions`, 'version entry is missing version');
    if (seen.has(v.version)) throw semanticError(`${field}.versions`, `duplicate version "${v.version}"`);
    seen.add(v.version);

    if (!TRACKER_STATES[domain].includes(v.state)) {
      throw semanticError(`${field}.${v.version}.state`, `invalid state "${v.state}"`);
    }
    if (!v.created_at || !v.updated_at) {
      throw semanticError(`${field}.${v.version}`, 'created_at and updated_at are required');
    }
    if (v.state === 'LOCKED' && !v.locked_at) {
      throw semanticError(`${field}.${v.version}.locked_at`, 'LOCKED entries must include locked_at');
    }
    if (v.state === 'SUPERSEDED' && !v.superseded_by && !v.supersede_reason) {
      throw semanticError(
        `${field}.${v.version}`,
        'SUPERSEDED entries must include superseded_by or supersede_reason'
      );
    }
  }

  if (tracker.active_version) {
    const matches = tracker.versions.filter(v => v.version === tracker.active_version);
    if (matches.length !== 1) {
      throw semanticError(`${field}.active_version`, `active version "${tracker.active_version}" is not present exactly once`);
    }
    if (matches[0].state !== tracker.active_state) {
      throw semanticError(
        `${field}.active_state`,
        `active_state "${tracker.active_state}" does not match active entry state "${matches[0].state}"`
      );
    }
  } else if (tracker.versions.some(v => v.state !== 'SUPERSEDED')) {
    throw semanticError(field, 'inactive tracker contains non-superseded versions');
  }
}

function hasActiveLockedIntent(data: ProgressJson): boolean {
  return data.intent.versions.some(v => v.state === 'LOCKED');
}

function hasActiveLockedPlan(data: ProgressJson): boolean {
  return data.plan.versions.some(v => v.state === 'LOCKED');
}

function hasCleanGate3Chain(data: ProgressJson): boolean {
  const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
  if (!lockedIntent) return false;

  const qualifyingPlan = data.plan.versions.find(
    v => v.state === 'LOCKED' &&
      v.intent_version_ref === lockedIntent.version &&
      !v.stale_intent
  );
  if (!qualifyingPlan) return false;

  return data.exec.versions.some(
    v => v.state === 'LOCKED' &&
      v.plan_version_ref === qualifyingPlan.version &&
      !v.stale_intent
  );
}

export function validateProgressSemantics(data: ProgressJson): void {
  if (data.schema_version !== SCHEMA_VERSION && isNewerSchema(data.schema_version, SCHEMA_VERSION)) {
    throw semanticError(
      'schema_version',
      `schema_version "${data.schema_version}" is newer than supported "${SCHEMA_VERSION}"`
    );
  }

  for (const domain of ['intent', 'plan', 'exec', 'close', 'roadmap'] as const) {
    validateTracker(data, domain);
  }

  const intentVersions = new Set(data.intent.versions.map(v => v.version));
  for (const v of data.plan.versions) {
    if (v.intent_version_ref && !intentVersions.has(v.intent_version_ref)) {
      throw semanticError('plan.intent_version_ref', `PLAN ${v.version} references missing INTENT ${v.intent_version_ref}`);
    }
  }

  const planVersions = new Set(data.plan.versions.map(v => v.version));
  for (const v of data.exec.versions) {
    if (v.plan_version_ref && !planVersions.has(v.plan_version_ref)) {
      throw semanticError('exec.plan_version_ref', `EXEC ${v.version} references missing PLAN ${v.plan_version_ref}`);
    }
  }

  if (data.gates.gate_1_open && !hasActiveLockedIntent(data)) {
    throw semanticError('gates.gate_1_open', 'gate is open without an active locked INTENT');
  }
  if (data.gates.gate_2_open && !hasActiveLockedPlan(data)) {
    throw semanticError('gates.gate_2_open', 'gate is open without an active locked PLAN');
  }
  if (data.gates.gate_3_satisfied && !hasCleanGate3Chain(data)) {
    throw semanticError('gates.gate_3_satisfied', 'gate is satisfied without a clean INTENT -> PLAN -> EXEC chain');
  }
}

export function assertProgressCanMutate(data: ProgressJson): void {
  validateProgressSemantics(data);
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

// ── Version Helpers ───────────────────────────────────────────────────────────

export function nextMajorVersion(versions: ArtifactVersion[]): string {
  return `v${versions.length + 1}`;
}

export function nextExecVersion(versions: ArtifactVersion[]): string {
  return `v0.${versions.length + 1}`;
}

// ── INTENT Mutations ──────────────────────────────────────────────────────────

export function registerIntentDraft(
  data: ProgressJson,
  version: string,
  filePath: string
): void {
  const now = new Date().toISOString();
  data.intent.versions.push({ version, state: 'DRAFT', file: filePath, created_at: now, updated_at: now });
  data.intent.active_version = version;
  data.intent.active_state = 'DRAFT';
}

function propagateStaleIntent(data: ProgressJson, newLockedVersion: string): void {
  const now = new Date().toISOString();
  const stalePlanVersions = new Set<string>();

  for (const pv of data.plan.versions) {
    if (pv.intent_version_ref && pv.intent_version_ref !== newLockedVersion) {
      pv.stale_intent = true;
      pv.updated_at = now;
      stalePlanVersions.add(pv.version);
    }
  }

  for (const ev of data.exec.versions) {
    if (ev.plan_version_ref && stalePlanVersions.has(ev.plan_version_ref)) {
      ev.stale_intent = true;
      ev.updated_at = now;
    }
  }
}

export function lockActiveIntent(data: ProgressJson): void {
  const now = new Date().toISOString();
  const activeVersion = data.intent.active_version;
  if (!activeVersion) throw new Error('No active INTENT version to lock');

  for (const v of data.intent.versions) {
    if (v.state === 'LOCKED') {
      v.state = 'SUPERSEDED';
      v.superseded_by = activeVersion;
      v.updated_at = now;
    }
  }

  const active = data.intent.versions.find(v => v.version === activeVersion);
  if (!active) throw new Error(`INTENT version ${activeVersion} not found`);
  active.state = 'LOCKED';
  active.locked_at = now;
  active.updated_at = now;

  data.intent.active_state = 'LOCKED';
  data.gates.gate_1_open = true;
  if (data.lifecycle_state === 'DESIGN') data.lifecycle_state = 'BUILD';

  propagateStaleIntent(data, activeVersion);
}

// ── PLAN Mutations ────────────────────────────────────────────────────────────

export function registerPlanDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  intentVersionRef: string
): void {
  const now = new Date().toISOString();
  data.plan.versions.push({
    version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
    intent_version_ref: intentVersionRef,
  });
  data.plan.active_version = version;
  data.plan.active_state = 'DRAFT';
}

export function lockActivePlan(data: ProgressJson): void {
  const now = new Date().toISOString();
  const activeVersion = data.plan.active_version;
  if (!activeVersion) throw new Error('No active PLAN version to lock');

  const active = data.plan.versions.find(v => v.version === activeVersion);
  if (!active) throw new Error(`PLAN version ${activeVersion} not found`);
  active.state = 'LOCKED';
  active.locked_at = now;
  active.updated_at = now;

  data.plan.active_state = 'LOCKED';
  data.gates.gate_2_open = true;
}

export function supersedePlanVersion(data: ProgressJson, version: string, reason: string): void {
  const now = new Date().toISOString();
  const target = data.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`PLAN version ${version} not found`);
  if (target.state !== 'LOCKED') throw new Error(`PLAN ${version} is not LOCKED; cannot supersede`);
  target.state = 'SUPERSEDED';
  target.supersede_reason = reason;
  target.updated_at = now;
}

// ── EXEC Mutations ────────────────────────────────────────────────────────────

export function registerExecDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  planVersionRef: string
): void {
  const now = new Date().toISOString();
  data.exec.versions.push({
    version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
    plan_version_ref: planVersionRef,
  });
  data.exec.active_version = version;
  data.exec.active_state = 'DRAFT';
}

export function advanceExecState(
  data: ProgressJson,
  toState: 'BUILDING' | 'TESTING' | 'COMPLETED'
): void {
  const now = new Date().toISOString();
  const activeVersion = data.exec.active_version;
  if (!activeVersion) throw new Error('No active EXEC version to advance');

  const expectedSource: Record<string, string> = {
    BUILDING: 'DRAFT',
    TESTING: 'BUILDING',
    COMPLETED: 'TESTING',
  };

  const currentState = data.exec.active_state;
  if (currentState !== expectedSource[toState]) {
    throw new Error(
      `Cannot advance to ${toState}: current state is ${currentState}, expected ${expectedSource[toState]}`
    );
  }

  const active = data.exec.versions.find(v => v.version === activeVersion);
  if (!active) throw new Error(`EXEC version ${activeVersion} not found`);
  active.state = toState;
  active.updated_at = now;
  data.exec.active_state = toState;
}

function evaluateGate3(data: ProgressJson): boolean {
  const lockedIntent = data.intent.versions.find(v => v.state === 'LOCKED');
  if (!lockedIntent) return false;

  const qualifyingPlan = data.plan.versions.find(
    v => v.state === 'LOCKED' &&
      v.intent_version_ref === lockedIntent.version &&
      !v.stale_intent
  );
  if (!qualifyingPlan) return false;

  const qualifyingExec = data.exec.versions.find(
    v => v.version === data.exec.active_version &&
      v.state === 'LOCKED' &&
      v.plan_version_ref === qualifyingPlan.version
  );
  return !!qualifyingExec;
}

export function lockActiveExec(data: ProgressJson): void {
  const now = new Date().toISOString();
  const activeVersion = data.exec.active_version;
  if (!activeVersion) throw new Error('No active EXEC version to lock');

  const active = data.exec.versions.find(v => v.version === activeVersion);
  if (!active) throw new Error(`EXEC version ${activeVersion} not found`);
  active.state = 'LOCKED';
  active.locked_at = now;
  active.updated_at = now;

  data.exec.active_state = 'LOCKED';
  data.gates.gate_3_satisfied = evaluateGate3(data);
}

export function supersedeExecVersion(data: ProgressJson, version: string, reason: string): void {
  const now = new Date().toISOString();
  const target = data.exec.versions.find(v => v.version === version);
  if (!target) throw new Error(`EXEC version ${version} not found`);
  if (target.state !== 'LOCKED') throw new Error(`EXEC ${version} is not LOCKED; cannot supersede`);
  target.state = 'SUPERSEDED';
  target.supersede_reason = reason;
  target.updated_at = now;
}

// ── CLOSE Mutations ───────────────────────────────────────────────────────────

export function registerCloseDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  staleAcknowledged: boolean
): void {
  const now = new Date().toISOString();
  const entry: ArtifactVersion & { stale_acknowledged?: boolean } = {
    version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
  };
  if (staleAcknowledged) entry.stale_acknowledged = true;
  data.close.versions.push(entry as ArtifactVersion);
  data.close.active_version = version;
  data.close.active_state = 'DRAFT';
  data.lifecycle_state = 'CLOSE';
}

export function lockActiveClose(data: ProgressJson): void {
  const now = new Date().toISOString();
  const activeVersion = data.close.active_version;
  if (!activeVersion) throw new Error('No active CLOSE version to lock');

  for (const v of data.close.versions) {
    if (v.state === 'LOCKED') {
      v.state = 'SUPERSEDED';
      v.superseded_by = activeVersion;
      v.updated_at = now;
    }
  }

  const active = data.close.versions.find(v => v.version === activeVersion);
  if (!active) throw new Error(`CLOSE version ${activeVersion} not found`);
  active.state = 'LOCKED';
  active.locked_at = now;
  active.updated_at = now;

  data.close.active_state = 'LOCKED';
  data.lifecycle_state = 'CLOSED';
}

// ── ROADMAP Mutations ─────────────────────────────────────────────────────────

export function registerRoadmapDraft(
  data: ProgressJson,
  version: string,
  filePath: string
): void {
  const now = new Date().toISOString();
  data.roadmap.versions.push({ version, state: 'DRAFT', file: filePath, created_at: now, updated_at: now });
  data.roadmap.active_version = version;
  data.roadmap.active_state = 'DRAFT';
}

export function lockActiveRoadmap(data: ProgressJson): void {
  const now = new Date().toISOString();
  const draft = data.roadmap.versions.find(v => v.state === 'DRAFT');
  if (!draft) throw new Error('No ROADMAP DRAFT to lock');

  for (const v of data.roadmap.versions) {
    if (v.state === 'LOCKED') {
      v.state = 'SUPERSEDED';
      v.superseded_by = draft.version;
      v.updated_at = now;
    }
  }

  draft.state = 'LOCKED';
  draft.locked_at = now;
  draft.updated_at = now;

  data.roadmap.active_version = draft.version;
  data.roadmap.active_state = 'LOCKED';
}

// ── CSO Registration ──────────────────────────────────────────────────────────

export function registerCsoEntry(data: ProgressJson, entry: CsoEntry): void {
  data.cso.push(entry);
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
