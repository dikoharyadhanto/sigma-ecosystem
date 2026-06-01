import fs from 'fs-extra';
import path from 'path';
import { PROGRESS_FILE, SCHEMA_VERSION } from '../config';

// ── Types ────────────────────────────────────────────────────────────────────

export type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';
export type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type PlanState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type ExecState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type RoadmapState = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'SUPERSEDED';

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
  title?: string;
  focus?: string;
}

export interface ArtifactTracker {
  active_version: string | null;
  active_state: string | null;
  versions: ArtifactVersion[];
}

export interface PendingPlanEntry {
  id: string;
  file: string;
  created_at: string;
}

export interface PlanTracker extends ArtifactTracker {
  pending: PendingPlanEntry[];
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
  plan: PlanTracker;
  exec: ArtifactTracker;
  close: ArtifactTracker;
  roadmap: ArtifactTracker;
  gates: Gates;
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
  exec: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
  close: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
  roadmap: ['DRAFT', 'ACTIVE', 'INACTIVE', 'LOCKED', 'SUPERSEDED'],
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
    'roadmap', 'gates',
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
  const activeExec = data.exec.versions.find(
    v => v.version === data.exec.active_version && v.state === 'LOCKED'
  );
  if (!activeExec?.plan_version_ref) return false;

  const referencedPlan = data.plan.versions.find(
    v => v.version === activeExec.plan_version_ref &&
      v.state === 'LOCKED' &&
      !v.stale_intent
  );
  if (!referencedPlan?.intent_version_ref) return false;

