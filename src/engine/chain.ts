import fs from 'fs-extra';
import path from 'path';
import { PROJECT_SIGMA_DIR, PROJECT_IDENTITY_FILE, ACTIVATE_STATUS_FILE, OVERRIDES_FILE, SCHEMA_VERSION } from '../config';

// PLAN-EVAL-01 (Core Storage & Schema Migration, Opsi C) — foundation module.
// `intent`/`roadmap`/`close` are single objects per chain file here (not
// arrays) — see
// Implementation/planned_sigma_multichain_progress_2026_07_17/PLAN-EVAL-01-CORE-STORAGE-SCHEMA-MIGRATION.md
// §3 for the schema decisions and their rationale. `plan`/`exec` keep the
// exact `PlanTracker`/`ArtifactTracker` shape — unchanged.
//
// PLAN-EVAL-05 — the shared types/helpers below (through "Shared Types —
// relocated from progress.ts") used to live in `src/engine/progress.ts`.
// They were relocated here verbatim once `progress.ts` had no remaining
// reason to exist (its only other job, backing `sigma doctor --reconstruct`,
// was migrated to `chain.ts`/`reconstruct.ts` in the same change) — nothing
// about their shape or behavior changed, only their location.

// ── Shared Types — relocated from progress.ts ───────────────────────────────

export type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';

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

type ArtifactDomain = 'intent' | 'plan' | 'exec' | 'close' | 'roadmap';

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

// ── Overrides (read by doctor.ts / override.ts) ─────────────────────────────

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

// ── Version Helpers ──────────────────────────────────────────────────────────

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

// ── Chain Types ──────────────────────────────────────────────────────────────

// PLAN-EVAL-01 §3.4 — INACTIVE dropped: structurally dead once each chain
// file holds exactly one intent (nothing left in the same file to demote).
export type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
// PLAN-EVAL-01 §3.5 — ACTIVE/INACTIVE dropped: nothing to arbitrate with a
// single roadmap object per chain. `roadmap lock` stays a manual command
// (PLAN-EVAL-04 scope, not implemented here) — this is a structural-only
// change.
export type RoadmapState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';

export interface SingleIntentState {
  version: string; // == chain_version, always
  state: IntentState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  title?: string; // PLAN-EVAL-06 — rendered into Sigma/design/intent-history.md
  focus?: string; // PLAN-EVAL-06 — rendered into Sigma/design/intent-history.md
  // superseded_by intentionally omitted — PLAN-EVAL-01 §3.4: cross-chain
  // succession would require a chain-file mutation to know about another
  // chain's file, which breaks total isolation. `intent list` (projection
  // across all chain files) is the source of truth for succession order.
}

export interface SingleRoadmapState {
  version: string;
  state: RoadmapState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  // intent_version_ref intentionally omitted — always equals this chain's
  // own intent.version (PLAN-EVAL-01 §3.5).
}

export interface SingleCloseState {
  version: string;
  state: CloseState;
  file?: string;
  created_at: string;
  updated_at: string;
  locked_at?: string;
  supersede_reason?: string;
  // intent_version_ref intentionally omitted — same reasoning as roadmap.
}

export interface ChainState {
  schema_version: string;
  chain_version: string; // "v1" — matches intent.version and the file suffix
  created_at: string;
  updated_at: string;
  lifecycle_state: LifecycleState; // per-chain now (PLAN-EVAL-01 §3.3)
  intent: SingleIntentState; // never null — a chain file only ever exists because `intent new` created it
  roadmap: SingleRoadmapState | null; // null until `roadmap new`
  plan: PlanTracker; // unchanged shape
  exec: ArtifactTracker; // unchanged shape
  close: SingleCloseState | null; // null until `close new`
  gates: Gates;
  runtime_invalid?: RuntimeInvalidState;
}

// Sigma/activate_status.json — the only manifest field, deliberately. No
// project_id/project_name (lives in .sigma-identity.json only), no chain
// summary/cache (always a fresh projection over progress-v*.json). See
// PLAN-EVAL-01 §3.1/§3.3.
export interface ActivateStatus {
  active_chain: string | null; // null only before the first `intent new`
}

// Mirrors the shape written by `sigma project start`/`register`
// (src/commands/project.ts `ProjectIdentity`) — read-only here, this module
// never writes .sigma-identity.json.
export interface ProjectIdentity {
  schema_version: string;
  project_id: string;
  project_name: string;
  registered: true;
  logs_created_at: string;
}

// ── Path helpers ─────────────────────────────────────────────────────────────

const CHAIN_FILE_PATTERN = /^progress-v(\d+)\.json$/;

export function chainFilePath(projectRoot: string, chainVersion: string): string {
  return path.join(projectRoot, PROJECT_SIGMA_DIR, `progress-${chainVersion}.json`);
}

export function activateStatusPath(projectRoot: string): string {
  return path.join(projectRoot, ACTIVATE_STATUS_FILE);
}

// ── Discovery ────────────────────────────────────────────────────────────────

// All progress-v<N>.json chain files present on disk, sorted ascending by
// major version. Does not read their contents — pure filename scan.
export function listChainVersions(projectRoot: string): string[] {
  const sigmaDir = path.join(projectRoot, PROJECT_SIGMA_DIR);
  if (!fs.existsSync(sigmaDir)) return [];

  const versions: number[] = [];
  for (const filename of fs.readdirSync(sigmaDir)) {
    const match = filename.match(CHAIN_FILE_PATTERN);
    if (match) versions.push(parseInt(match[1], 10));
  }
  return versions.sort((a, b) => a - b).map(n => `v${n}`);
}

