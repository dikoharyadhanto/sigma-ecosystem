# Sigma — Phase Implementation 2 Notes

> **Status**: Working Notes — Professional Mode
> **Source**: `Discussion/sigma_planned_fix.md`
> **Purpose**: Structured breakdown of all proposed fixes, categorized by implementation type,
>              complexity estimate, and sequencing dependency.

---

## Overview

The planned fix document identifies **16 numbered proposals** across three topic clusters:

| Cluster | Proposals | Type |
| :--- | :--- | :--- |
| CLI Ergonomics | 1–6 | CLI changes |
| DEV Role Protocol | 7–12 | Rule/template/CLI mix |
| Roadmap Section Management | 13–16 | CLI + template + rule |

---

## Cluster A — CLI Ergonomics (Proposals 1–6)

### 1. Exec New Guard + Correct Plan Selection Logic

**Context**: Proposal 1 originally called for `--v` flag on lock commands to handle
multi-DRAFT ambiguity. That problem is already solved — `plan new` has a DRAFT CONFLICT
guard preventing multiple DRAFTs from ever existing simultaneously. The `--v` flag is
not needed.

The real gap is in `exec new`, which has two problems:

**Pain A — No non-locked guard**: `exec new` only checks `gate_2_open`. It does not
block creation of a new exec if a previous exec is still in `DRAFT`, `BUILDING`,
`TESTING`, or `COMPLETED` state. Multiple active execs can exist, violating the
"only one non-locked exec at a time" invariant.

**Pain B — Wrong plan selection**: `exec new` always references the newest LOCKED plan:
```typescript
const planVersionRef = lockedPlans[lockedPlans.length - 1].version;
```
If PLAN v1.11, v1.12, v1.13 are all LOCKED and none have a LOCKED exec, `exec new`
references v1.13 and silently skips v1.11 and v1.12 — they will never get an exec.

**Fix A — Non-locked guard in `exec new`**:
Block if any exec version is in a non-LOCKED / non-SUPERSEDED state:
```
EXEC CONFLICT: DEV-EXEC v1.12 is in BUILDING state.
Lock it before creating a new exec.
```

**Fix B — Plan selection via unexecuted plan lookup**:
Instead of "newest locked plan," find LOCKED plans that do not have a corresponding
LOCKED exec (match via `plan_version_ref` in exec history).

Behavior:
- **Exactly one** unexecuted locked plan → auto-select (no change to UX for normal flow)
- **More than one** unexecuted locked plan → block and require explicit flag:
  ```
  ERROR: 3 unexecuted locked plans found: v1.11, v1.12, v1.13
  Specify which to execute: sigma exec new --plan v1.11
  ```
- **Zero** unexecuted locked plans → block:
  ```
  ERROR: All locked plans already have locked execs. Run: sigma plan new
  ```

**Implementation type**: CLI change
**Scope**: `exec new` command + `registerExecDraft` guard in engine
**Complexity**: Low-Medium. Guard is straightforward. Plan selection requires filtering
exec history by `plan_version_ref` and state.
**Dependency**: None — standalone fix.

---

### 2. Simplify DEV-EXEC State Machine to DRAFT → LOCKED

**Pain**: DEV-EXEC state machine has five states: `DRAFT → BUILDING → TESTING → COMPLETED → LOCKED`.
The intermediate states (BUILDING, TESTING, COMPLETED) carry no governance weight — no gate
opens, no command unlocks, no behavior changes at any intermediate transition. DEV manually
advances through them even when work is already complete. They are ceremonial overhead.

The actual quality signal is in the **DEV-EXEC document content** (task completion sections,
test results, deviation log) — not in CLI state labels. FMN reviews content, not state.

**Fix**: Collapse to `DRAFT → LOCKED`. Remove `sigma exec advance` command entirely.

Scope of changes:
- `exec.ts`: remove `advance` subcommand and `STAGE_MAP`; change `exec lock` guard from
  `active_state !== 'COMPLETED'` to `active_state !== 'DRAFT'`
- `progress.ts`: remove `advanceExecState` function; simplify `ExecState` type to
  `'DRAFT' | 'LOCKED' | 'SUPERSEDED'`; remove intermediate states from valid states list;
  remove BUILDING/TESTING suggestion from bootstrap next-operations logic

**Migration concern**: Existing `progress.json` files with exec versions in BUILDING,
TESTING, or COMPLETED state will fail schema validation after this change. Validator must
either auto-coerce those states to DRAFT on read, or a `sigma migrate` command is needed.

**Implementation type**: CLI + engine change
**Complexity**: Low. All references to intermediate states are contained in two files
(`exec.ts`, `progress.ts`) with no external dependencies.
**Dependency**: None — can be done standalone. Does not affect Proposal 6 (lock preflight).

---

### 4. ROADMAP Mandatory Gate + Version Tied to INTENT + Auto-Lock on Closure

