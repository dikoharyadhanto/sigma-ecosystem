# PLAN-0B — Phase 0B: Registry & Runtime Contract

> **Phase**: 0B — Registry & Runtime Contract
> **Output**: `SIGMA-OPERATION-REGISTRY.json` + `SIGMA-REGISTRY.json` + `Sigma/progress.json` (seed)
> **Gate**: Must be stable before Phase 3 (CLI Foundation) begins
> **Location**: All three files live inside `Sigma/`
> **Dependency**: Phase 0A Director-reviewed and passed

---

## Objective

Translate Phase 0A doctrine into precise, machine-enforceable definitions. The CLI reads these files at runtime — they are the source of truth for valid operations, state transitions, gate enforcement, and document authority. Phase 0B produces no code; it produces the contracts that Phase 3 code will implement.

---

## Deliverables

| File                              | Location       | Description                                                    |
| --------------------------------- | -------------- | -------------------------------------------------------------- |
| `SIGMA-OPERATION-REGISTRY.json`   | `Sigma/`       | All valid CLI operations: pre/post conditions, gating, outputs |
| `SIGMA-REGISTRY.json`             | `Sigma/`       | Permanent governance document registry with authority tiers    |
| `progress.json`                   | `Sigma/`       | Seed file for sigma-ecosystem project + schema reference       |

---

## Task 1 — SIGMA-OPERATION-REGISTRY.json

### Structure

Mirrors Delta's `DELTA-OPERATION-REGISTRY.json`. Each operation entry has:

```
operation_id    — unique snake_case ID: {domain}_{action}
domain          — CLI domain: project | session | intent | plan | exec | close | git | cso | setup | gitignore
action          — CLI action: new | lock | status | list | ...
level           — "semantic" (mutates project artifacts or runtime state) | "read_only" | "system" (install-level)
role            — "any" | "director" (Director-only operations)
description     — what the operation does and what gate it enforces
inputs          — named options/arguments the CLI accepts
outputs         — documents or state transitions produced
constraints     — gate rules enforced before execution (type: "gate")
gating          — { pre_condition: "...", post_condition: "..." }
```

