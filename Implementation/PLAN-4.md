# Implementation Plan — Phase 4: CLI Workflow Commands

**Phase**: 4 of 7
**Goal**: Implement all artifact lifecycle commands — `intent`, `plan`, `exec`, `close`, `roadmap`, `git`, `cso`. Extend the progress engine with mutation functions. Phase 3's infrastructure (state engine, registry loader, output helpers) is the foundation; Phase 4 builds on top of it without rewriting it.
**Status**: PENDING
**Prerequisites**: Phase 3 complete (CLI Foundation — `sigma setup install`, `sigma project start`, `sigma session bootstrap`, all passing smoke tests)

---

## Source Material

| File | Role |
| :--- | :--- |
| `sigma_phase_implementation.md` — Phase 4 section | Phase 4 task list and command surface |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Pre-conditions, post-conditions, error messages, gating for all 39 operations |
| `Sigma/progress.json` | Schema ground truth — all state mutations must conform |
| `src/engine/progress.ts` | Phase 3 state engine — extended in Phase 4 (do not replace) |
| `src/engine/registry.ts` | Operation and document registry loader (read-only in Phase 3) |
| `Sigma/templates/*` | 6 artifact templates — source for `new` commands |
| `Sigma/SIGMA_PROTOCOL.md` | Section 23 placeholder — filled in Task 9 |

---

## Design Decisions

### 1. Extend, Do Not Rewrite

`src/engine/progress.ts` is stable. Phase 4 adds mutation functions (register drafts, lock, supersede, advance, propagate stale) to the existing file — it does not replace or restructure it.

`ArtifactVersion` interface is extended with optional fields needed for cross-artifact referencing and lock metadata. Backward compatibility is preserved — existing `progress.json` files from Phase 3 remain valid because all new fields are optional.

```typescript
export interface ArtifactVersion {
  version: string;
  state: string;
  file?: string;                  // relative path from project root
  created_at: string;
  updated_at: string;
  locked_at?: string;             // set on lock
  superseded_by?: string;         // set when this version is superseded
  supersede_reason?: string;      // set on explicit supersede
  stale_intent?: boolean;         // PLAN/EXEC flag
  intent_version_ref?: string;    // PLAN versions: which INTENT version they reference
  plan_version_ref?: string;      // EXEC versions: which PLAN version they reference
}
```

---

### 2. Version Numbering Convention

Each artifact type uses a simple auto-increment scheme. The CLI determines the next version by counting all existing entries in `versions[]` (any state) and incrementing:

| Artifact | Format | Examples | Note |
| :--- | :--- | :--- | :--- |
| INTENT | `v{N}` | v1, v2, v3 | Major increment — one active at a time |
| PLAN | `v{N}` | v1, v2, v3 | Major increment — multi-active |
| EXEC | `v0.{N}` | v0.1, v0.2, v0.3 | Minor increment — build iterations |
| CLOSE | `v{N}` | v1, v2 | Major increment — one active at a time |
| ROADMAP | `v{N}` | v1, v2 | Major increment — one active at a time |

Version is a string label in `progress.json`. File names include the version label (e.g., `DIR-INTENT-v1.md`, `DEV-EXEC-v0.1.md`).

Helper functions:

```typescript
function nextMajorVersion(versions: ArtifactVersion[]): string
// → `v${versions.length + 1}`

function nextExecVersion(versions: ArtifactVersion[]): string
// → `v0.${versions.length + 1}`
```

---

### 3. New Command File Per Domain

Each artifact domain gets its own command file. Phase 3 introduced `setup.ts`, `project.ts`, `session.ts`, `gitignore.ts`. Phase 4 adds:

```
src/commands/
├── intent.ts     ← sigma intent new | review | lock | status | list
├── plan.ts       ← sigma plan new | audit | lock | supersede | status | list
├── exec.ts       ← sigma exec new | audit | advance | lock | supersede | status | list
├── close.ts      ← sigma close new | audit | lock | status
├── roadmap.ts    ← sigma roadmap new | lock | list
├── git.ts        ← sigma git evidence
└── cso.ts        ← sigma cso new
```

All 7 new files are registered in `src/cli.ts`. Version bump: `0.3.0` → `0.4.0` in `package.json` and `src/config.ts`.

---

### 4. Gate Enforcement: Inline, Not Registry-Driven

Phase 3 deferred full dynamic SIGMA-OPERATION-REGISTRY enforcement. Phase 4 implements gate checks inline in each command, reading directly from `progress.json` state. The operation registry is still read by `session bootstrap` for display — it is not used as the enforcement source at runtime.

