# Implementation Plan — Phase 2b: ROADMAP Artifact

**Phase**: 2b (between Phase 2 and Phase 3)
**Goal**: Introduce ROADMAP as a formal optional artifact in Sigma governance — template, protocol definition, state machine, registry operations, and FMN-PLAN reference field.
**Status**: PENDING
**Type**: Governance / Runtime Contract Update — no CLI implementation code
**Prerequisites**: Phase 2 complete (4 role rule files in `Sigma/rules/` — DONE)
**Blocks**: PLAN-3.md must be updated after this phase (ROADMAP template added to setup bundle; registry operation count updated)

---

## Source Material

| File | Role |
| :--- | :--- |
| `Discussion/ROADMAP.md` | ROADMAP template draft — Director-authored, near-complete baseline |
| `Sigma/SIGMA_PROTOCOL.md` | Sections 5, 6, 8, 16 will be updated |
| `Sigma/rules/FMN-RULE.md` | Minor addition — ROADMAP as optional staging tool |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | 3 new roadmap operations; total count 36 → 39 |
| `Sigma/templates/FMN-PLAN-TEMPLATE.md` | Section 1 Source Alignment — add Source Roadmap Stage field |

---

## Design Decisions

### 1. Naming: Plain ROADMAP

The artifact is named `ROADMAP`, not `FMN-ROADMAP`.

Reason: The name reflects navigational purpose across the full project arc, not role ownership. "FMN-ROADMAP" would imply the document is scoped to the FMN role the same way FMN-PLAN is — but ROADMAP is a staging map that the Director reads and references, not a build contract.

FMN authors it. Director reads and signals on it. The name stays neutral.

---

### 2. Storage: `Sigma/build/`

ROADMAP is stored in `Sigma/build/` alongside FMN-PLAN and DEV-EXEC.

Reason: ROADMAP is FMN-owned and belongs to the BUILD context. It is not a DESIGN artifact (does not capture Director intent) and not a CLOSE artifact. Naming: `ROADMAP-v{VERSION}.md`.

---

### 3. Gate: DIR-INTENT LOCKED Only

ROADMAP requires one pre-condition: DIR-INTENT must be LOCKED (DESIGN phase must be complete).

FMN-PLAN does NOT require ROADMAP. Creating a ROADMAP is optional. A project may go directly from DIR-INTENT to FMN-PLAN with no ROADMAP. No gate is added between ROADMAP and FMN-PLAN.

Control sentence: ROADMAP says how many big stages. FMN-PLAN says what to build next.

---

### 4. State Machine: DRAFT → LOCKED → SUPERSEDED, Auto-Supersede on Lock

ROADMAP has three states:

```
DRAFT → LOCKED → SUPERSEDED
```

Auto-supersede behavior: when `sigma roadmap lock` is executed, any previous LOCKED ROADMAP is automatically SUPERSEDED. Only one ROADMAP may be LOCKED at a time (single-active).

DRAFT may coexist with a previous LOCKED version — a new ROADMAP-v2.0 may be in DRAFT while ROADMAP-v1.0 is still LOCKED. Auto-supersede fires only at lock time.

**Only one ROADMAP may be in DRAFT state at a time.** `sigma roadmap new` is blocked if a ROADMAP DRAFT already exists. To create a new version, lock the existing DRAFT first.

This matches DIR-INTENT behavior.

---

### 5. CLI: 3 Commands Only

```
sigma roadmap new      — create a new ROADMAP draft from template
sigma roadmap lock     — lock active DRAFT; auto-supersede previous LOCKED
sigma roadmap list     — list all ROADMAP versions with states
```

No audit, no review, no explicit supersede command. Supersede is fully automatic on lock.

`roadmap list` is included for completeness and diagnostic use. Typical projects will have only one ROADMAP version.

---

### 6. Director Interaction: Semantic Signal Only

Section 9 of the ROADMAP template ("Director Roadmap Notes") carries a semantic decision signal:

```
USE_AS_GUIDE / REVISE / DEFER / IGNORE
```

This signal is Director-facing notes only. It is NOT enforced by the CLI. ROADMAP lock does not require a Director signal. The signal is a communication mechanism, not a gate.

---