**Key Sigma differences from Delta:**
- No `audit` domain (AUD is advisory only — no audit record command)
- No `override` domain (no Director Override in Sigma)
- No `block` / `unblock` domain (no cascade quarantine in Sigma)
- No `refresh` domain (simpler state model — no cascade propagation)
- No `skill` domain (no skill routing engine in Sigma)
- `intent` replaces `di` + `strat` (single DESIGN artifact)
- `plan` replaces `wo` + `str` (FMN-PLAN is WO + test contract merged)
- `exec` replaces `impl` + `walk` (DEV-EXEC is plan + report merged)
- `close` replaces `pdc` (DIR-CLOSE is Sigma's closure artifact)

### Full Operation List

**Domain: project**

| operation_id        | action   | level     | role     | Description                                       |
| ------------------- | -------- | --------- | -------- | ------------------------------------------------- |
| `project_start`     | start    | semantic  | any      | Initialize Sigma project in current directory. Creates `Sigma/` folder structure, seeds `progress.json`, copies doctrine files, registers project in `~/.sigma/projects.json`. No gate. |
| `project_status`    | status   | read_only | any      | Read `progress.json`, display lifecycle phase, active artifact versions, gate status, STALE_INTENT warnings. |
| `project_sync`      | sync     | semantic  | director | Sync doctrine files inside project's `Sigma/` from global `~/.sigma/templates/`. Targets: `SIGMA_PROTOCOL.md`, `SIGMA_CONSTITUTION.md`, `rules/*`, bridge files at project root. Backs up all affected files to `Sigma/logs/sync-backup-{timestamp}/` before writing. Requires `--confirm` flag — touches existing project files. Does NOT auto-run on CLI update. No gate. |
| `project_reset`     | reset    | semantic  | director | Reset `progress.json` to initial seed state. Requires `--confirm`. Backs up current `progress.json` to `Sigma/logs/progress-backup-{timestamp}.json` before reset. Artifact files untouched. Add `--wipe` to also archive artifact files from `design/`, `build/`, `close/` into `Sigma/logs/reset-archive-{timestamp}/` — never permanent delete. Requires `--confirm --wipe` together (both flags mandatory for archive mode). |
| `project_register`  | register | semantic  | any      | Re-register current project in `~/.sigma/projects.json`. Reads `project_id` and `project_name` from `progress.json`. Use when project is moved to a new path, or global registry is missing/corrupted. Validates that `Sigma/progress.json` exists before writing. |

**Domain: session**

| operation_id        | action    | level     | role | Description                                         |
| ------------------- | --------- | --------- | ---- | --------------------------------------------------- |
| `session_bootstrap` | bootstrap | read_only | any  | Load runtime state: lifecycle phase, active artifact versions and states, pending gates, STALE_INTENT flags, document list to read. Required at session start. |

**Domain: intent**

| operation_id    | action | level    | role     | Description                                           |
| --------------- | ------ | -------- | -------- | ----------------------------------------------------- |
| `intent_new`    | new    | semantic | any      | Create DIR-INTENT DRAFT from template. No gate — INTENT is the first artifact. Auto-names file from project ID + version. |
| `intent_review` | review | semantic | any      | AUD advisory review of active DIR-INTENT. Named `review` not `audit` — Intent Core is sovereign (clarity-only). Outputs advisory findings section. Director retains lock authority. |
| `intent_lock`   | lock   | semantic | director | Lock active DIR-INTENT. Gate: INTENT must be DRAFT. Review/audit operations (`intent_review`) write to the document file but do NOT change runtime state — INTENT stays DRAFT after review. Auto-supersedes any prior LOCKED INTENT (single-active). Sets `gate_1_open = true` and transitions `lifecycle_state` to `BUILD` in progress.json. Flags any existing PLAN/EXEC versions as `stale_intent = true` if their `intent_version_ref` != the new locked version. |
| `intent_status` | status | read_only | any     | Show active INTENT version and state.                 |
| `intent_list`   | list   | read_only | any     | List all INTENT versions with states and timestamps.  |

**Domain: plan**

| operation_id    | action    | level    | role     | Description                                           |
| --------------- | --------- | -------- | -------- | ----------------------------------------------------- |
| `plan_new`      | new       | semantic | any      | Create FMN-PLAN DRAFT from template. **Gate 1**: `progress.gates.gate_1_open == true` (INTENT must be LOCKED). Records `intent_version_ref` from currently locked INTENT version. |
| `plan_audit`    | audit     | semantic | any      | AUD advisory audit of active FMN-PLAN. Fully auditable (not sovereign). Outputs advisory findings section only — does not lock or approve. |
| `plan_lock`     | lock      | semantic | director | Lock active FMN-PLAN. Gate: PLAN must be DRAFT. Sets `gate_2_open = true`. Triggers decision memory harvest. No auto-supersede — FMN-PLAN is multi-active. |
| `plan_supersede`| supersede | semantic | director | Explicitly supersede a locked FMN-PLAN version. Requires `--v <version>` and `--reason "..."`. Sets version state to SUPERSEDED. Does NOT remove the file. |
| `plan_status`   | status    | read_only | any     | Show active PLAN version, state, gate status, STALE_INTENT flag. |
| `plan_list`     | list      | read_only | any     | List all PLAN versions with states, intent refs, and STALE_INTENT flags. |

**Domain: exec**

| operation_id            | action           | level    | role     | Description                                       |
| ----------------------- | ---------------- | -------- | -------- | ------------------------------------------------- |
| `exec_new`              | new              | semantic | any      | Create DEV-EXEC DRAFT from template. **Gate 2**: `progress.gates.gate_2_open == true` (FMN-PLAN must be LOCKED). Records `plan_version_ref` from currently locked PLAN version. |
| `exec_audit`            | audit            | semantic | any      | AUD advisory audit of active DEV-EXEC. Fully auditable. Outputs advisory findings section only. |
| `exec_advance_building` | advance building | semantic | any      | Transition active EXEC: DRAFT → BUILDING.         |
| `exec_advance_testing`  | advance testing  | semantic | any      | Transition active EXEC: BUILDING → TESTING.       |
| `exec_advance_complete` | advance complete | semantic | any      | Transition active EXEC: TESTING → COMPLETED.      |
| `exec_lock`             | lock             | semantic | director | Lock EXEC. Gate: EXEC must be COMPLETED. Triggers decision memory harvest. Re-evaluates Gate 3 conditions and updates `progress.gates.gate_3_satisfied`. No auto-supersede — DEV-EXEC is multi-active. |
| `exec_supersede`        | supersede        | semantic | director | Explicitly supersede a locked DEV-EXEC version. Requires `--v <version>` and `--reason "..."`. |
| `exec_status`           | status           | read_only | any     | Show active EXEC version, state, plan ref, STALE_INTENT flag. |
| `exec_list`             | list             | read_only | any     | List all EXEC versions with states, plan refs, and STALE_INTENT flags. |

**Domain: close**

| operation_id   | action | level    | role     | Description                                           |
| -------------- | ------ | -------- | -------- | ----------------------------------------------------- |
| `close_new`    | new    | semantic | director | Create DIR-CLOSE DRAFT from template. **Gate 3**: (1) active INTENT is LOCKED; (2) at least one DEV-EXEC is LOCKED; (3) that DEV-EXEC's `plan_version_ref` points to a LOCKED FMN-PLAN; (4) that FMN-PLAN's `intent_version_ref` points to the currently active LOCKED INTENT. If any artifact in the qualifying chain has `stale_intent = true`, CLI **blocks** — Director must pass `--ack-stale-intent` to proceed. Without `--ack-stale-intent`, `close new` will not create the DRAFT. |
| `close_audit`  | audit  | semantic | any      | AUD advisory audit of active DIR-CLOSE. Fully auditable. Writes advisory findings section to document file. Does NOT change runtime state. |
| `close_lock`   | lock   | semantic | director | Lock DIR-CLOSE. Gate: CLOSE must be DRAFT. Auto-supersedes any prior LOCKED CLOSE (single-active). Transitions `lifecycle_state` to `CLOSED`. Triggers decision memory harvest. |
| `close_status` | status | read_only | any     | Show active CLOSE version, state, evidence references. |

**Domain: git**

| operation_id   | action   | level     | role | Description                                           |
| -------------- | -------- | --------- | ---- | ----------------------------------------------------- |
| `git_evidence` | evidence | read_only | any  | Read-only Git state: current branch, latest commit hash + message, changed files since last commit, diff summary. No publish layer. |

**Domain: cso**

| operation_id | action | level    | role | Description                                             |
| ------------ | ------ | -------- | ---- | ------------------------------------------------------- |
| `cso_new`    | new    | semantic | any  | Create CSO artifact file. Accepts `--from <file>` to seed from a draft. Saves timestamped file to `Sigma/logs/`. Registers entry in `progress.cso`. No gate. |

**Domain: setup**

| operation_id     | action  | level  | role | Description                                           |
| ---------------- | ------- | ------ | ---- | ----------------------------------------------------- |
| `setup_install`  | install | system | any  | Install Sigma globally. Creates `~/.sigma/`, copies templates and bridge files, installs role shortcuts to agent platforms. Does not configure MCP memory — use `setup memory` for that. |
| `setup_update`   | update  | system | any  | Safe global non-destructive update. Syncs `~/.sigma/templates/`, setup targets, and global bridge/rule/protocol template files from the installed package. Does NOT touch any active project's `Sigma/` folder. Use `sigma project sync` for project-level doctrine update. |
| `setup_memory`   | memory  | system | any  | Configure Sigma MCP memory node store. Creates `~/.sigma/memory_sigma.jsonl`. Outputs MCP config instructions. |

**Domain: gitignore**

| operation_id         | action   | level     | role | Description                                       |
| -------------------- | -------- | --------- | ---- | ------------------------------------------------- |
| `gitignore_generate` | generate | read_only | any  | Output `.gitignore` entries appropriate for Sigma projects. Does not write to any file — prints to stdout for Director to copy. |

---

## Task 2 — SIGMA-REGISTRY.json

### Structure

Maps permanent governance documents to authority tiers, owners, lifecycles, and mandatory-when triggers. Mirrors `DELTA-REGISTRY.json` structure. Contains **permanent documents only** — project-specific artifacts (DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE) are tracked in `progress.json`, not here.

### Authority Tier Hierarchy

Two separate axes — do not conflate:

**Semantic authority** (what governs interpretation and behavior):
```
constitutional       → SIGMA_CONSTITUTION.md
operational_governance → SIGMA_PROTOCOL.md
agent_rule           → ARC-RULE, AUD-RULE, FMN-RULE, DEV-RULE
agent_config         → CLAUDE.md, GEMINI.md, AGENTS.md
```

**Runtime authority** (what governs current lifecycle state and CLI gating):
```
runtime_state        → progress.json
```

`progress.json` does not override constitutional doctrine. It governs operational state: which artifacts exist, what their lifecycle states are, and which CLI operations are permitted right now. In any conflict between a semantic claim in a markdown document and the runtime state in `progress.json`, the CLI uses `progress.json` for gate decisions.

### Document Entries

| document_id             | file                      | authority_tier         | mandatory_when                                       |
| ----------------------- | ------------------------- | ---------------------- | ---------------------------------------------------- |
| `sigma_constitution`    | `SIGMA_CONSTITUTION.md`   | `constitutional`       | `governance_conflict`, `constitutional_amendment`, `authority_hierarchy_query`, `session_bootstrap` |
| `sigma_protocol`        | `SIGMA_PROTOCOL.md`       | `operational_governance` | `session_bootstrap`, `governance_conflict`, `document_navigation`, `lifecycle_query` |
| `arc_rule`              | `rules/ARC-RULE.md`       | `agent_rule`           | `session_bootstrap` (when ARC role active), `role_boundary_violation` |
| `aud_rule`              | `rules/AUD-RULE.md`       | `agent_rule`           | `session_bootstrap` (when AUD role active), `role_boundary_violation` |
| `fmn_rule`              | `rules/FMN-RULE.md`       | `agent_rule`           | `session_bootstrap` (when FMN role active), `role_boundary_violation` |
| `dev_rule`              | `rules/DEV-RULE.md`       | `agent_rule`           | `session_bootstrap` (when DEV role active), `role_boundary_violation` |
| `claude_config`         | `CLAUDE.md`               | `agent_config`         | `session_bootstrap`, `role_boundary_violation` |
| `gemini_config`         | `GEMINI.md`               | `agent_config`         | `session_bootstrap`, `role_boundary_violation` |
| `agents_config`         | `AGENTS.md`               | `agent_config`         | `session_bootstrap`, `role_boundary_violation` |
| `progress_json`         | `progress.json`           | `runtime_state`        | Every CLI operation — read before, written after every state-mutating operation |

**Note on rule files**: ARC-RULE through DEV-RULE are created in Phase 2. The registry pre-registers them with their expected paths. The CLI must tolerate missing rule files gracefully (warn on `session_bootstrap`, do not error on read-only operations).

### Section-level triggers (for SIGMA_PROTOCOL.md)

| Section reference         | Trigger                    |
| ------------------------- | -------------------------- |
| `lifecycle`               | `lifecycle_query`          |
| `role_definitions`        | `role_boundary_violation`  |
| `artifact_definitions`    | `document_navigation`      |
| `state_machine`           | `lifecycle_query`          |
| `gate_rules`              | `governance_conflict`      |
| `auto_supersede_policy`   | `governance_conflict`      |
| `stale_intent`            | `stale_intent_query`       |
| `audit_doctrine`          | `role_boundary_violation`  |
| `aud_activation_policy`   | `role_boundary_violation`  |
| `folder_structure`        | `document_navigation`      |
| `naming_convention`       | `document_navigation`      |
| `cli_command_surface`     | `session_bootstrap`        |

---

## Task 3 — progress.json Schema + Seed File

### Purpose

`progress.json` is the single source of runtime truth for a Sigma project. The CLI reads it before every operation (to check gates) and writes it after every state-mutating operation. It lives at `Sigma/progress.json` inside the project root.

### Schema Definition

```json
{
  "schema_version": "string — semver, e.g. '1.0.0'",
  "project_id": "string — short uppercase ID, e.g. 'SIGMA'",
  "project_name": "string — human-readable project name",
  "lifecycle_state": "enum — 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED'. Transitions: START sets DESIGN; intent_lock sets BUILD; close_new sets CLOSE; close_lock sets CLOSED.",
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp — updated on every write",

  "intent": {
    "active_version": "string | null — version label of current active INTENT, e.g. 'v1.0'",
    "active_state": "enum | null — 'DRAFT' | 'LOCKED' | 'SUPERSEDED'",
    "versions": [
      {
        "version": "string — e.g. 'v1.0'",
        "state": "enum — 'DRAFT' | 'LOCKED' | 'SUPERSEDED'",
        "file": "string — relative path from Sigma/ root, e.g. 'design/DIR-INTENT-v1.0.md'",
        "locked_at": "ISO 8601 timestamp | null",
        "superseded_at": "ISO 8601 timestamp | null",
        "superseded_by": "string | null — version label that superseded this, e.g. 'v1.1'"
      }
    ]
  },

  "plan": {
    "active_version": "string | null",
    "active_state": "enum | null — 'DRAFT' | 'LOCKED' | 'SUPERSEDED'",
    "versions": [
      {
        "version": "string",
        "state": "enum — 'DRAFT' | 'LOCKED' | 'SUPERSEDED'",
        "file": "string — e.g. 'build/FMN-PLAN-v1.0.md'",
        "intent_version_ref": "string — INTENT version this PLAN was drafted against",
        "stale_intent": "boolean — true if referenced INTENT was superseded after this PLAN was created",
        "locked_at": "ISO 8601 timestamp | null",
        "superseded_at": "ISO 8601 timestamp | null",
        "superseded_by": "string | null",
        "supersede_reason": "string | null — required when superseded_by is set"
      }
    ]
  },

  "exec": {
    "active_version": "string | null",
    "active_state": "enum | null — 'DRAFT' | 'BUILDING' | 'TESTING' | 'COMPLETED' | 'LOCKED' | 'SUPERSEDED'",
    "versions": [
      {
        "version": "string",
        "state": "enum — 'DRAFT' | 'BUILDING' | 'TESTING' | 'COMPLETED' | 'LOCKED' | 'SUPERSEDED'",
        "file": "string — e.g. 'build/DEV-EXEC-v1.0.md'",
        "plan_version_ref": "string — FMN-PLAN version this EXEC was drafted against",
        "stale_intent": "boolean — true if EXEC's PLAN ref's intent_version_ref was superseded",
        "locked_at": "ISO 8601 timestamp | null",
        "superseded_at": "ISO 8601 timestamp | null",
        "superseded_by": "string | null",
        "supersede_reason": "string | null"
      }
    ]
  },

  "close": {
    "active_version": "string | null",
    "active_state": "enum | null — 'DRAFT' | 'LOCKED' | 'SUPERSEDED'",
    "versions": [
      {
        "version": "string",
        "state": "enum — 'DRAFT' | 'LOCKED' | 'SUPERSEDED'",
        "file": "string — e.g. 'close/DIR-CLOSE-v1.0.md'",
        "locked_at": "ISO 8601 timestamp | null",
        "superseded_at": "ISO 8601 timestamp | null",
        "superseded_by": "string | null"
      }
    ]
  },

  "gates": {
    "gate_1_open": "boolean — true when any INTENT version is LOCKED",
    "gate_2_open": "boolean — true when any PLAN version is LOCKED",
    "gate_3_satisfied": "boolean — true when full chain is valid: active INTENT LOCKED → ≥1 FMN-PLAN LOCKED referencing that INTENT → ≥1 DEV-EXEC LOCKED referencing that PLAN. Chain with stale_intent=true is conditionally satisfied only with --ack-stale-intent on close new."
  },

  "cso": [
    {
      "file": "string — e.g. 'logs/CSO-ARC-20260516-1430.md'",
      "state": "enum — 'DRAFT' | 'COMPLETE'",
      "created_at": "ISO 8601 timestamp"
    }
  ]
}
```

### STALE_INTENT Flag Logic

The `stale_intent` flag on PLAN and EXEC versions is set by `intent_lock` — not by the artifact itself.

**Trigger**: When `intent_lock` is called and auto-supersedes an existing LOCKED INTENT (v_old → v_new):
1. For every PLAN version where `intent_version_ref == v_old` → set `stale_intent = true`
2. For every EXEC version where its referenced PLAN has `stale_intent == true` → set `stale_intent = true` on the EXEC version too

**Effect**: A PLAN or EXEC version with `stale_intent = true`:
- Remains LOCKED — it is not invalidated
- Cannot satisfy Gate 3 (`gate_3_satisfied`) unless Director passes `--ack-stale-intent`
- `close new` **blocks** if the qualifying chain contains `stale_intent = true` and `--ack-stale-intent` is not present
- With `--ack-stale-intent`: CLI proceeds and records the acknowledgment in the DIR-CLOSE DRAFT metadata

**Recovery**: Director creates a new PLAN version (referencing the new INTENT), then a new EXEC. The fresh artifacts have `stale_intent = false` and satisfy Gate 3 cleanly.

### Gate Enforcement Rules

| Gate    | Enforced by CLI command | Condition in progress.json                                                                      | Error message on failure |
| ------- | ----------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- |
| Gate 1  | `plan new`              | `gates.gate_1_open == true`                                                                     | `"GATE 1 BLOCKED: No locked DIR-INTENT. Run: sigma intent lock"` |
| Gate 2  | `exec new`              | `gates.gate_2_open == true`                                                                     | `"GATE 2 BLOCKED: No locked FMN-PLAN. Run: sigma plan lock"` |
| Gate 3  | `close new`             | Full chain: active INTENT LOCKED → PLAN LOCKED referencing it → EXEC LOCKED referencing that PLAN | `"GATE 3 BLOCKED: Requires INTENT → PLAN → EXEC chain all LOCKED (same version chain)"` |
| Gate 3 (stale) | `close new`      | Chain exists but `stale_intent = true`; `--ack-stale-intent` not passed                        | `"GATE 3 STALE: Qualifying chain has stale intent. Add --ack-stale-intent to acknowledge."` |

### Naming Convention (Sigma Artifact Files)

Sigma drops `PROJECT_ID` from artifact filenames. Project identity lives in `progress.json` and `~/.sigma/projects.json` — not in the filename.

**Format**: `{ROLE}-{DOC}-v{VERSION}.md`

| Artifact   | Example filename          |
| ---------- | ------------------------- |
| DIR-INTENT | `DIR-INTENT-v1.0.md`      |
| FMN-PLAN   | `FMN-PLAN-v1.0.md`        |
| DEV-EXEC   | `DEV-EXEC-v0.1.md`        |
| DIR-CLOSE  | `DIR-CLOSE-v1.0.md`       |
| CSO        | `CSO-AUD-20260516-2130.md` (no project ID — agent + timestamp sufficient) |

**Rationale**: Artifacts live inside the project's `Sigma/` folder — path provides project context. No rename cost if project ID changes. Simpler and more readable.

---

### Schema Migration Policy

When the CLI reads `progress.json`, it compares `schema_version` in the file against the CLI's supported schema version.

| Condition | CLI behavior |
|-----------|--------------|
| `progress.schema_version` < CLI supported | Auto-migrate. Backup current file to `Sigma/logs/progress-backup-{timestamp}.json` first. Write migrated `progress.json`. Write migration log. Warn user. |
| `progress.schema_version` == CLI supported | No action — proceed normally. |
| `progress.schema_version` > CLI supported | **Block all semantic operations.** Error: `"progress.json schema version {X} is newer than this CLI supports ({Y}). Update Sigma CLI to continue."` Read-only operations (`status`, `list`, `bootstrap`) still allowed. |

**Migration log** — written to `Sigma/logs/migration-{timestamp}.json` on every auto-migration:

```json
{
  "timestamp": "ISO 8601",
  "from_schema": "1.0.0",
  "to_schema": "1.1.0",
  "migration_steps": ["step description 1", "step description 2"],
  "result": "success | partial | failed",
  "backup_file": "logs/progress-backup-20260516-143000.json"
}
```

Migration log is not required for v1 implementation — document the format now, implement if schema actually changes.

---

### Global Project Registry Format

`~/.sigma/projects.json` — global registry managed by `sigma project start` and `sigma project register`.

```json
{
  "schema_version": "1.0.0",
  "projects": [
    {
      "project_id": "SIGMA",
      "name": "sigma-ecosystem",
      "path": "/path/to/sigma-ecosystem",
      "type": "sigma",
      "created_at": "2026-05-16T00:00:00Z",
      "last_seen_at": "2026-05-16T00:00:00Z"
    }
  ]
}
```

`last_seen_at` is updated on every successful CLI operation against that project.

---

### Seed File — sigma-ecosystem Project

The initial `Sigma/progress.json` for the sigma-ecosystem project (current dogfooding state — Phase 0B in progress, no lifecycle artifacts locked yet):

```json
{
  "schema_version": "1.0.0",
  "project_id": "SIGMA",
  "project_name": "sigma-ecosystem",
  "lifecycle_state": "DESIGN",
  "created_at": "2026-05-16T00:00:00Z",
  "updated_at": "2026-05-16T00:00:00Z",

  "intent": {
    "active_version": null,
    "active_state": null,
    "versions": []
  },

  "plan": {
    "active_version": null,
    "active_state": null,
    "versions": []
  },

  "exec": {
    "active_version": null,
    "active_state": null,
    "versions": []
  },

  "close": {
    "active_version": null,
    "active_state": null,
    "versions": []
  },

  "gates": {
    "gate_1_open": false,
    "gate_2_open": false,
    "gate_3_satisfied": false
  },

  "cso": []
}
```

**Note**: The sigma-ecosystem project's `DIR-DI-000-SIGMA-v1.0.md` in `Intent/` is a design document (the Director's Intent artifact from Phase 0 planning), not a Sigma lifecycle artifact. The first actual Sigma lifecycle artifact (DIR-INTENT) will be created via `sigma intent new` when the sigma CLI is available in Phase 3. The seed file above represents the correct initial state.