Rationale: the 39-operation registry covers the full lifecycle. Implementing a generic registry-driven enforcer adds a layer of indirection that Phase 4 does not need. Each command knows its own pre-conditions. The registry remains the specification source; inline code is the implementation.

Per-command gate check pattern:

```typescript
const data = readProgress(projectRoot);
if (!data.gates.gate_1_open) {
  error('GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock');
}
```

---

### 5. Template Source for `new` Commands

Artifact templates are read from `~/.sigma/templates/` (the globally installed copy, populated by `sigma setup install`). This is the same pattern used for governance documents in `sigma project start`.

For development use (within the sigma-ecosystem project itself), a fallback to the package bundle path is provided. The lookup order:

1. `~/.sigma/templates/{TEMPLATE_NAME}` — primary (installed)
2. `{PACKAGE_ROOT}/Sigma/templates/{TEMPLATE_NAME}` — fallback (development)

If neither exists, the `new` command aborts with: `"Template not found. Run: sigma setup install"`

All created artifact files land in their designated project subfolder:
- `Sigma/design/` — DIR-INTENT files
- `Sigma/build/` — FMN-PLAN, DEV-EXEC, ROADMAP files
- `Sigma/close/` — DIR-CLOSE files
- `Sigma/logs/` — CSO files

---

### 6. Audit / Review Output Format

`sigma intent review`, `sigma plan audit`, `sigma exec audit`, `sigma close audit` append an advisory findings section to the artifact file. These commands do NOT change `progress.json` runtime state.

Appended section format:

```markdown

---

## AUD Advisory Findings

*Appended: {ISO 8601 timestamp}*
*Operation: sigma {domain} {action}*
*Status: ADVISORY ONLY — does not change runtime state*

**Audit Scope**: [AUD fills this]

**Findings**:

[AUD fills this]

**Recommendation**: [AUD fills this]
```

The CLI appends this section to the bottom of the active artifact file. The AUD role fills in the content. A subsequent `sigma {domain} {action}` on the same artifact appends another findings block (multiple AUD passes are allowed).

---

### 7. `exec advance` Subcommand Pattern

`sigma exec advance <stage>` uses a positional argument. Stage is validated against the allowed set: `building`, `testing`, `complete`. Commander implementation:

```typescript
execCmd
  .command('advance <stage>')
  .description('Advance EXEC state: building → testing → complete')
  .action((stage: string) => { ... });
```

The `complete` stage advances state to `COMPLETED` (not `LOCKED`). `lock` is a separate subcommand.

State machine enforced inline:
- `advance building`: requires `active_state == 'DRAFT'`
- `advance testing`: requires `active_state == 'BUILDING'`
- `advance complete`: requires `active_state == 'TESTING'`

---

### 8. `sigma git evidence` Implementation

Read-only git inspection using `child_process.execSync`. All git calls are wrapped in try/catch. If not in a git repo, aborts with a clear error.

Data collected:
- `git rev-parse --abbrev-ref HEAD` → current branch
- `git log -1 --format="%H %s"` → latest commit hash + message
- `git status --short` → changed files
- `git diff --stat HEAD` → diff summary

Output is plain text to stdout (no `progress.json` changes). `sigma git evidence` does not write any Sigma artifacts.

---

### 9. `sigma cso new` Naming and Registration

CSO files are named with a timestamp and an optional role identifier:

```
Sigma/logs/CSO-{ROLE}-{YYYYMMDD}-{HHMM}.md
```

Flags:
- `--role <role>` — role label in filename (e.g., `DEV`, `FMN`). Defaults to `ANY` if not passed.
- `--from <file>` — seed content from an existing draft file. If omitted, uses CSO template.

Registration in `progress.cso[]`:

```json
{
  "version": "CSO-DEV-20260516-1430",
  "state": "COMPLETE",
  "file": "Sigma/logs/CSO-DEV-20260516-1430.md",
  "created_at": "2026-05-16T14:30:00Z"
}
```

---

### 10. STALE_INTENT Propagation on `intent lock`

When `sigma intent lock` runs:

1. Prior LOCKED INTENT version (if any) → state `SUPERSEDED`, `superseded_by` set to new version
2. All PLAN versions with `intent_version_ref` ≠ newly locked INTENT version → `stale_intent = true`
3. All EXEC versions whose `plan_version_ref` points to a plan that has `stale_intent = true` → `stale_intent = true`

This cascades through the full version history, not just the active versions.

Gate 3 re-evaluation on `exec lock`: checks whether a complete locked chain exists — INTENT LOCKED → a PLAN LOCKED with `intent_version_ref` pointing to that INTENT and `stale_intent != true` → the active EXEC LOCKED with `plan_version_ref` pointing to that PLAN. If chain is clean, `gate_3_satisfied = true`.

