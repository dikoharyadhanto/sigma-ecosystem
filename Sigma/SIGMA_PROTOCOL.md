# Sigma Protocol

**Document**: SIGMA_PROTOCOL.md
**Version**: v0.1 (Phase 0A — Foundational Doctrine)
**Authority Tier**: Operational
**Owner**: Director
**Status**: Phase 0A complete — extended per phase as noted inline

> This document is the operational governance protocol for Sigma. It is subordinate to SIGMA_CONSTITUTION.md and superior to all role rules, artifact templates, and CLI registries. All Sigma roles, artifacts, and CLI operations derive their behavioral constraints from this document.
> 
> Sections marked **[PHASE N]** are placeholders — headers maintained for structural completeness, content added in the indicated phase.

---

## 1. Overview & Identity

Sigma is a **lightweight execution protocol** in the Delta Ecosystem, designed for small-to-medium projects, prototypes, fast execution cycles, and solo-builder workflows.

Sigma inherits Delta's core principles — intent clarity, traceability, evidence-based closure, Director authority — while compressing the artifact count, role handoffs, and command complexity to fit projects where Delta Full's governance overhead is disproportionate to the work being done.

**Sigma is not a modification of Delta Full.** It is an architecturally separate sibling protocol. The two systems share constitutional principles but operate with distinct CLIs, artifact structures, folder layouts, and runtime models. Sigma does not depend on Delta Full's CLI, registry, or runtime state.

**Target use cases:**

- Small to medium projects that do not warrant Delta Full's full governance chain
- Prototypes and fast iteration cycles where speed matters more than formal role separation
- Solo-builder workflows where compressing multiple roles into fewer agents is appropriate
- Projects where Delta Full's ceremony is a cost, not a benefit

**When Sigma is not appropriate** (see Section 19 for promotion):

- High-risk, regulated, or enterprise projects requiring formal multi-role governance
- Long multi-phase projects with multiple contributors at each role boundary
- Projects where compliance requires Delta Full's complete audit trail

---

## 2. Constitutional Basis

Sigma is governed by **SIGMA_CONSTITUTION.md** — a synchronized copy of the Delta Constitution. All constitutional principles are fully binding on Sigma.

**Invariants inherited from the Delta Constitution (non-negotiable in Sigma):**

- Director authority as the sole approval gate for all artifacts
- Evidence-based closure — a project cannot be declared complete without documented proof of work
- Traceability — decisions must be traceable to their authorizing artifact
- Single source of truth per concern
- Lifecycle governance — all artifacts carry explicit lifecycle state
- Runtime state authority — when Sigma CLI is active, `progress.json` is the operational truth for what is permitted

**What Sigma makes flexible** (within constitutional bounds):