**Context**: `sigma roadmap new`, `sigma roadmap lock`, and `sigma roadmap list` already
exist. The original pain (locked roadmap can't be revised) is solved. This proposal
replaces the original Proposal 4 with a deeper governance redesign.

**Three problems with current design**:

1. ROADMAP is optional — `plan new` has no dependency on ROADMAP existence
2. ROADMAP version auto-increments independently from INTENT (`length + 1`), no explicit
   binding — nothing prevents ROADMAP v3 being created while INTENT is still v1
3. ROADMAP can be manually locked at any time, which is too strict for a document
   that legitimately changes as stages are added throughout the project

**New design**:

**A — ROADMAP version = INTENT major version**

`roadmap new` derives its version directly from the current locked INTENT major:
- INTENT v1 locked → `sigma roadmap new` creates ROADMAP v1
- INTENT v2 locked → `sigma roadmap new` creates ROADMAP v2

`roadmap new` is blocked if a ROADMAP for the current INTENT major already exists:
```
ROADMAP v1 already exists for INTENT v1.
To create a new roadmap, create a new INTENT version first.
```

ROADMAP stores `intent_version_ref` in `progress.json` (same pattern as PLAN → INTENT).

**B — `plan new` requires ROADMAP for matching INTENT**

`plan new` adds a new gate check: a ROADMAP must exist (DRAFT state is sufficient)
for the same INTENT major version. PLAN v0.x needs ROADMAP v1, PLAN v1.x needs ROADMAP v2.

```
GATE BLOCKED: No ROADMAP found for INTENT v1.
Run: sigma roadmap new
```

**C — ROADMAP stays DRAFT for entire project lifecycle; auto-locks on CLOSURE**

Remove `sigma roadmap lock` from the public CLI surface. ROADMAP is a living document —
freely editable as long as the project is active. It auto-locks only when
`sigma close lock` is executed.

`close lock` internally calls `lockActiveRoadmap` before writing progress. This is the
only path to a LOCKED ROADMAP.

This design reflects real usage: closure is rare and intentional. Until then, ROADMAP
should always be current and editable without ceremony.

**Lifecycle**:
```
sigma intent lock (v1)
  → sigma roadmap new  (creates ROADMAP v1, DRAFT)
    → freely editable throughout project
    → sigma plan new / lock / exec cycles ... (all require ROADMAP v1 to exist)
    → sigma close lock  (auto-locks ROADMAP v1 → LOCKED)

If project continues:
  → sigma intent new / lock (v2)
    → sigma roadmap new (creates ROADMAP v2, DRAFT)
    → sigma plan new ... (requires ROADMAP v2)
```

**Scope of changes**:
- `roadmap.ts`: derive version from INTENT major; add existence guard; remove public `lock` subcommand
- `close.ts`: call `lockActiveRoadmap` before writing close lock progress
- `plan.ts`: add ROADMAP existence check in `plan new`
- `progress.ts`: add `intent_version_ref` to roadmap version entries; update `registerRoadmapDraft` signature

**Implementation type**: CLI + governance model change
**Complexity**: Medium. No new commands — modifications to existing commands and one
new gate check. The version derivation logic is straightforward.
**Dependency**: None. Can be implemented standalone.

---

### 5. Remove DRAFT CONFLICT Guard + FIFO Lock + Pending Plan Staging

**Context**: Original Proposal 5 called for `--parallel-draft` as an escape hatch.
After discussion, the correct design is broader: PLAN should allow multiple simultaneous
DRAFTs by default, with a separate staging mechanism for pre-formal planning work.

**Three changes in one proposal:**

**A — Remove DRAFT CONFLICT guard from `plan new`**

The guard at `plan.ts:37-45` that blocks creation of a second DRAFT is wrong.
FMN should be able to create as many DRAFT plans as needed simultaneously.
The only requirements for `plan new` are: locked INTENT + ROADMAP exists (Proposal 4).

**B — `plan lock` uses FIFO — always locks oldest DRAFT**

With multiple DRAFTs possible, `plan lock` must be deterministic. It always locks
the DRAFT with the earliest `created_at`. No `--v` flag, no user selection.
This enforces discipline: older plans are locked before newer ones.

```
DRAFTs: v1.11 (oldest), v1.12, v1.13
sigma plan lock → locks v1.11
sigma plan lock → locks v1.12
sigma plan lock → locks v1.13
```

**C — `sigma plan new --pending` + `sigma plan promote --id`**

**The real pain**: FMN has ideas for future stages that are not ready for the official
version sequence. Currently these get written to a manual `pending/` folder with no
CLI awareness — they don't appear in `sigma session bootstrap`, `sigma plan list`,
or any status output. Plans exist but the system doesn't know they exist.

**Fix — two new commands:**

`sigma plan new --pending`
- Creates file in `Sigma/pending/FMN-PLAN-{id}.md` (short ID, not version-based)
- Registers in `progress.json` under new `plan.pending` array:
  `{ id: "xxxx", file: "...", created_at: "..." }`
- No version, no state machine, not in lock queue
- Appears in `sigma plan list` and `sigma session bootstrap` as pending items

`sigma plan promote --id xxxx`
- Finds pending plan by ID
- Auto-assigns next plan version (e.g., v1.14)
- Renames file: `Sigma/pending/FMN-PLAN-{id}.md` → `Sigma/build/FMN-PLAN-v1.14.md`
- Moves entry from `plan.pending` to `plan.versions` as DRAFT
- Promoted plan joins the FIFO lock queue at the back

**Two-tier planning system:**

| Tier | Commands | Versioned | In lock queue | Tracked |
| :--- | :--- | :--- | :--- | :--- |
| Pending | `plan new --pending`, `plan promote` | No (ID only) | No | Yes |
| Draft | `plan new`, `plan lock` | Yes | Yes (FIFO) | Yes |

**Implementation type**: CLI + engine + schema change
**Scope**: `plan.ts` (remove guard, add `--pending` flag, add `promote` subcommand);
`progress.ts` (add `plan.pending` array to schema, `registerPendingPlan`, `promotePendingPlan`);
`session bootstrap` output (show pending count)
**Complexity**: Medium.
**Dependency**: Proposal 4 (ROADMAP gate) should land first — `plan new` without the
DRAFT guard relies on ROADMAP as the primary creation gate.

---

## Cluster B — DEV Role Protocol (Proposals 7–12)

### 7. Template Redesign — FMN-PLAN Slim + DEV-EXEC as Single Review Document

**Root cause**: FMN-PLAN currently mixes pre-build content (Sections 1–6, correctly
locked) with post-build content (Sections 7–9: test results, FMN findings, AUD findings).
Once FMN-PLAN is locked, AI correctly treats it as immutable. But Sections 7–9 are
supposed to be filled post-build. This contradiction causes FMN to skip its own review
sections and migrate informally to DEV-EXEC — which is already writable and contains the
same information. The result: FMN-PLAN sections 7–9 are left empty, and DEV-EXEC becomes
the de-facto review document by accident, not by design.

**Fix**: Make this explicit by design. FMN-PLAN becomes a pure work order contract —
clean after lock, never needs re-updating. DEV-EXEC becomes the single document where
DEV writes evidence and FMN conducts review.

---

#### FMN-PLAN Template — Revised Structure

Remove Sections 7–11 entirely. FMN-PLAN contains exactly 6 sections — all pre-build,
all written before lock, all immutable after lock.

| Section | Content | Filled By | When |
| :--- | :--- | :--- | :--- |
| 1 | Source Alignment | FMN | Before lock |
| 2 | Work Order / Task Plan | FMN | Before lock |
| 3 | Acceptance Criteria | FMN | Before lock |
| 4 | Implementation Constraints | FMN | Before lock |
| 5 | Pre-Build Test Contract | FMN | Before lock |
| 6 | DEV Handoff Instructions | FMN | Before lock |

After lock: all sections immutable. FMN never touches FMN-PLAN again.
No post-lock writable sections. No exceptions.

---

#### DEV-EXEC Template — Revised Structure

All sections clearly annotated by who fills them and when. FMN review is formalized as
dedicated sections at the end — checklist-based, not narrative duplication.

**DEV fills — Before Build (pre-implementation planning):**

| Section | Content | Note |
| :--- | :--- | :--- |
| 1 | Source Plan Alignment | Confirm FMN-PLAN ref; read AC and test contract |
| 2 | Implementation Approach | Plan what will be built, technical approach, rationale |
| 3 | Files / Components To Change | List files expected to be touched |
| 4 | Key Technical Decisions | Decisions made before coding starts |

**DEV fills — After Build (post-implementation evidence):**

| Section | Content | Note |
| :--- | :--- | :--- |
| 5 | Implementation Walkthrough | What was actually built, how it works, main flow |
| 6 | Deviations From FMN-PLAN | Record deviations; see checklist below |
| 7 | Dependency / Environment Changes | What actually changed in deps/env |
| 8 | Developer Verification | Test counts, smoke results, build status |
| 9 | Git / Change Evidence | Branch, commits, diff summary |
| 10 | Issues Encountered | Issues found during build |
| 11 | Known Limitations / Technical Debt | Tech debt introduced |
| 12 | DEV Completion Statement | Final summary + advisory status for FMN |

**Deviation Update Checklist** — added inside Section 6, rendered when DEV adds a
deviation row. Forces atomic update across all affected sections:

```
> **Deviation Update Checklist** — when any deviation is added above, verify:
> - [ ] Section 2 — implementation approach still accurate?
> - [ ] Section 5 — walkthrough reflects actual implementation?
> - [ ] Section 8 — test counts and results still current?
> - [ ] Section 9 — git evidence reflects latest commits?
> - [ ] Section 10 — issue recorded if deviation came from a bug?
> - [ ] Section 12 — completion summary consistent with all changes?
```

**FMN fills — After DEV completes (post-build review in DEV-EXEC):**

| Section | Content | Note |
| :--- | :--- | :--- |
| 13 (NEW) | FMN Review | Checklist of AC verification against FMN-PLAN; test contract result per TC-ID; advisory verdict |
| 14 (NEW) | AUD Findings | Advisory only; moved from FMN-PLAN |

**Director fills — Post-FMN review (in DEV-EXEC):**

| Section | Content | Note |
| :--- | :--- | :--- |
| 15 (NEW) | Director Observation Testing Report | Moved from FMN-PLAN; append-only; raw manual testing signals |
| 16 (NEW) | Director Follow-Up Decision Notes | Moved from FMN-PLAN; always writable; lock/proceed decisions |

Director observations belong in DEV-EXEC, not FMN-PLAN — because the Director is
observing the actual work evidence, not the pre-build plan.

FMN Section 13 structure:
```
## 13. FMN Review

### AC Verification
| AC ID | Criteria (ref FMN-PLAN) | Evidence in DEV-EXEC | Status |
| :--- | :--- | :--- | :--- |
| AC-001 | [...] | Section X / [...] | PASS / FAIL / PARTIAL |

### Test Contract Result
| TC ID | Expected (ref FMN-PLAN) | Actual Result | Status |
| :--- | :--- | :--- | :--- |
| TC-001 | [...] | [...] | PASS / FAIL / NOT_RUN |

### Advisory Verdict
READY_FOR_LOCK / NEEDS_DEV_UPDATE / REVISION_REQUIRED / COMPLETE_WITH_RISK

### FMN Notes
[...]
```

DEV must not write in Sections 13–14. FMN must not write in Sections 1–12.

---

**Implementation type**: Template change only — no CLI needed
**Scope**: `FMN-PLAN-TEMPLATE.md` (remove Sections 7–9, renumber);
`DEV-EXEC-TEMPLATE.md` (add section annotations, deviation checklist in Section 6,
add Sections 13–14)
**Complexity**: Low. Document editing only.
**Dependency**: None. Can be done in any session without affecting CLI or governance state.

---

### 8. DEV Pre-Build Assessment Section

**Pain**: Current flow has no formal channel for DEV to express concerns, disagreements,
or questions about the FMN-PLAN before coding starts. DEV silently accepts the plan and
proceeds — or interrupts mid-session when problems surface. When assumptions are wrong,
they are caught post-build by FMN (e.g., AC-003 route guard gap in v1.13), creating
costly NEEDS_DEV_UPDATE cycles. The security checklist idea from the original proposal
is subsumed here — security concerns surface naturally as part of DEV's assessment.

**Fix**: Add a new Section 1b — **DEV Pre-Build Assessment** — positioned between
Section 1 (Source Plan Alignment) and Section 2 (Implementation Approach).

DEV fills this section **after** studying the FMN-PLAN and reviewing context from
previous build sessions (prior DEV-EXEC, CSO artifacts), **before** writing the
implementation approach.

**Section structure**:

```
## 1b. DEV Pre-Build Assessment

### Context Reviewed
- Prior DEV-EXEC studied: [version(s) or N/A]
- CSO / handoff artifacts consulted: [list or N/A]

### Plan Assessment
| Item | DEV Assessment | Status |
| :--- | :--- | :--- |
| [AC or task from FMN-PLAN] | [DEV's understanding or concern] | Clear / Unclear |

### Questions & Concerns
[DEV writes open questions, disagreements, or risks not covered by the plan.
If none, write: No concerns — plan is clear and sufficient to proceed.]

### DEV Readiness Status
CLEAR / NEED_CLARIFICATION

[If NEED_CLARIFICATION: list specific unresolved items that require FMN or Director response]
```

**Rules**:
- Section 1b is **always required** — DEV cannot skip it even if status is CLEAR
- Section 2 (Implementation Approach) is **always required** regardless of status —
  DEV writes the plan based on current understanding
- If status is `NEED_CLARIFICATION`: FMN answers the open items, then DEV
  **updates Section 2 (and related sections)** before Director approves to proceed
- If status is `CLEAR`: FMN reviews Section 1b + 2-4 in one pass and recommends lock

**Two interaction paths**:

```
CLEAR path (no concerns):
  DEV fills 1b (CLEAR) + 2-4 → FMN reviews all → Director approves → DEV builds

NEED_CLARIFICATION path:
  DEV fills 1b (NEED_CLARIFICATION) + 2-4 (based on current understanding)
  → FMN answers open items
  → DEV updates Section 2 (and affected sections)
  → FMN reviews updated plan
  → Director approves → DEV builds
```

FMN's response to a NEED_CLARIFICATION assessment is recorded in **Section 13 (FMN Review)**
under a new "Pre-Build Clarification" sub-section, not back in Section 1b — keeping
DEV-authored and FMN-authored content in separate sections.

**Implementation type**: Template change only — no CLI needed
**Scope**: `DEV-EXEC-TEMPLATE.md` (add Section 1b between Section 1 and Section 2)
**Complexity**: Low. Document editing only.
**Dependency**: Proposal 7 — both are DEV-EXEC template changes, implement in same pass.

---

### 9. Bootstrap Step Skip for Warm Context

**Pain**: The 4-step bootstrap (sigma-memory query, `sigma --help`, `sigma session bootstrap`,
lifecycle report) is fully valuable for cold sessions. When a session continues immediately
after an FMN advisory with full context active, steps 1–2 feel mechanical.

**Decision**: No structural protocol change needed. This is a discipline note.

**Fix**: Add a note to DEV-RULE.md: "If a CSO or active FMN advisory exists from within
the same work session, bootstrap may begin at step 3 with a brief note that steps 1–2
were skipped due to warm context."

**Implementation type**: Rule change — no CLI needed
**Scope**: DEV-RULE.md only
**Complexity**: Trivial.
**Dependency**: None.

---

### 10. Authorization Language Table + Project Language Preference

Two related changes under one proposal — both address language handling in Sigma sessions.

---

#### Part A — Authorization Language Table: Indonesian Equivalents

**Pain**: DEV-RULE.md covers authorization language but only in English. Directors
sometimes use Indonesian phrases mid-session and DEV must interrupt to confirm whether
authorization was given.

**Fix**: Expand the authorization table in DEV-RULE.md (and FMN-RULE.md, ARC-RULE.md
for consistency) with Indonesian cases and explicit borderline rulings:

| Phrase | Classification |
| :--- | :--- |
| "silakan" | Ambiguous — not sufficient |
| "lanjutkan" | Ambiguous — not sufficient |
| "ya, lanjutkan lock" | Sufficient |
| "oke dikunci" | Sufficient |
| "iya approved" | Sufficient |
| "nanti dulu" | Rejection signal |

---

#### Part B — Project Language Preference (`sigma.config.json`)

**Pain**: Director language preference is implicit — AI roles have no formal signal for
which language to use when communicating with the Director. Without an explicit setting,
every session risks defaulting to English even when the Director prefers Indonesian.

**Design decision**: Language preference is a **project setting**, not governance state.
It belongs in a separate config file, not in `progress.json`. Mixing user preference
into `progress.json` would pollute the governance state schema.

**New file**: `Sigma/sigma.config.json`

```json
{
  "language": "id"
}
```

Supported values: `"en"` (default), `"id"` (Indonesian), or any IETF language tag.
If the file is absent or the field is missing, default is `"en"`.

**New command**: `sigma config set language <value>`

Sets `language` in `Sigma/sigma.config.json`. Creates the file if it does not exist.

```
$ sigma config set language id
Language preference set to: id (Indonesian)
```

**Bootstrap protocol addition** (all AI roles):

After step 3 (`sigma session bootstrap`), roles check `Sigma/sigma.config.json`:
- If `language: "id"` → conduct all Director-facing communication in Indonesian
- If `language: "en"` or absent → communicate in English

**Critical rule — artifact content is always English regardless of language setting.**

`sigma.config.json` controls AI ↔ Director communication language only. FMN-PLAN,
DEV-EXEC, ROADMAP, rule files, and all governance artifacts are always written in
English. This preserves shareability and publishability of all project artifacts.

This rule is added to `SIGMA_PROTOCOL.md` and all role rules.

**Scope of changes**:
- `src/commands/config.ts` (new) — `sigma config set language <value>`; reads/writes `Sigma/sigma.config.json`
- `Sigma/SIGMA_PROTOCOL.md` — add Language Preference section
- All role rules (`DEV-RULE.md`, `FMN-RULE.md`, `ARC-RULE.md`, `AUD-RULE.md`) — add bootstrap note to read `sigma.config.json` + artifact language rule
- All skill files (`arc.md`, `fmn.md`, `dev.md`, `aud.md`) — same bootstrap addition

---

**Implementation type**: Part A — rule change only; Part B — CLI + config + rule/protocol change
**Complexity**: Part A — Trivial. Part B — Low (new config file + simple read/write command;
no schema migration needed since this is a new file separate from `progress.json`).
**Dependency**: None. Both parts are standalone.

---

### 11. Remove Decision Memory System (`decisions.jsonl` + harvest engine)

**Decision**: Total removal. The decision memory system (`decisions.jsonl` + `engine/memory.ts`)
is redundant with the locked artifact files and creates an active behavioral risk for AI
roles — having a pre-digested summary available causes satisficing behavior where the
AI treats orientation from `decisions.jsonl` as sufficient and reads locked artifacts
less carefully. Simulation against a real CanopySense project confirmed this: DEV-EXEC
content (implementation approach, deviations, verification evidence, deferred scope) is
far more actionable than a 307KB JSONL log of harvested sections from the same documents.

**Root cause of the system existing**: Designed to give AI roles historical orientation
across sessions. In practice, the same orientation is achieved by reading the ROADMAP
(stage overview, plan refs) and the last locked FMN-PLAN + DEV-EXEC directly. The
decision memory adds no unique information — it only adds noise and context-window cost.

**Scope of removal**:

| File | Change |
| :--- | :--- |
| `src/engine/memory.ts` | **Delete entirely** — all harvest functions removed |
| `src/commands/plan.ts` | Remove `harvestPlanLock` import and call in `plan lock` |
| `src/commands/exec.ts` | Remove `harvestExecLock` import and call in `exec lock` |
| `src/commands/intent.ts` | Remove `harvestIntentLock` import and call in `intent lock` |
| `src/commands/roadmap.ts` | Remove `harvestRoadmapLock` import and call in `roadmap lock` |
| `src/commands/close.ts` | Remove `harvestCloseLock` + `initDecisionsFile` import and calls |
| `src/config.ts` | Remove `PROJECT_DECISIONS_FILE` constant |
| `Sigma/rules/DEV-RULE.md` | Remove any reference to `decisions.jsonl` or memory bootstrap step |
| `Sigma/rules/FMN-RULE.md` | Same — remove memory references |
| `Sigma/rules/ARC-RULE.md` | Same — remove memory references |
| `Sigma/skills/` (`/dev`, `/fmn`, `/arc`, `/aud`) | Remove memory bootstrap steps if present |
| `Sigma/memory/decisions.jsonl` | **Not deleted by CLI** — existing project files are not touched.
                                    Note in migration guide only. |

**What replaces it for orientation**:

Nothing is added. DEV orientation happens by reading locked artifacts directly:
1. `sigma session bootstrap` — shows lifecycle state and gate status
2. ROADMAP (Proposal 4/13–16) — shows stage history and plan refs
3. Active FMN-PLAN — implementation contract for current stage
4. Last locked DEV-EXEC — prior build evidence and deferred scope

These are always authoritative and always current. `decisions.jsonl` was a derived
copy of this information with a staleness risk and a satisficing risk.

**`sigma-memory` MCP is NOT affected** — `sigma-memory` is a separate Reasonix MCP
server for ecosystem-level constants. It is not the same as `decisions.jsonl`.

**Implementation type**: CLI + engine removal + rule/skill file cleanup
**Scope**: Delete `engine/memory.ts`; remove harvest calls from 5 command files;
remove config constant; clean rule/skill files
**Complexity**: Low. Mechanical removal — no new logic, only deletions and import cleanup.
**Dependency**: None. Can be done standalone in any session.

---

### 12. Role Isolation Reminder in All Sigma Skill Files

**Pain**: In v1.13, the DEV role referred to "ANT" — a role from Delta, the obsolete
predecessor to Sigma. Root cause: the global CLAUDE.md still references ANT/CDC for other
projects. When the AI loads context, global rules and project rules coexist, and without
a strong isolation signal, deprecated role names bleed in silently.

**Risk**: Not just terminology. If ANT is described globally as "the implementing role" and
DEV internalizes that framing, it can subtly affect implementation reasoning even if output
looks correct.

**Root cause investigated**: Global memory audit across all AI agents confirms three
active contamination sources:

| AI | Contamination Location | Content |
| :--- | :--- | :--- |
| Claude | `~/.claude/CLAUDE.md` | ANT/CDC still defined globally — loaded in every session |
| Reasonix | `~/.reasonix/skills/ant.md`, `cdc.md` | Delta skill files coexist with Sigma skills |
| Codex | `~/.codex/skills/ant/`, `cdc/` | Delta skill folders coexist with Sigma skills |
| Gemini | `~/.gemini/agents/ant.md`, `cdc.md` | Delta agent files coexist with Sigma agents |

Gemini's `~/.gemini_context/gemini_memory` and `~/.gemini_context/gemini_rules` are clean
(system setup content only, no AI role definitions).

Additionally, `/checkpoint` and `/cso` skill files exist in all four agents —
these should also be removed per Proposal 17.

**Two-part fix**:

**Part A — sigma-cli: Isolation reminder block in all Sigma skill files**

Add at the top of each skill file activation block:
```
Active governance system: SIGMA
Valid roles in this session: ARC, FMN, DEV, AUD
Any reference to ANT, CDC, GMN, or Delta roles is an error.
If you detect yourself using those terms, stop and correct immediately.
```

**Part B — Director manual cleanup (outside sigma-cli scope)**

The following files must be cleaned manually per AI:

**Claude**: Update `~/.claude/CLAUDE.md` — scope ANT/CDC definitions to specific project
paths only, or remove them entirely if the ANT project is no longer active.

**Reasonix**: Delete or deprecate:
- `~/.reasonix/skills/ant.md`
- `~/.reasonix/skills/cdc.md`
- `~/.reasonix/skills/checkpoint.md` (P17)
- `~/.reasonix/skills/cso.md` (P17)

**Codex**: Delete or deprecate:
- `~/.codex/skills/ant/`
- `~/.codex/skills/cdc/`
- `~/.codex/skills/checkpoint/` (P17)
- `~/.codex/skills/cso/` (P17)

**Gemini**: Delete or deprecate:
- `~/.gemini/agents/ant.md`
- `~/.gemini/agents/cdc.md`
- `~/.gemini/agents/checkpoint.md` (P17)
- `~/.gemini/agents/cso.md` (P17)

**Implementation type**: Skill file change (Part A) + Director manual action (Part B)
**Scope**: `/arc`, `/fmn`, `/dev`, `/aud` skill files for Part A; per-AI cleanup for Part B
**Complexity**: Trivial (Part A). Part B is manual, one-time, outside sigma-cli.
**Dependency**: None.

**Execution ownership**:
- Part A: AI implements (skill file edits)
- Part B: **Handled by Director only.** AI does not touch global memory files of any AI
  agent without explicit Director instruction per file. AI may guide the Director through
  the cleanup steps if requested.

---

## Cluster C — Roadmap Section Management (Proposals 13–16)

### Core Design Principle

**H2 heading = CLI-managed atomic unit.**

Every stage section in ROADMAP must be a top-level H2:
```
## Stage X.Y — Title
```

H2 sections are never written manually. Stage sections are created automatically by
`sigma plan new` — section number = plan version number, always 1:1.
Non-stage H2 headings (e.g., `## Roadmap Policy`) are ignored by the CLI because they
don't match the `## Stage X.Y` pattern. All content within an H2 (H3 and below) is
the section body, filled by FMN after auto-creation.

---

### 13. ~~`sigma roadmap section`~~ — Replaced by auto-section on `sigma plan new`

**Original pain**: Inserting a new stage required 7+ manual edits across ROADMAP sections.
Observed in CanopySense Stage 1.15 insertion (2026-05-30).

**Decision**: No dedicated `sigma roadmap section` command. Instead, `sigma plan new`
auto-appends a stage stub to the active ROADMAP file as part of plan creation.

**New behavior in `sigma plan new`**:

After creating `FMN-PLAN-vX.Y.md` and registering it in `progress.json`, the CLI
also appends this stub to the bottom of the active ROADMAP file:

```markdown
## Stage X.Y — (title TBD)

> ⚠ Need to fill

### Focus

### Main Output

### Main Tasks

### Explicit Non-Scope

### Dependency / Gate Before Next Stage

### Risk / Watch-Out
```

FMN fills the title and body after creation. Section number is always equal to the
plan version — no bump logic, no mid-sequence insertion, no mismatch risk.

**Eliminated problems**:
- No plan version vs stage number mismatch (they are the same by definition)
- No bump logic needed (sections always append sequentially)
- No separate CLI command to remember or invoke

**Full `sigma plan new` flow after this change**:
```
1. Validate gates (locked INTENT + ROADMAP exists)
2. Create FMN-PLAN-vX.Y.md from template
3. Register draft in progress.json
4. Append stage stub to active ROADMAP file
5. Auto-call sigma roadmap render → regenerate Stage Overview, mermaid, PLAN Breakdown
6. Print: Created FMN-PLAN-vX.Y.md + ROADMAP updated
```

`sigma roadmap render` also remains available as a standalone command — useful when
FMN edits a stage title or body and wants to re-sync the derived sections manually.

**Scope of changes**:
- `plan.ts`: after `registerPlanDraft` + `writeProgress`, call
  `appendRoadmapSection(projectRoot, version)` then `renderRoadmap(projectRoot)`
- `utils/artifacts.ts`: new `appendRoadmapSection` helper (append stub)
- `roadmap.ts`: new `render` subcommand wrapping `renderRoadmap(projectRoot)`
- `utils/roadmap.ts` (new): `renderRoadmap` — H2 parser, table/mermaid generator,
  delimiter-based in-place replacement
- The append + render is a no-op with warning if no active ROADMAP exists (blocked
  upstream by Proposal 4 gate anyway)

**Implementation type**: CLI change — `plan new` side-effect + new `roadmap render` subcommand
**Complexity**: Low (P13 append). Medium (P14 render logic — handled there).
**Dependency**: Proposal 4 (ROADMAP gate on `plan new`) should land in the same pass.

---

### 14. `sigma roadmap render`

**Pain**: Stage Overview table, mermaid diagram, and PLAN Breakdown table are derived
from the H2 stage section list. Manual maintenance creates drift between these derived
sections and the actual stage list.

**Fix**: `sigma roadmap render`

Reads all `## Stage X.Y — Title` H2 headings in order (no H3 content needed) and
regenerates all derived sections:

- **Stage Overview table** — version, title, one-line summary per stage
- **Phase Dependencies mermaid diagram** — linear sequential chain derived from H2 order:
  ```
  flowchart TD
    S114[Stage 1.14] --> S115[Stage 1.15] --> S116[Stage 1.16]
  ```
- **PLAN Breakdown table** — cross-reference plan version to stage, sourced from
  `progress.json` plan entries

These derived sections use delimiter comments so render can replace them in-place
without touching FMN-authored body content:
```
<!-- SIGMA:RENDER:START:stage-overview -->
...auto-generated...
<!-- SIGMA:RENDER:END:stage-overview -->
```

Command is idempotent — safe to run at any time. Auto-called by `sigma plan new`
after appending the new stage stub.

**Implementation type**: CLI
**Complexity**: Medium. H2 heading parser (pattern match only, no deep parsing);
table generator; simple linear mermaid generator; in-place section replacement via
delimiter comments. No H3 content reading required.
**Dependency**: ROADMAP template must include the delimiter comments in its initial
structure. Requires a one-time template update.

---

### 15. ~~`sigma roadmap bump`~~ — Removed

**Decision**: Removed entirely. With stage sections tied to plan version numbers and
always appended sequentially via `sigma plan new`, there is no mid-sequence insertion
scenario. Bump logic is unnecessary.

---

### 16. Enforcement Rules for H2 Headings

**Fix**: Add explicit rules to ROADMAP template and FMN-RULE.md:
- `## Stage X.Y` headings must never be written manually — created only by `sigma plan new`
- Derived sections (Stage Overview, mermaid diagram, PLAN Breakdown) must never be
  manually edited — always regenerated by `sigma roadmap render`
- FMN fills only the H3 body content within each stage section

**Implementation type**: Rule / template change
**Scope**: ROADMAP template (add delimiter comments) + FMN-RULE.md
**Complexity**: Trivial.
**Dependency**: Proposal 14 must be implemented first — the rule is meaningless without
the render command to enforce the workflow.

---

## Implementation Sequencing

### No-Code Changes (Immediate)

These require only rule/template file edits. No CLI work needed.

| Proposal | File(s) to Edit | Priority |
| :--- | :--- | :--- |
| 7 | DEV-EXEC template, DEV-RULE.md | High |
| 8 | DEV-EXEC template, FMN-PLAN template | High |
| 9 | DEV-RULE.md | Low |
| 10 | DEV-RULE.md (+ optionally FMN-RULE.md, ARC-RULE.md) | Medium |
| 12 | All Sigma skill files (`/arc`, `/fmn`, `/dev`, `/aud`) | High |
| 16 | ROADMAP template, FMN-RULE.md | Low (depends on 14) |

### CLI Changes — Low Complexity

| Proposal | CLI Work | Depends On |
| :--- | :--- | :--- |
| 2 | Simplify exec state machine to DRAFT → LOCKED; remove `exec advance` | None |
| 13 | Auto-append stage stub in `sigma plan new` + call render | 14 |

### CLI Changes — Medium Complexity

| Proposal | CLI Work | Depends On |
| :--- | :--- | :--- |
| 1 | `exec new` guard + plan selection via unexecuted plan lookup | None |
| 4 | ROADMAP mandatory gate + version tied to INTENT + auto-lock on closure | None |
| 5 | Remove DRAFT guard + FIFO lock + pending plan staging (`--pending`, `promote`) | 4 |
| 6 | Lock preflight summary + `APPROVE` confirmation | None |
| 11 | Remove `engine/memory.ts` + all harvest calls + config constant | None |
| 14 | `sigma roadmap render` (H2 parser, table/mermaid gen, delimiter replacement) | None |

### New Proposals (from discussion, outside original 16)

| Proposal | CLI Work | Depends On |
| :--- | :--- | :--- |
| 17 | CSO simplification — remove tracking from progress.json, remove skills | None |

---

### 17. CSO Simplification — Remove Tracking, Remove Skills

**Decision**: CSO provides no practical value in the Sigma workflow because Sigma
artifacts themselves (FMN-PLAN, DEV-EXEC) already serve as context transfer. Every
new artifact section gives AI immediate orientation on progress and context. CSO is
not used in practice and adds overhead without benefit.

**Changes:**

**A — Remove CSO from `progress.json` entirely**

`sigma cso new` becomes a pure file creator — it writes to `Sigma/logs/` but does
not call `registerCsoEntry` and does not touch `progress.json`. CSO is fully standalone.

Remove from `progress.ts`:
- `CsoEntry` interface
- `CsoState` type
- `cso` array from `ProgressJson` schema
- `registerCsoEntry` function
- CSO validation logic

Remove from `progress.json` default:
- `cso: []` initial value

**B — Remove `/checkpoint` and `/cso` skills**

Both skills are redundant and create confusion between each other.
`sigma cso new` remains available as a CLI command for users who want it,
but there is no dedicated skill to invoke it.

**C — Remove CSO references from bootstrap protocols**

DEV-RULE.md and any skill files that mention "read relevant CSO files from Sigma/logs/"
as a bootstrap step should remove that instruction. CSO files are not guaranteed to
exist and are not part of the governance chain.

**What stays:**
- `sigma cso new --role <role>` CLI command — creates file in `Sigma/logs/`, nothing more
- `CSO-TEMPLATE.md` — template for the file content
- `Sigma/logs/` folder — files accumulate here as plain markdown, no tracking

**Implementation type**: CLI + engine + skill file change
**Scope**: `progress.ts` (remove CsoEntry, CsoState, cso array, registerCsoEntry);
`cso.ts` (remove registerCsoEntry call and progress write); remove `/checkpoint`
and `/cso` skill files; update DEV-RULE.md and any skill bootstrap references
**Complexity**: Low. Removal work, no new logic.
**Dependency**: None — standalone.

---

## Backward Compatibility

Applies to existing Sigma projects (e.g., CanopySense) that have a live `progress.json`
and build artifacts before these changes are deployed.

---

### Category 1 — BREAKING (requires migration before use)

| Proposal | Why Breaking | Migration Path |
| :--- | :--- | :--- |
| **P2** — Exec state machine simplified | Existing `progress.json` may have exec versions in `BUILDING`, `TESTING`, or `COMPLETED` state. After removal of those states from the schema, reading progress.json will fail validation. | `sigma sync progress` auto-coerces active exec states: `BUILDING` / `TESTING` / `COMPLETED` → `DRAFT`. Locked and Superseded execs are unaffected. |
| **P4** — ROADMAP mandatory gate | `plan new` now requires a ROADMAP to exist. Existing projects that have been running plan/exec cycles without ROADMAP will be blocked from creating new plans. | `sigma sync roadmap` bootstraps the new ROADMAP from existing plan files. After that, the gate is satisfied and `plan new` works normally. |
| **P17** — CSO removed from `progress.json` schema | Existing projects may have `cso: [...]` array in `progress.json`. If the schema validator enforces no unknown fields, read will fail. | `sigma sync progress` strips the `cso` array from `progress.json`. CSO files in `Sigma/logs/` are untouched — they remain as standalone markdown files. |

---

### Category 2 — LOW RISK (safe for clean states; edge cases mid-transition)

| Proposal | Risk Scenario | Safe If |
| :--- | :--- | :--- |
| **P1** — Exec guard + plan selection | Guard blocks `exec new` if any exec is in non-locked/non-superseded state. A project mid-transition with a DRAFT exec (that the team forgot about) would be blocked. | Active exec is either LOCKED or SUPERSEDED — normal clean state. |
| **P5** — Remove DRAFT guard + FIFO lock | Existing projects can only have one DRAFT plan at a time (due to the guard that is being removed). After removal, FIFO lock picks the oldest DRAFT — which for single-DRAFT projects is the only DRAFT. Behavior is identical in practice. | Project has at most one DRAFT plan at a time (all existing projects). |
| **P13** — Auto-append stage stub on `plan new` | Appends to active ROADMAP file. If ROADMAP file is missing (pre-P4 project not yet migrated), append would fail. | P4 migration is done first — ROADMAP exists before `plan new` is called again. |
| **P14** — `sigma roadmap render` | Requires `<!-- SIGMA:RENDER:START/END -->` delimiter comments in ROADMAP. Existing ROADMAP files do not have them. | `sigma sync roadmap` generates a new ROADMAP with correct structure and delimiters. Existing ROADMAP renamed to `ROADMAP-v{X}-legacy.md` for FMN to migrate body content manually. |

---

### Category 3 — SAFE (no migration, no state risk)

| Proposal | Reason |
| :--- | :--- |
| **P6** — Lock preflight + APPROVE confirmation | Additive UX change — no state machine impact. |
| **P7** — Template redesign (FMN-PLAN + DEV-EXEC) | Existing artifacts are already locked and immutable — old templates are untouched. New templates apply to future artifacts only. |
| **P8** — DEV Pre-Build Assessment section | Additive section to DEV-EXEC template. No impact on existing locked artifacts. |
| **P9** — Bootstrap step skip for warm context | Rule file only. |
| **P10** — Authorization language table | Rule file only. |
| **P11** — Remove decision memory system | CLI stops writing to `decisions.jsonl` — existing file is orphaned but not deleted. No `progress.json` schema change. |
| **P12** — Role isolation reminder in skill files | Skill file only. Additive. |
| **P16** — H2 enforcement rules | Rule/template only. Applies to future artifacts. |

---

### Recommended Migration Order for Existing Projects

1. **Deploy all Category 3 proposals first** (P6–P12, P16) — zero risk, no coordination needed
2. **Run `sigma sync progress`** — handles P2 (exec state coercion) and P17 (cso array removal)
3. **Run `sigma sync roadmap`** — migrates existing ROADMAP to new format with correct titles and delimiter comments
4. **Deploy P4, P5, P13, P14** — now safe because migration is complete

→ See **Proposal 18** for full spec of both sync commands.

---

### 18. `sigma sync` — Backward Compatibility Migration Commands

**Context**: Several proposals in this phase introduce breaking changes to `progress.json`
schema (P2, P17) and the ROADMAP file format (P13, P14). Existing projects (e.g.,
CanopySense) need a safe, one-time migration path before the new CLI version is used.

Two subcommands under a new `sigma sync` namespace:

---

#### `sigma sync progress`

Brings `progress.json` up to the current schema version.

**Operations** (applied in order):
1. Coerce exec versions in `BUILDING` / `TESTING` / `COMPLETED` → `DRAFT` (P2)
2. Strip `cso` array from `progress.json` if present (P17)
3. Print diff-style summary of every change made before writing

**Properties**:
- Idempotent — safe to run multiple times
- Non-destructive — only modifies `progress.json`; no artifact files touched
- Aborts with no changes if `progress.json` is already up to date

**Scope**: `src/commands/sync.ts` (new); reads/writes via `readProgress` / `writeProgress`
**Complexity**: Low.
**Dependency**: Must be released in the same package version as P2 and P17.

---

#### `sigma sync roadmap`

Migrates an existing manually-maintained ROADMAP file to the new CLI-managed format
(H2 stage sections + delimiter comments for `sigma roadmap render`).

**Source of truth for titles**: `Source Roadmap Stage` field in Section 1 of each
FMN-PLAN file. Pattern: `Source Roadmap Stage:.*Stage \d+\.\d+ \((.+)\)`

Validated against CanopySense: 14 of 15 plans (v1.2–v1.15) have this field filled
correctly. Only v1.1 has `N/A` (ROADMAP did not exist at that stage) — falls back to `(TBD)`.

**Behavior**:
1. Read all locked plan versions from `progress.json`
2. Per plan: open FMN-PLAN file, parse `Source Roadmap Stage` → extract title
3. Generate a fresh ROADMAP file with:
   - All `## Stage X.Y — Title` H2 headings in version order
   - Full H3 stub body per section (Focus, Main Output, Main Tasks, etc.)
   - Delimiter comments for `sigma roadmap render`
4. Auto-call `sigma roadmap render` → populate Stage Overview table, mermaid, PLAN Breakdown
5. Rename original ROADMAP to `ROADMAP-v{X}-legacy.md` — not deleted; FMN uses it to
   migrate body content into the new format manually

**After sync**:
- New ROADMAP has correct structure and titles
- FMN opens `ROADMAP-v{X}-legacy.md` and migrates the H3 body content section by section
- H2 headings in the new file must never be touched manually (P16)

**Title edge cases**:
- `Source Roadmap Stage: N/A` → title becomes `(TBD)` in the new ROADMAP
- Field missing entirely → title becomes `(TBD)` with a warning printed
- Minor format inconsistency (bold `**Source Roadmap Stage**` vs plain) → regex handles both

**Scope**: `src/commands/sync.ts` (shared with `sigma sync progress`);
`utils/roadmap.ts` (reuses `renderRoadmap` from P14)
**Complexity**: Medium. JSONL-style plan iteration + regex extraction + file generation
+ render call. No markdown deep-parsing needed — only H3 stub template injection.
**Dependency**: P14 (`renderRoadmap`) must be implemented first or in tandem.

---

**Implementation type**: New CLI command namespace (`sigma sync`)
**Dependency**: P2 and P17 for `sync progress`; P14 for `sync roadmap`.
Release both in the same package version as P2, P14, and P17.

---

### 20. SIGMA_PROTOCOL.md — Aggressive Slim-Down

**Context**: SIGMA_PROTOCOL.md is 1,800 lines and mixes governance doctrine with
operational detail (CLI command reference, memory schema, skill file spec, folder
structure). The operational sections are redundant with authoritative sources that
AI roles already use: `sigma --help` (command syntax), `sigma session bootstrap`
(current state), rule files (role behavior). Maintaining duplicate operational detail
in the protocol creates a maintenance burden and a staleness risk — perversely, a
role that reads and trusts Section 23 may use removed commands (`exec advance`)
or miss new ones (`sigma roadmap render`).

**Decision**: Slim down to governance doctrine only (~550–650 lines from 1,800).

---

#### Sections to DELETE

| Section | Title | Why |
| :--- | :--- | :--- |
| 6 | State Machine (full tables) | `sigma session bootstrap` is authoritative and always current |
| 8 | Auto-Supersede Policy | CLI handles silently; AI role does not need to implement this |
| 10 | Naming Convention | AI infers from existing filenames; `sigma --help` shows format |
| 11 | Versioning Tiers | Same — inferred from existing files |
| 12 | Folder Structure | `sigma project start` auto-creates; AI can `ls Sigma/` |
| 18 | CSO Lifecycle | P17 removes CSO from progress.json tracking anyway |
| 22 | CLI Setup & Installation | Not relevant to AI roles during operation |
| 23 | CLI Command Reference | `sigma --help` is always current and accurate; Section 23 is a stale copy |
| 24 | Memory & MCP Configuration | P11 removes decisions.jsonl; MCP setup is Director/setup concern |
| 25 | Distribution & Bridge Files | Implementation detail for package maintainer, not AI roles |

---

#### Section 9 (STALE_INTENT) — Move, Don't Delete

Do not delete Section 9. Instead, condense to 3 paragraphs and embed as a note
directly under Gate 3 in Section 7 (Gate Rules).

Rationale: `sigma session bootstrap` tells the AI that a STALE_INTENT warning exists,
but does not explain the Director's decision framework — whether to use `--ack-stale-intent`
or produce fresh artifacts. Without this context, the AI cannot help the Director make
the right governance decision. This knowledge belongs with the gate that uses it.

---

#### Sections to UPDATE (keep but revise content)

| Section | Change | Driven by |
| :--- | :--- | :--- |
| 4.3 FMN | Update FMN-PLAN description — 6 pre-build sections only; remove old Section 1/2 two-part description | P7 |
| 4.4 DEV | Update DEV-EXEC description — 16-section structure; FMN review in Sections 13–14 | P7 |
| 5.5 CSO | Remove "tracks in progress.json"; update to pure file creation; remove Cross-Role CSO Check reference | P17 |
| 5.6 ROADMAP | Remove "not a runtime gate"; add mandatory gate + version tied to INTENT + auto-lock on closure | P4 |
| 7 | Gate Rules — add new gate: ROADMAP must exist before `plan new` | P4 |
| 16A | Command Authority table — remove `exec advance` from operational class; remove `roadmap lock` from approval class | P2, P4 |

---

#### New Section to ADD

**Language Preference** — add after Section 16C (Director Authorization Language Policy):

> Projects may configure a preferred session language via `Sigma/sigma.config.json`
> (`language: "id"` for Indonesian, `"en"` default). AI roles read this at bootstrap
> and conduct all Director-facing communication in the configured language.
> Artifact content (FMN-PLAN, DEV-EXEC, ROADMAP, rule files) is always written
> in English regardless of language setting.

---

**Expected result**: ~550–650 lines. Protocol becomes stable governance doctrine that
rarely changes — not an operational manual that needs updating with every CLI change.

**Implementation type**: Document edit only — no CLI work
**Scope**: `Sigma/SIGMA_PROTOCOL.md`
**Complexity**: Low-Medium. Mostly deletion. Targeted content revisions in Sections
4.3, 4.4, 5.5, 5.6, 7, 16A. New language preference note.
**Dependency**: P2 (exec advance), P4 (ROADMAP gate), P7 (template redesign), P10
(language config), P17 (CSO) — P20 is the protocol sync pass for all of those.
Should be done after all relevant proposals are implemented.

---

## Key Design Observations

### 1. ~~`sigma see` as a New Command Namespace~~ — Obsolete

Superseded by P11 (total removal of decision memory system). No `sigma see memory`
namespace is needed — orientation happens by reading artifacts directly.

### 2. Roadmap Proposals Are a Coherent System

Proposals 4, 13, 14, 15, and 16 form a single coherent feature: a CLI-managed roadmap
with formal versioning and auto-rendered derived content. They should be scoped and
implemented together, not individually. The high-complexity marker on 13 and 14 reflects
the markdown parsing and render infrastructure — once that infrastructure exists, 15 and
16 are trivial additions.

### 3. Lock Commands Are Now Uniform

With Proposal 2 simplifying exec to `DRAFT → LOCKED`, all lock commands (intent, plan,
exec, close) now follow the same single-step path. No shared preflight infrastructure
needed — lock commands stay simple and direct.

### 4. Proposal 1 and Proposal 5 Are Independent

Proposal 1 (exec guard + plan selection) and Proposal 5 (parallel draft mode for PLAN)
address different artifacts and different problems. They have no implementation dependency
on each other and can be done in any order.

### 5. Rule/Template Fixes Are Zero-Risk

Proposals 7, 8, 9, 10, 12 are pure document edits with no CLI dependency. They can be
done in any session without affecting the CLI build or governance state. These are the
lowest-risk, highest-leverage improvements and should be the first pass.

---

### 19. Rule & Skill File Cleanup — Sync with Phase 2 Changes

**Context**: Full audit of all 4 rule files (`DEV-RULE.md`, `FMN-RULE.md`, `ARC-RULE.md`,
`AUD-RULE.md`) and 4 skill files (`arc.md`, `fmn.md`, `dev.md`, `aud.md` in
`~/.reasonix/skills/`) reveals stale content that contradicts decisions made in this
phase, plus one pre-existing contradiction. All changes are document edits — no CLI work.

---

#### Group A — Must fix (contradict Phase 2 proposals)

**DEV-RULE.md**
- Remove `sigma exec advance | Draft/Operational` from CLI Operation Policy table (P2 removes this command)
- Remove "Cross-Role CSO Check" block from Session Bootstrap section (P17)

**FMN-RULE.md**
- Rename "Optional: ROADMAP as Staging Tool" → "Mandatory: ROADMAP as Staging Requirement"; rewrite body to reflect P4 gate — ROADMAP must exist before `plan new` (P4)
- Remove `sigma roadmap lock | Approval` from CLI Operation Policy table (P4 auto-locks on close, no manual lock)
- Update "FMN-PLAN Creation Rules" section list — remove Sections 7–11 (Post-Build Test Result, FMN Findings, AUD Findings, Director Observation Testing Report, Director Follow-Up Decision Notes); leave only 6 sections (P7)
- Update "Director Observation Handling" — change *"recorded in the Director Observation Testing Report section of FMN-PLAN"* to *"recorded in DEV-EXEC Section 15 (Director Observation Testing Report)"* (P7)
- Remove "Cross-Role CSO Check" block from Session Bootstrap section (P17)

**ARC-RULE.md**
- Remove "Cross-Role CSO Check" block from Session Bootstrap section (P17)

**AUD-RULE.md**
- Remove "CSO Scope" block from Session Bootstrap section (P17)

**All 4 skill files** (`arc.md`, `fmn.md`, `dev.md`, `aud.md`):
- Remove "Cross-Role CSO Check" section entirely (arc, fmn, dev) / "External Audit CSO Scope" section (aud) (P17)
- Remove `CHECKPOINT` and `CSO` from Role Immutability list in each file (P17)
- Add role isolation reminder block at activation (P12):
  ```
  Active governance system: SIGMA
  Valid roles in this session: ARC, FMN, DEV, AUD
  Any reference to ANT, CDC, GMN, or Delta roles is an error.
  If you detect yourself using those terms, stop and correct immediately.
  ```

---

#### Group B — Pre-existing issue (not from Phase 2)

**AUD-RULE.md — Contradictory message send authorization language**

Two conflicting statements in the same file:
- Line ~749: *"AUD may use communication CLI commands (message send) when instructed by the Director."*
- Line ~845: *"AUD may use communication CLI commands (message send) without need any instruction or permission from the Director first."*

**Fix**: Remove the permissive statement (line ~845). Keep the "when instructed" version.
AUD is a passive external auditor — the general rule should require Director instruction.
The exception (if any) belongs in the specific context where it applies, not as a blanket global rule.

---

**Implementation type**: Rule file + skill file changes only — no CLI work
**Scope**:
- `Sigma/rules/DEV-RULE.md`
- `Sigma/rules/FMN-RULE.md`
- `Sigma/rules/ARC-RULE.md`
- `Sigma/rules/AUD-RULE.md`
- `~/.reasonix/skills/arc.md`
- `~/.reasonix/skills/fmn.md`
- `~/.reasonix/skills/dev.md`
- `~/.reasonix/skills/aud.md`
**Complexity**: Low. Document editing only.
**Dependency**: P2 (exec advance removal), P4 (ROADMAP mandatory), P7 (template redesign),
P12 (isolation reminder), P17 (CSO removal) — P19 is the cleanup pass that syncs all
rule/skill files to reflect those decisions. Should be done in the same implementation
session as the proposals it references.

---

## Summary Count

| Type | Count | Proposals |
| :--- | :--- | :--- |
| CLI only | 7 | 1, 2, 4, 5, 13, 14, 18 |
| Rule/template only | 7 | 7, 8, 9, 12, 16, 19, 20 |
| Both (CLI + rule) | 3 | 10 (config command + rule/protocol), 11 (engine removal + rule cleanup), 17 (CLI + skill removal) |
| Removed / resolved | 3 | 3 (resolved by P2), 6 (unnecessary), 15 (resolved by P13) |
| New proposals | 4 | 17 (CSO simplification), 18 (sigma sync — backward compat), 19 (rule & skill cleanup), 20 (protocol slim-down) |
| Total active | 18 | |

---

## Implementation Batching Plan

Batching strategy: group by type and dependency, not one proposal at a time.
Reason: proposals of the same type share file context and edit patterns — batching reduces context switching and makes each loop more efficient.

| Batch | Proposals | Type | Dependency | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **A** | P7, P8, P9, P12, P16, P19 | Rule/template only | None | Pure document edits — zero risk, zero CLI dependency. Highest leverage, lowest friction. Start here. |
| **B** | P2, P11, P17 | CLI removal | None | Mechanical deletion of engine/memory.ts, exec intermediate states, CSO tracking. Standalone, no new logic. |
| **C** | P20 | Document edit (protocol) | P2, P17 (content refs) | SIGMA_PROTOCOL.md slim-down syncs content decisions from P2 and P17. Do after B. |
| **D** | P4, P14 | CLI medium (new infrastructure) | None | ROADMAP mandatory gate (P4) + roadmap render engine (P14). Core infrastructure that downstream batches depend on. |
| **E** | P1, P5, P10, P13, P18 | CLI medium | P4 (for P5, P13) | Remaining CLI changes. P5 and P13 require ROADMAP gate from P4. P1, P10, P18 are standalone but grouped here for final pass. |

### Execution Order
```
Batch A → Batch B → Batch C → Batch D → Batch E
         (B can run concurrently with A if separate sessions)
```

### Status Tracking

| Batch | Status |
| :--- | :--- |
| A | **DONE** — 2026-05-30 |
| B | **DONE** — 2026-05-30 |
| C | Pending |
| D | Pending |
| E | Pending |