---

## Phase 4 Output Files

| File | Action | Description |
| :--- | :--- | :--- |
| `src/engine/progress.ts` | Extend | Add mutation functions, extended ArtifactVersion interface |
| `src/commands/intent.ts` | Create | `sigma intent new \| review \| lock \| status \| list` |
| `src/commands/plan.ts` | Create | `sigma plan new \| audit \| lock \| supersede \| status \| list` |
| `src/commands/exec.ts` | Create | `sigma exec new \| audit \| advance \| lock \| supersede \| status \| list` |
| `src/commands/close.ts` | Create | `sigma close new \| audit \| lock \| status` |
| `src/commands/roadmap.ts` | Create | `sigma roadmap new \| lock \| list` |
| `src/commands/git.ts` | Create | `sigma git evidence` |
| `src/commands/cso.ts` | Create | `sigma cso new` |
| `src/cli.ts` | Update | Register 7 new command groups |
| `src/config.ts` | Update | Version bump `0.3.0` → `0.4.0` |
| `package.json` | Update | Version bump `0.3.0` → `0.4.0` |
| `Sigma/SIGMA_PROTOCOL.md` | Update | Fill Section 23 placeholder with Phase 4 spec |

---

## Task 1 — Extend `src/engine/progress.ts`

### 1a. Extend `ArtifactVersion` Interface

Add optional fields to the existing interface (backward-compatible):

```typescript
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
  intent_version_ref?: string;    // PLAN only
  plan_version_ref?: string;      // EXEC only
}
```

### 1b. Version Helpers

```typescript
export function nextMajorVersion(versions: ArtifactVersion[]): string {
  return `v${versions.length + 1}`;
}

export function nextExecVersion(versions: ArtifactVersion[]): string {
  return `v0.${versions.length + 1}`;
}
```

### 1c. INTENT Mutations

```typescript
// Register a new INTENT DRAFT entry
export function registerIntentDraft(
  data: ProgressJson,
  version: string,
  filePath: string
): void

// Lock active INTENT; auto-supersede prior LOCKED; propagate STALE_INTENT
export function lockActiveIntent(data: ProgressJson): void
// side effects: gate_1_open = true; lifecycle_state = 'BUILD' (if not already)

// Propagate stale_intent after a new INTENT lock
// Called inside lockActiveIntent
function propagateStaleIntent(data: ProgressJson, newLockedVersion: string): void
```

### 1d. PLAN Mutations

```typescript
export function registerPlanDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  intentVersionRef: string
): void

export function lockActivePlan(data: ProgressJson): void
// side effects: gate_2_open = true

export function supersedePlanVersion(
  data: ProgressJson,
  version: string,
  reason: string
): void
// validates target is LOCKED before superseding
```

### 1e. EXEC Mutations

```typescript
export function registerExecDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  planVersionRef: string
): void

export function advanceExecState(
  data: ProgressJson,
  toState: 'BUILDING' | 'TESTING' | 'COMPLETED'
): void
// validates correct source state before advancing

export function lockActiveExec(data: ProgressJson): void
// side effects: evaluates gate_3; gate_3_satisfied = true if full chain clean

export function supersedeExecVersion(
  data: ProgressJson,
  version: string,
  reason: string
): void

// Called inside lockActiveExec
function evaluateGate3(data: ProgressJson): boolean
// returns true if: INTENT LOCKED → PLAN LOCKED (non-stale) referencing it → active EXEC referencing that PLAN
```

### 1f. CLOSE Mutations

```typescript
export function registerCloseDraft(
  data: ProgressJson,
  version: string,
  filePath: string,
  staleAcknowledged: boolean
): void
// side effects: lifecycle_state = 'CLOSE'; records stale_acknowledged in version metadata if flag passed

export function lockActiveClose(data: ProgressJson): void
// side effects: lifecycle_state = 'CLOSED'; auto-supersede prior LOCKED CLOSE
```

### 1g. ROADMAP Mutations

```typescript
export function registerRoadmapDraft(
  data: ProgressJson,
  version: string,
  filePath: string
): void
// gate: intent.active_state == 'LOCKED'; no existing DRAFT roadmap

export function lockActiveRoadmap(data: ProgressJson): void
// auto-supersede prior LOCKED ROADMAP
```

### 1h. CSO Registration

```typescript
export function registerCsoEntry(data: ProgressJson, entry: CsoEntry): void
```

---

## Task 2 — `sigma intent` Commands

**File**: `src/commands/intent.ts`

### `sigma intent new`