### 7. FMN-PLAN Source Reference: Optional Field in Section 1

If a FMN-PLAN is derived from a ROADMAP stage, Section 1 (Source Alignment) of FMN-PLAN must include:

```
- Source Roadmap Stage: ROADMAP-v1.0 — Stage 3 (CLI Foundation)
```

If no ROADMAP exists or the PLAN is not derived from a ROADMAP stage:

```
- Source Roadmap Stage: N/A
```

This creates traceability without adding a gate. FMN may write the PLAN without a ROADMAP — but if one exists and this PLAN covers a stage from it, the reference is required.

---

### 8. Multiple ROADMAPs Allowed; Typically One

There is no limit on the number of ROADMAP versions a project may create. A project may revise its staging plan as scope evolves.

Typical projects will have one ROADMAP, revised at most once. The `roadmap list` command exists for projects that need to inspect their staging history.

---

### 9. Template Source: Discussion/ROADMAP.md

`Discussion/ROADMAP.md` is the Director-authored draft baseline. It is near-complete.

Corrections required during TASK-2B-01:
- Verify no references to old folder conventions (`strategy/`, `execution/`, `closure/`) — replace with `design/`, `build/`, `close/` if found
- Verify Roadmap Policy section is intact and states: optional, FMN-owned, not a runtime gate

No structural changes to the template. Content is preserved verbatim except for convention corrections.

---

## Deliverables

| File | Action | Notes |
| :--- | :--- | :--- |
| `Sigma/templates/ROADMAP-TEMPLATE.md` | **Create** | Finalized from `Discussion/ROADMAP.md` |
| `Sigma/SIGMA_PROTOCOL.md` | **Update** | 4 section additions (5.6, 6.5, Section 8 update, Section 16 update) |
| `Sigma/rules/FMN-RULE.md` | **Update** | Add ROADMAP mention as optional staging tool |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | **Update** | Add roadmap domain (3 operations); total 36 → 39; add "roadmap" to domains array |
| `Sigma/templates/FMN-PLAN-TEMPLATE.md` | **Update** | Add Source Roadmap Stage field to Section 1 |
| `Sigma/progress.json` | **Update** | Add roadmap tracking block: active_version, active_state, versions[] |

---

## Tasks

| Task ID | Task | Priority |
| :--- | :--- | :--- |
| TASK-2B-01 | Create `Sigma/templates/ROADMAP-TEMPLATE.md` | Must |
| TASK-2B-02 | Update `SIGMA_PROTOCOL.md` — 4 section updates | Must |
| TASK-2B-03 | Update `Sigma/rules/FMN-RULE.md` | Should |
| TASK-2B-04 | Update `Sigma/SIGMA-OPERATION-REGISTRY.json` | Must |
| TASK-2B-05 | Update `Sigma/templates/FMN-PLAN-TEMPLATE.md` | Must |
| TASK-2B-06 | Update `Sigma/progress.json` — add roadmap tracking block | Must |

---

## Implementation Steps

### TASK-2B-01: Create ROADMAP-TEMPLATE.md

**Step 1**: Read `Discussion/ROADMAP.md` — verify content and check for old convention references.

**Step 2**: Create `Sigma/templates/ROADMAP-TEMPLATE.md`.

Content: verbatim from `Discussion/ROADMAP.md`. Apply corrections if found:
- Replace `strategy/` → `design/`, `execution/` → `build/`, `closure/` → `close/`
- Verify Roadmap Policy block is intact at the end of the file

---

### TASK-2B-02: Update SIGMA_PROTOCOL.md

**Step 3**: Read `Sigma/SIGMA_PROTOCOL.md` Section 5 (Artifact Definitions) — locate end of Section 5.5 (CSO).

**Step 4**: Insert Section 5.6 ROADMAP after Section 5.5. Content:

