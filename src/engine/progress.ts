import fs from 'fs-extra';
import path from 'path';
import { PROGRESS_FILE, OVERRIDES_FILE, SCHEMA_VERSION } from '../config';

// ── Types ────────────────────────────────────────────────────────────────────

export type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';
export type IntentState = 'DRAFT' | 'LOCKED' | 'INACTIVE' | 'SUPERSEDED';
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
  title?: string;
  focus?: string;
}

export interface PlanTracker extends ArtifactTracker {
  pending: PendingPlanEntry[];
}

export interface Gates {
  gate_1_open: boolean;
  gate_2_open: boolean;
  gate_3_satisfied: boolean;
}

export type InvalidGateKey = 'gate_1_open' | 'gate_2_open' | 'gate_3_satisfied';
export type InvalidMarkerDomain = ArtifactDomain | 'gates';

export interface InvalidChainRef {
  intent_version: string | null;
  plan_version: string | null;
  exec_version: string | null;
}

export interface InvalidMarker {
  id: string;
  domain: InvalidMarkerDomain;
  status: 'INVALID';
  reason: string;
  gate?: InvalidGateKey;
  chain: InvalidChainRef;
  first_detected_at: string;
  last_detected_at: string;
}

export interface RuntimeInvalidState {
  markers: InvalidMarker[];
  last_doctor_run_at: string | null;
}

export interface OverrideEntry {
  type: 'override';
  timestamp: string;
  artifact: string;
  phase: string;
  gate_bypassed: string;
  reason: string;
  authorized_by: 'Director';
  // Version of the tracker's active entry at the time the gate was bypassed.
  // Missing/null on entries written before this field existed.
  version?: string | null;
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
  runtime_invalid?: RuntimeInvalidState;
}

export interface GateStatus {
  gate_1_open: boolean;
  gate_2_open: boolean;
  gate_3_satisfied: boolean;
}

type ArtifactDomain = 'intent' | 'plan' | 'exec' | 'close' | 'roadmap';

const TRACKER_STATES: Record<ArtifactDomain, string[]> = {
  intent: ['DRAFT', 'LOCKED', 'INACTIVE', 'SUPERSEDED'],
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

function ensureRuntimeInvalid(data: ProgressJson): RuntimeInvalidState {
  if (!data.runtime_invalid || !Array.isArray(data.runtime_invalid.markers)) {
    data.runtime_invalid = { markers: [], last_doctor_run_at: null };
  }
  return data.runtime_invalid;
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

export function hasActiveLockedIntent(data: ProgressJson): boolean {
  return data.intent.versions.some(v => v.state === 'LOCKED');
}

function hasActiveLockedPlan(data: ProgressJson): boolean {
  return data.plan.versions.some(v => v.state === 'LOCKED');
}

export function hasCleanGate2Chain(data: ProgressJson): boolean {
  return data.plan.versions.some(
    v => v.state === 'LOCKED' &&
      !!v.intent_version_ref &&
      data.intent.versions.some(
        iv => iv.version === v.intent_version_ref && iv.state === 'LOCKED'
      )
  );
}

export function hasCleanGate3Chain(data: ProgressJson): boolean {
  const activeExec = data.exec.versions.find(
    v => v.version === data.exec.active_version && v.state === 'LOCKED'
  );
  if (!activeExec?.plan_version_ref) return false;

  const referencedPlan = data.plan.versions.find(
    v => v.version === activeExec.plan_version_ref &&
      v.state === 'LOCKED'
  );
  if (!referencedPlan?.intent_version_ref) return false;

  return data.intent.versions.some(
    v => v.version === referencedPlan.intent_version_ref && v.state === 'LOCKED'
  );
}

function artifactDomainFor(artifact: string): ArtifactDomain | null {
  switch (artifact) {
    case 'DIR-INTENT': return 'intent';
    case 'FMN-PLAN': return 'plan';
    case 'DEV-EXEC': return 'exec';
    default: return null;
  }
}

// An override stays in force only until the artifact it bypassed is resolved
// by the normal flow: locked for real, or explicitly superseded. A version
// still sitting in DRAFT (unchanged since the override was recorded) means
// the emergency bypass is still the only thing holding the gate open.
function isOverrideStillActive(entry: OverrideEntry, data: ProgressJson): boolean {
  const domain = artifactDomainFor(entry.artifact);
  if (!domain) return false;
  const tracker = data[domain] as ArtifactTracker;

  if (entry.version) {
    const version = tracker.versions.find(v => v.version === entry.version);
    return !!version && version.state === 'DRAFT';
  }

  // No version existed yet when the override was recorded — stays active
  // until the tracker gains any resolved (non-DRAFT) version.
  return !tracker.versions.some(v => v.state !== 'DRAFT');
}

function hasActiveOverrideForGate(overrides: OverrideEntry[], data: ProgressJson, gateLabel: string): boolean {
  return overrides.some(entry => entry.gate_bypassed === gateLabel && isOverrideStillActive(entry, data));
}

export function readOverrides(projectRoot: string): OverrideEntry[] {
  const filePath = path.join(projectRoot, OVERRIDES_FILE);
  if (!fs.existsSync(filePath)) return [];

  const entries: OverrideEntry[] = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as OverrideEntry);
    } catch {
      // Skip malformed lines — the log is append-only and best-effort.
    }
  }
  return entries;
}