**Pre-condition**: None (DIR-INTENT is the first artifact; no gate)
**Post-condition**: `intent.active_version` set; `intent.active_state = 'DRAFT'`; file created at `Sigma/design/DIR-INTENT-{version}.md`

Behavior:
1. Find project root. Read `progress.json`.
2. Determine next version via `nextMajorVersion(data.intent.versions)`.
3. Determine template path (GLOBAL_TEMPLATES_DIR first, fallback to BUNDLE_TEMPLATES). Abort if not found.
4. Copy template to `Sigma/design/DIR-INTENT-{version}.md`.
5. Call `registerIntentDraft(data, version, filePath)`.
6. Write `progress.json`.
7. Output success: "Created: Sigma/design/DIR-INTENT-{version}.md — open this file and fill in the intent."

### `sigma intent review`

**Pre-condition**: `intent.active_version != null`
**Post-condition**: Advisory findings section appended to active INTENT file; no `progress.json` change

Behavior:
1. Read `progress.json`. Check `intent.active_version` is not null.
2. Locate active INTENT file (from `intent.versions[].file` or derive from version label).
3. Append advisory findings section (see Design Decision 6) to the file.
4. Output: "Advisory findings section appended to {filePath}. Fill in the AUD findings — runtime state unchanged."

### `sigma intent lock`

**Pre-condition**: `intent.active_state == 'DRAFT'`
**Post-condition**: `intent.active_state = 'LOCKED'`; `gates.gate_1_open = true`; `lifecycle_state = 'BUILD'`; prior LOCKED INTENT → `SUPERSEDED`; STALE_INTENT propagated

Behavior:
1. Read `progress.json`. Check `intent.active_state == 'DRAFT'`. If not: error "Active DIR-INTENT is not in DRAFT state. Cannot lock."
2. Call `lockActiveIntent(data)` — handles supersede, gate, lifecycle, STALE_INTENT propagation.
3. Write `progress.json`.
4. Output: "DIR-INTENT {version} LOCKED. Gate 1 open. Lifecycle → BUILD. Next: sigma plan new"

### `sigma intent status`

**Pre-condition**: `Sigma/progress.json` exists
**Post-condition**: Read-only

Output: active INTENT version, state, locked_at (if locked), any STALE_INTENT propagation events.

### `sigma intent list`

**Pre-condition**: `Sigma/progress.json` exists
**Post-condition**: Read-only

Output: table of all INTENT versions — version, state, created_at, locked_at, superseded_by.

---

## Task 3 — `sigma plan` Commands

**File**: `src/commands/plan.ts`

### `sigma plan new`

**Pre-condition**: `gates.gate_1_open == true` (INTENT must be LOCKED)
**Post-condition**: `plan.active_version` set; `plan.active_state = 'DRAFT'`; file at `Sigma/build/FMN-PLAN-{version}.md`

Behavior:
1. Read `progress.json`. Check `gates.gate_1_open`. If false: error "GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock"
2. Determine `intentVersionRef` = current `intent.active_version`.
3. Copy FMN-PLAN template to `Sigma/build/FMN-PLAN-{version}.md`.
4. Call `registerPlanDraft(data, version, filePath, intentVersionRef)`.
5. Write `progress.json`.
6. Output: "Created: Sigma/build/FMN-PLAN-{version}.md (references INTENT {intentVersionRef})"

### `sigma plan audit`

**Pre-condition**: `plan.active_version != null`
**Post-condition**: Advisory findings section appended to active PLAN file; no state change

### `sigma plan lock`

**Pre-condition**: `plan.active_state == 'DRAFT'`
**Post-condition**: `plan.active_state = 'LOCKED'`; `gates.gate_2_open = true`

Behavior:
1. Check `plan.active_state == 'DRAFT'`. If not: error "Active FMN-PLAN is not in DRAFT state. Cannot lock."
2. Call `lockActivePlan(data)`.
3. Write `progress.json`.
4. Output: "FMN-PLAN {version} LOCKED. Gate 2 open. Next: sigma exec new"

Note: FMN-PLAN is multi-active. Locking does NOT auto-supersede prior locked PLAN versions. Prior locked versions remain LOCKED until explicitly superseded via `sigma plan supersede`.

### `sigma plan supersede`

**Pre-condition**: `--v <version>` and `--reason <reason>` both present; target version must be LOCKED
**Post-condition**: Target version state = `SUPERSEDED`; `supersede_reason` recorded

Flags: `--v <version>`, `--reason <reason>` (both required)

Behavior:
1. Validate flags present. Look up target version in `plan.versions`. Check it is LOCKED.
2. Call `supersedePlanVersion(data, version, reason)`.
3. Write `progress.json`.
4. Output: "FMN-PLAN {version} superseded. Reason: {reason}"