```markdown
### 5.6 ROADMAP — Implementation Staging Map

| Property       | Value               |
| -------------- | ------------------- |
| Owner          | FMN                 |
| Authored by    | FMN                 |
| Phase          | BUILD               |
| Storage        | `Sigma/build/`      |
| Versioning     | Tier 1              |
| Auto-supersede | Yes (single-active) |

Optional FMN-authored document that breaks a locked DIR-INTENT into large build stages before each stage is converted into an FMN-PLAN. ROADMAP is not a runtime gate — FMN-PLAN does not require a ROADMAP to exist.

ROADMAP describes how many phases and in what order. FMN-PLAN defines the next executable build contract.

Pre-condition to create: DIR-INTENT must be LOCKED. No other gate.

ROADMAP does not replace FMN-PLAN. A ROADMAP stage is not a build contract — it is a staging signal for FMN.

If ROADMAP conflicts with DIR-INTENT, DIR-INTENT wins.

> Template: `Sigma/templates/ROADMAP-TEMPLATE.md`
```

**Step 5**: Read `Sigma/SIGMA_PROTOCOL.md` Section 6 (State Machine) — locate end of Section 6.4 (DIR-CLOSE States).

**Step 6**: Insert Section 6.5 ROADMAP States after Section 6.4. Content:

```markdown
### 6.5 ROADMAP States

```
DRAFT → LOCKED → SUPERSEDED
```

| State        | Description                           | Triggered by                      |
| ------------ | ------------------------------------- | --------------------------------- |
| `DRAFT`      | Created; not yet locked               | `sigma roadmap new`               |
| `LOCKED`     | Staging plan accepted                 | `sigma roadmap lock`              |
| `SUPERSEDED` | Replaced when a new version is locked | Auto on new `sigma roadmap lock`  |

**Rules:**

- Only one ROADMAP may be LOCKED at a time (single-active)
- Only one ROADMAP may be in DRAFT state at a time — `sigma roadmap new` is blocked if a DRAFT already exists
- When a new version is LOCKED, the previously LOCKED version becomes SUPERSEDED automatically
- DRAFT may coexist with a LOCKED version — auto-supersede fires only at lock time
- No formal audit command exists for ROADMAP. AUD may provide informal advisory comments on ROADMAP if Director asks, but no CLI audit gate is enforced.
- Director interaction via Section 9 "Director Roadmap Notes" is semantic only — no CLI enforcement
```

**Step 7**: Read `Sigma/SIGMA_PROTOCOL.md` Section 8 (Auto-Supersede Policy) — locate the section.

**Step 8**: Add ROADMAP to the auto-supersede policy table or note. The section must state that ROADMAP follows the same single-active auto-supersede pattern as DIR-INTENT and DIR-CLOSE.

**Step 9**: Read `Sigma/SIGMA_PROTOCOL.md` Section 16 (CLI Command Surface) — locate the roadmap entry or the domains list.

**Step 10**: Add `roadmap` domain to Section 16 with the 3 commands:

```markdown
**`sigma roadmap`**
- `new` — create a new ROADMAP draft from template (pre-condition: DIR-INTENT LOCKED)
- `lock` — lock active DRAFT; auto-supersede previous LOCKED ROADMAP
- `list` — list all ROADMAP versions with states
```

---

### TASK-2B-03: Update FMN-RULE.md

**Step 11**: Read `Sigma/rules/FMN-RULE.md` — locate the section on FMN-PLAN Creation Rules or Core Responsibilities.

**Step 12**: Add a short subsection or paragraph under FMN Core Responsibilities or after the FMN-PLAN creation section:

```markdown
### Optional: ROADMAP as Staging Tool

FMN may create a ROADMAP before writing FMN-PLANs when the locked DIR-INTENT covers a large scope that benefits from staged breakdown.

ROADMAP is optional. FMN-PLAN does not require a ROADMAP.

If ROADMAP exists and a FMN-PLAN covers one of its stages, FMN MUST reference the source stage in FMN-PLAN Section 1 (Source Alignment):

> Source Roadmap Stage: ROADMAP-v{X} — Stage {N} ({Name})

If no ROADMAP exists, write N/A.
```

---

### TASK-2B-04: Update SIGMA-OPERATION-REGISTRY.json

**Step 13**: Read `Sigma/SIGMA-OPERATION-REGISTRY.json` — understand current structure (total_operations: 36, domains array).

**Step 14**: Update the registry:
- Change `"total_operations": 36` → `"total_operations": 39`
- Add `"roadmap"` to the `"domains"` array
- Append 3 new operation objects to the `"operations"` array:

