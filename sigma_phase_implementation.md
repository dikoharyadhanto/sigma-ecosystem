# Sigma — Phase Implementation Plan

> **Status**: Draft — for Director review
> **Purpose**: High-level task breakdown by implementation phase. Each phase will have its own WO with technical specifics.
> **Reference**: `Intent/DIR-DI-000-SIGMA-v1.0.md` + `Discussion/discussion.md` (all decisions through Session #2)
>
> **Project Root Convention**: `sigma-ecosystem/` is treated as the project root AND as a registered Sigma project. The `Sigma/` folder inside it is the live governance layer for this project — Sigma is being built using Sigma protocol (dogfooding from Phase 0A). All governance artifacts (`SIGMA_CONSTITUTION.md`, `SIGMA_PROTOCOL.md`, role rules, templates, progress.json, etc.) live inside `Sigma/`, not at the project root.

---

## Overview

```
Phase 0A → Doctrine (Constitution + Protocol)
Phase 0B → Registry & Runtime Contract
Phase 1  → Document Templates
Phase 2  → Role Rules
Phase 3  → CLI Foundation
Phase 4  → CLI Workflow Commands
Phase 5  → Memory & Decision Harvest
Phase 6  → Distribution, Bridge Files & Skills
Phase 7  → Validation & Dogfooding
```

Phases 0A–2 are **design/writing work** (no code).
Phases 3–6 are **implementation work** (Node.js CLI).
Phase 7 is **validation work** (test the whole thing end-to-end).

> Phase 3 must not start until Phase 0B is sufficiently stable. Phase 4 must not start until Phase 0B + Phase 1 are both done.

---

## Phase 0A — Doctrine

**Output**: `SIGMA_CONSTITUTION.md` + `SIGMA_PROTOCOL.md`
**Gate**: Must be Director-reviewed before Phase 0B begins.

The doctrine layer. Establishes Sigma's identity, principles, lifecycle, roles, artifact model, and audit rules. Everything downstream must conform to what is defined here.

### Main Tasks

- **SIGMA_CONSTITUTION.md** — Based on `DELTA_CONSTITUTION.md`. Same 10-Article structure, but terminology is adapted for Sigma (e.g., Article I references Sigma identity, Article IV hierarchy uses Sigma artifact names). Includes a Sigma-specific preface explaining the relationship to Delta, sync obligation, and Sigma-specific interpretation note. Sigma does not have a separate constitution — the Delta Constitution structure is the constitutional layer for both systems. If Delta Constitution is amended, Sigma must follow. **File location: `Sigma/SIGMA_CONSTITUTION.md`** (Director decided: B2, B3, B9 — Session #1; terminology adaptation decided in Phase 0A execution)

- **SIGMA_PROTOCOL.md** — The core operational document. **Living document — written incrementally per phase.** Each phase adds or extends the relevant sections; earlier sections are not rewritten unless a conflict is found. Phase 0A writes the foundational doctrine (sections 1–19). Later phases extend it with template references (Phase 1), rule file references (Phase 2), CLI setup details (Phase 3), full CLI command spec (Phase 4), memory model (Phase 5), and distribution details (Phase 6). **File location: `Sigma/SIGMA_PROTOCOL.md`**. Covers (Phase 0A scope):
  - Sigma identity and relationship to Delta
  - Lifecycle definition: `START → DESIGN → BUILD → CLOSE`
    - **DESIGN**: DIR-INTENT only. ARC drafts, AUD reviews (optional), Director locks. This is the intent and strategy layer — not technical.
    - **BUILD**: FMN-PLAN + DEV-EXEC. Both are technical/implementation work. FMN produces the work plan and test contract; DEV implements and reports. DESIGN must be complete before BUILD begins.
    - **CLOSE**: DIR-CLOSE. Director-owned closure with evidence references.
  - Gate rules (3 gates): FMN-PLAN needs INTENT locked (entering BUILD); DEV-EXEC needs FMN-PLAN locked (within BUILD); DIR-CLOSE needs INTENT + 1 FMN-PLAN + 1 DEV-EXEC locked (same version)
  - State machine per artifact (INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE)
  - Role definitions: ARC (DESIGN role), AUD (spans both phases — advisory), FMN (BUILD role), DEV (BUILD role)
  - Artifact definitions: DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE, CSO
  - Folder-to-phase mapping: `Sigma/strategy/` = DESIGN artifacts (DIR-INTENT); `Sigma/execution/` = BUILD artifacts (FMN-PLAN + DEV-EXEC); `Sigma/closure/` = CLOSE artifacts (DIR-CLOSE)
  - Naming convention: `{ROLE}-{DOC}-{PROJECT_ID}-v{VER}.md`
  - Versioning tiers (Tier 1/2/3 — same as Delta)
  - Auto-supersede policy per artifact type
  - STALE_INTENT warning behavior
  - Folder structure: `Sigma/` with `rules/`, `strategy/`, `execution/`, `closure/`, `logs/`, `memory/`
  - CLI command surface specification (domain list, key actions per domain — `review`/`audit` pattern: `intent review`, `exec audit`, `close audit`)
  - Audit doctrine: AUD advisory-only, Director is sole approval gate, Intent Core is sovereign (clarity-only), all other layers are auditable
  - **AUD activation policy**: AUD is optional by default. Recommended for DIR-INTENT before first lock, DEV-EXEC before first build if scope/tech risk is non-trivial, DIR-CLOSE before public release. Mandatory only when Director marks project as risk-sensitive. Mandatory AUD is not the default — it would undermine Sigma's lightweight advantage.
  - CSO lifecycle (optional artifact, stored in `Sigma/logs/`)
  - Git Evidence: minimal/read-only — branch, latest commit, changed files, diff summary
  - Promotion boundary: when Sigma is insufficient → Director manual decision to close Sigma, open Delta Full

---

## Phase 0B — Registry & Runtime Contract

**Output**: `SIGMA-OPERATION-REGISTRY.json` + `SIGMA-REGISTRY.json` + `progress.json` schema
**Gate**: Must be stable before Phase 3 (CLI Foundation) begins.

The machine contract layer. Translates the doctrine from Phase 0A into precise, machine-enforceable definitions. The CLI reads these files at runtime — they are the source of truth for valid operations and state transitions.

### Main Tasks

- **SIGMA-OPERATION-REGISTRY.json** — All valid CLI operations: pre-conditions, post-conditions, state transitions, blocked states. Mirrors Delta's DELTA-OPERATION-REGISTRY.json structure, Sigma-specific domain set. Final CLI domain list:
  `project`, `session`, `intent`, `plan`, `exec`, `close`, `git`, `cso`, `setup`, `gitignore` — optional: `decision`

- **SIGMA-REGISTRY.json** — Semantic registry: artifact types, document codes, role codes, status codes, state labels. Sigma-specific equivalent of DELTA-REGISTRY.json.

- **`progress.json` schema** — Field definitions, valid state values per artifact type, gate enforcement rules, STALE_INTENT flag logic. This schema is the ground truth that CLI validates against at every operation.

---

## Phase 1 — Document Templates

**Output**: 4 artifact templates + 1 CSO template
**Dependency**: Phase 0A complete (protocol defines what sections each template must contain)

### Main Tasks

- **DIR-INTENT template** — Structure:
  
  - Intent Core (sovereign — clarity-only audit)
  - Director Constraints & Preferences (auditable)
  - Tech Stack (auditable)
  - Timeline (auditable)
  - Solution Assumptions (auditable)
  - Architecture Preference (auditable)
  - Scope Choices (auditable)
  - Risk Assessment (auditable)
  - Evidence Requirements (auditable)
  - AUD Audit Findings section (populated by AUD, optional)
  - Director Lock Verdict (LOCKED / REJECTED, with timestamp)
  - Promotion Check (STAY_SIGMA / PROMOTE_TO_HEAVIER_PROCESS)

- **FMN-PLAN template** — One living document, two internal sections. Authored by FMN (Foreman). Equivalent to Delta's WO + STR merged:
  - Section 1: Work Order / Task Plan — what needs to be built, task breakdown, acceptance criteria, dependencies
  - Section 2: Simulation Test Report — test plan written BEFORE DEV starts (pre-build contract); FMN fills pass/fail results after reviewing DEV's completed EXEC
  - Metadata header: artifact version, status, reference to DIR-INTENT version locked
  - AUD Audit Findings section (optional, advisory)
  - Director Approval / Lock Verdict

- **DEV-EXEC template** — One living document, two internal sections. Authored by DEV (Developer). Equivalent to Delta's IMPL + WALK merged:
  
  - Section 1: Implementation Plan — how DEV will implement based on locked FMN-PLAN; technical approach, architecture decisions
  - Section 2: Implementation Report — written AFTER build; what was built, decisions made, deviations from plan, known issues
  - Metadata header: artifact version, status, reference to FMN-PLAN version locked
  - AUD Audit Findings section (optional, advisory)
  - Director Approval / Lock Verdict

- **DIR-CLOSE template** — Structure:
  
  - Closure Summary (narrative)
  - Evidence References (explicit: which EXEC version(s) support this closure)
  - Accepted Limitations
  - Publish-Ready Documentation notes
  - Director Lock Verdict

- **CSO template** — Same purpose as Delta CSO. Timestamp-based naming (`CSO-{AGENT}-{YYYYMMDD}-{HHMM}.md`). Captures: current context summary, active artifacts + state, pending decisions, recommended next actions, handoff notes.

---

## Phase 2 — Role Rules

**Output**: 4 role rule files in `Sigma/rules/`
**Dependency**: Phase 0A complete (protocol defines role responsibilities and activation rules)

> Skill files for all platforms (`/arc`, `/aud`, `/fmn`, `/dev`, `/checkpoint`, `/cso`) move to Phase 6. They depend on final command surface, folder paths, and setup targets — all of which are only finalized after CLI is built.

### Main Tasks

- **ARC-RULE.md** — **DESIGN phase role.** Rules for Global Architect:
  - Primary responsibility: interview Director, draft DIR-INTENT, produce strategy synthesis
  - Sublayer authority map (what ARC can propose vs what is sovereign)
  - Scope: ARC's work ends when DIR-INTENT is locked. ARC does not touch BUILD phase artifacts.
  - Session bootstrap procedure: what to read at session start
  - Prohibited actions (e.g., cannot lock artifacts — only Director locks)

- **AUD-RULE.md** — **Spans both DESIGN and BUILD phases.** Rules for Auditor:
  - Primary responsibility: critique challengeable layers — in DIR-INTENT (DESIGN) and FMN-PLAN/DEV-EXEC (BUILD)
  - Audit boundary enforcement: Intent Core is sovereign — may not be attacked; all other sublayers are auditable (route, assumptions, methods, risk, feasibility, scope, evidence)
  - Output format: findings section within the artifact being reviewed/audited
  - Advisory-only declaration: AUD findings are evidence for Director, not approval gates
  - AUD activation is optional by default — see AUD policy in SIGMA_PROTOCOL.md
  - Session bootstrap procedure

- **FMN-RULE.md** — **BUILD phase role.** Rules for Foreman:
  - Primary responsibility: produce FMN-PLAN (work order + simulation test report) — both sections
  - Gate rule: FMN cannot start until DIR-INTENT is locked (DESIGN complete)
  - Test plan must be written BEFORE DEV starts building (Section 2 of FMN-PLAN is the pre-build contract)
  - FMN evaluates DEV's completed EXEC against the test plan — fills pass/fail in Section 2 post-build
  - Equivalent to Delta ANT — handles WO + STR in one artifact
  - Session bootstrap procedure
  - What to read before starting: locked DIR-INTENT + any existing FMN-PLAN versions

- **DEV-RULE.md** — **BUILD phase role.** Rules for Developer:
  - Primary responsibility: produce DEV-EXEC (implementation plan + implementation report) — both sections
  - Gate rule: DEV cannot start until FMN-PLAN is locked (same version)
  - Build iteration rules: v0.1, v0.2, etc. — when to iterate vs when to close
  - Testing responsibility: run automatic tests (mandatory); surface manual test results for Director
  - Session bootstrap procedure
  - What to read before starting: locked DIR-INTENT + locked FMN-PLAN + any existing DEV-EXEC versions

---

## Phase 3 — CLI Foundation

**Output**: Working `sigma` binary — install, setup, project init, session bootstrap
**Dependency**: Phase 0 complete (protocol defines folder structure, progress.json schema, command patterns)
**Tech stack**: Node.js, same dependencies as Delta CLI (commander, chalk, fs-extra, inquirer)

### Main Tasks

- **Package scaffold** — `package.json`, `bin/sigma.js` entry point, `src/cli.js` command registration, `src/config.js` (paths, constants), `src/utils/` (shared helpers)

- **`sigma setup install`** — Installs Sigma globally, creates `~/.sigma/` directory, copies default templates, sets up MCP memory config for Sigma

- **`sigma project start`** — Initializes a Sigma project in current directory:
  
  - Creates `Sigma/` folder with subfolders: `rules/`, `strategy/`, `execution/`, `closure/`, `logs/`, `memory/`
  - Creates `Sigma/progress.json` with initial state
  - Copies `SIGMA_CONSTITUTION.md` and `SIGMA_PROTOCOL.md` into project
  - Copies role rule files into `Sigma/rules/`
  - Creates bridge files: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`
  - Registers project in global `~/.sigma/projects.json`

- **`sigma project status`** — Reads `progress.json`, shows current lifecycle state, active artifact versions, pending gates

- **`sigma session bootstrap`** — Agent startup command: reads and outputs the role rules file + active artifact states from `progress.json` + relevant document list

- **Operation Registry enforcement** — CLI reads `SIGMA-OPERATION-REGISTRY.json` before executing any operation; validates pre-conditions from `progress.json`; blocks invalid operations with clear error messages

- **`progress.json` state engine** — Handles all state transitions, gate enforcement, and artifact tracking

---

## Phase 4 — CLI Workflow Commands

**Output**: Full workflow command surface — intent, plan, exec, close, git, cso
**Dependency**: Phase 3 complete (CLI foundation and state engine must exist first)

### Main Tasks

- **`sigma intent`** commands:
  - `new` — creates DIR-INTENT draft from template, registers in progress.json
  - `review` — invokes AUD review on the active DIR-INTENT; outputs advisory findings section. Named `review` (not `audit`) — Intent Core is sovereign, only the route and assumptions are reviewable
  - `lock` — locks INTENT, triggers auto-supersede of prior locked INTENT versions, harvests decision memory
  - `status` — shows current INTENT version and state
  - `list` — lists all INTENT versions with states

- **`sigma plan`** commands:
  - `new` — creates FMN-PLAN draft (gate: INTENT must be locked — DESIGN phase must be complete), registers in progress.json
  - `audit` — invokes AUD review on the active FMN-PLAN; outputs advisory findings section
  - `lock` — locks PLAN, harvests decision memory
  - `supersede` — explicit supersede of old PLAN version (`--v <version> --reason "..."`)
  - `status` / `list`

- **`sigma exec`** commands:
  - `new` — creates DEV-EXEC draft (gate: PLAN must be locked, same version), registers in progress.json
  - `audit` — invokes AUD review on the active DEV-EXEC; outputs advisory findings section
  - `advance building` — transitions EXEC to BUILDING state
  - `advance testing` — transitions EXEC to TESTING state
  - `advance complete` — transitions EXEC to COMPLETED state
  - `lock` — locks EXEC, harvests decision memory
  - `supersede` — explicit supersede of old EXEC version (`--v <version> --reason "..."`)
  - `status` / `list`

- **`sigma close`** commands:
  - `new` — creates DIR-CLOSE draft (gate: INTENT locked + min 1 PLAN locked + 1 EXEC locked, same version), warns if STALE_INTENT
  - `audit` — invokes AUD review on the active DIR-CLOSE before Director locks; advisory only
  - `lock` — locks CLOSE, triggers auto-supersede of prior CLOSE
  - `status`

> **Audit/review pattern**: `review` under `intent` (sovereign artifact — only route/assumptions reviewable); `audit` under `plan`, `exec`, `close` (fully auditable). Same pattern as Delta's `delta wo audit`, `delta strat audit`. No standalone `sigma audit` command. AUD output always advisory; only Director locks.

- **`sigma git evidence`** — Minimal read-only: outputs current branch, latest commit hash + message, changed files since last commit, diff summary; no publish layer, no heavy lifecycle

- **`sigma cso new`** — Creates a new CSO artifact file from a provided draft or empty template, saves timestamped file to `Sigma/logs/`. Accepts `--from <file>` to seed from a draft. Does not generate from conversation context — that is the `/cso` skill shortcut's job. The CLI only handles artifact creation and registration.

- **`sigma gitignore`** — Generates `.gitignore` entries appropriate for Sigma projects (same pattern as Delta)

---

## Phase 5 — Memory & Decision Harvest

**Output**: Working memory layer — Decision auto-harvest + MCP memory integration
**Dependency**: Phase 4 partially complete (lock commands must exist to trigger harvest)

### Main Tasks

- **Decision Memory auto-harvest** — On every `lock` event (intent lock, plan lock, exec lock, close lock): extract decision-relevant content from the locked document, append structured entry to `Sigma/memory/decisions.jsonl`. Harvest fields intentionally lighter than Delta Full:

  All lock events harvest:
  - `artifact`, `version`, `lock_event`, `director_verdict`, `accepted_risks`, `evidence_references`, `source_file`, `timestamp`

  FMN-PLAN lock additionally harvests:
  - `task_plan_summary`, `test_contract_summary`

  DEV-EXEC lock additionally harvests:
  - `implementation_summary`, `known_issues`

  DIR-CLOSE lock additionally harvests:
  - `plan_refs`, `exec_refs`, `closure_verdict`, `accepted_limitations`

- **`sigma setup memory`** — Configures Sigma MCP memory node store (separate from Delta's `memory_delta.jsonl`); creates `~/.sigma/memory_sigma.jsonl`; outputs MCP config instructions

- **Memory tier init** — On `sigma project start`: seeds Constitutional memory entries from SIGMA_CONSTITUTION.md; Operational Sigma entries from SIGMA_PROTOCOL.md core principles; Decision entries begin empty, populated by lock events

- **MCP tools guidance** — Document in SIGMA_PROTOCOL.md and DEV-RULE.md how agents query memory: via MCP `search_nodes` / `read_graph` (not CLI command — same pattern as Delta)

---

## Phase 6 — Distribution, Bridge Files & Skills

**Output**: Installable npm package + agent bridge files + SIGMA_README.md + 24 platform skill files
**Dependency**: Phases 3–5 complete (skill files require final command surface, folder paths, and setup targets)

### Main Tasks

- **`SIGMA_README.md`** — Director-facing guide. Covers: what Sigma is, when to use vs Delta Full, quick start, lifecycle walkthrough, role activation, CLI reference, memory model, promotion boundary

- **Bridge file templates** — Agent-specific onboarding files for projects using Sigma. Each explains: Sigma lifecycle, active role, what to read at session start, what CLI commands are available, key rules. Targets: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` (+ any others Director wants)

- **`~/.sigma/templates/`** — All document templates (from Phase 1) + bridge files bundled in setup; `sigma setup install` deploys them

- **npm package finalization** — `package.json` `files` array, version, description, scripts, test runner config; mirrors Delta's package structure

- **Test suite** — Integration tests covering: project init, all state transitions, gate enforcement, auto-supersede, STALE_INTENT detection, decision harvest, git evidence output; mirrors Delta's test structure

### Skill Files — Role Activation & Session Shortcuts

6 skills × 4 platforms = **24 skill files** (`/arc`, `/aud`, `/fmn`, `/dev`, `/checkpoint`, `/cso`). Authored here because they reference the final command surface, folder structure, and setup targets — all of which are only stable after CLI is complete.

| Platform | Location | Format |
|----------|----------|--------|
| **Claude Code** | `setup/targets/claude_code/` | Markdown with `name`/`description` frontmatter |
| **Antigravity** | `setup/targets/antigravity/` | Markdown with `name`/`description`/`model` frontmatter |
| **Codex** | `setup/targets/codex/skills/{skill}/` | Folder per skill: `SKILL.md` + `agents/` subfolder |
| **Reasonix** | `setup/targets/reasonix/skills/` | Markdown with `name`/`description`/`run_as` frontmatter |

Skill behavior specs (platform-agnostic):

- **`/arc`** — Activates ARC role. Bootstrap: read SIGMA_CONSTITUTION + SIGMA_PROTOCOL + ARC-RULE; query Sigma MCP memory; read active DIR-INTENT; report state to Director; hold for instruction.
- **`/aud`** — Activates AUD role. Bootstrap: read SIGMA_CONSTITUTION + SIGMA_PROTOCOL + AUD-RULE; confirm which artifact is in scope; confirm audit boundary (sovereign vs auditable); output advisory findings only.
- **`/fmn`** — Activates FMN (BUILD) role. Bootstrap: read SIGMA_CONSTITUTION + SIGMA_PROTOCOL + FMN-RULE; query Sigma MCP memory; confirm DIR-INTENT is locked (gate: DESIGN must be complete); read existing FMN-PLAN versions; run `sigma session bootstrap`; report state; hold for instruction.
- **`/dev`** — Activates DEV (BUILD) role. Bootstrap: read SIGMA_CONSTITUTION + SIGMA_PROTOCOL + DEV-RULE; query Sigma MCP memory; confirm DIR-INTENT locked + FMN-PLAN locked (gate: both required); read existing DEV-EXEC versions; run `sigma session bootstrap`; report state; hold for instruction.
- **`/checkpoint`** — Session checkpoint shortcut. Summarize current discussion segment; extract decision candidates and open questions; optionally persist non-authoritative records to `Sigma/memory/`; label all items (confirmed / candidate / open). Does not promote candidates to decisions.
- **`/cso`** — CSO draft generator shortcut. Generate CSO draft from conversation context; read checkpoint records and decision-candidate records if present; preserve `non_authoritative` labels. Outputs draft only — does not create or register the file artifact. Use `sigma cso new --from <draft>` for that.

---

## Phase 7 — Validation & Dogfooding

**Output**: Verified end-to-end Sigma flow — confirms DI success criteria
**Dependency**: All phases complete

### Main Tasks

- **Simulated project walkthrough** — Run a real small project through the full Sigma lifecycle using the actual `sigma` CLI: `project start` → `intent new` → ARC interview → `intent lock` → `exec new` → DEV build → `exec lock` → `close new` → `close lock`

- **DI success criteria verification** — Review each of the 6 success criteria from DIR-DI-000-SIGMA-v1.0:
  
  1. One end-to-end Sigma workflow defined clearly enough to be implemented ✓
  2. Required artifact types defined ✓
  3. Strategy, audit, execution, testing, implementation, closure responsibilities clear ✓
  4. Runtime state requirements minimal but sufficient ✓
  5. Evidence requirements prevent false closure ✓
  6. Sigma architecturally separate from Delta Full ✓

- **Sigma vs Delta Full comparison check** — Verify Sigma does not confuse with Delta: binary names distinct, command surfaces distinct, folder structures distinct, no shared runtime state

- **Protocol accuracy review** — Re-read SIGMA_PROTOCOL.md against the final implemented CLI; patch any drift between documented behavior and actual behavior

- **Director review pass** — Director runs a representative project and gives feedback; any critical issues feed back to relevant phase WO as patch items

- **First-time user acceptance criterion** — A user who has not read SIGMA_PROTOCOL.md must be able to determine the next valid action solely from `sigma project status` or `sigma session bootstrap` output. If this fails, Sigma has started reproducing Delta's onboarding problem.

---

## Phase Dependencies Summary

```
Phase 0A (Doctrine)
    ↓
Phase 0B (Registry & Runtime Contract)
    ↓
Phase 1 (Templates) ──────┐
Phase 2 (Role Rules) ─────┤
Phase 3 (CLI Foundation) ←┘
    ↓
Phase 4 (CLI Workflow Commands)
    ↓
Phase 5 (Memory & Decision Harvest) ← can start in parallel with Phase 4
    ↓
Phase 6 (Distribution, Bridge Files & Skills)
    ↓
Phase 7 (Validation & Dogfooding)
```

- Phase 0A must be Director-reviewed before 0B begins.
- Phase 0B must be stable before Phase 3 begins — CLI reads registries and schema at runtime.
- Phases 1 and 2 can proceed concurrently with Phase 3 scaffolding, but Phase 4 must not start until Phase 0B + Phase 1 are both done.
- Phase 5 can start in parallel once Phase 4's lock commands exist.
- Skill files are in Phase 6 (not Phase 2) because they reference the final command surface and folder paths — writing them before CLI is built causes rewrite waste.

---

## Pending Items (6 open)

Items needing Director decision before or during the phase they affect:

| #   | Open Item                                                                              | Resolves In |
| --- | -------------------------------------------------------------------------------------- | ----------- |
| 1   | AUD activation: optional by default (AUD recommended, aligned with C8 in discussion.md) — confirm final wording in SIGMA_PROTOCOL.md | Phase 0A |
| 2   | Rules detail untuk roles — ARC, AUD, FMN, DEV (C13 deferred)                          | Phase 2     |
| 3   | Template & format dokumen detail (D10 deferred)                                        | Phase 1     |
| 4   | Sublayer authority labels dalam DIR-INTENT + FMN-PLAN template                         | Phase 1     |
| 5   | Isi dokumen closure / DIR-CLOSE format                                                 | Phase 1     |
| 6   | Detail teknis implementasi (daemon, auto-update, offline mode, telemetry — N deferred) | Phase 6     |

---

*Generated: 2026-05-16 — based on discussion.md Session #1 + Session #2 + DIR-DI-000-SIGMA-v1.0.md*