### `sigma plan status` / `sigma plan list`

Read-only. `status` shows active PLAN only. `list` shows all versions with state, intent_version_ref, stale_intent flag, timestamps.

---

## Task 4 — `sigma exec` Commands

**File**: `src/commands/exec.ts`

### `sigma exec new`

**Pre-condition**: `gates.gate_2_open == true` (PLAN must be LOCKED)
**Post-condition**: `exec.active_version` set; `exec.active_state = 'DRAFT'`; file at `Sigma/build/DEV-EXEC-{version}.md`

Behavior:
1. Check `gates.gate_2_open`. If false: error "GATE 2 BLOCKED: No locked FMN-PLAN. Run: sigma plan lock"
2. Determine `planVersionRef` = current `plan.active_version`.
3. Copy DEV-EXEC template to `Sigma/build/DEV-EXEC-{version}.md` (version uses minor format: v0.1, v0.2...).
4. Call `registerExecDraft(data, version, filePath, planVersionRef)`.
5. Write `progress.json`.
6. Output: "Created: Sigma/build/DEV-EXEC-{version}.md (references PLAN {planVersionRef})"

### `sigma exec audit`

**Pre-condition**: `exec.active_version != null`
**Post-condition**: Advisory findings section appended; no state change

Audit can occur at any pre-lock state (DRAFT, BUILDING, TESTING, COMPLETED).

### `sigma exec advance <stage>`

**Pre-condition**: Valid state transition
**Post-condition**: `exec.active_state` advanced

Valid transitions:
- `building`: DRAFT → BUILDING
- `testing`: BUILDING → TESTING
- `complete`: TESTING → COMPLETED

Behavior:
1. Validate `stage` is one of `building`, `testing`, `complete`.
2. Check current `exec.active_state` matches expected source state for the transition.
3. Call `advanceExecState(data, targetState)`.
4. Write `progress.json`.
5. Output: "DEV-EXEC {version}: {oldState} → {newState}"

### `sigma exec lock`

**Pre-condition**: `exec.active_state == 'COMPLETED'`
**Post-condition**: `exec.active_state = 'LOCKED'`; Gate 3 re-evaluated

Behavior:
1. Check `exec.active_state == 'COMPLETED'`. If not: error "Active DEV-EXEC must be in COMPLETED state to lock. Run: sigma exec advance complete"
2. Call `lockActiveExec(data)` — sets state LOCKED, evaluates gate_3.
3. Write `progress.json`.
4. Report gate_3 result: "DEV-EXEC {version} LOCKED. Gate 3: {SATISFIED | not satisfied — stale chain or incomplete chain}"

### `sigma exec supersede`

**Pre-condition**: `--v` and `--reason` present; target version LOCKED
**Post-condition**: Target version → SUPERSEDED

Same pattern as `sigma plan supersede`.

### `sigma exec status` / `sigma exec list`

Read-only. `list` shows all versions with state, plan_version_ref, stale_intent, timestamps.

---

## Task 5 — `sigma close` Commands

**File**: `src/commands/close.ts`

### `sigma close new`

**Pre-condition**: Gate 3 full chain — INTENT LOCKED → PLAN LOCKED (referencing that INTENT, non-stale) → EXEC LOCKED (referencing that PLAN). If chain has `stale_intent = true`, `--ack-stale-intent` flag must be present.
**Post-condition**: `close.active_version` set; `close.active_state = 'DRAFT'`; `lifecycle_state = 'CLOSE'`; file at `Sigma/close/DIR-CLOSE-{version}.md`

Flags: `--ack-stale-intent` (optional — required only when stale chain)

Behavior:
1. Evaluate gate 3 chain. If chain incomplete: error "GATE 3 BLOCKED: Requires INTENT → PLAN → EXEC chain all LOCKED (same version chain)"
2. If chain has `stale_intent = true` and `--ack-stale-intent` not passed: error "GATE 3 STALE: Qualifying chain has stale intent. Add --ack-stale-intent to acknowledge."
3. Copy DIR-CLOSE template to `Sigma/close/DIR-CLOSE-{version}.md`.
4. If `--ack-stale-intent` was passed: prepend a stale acknowledgment note to the created file.
5. Call `registerCloseDraft(data, version, filePath, staleAcknowledged)`.
6. Write `progress.json`.
7. Output: "Created: Sigma/close/DIR-CLOSE-{version}.md"

### `sigma close audit`

**Pre-condition**: `close.active_version != null`
**Post-condition**: Advisory findings appended; no state change

### `sigma close lock`

**Pre-condition**: `close.active_state == 'DRAFT'`
**Post-condition**: `close.active_state = 'LOCKED'`; `lifecycle_state = 'CLOSED'`; prior LOCKED CLOSE → SUPERSEDED

