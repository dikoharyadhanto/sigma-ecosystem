import fs from 'fs-extra';
import path from 'path';
import { PROGRESS_FILE, OVERRIDES_FILE, SCHEMA_VERSION } from '../config';

// PLAN-EVAL-01 Fase 5 — this module is legacy now. Every command's primary
// path reads/writes Sigma/progress-v<N>.json via src/engine/chain.ts;
// nothing left here is reachable through normal CLI usage. What remains is
// exactly what `sigma doctor --reconstruct` (src/engine/reconstruct.ts,
// src/commands/doctor.ts) and `sigma project start`'s legacy progress.json
// stub still depend on, plus shared types/utilities chain.ts reuses rather
// than duplicates (parseMajorVersion/parseMinorVersion and several plain
// type aliases — these never touched ProgressJson's shape and didn't need
// porting). `--reconstruct` itself is out of scope for PLAN-EVAL-01 (its
// artifact-scanning is inherently multi-chain work — PLAN-EVAL-05); this
// file can only be deleted once that lands. Do not add new callers here —
// new code should use chain.ts.

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

type ArtifactDomain = 'intent' | 'plan' | 'exec' | 'close' | 'roadmap';

// ── Gate Chain Queries (used by reconstruct.ts) ─────────────────────────────

export function hasActiveLockedIntent(data: ProgressJson): boolean {
  return data.intent.versions.some(v => v.state === 'LOCKED');
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

// ── Overrides (used by doctor.ts) ───────────────────────────────────────────

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

function ensureRuntimeInvalid(data: ProgressJson): RuntimeInvalidState {
  if (!data.runtime_invalid || !Array.isArray(data.runtime_invalid.markers)) {
    data.runtime_invalid = { markers: [], last_doctor_run_at: null };
  }
  return data.runtime_invalid;
}

export function getInvalidMarkers(data: ProgressJson): InvalidMarker[] {
  return ensureRuntimeInvalid(data).markers;
}

// ── Read / Write (writeProgress used by doctor.ts --reconstruct) ───────────

export function writeProgress(projectRoot: string, data: ProgressJson): void {
  const filePath = path.join(projectRoot, PROGRESS_FILE);
  const tmpPath = filePath + '.tmp';

  data.updated_at = new Date().toISOString();

  fs.writeJsonSync(tmpPath, data, { spaces: 2 });
  fs.moveSync(tmpPath, filePath, { overwrite: true });
}

// ── Seed State (used by project.ts's legacy stub write, reconstruct.ts) ────

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

// ── Version Helpers (shared, unchanged by the chain.ts migration) ──────────

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