// Replaces nextMajorVersion(data.intent.versions) — there is no single array
// left to count; the next chain version comes from what's on disk.
export function nextChainVersion(projectRoot: string): string {
  const existing = listChainVersions(projectRoot);
  if (existing.length === 0) return 'v1';
  const highest = Math.max(...existing.map(v => parseMajorVersion(v)));
  return `v${highest + 1}`;
}

// ── Manifest (activate_status.json) ─────────────────────────────────────────

export function readActivateStatus(projectRoot: string): ActivateStatus {
  const filePath = activateStatusPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No Sigma project found at ${projectRoot}. Run: sigma project start`);
  }
  let raw: unknown;
  try {
    raw = fs.readJsonSync(filePath);
  } catch {
    throw new Error(`Failed to parse ${filePath} — file may be corrupted`);
  }
  const d = raw as Record<string, unknown>;
  if (!('active_chain' in d) || (d.active_chain !== null && typeof d.active_chain !== 'string')) {
    throw new Error(`${filePath} is malformed — expected { active_chain: string | null }`);
  }
  return { active_chain: d.active_chain as string | null };
}

export function writeActivateStatus(projectRoot: string, activeChain: string | null): void {
  const filePath = activateStatusPath(projectRoot);
  const tmpPath = `${filePath}.tmp`;
  const data: ActivateStatus = { active_chain: activeChain };
  fs.writeJsonSync(tmpPath, data, { spaces: 2 });
  fs.moveSync(tmpPath, filePath, { overwrite: true });
}

// ── Invariant: exactly one ACTIVE chain ─────────────────────────────────────

// PLAN-EVAL-01 §4 / DISCUSSION §12 — if active_chain is missing/invalid
// (points at a chain file that doesn't exist), auto-default to the highest
// chain_version whose intent is not SUPERSEDED, rather than hard-stopping.
// Throws only when there is truly no chain to default to (fresh project,
// before the first `intent new`).
//
// Deliberate extension beyond DISCUSSION §12's literal wording ("kosong" /
// "menunjuk ke chain yang tidak ada"): a stale pointer at an *existing but
// now-SUPERSEDED* chain is treated the same as an invalid one, not returned
// as-is. Reachable case: `intent supersede` on the currently active chain
// never touches activate_status.json (chain-file mutations don't reach into
// the manifest) — without this check, every command would keep resolving to
// a dead chain until someone ran `intent activate` manually, which
// contradicts DISCUSSION "Konsolidasi Lanjutan" bagian 6's "SUPERSEDED kebal
// permanen" being framed as a general property of SUPERSEDED chains, not
// just a constraint on the `activate` command specifically.
export function resolveActiveChainVersion(projectRoot: string): string {
  const existing = listChainVersions(projectRoot);
  if (existing.length === 0) {
    throw new Error('No DIR-INTENT exists yet. Run: sigma intent new');
  }

  let status: ActivateStatus;
  try {
    status = readActivateStatus(projectRoot);
  } catch {
    status = { active_chain: null };
  }

  if (status.active_chain && existing.includes(status.active_chain)) {
    const pointed = readChain(projectRoot, status.active_chain);
    if (pointed.intent.state !== 'SUPERSEDED') {
      return status.active_chain;
    }
  }

  // Auto-default: highest chain_version whose intent is not SUPERSEDED.
  // SUPERSEDED chains are permanently ineligible (PLAN-EVAL-01 §2 / DISCUSSION
  // "Konsolidasi Lanjutan" bagian 6) — reading each chain file just to check
  // its intent.state is unavoidable here since eligibility depends on content,
  // not just the filename.
  const sorted = [...existing].sort((a, b) => parseMajorVersion(b) - parseMajorVersion(a));
  for (const version of sorted) {
    const chain = readChain(projectRoot, version);
    if (chain.intent.state !== 'SUPERSEDED') return version;
  }

  throw new Error(
    'All existing DIR-INTENT chains are SUPERSEDED — no chain is eligible to become active. ' +
    'Run: sigma intent new'
  );
}

// ── Chain file read/write ───────────────────────────────────────────────────

export function readChain(projectRoot: string, chainVersion: string): ChainState {
  const filePath = chainFilePath(projectRoot, chainVersion);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Chain ${chainVersion} not found (no ${filePath} on disk). Run: sigma intent list`);
  }
  let raw: unknown;
  try {
    raw = fs.readJsonSync(filePath);
  } catch {
    throw new Error(`Failed to parse ${filePath} — file may be corrupted`);
  }
  // Structural validation only (existence + required top-level shape).
  // Semantic validation equivalent to validateProgressSemantics() is
  // PLAN-EVAL-01 Fase 1 work — not ported here yet.
  const d = raw as Record<string, unknown>;
  const required = ['schema_version', 'chain_version', 'intent', 'plan', 'exec', 'gates'];
  for (const field of required) {
    if (!(field in d)) {
      throw new Error(`${filePath} is missing required field: "${field}"`);
    }
  }
  return raw as ChainState;
}

export function writeChain(projectRoot: string, chainVersion: string, data: ChainState): void {
  const filePath = chainFilePath(projectRoot, chainVersion);
  const tmpPath = `${filePath}.tmp`;
  data.updated_at = new Date().toISOString();
  fs.writeJsonSync(tmpPath, data, { spaces: 2 });
  fs.moveSync(tmpPath, filePath, { overwrite: true });
}

// Combined helper — near drop-in replacement for readProgress() at call
// sites that operate on "whatever chain is currently active".
export function readActiveChain(projectRoot: string): { chainVersion: string; data: ChainState } {
  const chainVersion = resolveActiveChainVersion(projectRoot);
  return { chainVersion, data: readChain(projectRoot, chainVersion) };
}

// ── Project identity (separate from chain state, PLAN-EVAL-01 §3.3) ────────

