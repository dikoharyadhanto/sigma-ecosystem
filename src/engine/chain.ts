import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { PROJECT_SIGMA_DIR, PROJECT_IDENTITY_FILE, ACTIVATE_STATUS_FILE, OVERRIDES_FILE, SCHEMA_VERSION } from '../config';

// PLAN-EVAL-01 (Core Storage & Schema Migration, Opsi C) — foundation module.
// `intent`/`roadmap`/`close` are single objects per chain file here (not
// arrays) — schema decisions and rationale in
// PLAN-EVAL-01-CORE-STORAGE-SCHEMA-MIGRATION.md §3, retrievable via git
// history (not a live path). `plan`/`exec` keep the exact
// `PlanTracker`/`ArtifactTracker` shape — unchanged.
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
// Rename doctrinal (Discussion 2026-08-11_0115 §3 item 1, Director directive
// 2026-08-12): ratification establishes the governing Director intent — it
// does not freeze its operationalization. Only DIR-INTENT uses RATIFIED;
// Roadmap/Plan/Exec/Close keep LOCKED.
export type IntentState = 'DRAFT' | 'RATIFIED' | 'SUPERSEDED';
// PLAN-EVAL-01 §3.5 — ACTIVE/INACTIVE dropped: nothing to arbitrate with a
// single roadmap object per chain. `roadmap lock` stays a manual command
// (PLAN-EVAL-04 scope, not implemented here) — this is a structural-only
// change.
export type RoadmapState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
export type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';

// Amendment mechanism (Discussion 2026-08-11_0115, Director directive 2026-08-12).
// One entry per `sigma intent amendment` call — append-only, rendered into
// DIR-INTENT Section 14 (Amendment History) by generateAmendmentHistory().
export interface AmendmentEntry {
  id: string;                    // "AMD-001" — zero-padded, PREFIX-NNN
  created_at: string;            // ISO, stamped when the command runs
  change: string;                // free-text, commit-message style
  // ISO, the instant Director authorized this amendment to run. Currently
  // always equal to created_at (both stamped at command execution) — kept
  // as a separate field because they answer different questions ("when was
  // this recorded" vs. "when was this authorized"); a future asynchronous
  // approval flow would need them to diverge without a schema migration.
  director_approved_at: string;
}

export interface SingleIntentState {
  version: string; // == chain_version, always
  state: IntentState;
  file?: string;
  created_at: string;
  updated_at: string;
  ratified_at?: string; // renamed from locked_at (Director directive 2026-08-12) — see readChain() normalization
  supersede_reason?: string;
  title?: string; // PLAN-EVAL-06 — rendered into Sigma/design/intent-history.md
  focus?: string; // PLAN-EVAL-06 — rendered into Sigma/design/intent-history.md
  // superseded_by intentionally omitted — PLAN-EVAL-01 §3.4: cross-chain
  // succession would require a chain-file mutation to know about another
  // chain's file, which breaks total isolation. `intent list` (projection
  // across all chain files) is the source of truth for succession order.
  arc_score?: number; // 0-100, raw — internal ARC reasoning number (closure-authority PLAN-EVAL-02)
  arc_score_notes?: string; // free-text rationale, same sanitization as title/focus
  arc_score_updated_at?: string; // ISO timestamp of last `sigma intent score`
  // Amendment mechanism — all optional, chain files predating this feature
  // stay valid without migration.
  amendments?: AmendmentEntry[];       // append-only; source for Section 14 render
  effective_amendment?: string | null; // last AMD-NNN this doc was certified against; null = certified at ratification, no amendment yet
  certified_doc_sha256?: string;       // SHA-256 of the DIR-INTENT file at last ratify/amendment
  certified_at?: string;               // ISO — when certified_doc_sha256 was last stamped
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
  // In-memory only — never written to disk (writeChain() strips it before
  // serializing). Set by readChain() when it normalizes a legacy on-disk
  // value (e.g. intent.state "LOCKED" → "RATIFIED") so runDoctorReconciliation()
  // can surface the conversion in report.repaired[] instead of silently
  // seeing an already-normalized chain and reporting nothing.
  _migratedOnRead?: string[];
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

// Backward compatibility for chain files written before the RATIFIED rename
// (Director directive 2026-08-12): normalizes intent.state "LOCKED"/"INACTIVE"
// (the latter only from very old legacy-migrated files) to "RATIFIED", and
// intent.locked_at to intent.ratified_at. This is the single choke point —
// every chain read goes through readChain(), so no second read path can miss
// it. Records what it changed on chain._migratedOnRead (in-memory only) so
// runDoctorReconciliation() can report the conversion instead of seeing an
// already-normalized chain and reporting nothing (§3.7 of the RATIFIED plan).
// The file on disk itself is only rewritten once something actually calls
// writeChain() — normalization here does not touch disk.
function normalizeIntentStateOnRead(chain: ChainState): void {
  const migrated: string[] = [];
  const legacyState = chain.intent.state as string;
  if (legacyState === 'LOCKED' || legacyState === 'INACTIVE') {
    chain.intent.state = 'RATIFIED';
    migrated.push(`intent.state "${legacyState}" → "RATIFIED"`);
  }
  const legacyLockedAt = (chain.intent as unknown as Record<string, unknown>).locked_at as string | undefined;
  if (legacyLockedAt && !chain.intent.ratified_at) {
    chain.intent.ratified_at = legacyLockedAt;
    migrated.push('intent.locked_at → intent.ratified_at');
  }
  delete (chain.intent as unknown as Record<string, unknown>).locked_at;
  if (migrated.length > 0) {
    chain._migratedOnRead = migrated;
  }
}

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
  const chain = raw as ChainState;
  normalizeIntentStateOnRead(chain);
  return chain;
}