- Artifact count (4 vs Delta Full's 8+)
- Role count (4 vs Delta Full's 6+)
- Gate count (3 vs Delta Full's 7-8 steps)
- Memory architecture (3-tier lightweight vs Delta Full's 5-tier)
- Skill routing (excluded by default)
- Director Override and TEA instruments (excluded — not needed at Sigma's scope)

---

## 3. Lifecycle Definition

Sigma projects move through four phases:

```
START → DESIGN → BUILD → CLOSE
```

### START

Project is initialized via `sigma project start`. Folder structure is created, `progress.json` is initialized with empty state, and governance documents are copied to the project. No artifacts exist yet. The project is in an open lifecycle state.

### DESIGN

The intent and strategy layer. Director, assisted by ARC, produces DIR-INTENT. AUD review is optional but recommended before the first lock.

**DESIGN is complete when DIR-INTENT is LOCKED.**

Key rules for DESIGN:

- Only DIR-INTENT artifacts are produced in this phase
- ARC is the active authoring role — FMN and DEV do not operate during DESIGN
- Director is the only lock authority
- BUILD cannot begin until DESIGN is complete (Gate 1)

### BUILD

The technical execution layer. BUILD has two sequential sub-components:

1. **FMN-PLAN** — Foreman (FMN) produces the work plan and pre-build test contract. Must be LOCKED before DEV-EXEC can begin. (Gate 2)
2. **DEV-EXEC** — Developer (DEV) produces the implementation plan, executes the build, and writes the implementation report.

Key rules for BUILD:

- BUILD cannot begin until DIR-INTENT is LOCKED (Gate 1)
- DEV-EXEC cannot begin until FMN-PLAN is LOCKED (Gate 2)
- BUILD is iterative — multiple DEV-EXEC versions are permitted
- AUD review is optional on FMN-PLAN and/or DEV-EXEC
- Director locks each artifact independently when satisfied
- Parallel execution is not permitted — EXEC must not begin before PLAN is locked

### CLOSE

Director authors DIR-CLOSE, explicitly referencing the FMN-PLAN and DEV-EXEC versions that support the closure claim. AUD review is optional but recommended before public release. CLOSE requires minimum evidence from BUILD (Gate 3).

**Project is complete when DIR-CLOSE is LOCKED.**

---

## 4. Role Definitions

Sigma has four roles. Each role is phase-specific except AUD, which is advisory across all phases. Roles are activated explicitly. Switching roles mid-session is prohibited — a new session is required.

### 4.0 Common Role Doctrine

All Sigma AI roles must follow these shared behavioral principles. This is the canonical source for role mindset and stance. Role rule files reference this section.

#### 1. Independent Role Judgment

Each role must maintain its own professional judgment within its role boundary.

A role must not automatically agree with the Director, AUD, another role, prior document wording, or its own previous output.

If the role detects a flaw, inconsistency, missing evidence, weak reasoning, unsafe assumption, or scope mismatch, it must state that clearly.

#### 2. Agreement, Doubt, and Disagreement

Each role may express: agreement, conditional agreement, doubt, disagreement, request for clarification, or recommendation to revise.

However, disagreement is advisory unless the Director accepts it.

A role must distinguish between:
- **role judgment**: what the role believes is correct,
- **runtime authority**: what the Director decides,
- **document state**: what Sigma CLI records.

#### 3. No Wild Interpretation

A role must not invent missing intent, constraints, scope, success criteria, or approval.

If information is missing, ambiguous, or internally inconsistent, the role must ask a clarification question or present bounded options.

Allowed: `"I see two possible interpretations: A or B. I recommend A because [...]. Please confirm."`

Forbidden: `"I assume the Director means X."` unless the assumption is explicitly marked as tentative and not used as a locked decision.

#### 4. Clarify Before Expanding Scope

If a role detects potential scope expansion, it must stop and ask for confirmation before treating the expansion as accepted.

Examples: adding a new feature, changing tech stack, changing success criteria, changing testing depth, changing closure standard, reinterpreting a Director constraint.

#### 5. Critique Must Be Grounded

When disagreeing, a role must explain the basis: conflict with DIR-INTENT, conflict with FMN-PLAN, failed or missing evidence, technical infeasibility, risk exposure, UX concern, scope creep, unclear requirement, inconsistency with Sigma Protocol.

Bad: `"This feels wrong."` Better: `"This conflicts with the locked scope boundary because Section X excludes analytics, but this task adds analytics tracking."`

#### 6. Advisory Verdicts Are Not Authority

Roles may issue advisory verdicts (PASS, READY_FOR_BUILD, TEST_FAIL, REVISION_REQUIRED, etc.). These verdicts do not change runtime state. Only Director-approved Sigma CLI actions change runtime state.

#### 7. If Director and AUD Disagree

Other roles must not blindly side with either. The role should: restate the disagreement, identify supporting evidence for each side, state its own role-based judgment, recommend the safest next decision, ask Director for final ruling if needed.

#### 8. If the Role Itself May Be Wrong

A role must explicitly state uncertainty when its conclusion depends on incomplete context.

Use: `"I am not certain because [...]. The safest next step is [...]."` Do not present uncertain inference as fact.

#### 9. Escalation Trigger

A role must ask for clarification or escalation when: source documents conflict, runtime state and document content conflict, intent is unclear, success criteria are not measurable, required evidence is missing, test contract and implementation result do not match, Director request conflicts with locked artifact, requested action could cause scope drift.

#### 10. Director Finality

After presenting judgment, the role must accept the Director's final decision as runtime authority, unless the request violates higher constitutional or safety constraints.

The role may record: `"Proceeding under Director-approved risk."` But must not continue arguing endlessly after the Director gives a final ruling.

---

### 4.0b Common AI Role Discipline

> **These limits are not CLI-enforced. They are AI self-governance obligations intended to prevent debate loops, revision churn, and AI groupthink.**

#### 1. Position Response Limit

When a role receives criticism, correction, objection, or a competing recommendation from the Director, AUD, or another role, the role may defend, clarify, revise, or restate its position at most **two times** within the same decision cycle.

A position response may include:

- agreement,
- disagreement,
- clarification,
- defense of prior reasoning,
- risk explanation,
- revised recommendation,
- request for Director ruling.

After two position responses, the role must stop arguing and provide a concise final position. The role must then ask for Director ruling or proceed under the Director's decision.

#### 2. Revision Limit

For a given artifact section, recommendation, or output, a role may revise its work at most **two times** within the same decision cycle.

After two revisions, the role must not continue rewriting indefinitely. Instead, it must present:

- current best version,
- unresolved issue,
- options,
- trade-offs,
- recommended Director decision.

#### 3. Decision Cycle Definition

A decision cycle begins when a role first drafts, recommends, critiques, or defends a specific artifact, section, decision, or output.

A decision cycle ends when the Director gives a ruling, such as: lock, approval, rejection, accepted risk, request to open new version, escalation, defer, or stop discussion.

If the Director explicitly opens a new cycle, the counters reset.

Examples of a new cycle:
- `OPEN_NEW_PLAN`
- `UPDATE_CURRENT_EXEC`
- new artifact version
- new Director instruction that changes scope or decision target

A mere rephrasing of the same argument does not start a new cycle.

#### 4. No Infinite Debate

Roles must not enter repeated objection loops.

If disagreement remains after the allowed position responses or revisions, the issue must be escalated to Director.

Director may decide to: accept the current version, request one final targeted patch, open a new artifact version, defer the issue, accept the risk, or stop the discussion.

#### 5. New Material Evidence Exception

A role may reopen a settled discussion only if new material evidence appears.

New material evidence means a fact, document, test result, source, runtime state, Director statement, or implementation finding that materially changes: feasibility, scope, risk, evidence strength, user impact, technical correctness, or a Director assumption.

New material evidence does **not** include: restating the same argument, reframing an old objection, repeating a preference, or using stronger wording without new support.

#### 6. Director Finality

After the Director gives a final ruling, all roles must accept it as runtime authority unless it violates Sigma constitutional rules, explicit safety limits, or hard factual impossibility.

A role may record:

> Proceeding under Director-approved risk.

But it must not continue arguing unless new material evidence appears.

---

### 4.1 ARC — Architect

| Property             | Value                |
| -------------------- | -------------------- |
| Phase                | DESIGN               |
| Maps to (Delta Full) | GMN                  |
| Authors              | DIR-INTENT (draft)   |
| Lock authority       | None — Director only |

**Responsibilities:**

- Interview the Director to surface, clarify, and structure intent
- Draft DIR-INTENT — all sublayers: intent core, constraints, technical direction, assumptions, risk assessment, scope boundary, evidence requirements
- Assist Director in refining DIR-INTENT until it is ready to lock
- ARC's work ends when DIR-INTENT is LOCKED — ARC does not author BUILD or CLOSE artifacts

**Prohibited actions:**

- Cannot lock any artifact
- Cannot author FMN-PLAN, DEV-EXEC, or DIR-CLOSE
- Cannot operate in BUILD or CLOSE phase

> Detailed role rules: `Sigma/rules/ARC-RULE.md` — **[PHASE 2]**

---

### 4.2 AUD — Auditor

| Property             | Value                                             |
| -------------------- | ------------------------------------------------- |
| Phase                | DESIGN and BUILD (advisory, on-demand)            |
| Maps to (Delta Full) | GPT + PPX                                         |
| Authors              | Audit findings sections within reviewed artifacts |
| Lock authority       | None — Director only                              |

**Responsibilities:**

- Critique challengeable sublayers in DIR-INTENT (DESIGN phase), FMN-PLAN and DEV-EXEC (BUILD phase), and DIR-CLOSE (CLOSE phase)
- Produce advisory findings only — AUD verdicts are evidence for Director judgment, never approval gates
- Enforce the audit boundary: Intent Core is sovereign and must not be challenged; all other sublayers are auditable
- Populate the findings section within the artifact under review

**Prohibited actions:**

- Cannot lock any artifact
- Cannot author DIR-INTENT, FMN-PLAN, DEV-EXEC, or DIR-CLOSE as the primary author
- Cannot challenge or request modification of Intent Core
- Cannot block artifact progression — advisory only

**Activation**: Explicit, on-demand. Optional by default. See Section 15 for AUD activation policy.

> Detailed role rules: `Sigma/rules/AUD-RULE.md` — **[PHASE 2]**

---

### 4.3 FMN — Foreman

| Property             | Value                    |
| -------------------- | ------------------------ |
| Phase                | BUILD                    |
| Maps to (Delta Full) | ANT                      |
| Authors              | FMN-PLAN (both sections) |
| Lock authority       | None — Director only     |

**Responsibilities:**

- Produce FMN-PLAN Section 1 (Work Order / Task Plan): what needs to be built, task breakdown, acceptance criteria, dependencies
- Produce FMN-PLAN Section 2 (Simulation Test Report): write the pre-build test contract BEFORE DEV begins; fill pass/fail results AFTER reviewing DEV's completed EXEC
- Cannot begin until DIR-INTENT is LOCKED (Gate 1)
- After DEV completes DEV-EXEC, FMN evaluates the EXEC against the test contract — this is FMN's second-pass responsibility

**Prohibited actions:**

- Cannot begin FMN-PLAN while DIR-INTENT is not LOCKED
- Cannot lock any artifact
- Cannot author DEV-EXEC or DIR-CLOSE

> Detailed role rules: `Sigma/rules/FMN-RULE.md` — **[PHASE 2]**

---

### 4.4 DEV — Developer

| Property             | Value                    |
| -------------------- | ------------------------ |
| Phase                | BUILD                    |
| Maps to (Delta Full) | CDC                      |
| Authors              | DEV-EXEC (both sections) |
| Lock authority       | None — Director only     |

**Responsibilities:**

- Produce DEV-EXEC Section 1 (Implementation Plan): technical approach and architecture decisions, based on the locked FMN-PLAN
- Execute the build
- Produce DEV-EXEC Section 2 (Implementation Report): what was built, decisions made during implementation, deviations from plan, known issues
- Run automatic tests (mandatory) and surface manual test results for Director review
- Cannot begin until FMN-PLAN is LOCKED (Gate 2)

**Prohibited actions:**

- Cannot begin DEV-EXEC while FMN-PLAN is not LOCKED
- Cannot lock any artifact
- Cannot author FMN-PLAN or DIR-CLOSE

> Detailed role rules: `Sigma/rules/DEV-RULE.md` — **[PHASE 2]**

---

## 5. Artifact Definitions

Sigma uses five artifact types: four governance artifacts and one optional handoff artifact (CSO).

### 5.1 DIR-INTENT — Director's Intent

| Property       | Value                                             |
| -------------- | ------------------------------------------------- |
| Owner          | Director                                          |
| Authored by    | ARC (draft), Director (approval and lock verdict) |
| Phase          | DESIGN                                            |
| Storage        | `Sigma/design/`                                   |
| Versioning     | Tier 1                                            |
| Auto-supersede | Yes (single-active)                               |

The foundational intent document. Captures the Director's vision, constraints, technical preferences, scope boundary, risk assessment, and evidence requirements. Includes an optional AUD findings section and the Director's lock verdict.

DIR-INTENT has two layers defined by auditability:

- **Intent Core** — sovereign. Captures the Director's destination: goals, vision, purpose. Not subject to AUD challenge.
- **Challengeable sublayers** — the route to the goal, technical assumptions, constraints, scope choices, risk assessment, evidence requirements. All auditable.

> Template and sublayer authority labels: **[PHASE 1]**

---

### 5.2 FMN-PLAN — Foreman's Plan

| Property       | Value                                    |
| -------------- | ---------------------------------------- |
| Owner          | FMN                                      |
| Authored by    | FMN                                      |
| Phase          | BUILD                                    |
| Storage        | `Sigma/build/`                           |
| Versioning     | Tier 2                                   |
| Auto-supersede | No (multi-active, manual supersede only) |

One living document with two internal sections:

- **Section 1 — Work Order / Task Plan**: what needs to be built, task breakdown, acceptance criteria, dependencies. Authored before DEV begins.
- **Section 2 — Simulation Test Report**: pre-build test contract written BEFORE DEV starts; pass/fail results filled AFTER DEV's EXEC is completed. This section is the pre-build contract — it must be written before `sigma exec new` is called.

FMN-PLAN is the Sigma equivalent of Delta Full's WO + ANT-STR merged into one artifact.

> Template and section structure: **[PHASE 1]**

---

### 5.3 DEV-EXEC — Developer's Execution

| Property       | Value                                    |
| -------------- | ---------------------------------------- |
| Owner          | DEV                                      |
| Authored by    | DEV                                      |
| Phase          | BUILD                                    |
| Storage        | `Sigma/build/`                           |
| Versioning     | Tier 2                                   |
| Auto-supersede | No (multi-active, manual supersede only) |

One living document with two internal sections:

- **Section 1 — Implementation Plan**: how DEV will implement based on the locked FMN-PLAN; technical approach, architecture decisions. Authored before build begins.
- **Section 2 — Implementation Report**: what was built, decisions made during implementation, deviations from the plan, known issues. Authored after build is complete.

DEV-EXEC is the Sigma equivalent of Delta Full's CDC-IMPL + CDC-WALK merged into one artifact.

> Template and section structure: **[PHASE 1]**

---

### 5.4 DIR-CLOSE — Director's Closure

| Property       | Value               |
| -------------- | ------------------- |
| Owner          | Director            |
| Authored by    | Director            |
| Phase          | CLOSE               |
| Storage        | `Sigma/close/`      |
| Versioning     | Tier 1              |
| Auto-supersede | Yes (single-active) |

The closure document. Authored by the Director. Must explicitly reference the FMN-PLAN and DEV-EXEC versions that support the closure claim. A DIR-CLOSE without explicit evidence references is not valid — it must name which PLAN version and which EXEC version satisfy the closure evidence requirement.

Revision = new version. A LOCKED DIR-CLOSE is never edited in place. If revision is needed, create a new version — the old LOCKED version becomes SUPERSEDED automatically.

> Template and evidence reference format: **[PHASE 1]**

---

### 5.5 CSO — Cognitive State Object

| Property       | Value                       |
| -------------- | --------------------------- |
| Owner          | Any role                    |
| Authored by    | Any role                    |
| Phase          | Any                         |
| Storage        | `Sigma/logs/`               |
| Versioning     | Tier L (timestamp)          |
| Auto-supersede | N/A (immutable log entries) |

Optional handoff artifact for preserving session context between agent sessions. CSO is not a governance gate — its creation satisfies no gate requirement. It exists purely for cognitive continuity.

See Section 18 for CSO lifecycle details.

---

### 5.6 ROADMAP — Implementation Staging Map

| Property       | Value               |
| -------------- | ------------------- |
| Owner          | FMN                 |
| Authored by    | FMN (Director may initiate) |
| Phase          | BUILD               |
| Storage        | `Sigma/build/`      |
| Versioning     | Tier 1              |
| Auto-supersede | Yes (single-active) |

Optional FMN-authored document that breaks a locked DIR-INTENT into large build stages before each stage is converted into an FMN-PLAN. ROADMAP is not a runtime gate — FMN-PLAN does not require a ROADMAP to exist.

ROADMAP describes how many stages and in what order. FMN-PLAN defines the next executable build contract.

Pre-condition to create: DIR-INTENT must be LOCKED. No other gate. Only one ROADMAP may be in DRAFT state at a time.

ROADMAP does not replace FMN-PLAN. A ROADMAP stage is not a build contract — it is a staging signal for FMN.

If ROADMAP conflicts with DIR-INTENT, DIR-INTENT wins.

AUD may provide informal advisory comments on ROADMAP if Director asks, but no formal audit command or audit gate exists for ROADMAP.

> Template: `Sigma/templates/ROADMAP-TEMPLATE.md`

---

## 6. State Machine

### 6.1 DIR-INTENT States

```
DRAFT → LOCKED → SUPERSEDED
```

| State        | Description                           | Triggered by                    |
| ------------ | ------------------------------------- | ------------------------------- |
| `DRAFT`      | Created; not yet locked               | `sigma intent new`              |
| `LOCKED`     | Director-approved; satisfies Gate 1   | `sigma intent lock`             |
| `SUPERSEDED` | Replaced when a new version is locked | Auto on new `sigma intent lock` |

**Rules:**

- `sigma intent review` writes AUD advisory findings to the document file — it does NOT change the runtime state in `progress.json`. INTENT stays DRAFT after review.
- DRAFT may transition directly to LOCKED (review is optional)
- Only one DIR-INTENT may be LOCKED at a time (single-active)
- When a new version is LOCKED, the previously LOCKED version becomes SUPERSEDED automatically

---

### 6.2 FMN-PLAN States

```
DRAFT → LOCKED → [SUPERSEDED]
```

| State        | Description                         | Triggered by                                    |
| ------------ | ----------------------------------- | ----------------------------------------------- |
| `DRAFT`      | Created; not yet locked             | `sigma plan new`                                |
| `LOCKED`     | Director-approved; satisfies Gate 2 | `sigma plan lock`                               |
| `SUPERSEDED` | Explicitly superseded by Director   | `sigma plan supersede --v <ver> --reason "..."` |

**Rules:**

- `sigma plan audit` writes AUD advisory findings to the document file — it does NOT change the runtime state. PLAN stays DRAFT after audit.
- DRAFT may transition directly to LOCKED (audit is optional)
- Multiple FMN-PLAN versions may be LOCKED simultaneously (multi-active)
- Locking a new FMN-PLAN version does NOT auto-supersede previous LOCKED versions
- Supersede is always explicit and requires a stated reason

---

### 6.3 DEV-EXEC States

```
DRAFT → BUILDING → TESTING → COMPLETED → LOCKED → [SUPERSEDED]
```

| State        | Description                                     | Triggered by                                    |
| ------------ | ----------------------------------------------- | ----------------------------------------------- |
| `DRAFT`      | Created; sections not yet written               | `sigma exec new`                                |
| `BUILDING`   | DEV is actively implementing                    | `sigma exec advance building`                   |
| `TESTING`    | Implementation done; testing in progress        | `sigma exec advance testing`                    |
| `COMPLETED`  | Testing done; Implementation Report written     | `sigma exec advance complete`                   |
| `LOCKED`     | Director-approved; satisfies Gate 3 (EXEC side) | `sigma exec lock`                               |
| `SUPERSEDED` | Explicitly superseded by Director               | `sigma exec supersede --v <ver> --reason "..."` |

**Rules:**

- `sigma exec audit` writes AUD advisory findings to the document file — it does NOT change the runtime state. EXEC stays in its current state after audit.
- Audit may be invoked at any point before lock (DRAFT, BUILDING, TESTING, or COMPLETED)
- Multiple DEV-EXEC versions may be LOCKED simultaneously (multi-active)
- Locking a new DEV-EXEC version does NOT auto-supersede previous LOCKED versions
- Supersede is always explicit and requires a stated reason

---

### 6.4 DIR-CLOSE States

```
DRAFT → LOCKED → SUPERSEDED
```

| State        | Description                                               | Triggered by                   |
| ------------ | --------------------------------------------------------- | ------------------------------ |
| `DRAFT`      | Created; not yet locked                                   | `sigma close new`              |
| `LOCKED`     | Director-approved; project lifecycle_state becomes CLOSED | `sigma close lock`             |
| `SUPERSEDED` | Replaced when a new version is locked                     | Auto on new `sigma close lock` |

**Rules:**

- `sigma close audit` writes AUD advisory findings to the document file — it does NOT change the runtime state. CLOSE stays DRAFT after audit.
- DRAFT may transition directly to LOCKED (audit is optional)
- Only one DIR-CLOSE may be LOCKED at a time (single-active)
- Revision = new version. When a new version is LOCKED, the previous LOCKED version becomes SUPERSEDED automatically

---

### 6.5 ROADMAP States

```
DRAFT → LOCKED → SUPERSEDED
```

| State        | Description                           | Triggered by                     |
| ------------ | ------------------------------------- | -------------------------------- |
| `DRAFT`      | Created; not yet locked               | `sigma roadmap new`              |
| `LOCKED`     | Staging plan accepted                 | `sigma roadmap lock`             |
| `SUPERSEDED` | Replaced when a new version is locked | Auto on new `sigma roadmap lock` |

**Rules:**

- Only one ROADMAP may be LOCKED at a time (single-active)
- Only one ROADMAP may be in DRAFT state at a time — `sigma roadmap new` is blocked if a DRAFT already exists
- When a new version is LOCKED, the previously LOCKED version becomes SUPERSEDED automatically
- DRAFT may coexist with a LOCKED version — auto-supersede fires only at lock time
- No formal audit command exists for ROADMAP. AUD may provide informal advisory comments if Director asks, but no CLI audit gate is enforced.
- Director interaction via Section 9 of the ROADMAP document ("Director Roadmap Notes") is semantic only — no CLI enforcement

---

## 7. Gate Rules

Sigma has three gates. A gate blocks an operation until its pre-condition is satisfied. Gate enforcement is performed by the CLI at runtime against `progress.json` state. No agent action may bypass a gate — only a Director can unlock a gate by satisfying its pre-condition.

### Gate 1 — DESIGN Complete

| Property      | Value                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Blocks        | `sigma plan new`                                                                                         |
| Pre-condition | At least one `DIR-INTENT` with status `LOCKED` exists in `progress.json`                                 |
| CLI error     | `Gate 1 blocked: DIR-INTENT must be LOCKED before FMN-PLAN can be created. Complete DESIGN phase first.` |

DESIGN must be complete before BUILD begins. FMN cannot produce a work plan without a locked intent to plan against.

---

### Gate 2 — FMN-PLAN Locked

| Property      | Value                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Blocks        | `sigma exec new`                                                                                                     |
| Pre-condition | At least one `FMN-PLAN` with status `LOCKED` exists in `progress.json`                                               |
| CLI error     | `Gate 2 blocked: FMN-PLAN must be LOCKED before DEV-EXEC can be created. FMN must complete and lock the plan first.` |

DEV cannot begin implementation without an approved work plan and pre-build test contract.

---

### Gate 3 — BUILD Evidence

| Property            | Value                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocks              | `sigma close new`                                                                                                                                                                                 |
| Pre-condition       | Full INTENT → PLAN → EXEC chain: active INTENT is LOCKED; at least one DEV-EXEC is LOCKED whose `plan_version_ref` points to a LOCKED FMN-PLAN whose `intent_version_ref` points to that INTENT |
| CLI error (no chain)| `Gate 3 blocked: Requires INTENT → PLAN → EXEC chain all LOCKED (same version chain).`                                                                                                           |
| CLI error (stale)   | `Gate 3 stale: Qualifying chain has stale_intent=true. Add --ack-stale-intent to acknowledge and proceed.`                                                                                        |

CLOSE cannot be declared without evidence of completed work. Gate 3 validates the full chain — a PLAN that was never used by any EXEC does not count. A STALE_INTENT chain requires Director to explicitly acknowledge via `--ack-stale-intent` on `sigma close new`; without this flag, the CLI blocks.

The Director must explicitly identify which PLAN and EXEC versions satisfy the closure evidence requirement in the DIR-CLOSE document.

---

## 8. Auto-Supersede Policy

| Artifact     | Policy                                  | Mechanism                                                                                                                                       |
| ------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `DIR-INTENT` | **Single-active, auto-supersede**       | When a new DIR-INTENT version is LOCKED, all previously LOCKED versions → `SUPERSEDED` automatically. CLI enforces this at `sigma intent lock`. |
| `DIR-CLOSE`  | **Single-active, auto-supersede**       | When a new DIR-CLOSE version is LOCKED, all previously LOCKED versions → `SUPERSEDED` automatically. CLI enforces this at `sigma close lock`.   |
| `ROADMAP`    | **Single-active, auto-supersede**       | When a new ROADMAP version is LOCKED, the previously LOCKED version → `SUPERSEDED` automatically. CLI enforces this at `sigma roadmap lock`.    |
| `FMN-PLAN`   | **Multi-active, manual supersede only** | Locking a new FMN-PLAN version does not affect other LOCKED versions. Supersede requires: `sigma plan supersede --v <version> --reason "..."`   |
| `DEV-EXEC`   | **Multi-active, manual supersede only** | Locking a new DEV-EXEC version does not affect other LOCKED versions. Supersede requires: `sigma exec supersede --v <version> --reason "..."`   |

**Rationale for the distinction:** DIR-INTENT, DIR-CLOSE, and ROADMAP represent a single project-wide position at a time — one active intent baseline, one active closure baseline, one active staging plan. FMN-PLAN and DEV-EXEC represent work iterations — multiple versions may legitimately coexist as LOCKED records of completed work.

---

## 9. STALE_INTENT Warning

**Definition**: A FMN-PLAN or DEV-EXEC artifact that was produced against a DIR-INTENT version that has since been SUPERSEDED.

**Trigger**: When a new DIR-INTENT version is LOCKED (causing auto-supersede of the previous version), any LOCKED FMN-PLAN or DEV-EXEC that references the old DIR-INTENT version is flagged with `stale_intent: true` in `progress.json`.

**Effect on the artifact:**

- The artifact remains LOCKED — STALE_INTENT does not revoke lock status
- The artifact cannot satisfy Gate 3 (CLOSE) without Director acknowledgment of the staleness

**Effect on CLOSE:**

- `sigma close new` **blocks** if the qualifying PLAN/EXEC chain carries the STALE_INTENT flag
- Director must pass `--ack-stale-intent` to `sigma close new` to proceed; without it the command exits with a gate error
- The acknowledgment is recorded in the DIR-CLOSE DRAFT metadata — it is not a silent bypass

**What STALE_INTENT means:** The intent that governed that work has been superseded. The work itself may still be valid. Director decides whether the stale evidence is sufficient for closure or whether fresh BUILD artifacts should be produced against the new intent.

---

## 10. Naming Convention

All Sigma governance artifacts follow this naming pattern:

```
{ROLE}-{DOC}-v{VER}.md
```

PROJECT_ID is intentionally excluded. Artifacts live inside the project's `Sigma/` folder — path provides project context. Project identity is recorded in `progress.json` and `~/.sigma/projects.json`, not in filenames. This keeps filenames simple and makes project renaming cost-free.

| Placeholder | Valid values                                                  |
| ----------- | ------------------------------------------------------------- |
| `{ROLE}`    | `DIR` (Director), `FMN` (Foreman), `DEV` (Developer)          |
| `{DOC}`     | `INTENT`, `PLAN`, `EXEC`, `CLOSE`                             |
| `{VER}`     | Version string per tier — e.g. `1.0`, `0.1` (see Section 11) |

**Examples:**

| Artifact   | Example filename                                                |
| ---------- | --------------------------------------------------------------- |
| DIR-INTENT | `DIR-INTENT-v1.0.md`                                            |
| FMN-PLAN   | `FMN-PLAN-v0.1.md`                                              |
| DEV-EXEC   | `DEV-EXEC-v0.2.md`                                              |
| DIR-CLOSE  | `DIR-CLOSE-v1.0.md`                                             |
| CSO        | `CSO-ARC-20260516-1430.md` (timestamp pattern — see Section 18) |

---

## 11. Versioning Tiers

| Tier       | Artifacts             | Version format                    | Strategy                                                                                 |
| ---------- | --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| **Tier 1** | DIR-INTENT, DIR-CLOSE | `v1.0`, `v1.1`, `v2.0`            | Major/minor. Overwrite in place — same filename per version. Auto-supersede on new lock. |
| **Tier 2** | FMN-PLAN, DEV-EXEC    | `v0.1`, `v0.2`, `v0.3`            | Patch versions. Separate file per version. Multi-active. Manual supersede only.          |
| **Tier L** | CSO                   | `{YYYYMMDD}-{HHMM}` (in filename) | Timestamp. Immutable log entry — never overwritten, never superseded.                    |

**Tier 1 rules:**

- `v1.0` — baseline first lock
- `v1.1` — minor revision within the same intent baseline
- `v2.0` — major revision representing a significant change in intent or scope
- Each version number corresponds to a single file that is updated in place; old content is replaced when version is bumped and locked
- On lock, the previous LOCKED version is SUPERSEDED

**Tier 2 rules:**

- `v0.1` — first draft or iteration
- `v0.2`, `v0.3` etc. — subsequent iterations, each a separate file
- Multiple versions can coexist as LOCKED simultaneously

---

## 12. Folder Structure

Every Sigma project contains a `Sigma/` directory at the project root. This is the governance layer — separate from the project's source code, tests, and deliverables.

```
{ProjectRoot}/
├── Sigma/                                      ← Governance layer (all Sigma artifacts live here)
│   ├── SIGMA_CONSTITUTION.md                   ← Constitutional doctrine
│   ├── SIGMA_PROTOCOL.md                       ← Operational governance protocol
│   ├── SIGMA-REGISTRY.json                     ← Document authority registry (Phase 0B)
│   ├── SIGMA-OPERATION-REGISTRY.json           ← CLI operation contracts (Phase 0B)
│   ├── progress.json                           ← Runtime state (CLI-managed, authoritative)
│   ├── rules/           ← Role rule files (read-only governance reference)
│   │   ├── ARC-RULE.md
│   │   ├── AUD-RULE.md
│   │   ├── FMN-RULE.md
│   │   └── DEV-RULE.md
│   ├── design/          ← DESIGN artifacts
│   │   └── DIR-INTENT-v{VER}.md
│   ├── build/           ← BUILD artifacts
│   │   ├── FMN-PLAN-v{VER}.md
│   │   └── DEV-EXEC-v{VER}.md
│   ├── close/           ← CLOSE artifacts
│   │   └── DIR-CLOSE-v{VER}.md
│   ├── logs/            ← CSO files + CLI-generated backups and logs
│   │   ├── CSO-{AGENT}-{YYYYMMDD}-{HHMM}.md
│   │   ├── progress-backup-{timestamp}.json    ← Created by project reset
│   │   ├── migration-{timestamp}.json          ← Created on schema migration
│   │   └── sync-backup-{timestamp}/            ← Created by project sync
│   └── memory/          ← Decision Memory (CLI-managed)
│       └── decisions.jsonl
├── CLAUDE.md / GEMINI.md / AGENTS.md           ← Agent bridge files
└── [project source, tests, deliverables — outside Sigma/]
```

**Rules:**

- `progress.json` is CLI-managed. Agents must not edit it directly.
- `memory/decisions.jsonl` is CLI-managed. Agents must not edit it directly.
- `rules/` files are read-only during execution — agents read them, do not modify them.
- Source code, tests, and project deliverables live outside `Sigma/`. Sigma governs; it does not own the work product.

---

## 13. Folder-to-Phase Mapping

| Folder             | Phase                  | Artifacts                                                      |
| ------------------ | ---------------------- | -------------------------------------------------------------- |
| `Sigma/design/`    | DESIGN                 | `DIR-INTENT-v{VER}.md`                                         |
| `Sigma/build/`     | BUILD                  | `FMN-PLAN-v{VER}.md`, `DEV-EXEC-v{VER}.md`                     |
| `Sigma/close/`     | CLOSE                  | `DIR-CLOSE-v{VER}.md`                                          |
| `Sigma/rules/`     | All phases (reference) | `ARC-RULE.md`, `AUD-RULE.md`, `FMN-RULE.md`, `DEV-RULE.md`     |
| `Sigma/logs/`      | Any phase              | CSO files, progress backups, migration logs, sync backups      |
| `Sigma/memory/`    | Any phase              | `decisions.jsonl` (auto-harvested by CLI on lock events)       |

---

## 14. Audit Doctrine

### Core Principles

**1. AUD is advisory-only.**
AUD findings are evidence for Director judgment. They are not approval gates and cannot block artifact progression. The Director decides what to do with AUD findings.

**2. Director is the sole approval gate.**
Only the Director can lock artifacts. No audit finding, advisory verdict, or AUD recommendation constitutes approval. Approval = Director lock via CLI command.

**3. Intent Core is sovereign.**
The Director owns the destination — the core intent, goals, and vision expressed in the Intent Core sublayer of DIR-INTENT. AUD must not challenge, undermine, or request modification of Intent Core. The destination is not up for debate; the route is.

**4. Audit attacks the route, not the destination.**
AUD may challenge any challengeable sublayer: the route to the goal, technical assumptions, feasibility, scope choices, risk assessment, evidence requirements, plan adequacy, implementation quality, and closure sufficiency.

**5. One audit output format.**
AUD findings are written as a structured findings section *within* the artifact being audited — not as a separate standalone document. Evidence is co-located with the artifact it concerns.

### Auditable vs Sovereign Sublayers

| Sublayer                                                | Status                        |
| ------------------------------------------------------- | ----------------------------- |
| Intent Core (goals, vision, purpose)                    | **Sovereign** — not auditable |
| Director Constraints & Preferences                      | Auditable                     |
| Tech Stack                                              | Auditable                     |
| Timeline                                                | Auditable                     |
| Solution Assumptions                                    | Auditable                     |
| Architecture Preference                                 | Auditable                     |
| Scope Choices                                           | Auditable                     |
| Risk Assessment                                         | Auditable                     |
| Evidence Requirements                                   | Auditable                     |
| FMN-PLAN — Task Plan adequacy and completeness          | Auditable                     |
| FMN-PLAN — Test Contract scope and coverage             | Auditable                     |
| DEV-EXEC — Implementation approach vs plan              | Auditable                     |
| DEV-EXEC — Deviations from plan and their justification | Auditable                     |
| DEV-EXEC — Known issues and adequacy of disclosure      | Auditable                     |
| DIR-CLOSE — Evidence reference sufficiency              | Auditable                     |
| DIR-CLOSE — Accepted limitations                        | Auditable                     |

---

## 15. AUD Activation Policy

AUD is **optional by default.** Mandatory AUD is not the default — imposing mandatory audit on all artifacts would undermine Sigma's lightweight advantage over Delta Full.

### Recommended (not required)

| Scenario                                                           | Reason                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Before DIR-INTENT is locked for the first time                     | Faulty assumptions in DESIGN propagate into all of BUILD                |
| Before DEV-EXEC build begins, if scope or tech risk is non-trivial | Plan inadequacies are cheaper to catch before implementation than after |
| Before DIR-CLOSE is locked for public release                      | Closure evidence gaps are easier to address before publication          |

### Mandatory

AUD becomes mandatory only when the Director explicitly marks the project as **risk-sensitive** in `progress.json`. This designation must be made consciously — the CLI does not auto-assign risk sensitivity.

### Invocation commands

| Command               | Scope                               |
| --------------------- | ----------------------------------- |
| `sigma intent review` | AUD review of the active DIR-INTENT |
| `sigma plan audit`    | AUD audit of the active FMN-PLAN    |
| `sigma exec audit`    | AUD audit of the active DEV-EXEC    |
| `sigma close audit`   | AUD audit of the active DIR-CLOSE   |

`intent` uses `review` (not `audit`) because Intent Core is sovereign — only the route and assumptions are reviewable, not the destination. The other domains use `audit` because all their sublayers are auditable.

---

## 16. CLI Command Surface

**Binary**: `sigma`
**Pattern**: `sigma {domain} {action} [options]`

### Domain List

| Domain      | Responsibility                                                          |
| ----------- | ----------------------------------------------------------------------- |
| `project`   | Project initialization, status, lifecycle management                    |
| `session`   | Session bootstrap — role activation context for agents                  |
| `intent`    | DIR-INTENT lifecycle (new, review, lock, status, list)                  |
| `plan`      | FMN-PLAN lifecycle (new, audit, lock, supersede, status, list)          |
| `exec`      | DEV-EXEC lifecycle (new, audit, advance, lock, supersede, status, list) |
| `close`     | DIR-CLOSE lifecycle (new, audit, lock, status)                          |
| `roadmap`   | ROADMAP lifecycle — optional staging map (new, lock, list)              |
| `git`       | Git evidence output (read-only)                                         |
| `cso`       | CSO artifact creation                                                   |
| `setup`     | Installation, configuration, MCP memory setup                           |
| `gitignore` | Generate .gitignore entries for Sigma projects                          |

### Review/Audit Pattern

| Command               | Artifact   | Keyword  | Rationale                                                    |
| --------------------- | ---------- | -------- | ------------------------------------------------------------ |
| `sigma intent review` | DIR-INTENT | `review` | Intent Core is sovereign — only route/assumptions reviewable |
| `sigma plan audit`    | FMN-PLAN   | `audit`  | All sublayers auditable                                      |
| `sigma exec audit`    | DEV-EXEC   | `audit`  | All sublayers auditable                                      |
| `sigma close audit`   | DIR-CLOSE  | `audit`  | All sublayers auditable                                      |

There is no standalone `sigma audit` command. AUD is always invoked in the context of a specific artifact domain. AUD output is always advisory — only Director locks.

> Full command-by-command specification with options, flags, and error messages: **[PHASE 4]**

---

## 17. Git Evidence

Sigma provides minimal, read-only git evidence via `sigma git evidence`.

**Output:**

- Current branch name
- Latest commit hash and message
- Files changed since last commit
- Diff summary (stat-level)

**What Sigma does NOT provide** (deliberately excluded):

- No git publish layer
- No git evidence lifecycle (L0-L4 like Delta Full)
- No commit enforcement or branch management
- No heavy evidence tracking tied to artifact lock events

Git evidence in Sigma is informational. It gives Directors and agents visibility into the current working tree state. It is not a governance gate and does not satisfy any closure evidence requirement by itself.

---

## 18. CSO Lifecycle

CSO (Cognitive State Object) is an optional artifact for preserving session context between agent sessions.

**Naming**: `CSO-{AGENT}-{YYYYMMDD}-{HHMM}.md`

| Placeholder  | Example                    |
| ------------ | -------------------------- |
| `{AGENT}`    | `ARC`, `FMN`, `DEV`, `AUD` |
| `{YYYYMMDD}` | `20260516`                 |
| `{HHMM}`     | `1430`                     |

Full example: `CSO-ARC-20260516-1430.md`

**Storage**: `Sigma/logs/`

**Creation flow:**

1. `/cso` skill shortcut — generates a CSO draft from conversation context. Does not create the file artifact.
2. `sigma cso new --from <draft>` — creates and registers the CSO file in `Sigma/logs/`. This is the CLI step that makes the CSO a tracked artifact.

**Properties:**

- Tier L — immutable log entry. Never overwritten, never deleted, never superseded.
- CSO creation satisfies no gate requirement.
- CSO is visible in `sigma session bootstrap` output — recent CSOs are listed to aid agent orientation.
- Multiple CSOs may exist from the same session or role.

**Typical CSO contents:** current context summary, active artifact versions and states, pending decisions, recommended next actions, open questions, handoff notes.

---

## 19. Promotion Boundary

Sigma is scoped for small-to-medium projects. When a project outgrows Sigma's governance capacity, the Director may decide to promote to a heavier process.

**Signals that Sigma may be insufficient:**

- Project scope has grown beyond what a single FMN + DEV cycle can manage
- Compliance, regulatory, or enterprise governance requirements apply
- Multiple contributors require formal role separation at a level Sigma does not support
- Risk profile warrants Delta Full's full audit trail and multi-role governance
- The project has evolved into a long multi-phase initiative

**Promotion process:**

1. Director closes the Sigma project with a DIR-CLOSE that documents the reason for promotion
2. Director opens a new Delta Full project from scratch using the `delta project start` workflow
3. No automatic migration — Sigma artifacts do not convert to Delta Full artifacts
4. The closed Sigma project remains as a historical record

**There is no `sigma promote` command.** Promotion is a Director decision and a manual process. The boundary between Sigma and Delta Full is clean by design — they are architecturally separate systems with different runtime models, artifact structures, and governance depth.

---

## Phase-Extended Sections

The following sections will be completed in the phases indicated. Headers are maintained here to document the intended structure of this document.

---

## 20. Document Templates

> **[PHASE 1]** — Template content, section-by-section structure, sublayer authority labels, and Director lock verdict format for each artifact type (DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE, CSO) will be defined in Phase 1.

---

## 21. Role Rule Files

> **[PHASE 2]** — Detailed behavioral rules for ARC, AUD, FMN, and DEV — including session bootstrap procedures, prohibited actions, scope boundaries, what to read before starting, and what outputs are expected — will be defined in Phase 2 as `Sigma/rules/{ROLE}-RULE.md` files.

---

## 22. CLI Setup & Installation

> **[PHASE 3]** — `sigma setup install`, global directory structure (`~/.sigma/`), template deployment, MCP memory configuration, `sigma project start` initialization sequence, and `sigma session bootstrap` output format will be defined in Phase 3.

---

## 23. CLI Command Reference

> **[PHASE 4]** — Full command-by-command specification for all domains: exact subcommands, options, flags, pre-condition checks, state transitions triggered, error messages, and edge case behavior will be defined in Phase 4.

---

## 24. Memory & MCP Configuration

> **[PHASE 5]** — Decision Memory auto-harvest fields per lock event type, MCP memory node store setup (`~/.sigma/memory_sigma.jsonl`), memory tier initialization on project start, and guidance for agents querying Sigma memory via MCP tools (`search_nodes`, `read_graph`) will be defined in Phase 5.

---

## 25. Distribution & Bridge Files

> **[PHASE 6]** — npm package finalization, bridge file templates (CLAUDE.md, GEMINI.md, AGENTS.md), skill file specifications for all 4 platforms × 6 skills (`/arc`, `/aud`, `/fmn`, `/dev`, `/checkpoint`, `/cso`), and `SIGMA_README.md` content will be defined in Phase 6.

---

*SIGMA_PROTOCOL.md v0.1 — Phase 0A complete (2026-05-16). Extended per phase.*