Behavior:
1. Check `close.active_state == 'DRAFT'`. If not: error "Active DIR-CLOSE is not in DRAFT state. Cannot lock."
2. Call `lockActiveClose(data)`.
3. Write `progress.json`.
4. Output: "DIR-CLOSE {version} LOCKED. Lifecycle → CLOSED. Project is complete."

### `sigma close status`

Read-only. Shows active CLOSE version, state, evidence chain references.

---

## Task 6 — `sigma roadmap` Commands

**File**: `src/commands/roadmap.ts`

### `sigma roadmap new`

**Pre-condition**: `intent.active_state == 'LOCKED'`; no ROADMAP version currently in DRAFT state
**Post-condition**: New ROADMAP DRAFT registered; file at `Sigma/build/ROADMAP-{version}.md`

Behavior:
1. Check `intent.active_state == 'LOCKED'`. If not: error "ROADMAP requires a locked DIR-INTENT. Run: sigma intent lock"
2. Check no DRAFT roadmap exists. If one does: error "A ROADMAP DRAFT already exists. Lock it before creating a new version. Run: sigma roadmap lock"
3. Copy ROADMAP template to `Sigma/build/ROADMAP-{version}.md`.
4. Call `registerRoadmapDraft(data, version, filePath)`.
5. Write `progress.json`.
6. Output: "Created: Sigma/build/ROADMAP-{version}.md"

### `sigma roadmap lock`

**Pre-condition**: At least one ROADMAP DRAFT exists
**Post-condition**: Active ROADMAP DRAFT → LOCKED; prior LOCKED ROADMAP → SUPERSEDED

Behavior:
1. Find DRAFT roadmap version. If none: error "No ROADMAP DRAFT found. Run: sigma roadmap new"
2. Call `lockActiveRoadmap(data)`.
3. Write `progress.json`.
4. Output: "ROADMAP {version} LOCKED."

### `sigma roadmap list`

Read-only. Table of all ROADMAP versions: version, state, created_at, locked_at.

---

## Task 7 — `sigma git evidence`

**File**: `src/commands/git.ts`

**Pre-condition**: git repository exists at project root
**Post-condition**: Read-only — no `progress.json` change, no artifact file written

Behavior:
1. Check `git rev-parse --git-dir` exits 0. If not: error "No git repository found. Initialize with: git init"
2. Collect git data via `execSync` (all wrapped in try/catch with informative errors):
   - Branch: `git rev-parse --abbrev-ref HEAD`
   - Commit: `git log -1 --format="%H%n%s%n%ai"`
   - Changed files: `git status --short`
   - Diff stat: `git diff --stat HEAD`
3. Output formatted report:

```
=== Git Evidence ===

Branch:   {branch}
Commit:   {hash}
Message:  {subject}
Date:     {author date}

--- Changed Files ---
{git status --short output, or "none"}

--- Diff Summary ---
{git diff --stat HEAD output, or "none"}
```

**No git writes, no `progress.json` changes.**

---

## Task 8 — `sigma cso new`

**File**: `src/commands/cso.ts`

**Pre-condition**: None (no gate)
**Post-condition**: CSO file created in `Sigma/logs/`; entry added to `progress.cso[]`

Flags:
- `--role <role>` — role label for filename. Defaults to `ANON`.
- `--from <file>` — seed content from an existing file. If omitted, uses CSO template.

Behavior:
1. Find project root. Read `progress.json`.
2. Build timestamp: `YYYYMMDD-HHMM` from `new Date()`.
3. Build filename: `CSO-{ROLE}-{YYYYMMDD}-{HHMM}.md`.
4. Determine content source:
   - If `--from <file>` passed: copy that file's content. Error if source file not found.
   - Otherwise: copy CSO template (same GLOBAL_TEMPLATES_DIR fallback pattern as other `new` commands).
5. Write file to `Sigma/logs/{filename}`.
6. Build `CsoEntry`:
   ```json
   {
     "version": "CSO-{ROLE}-{YYYYMMDD}-{HHMM}",
     "state": "COMPLETE",
     "file": "Sigma/logs/CSO-{ROLE}-{YYYYMMDD}-{HHMM}.md",
     "created_at": "<ISO 8601>"
   }
   ```
7. Call `registerCsoEntry(data, entry)`.
8. Write `progress.json`.
9. Output: "CSO created: Sigma/logs/{filename}"

---

## Task 9 — Register New Commands in `src/cli.ts`

Import and register all 7 new domain command groups. Version label in `program.version()` updated to `0.4.0`.