---

## Execution Order

1. Read `DELTA-OPERATION-REGISTRY.json` and `DELTA-REGISTRY.json` from delta-ecosystem as reference
2. Write `Sigma/SIGMA-OPERATION-REGISTRY.json` (all 36 operations)
3. Write `Sigma/SIGMA-REGISTRY.json` (10 document entries)
4. Write `Sigma/progress.json` (seed file for sigma-ecosystem project)
5. Director review pass
6. Patch any issues → Phase 3 scaffolding can begin

---

## Acceptance Criteria (Director Gate)

Before Phase 3 can start, Director must confirm:

- [ ] `SIGMA-OPERATION-REGISTRY.json`: all 36 operations present (including `project_sync`, `project_reset`, `project_register`, `setup_update`), gating conditions precise and machine-interpretable
- [ ] Gate 1, 2, 3 pre-conditions map cleanly to `progress.json` fields
- [ ] `intent_lock` auto-supersede logic and STALE_INTENT propagation are unambiguous
- [ ] `plan_supersede` and `exec_supersede` are manual-only (no auto-trigger)
- [ ] `project_reset` — soft vs archive modes clearly distinguished; no permanent delete
- [ ] `project_sync` — Director-confirmed, never auto-triggered by `setup_update`
- [ ] `setup_update` — global only, does not touch active project `Sigma/` folder
- [ ] `SIGMA-REGISTRY.json`: 10 documents registered with correct authority tiers
- [ ] Role rule file entries tolerate Phase 2 not-yet-created gracefully (noted)
- [ ] `progress.json` schema: all artifact state enums complete and non-overlapping
- [ ] Artifact file naming: no PROJECT_ID in filename — format `{ROLE}-{DOC}-v{VERSION}.md` confirmed
- [ ] STALE_INTENT flag logic is traceable from trigger event to gate effect
- [ ] Schema migration policy: auto-migrate (CLI newer), block (CLI older) — documented
- [ ] Migration log format documented (`Sigma/logs/migration-{timestamp}.json`)
- [ ] `~/.sigma/projects.json` entry format documented
- [ ] Gate error messages are human-readable and actionable
- [ ] Seed file state is correct for sigma-ecosystem project at Phase 0B

---

## Open Items

None carried forward from Phase 0A that affect Phase 0B. Phase 0B introduces no open items — all design decisions are resolved in Phase 0A doctrine.

---

*Created: 2026-05-16 — Phase 0B planning*