```json
{
  "operation_id": "roadmap_new",
  "domain": "roadmap",
  "action": "new",
  "level": "semantic",
  "role": "any",
  "description": "Create a new ROADMAP draft from the ROADMAP template. Authored by FMN; Director may initiate. Initializes ROADMAP-v{N}.md in Sigma/build/ and registers the new version in progress.json with state DRAFT.",
  "inputs": [],
  "outputs": [
    { "type": "file", "description": "Sigma/build/ROADMAP-v{N}.md (from template)" },
    { "type": "state_change", "description": "progress.json: roadmap version added with state DRAFT" }
  ],
  "constraints": [
    { "type": "gate", "condition": "progress.intent.active_state == 'LOCKED'", "error_message": "ROADMAP requires a locked DIR-INTENT. Run: sigma intent lock" },
    { "type": "gate", "condition": "no ROADMAP version in state DRAFT", "error_message": "A ROADMAP DRAFT already exists. Lock it before creating a new version. Run: sigma roadmap lock" }
  ],
  "gating": {
    "pre_condition": "progress.intent.active_state == 'LOCKED'; no ROADMAP version currently in DRAFT state",
    "post_condition": "ROADMAP-v{N}.md exists in Sigma/build/; progress.json records new roadmap version with state DRAFT"
  },
  "error_messages": {
    "no_locked_intent": "No locked DIR-INTENT found. ROADMAP requires a locked intent. Run: sigma intent lock",
    "draft_exists": "A ROADMAP DRAFT already exists. Lock it before creating a new version. Run: sigma roadmap lock"
  }
},
{
  "operation_id": "roadmap_lock",
  "domain": "roadmap",
  "action": "lock",
  "level": "semantic",
  "role": "director",
  "description": "Lock the active ROADMAP DRAFT. Auto-supersedes any previously LOCKED ROADMAP version. Only one ROADMAP may be LOCKED at a time.",
  "inputs": [],
  "outputs": [
    { "type": "state_change", "description": "progress.json: active ROADMAP DRAFT state → LOCKED" },
    { "type": "state_change", "description": "progress.json: previous LOCKED ROADMAP → SUPERSEDED (auto, if exists)" }
  ],
  "constraints": [
    { "type": "existence", "condition": "At least one ROADMAP version must be in DRAFT state", "error_message": "No ROADMAP DRAFT found to lock. Run: sigma roadmap new" }
  ],
  "gating": {
    "pre_condition": "At least one ROADMAP version in state DRAFT",
    "post_condition": "Active ROADMAP state == LOCKED; previous LOCKED ROADMAP (if any) state == SUPERSEDED"
  },
  "error_messages": {
    "no_draft": "No ROADMAP DRAFT found. Run: sigma roadmap new"
  }
},
{
  "operation_id": "roadmap_list",
  "domain": "roadmap",
  "action": "list",
  "level": "read_only",
  "role": "any",
  "description": "List all ROADMAP versions with their current states (DRAFT, LOCKED, SUPERSEDED).",
  "inputs": [],
  "outputs": [
    { "type": "display", "description": "Table of ROADMAP versions: version, state, file path" }
  ],
  "constraints": [
    { "type": "existence", "condition": "Sigma/progress.json must exist", "error_message": "No Sigma project found. Run: sigma project start" }
  ],
  "gating": {
    "pre_condition": "Sigma/progress.json exists",
    "post_condition": "none (read-only)"
  },
  "error_messages": {
    "not_found": "No Sigma project found. Run: sigma project start"
  }
}
```

---

### TASK-2B-05: Update FMN-PLAN-TEMPLATE.md

**Step 15**: Read `Sigma/templates/FMN-PLAN-TEMPLATE.md` — locate Section 1 (Source Alignment).

**Step 16**: Add `Source Roadmap Stage` field to Section 1 bullet list:

```markdown
- Source Roadmap Stage: ROADMAP-v{X} — Stage {N} ({Name}) / N/A
```

Place after the existing Source Alignment fields (Intent point served, Scope boundary respected, Success criteria supported, Constraint or risk addressed).

---

### TASK-2B-06: Update progress.json