```typescript
import { intentCommand } from './commands/intent';
import { planCommand } from './commands/plan';
import { execCommand } from './commands/exec';
import { closeCommand } from './commands/close';
import { roadmapCommand } from './commands/roadmap';
import { gitCommand } from './commands/git';
import { csoCommand } from './commands/cso';

// add to program:
program.addCommand(intentCommand());
program.addCommand(planCommand());
program.addCommand(execCommand());
program.addCommand(closeCommand());
program.addCommand(roadmapCommand());
program.addCommand(gitCommand());
program.addCommand(csoCommand());
```

Update `src/config.ts`:
```typescript
export const SIGMA_VERSION = '0.4.0';
```

Update `package.json`:
```json
{ "version": "0.4.0" }
```

---

## Task 10 — Update `SIGMA_PROTOCOL.md` Section 23

**Target**: Replace `> **[PHASE 4]** — ...` placeholder in Section 23 with the actual spec.

Section 23 covers:

- Full artifact lifecycle command surface (intent, plan, exec, close, roadmap, git, cso)
- Audit and review command behavior (advisory-only, no runtime state change)
- EXEC state machine (DRAFT → BUILDING → TESTING → COMPLETED → LOCKED)
- STALE_INTENT propagation rules
- Gate 3 evaluation criteria
- `sigma close new --ack-stale-intent` acknowledgment behavior
- CSO artifact naming convention

---

## Implementation Steps

| Step | Action | Target | Status |
| :--- | :--- | :--- | :--- |
| 1 | Extend `ArtifactVersion` interface with optional fields | `src/engine/progress.ts` | TODO |
| 2 | Add `nextMajorVersion`, `nextExecVersion` helpers | `src/engine/progress.ts` | TODO |
| 3 | Add INTENT mutations: `registerIntentDraft`, `lockActiveIntent`, `propagateStaleIntent` | `src/engine/progress.ts` | TODO |
| 4 | Add PLAN mutations: `registerPlanDraft`, `lockActivePlan`, `supersedePlanVersion` | `src/engine/progress.ts` | TODO |
| 5 | Add EXEC mutations: `registerExecDraft`, `advanceExecState`, `lockActiveExec`, `evaluateGate3`, `supersedeExecVersion` | `src/engine/progress.ts` | TODO |
| 6 | Add CLOSE mutations: `registerCloseDraft`, `lockActiveClose` | `src/engine/progress.ts` | TODO |
| 7 | Add ROADMAP mutations: `registerRoadmapDraft`, `lockActiveRoadmap` | `src/engine/progress.ts` | TODO |
| 8 | Add CSO: `registerCsoEntry` | `src/engine/progress.ts` | TODO |
| 9 | Write `src/commands/intent.ts` | `intent new \| review \| lock \| status \| list` | TODO |
| 10 | Write `src/commands/plan.ts` | `plan new \| audit \| lock \| supersede \| status \| list` | TODO |
| 11 | Write `src/commands/exec.ts` | `exec new \| audit \| advance \| lock \| supersede \| status \| list` | TODO |
| 12 | Write `src/commands/close.ts` | `close new \| audit \| lock \| status` | TODO |
| 13 | Write `src/commands/roadmap.ts` | `roadmap new \| lock \| list` | TODO |
| 14 | Write `src/commands/git.ts` | `git evidence` | TODO |
| 15 | Write `src/commands/cso.ts` | `cso new` | TODO |
| 16 | Update `src/cli.ts`: register 7 new commands | `src/cli.ts` | TODO |
| 17 | Bump version `0.3.0` → `0.4.0` | `src/config.ts`, `package.json` | TODO |
| 18 | Run `npm run build` — 0 TypeScript errors | Compile | TODO |
| 19 | Smoke test: `sigma --help` shows all Phase 4 domains | Run | TODO |
| 20 | Smoke test: `sigma intent new` creates file + updates progress.json | Run | TODO |
| 21 | Smoke test: `sigma intent lock` sets gate_1_open, lifecycle → BUILD | Run | TODO |
| 22 | Smoke test: `sigma plan new` blocked without locked INTENT (gate 1) | Run | TODO |
| 23 | Smoke test: `sigma plan new` → `sigma plan lock` → `sigma exec new` | Run | TODO |
| 24 | Smoke test: `sigma exec advance building` → `advance testing` → `advance complete` → `lock` | Run | TODO |
| 25 | Smoke test: `sigma close new` blocked without exec chain (gate 3) | Run | TODO |
| 26 | Smoke test: `sigma close new` + `sigma close lock` → lifecycle → CLOSED | Run | TODO |
| 27 | Smoke test: `sigma git evidence` outputs branch + commit info | Run | TODO |
| 28 | Smoke test: `sigma cso new --role DEV` creates timestamped file in Sigma/logs/ | Run | TODO |
| 29 | Smoke test: STALE_INTENT propagation — lock second INTENT, verify plan.stale_intent = true | Run | TODO |
| 30 | Update `Sigma/SIGMA_PROTOCOL.md` Section 23 | Fill Phase 4 placeholder | TODO |