function markerChain(
  intentVersion: string | null = null,
  planVersion: string | null = null,
  execVersion: string | null = null,
): InvalidChainRef {
  return { intent_version: intentVersion, plan_version: planVersion, exec_version: execVersion };
}

function hasNonSupersededVersion(tracker: ArtifactTracker): boolean {
  return tracker.versions.some(v => v.state !== 'SUPERSEDED');
}

export function hasInvalidRuntime(data: ProgressJson): boolean {
  return ensureRuntimeInvalid(data).markers.length > 0;
}

export function getInvalidMarkers(data: ProgressJson): InvalidMarker[] {
  return ensureRuntimeInvalid(data).markers;
}

export function isGateInvalid(data: ProgressJson, gate: InvalidGateKey): boolean {
  const markers = getInvalidMarkers(data);
  if (markers.some(marker => marker.gate === gate)) return true;

  const impactedDomains: Record<InvalidGateKey, InvalidMarkerDomain[]> = {
    gate_1_open: ['intent', 'gates'],
    gate_2_open: ['intent', 'plan', 'gates'],
    gate_3_satisfied: ['intent', 'plan', 'exec', 'gates'],
  };

  return markers.some(marker => impactedDomains[gate].includes(marker.domain));
}

export function getGateStatusLabel(data: ProgressJson, gate: InvalidGateKey): 'OPEN' | 'BLOCKED' | 'SATISFIED' | 'INVALID' {
  if (isGateInvalid(data, gate)) return 'INVALID';
  if (gate === 'gate_3_satisfied') return data.gates.gate_3_satisfied ? 'SATISFIED' : 'BLOCKED';
  return data.gates[gate] ? 'OPEN' : 'BLOCKED';
}

export function getOperationalGate(data: ProgressJson, gate: InvalidGateKey): boolean {
  return data.gates[gate] || isGateInvalid(data, gate);
}

export function getInvalidWarningLines(data: ProgressJson): string[] {
  return getInvalidMarkers(data).map(marker => {
    const scope = [
      marker.chain.intent_version ? `INTENT ${marker.chain.intent_version}` : null,
      marker.chain.plan_version ? `PLAN ${marker.chain.plan_version}` : null,
      marker.chain.exec_version ? `EXEC ${marker.chain.exec_version}` : null,
    ].filter(Boolean).join(' -> ');

    const scopeLabel = scope.length > 0 ? ` (${scope})` : '';
    return `${marker.domain.toUpperCase()}${scopeLabel}: ${marker.reason}`;
  });
}

export interface DoctorReport {
  repaired: string[];
  invalidMarked: InvalidMarker[];
  invalidCleared: InvalidMarker[];
  remainingInvalid: InvalidMarker[];
}