export function readProjectIdentity(projectRoot: string): ProjectIdentity {
  const filePath = path.join(projectRoot, PROJECT_IDENTITY_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(`No Sigma project identity found at ${filePath}. Run: sigma project start`);
  }
  return fs.readJsonSync(filePath) as ProjectIdentity;
}

// ── Seed state ───────────────────────────────────────────────────────────────

// Replaces createInitialProgress() for the chain-file world. A ChainState is
// only ever created together with its (DRAFT) intent — see PLAN-EVAL-01 §4:
// `intent new` calls this once, with the artifact path it just wrote, rather
// than creating an empty shell and registering the intent as a second step
// (intent is non-nullable on ChainState, so there is no valid intermediate
// "shell with no intent" state).
export function createInitialChain(
  chainVersion: string,
  intentFilePath: string,
  title?: string,
  focus?: string,
): ChainState {
  const now = new Date().toISOString();
  return {
    schema_version: SCHEMA_VERSION,
    chain_version: chainVersion,
    created_at: now,
    updated_at: now,
    lifecycle_state: 'DESIGN',
    intent: {
      version: chainVersion,
      state: 'DRAFT',
      file: intentFilePath,
      created_at: now,
      updated_at: now,
      ...(title ? { title } : {}),
      ...(focus ? { focus } : {}),
    },
    roadmap: null,
    plan: { active_version: null, active_state: null, versions: [], pending: [] },
    exec: { active_version: null, active_state: null, versions: [] },
    close: null,
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

// ── Validation ───────────────────────────────────────────────────────────────
// PLAN-EVAL-01 Fase 1 — adapted from validateProgressSemantics()/validateTracker()
// in progress.ts for the single-object intent/roadmap/close shape. plan/exec
// validation logic is otherwise unchanged (still array trackers).

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

function recoveryHint(chainVersion: string, field: string): string {
  return (
    `Recovery: run \`sigma session bootstrap\`, inspect Sigma/progress-${chainVersion}.json field "${field}", ` +
    'then repair by recreating or superseding the affected artifact.'
  );
}

function semanticError(chainVersion: string, field: string, message: string): Error {
  return new Error(`Invalid progress-${chainVersion}.json state at ${field}: ${message}. ${recoveryHint(chainVersion, field)}`);
}

function validateSingleState(
  chain: ChainState,
  field: string,
  value: { state: string; created_at: string; updated_at: string; locked_at?: string; supersede_reason?: string } | null,
): void {
  if (value === null) return;
  if (!value.created_at || !value.updated_at) {
    throw semanticError(chain.chain_version, field, 'created_at and updated_at are required');
  }
  if (value.state === 'LOCKED' && !value.locked_at) {
    throw semanticError(chain.chain_version, `${field}.locked_at`, 'LOCKED entries must include locked_at');
  }
  if (value.state === 'SUPERSEDED' && !value.supersede_reason) {
    throw semanticError(chain.chain_version, field, 'SUPERSEDED entries must include supersede_reason');
  }
}

const PLAN_EXEC_TRACKER_STATES: Record<'plan' | 'exec', string[]> = {
  plan: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
  exec: ['DRAFT', 'LOCKED', 'SUPERSEDED'],
};

function validateTracker(chain: ChainState, domain: 'plan' | 'exec'): void {
  const tracker = chain[domain];
  const field = domain;

  if (typeof tracker !== 'object' || tracker === null) {
    throw semanticError(chain.chain_version, field, 'tracker block is malformed');
  }
  if (!Array.isArray(tracker.versions)) {
    throw semanticError(chain.chain_version, `${field}.versions`, 'versions must be an array');
  }
  if ((tracker.active_version === null) !== (tracker.active_state === null)) {
    throw semanticError(chain.chain_version, field, 'active_version and active_state must either both be set or both be null');
  }

  const seen = new Set<string>();
  for (const v of tracker.versions) {
    if (!v.version) throw semanticError(chain.chain_version, `${field}.versions`, 'version entry is missing version');
    if (seen.has(v.version)) throw semanticError(chain.chain_version, `${field}.versions`, `duplicate version "${v.version}"`);
    seen.add(v.version);

    if (!PLAN_EXEC_TRACKER_STATES[domain].includes(v.state)) {
      throw semanticError(chain.chain_version, `${field}.${v.version}.state`, `invalid state "${v.state}"`);
    }
    if (!v.created_at || !v.updated_at) {
      throw semanticError(chain.chain_version, `${field}.${v.version}`, 'created_at and updated_at are required');
    }
    if (v.state === 'LOCKED' && !v.locked_at) {
      throw semanticError(chain.chain_version, `${field}.${v.version}.locked_at`, 'LOCKED entries must include locked_at');
    }
    if (v.state === 'SUPERSEDED' && !v.supersede_reason) {
      throw semanticError(chain.chain_version, `${field}.${v.version}`, 'SUPERSEDED entries must include supersede_reason');
    }
  }

  if (tracker.active_version) {
    const matches = tracker.versions.filter(v => v.version === tracker.active_version);
    if (matches.length !== 1) {
      throw semanticError(chain.chain_version, `${field}.active_version`, `active version "${tracker.active_version}" is not present exactly once`);
    }
    if (matches[0].state !== tracker.active_state) {
      throw semanticError(
        chain.chain_version, `${field}.active_state`,
        `active_state "${tracker.active_state}" does not match active entry state "${matches[0].state}"`
      );
    }
  } else if (tracker.versions.some(v => v.state !== 'SUPERSEDED')) {
    throw semanticError(chain.chain_version, field, 'inactive tracker contains non-superseded versions');
  }
}

export function hasActiveLockedIntent(chain: ChainState): boolean {
  return chain.intent.state === 'LOCKED';
}

function hasActiveLockedPlan(chain: ChainState): boolean {
  return chain.plan.versions.some(v => v.state === 'LOCKED');
}

// PLAN-EVAL-01 §3.2 — plan.intent_version_ref is always the chain's own
// intent.version now (there is nothing else in this file it could point
// to); kept as a written field for defensive validation, not because it can
// vary.
export function hasCleanGate2Chain(chain: ChainState): boolean {
  return chain.intent.state === 'LOCKED' && chain.plan.versions.some(
    v => v.state === 'LOCKED' && v.intent_version_ref === chain.intent.version
  );
}

export function hasCleanGate3Chain(chain: ChainState): boolean {
  const activeExec = chain.exec.versions.find(
    v => v.version === chain.exec.active_version && v.state === 'LOCKED'
  );
  if (!activeExec?.plan_version_ref) return false;

  const referencedPlan = chain.plan.versions.find(
    v => v.version === activeExec.plan_version_ref && v.state === 'LOCKED'
  );
  if (!referencedPlan) return false;

  return chain.intent.state === 'LOCKED' && referencedPlan.intent_version_ref === chain.intent.version;
}

export function validateChainSemantics(chain: ChainState): void {
  if (chain.schema_version !== SCHEMA_VERSION && isNewerSchema(chain.schema_version, SCHEMA_VERSION)) {
    throw semanticError(
      chain.chain_version, 'schema_version',
      `schema_version "${chain.schema_version}" is newer than supported "${SCHEMA_VERSION}"`
    );
  }

  if (chain.intent.version !== chain.chain_version) {
    throw semanticError(chain.chain_version, 'intent.version', `must equal chain_version "${chain.chain_version}"`);
  }
  validateSingleState(chain, 'intent', chain.intent);
  validateSingleState(chain, 'roadmap', chain.roadmap);
  validateSingleState(chain, 'close', chain.close);
  validateTracker(chain, 'plan');
  validateTracker(chain, 'exec');

  for (const v of chain.plan.versions) {
    if (v.intent_version_ref && v.intent_version_ref !== chain.intent.version) {
      throw semanticError(
        chain.chain_version, 'plan.intent_version_ref',
        `PLAN ${v.version} references INTENT ${v.intent_version_ref}, but this chain's INTENT is ${chain.intent.version}`
      );
    }
  }

  const planVersions = new Set(chain.plan.versions.map(v => v.version));
  for (const v of chain.exec.versions) {
    if (v.plan_version_ref && !planVersions.has(v.plan_version_ref)) {
      throw semanticError(chain.chain_version, 'exec.plan_version_ref', `EXEC ${v.version} references missing PLAN ${v.plan_version_ref}`);
    }
  }

  if (chain.gates.gate_1_open && !hasActiveLockedIntent(chain)) {
    throw semanticError(chain.chain_version, 'gates.gate_1_open', 'gate is open without a LOCKED INTENT');
  }
  if (chain.gates.gate_2_open && !hasActiveLockedPlan(chain)) {
    throw semanticError(chain.chain_version, 'gates.gate_2_open', 'gate is open without a LOCKED PLAN');
  }
  if (chain.gates.gate_3_satisfied && !hasCleanGate3Chain(chain)) {
    throw semanticError(chain.chain_version, 'gates.gate_3_satisfied', 'gate is satisfied without a clean INTENT -> PLAN -> EXEC chain');
  }
}

// ── Invalid Runtime / Gate Queries ──────────────────────────────────────────
// Unchanged in spirit from progress.ts — operates on `gates` +
// `runtime_invalid`, neither of which changed shape.

function ensureRuntimeInvalid(chain: ChainState): RuntimeInvalidState {
  if (!chain.runtime_invalid || !Array.isArray(chain.runtime_invalid.markers)) {
    chain.runtime_invalid = { markers: [], last_doctor_run_at: null };
  }
  return chain.runtime_invalid;
}

export function hasInvalidRuntime(chain: ChainState): boolean {
  return ensureRuntimeInvalid(chain).markers.length > 0;
}

export function getInvalidMarkers(chain: ChainState): InvalidMarker[] {
  return ensureRuntimeInvalid(chain).markers;
}

export function isGateInvalid(chain: ChainState, gate: InvalidGateKey): boolean {
  const markers = getInvalidMarkers(chain);
  if (markers.some(marker => marker.gate === gate)) return true;

  const impactedDomains: Record<InvalidGateKey, InvalidMarkerDomain[]> = {
    gate_1_open: ['intent', 'gates'],
    gate_2_open: ['intent', 'plan', 'gates'],
    gate_3_satisfied: ['intent', 'plan', 'exec', 'gates'],
  };

  return markers.some(marker => impactedDomains[gate].includes(marker.domain));
}

export function getGateStatusLabel(chain: ChainState, gate: InvalidGateKey): 'OPEN' | 'BLOCKED' | 'SATISFIED' | 'INVALID' {
  if (isGateInvalid(chain, gate)) return 'INVALID';
  if (gate === 'gate_3_satisfied') return chain.gates.gate_3_satisfied ? 'SATISFIED' : 'BLOCKED';
  return chain.gates[gate] ? 'OPEN' : 'BLOCKED';
}

export function getOperationalGate(chain: ChainState, gate: InvalidGateKey): boolean {
  return chain.gates[gate] || isGateInvalid(chain, gate);
}

export function getInvalidWarningLines(chain: ChainState): string[] {
  return getInvalidMarkers(chain).map(marker => {
    const scope = [
      marker.chain.intent_version ? `INTENT ${marker.chain.intent_version}` : null,
      marker.chain.plan_version ? `PLAN ${marker.chain.plan_version}` : null,
      marker.chain.exec_version ? `EXEC ${marker.chain.exec_version}` : null,
    ].filter(Boolean).join(' -> ');

    const scopeLabel = scope.length > 0 ? ` (${scope})` : '';
    return `${marker.domain.toUpperCase()}${scopeLabel}: ${marker.reason}`;
  });
}

export function assertChainCanMutate(chain: ChainState): void {
  if (hasInvalidRuntime(chain)) {
    process.stderr.write(
      `WARNING: Sigma runtime is in INVALID recovery mode for chain ${chain.chain_version}. ` +
      'Normal gate enforcement is temporarily relaxed. Run `sigma doctor` to re-check recovery.\n'
    );
    return;
  }
  validateChainSemantics(chain);
}

export function getGateStatus(chain: ChainState): Gates {
  return {
    gate_1_open: chain.gates.gate_1_open,
    gate_2_open: chain.gates.gate_2_open,
    gate_3_satisfied: chain.gates.gate_3_satisfied,
  };
}

// ── Doctor Reconciliation ────────────────────────────────────────────────────
// PLAN-EVAL-01 Fase 1 — adapted from runDoctorReconciliation() in progress.ts.
// Two repair heuristics from the original do NOT carry over, both because the
// scenario they existed for cannot happen within a single ChainState anymore:
//   - active_version/active_state mismatch repair for intent/roadmap/close —
//     those domains have no active_version pairing once they're single
//     objects (only plan/exec still have it).
//   - the "stranded reopen of CLOSED" repair — that heuristic modeled
//     relocking a new major INTENT inside the SAME array while the old one
//     was still around. Under Opsi C every new major INTENT is a brand-new
//     chain file (`intent new`), never a re-lock inside an existing one, so
//     the scenario this repaired is now structurally impossible.

export interface DoctorReport {
  repaired: string[];
  invalidMarked: InvalidMarker[];
  invalidCleared: InvalidMarker[];
  remainingInvalid: InvalidMarker[];
}

function markerChain(
  intentVersion: string | null = null,
  planVersion: string | null = null,
  execVersion: string | null = null,
): InvalidChainRef {
  return { intent_version: intentVersion, plan_version: planVersion, exec_version: execVersion };
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

export function runDoctorReconciliation(chain: ChainState, overrides: OverrideEntry[] = []): DoctorReport {
  const runtimeInvalid = ensureRuntimeInvalid(chain);
  const previous = new Map(runtimeInvalid.markers.map(marker => [marker.id, marker]));
  const nextMarkers: InvalidMarker[] = [];
  const repaired: string[] = [];
  const now = new Date().toISOString();

  // Auto-repair the known exec-new corruption pattern: a LOCKED exec and a
  // later DRAFT exec share the same version key. Unchanged from progress.ts.
  const execVersionsByKey = new Map<string, ArtifactVersion[]>();
  for (const version of chain.exec.versions) {
    const versions = execVersionsByKey.get(version.version) ?? [];
    versions.push(version);
    execVersionsByKey.set(version.version, versions);
  }
  for (const [version, versions] of execVersionsByKey) {
    if (versions.some(v => v.state === 'LOCKED') && versions.some(v => v.state === 'DRAFT')) {
      const before = chain.exec.versions.length;
      chain.exec.versions = chain.exec.versions.filter(v => !(v.version === version && v.state === 'DRAFT'));
      const removed = before - chain.exec.versions.length;
      if (removed > 0) {
        repaired.push(`exec.versions removed ${removed} duplicate DRAFT entr${removed === 1 ? 'y' : 'ies'} for "${version}" because a LOCKED entry exists`);
        if (chain.exec.active_version === version) {
          chain.exec.active_state = 'LOCKED';
        }
      }
    }
  }

  // Auto-repair tracker active_state mismatches — plan/exec only now.
  for (const domain of ['plan', 'exec'] as const) {
    const tracker = chain[domain];
    if (!tracker.active_version) continue;
    const matches = tracker.versions.filter(v => v.version === tracker.active_version);
    if (matches.length === 1 && matches[0].state !== tracker.active_state) {
      repaired.push(`${domain}.active_state repaired from "${tracker.active_state}" to "${matches[0].state}"`);
      tracker.active_state = matches[0].state;
    }
  }

  // Auto-repair gate booleans to match actual runtime conditions, unless a
  // still-active override is the reason the gate is forced open.
  const hasActiveOverrideForGate = (gateLabel: string): boolean =>
    overrides.some(entry => {
      if (entry.gate_bypassed !== gateLabel) return false;
      if (entry.artifact === 'DIR-INTENT') {
        return entry.version ? entry.version === chain.intent.version && chain.intent.state === 'DRAFT' : chain.intent.state === 'DRAFT';
      }
      if (entry.artifact === 'FMN-PLAN' || entry.artifact === 'DEV-EXEC') {
        const domain = entry.artifact === 'FMN-PLAN' ? chain.plan : chain.exec;
        if (entry.version) {
          const v = domain.versions.find(x => x.version === entry.version);
          return !!v && v.state === 'DRAFT';
        }
        return !domain.versions.some(v => v.state !== 'DRAFT');
      }
      return false;
    });

  const expectedGate1 = hasActiveLockedIntent(chain) || hasActiveOverrideForGate('Gate 1');
  if (chain.gates.gate_1_open !== expectedGate1) {
    repaired.push(`gates.gate_1_open repaired from "${chain.gates.gate_1_open}" to "${expectedGate1}"`);
    chain.gates.gate_1_open = expectedGate1;
  }

  const expectedGate2 = hasCleanGate2Chain(chain) || hasActiveOverrideForGate('Gate 2');
  if (chain.gates.gate_2_open !== expectedGate2) {
    repaired.push(`gates.gate_2_open repaired from "${chain.gates.gate_2_open}" to "${expectedGate2}"`);
    chain.gates.gate_2_open = expectedGate2;
  }

  const expectedGate3 = hasCleanGate3Chain(chain) || hasActiveOverrideForGate('Gate 3');
  if (chain.gates.gate_3_satisfied !== expectedGate3) {
    repaired.push(`gates.gate_3_satisfied repaired from "${chain.gates.gate_3_satisfied}" to "${expectedGate3}"`);
    chain.gates.gate_3_satisfied = expectedGate3;
  }

  // active-pair consistency markers — plan/exec only now (see header note).
  for (const domain of ['plan', 'exec'] as const) {
    const tracker = chain[domain];
    const gateKey: InvalidGateKey = domain === 'plan' ? 'gate_2_open' : 'gate_3_satisfied';

    if ((tracker.active_version === null) !== (tracker.active_state === null)) {
      nextMarkers.push(buildMarker(previous, now, {
        id: `${domain}:active-pair`,
        domain,
        reason: 'active_version and active_state are not paired consistently',
        gate: gateKey,
        chain: markerChain(null, domain === 'plan' ? tracker.active_version : null, domain === 'exec' ? tracker.active_version : null),
      }));
    }

    if (tracker.active_version) {
      const matches = tracker.versions.filter(v => v.version === tracker.active_version);
      if (matches.length !== 1) {
        nextMarkers.push(buildMarker(previous, now, {
          id: `${domain}:active-version:${tracker.active_version}`,
          domain,
          reason: `active version "${tracker.active_version}" is not present exactly once`,
          gate: gateKey,
          chain: markerChain(null, domain === 'plan' ? tracker.active_version : null, domain === 'exec' ? tracker.active_version : null),
        }));
      }
    } else if (tracker.versions.some(v => v.state !== 'SUPERSEDED')) {
      nextMarkers.push(buildMarker(previous, now, {
        id: `${domain}:inactive-live-versions`,
        domain,
        reason: 'tracker has no active version while non-superseded versions still exist',
        gate: gateKey,
        chain: markerChain(),
      }));
    }
  }

  for (const version of chain.plan.versions) {
    if (version.intent_version_ref && version.intent_version_ref !== chain.intent.version) {
      nextMarkers.push(buildMarker(previous, now, {
        id: `plan-ref:${version.version}:${version.intent_version_ref}`,
        domain: 'plan',
        reason: `PLAN ${version.version} references INTENT ${version.intent_version_ref}, but this chain's INTENT is ${chain.intent.version}`,
        gate: 'gate_2_open',
        chain: markerChain(version.intent_version_ref, version.version, null),
      }));
    }
  }

  const planVersions = new Set(chain.plan.versions.map(v => v.version));
  for (const version of chain.exec.versions) {
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

  return { repaired, invalidMarked, invalidCleared, remainingInvalid: nextMarkers };
}

// ── Chain/Plan/Exec Version Helpers ─────────────────────────────────────────
// PLAN-EVAL-01 §5 — unchanged logic, retyped for ChainState.
// parseMajorVersion/parseMinorVersion themselves live near the top of this
// file (relocated from progress.ts, PLAN-EVAL-05) — they never touched
// ProgressJson/ChainState shape at all.

// PLAN major = INTENT major − 1; minor starts at 1
export function nextPlanVersion(chain: ChainState, intentVersionRef: string): string {
  const planMajor = parseMajorVersion(intentVersionRef) - 1;
  const existingUnderMajor = chain.plan.versions.filter(
    v => parseMajorVersion(v.version) === planMajor
  );
  return `v${planMajor}.${existingUnderMajor.length + 1}`;
}

// EXEC major must equal PLAN major; minor starts at 1
export function nextExecVersion(chain: ChainState, planVersionRef: string): string {
  const execMajor = parseMajorVersion(planVersionRef);
  const highestExecMinor = chain.exec.versions
    .filter(v => parseMajorVersion(v.version) === execMajor)
    .reduce((highest, v) => Math.max(highest, parseMinorVersion(v.version)), 0);
  const planMinorFloor = parseMinorVersion(planVersionRef) - 1;
  const nextMinor = Math.max(highestExecMinor, planMinorFloor, 0) + 1;
  return `v${execMajor}.${nextMinor}`;
}

// ── INTENT Mutations ──────────────────────────────────────────────────────────
// No registerIntentDraft() here — unlike progress.ts, a ChainState is only
// ever created together with its (DRAFT) intent (see createInitialChain()
// above). There is no valid scenario for adding an intent draft to an
// already-existing chain, so that step of the old two-step
// (createInitialProgress + registerIntentDraft) collapses into one.

export function lockActiveIntent(chain: ChainState): void {
  const now = new Date().toISOString();
  if (chain.intent.state !== 'DRAFT') {
    throw new Error(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; lock requires DRAFT`);
  }

  chain.intent.state = 'LOCKED';
  chain.intent.locked_at = now;
  chain.intent.updated_at = now;

  chain.gates.gate_1_open = true;
  chain.lifecycle_state = 'BUILD';

  // Recompute from this chain's own PLAN/EXEC — matches lockActiveIntent()'s
  // reopen/pivot behavior in progress.ts, minus the INACTIVE-demotion loop
  // (PLAN-EVAL-01 §3.4 — nothing else in this file to demote).
  chain.gates.gate_2_open = hasCleanGate2Chain(chain);
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}

export interface IntentCascadeTargets {
  roadmap: SingleRoadmapState | null;
  plan: ArtifactVersion[];
  exec: ArtifactVersion[];
  close: SingleCloseState | null;
}

// Read-only preflight for `sigma intent supersede` — mirrors
// previewIntentSupersedeCascade() in progress.ts. No `version` parameter:
// there is only ever one intent in a chain file, so "which version" is
// always this chain's own.
export function previewIntentSupersedeCascade(chain: ChainState): IntentCascadeTargets {
  return {
    roadmap: chain.roadmap && chain.roadmap.state !== 'SUPERSEDED' ? chain.roadmap : null,
    plan: chain.plan.versions.filter(v => v.state !== 'SUPERSEDED'),
    exec: chain.exec.versions.filter(v => v.state !== 'SUPERSEDED'),
    close: chain.close && chain.close.state !== 'SUPERSEDED' ? chain.close : null,
  };
}

export function supersedeIntentVersion(chain: ChainState, reason: string): void {
  const now = new Date().toISOString();
  if (chain.intent.state !== 'LOCKED') {
    throw new Error(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; supersede requires LOCKED`);
  }

  const cascade = previewIntentSupersedeCascade(chain);

  chain.intent.state = 'SUPERSEDED';
  chain.intent.supersede_reason = reason;
  chain.intent.updated_at = now;

  const cascadeReason = `Cascade: DIR-INTENT ${chain.intent.version} superseded — ${reason}`;

  if (cascade.roadmap) {
    chain.roadmap!.state = 'SUPERSEDED';
    chain.roadmap!.supersede_reason = cascadeReason;
    chain.roadmap!.updated_at = now;
  }
  for (const pv of cascade.plan) {
    pv.state = 'SUPERSEDED';
    pv.supersede_reason = cascadeReason;
    pv.updated_at = now;
    if (chain.plan.active_version === pv.version) chain.plan.active_state = 'SUPERSEDED';
  }
  for (const ev of cascade.exec) {
    ev.state = 'SUPERSEDED';
    ev.supersede_reason = cascadeReason;
    ev.updated_at = now;
    if (chain.exec.active_version === ev.version) chain.exec.active_state = 'SUPERSEDED';
  }
  if (cascade.close) {
    chain.close!.state = 'SUPERSEDED';
    chain.close!.supersede_reason = cascadeReason;
    chain.close!.updated_at = now;
  }
}

// ── ROADMAP Mutations ─────────────────────────────────────────────────────────
// No activateRoadmap() — PLAN-EVAL-01 §3.5: removed, there is never a second
// DRAFT roadmap in the same chain to activate. `roadmap lock` stays a
// separate manual command, unchanged in spirit from today (PLAN-EVAL-04
// owns any future auto-cascade-on-close behavior — not implemented here).

export function registerRoadmapDraft(chain: ChainState, filePath: string): void {
  if (chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED') {
    throw new Error(
      `ROADMAP already exists for this chain (${chain.roadmap.version}, ${chain.roadmap.state}). ` +
      'To create a new roadmap, create a new INTENT (chain) first.'
    );
  }
  const now = new Date().toISOString();
  chain.roadmap = {
    version: chain.chain_version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
  };
}

export function lockActiveRoadmap(chain: ChainState): void {
  if (!chain.roadmap) throw new Error('No ROADMAP found. Run: sigma roadmap new');
  if (chain.roadmap.state !== 'DRAFT') {
    throw new Error(`ROADMAP ${chain.roadmap.version} is in state "${chain.roadmap.state}"; lock requires DRAFT`);
  }
  const now = new Date().toISOString();
  chain.roadmap.state = 'LOCKED';
  chain.roadmap.locked_at = now;
  chain.roadmap.updated_at = now;
}

// ── PLAN Mutations ────────────────────────────────────────────────────────────
// Unchanged logic from progress.ts — plan stays an array tracker, retyped
// for ChainState.

export function registerPlanDraft(
  chain: ChainState,
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
  chain.plan.versions.push(entry);
  chain.plan.active_version = version;
  chain.plan.active_state = 'DRAFT';
}

export function updatePlanMetadata(chain: ChainState, version: string, title?: string, focus?: string): void {
  const entry = chain.plan.versions.find(v => v.version === version);
  if (!entry) throw new Error(`FMN-PLAN ${version} not found. Run: sigma plan list`);
  if (title !== undefined) entry.title = title;
  if (focus !== undefined) entry.focus = focus;
  entry.updated_at = new Date().toISOString();
}

export function lockOldestPlanDraft(chain: ChainState): string {
  const drafts = chain.plan.versions
    .filter(v => v.state === 'DRAFT')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (drafts.length === 0) throw new Error('No DRAFT FMN-PLAN to lock. Run: sigma plan new');

  const oldest = drafts[0];
  const now = new Date().toISOString();
  oldest.state = 'LOCKED';
  oldest.locked_at = now;
  oldest.updated_at = now;

  chain.plan.active_version = oldest.version;
  chain.plan.active_state = 'LOCKED';
  chain.gates.gate_2_open = true;

  return oldest.version;
}

export function registerPendingPlan(chain: ChainState, id: string, filePath: string, title?: string, focus?: string): void {
  const now = new Date().toISOString();
  const entry: PendingPlanEntry = { id, file: filePath, created_at: now };
  if (title) entry.title = title;
  if (focus) entry.focus = focus;
  chain.plan.pending.push(entry);
}

export function promotePendingPlan(
  chain: ChainState,
  id: string,
  version: string,
  newFilePath: string,
  intentVersionRef: string,
  title?: string,
  focus?: string,
): void {
  const idx = chain.plan.pending.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Pending plan ID "${id}" not found`);

  const pending = chain.plan.pending[idx];
  chain.plan.pending.splice(idx, 1);

  const now = new Date().toISOString();
  const entry: ArtifactVersion = {
    version, state: 'DRAFT', file: newFilePath,
    created_at: pending.created_at,
    updated_at: now,
    intent_version_ref: intentVersionRef,
  };
  entry.title = title ?? pending.title;
  entry.focus = focus ?? pending.focus;
  chain.plan.versions.push(entry);
  chain.plan.active_version = version;
  chain.plan.active_state = 'DRAFT';
}

export function supersedePlanVersion(chain: ChainState, version: string, reason: string): void {
  const now = new Date().toISOString();
  const target = chain.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`PLAN version ${version} not found`);
  if (target.state !== 'LOCKED') throw new Error(`PLAN ${version} is not LOCKED; cannot supersede`);
  target.state = 'SUPERSEDED';
  target.supersede_reason = reason;
  target.updated_at = now;

  if (chain.plan.active_version === version) {
    chain.plan.active_state = 'SUPERSEDED';
  }

  const cascadeReason = `Cascade: FMN-PLAN ${version} superseded — ${reason}`;
  for (const exec of chain.exec.versions) {
    if (exec.plan_version_ref === version && exec.state !== 'SUPERSEDED') {
      exec.state = 'SUPERSEDED';
      exec.supersede_reason = cascadeReason;
      exec.updated_at = now;
      if (chain.exec.active_version === exec.version) {
        chain.exec.active_state = 'SUPERSEDED';
      }
    }
  }
}

export function activatePlanDraft(chain: ChainState, version: string): void {
  const target = chain.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`PLAN version ${version} not found`);
  if (target.state !== 'DRAFT') {
    throw new Error(
      `PLAN ${version} is in state "${target.state}"; activate requires a DRAFT version. ` +
      `Use 'sigma plan supersede' to supersede a LOCKED version instead.`
    );
  }
  chain.plan.active_version = version;
  chain.plan.active_state = 'DRAFT';
}

// ── EXEC Mutations ────────────────────────────────────────────────────────────
// Unchanged logic from progress.ts — exec stays an array tracker, retyped
// for ChainState.

export function registerExecDraft(chain: ChainState, version: string, filePath: string, planVersionRef: string): void {
  const execMajor = parseMajorVersion(version);
  const planMajor = parseMajorVersion(planVersionRef);
  if (chain.exec.versions.some(v => v.version === version)) {
    throw new Error(`Duplicate DEV-EXEC version "${version}" already exists in progress-${chain.chain_version}.json`);
  }
  if (execMajor !== planMajor) {
    throw new Error(
      `Version sync error: DEV-EXEC ${version} (major ${execMajor}) does not match FMN-PLAN ${planVersionRef} (major ${planMajor}). ` +
      `EXEC major must equal PLAN major. Valid EXEC versions: v${planMajor}.1, v${planMajor}.2, ...`
    );
  }
  const now = new Date().toISOString();
  chain.exec.versions.push({
    version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
    plan_version_ref: planVersionRef,
  });
  chain.exec.active_version = version;
  chain.exec.active_state = 'DRAFT';
  chain.gates.gate_3_satisfied = false;
}

export function lockActiveExec(chain: ChainState): void {
  const now = new Date().toISOString();
  const activeVersion = chain.exec.active_version;
  if (!activeVersion) throw new Error('No active EXEC version to lock');

  const active = chain.exec.versions.find(v => v.version === activeVersion);
  if (!active) throw new Error(`EXEC version ${activeVersion} not found`);
  active.state = 'LOCKED';
  active.locked_at = now;
  active.updated_at = now;

  chain.exec.active_state = 'LOCKED';
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}

// ── CLOSE Mutations ───────────────────────────────────────────────────────────

export function registerCloseDraft(chain: ChainState, filePath: string): void {
  // 1:1 guard, mirroring registerRoadmapDraft() above.
  if (chain.close !== null && chain.close.state !== 'SUPERSEDED') {
    throw new Error(
      `DIR-CLOSE already exists for this chain (${chain.close.version}, ${chain.close.state}). ` +
      'Resolve or lock the existing DIR-CLOSE first.'
    );
  }
  const now = new Date().toISOString();
  chain.close = {
    version: chain.chain_version, state: 'DRAFT', file: filePath,
    created_at: now, updated_at: now,
  };
  chain.lifecycle_state = 'CLOSE';
}

export function lockActiveClose(chain: ChainState): void {
  if (!chain.close) throw new Error('No CLOSE draft found. Run: sigma close new');
  if (chain.close.state !== 'DRAFT') {
    throw new Error(`CLOSE ${chain.close.version} is in state "${chain.close.state}"; lock requires DRAFT`);
  }
  const now = new Date().toISOString();
  chain.close.state = 'LOCKED';
  chain.close.locked_at = now;
  chain.close.updated_at = now;
  chain.lifecycle_state = 'CLOSED';
}

// ── Next Valid Operations ────────────────────────────────────────────────────
// Adapted from getNextValidOperations() in progress.ts — roadmap ACTIVE/DRAFT
// arbitration collapses to "exists and not SUPERSEDED" (PLAN-EVAL-01 §3.5);
// no more `roadmap activate` suggestion (command removed).

export function getNextValidOperations(chain: ChainState): string[] {
  const ops: string[] = [];
  const intentLocked = chain.intent.state === 'LOCKED';
  const planLocked = chain.plan.active_state === 'LOCKED';
  const roadmapExists = chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED';

  if (chain.intent.state === 'DRAFT') {
    ops.push('intent lock');
  }

  if (intentLocked && !roadmapExists) {
    ops.push('roadmap new');
  }

  if (intentLocked && roadmapExists) {
    ops.push('plan new');
  }
  const draftPlans = chain.plan.versions.filter(v => v.state === 'DRAFT');
  if (draftPlans.length > 0) {
    const oldest = draftPlans.sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    ops.push(`plan lock    # will lock ${oldest.version} (oldest DRAFT)`);
  }
  if (chain.plan.pending.length > 0) {
    ops.push('plan queue');
  }

  if (planLocked) {
    ops.push('exec new');
  }

  if (chain.lifecycle_state === 'BUILD' && chain.gates.gate_3_satisfied) {
    ops.push('close new');
  }
  if (chain.close?.state === 'DRAFT') {
    ops.push('close lock');
  }

  ops.push('session bootstrap');
  ops.push('project status');

  return ops;
}