---

## Acceptance Criteria

| # | Criterion | Check |
| :--- | :--- | :--- |
| AC-01 | `npm run build` completes with 0 TypeScript errors after all Phase 4 changes | Build |
| AC-02 | `sigma --help` lists all 11 domains (setup, project, session, gitignore + 7 new) | Run |
| AC-03 | `sigma intent new` creates `Sigma/design/DIR-INTENT-v1.md` and sets `intent.active_state = 'DRAFT'` in progress.json | Run |
| AC-04 | `sigma intent lock` sets `gate_1_open = true`, `lifecycle_state = 'BUILD'`, `intent.active_state = 'LOCKED'` | Run |
| AC-05 | Second `sigma intent lock` (after `intent new` again): prior LOCKED INTENT → SUPERSEDED | Run |
| AC-06 | After second intent lock: PLAN version with old intent_version_ref has `stale_intent = true` | Run |
| AC-07 | `sigma plan new` without locked INTENT: blocked with "GATE 1 BLOCKED" error | Run |
| AC-08 | `sigma plan new` with locked INTENT: creates `Sigma/build/FMN-PLAN-v1.md`, records `intent_version_ref` | Run |
| AC-09 | `sigma plan lock` sets `gate_2_open = true`, `plan.active_state = 'LOCKED'` | Run |
| AC-10 | `sigma plan supersede --v v1 --reason "..."` sets that version state to SUPERSEDED | Run |
| AC-11 | `sigma exec new` without locked PLAN: blocked with "GATE 2 BLOCKED" error | Run |
| AC-12 | `sigma exec new` creates `Sigma/build/DEV-EXEC-v0.1.md`, records `plan_version_ref` | Run |
| AC-13 | `sigma exec advance building` advances DRAFT → BUILDING; fails if not DRAFT | Run |
| AC-14 | `sigma exec advance testing` advances BUILDING → TESTING; fails if not BUILDING | Run |
| AC-15 | `sigma exec advance complete` advances TESTING → COMPLETED; fails if not TESTING | Run |
| AC-16 | `sigma exec lock` blocked unless state is COMPLETED | Run |
| AC-17 | `sigma exec lock` with clean INTENT → PLAN → EXEC chain: `gate_3_satisfied = true` | Run |
| AC-18 | `sigma close new` without gate_3 satisfied: blocked with "GATE 3 BLOCKED" error | Run |
| AC-19 | `sigma close new` with stale chain and no `--ack-stale-intent`: blocked with "GATE 3 STALE" | Run |
| AC-20 | `sigma close new` with `--ack-stale-intent`: creates DIR-CLOSE draft despite stale chain | Run |
| AC-21 | `sigma close lock` sets `lifecycle_state = 'CLOSED'` | Run |
| AC-22 | `sigma roadmap new` blocked if no locked INTENT | Run |
| AC-23 | `sigma roadmap new` blocked if DRAFT roadmap already exists | Run |
| AC-24 | `sigma roadmap lock` auto-supersedes prior LOCKED ROADMAP | Run |
| AC-25 | `sigma git evidence` outputs branch, commit hash+message, changed files, diff summary | Run |
| AC-26 | `sigma git evidence` in non-git directory: clear error (not stack trace) | Run |
| AC-27 | `sigma cso new --role DEV` creates `Sigma/logs/CSO-DEV-{YYYYMMDD}-{HHMM}.md` | Run |
| AC-28 | `sigma cso new --from <draft>` seeds CSO from provided file | Run |
| AC-29 | `sigma cso new` (no role) defaults to role `ANON` in filename | Run |
| AC-30 | `sigma intent review` appends advisory findings section to active INTENT file; progress.json unchanged | Run |
| AC-31 | `sigma plan audit` appends advisory findings section; progress.json unchanged | Run |
| AC-32 | `sigma exec audit` appends advisory findings section; progress.json unchanged | Run |
| AC-33 | `sigma close audit` appends advisory findings section; progress.json unchanged | Run |
| AC-34 | All `status` and `list` commands exit 0 and produce readable output | Run |
| AC-35 | `SIGMA_PROTOCOL.md` Section 23 placeholder replaced with Phase 4 spec | Read |
| AC-36 | `package.json` and `src/config.ts` both show version `0.4.0` | Read |