function buildMarker(
  existing: Map<string, InvalidMarker>,
  now: string,
  partial: Omit<InvalidMarker, 'first_detected_at' | 'last_detected_at' | 'status'>,
): InvalidMarker {
  const prev = existing.get(partial.id);
  return {
    ...partial,
    status: 'INVALID',
    first_detected_at: prev?.first_detected_at ?? now,
    last_detected_at: now,
  };
}

export function runDoctorReconciliation(data: ProgressJson, overrides: OverrideEntry[] = []): DoctorReport {
  const runtimeInvalid = ensureRuntimeInvalid(data);
  const previous = new Map(runtimeInvalid.markers.map(marker => [marker.id, marker]));
  const nextMarkers: InvalidMarker[] = [];
  const repaired: string[] = [];
  const now = new Date().toISOString();

  // Auto-repair the known exec-new corruption pattern:
  // a LOCKED exec and a later DRAFT exec share the same version key.
  const execVersionsByKey = new Map<string, ArtifactVersion[]>();
  for (const version of data.exec.versions) {
    const versions = execVersionsByKey.get(version.version) ?? [];
    versions.push(version);
    execVersionsByKey.set(version.version, versions);
  }
  for (const [version, versions] of execVersionsByKey) {
    if (versions.some(v => v.state === 'LOCKED') && versions.some(v => v.state === 'DRAFT')) {
      const before = data.exec.versions.length;
      data.exec.versions = data.exec.versions.filter(v => !(v.version === version && v.state === 'DRAFT'));
      const removed = before - data.exec.versions.length;
      if (removed > 0) {
        repaired.push(`exec.versions removed ${removed} duplicate DRAFT entr${removed === 1 ? 'y' : 'ies'} for "${version}" because a LOCKED entry exists`);
        if (data.exec.active_version === version) {
          data.exec.active_state = 'LOCKED';
        }
      }
    }
  }

  // Auto-repair tracker active_state mismatches when a single active entry exists.
  for (const domain of ['intent', 'plan', 'exec', 'close', 'roadmap'] as const) {
    const tracker = data[domain] as ArtifactTracker;
    if (!tracker.active_version) continue;
    const matches = tracker.versions.filter(v => v.version === tracker.active_version);
    if (matches.length === 1 && matches[0].state !== tracker.active_state) {
      repaired.push(`${domain}.active_state repaired from "${tracker.active_state}" to "${matches[0].state}"`);
      tracker.active_state = matches[0].state;
    }
  }

  // Auto-repair gate booleans to match actual runtime conditions, unless a
  // still-active override is the reason the gate is forced open.
  const expectedGate1 = hasActiveLockedIntent(data) || hasActiveOverrideForGate(overrides, data, 'Gate 1');
  if (data.gates.gate_1_open !== expectedGate1) {
    repaired.push(`gates.gate_1_open repaired from "${data.gates.gate_1_open}" to "${expectedGate1}"`);
    data.gates.gate_1_open = expectedGate1;
  }

  const expectedGate2 = hasCleanGate2Chain(data) || hasActiveOverrideForGate(overrides, data, 'Gate 2');
  if (data.gates.gate_2_open !== expectedGate2) {
    repaired.push(`gates.gate_2_open repaired from "${data.gates.gate_2_open}" to "${expectedGate2}"`);
    data.gates.gate_2_open = expectedGate2;
  }

  const expectedGate3 = hasCleanGate3Chain(data) || hasActiveOverrideForGate(overrides, data, 'Gate 3');
  if (data.gates.gate_3_satisfied !== expectedGate3) {
    repaired.push(`gates.gate_3_satisfied repaired from "${data.gates.gate_3_satisfied}" to "${expectedGate3}"`);
    data.gates.gate_3_satisfied = expectedGate3;
  }

  // Recover a stranded half-completed reopen: a new major INTENT was locked on
  // top of a CLOSED project (displacing the prior intent) but lifecycle was
  // left in CLOSED with no clean build chain of its own. A normal reopen
  // demotes the prior LOCKED intent to INACTIVE (see lockActiveIntent); older
  // data written before this fix — or a chain an explicit `intent supersede`
  // has since touched — may still carry SUPERSEDED instead. This is narrow on
  // purpose — it never touches a genuinely closed cycle, which keeps a clean
  // gate_3 chain.
  if (
    data.lifecycle_state === 'CLOSED' &&
    hasActiveLockedIntent(data) &&
    !hasCleanGate3Chain(data) &&
    data.intent.versions.some(v => v.state === 'SUPERSEDED' || v.state === 'INACTIVE')
  ) {
    repaired.push('lifecycle_state repaired from "CLOSED" to "BUILD" (stranded reopen of a new locked INTENT)');
    data.lifecycle_state = 'BUILD';
  }

  for (const domain of ['intent', 'plan', 'exec', 'close', 'roadmap'] as const) {
    const tracker = data[domain] as ArtifactTracker;

    if ((tracker.active_version === null) !== (tracker.active_state === null)) {
      nextMarkers.push(buildMarker(previous, now, {
        id: `${domain}:active-pair`,
        domain,
        reason: 'active_version and active_state are not paired consistently',
        gate: domain === 'intent' ? 'gate_1_open' : domain === 'plan' ? 'gate_2_open' : domain === 'exec' ? 'gate_3_satisfied' : undefined,
        chain: markerChain(
          domain === 'intent' ? tracker.active_version : null,
          domain === 'plan' ? tracker.active_version : null,
          domain === 'exec' ? tracker.active_version : null,
        ),
      }));
    }

    if (tracker.active_version) {
      const matches = tracker.versions.filter(v => v.version === tracker.active_version);
      if (matches.length !== 1) {
        nextMarkers.push(buildMarker(previous, now, {
          id: `${domain}:active-version:${tracker.active_version}`,
          domain,
          reason: `active version "${tracker.active_version}" is not present exactly once`,
          gate: domain === 'intent' ? 'gate_1_open' : domain === 'plan' ? 'gate_2_open' : domain === 'exec' ? 'gate_3_satisfied' : undefined,
          chain: markerChain(
            domain === 'intent' ? tracker.active_version : null,
            domain === 'plan' ? tracker.active_version : null,
            domain === 'exec' ? tracker.active_version : null,
          ),
        }));
      }
    } else if (hasNonSupersededVersion(tracker)) {
      nextMarkers.push(buildMarker(previous, now, {
        id: `${domain}:inactive-live-versions`,
        domain,
        reason: 'tracker has no active version while non-superseded versions still exist',
        gate: domain === 'intent' ? 'gate_1_open' : domain === 'plan' ? 'gate_2_open' : domain === 'exec' ? 'gate_3_satisfied' : undefined,
        chain: markerChain(),
      }));
    }
  }

  const intentVersions = new Set(data.intent.versions.map(v => v.version));
  for (const version of data.plan.versions) {
    if (version.intent_version_ref && !intentVersions.has(version.intent_version_ref)) {
      nextMarkers.push(buildMarker(previous, now, {
        id: `plan-ref:${version.version}:${version.intent_version_ref}`,
        domain: 'plan',
        reason: `PLAN ${version.version} references missing INTENT ${version.intent_version_ref}`,
        gate: 'gate_2_open',
        chain: markerChain(version.intent_version_ref, version.version, null),
      }));
    }
  }

  const planVersions = new Set(data.plan.versions.map(v => v.version));
  for (const version of data.exec.versions) {
    if (version.plan_version_ref && !planVersions.has(version.plan_version_ref)) {
      nextMarkers.push(buildMarker(previous, now, {
        id: `exec-ref:${version.version}:${version.plan_version_ref}`,
        domain: 'exec',
        reason: `EXEC ${version.version} references missing PLAN ${version.plan_version_ref}`,
        gate: 'gate_3_satisfied',
        chain: markerChain(null, version.plan_version_ref, version.version),
      }));
    }
  }

  runtimeInvalid.markers = nextMarkers;
  runtimeInvalid.last_doctor_run_at = now;

  const nextIds = new Set(nextMarkers.map(marker => marker.id));
  const invalidMarked = nextMarkers.filter(marker => !previous.has(marker.id));
  const invalidCleared = [...previous.values()].filter(marker => !nextIds.has(marker.id));

  return {
    repaired,
    invalidMarked,
    invalidCleared,
    remainingInvalid: nextMarkers,
  };
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
  if (hasInvalidRuntime(data)) {
    process.stderr.write(
      'WARNING: Sigma runtime is in INVALID recovery mode for one or more chains. ' +
      'Normal gate enforcement is temporarily relaxed for affected chains. Run `sigma doctor` to re-check recovery.\n'
    );
    return;
  }
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
  ensureRuntimeInvalid(data);
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

function emptyTracker(): ArtifactTracker {
  return { active_version: null, active_state: null, versions: [] };
}

export function createInitialProgress(projectId: string, projectName: string): ProgressJson {
  const now = new Date().toISOString();

  return {
    schema_version: SCHEMA_VERSION,
    project_id: projectId,
    project_name: projectName,
    lifecycle_state: 'DESIGN',
    created_at: now,
    updated_at: now,
    intent: emptyTracker(),
    plan: { ...emptyTracker(), pending: [] },
    exec: emptyTracker(),
    close: emptyTracker(),
    roadmap: emptyTracker(),
    gates: {
      gate_1_open: false,
      gate_2_open: false,
      gate_3_satisfied: false,
    },
    runtime_invalid: {
      markers: [],
      last_doctor_run_at: null,
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

export interface InactiveIntentWarning {
  intentVersion: string;
  hangingArtifacts: string[];
}

// Non-blocking nudge (PLAN-EVAL-01 Isu Terbuka #1): since `intent lock` no
// longer cascades automatically, an INACTIVE intent can leave Roadmap/Plan/
// Exec/Close descendants sitting LOCKED or DRAFT indefinitely unless Director
// explicitly runs `intent supersede`. This surfaces that situation without
// blocking anything — INACTIVE is deliberately not treated as "dead".
export function getInactiveIntentWarnings(data: ProgressJson): InactiveIntentWarning[] {
  const warnings: InactiveIntentWarning[] = [];

  for (const iv of data.intent.versions) {
    if (iv.state !== 'INACTIVE') continue;

    const hanging: string[] = [];

    // ROADMAP has its own independent lifecycle (DRAFT → ACTIVE → INACTIVE →
    // LOCKED, plus SUPERSEDED) where INACTIVE and LOCKED are already normal,
    // resolved resting states — not "hanging". Only DRAFT/ACTIVE roadmap
    // entries (not yet demoted via `roadmap activate`, nor closed) count as
    // still needing attention here.
    for (const rv of data.roadmap.versions) {
      if (rv.intent_version_ref === iv.version && (rv.state === 'DRAFT' || rv.state === 'ACTIVE')) {
        hanging.push(`ROADMAP ${rv.version} (${rv.state})`);
      }
    }

    const relatedPlans = data.plan.versions.filter(pv => pv.intent_version_ref === iv.version);
    for (const pv of relatedPlans) {
      if (pv.state !== 'SUPERSEDED') hanging.push(`PLAN ${pv.version} (${pv.state})`);
    }

    const relatedPlanVersions = new Set(relatedPlans.map(pv => pv.version));
    for (const ev of data.exec.versions) {
      if (ev.plan_version_ref && relatedPlanVersions.has(ev.plan_version_ref) && ev.state !== 'SUPERSEDED') {
        hanging.push(`EXEC ${ev.version} (${ev.state})`);
      }
    }

    for (const cv of data.close.versions) {
      if (cv.intent_version_ref === iv.version && cv.state !== 'SUPERSEDED') {
        hanging.push(`CLOSE ${cv.version} (${cv.state})`);
      }
    }

    if (hanging.length > 0) {
      warnings.push({ intentVersion: iv.version, hangingArtifacts: hanging });
    }
  }

  return warnings;
}

// ── Version Helpers ───────────────────────────────────────────────────────────

export function parseMajorVersion(version: string): number {
  const match = version.match(/^v(\d+)/);
  if (!match) throw new Error(`Cannot parse major version from "${version}"`);
  return parseInt(match[1], 10);
}

export function parseMinorVersion(version: string): number {
  const match = version.match(/^v\d+(?:\.(\d+))?/);
  if (!match) throw new Error(`Cannot parse minor version from "${version}"`);
  return match[1] ? parseInt(match[1], 10) : 0;
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
  const highestExecMinor = data.exec.versions
    .filter(v => parseMajorVersion(v.version) === execMajor)
    .reduce((highest, v) => Math.max(highest, parseMinorVersion(v.version)), 0);
  const planMinorFloor = parseMinorVersion(planVersionRef) - 1;
  const nextMinor = Math.max(highestExecMinor, planMinorFloor, 0) + 1;
  return `v${execMajor}.${nextMinor}`;
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

export function lockActiveIntent(data: ProgressJson): void {
  const now = new Date().toISOString();
  const activeVersion = data.intent.active_version;
  if (!activeVersion) throw new Error('No active INTENT version to lock');

  // PLAN-EVAL-01: locking a new INTENT no longer supersedes the prior LOCKED
  // INTENT automatically — SUPERSEDED is a strong, cascading claim that now
  // requires explicit `sigma intent supersede --director-confirm`. A prior
  // LOCKED INTENT is demoted to INACTIVE ("not the current focus"), which
  // does not imply cancellation and does not touch any descendant artifact.
  for (const v of data.intent.versions) {
    if (v.state === 'LOCKED') {
      v.state = 'INACTIVE';
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

  // Locking an intent (re)opens the BUILD phase for the newly active cycle.
  // This holds for a DESIGN first-lock, a mid-BUILD major pivot, and a reopen
  // of a CLOSE/CLOSED project — the command contract is "lifecycle → BUILD".
  // Guarding on DESIGN left reopened CLOSED projects stranded in CLOSED.
  data.lifecycle_state = 'BUILD';

  // gate_2/gate_3 belong to the *previous* intent's chain until new PLAN/EXEC
  // artifacts are locked under the newly active intent. Recompute against the
  // current chain so a reopen or pivot cannot inherit an open gate from the
  // now-INACTIVE cycle (its PLAN/EXEC no longer reference a LOCKED INTENT).
  data.gates.gate_2_open = hasCleanGate2Chain(data);
  data.gates.gate_3_satisfied = hasCleanGate3Chain(data);
}

// PLAN-EVAL-01 Prinsip C: cascade is strictly downward and chain-scoped. Every
// match below is keyed on *_version_ref pointing at the exact target version —
// never a blanket sweep — so an unrelated INTENT chain (e.g. a "complementary"
// v2 sitting LOCKED beside a superseded v1) is never touched.
interface IntentCascadeTargets {
  roadmap: ArtifactVersion[];
  plan: ArtifactVersion[];
  exec: ArtifactVersion[];
  close: ArtifactVersion[];
}

function collectIntentCascadeTargets(data: ProgressJson, version: string): IntentCascadeTargets {
  const roadmap = data.roadmap.versions.filter(
    v => v.intent_version_ref === version && v.state !== 'SUPERSEDED'
  );
  const plan = data.plan.versions.filter(
    v => v.intent_version_ref === version && v.state !== 'SUPERSEDED'
  );
  const planVersionSet = new Set(plan.map(v => v.version));
  const exec = data.exec.versions.filter(
    v => !!v.plan_version_ref && planVersionSet.has(v.plan_version_ref) && v.state !== 'SUPERSEDED'
  );
  const close = data.close.versions.filter(
    v => v.intent_version_ref === version && v.state !== 'SUPERSEDED'
  );
  return { roadmap, plan, exec, close };
}

// Read-only preflight for `sigma intent supersede` — lets the CLI show the
// Director everything that will cascade (including already-LOCKED work)
// before requiring --director-confirm.
export function previewIntentSupersedeCascade(data: ProgressJson, version: string): IntentCascadeTargets {
  return collectIntentCascadeTargets(data, version);
}

export function supersedeIntentVersion(data: ProgressJson, version: string, reason: string): void {
  const now = new Date().toISOString();
  const target = data.intent.versions.find(v => v.version === version);
  if (!target) throw new Error(`INTENT version ${version} not found`);
  if (target.state !== 'LOCKED' && target.state !== 'INACTIVE') {
    throw new Error(`INTENT ${version} is in state "${target.state}"; supersede requires LOCKED or INACTIVE`);
  }

  const { roadmap, plan, exec, close } = collectIntentCascadeTargets(data, version);

  target.state = 'SUPERSEDED';
  target.supersede_reason = reason;
  target.updated_at = now;

  // superseded_by is optional by design — only filled when another INTENT is
  // clearly the successor at the moment of supersession (Director may cancel
  // an INTENT with no replacement yet).
  const successor = data.intent.versions.find(
    v => v.version !== version && (v.state === 'LOCKED' || v.state === 'DRAFT')
  );
  if (successor) target.superseded_by = successor.version;

  if (data.intent.active_version === version) {
    data.intent.active_state = 'SUPERSEDED';
  }

  const cascadeReason = `Cascade: DIR-INTENT ${version} superseded — ${reason}`;

  for (const rv of roadmap) {
    rv.state = 'SUPERSEDED';
    rv.supersede_reason = cascadeReason;
    rv.updated_at = now;
    if (data.roadmap.active_version === rv.version) data.roadmap.active_state = 'SUPERSEDED';
  }
  for (const pv of plan) {
    pv.state = 'SUPERSEDED';
    pv.supersede_reason = cascadeReason;
    pv.updated_at = now;
    if (data.plan.active_version === pv.version) data.plan.active_state = 'SUPERSEDED';
  }
  for (const ev of exec) {
    ev.state = 'SUPERSEDED';
    ev.supersede_reason = cascadeReason;
    ev.updated_at = now;
    if (data.exec.active_version === ev.version) data.exec.active_state = 'SUPERSEDED';
  }
  for (const cv of close) {
    cv.state = 'SUPERSEDED';
    cv.supersede_reason = cascadeReason;
    cv.updated_at = now;
    if (data.close.active_version === cv.version) data.close.active_state = 'SUPERSEDED';
  }
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

export function registerPendingPlan(
  data: ProgressJson,
  id: string,
  filePath: string,
  title?: string,
  focus?: string,
): void {
  const now = new Date().toISOString();
  const entry: PendingPlanEntry = { id, file: filePath, created_at: now };
  if (title) entry.title = title;
  if (focus) entry.focus = focus;
  data.plan.pending.push(entry);
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
  entry.title = title ?? pending.title;
  entry.focus = focus ?? pending.focus;
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
  if (data.exec.versions.some(v => v.version === version)) {
    throw new Error(`Duplicate DEV-EXEC version "${version}" already exists in progress.json`);
  }
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
  data.gates.gate_3_satisfied = hasCleanGate3Chain(data);
}

// ── CLOSE Mutations ───────────────────────────────────────────────────────────

export function registerCloseDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  intentVersionRef: string,
): void {
  // 1:1 guard, mirroring registerRoadmapDraft(): CLOSE is 1:1 to INTENT, so it
  // must never need its own SUPERSEDED mechanism — only the intent-supersede
  // cascade may retire one. Without this guard, a second DIR-CLOSE draft for
  // the same INTENT had no way to become the "current" one except an
  // unconditional auto-supersede loop in lockActiveClose (removed — see
  // PLAN-EVAL-01, "Temuan Tambahan").
  const conflict = data.close.versions.find(
    v => v.intent_version_ref === intentVersionRef && v.state !== 'SUPERSEDED'
  );
  if (conflict) {
    throw new Error(
      `DIR-CLOSE already exists for INTENT ${intentVersionRef} (${conflict.version}, ${conflict.state}). ` +
      `Resolve or lock the existing DIR-CLOSE, or run \`sigma intent supersede\` to retire that INTENT chain first.`
    );
  }

  const now = new Date().toISOString();
  const entry: ArtifactVersion = {
    version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
    intent_version_ref: intentVersionRef,
  };
  data.close.versions.push(entry);
  data.close.active_version = version;
  data.close.active_state = 'DRAFT';
  data.lifecycle_state = 'CLOSE';
}

export function lockActiveClose(data: ProgressJson): void {
  const now = new Date().toISOString();
  const activeVersion = data.close.active_version;
  if (!activeVersion) throw new Error('No active CLOSE version to lock');

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

  return ops;
}