export function writeChain(projectRoot: string, chainVersion: string, data: ChainState): void {
  const filePath = chainFilePath(projectRoot, chainVersion);
  const tmpPath = `${filePath}.tmp`;
  data.updated_at = new Date().toISOString();
  delete data._migratedOnRead; // in-memory only — never persisted
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
  value: { state: string; created_at: string; updated_at: string; locked_at?: string; ratified_at?: string; supersede_reason?: string } | null,
): void {
  if (value === null) return;
  if (!value.created_at || !value.updated_at) {
    throw semanticError(chain.chain_version, field, 'created_at and updated_at are required');
  }
  // intent uses RATIFIED/ratified_at (Director directive 2026-08-12); roadmap/close keep LOCKED/locked_at.
  if (field === 'intent') {
    if (value.state === 'RATIFIED' && !value.ratified_at) {
      throw semanticError(chain.chain_version, `${field}.ratified_at`, 'RATIFIED entries must include ratified_at');
    }
  } else if (value.state === 'LOCKED' && !value.locked_at) {
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

export function hasRatifiedIntent(chain: ChainState): boolean {
  return chain.intent.state === 'RATIFIED';
}

function hasActiveLockedPlan(chain: ChainState): boolean {
  return chain.plan.versions.some(v => v.state === 'LOCKED');
}

// PLAN-EVAL-01 §3.2 — plan.intent_version_ref is always the chain's own
// intent.version now (there is nothing else in this file it could point
// to); kept as a written field for defensive validation, not because it can
// vary.
export function hasCleanGate2Chain(chain: ChainState): boolean {
  return chain.intent.state === 'RATIFIED' && chain.plan.versions.some(
    v => v.state === 'LOCKED' && v.intent_version_ref === chain.intent.version
  );
}

// PLAN-IMPL-MULTIDRAFT-LOCK §7.1 (Director directive 2026-08-12) — replaces
// the old single-chain definition ("the exec pointed to by active_version is
// LOCKED and its plan is LOCKED"), which broke down once concurrent
// workstreams became possible (registering a second DRAFT exec silently
// wiped out a Gate 3 that was already satisfied for an unrelated plan — see
// the plan's §1.1). No longer reads active_version at all: "INTENT is
// RATIFIED, nothing is left in DRAFT in either domain, and every LOCKED
// plan has exactly one LOCKED exec pointing at it." SUPERSEDED plans are
// ignored entirely, with or without an exec — Director's explicit call.
export function hasCleanGate3Chain(chain: ChainState): boolean {
  if (chain.intent.state !== 'RATIFIED') return false;

  if (chain.plan.versions.some(v => v.state === 'DRAFT')) return false;
  if (chain.exec.versions.some(v => v.state === 'DRAFT')) return false;

  const activePlans = chain.plan.versions.filter(v => v.state === 'LOCKED');
  if (activePlans.length === 0) return false;

  return activePlans.every(plan => {
    if (plan.intent_version_ref !== chain.intent.version) return false;
    const pairs = chain.exec.versions.filter(
      e => e.state === 'LOCKED' && e.plan_version_ref === plan.version
    );
    return pairs.length === 1;
  });
}

// PLAN-IMPL-MULTIDRAFT-LOCK §11 (Director directive 2026-08-12) — Gate 3's
// combined condition (§7.1 above) can fail for several independent
// reasons at once now that concurrent workstreams are possible. A bare
// "GATE 3 BLOCKED" forces the Director to guess; this names every entry
// that is actually holding the gate closed, so `sigma close new` can
// report it directly instead of the reader re-deriving it by hand.
export function describeGate3Blockers(chain: ChainState): string[] {
  const reasons: string[] = [];
  if (chain.intent.state !== 'RATIFIED') {
    reasons.push(`DIR-INTENT ${chain.intent.version} is not RATIFIED`);
  }
  for (const p of chain.plan.versions) {
    if (p.state === 'DRAFT') reasons.push(`DRAFT FMN-PLAN: ${p.version}`);
  }
  for (const e of chain.exec.versions) {
    if (e.state === 'DRAFT') reasons.push(`DRAFT DEV-EXEC: ${e.version} (plan ${e.plan_version_ref ?? '—'})`);
  }
  const lockedPlans = chain.plan.versions.filter(p => p.state === 'LOCKED');
  if (lockedPlans.length === 0 && reasons.length === 0) {
    reasons.push('no LOCKED FMN-PLAN exists yet');
  }
  for (const p of lockedPlans) {
    const pairs = chain.exec.versions.filter(e => e.state === 'LOCKED' && e.plan_version_ref === p.version);
    if (pairs.length === 0) {
      reasons.push(`FMN-PLAN ${p.version} is LOCKED but has no LOCKED DEV-EXEC`);
    } else if (pairs.length > 1) {
      reasons.push(`FMN-PLAN ${p.version} has more than one LOCKED DEV-EXEC (${pairs.map(e => e.version).join(', ')}) — should be structurally impossible, run: sigma doctor`);
    }
  }
  return reasons;
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

  if (chain.gates.gate_1_open && !hasRatifiedIntent(chain)) {
    throw semanticError(chain.chain_version, 'gates.gate_1_open', 'gate is open without a RATIFIED INTENT');
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

  // Migrate the RATIFIED rename (Director directive 2026-08-12) from
  // in-memory-only to persisted-on-disk. readChain() already normalized
  // intent.state/locked_at before this function ever saw the chain, so
  // there is nothing left here to detect from chain.intent itself — instead
  // we read what readChain() recorded on _migratedOnRead and turn it into a
  // repaired[] line, so `doctor` actually reports the conversion instead of
  // silently writing an already-normalized chain and claiming nothing changed.
  if (chain._migratedOnRead && chain._migratedOnRead.length > 0) {
    for (const change of chain._migratedOnRead) {
      repaired.push(`Migrated to RATIFIED schema: ${change}`);
    }
  }
  // Bump schema_version forward only — never downgrades a chain written by a
  // newer binary (isNewerSchema() guard mirrors validateChainSemantics()).
  if (chain.schema_version !== SCHEMA_VERSION && !isNewerSchema(chain.schema_version, SCHEMA_VERSION)) {
    repaired.push(`schema_version migrated "${chain.schema_version}" → "${SCHEMA_VERSION}"`);
    chain.schema_version = SCHEMA_VERSION;
  }

  // Deliberately NOT self-healed here, unlike every other auto-repair in this
  // function: chain.intent.certified_doc_sha256 (Amendment mechanism —
  // isIntentDocUncertified()). Doctor may report UNCERTIFIED_EDIT (via the
  // command layer, which has the file path) but must never re-stamp the hash
  // itself — that would silently certify an edit that never went through
  // `sigma intent amendment`, which is exactly the loophole §2A's second
  // clause exists to close. The only legitimate exits are a recorded
  // amendment or discarding the edit (`git checkout`).

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

  const expectedGate1 = hasRatifiedIntent(chain) || hasActiveOverrideForGate('Gate 1');
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

// PLAN-IMPL-MULTIDRAFT-LOCK §6.3 (Director directive 2026-08-12) — EXEC
// version is always identical to the PLAN version it references, never
// independently allocated. This is only safe because a PLAN can never
// acquire a second EXEC: the only way an EXEC becomes SUPERSEDED is via
// cascade from `plan supersede`/`intent supersede`, which always retires the
// PLAN in the same step, and `exec new` only accepts LOCKED plans as
// candidates (see the per-PLAN guard in exec.ts). So one PLAN version can
// never produce two EXEC versions, and reusing the PLAN's version number
// cannot collide.
export function nextExecVersion(_chain: ChainState, planVersionRef: string): string {
  return planVersionRef;
}

// ── INTENT Mutations ──────────────────────────────────────────────────────────
// No registerIntentDraft() here — unlike progress.ts, a ChainState is only
// ever created together with its (DRAFT) intent (see createInitialChain()
// above). There is no valid scenario for adding an intent draft to an
// already-existing chain, so that step of the old two-step
// (createInitialProgress + registerIntentDraft) collapses into one.

export function ratifyIntent(chain: ChainState): void {
  const now = new Date().toISOString();
  if (chain.intent.state !== 'DRAFT') {
    throw new Error(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; ratify requires DRAFT`);
  }

  chain.intent.state = 'RATIFIED';
  chain.intent.ratified_at = now;
  chain.intent.updated_at = now;

  chain.gates.gate_1_open = true;
  chain.lifecycle_state = 'BUILD';

  // Recompute from this chain's own PLAN/EXEC — matches ratifyIntent()'s
  // reopen/pivot behavior in progress.ts, minus the INACTIVE-demotion loop
  // (PLAN-EVAL-01 §3.4 — nothing else in this file to demote).
  chain.gates.gate_2_open = hasCleanGate2Chain(chain);
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}

// ── Amendment / Effective-State Certification ───────────────────────────────
// Discussion 2026-08-11_0115 §5.2/5.3, Director directive 2026-08-12. Deliberately
// separate from ratifyIntent() — that function stays a pure chain mutation with
// no filesystem I/O (existing unit tests call it directly on in-memory chains
// with no DIR-INTENT file on disk). Certification touches the actual artifact
// file, so command layers (intent.ts) call it explicitly right after a
// successful ratify or amendment, once the absolute doc path is known.

// Stamps intent.certified_doc_sha256/certified_at from the DIR-INTENT file's
// current on-disk bytes — the only two events allowed to make an edit
// "effective" are ratification and a recorded amendment (§2A clause 2: no
// other path may silently re-certify a document).
export function certifyIntentDoc(chain: ChainState, absDocPath: string): void {
  const content = fs.readFileSync(absDocPath);
  chain.intent.certified_doc_sha256 = crypto.createHash('sha256').update(content).digest('hex');
  chain.intent.certified_at = new Date().toISOString();
}

// True when the DIR-INTENT file's current bytes no longer match the last
// certified hash — i.e. someone edited the ratified/amended document outside
// `sigma intent amendment`. Never auto-heals (see runDoctorReconciliation()
// comment) — the only legitimate ways out are a real amendment or `git
// checkout` to discard the edit.
export function isIntentDocUncertified(chain: ChainState, absDocPath: string): boolean {
  if (!chain.intent.certified_doc_sha256) return false; // never certified yet (DRAFT, or a pre-Amendment-era chain) — nothing to compare against
  if (!fs.existsSync(absDocPath)) return false; // a missing file is a different, already-surfaced problem
  const content = fs.readFileSync(absDocPath);
  const currentHash = crypto.createHash('sha256').update(content).digest('hex');
  return currentHash !== chain.intent.certified_doc_sha256;
}

// Next "AMD-NNN" id — zero-padded, matching the PREFIX-NNN convention already
// used by REQ-001/CON-001/ASM-001/RR-001 elsewhere in DIR-INTENT.
export function nextAmendmentId(chain: ChainState): string {
  const n = (chain.intent.amendments?.length ?? 0) + 1;
  return `AMD-${String(n).padStart(3, '0')}`;
}

// Pure schema mutation — appends one AmendmentEntry and advances
// effective_amendment. Does not touch the filesystem: the command layer
// (intent.ts) renders Section 14 and re-certifies the doc hash separately,
// same division of responsibility as ratifyIntent()/certifyIntentDoc().
export function recordIntentAmendment(chain: ChainState, change: string): AmendmentEntry {
  if (chain.intent.state !== 'RATIFIED') {
    throw new Error(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; amendment requires RATIFIED`);
  }
  const trimmed = change.trim();
  if (!trimmed) {
    throw new Error('--change cannot be empty');
  }
  // Section 14 is a pipe-table — same sanitization reason as
  // assertRequiredIntentMetadata() for --title/--focus (intent.ts).
  if (/[|\n\r]/.test(change)) {
    throw new Error('--change cannot contain "|" or a newline (breaks the Amendment History table)');
  }

  const now = new Date().toISOString();
  const entry: AmendmentEntry = {
    id: nextAmendmentId(chain),
    created_at: now,
    change: trimmed,
    director_approved_at: now,
  };
  chain.intent.amendments = [...(chain.intent.amendments ?? []), entry];
  chain.intent.effective_amendment = entry.id;
  chain.intent.updated_at = now;
  return entry;
}

// ── ARC Satisfaction Score (Gate 3.5, closure-authority PLAN-EVAL-02) ──────
// Scale is tiered, not additive: 0-50 is output satisfaction (must be full
// to cross 50 at all), 50-100 is process satisfaction layered strictly on
// top of a complete output — see ARC-RULE.md §ARC Satisfaction Score
// Methodology for the full rationale. Band, not the raw number, is the
// primary signal shown to Director/FMN (mitigates false precision +
// Goodhart's Law — rationale in closure-authority-and-arc-scoring-proposal-20260720.md
// §4, retrievable via git history, not a live path).

export function arcScoreBand(score: number): 'OUTPUT_INCOMPLETE' | 'SATISFIED_NEEDS_REVIEW' | 'SATISFIED_RECOMMENDED' {
  if (score < 50) return 'OUTPUT_INCOMPLETE';
  if (score < 80) return 'SATISFIED_NEEDS_REVIEW';
  return 'SATISFIED_RECOMMENDED';
}

// Gate 3.5 pre-condition for `sigma close new` — does not gate `close lock`.
export function hasGate35Score(chain: ChainState): boolean {
  return (chain.intent.arc_score ?? -1) >= 50;
}

export function recordArcScore(chain: ChainState, score: number, notes: string): void {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error('ARC score must be an integer between 0 and 100');
  }
  if (/[|\n\r]/.test(notes)) {
    throw new Error('--notes cannot contain "|" or a newline (breaks the intent-history.md table and its recovery parser)');
  }
  if (chain.intent.state !== 'RATIFIED') {
    throw new Error('ARC score can only be recorded against a RATIFIED DIR-INTENT');
  }
  chain.intent.arc_score = score;
  chain.intent.arc_score_notes = notes;
  chain.intent.arc_score_updated_at = new Date().toISOString();
  chain.updated_at = chain.intent.arc_score_updated_at;
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
  if (chain.intent.state !== 'RATIFIED') {
    throw new Error(`INTENT ${chain.intent.version} is in state "${chain.intent.state}"; supersede requires RATIFIED`);
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

  // PLAN-IMPL-MULTIDRAFT-LOCK §7.3 — a new DRAFT plan can close a Gate 3
  // that was previously satisfied (the new Gate 3 definition requires zero
  // open DRAFT work across both plan and exec). This function never touched
  // gate_3_satisfied before; recomputing keeps the write internally
  // consistent with validateChainSemantics().
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}

export function updatePlanMetadata(chain: ChainState, version: string, title?: string, focus?: string): void {
  const entry = chain.plan.versions.find(v => v.version === version);
  if (!entry) throw new Error(`FMN-PLAN ${version} not found. Run: sigma plan list`);
  if (title !== undefined) entry.title = title;
  if (focus !== undefined) entry.focus = focus;
  entry.updated_at = new Date().toISOString();
}

// PLAN-IMPL-MULTIDRAFT-LOCK §3 (Director directive 2026-08-12) — FIFO
// lock order removed. `plan lock` now targets a specific DRAFT version
// explicitly; the command layer resolves which version via
// resolveTargetVersion() and only calls this once a single unambiguous
// target is known.
export function lockPlanVersion(chain: ChainState, version: string): string {
  const target = chain.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`FMN-PLAN ${version} not found. Run: sigma plan list`);
  if (target.state !== 'DRAFT') {
    throw new Error(`FMN-PLAN ${version} is in state "${target.state}"; lock requires DRAFT.`);
  }
  const now = new Date().toISOString();
  target.state = 'LOCKED';
  target.locked_at = now;
  target.updated_at = now;

  chain.plan.active_version = version;
  chain.plan.active_state = 'LOCKED';
  chain.gates.gate_2_open = hasCleanGate2Chain(chain);
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);

  return version;
}

// Resolves which DRAFT version a targeting command (`plan lock`, `exec
// lock`, `plan check`, `exec check`) should act on, given an optional
// explicit --v. Shared so every command applies the same ambiguity rule
// (PLAN-IMPL-MULTIDRAFT-LOCK §8.3): zero DRAFT -> explicit "nothing to do"
// signal, exactly one -> auto-resolved, more than one without --v ->
// ambiguous (caller must reject and list candidates).
export type TargetResolution =
  | { kind: 'resolved'; version: string }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'empty' };

export function resolveTargetVersion(
  versions: ArtifactVersion[],
  explicit: string | undefined,
): TargetResolution {
  const drafts = versions.filter(v => v.state === 'DRAFT');
  if (explicit) {
    return { kind: 'resolved', version: explicit };
  }
  if (drafts.length === 0) return { kind: 'empty' };
  if (drafts.length === 1) return { kind: 'resolved', version: drafts[0].version };
  return { kind: 'ambiguous', candidates: drafts.map(v => v.version) };
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

  // PLAN-IMPL-MULTIDRAFT-LOCK §7.3 — same reasoning as registerPlanDraft():
  // promotion is the moment a pending plan enters versions[] as a real
  // DRAFT and can close Gate 3.
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}

// PLAN-IMPL-MULTIDRAFT-LOCK §6.1 (Director directive 2026-08-12) — supersede
// now accepts DRAFT as well as LOCKED, since it is the only exit for a
// DRAFT plan the Director no longer wants (no `plan discard` — see the
// plan's D-03). Only an already-SUPERSEDED target is rejected, to protect
// the original supersede_reason from being silently overwritten.
export function supersedePlanVersion(chain: ChainState, version: string, reason: string): void {
  const now = new Date().toISOString();
  const target = chain.plan.versions.find(v => v.version === version);
  if (!target) throw new Error(`PLAN version ${version} not found`);
  if (target.state === 'SUPERSEDED') {
    throw new Error(`FMN-PLAN ${version} is already SUPERSEDED (reason: ${target.supersede_reason}).`);
  }
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

  // PLAN-IMPL-MULTIDRAFT-LOCK §1.3/§6.4 — supersede never recomputed gates
  // before; superseding the last LOCKED plan left gate_2_open stale (true)
  // until the next `sigma doctor` run, and the very next mutating command
  // would fail validateChainSemantics(). Recomputed here so the write is
  // always internally consistent.
  chain.gates.gate_2_open = hasCleanGate2Chain(chain);
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}

// ── EXEC Mutations ────────────────────────────────────────────────────────────
// Unchanged logic from progress.ts — exec stays an array tracker, retyped
// for ChainState.

export function registerExecDraft(chain: ChainState, version: string, filePath: string, planVersionRef: string): void {
  if (chain.exec.versions.some(v => v.version === version)) {
    throw new Error(`Duplicate DEV-EXEC version "${version}" already exists in progress-${chain.chain_version}.json`);
  }
  // PLAN-IMPL-MULTIDRAFT-LOCK §6.3 — EXEC version must now equal PLAN
  // version exactly, not just share a major (nextExecVersion() only ever
  // produces planVersionRef itself; this is a defensive check for anything
  // that constructs a chain by hand, e.g. tests or reconstruct.ts).
  if (version !== planVersionRef) {
    throw new Error(
      `Version sync error: DEV-EXEC ${version} does not match FMN-PLAN ${planVersionRef}. ` +
      `EXEC version must equal PLAN version exactly.`
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
  // PLAN-IMPL-MULTIDRAFT-LOCK §7.3 — computed, not asserted: a new DRAFT
  // exec always closes Gate 3 under the new definition (§7.1), but writing
  // that as a bare `false` here is what made this function implicitly rely
  // on "only one exec chain-wide" in the old single-workstream model.
  chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
}

// PLAN-IMPL-MULTIDRAFT-LOCK §5 (Director directive 2026-08-12) — targets a
// specific DRAFT version explicitly, mirroring lockPlanVersion(). Replaces
// lockActiveExec(), which always operated on exec.active_version and could
// not coexist with concurrent DRAFT execs across different plans.
export function lockExecVersion(chain: ChainState, version: string): void {
  const target = chain.exec.versions.find(v => v.version === version);
  if (!target) throw new Error(`DEV-EXEC ${version} not found. Run: sigma exec list`);
  if (target.state !== 'DRAFT') {
    throw new Error(`DEV-EXEC ${version} is in state "${target.state}"; lock requires DRAFT.`);
  }
  const now = new Date().toISOString();
  target.state = 'LOCKED';
  target.locked_at = now;
  target.updated_at = now;

  chain.exec.active_version = version;
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

// PLAN-IMPL-MULTIDRAFT-LOCK §1.4/§8.2 (Director directive 2026-08-12) — was
// reading chain.plan.active_state, a display pointer that can point at a
// DRAFT even while a LOCKED plan (eligible for `exec new`) exists elsewhere
// in the same chain; switched to hasActiveLockedPlan(), which checks the
// real state. The FIFO-flavored "will lock X (oldest DRAFT)" hint is gone
// along with FIFO itself (§3); `plan queue` is gone too (§8.2, absorbed
// into `plan status`), so pending plans no longer get a dedicated hint here
// — `plan status`/`session bootstrap` already surface them.
export function getNextValidOperations(chain: ChainState): string[] {
  const ops: string[] = [];
  const intentRatified = chain.intent.state === 'RATIFIED';
  const roadmapExists = chain.roadmap !== null && chain.roadmap.state !== 'SUPERSEDED';

  if (chain.intent.state === 'DRAFT') {
    ops.push('intent ratify');
  }

  if (intentRatified && !roadmapExists) {
    ops.push('roadmap new');
  }

  if (intentRatified && roadmapExists) {
    ops.push('plan new');
  }
  const draftPlans = chain.plan.versions.filter(v => v.state === 'DRAFT');
  if (draftPlans.length === 1) {
    ops.push(`plan lock    # will lock ${draftPlans[0].version}`);
  } else if (draftPlans.length > 1) {
    ops.push(`plan lock --v <version>    # ${draftPlans.length} DRAFT plans open, run: sigma plan status`);
  }

  if (hasActiveLockedPlan(chain)) {
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