**Step 17**: Read `Sigma/progress.json` — locate the artifact tracking structure to understand existing schema pattern.

**Step 18**: Add roadmap tracking block to `progress.json`. Pattern follows existing artifact tracking nodes:

```json
"roadmap": {
  "active_version": null,
  "active_state": null,
  "versions": []
}
```

This provides the runtime state store for `roadmap_new`, `roadmap_lock`, and `roadmap_list` operations.

---

## Acceptance Criteria

| AC ID | Criteria | Verification Method |
| :--- | :--- | :--- |
| AC-001 | `Sigma/templates/ROADMAP-TEMPLATE.md` exists | File exists |
| AC-002 | Template uses `design/`, `build/`, `close/` — no old `strategy/`, `execution/`, `closure/` references | Read file |
| AC-003 | Template Roadmap Policy section states: optional, FMN-owned, not a runtime gate, does not replace FMN-PLAN | Read file |
| AC-004 | `SIGMA_PROTOCOL.md` Section 5 contains Section 5.6 ROADMAP artifact definition | Read file, grep |
| AC-005 | Section 5.6 states: FMN-owned, optional, stored in `Sigma/build/`, pre-condition is DIR-INTENT LOCKED only | Read section |
| AC-006 | `SIGMA_PROTOCOL.md` Section 6 contains Section 6.5 ROADMAP States (DRAFT → LOCKED → SUPERSEDED) | Read file |
| AC-007 | Section 6.5 states: single-active, auto-supersede on lock, no audit command | Read section |
| AC-008 | `SIGMA_PROTOCOL.md` Section 8 includes ROADMAP in auto-supersede policy | Read section |
| AC-009 | `SIGMA_PROTOCOL.md` Section 16 lists roadmap domain with 3 commands (new, lock, list) | Read section |
| AC-010 | `Sigma/rules/FMN-RULE.md` has ROADMAP section noting it is optional and Source Roadmap Stage reference is required if PLAN derives from ROADMAP | Read file |
| AC-011 | `SIGMA-OPERATION-REGISTRY.json` total_operations == 39 | Read file |
| AC-012 | `SIGMA-OPERATION-REGISTRY.json` domains array includes "roadmap" | Read file |
| AC-013 | `SIGMA-OPERATION-REGISTRY.json` has 3 roadmap operations: roadmap_new, roadmap_lock, roadmap_list | Read file |
| AC-014 | roadmap_new pre_condition: intent.state == LOCKED | Read registry entry |
| AC-015 | roadmap_lock post_condition: previous LOCKED ROADMAP → SUPERSEDED (auto) | Read registry entry |
| AC-016 | roadmap_list level: read_only, no pre_condition beyond progress.json existence | Read registry entry |
| AC-017 | `Sigma/templates/FMN-PLAN-TEMPLATE.md` Section 1 includes `Source Roadmap Stage` field | Read file |
| AC-018 | `Sigma/progress.json` contains roadmap tracking block with `active_version`, `active_state`, `versions[]` | Read file |
| AC-019 | roadmap_new constraints include: `progress.intent.active_state == 'LOCKED'` and no existing DRAFT | Read registry entry |
| AC-020 | roadmap_new role is `any` (not restricted to fmn) with note that FMN authors, Director may initiate | Read registry entry |

---

## Post-Completion: PLAN-3.md Updates Required

After Phase 2b is implemented, `Implementation/PLAN-3.md` must be updated:

1. **Prerequisites**: Add "Phase 2b complete" to the prerequisites list
2. **Source Material**: Add `Sigma/templates/ROADMAP-TEMPLATE.md` to the list of templates bundled in `sigma setup install`
3. **Registry note**: Update any reference to "36 operations" → "39 operations" in SIGMA-OPERATION-REGISTRY.json
4. **Phase 4 scope note**: Note that `roadmap new`, `roadmap lock`, `roadmap list` are Phase 4 CLI commands (like other artifact lifecycle commands)

After Phase 2b is implemented, `Implementation/PLAN-4.md` (when created) must include:

- `roadmap new`, `roadmap lock`, `roadmap list` command implementations
- ROADMAP state engine integration (single-DRAFT enforcement, auto-supersede on lock)
- `progress.json` roadmap block read/write operations