  return data.intent.versions.some(
    v => v.version === referencedPlan.intent_version_ref && v.state === 'LOCKED'
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
  // Backward compat: plan.pending may not exist in older progress.json files
  if (!Array.isArray((data.plan as PlanTracker).pending)) {
    (data.plan as PlanTracker).pending = [];
  }
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
    plan: { ...emptyTracker, pending: [] },
    exec: { ...emptyTracker },
    close: { ...emptyTracker },
    roadmap: { ...emptyTracker },
    gates: {
      gate_1_open: false,
      gate_2_open: false,
      gate_3_satisfied: false,
    },
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

function parseMajorVersion(version: string): number {
  const match = version.match(/^v(\d+)/);
  if (!match) throw new Error(`Cannot parse major version from "${version}"`);
  return parseInt(match[1], 10);
}

export function nextMajorVersion(versions: ArtifactVersion[]): string {
  return `v${versions.length + 1}`;
}

// PLAN major = INTENT major − 1; minor starts at 1
export function nextPlanVersion(data: ProgressJson, intentVersionRef: string): string {
  const planMajor = parseMajorVersion(intentVersionRef) - 1;
  const existingUnderMajor = data.plan.versions.filter(
    v => parseMajorVersion(v.version) === planMajor
  );
  return `v${planMajor}.${existingUnderMajor.length + 1}`;
}

// EXEC major must equal PLAN major; minor starts at 1
export function nextExecVersion(data: ProgressJson, planVersionRef: string): string {
  const execMajor = parseMajorVersion(planVersionRef);
  const existingUnderMajor = data.exec.versions.filter(
    v => parseMajorVersion(v.version) === execMajor
  );
  return `v${execMajor}.${existingUnderMajor.length + 1}`;
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
  intentVersionRef: string,
  title?: string,
  focus?: string,
): void {
  const planMajor = parseMajorVersion(version);
  const expectedPlanMajor = parseMajorVersion(intentVersionRef) - 1;
  if (planMajor !== expectedPlanMajor) {
    throw new Error(
      `Version sync error: FMN-PLAN ${version} (major ${planMajor}) is not valid under DIR-INTENT ${intentVersionRef}. ` +
      `Expected PLAN major: ${expectedPlanMajor} (INTENT major ${parseMajorVersion(intentVersionRef)} − 1). ` +
      `Valid PLAN versions: v${expectedPlanMajor}.1, v${expectedPlanMajor}.2, ...`
    );
  }
  const now = new Date().toISOString();
  const entry: ArtifactVersion = {
    version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
    intent_version_ref: intentVersionRef,
  };
  if (title) entry.title = title;
  if (focus) entry.focus = focus;
  data.plan.versions.push(entry);
  data.plan.active_version = version;
  data.plan.active_state = 'DRAFT';
}

export function updatePlanMetadata(
  data: ProgressJson,
  version: string,
  title?: string,
  focus?: string,
): void {
  const entry = data.plan.versions.find(v => v.version === version);
  if (!entry) throw new Error(`FMN-PLAN ${version} not found. Run: sigma plan list`);
  if (title !== undefined) entry.title = title;
  if (focus !== undefined) entry.focus = focus;
  entry.updated_at = new Date().toISOString();
}

export function lockOldestPlanDraft(data: ProgressJson): string {
  const drafts = data.plan.versions
    .filter(v => v.state === 'DRAFT')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (drafts.length === 0) throw new Error('No DRAFT FMN-PLAN to lock. Run: sigma plan new');

  const oldest = drafts[0];
  const now = new Date().toISOString();
  oldest.state = 'LOCKED';
  oldest.locked_at = now;
  oldest.updated_at = now;

  data.plan.active_version = oldest.version;
  data.plan.active_state = 'LOCKED';
  data.gates.gate_2_open = true;

  return oldest.version;
}

export function registerPendingPlan(data: ProgressJson, id: string, filePath: string): void {
  const now = new Date().toISOString();
  data.plan.pending.push({ id, file: filePath, created_at: now });
}

export function promotePendingPlan(
  data: ProgressJson,
  id: string,
  version: string,
  newFilePath: string,
  intentVersionRef: string,
  title?: string,
  focus?: string,
): void {
  const idx = data.plan.pending.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Pending plan ID "${id}" not found`);

  const pending = data.plan.pending[idx];
  data.plan.pending.splice(idx, 1);

  const now = new Date().toISOString();
  const entry: ArtifactVersion = {
    version, state: 'DRAFT', file: newFilePath,
    created_at: pending.created_at,
    updated_at: now,
    intent_version_ref: intentVersionRef,
  };
  if (title) entry.title = title;
  if (focus) entry.focus = focus;
  data.plan.versions.push(entry);
  data.plan.active_version = version;
  data.plan.active_state = 'DRAFT';
}

export function supersedePlanVersion(data: ProgressJson, version: string, reason: string): void {
  const now = new Date().toISOString();
  const target = data.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`PLAN version ${version} not found`);
  if (target.state !== 'LOCKED') throw new Error(`PLAN ${version} is not LOCKED; cannot supersede`);
  target.state = 'SUPERSEDED';
  target.supersede_reason = reason;
  target.updated_at = now;

  if (data.plan.active_version === version) {
    data.plan.active_state = 'SUPERSEDED';
  }

  const cascadeReason = `Cascade: FMN-PLAN ${version} superseded — ${reason}`;
  for (const exec of data.exec.versions) {
    if (exec.plan_version_ref === version && exec.state !== 'SUPERSEDED') {
      exec.state = 'SUPERSEDED';
      exec.supersede_reason = cascadeReason;
      exec.updated_at = now;
      if (data.exec.active_version === exec.version) {
        data.exec.active_state = 'SUPERSEDED';
      }
    }
  }
}

export function activatePlanDraft(data: ProgressJson, version: string): void {
  const target = data.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`PLAN version ${version} not found`);
  if (target.state !== 'DRAFT') {
    throw new Error(
      `PLAN ${version} is in state "${target.state}"; activate requires a DRAFT version. ` +
      `Use 'sigma plan supersede' to supersede a LOCKED version instead.`
    );
  }
  data.plan.active_version = version;
  data.plan.active_state = 'DRAFT';
}

// ── EXEC Mutations ────────────────────────────────────────────────────────────

export function registerExecDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  planVersionRef: string
): void {
  const execMajor = parseMajorVersion(version);
  const planMajor = parseMajorVersion(planVersionRef);
  if (execMajor !== planMajor) {
    throw new Error(
      `Version sync error: DEV-EXEC ${version} (major ${execMajor}) does not match FMN-PLAN ${planVersionRef} (major ${planMajor}). ` +
      `EXEC major must equal PLAN major. Valid EXEC versions: v${planMajor}.1, v${planMajor}.2, ...`
    );
  }
  const now = new Date().toISOString();
  data.exec.versions.push({
    version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
    plan_version_ref: planVersionRef,
  });
  data.exec.active_version = version;
  data.exec.active_state = 'DRAFT';
  data.gates.gate_3_satisfied = false;
}

function evaluateGate3(data: ProgressJson): boolean {
  const activeExec = data.exec.versions.find(
    v => v.version === data.exec.active_version && v.state === 'LOCKED'
  );
  if (!activeExec?.plan_version_ref) return false;

  const referencedPlan = data.plan.versions.find(
    v => v.version === activeExec.plan_version_ref &&
      v.state === 'LOCKED' &&
      !v.stale_intent
  );
  if (!referencedPlan?.intent_version_ref) return false;

  return data.intent.versions.some(
    v => v.version === referencedPlan.intent_version_ref && v.state === 'LOCKED'
  );
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
  filePath: string,
  intentVersionRef: string
): void {
  const intentMajor = parseMajorVersion(intentVersionRef);
  const conflict = data.roadmap.versions.find(v => {
    try { return parseMajorVersion(v.version) === intentMajor; } catch { return false; }
  });
  if (conflict) {
    throw new Error(
      `ROADMAP ${version} already exists for INTENT ${intentVersionRef}. ` +
      `To create a new roadmap, create a new INTENT version first.`
    );
  }

  const now = new Date().toISOString();
  const hasActive = data.roadmap.versions.some(v => v.state === 'ACTIVE');
  const state = hasActive ? 'DRAFT' : 'ACTIVE';

  data.roadmap.versions.push({
    version, state, file: filePath,
    created_at: now, updated_at: now,
    intent_version_ref: intentVersionRef,
  });

  if (!hasActive) {
    data.roadmap.active_version = version;
    data.roadmap.active_state = 'ACTIVE';
  }
}

export function activateRoadmap(data: ProgressJson, version: string): void {
  const now = new Date().toISOString();
  const target = data.roadmap.versions.find(v => v.version === version);
  if (!target) throw new Error(`ROADMAP ${version} not found`);
  if (target.state !== 'DRAFT') {
    throw new Error(`ROADMAP ${version} is in state "${target.state}"; activate requires a DRAFT version`);
  }

  const currentActive = data.roadmap.versions.find(v => v.state === 'ACTIVE');
  if (currentActive) {
    currentActive.state = 'INACTIVE';
    currentActive.updated_at = now;
  }

  target.state = 'ACTIVE';
  target.updated_at = now;

  data.roadmap.active_version = version;
  data.roadmap.active_state = 'ACTIVE';
}

export function lockActiveRoadmap(data: ProgressJson): void {
  const now = new Date().toISOString();
  const active = data.roadmap.versions.find(v => v.state === 'ACTIVE');
  if (!active) throw new Error('No ACTIVE ROADMAP found. Run: sigma roadmap new or sigma roadmap activate');

  active.state = 'LOCKED';
  active.locked_at = now;
  active.updated_at = now;

  data.roadmap.active_version = active.version;
  data.roadmap.active_state = 'LOCKED';
}

export function getNextValidOperations(data: ProgressJson): string[] {
  const ops: string[] = [];
  const intentLocked = data.intent.active_state === 'LOCKED';
  const planLocked = data.plan.active_state === 'LOCKED';
  const roadmapActive = data.roadmap.versions.some(v => v.state === 'ACTIVE');
  const roadmapDraft = data.roadmap.versions.find(v => v.state === 'DRAFT');

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

  // roadmap domain — mandatory gate for plan new
  if (intentLocked && !roadmapActive) {
    ops.push('roadmap new');
  }
  if (roadmapDraft) {
    ops.push(`roadmap activate --v ${roadmapDraft.version}`);
  }

  // plan domain — Gate 1.5: requires ACTIVE ROADMAP
  if (intentLocked && roadmapActive) {
    ops.push('plan new');
  }
  const draftPlans = data.plan.versions.filter(v => v.state === 'DRAFT');
  if (draftPlans.length > 0) {
    // FIFO lock — show oldest target
    const oldest = draftPlans.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    ops.push(`plan lock    # will lock ${oldest.version} (oldest DRAFT)`);
  }
  if (data.plan.pending.length > 0) {
    ops.push('plan queue');
  }

  // exec domain
  if (planLocked) {
    ops.push('exec new');
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
