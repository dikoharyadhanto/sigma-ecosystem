# PLAN-1 — Phase 1: Artifact Templates

> **Phase**: 1 — Artifact Templates
> **Output**: 5 template files in `Sigma/templates/`
> **Gate**: Must be stable before Phase 3 CLI can implement `sigma intent new`, `sigma plan new`, `sigma exec new`, `sigma close new`
> **Dependency**: Phase 0B complete (naming convention, folder structure, and artifact state machines are finalized)

---

## Objective

Create the canonical Markdown templates for all four Sigma artifacts plus the CSO log format. These templates are the single source of truth that the Phase 3 CLI will embed and use when generating new artifact documents. Templates must not contain any fields that duplicate `progress.json` runtime state.

---

## Deliverables

| File                          | Location            | Status   | Source Recommendation                         |
| ----------------------------- | ------------------- | -------- | --------------------------------------------- |
| `DIR-INTENT-TEMPLATE.md`      | `Sigma/templates/`  | READY    | `Discussion/Rekomendasi - DIR-INTENT Document.md` |
| `FMN-PLAN-TEMPLATE.md`        | `Sigma/templates/`  | READY    | `Discussion/Rekomendasi - FMN-PLAN Document.md`   |
| `DEV-EXEC-TEMPLATE.md`        | `Sigma/templates/`  | READY    | `Discussion/Rekomendasi - DEV-EXEC Document.md`   |
| `DIR-CLOSE-TEMPLATE.md`       | `Sigma/templates/`  | READY    | `Discussion/Rekomendasi - DIR-CLOSE Document.md`  |
| `CSO-TEMPLATE.md`             | `Sigma/templates/`  | READY    | `Discussion/Rekomendasi -CSO Document.md`         |

---

## Design Constraints

These constraints apply to all templates and override any conflicting guidance in the source recommendations:

| Constraint | Rule | Source |
| :--- | :--- | :--- |
| Naming convention | Actual artifacts are named `{ROLE}-{DOC}-v{VERSION}.md` | Decision S4-1 (Phase 0B) |
| No runtime state fields | Templates must not include version number, lifecycle state, project ID, or gate status — these live in `progress.json` | Director note on recommendations |
| Folder routing | DIR-INTENT → `Sigma/design/`, FMN-PLAN + DEV-EXEC → `Sigma/build/`, DIR-CLOSE → `Sigma/close/` | Decision S4-2 (Phase 0B) |
| UNDER_REVIEW removed | No UNDER_REVIEW state exists — templates must not reference it | Decision S4-3 (Phase 0B) |
| Audit = advisory only | AUD findings sections in templates must carry explicit "advisory only" language | SIGMA_PROTOCOL.md |
| No PROJECT_ID in filenames | Template recommendation naming `DIR-INTENT-{PROJECT_ID}-{VERSION}` does not apply — use `{ROLE}-{DOC}-v{VERSION}.md` | Decision S4-1 supersedes recommendation |

---

## Task 1 — DIR-INTENT-TEMPLATE.md

### Template Design Notes

- Compressed from Delta `DIR-DI` + core of `GMN-STRAT`
- Sigma does not have a separate ARC-PLAN artifact — Section 9 (Execution Direction) serves that function
- Each section carries an explicit **Audit Status** marker
- Section 11 is the pre-lock checklist; the Director must complete it before `sigma intent lock` is valid

### Audit Status Definitions

| Status | Meaning |
| :--- | :--- |
| `CLARITY_ONLY` | AUD may flag ambiguity or missing criteria. AUD may not oppose, replace, or re-rank Director intent. |
| `FULL_AUDIT` | AUD may challenge feasibility, risk, consistency, or evidence sufficiency. |
| `CHALLENGEABLE` | Director preferences here may be challenged by AUD/FMN if they weaken execution. |
| `ADVISORY` | AUD findings are advisory signals. They do not approve, reject, or block runtime state. |

### Template Content

```markdown
# DIR-INTENT

> **Purpose**: Captures Director intent, strategic constraints, execution direction, auditable assumptions, and minimum evidence requirements for a Sigma project.
>
> **Authority Rule**: Director owns the destination. ARC, AUD, FMN, and DEV may advise, challenge, and interpret — but only the Director approves runtime state changes.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.

---

## 1. Intent Core — Sovereign Layer

> **Audit Status**: CLARITY_ONLY
> AUD may identify ambiguity, contradiction, missing success criteria, or unclear scope.
> AUD may not oppose, replace, or re-rank Director intent.

### 1.1 Objective

[What are we trying to create or change?]

### 1.2 Problem Being Solved

[What pain, gap, inefficiency, risk, or opportunity does this project address?]

### 1.3 Target User / Beneficiary

[Who benefits from this project?]

### 1.4 Desired Outcome

[What should be observably different when this project succeeds?]

### 1.5 Primary Value Delivered

[The core value this project must deliver.]

---

## 2. Success Definition

> **Audit Status**: FULL_AUDIT
> Success criteria must be measurable, observable, or verifiable.

### 2.1 Concrete Outcome

[Specific observable result.]

### 2.2 Success Threshold

[Quantified or binary threshold.]

### 2.3 Measurement Method

[How will success be verified?]

### 2.4 Minimum Viable Evidence

Before this project can close, Sigma must have:

- [ ] At least one locked `FMN-PLAN`
- [ ] Test results recorded against a pre-build test contract
- [ ] Implementation summary completed
- [ ] Known limitations documented
- [ ] Director closure verdict recorded

---

## 3. Strategic Trade-Offs

> **Audit Status**: FULL_AUDIT
> AUD may challenge whether trade-offs are coherent, feasible, or risky.

### 3.1 Primary Trade-Off

We prioritize **[X]** over **[Y]**.

### 3.2 Secondary Trade-Offs

- We are willing to sacrifice **[X]** to gain **[Y]**.
- We are willing to sacrifice **[X]** to gain **[Y]**.

### 3.3 Why These Trade-Offs Matter

[How these choices affect scope, architecture, timeline, risk, and evidence.]

---

## 4. Scope Boundary

> **Audit Status**: FULL_AUDIT
> Scope must be explicit enough for FMN to produce execution work without inventing intent.

### 4.1 In Scope

- [Must deliver item 1]
- [Must deliver item 2]

### 4.2 Out of Scope

- [Explicitly deferred item 1]
- [Explicitly deferred item 2]

### 4.3 Non-Goals

We will NOT do the following:

- [Non-goal 1]
- [Non-goal 2]

### 4.4 Why This Boundary Matters

[What goes wrong if this scope expands?]

---

## 5. Constraints & Preferences — Challengeable Means Layer

> **Audit Status**: CHALLENGEABLE
> Director may state preferences here, but AUD may challenge feasibility, risk, cost, mismatch, or hidden trade-offs.

| ID      | Type        | Statement | Binding Level   | Notes |
| :---    | :---        | :---      | :---            | :---  |
| CON-001 | Hard Constraint | [...]  | Non-negotiable  | [...] |
| CON-002 | Preference  | [...]     | Challengeable   | [...] |
| CON-003 | Timeline    | [...]     | Conditional     | [...] |
| CON-004 | Technical   | [...]     | Challengeable   | [...] |

### Binding Level Definitions

- **Non-negotiable**: Cannot be changed without Director revision.
- **Conditional**: Can change only if risk/trade-off is accepted by Director.
- **Challengeable**: Can be challenged by AUD/FMN if it weakens execution.
- **Preference**: Desired, but not binding if better route exists.

---

## 6. Technical & Architecture Direction

> **Audit Status**: FULL_AUDIT
> Tech stack, architecture, and solution assumptions are auditable means — not sovereign intent.

### 6.1 Preferred Tech Stack

| Layer    | Technology | Reason | Risk / Trade-Off |
| :---     | :---       | :---   | :---             |
| [Layer]  | [...]      | [...]  | [...]            |

### 6.2 Architecture Direction

[High-level architecture or product structure.]

### 6.3 Solution Assumptions

| Assumption ID | Assumption | Confidence          | What if wrong? |
| :---          | :---       | :---                | :---           |
| ASM-001       | [...]      | Low / Medium / High | [...]          |

### 6.4 Explicitly Rejected Approaches

| Rejected Option | Reason Rejected | Trade-Off Accepted |
| :---            | :---            | :---               |
| [...]           | [...]           | [...]              |

---

## 7. Functional Requirements

> **Audit Status**: FULL_AUDIT
> FMN uses this section to create the FMN-PLAN task plan and test contract.

### REQ-001 — [Requirement Title]

**Priority**: Must / Should / Could

**User Story**:
As a [role], I want to [action], so that [benefit].

**Acceptance Criteria**:

- [ ] [Measurable or binary condition]
- [ ] [Observable expected behavior]

### REQ-002 — [Requirement Title]

**Priority**: Must / Should / Could

**User Story**:
As a [role], I want to [action], so that [benefit].

**Acceptance Criteria**:

- [ ] [...]

---

## 8. Risk & Failure Definition

> **Audit Status**: FULL_AUDIT
> Risks should be practical, not decorative.

### 8.1 Risk Appetite

| Risk Type          | Tolerance                   |
| :---               | :---                        |
| Fatal Risk         | Zero / Conditional          |
| Degraded Capability | Low / Medium / High        |
| Unknowns           | Low / Medium / High         |

### 8.2 Primary Failure Concern

**The Failure**:
[Worst realistic outcome to avoid.]

**Why This Matters**:
[Impact.]

**Guardrail / Mitigation**:
[How we reduce the chance or impact.]

### 8.3 Risk Register

| Risk ID | Classification               | Description | Impact | Mitigation | Accepted?              |
| :---    | :---                         | :---        | :---   | :---       | :---                   |
| RR-001  | Fatal / Degrading / Noise    | [...]       | [...]  | [...]      | Yes / No / Conditional |

### 8.4 Failure Definition

- **Project Failure**: [...]
- **Build Blocker**: [...]
- **Acceptable Degraded State**: [...]

---

## 9. Execution Direction for FMN

> **Audit Status**: FULL_AUDIT
> This section tells FMN how to convert intent into execution. Replaces ARC-PLAN — Sigma does not have a separate ARC artifact.

### 9.1 Execution Focus

| Focus Area | Why It Matters | Watch-Out |
| :---       | :---           | :---      |
| [...]      | [...]          | [...]     |

### 9.2 FMN Must Produce

The first `FMN-PLAN` must include:

- [ ] Work Order / Task Plan
- [ ] Pre-Build Test Contract
- [ ] Implementation constraints
- [ ] Post-Build Test Report section
- [ ] Implementation Report section
- [ ] Evidence Summary

### 9.3 DEV Must Not

- [Forbidden implementation behavior]
- [Out-of-scope expansion]
- [Assumption not allowed]

---

## 10. AUD Findings — Advisory Only

> **Audit Status**: ADVISORY
> AUD findings support Director judgment. They do not approve, reject, lock, or block runtime state.

### 10.1 AUD Review Scope

AUD may review: intent clarity, scope consistency, technical feasibility, architecture assumptions, risk coverage, success criteria, evidence sufficiency, route vs destination alignment.

AUD may not: replace Director intent, re-rank Director values, or treat advisory findings as runtime approval.

### 10.2 AUD Advisory Verdict

**Verdict**: PASS / PASS_WITH_RISK / REVISE / REJECT_RECOMMENDED / PROMOTE_TO_HEAVIER_PROCESS

**Major Findings**:

1. [...]
2. [...]
3. [...]

**Recommended Director Action**:

[...]

---

## 11. Final Validation Checklist

> Complete this checklist before running `sigma intent lock`.

- [ ] Intent Core is clear enough to guide execution.
- [ ] Scope in/out is explicit.
- [ ] Success criteria are observable or measurable.
- [ ] Constraints and preferences are separated.
- [ ] Technical choices are marked as auditable means, not sovereign intent.
- [ ] At least one execution direction exists for FMN (Section 9).
- [ ] Risk appetite is stated.
- [ ] Primary failure concern is stated.
- [ ] Evidence requirement is stated.
- [ ] Director verdict is recorded.
```

---

## Task 2 — FMN-PLAN-TEMPLATE.md

### Template Design Notes

- Merged build contract + test contract + test results + FMN advisory verdict into a single artifact
- Replaces Delta `GMN-WO` + `ANT-STR` (test contract role)
- **Section 10 (Director Observation Testing Report) is append-only after lock** — Phase 3 CLI must enforce this; sections 1–9 are immutable once `plan_lock` is called
- Section 11 (Director Follow-Up Decision Notes) drives routing decisions but does not mutate `progress.json` — runtime state is managed exclusively by the CLI
- AUD Findings (Section 9) is optional

### FMN Advisory Verdict Values

| Verdict | Meaning |
| :--- | :--- |
| `READY_FOR_BUILD` | Plan is complete; DEV may proceed |
| `TEST_PASS` | Post-build test results pass the contract |
| `TEST_FAIL` | Post-build test results fail; revision required |
| `COMPLETE_WITH_RISK` | Results acceptable but known risk accepted |
| `REVISION_REQUIRED` | FMN recommends reopening before close |

### Director Follow-Up Decision Values

| Decision | When to Use |
| :--- | :--- |
| `OPEN_NEW_PLAN` | Problems change task plan, acceptance criteria, test contract, scope, or interpretation of intent |
| `UPDATE_CURRENT_EXEC` | Plan still valid; implementation needs minor fix, bugfix, or retest. No new FMN-PLAN needed. |
| `CONSIDER_CLOSE` | Results sufficient to enter `sigma close new` |
| `ACCEPT_AS_LIMITATION` | Problem known and accepted as limitation for this version |
| `NEED_EXPLANATION` | Director unsure whether issue is bug, expected behavior, trade-off, or misunderstanding |

### Template Content

```markdown
# FMN-PLAN

> Build contract, test contract, test results, and Foreman advisory recommendation.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.
> **Post-Lock Rule**: Sections 1–9 are immutable after lock. Section 10 (Director Observations) is append-only. Section 11 (Director Decision Notes) is always writable.

---

## 1. Source Alignment

Summarize how this plan serves the locked Director Intent.

- Intent point served:
- Scope boundary respected:
- Success criteria supported:
- Constraint or risk addressed:

---

## 2. Work Order / Task Plan

### Build Objective

[...]

### Task Breakdown

| Task ID  | Task | Expected Output | Priority        |
| :---     | :--- | :---            | :---            |
| TASK-001 | [...] | [...]          | Must            |
| TASK-002 | [...] | [...]          | Should          |

---

## 3. Acceptance Criteria

| AC ID  | Criteria | Verification Method | Required Result |
| :---   | :---     | :---                | :---            |
| AC-001 | [...]    | [...]               | [...]           |
| AC-002 | [...]    | [...]               | [...]           |

---

## 4. Implementation Constraints

| Constraint | Source / Reason | DEV Freedom                      |
| :---       | :---            | :---                             |
| [...]      | [...]           | Non-negotiable / Guided / Flexible |

---

## 5. Pre-Build Test Contract

> Must be defined before DEV starts implementation.

| Test ID | Behavior / Requirement | Test Method | Expected Result | Evidence Required |
| :---    | :---                   | :---        | :---            | :---              |
| TC-001  | [...]                  | [...]       | [...]           | [...]             |
| TC-002  | [...]                  | [...]       | [...]           | [...]             |

---

## 6. DEV Handoff Instructions

DEV must:

- [...]
- [...]

DEV must not:

- [...]

DEV should report in DEV-EXEC:

- Implementation approach
- Deviations from plan
- Changed files / components
- Known issues
- Evidence summary

---

## 7. Post-Build Test Result

> Filled after DEV completes implementation and reports in DEV-EXEC.

| Test ID | Expected Result | Actual Result | Status                    | Evidence |
| :---    | :---            | :---          | :---                      | :---     |
| TC-001  | [...]           | [...]         | PASS / FAIL / NOT_RUN     | [...]    |
| TC-002  | [...]           | [...]         | PASS / FAIL / NOT_RUN     | [...]    |

---

## 8. FMN Findings & Advisory Recommendation

### Findings

- [...]

### Advisory Verdict

READY_FOR_BUILD / TEST_PASS / TEST_FAIL / COMPLETE_WITH_RISK / REVISION_REQUIRED

### Recommendation to Director

[...]

---

## 9. AUD Findings — Advisory, Optional

> AUD findings are advisory only. They do not approve, reject, or block runtime state.

- [...]

---

## 10. Director Observation Testing Report

> **Post-Lock Rule**: This section is append-only after `sigma plan lock`. Sigma CLI enforces this.
> Director observations are raw manual testing signals. FMN interprets them into fix/retest recommendations.

- [ ] **OBS-001** — [Issue or observation]
  - Location:
  - Severity: Low / Medium / High / Critical
  - Follow-up: Need Fix / Need Recheck / Need Explanation / Accept Limitation / Open New Version
  - Category: Critical Error / Hidden Bug / Mismatch With Intent / Question / Positive Feedback
  - Status: Open / Resolved / Explained / Accepted / Carried To Next Version

- [ ] **OBS-002** — [...]
  - Location:
  - Severity:
  - Follow-up:
  - Category:
  - Status:

---

## 11. Director Follow-Up Decision Notes

> Director-only notes for deciding what happens after manual observation.
> Runtime approval and lock state are managed by Sigma CLI — not by this section.

Decision:

OPEN_NEW_PLAN / UPDATE_CURRENT_EXEC / CONSIDER_CLOSE / ACCEPT_AS_LIMITATION / NEED_EXPLANATION

Notes:

[...]
```

---

## Task 3 — DEV-EXEC-TEMPLATE.md

### Template Design Notes

- Compressed from Delta `CDC-IMPL` (pre-implementation plan) + `CDC-WALK` (post-implementation walkthrough)
- DEV-EXEC does not repeat the test contract — it references the FMN-PLAN and reports against it
- Must carry the FMN-PLAN version reference in Section 1 (Source Plan Alignment)
- Multi-active: multiple versions may be locked; manual supersede requires `--v --reason`
- Decision Memory harvest triggered at `exec_lock`
- No runtime metadata, approval gates, skill routing, or NLM — DEV-EXEC must remain developer-readable

### DEV Advisory Status Values

| Status | Meaning |
| :--- | :--- |
| `IMPLEMENTED` | Implementation complete; ready for FMN review |
| `PARTIALLY_IMPLEMENTED` | Some tasks complete; DEV notes what remains |
| `BLOCKED` | Implementation halted; blocker described in Section 10 |
| `NEEDS_FMN_REVIEW` | Deviation or uncertainty requires FMN decision before proceeding |

### Boundary with FMN-PLAN

| FMN-PLAN answers | DEV-EXEC answers |
| :--- | :--- |
| What must be built? | What did DEV actually do? |
| What are the acceptance criteria? | Why was it done this way? |
| What is the test contract? | What files/components changed? |
| What do the test results show? | Were there deviations? |
| What are Director observations? | What did the developer verify? |

### Template Content

```markdown
# DEV-EXEC

> Implementation approach, execution report, verification evidence, and developer walkthrough.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.

---

## 1. Source Plan Alignment

Summarize how this execution follows the locked FMN-PLAN.

- FMN task plan followed:
- Acceptance criteria targeted:
- Test contract referenced:
- Constraints respected:
- Known implementation boundary:

---

## 2. Implementation Approach

### What Will Be Built / Changed

[...]

### Technical Approach

[...]

### Rationale

Why this approach fits the FMN-PLAN and DIR-INTENT:

[...]

### Alternatives Considered

| Option | Reason Rejected / Deferred |
| :--- | :--- |
| [...] | [...] |

---

## 3. Files / Components To Change

| File / Component | Action                        | Purpose |
| :---             | :---                          | :---    |
| [...]            | Create / Modify / Delete      | [...]   |
| [...]            | Create / Modify / Delete      | [...]   |

---

## 4. Key Technical Decisions

| Decision | Rationale | Trade-Off / Risk |
| :---     | :---      | :---             |
| [...]    | [...]     | [...]            |

---

## 5. Implementation Walkthrough

### What Was Implemented

[...]

### How It Works

[...]

### Main Flow

1. [...]
2. [...]
3. [...]

### Important Logic / Abstractions

- [...]

---

## 6. Deviations From FMN-PLAN

> Record any deviation from the locked FMN-PLAN. Do not hide deviations.

| Deviation | Reason | Impact              | Needs FMN Review? |
| :---      | :---   | :---                | :---              |
| [...]     | [...]  | Low / Medium / High | Yes / No          |

If no deviation exists, write:

> No material deviation from FMN-PLAN.

---

## 7. Dependency / Environment Changes

| Dependency / Tool / Environment | Action                              | Reason | Risk  |
| :---                            | :---                                | :---   | :---  |
| [...]                           | Add / Update / Remove / Configure   | [...]  | [...] |

If none, write:

> No dependency or environment changes.

---

## 8. Developer Verification

DEV records checks performed before handing back to FMN.

| Check               | Command / Method | Result                | Evidence |
| :---                | :---             | :---                  | :---     |
| Build / compile     | [...]            | PASS / FAIL / N/A     | [...]    |
| Unit tests          | [...]            | PASS / FAIL / N/A     | [...]    |
| Integration tests   | [...]            | PASS / FAIL / N/A     | [...]    |
| Manual smoke check  | [...]            | PASS / FAIL / N/A     | [...]    |

---

## 9. Git / Change Evidence

Minimal physical trace. Mark N/A only if no material file changes exist.

| Field              | Value                  |
| :---               | :---                   |
| Branch             | [...]                  |
| Latest Commit      | [...]                  |
| Working Tree State | clean / dirty          |
| Changed Files      | [...]                  |
| Diff Summary       | [...]                  |

---

## 10. Issues Encountered

| Issue | Cause | Resolution | Residual Risk |
| :---  | :---  | :---       | :---          |
| [...] | [...] | [...]      | [...]         |

If none, write:

> No material implementation issues encountered.

---

## 11. Known Limitations / Technical Debt

| Item  | Impact | Recommended Follow-Up |
| :---  | :---   | :---                  |
| [...] | [...]  | [...]                 |

If none, write:

> No known technical debt introduced.

---

## 12. DEV Completion Statement

### Completion Summary

[...]

### DEV Advisory Status

IMPLEMENTED / PARTIALLY_IMPLEMENTED / BLOCKED / NEEDS_FMN_REVIEW

### Notes for FMN

[...]
```

---

## Task 4 — DIR-CLOSE-TEMPLATE.md

### Template Design Notes

- Compressed from Delta `ANT-PDC` — closure summary + evidence references + limitations + publish-ready notes + next decision
- Does not require full STRAT coverage, ownership matrix, YAML closure gate, or large checklist
- Single-active: auto-supersede on lock (same as DIR-INTENT)
- Gate 3 chain (INTENT → PLAN → EXEC all LOCKED) must be satisfied before `sigma close new`
- STALE_INTENT acknowledgment (if applicable) recorded in DIR-CLOSE DRAFT metadata before lock
- Decision Memory harvest triggered at `close_lock`
- Section 3 (Evidence References) must reference at minimum one locked DEV-EXEC

### Director Closure Decision Values

| Decision | When to Use |
| :--- | :--- |
| `CLOSE_ACCEPTED` | Project fully delivered; close is valid |
| `CLOSE_ACCEPTED_WITH_LIMITATIONS` | Project delivered with known limitations accepted |
| `DO_NOT_CLOSE` | Insufficient evidence; closure should not proceed |
| `OPEN_NEW_PLAN` | New issues require a new FMN-PLAN cycle before close |
| `UPDATE_CURRENT_EXEC` | Minor fix needed; retest before closing |

### Template Content

```markdown
# DIR-CLOSE

> Final closure summary, evidence reference, accepted limitations, and publish-ready documentation notes.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.
> **Gate Rule**: Requires INTENT → PLAN → EXEC chain all LOCKED before `sigma close new`.

---

## 1. Closure Summary

### What Was Delivered

[1–3 sentence description of what was actually delivered.]

### Primary User / Beneficiary

[Who uses or benefits from the delivered output.]

### Primary Value Delivered

[The concrete value this project now provides.]

---

## 2. Intent Satisfaction

Summarize how the delivered output satisfies the locked Director Intent.

- Intent satisfied:
- Success criteria reached:
- Scope delivered:
- Trade-off respected:
- Primary failure concern addressed:

---

## 3. Evidence References

> DIR-CLOSE must reference the evidence that supports closure. At minimum, one locked DEV-EXEC is required.

| Evidence Type       | Reference | What It Proves                          |
| :---                | :---      | :---                                    |
| FMN-PLAN            | [...]     | Build/test contract used                |
| DEV-EXEC            | [...]     | Implementation and walkthrough evidence |
| Test Result         | [...]     | Verification against test contract      |
| Git Diff Evidence   | [...]     | Physical code/change trace              |
| Director Observation | [...]    | Manual testing signal / accepted follow-up |

---

## 4. Final Scope Confirmation

### Delivered

- [...]
- [...]

### Not Delivered / Deferred

- [...]
- [...]

### Accidental Scope Drift

- None / [...]

---

## 5. Product Behavior Notes

### Core Flow

1. [...]
2. [...]
3. [...]

### Key Behaviors

| Behavior | Trigger | Output / Result |
| :---     | :---    | :---            |
| [...]    | [...]   | [...]           |

---

## 6. Known Limitations

| Limitation | User Impact | Workaround / Follow-Up | Accepted?              |
| :---       | :---        | :---                   | :---                   |
| [...]      | [...]       | [...]                  | Yes / No / Conditional |

---

## 7. Deviations From Intent / Plan

| Deviation | Source                                  | Impact | Resolution                           |
| :---      | :---                                    | :---   | :---                                 |
| [...]     | DIR-INTENT / FMN-PLAN / DEV-EXEC        | [...]  | Accepted / Deferred / Needs New Plan |

If none, write:

> No material deviation from locked DIR-INTENT or FMN-PLAN.

---

## 8. Operational / Handoff Notes

### How to Run / Use

- Setup:
- Run command:
- Required configuration:
- Important dependency:

### Maintenance Notes

- Known operational risks:
- Debug path:
- Follow-up owner:

---

## 9. Publish-Ready Documentation Notes

> Notes reusable for README, release note, product page, GitHub documentation, or user handoff.

### Short Product Description

[...]

### Feature Summary

- [...]
- [...]

### Usage Notes

- [...]
- [...]

### Limitations To Disclose

- [...]

---

## 10. Director Closure Decision Notes

> Director-only closure notes. Runtime lock state is managed by Sigma CLI — not by this section.

Closure Decision:

CLOSE_ACCEPTED / CLOSE_ACCEPTED_WITH_LIMITATIONS / DO_NOT_CLOSE / OPEN_NEW_PLAN / UPDATE_CURRENT_EXEC

Reason:

[...]

Accepted Limitations:

- [...]

Required Follow-Up:

- [...]
```

---

## Task 5 — CSO-TEMPLATE.md

### CSO Design Notes

- CSO (Cognitive State Object) is a **full Markdown handoff/audit support document**, not a JSON log entry
- Stored in `Sigma/logs/`, named `CSO-{ROLE}-{YYYYMMDDHHMM}.md`
- Created via `sigma cso new --agent <ARC|AUD|FMN|DEV|DIR>`
- CSO is **never a workflow gate** — it is optional, complete-state evidence for handoff and audit support
- `progress.json → cso[]` serves as a lightweight index of CSO sessions (id + timestamp + role + topic); the full content lives in the markdown file
- 90% same structure as Delta CSO — adapted terminology, removed override/block references, added Advisory Judgments section
- CSO does not create authority, does not change runtime state, does not replace governed artifacts

### Key Differences from Delta CSO

| Delta CSO | Sigma CSO |
| :--- | :--- |
| GMN / ANT / CDC / GPT / PPX / DIR roles | ARC / AUD / FMN / DEV / DIR roles |
| DI / STRAT / WO / STR / IMPL / WALK / PDC artifacts | DIR-INTENT / FMN-PLAN / DEV-EXEC / DIR-CLOSE artifacts |
| `delta cso ...` commands | `sigma cso ...` commands |
| `~/.delta/memory_delta.jsonl` | `~/.sigma/memory_sigma.jsonl` |
| Active overrides or blocks section | Runtime warnings / stale intent flags section |
| Constitutional / Operational / Project-only / Ephemeral + Learning Memory | Constitutional / Operational Sigma / Project-only / Ephemeral (no Learning Memory) |

### Template Content

```markdown
# CSO-[ROLE]-[YYYYMMDDHHMM]

**Sigma Cognitive State Object (CSO)**

> **Purpose**: A CSO captures session context for handoff and audit support. It is optional, complete-state evidence and never a workflow gate. Project-specific context belongs here or in governed Sigma artifacts, not in global memory.

---

## 1. Session Metadata

| Field              | Value                                               |
| :---               | :---                                                |
| Role / Agent       | [ARC / AUD / FMN / DEV / DIR]                       |
| Created At         | [YYYYMMDDHHMM]                                      |
| Runtime State      | DRAFT / COMPLETE                                    |
| Linked Artifact(s) | [DIR-INTENT / FMN-PLAN / DEV-EXEC / DIR-CLOSE / none] |
| Session Topic      | [Brief title]                                       |

---

## 2. Director Signal

- **Explicit request**: [What the Director asked for]
- **Constraints stated by Director**: [Constraints]
- **Decisions explicitly approved**: [Approved decisions]
- **Preferences or direction signals**: [Non-binding but relevant Director signals]

---

## 3. Active Role Context

- **Role active in this session**: [ARC / AUD / FMN / DEV / DIR]
- **Applicable governance**: [SIGMA_CONSTITUTION / SIGMA_PROTOCOL / role rule files read]
- **Runtime state checked**: [Commands used and relevant result]
- **Runtime warnings**: [None / stale intent / schema warning / missing artifact / gate blocked]

---

## 4. Artifact Context

Use weak `related_to` references. CSO links provide historical context; they do not create authority over formal artifacts.

| Artifact Type | File   | Relationship | State At Capture |
| :---          | :---   | :---         | :---             |
| DIR-INTENT    | [file] | related_to   | [state]          |
| FMN-PLAN      | [file] | related_to   | [state]          |
| DEV-EXEC      | [file] | related_to   | [state]          |
| DIR-CLOSE     | [file] | related_to   | [state]          |

---

## 5. Decisions & Rationale

| Decision   | Rationale | Trade-Off | Approved By          |
| :---       | :---      | :---      | :---                 |
| [decision] | [why]     | [cost/risk] | Director / Pending |

---

## 6. Advisory Judgments

> Advisory judgments are decision-support signals only. They do not approve, reject, lock, or block runtime state.

| Role                      | Advisory Verdict | Reason   | Recommended Director Action |
| :---                      | :---             | :---     | :---                        |
| ARC / AUD / FMN / DEV     | [verdict]        | [reason] | [recommendation]            |

---

## 7. Work Completed

| Item   | Owner  | Status                          | Evidence              |
| :---   | :---   | :---                            | :---                  |
| [task] | [role] | Pending / In Progress / Done    | [file/command/result] |

---

## 8. Open Questions & Blockers

- **Critical blockers**: [Items that halt progress]
- **Non-blocking questions**: [Items to resolve later]
- **Deferred items**: [Items intentionally left out]
- **Next decision needed from Director**: [Specific decision]

---

## 9. Integrity Notes

- **Validated facts**: [Facts verified from files, CLI, or Director]
- **Assumptions**: [Assumptions still needing validation]
- **Risks**: [Known risks]
- **Do not assume**: [Guardrails for next session]

---

## 10. Memory & Persistence Candidates

Only ecosystem-level, Director-approved facts may be promoted to Sigma MCP memory. Project-specific facts stay in CSO or project artifacts.

| Candidate | Classification                                           | Promotion Recommendation          | Director Approval               |
| :---      | :---                                                     | :---                              | :---                            |
| [fact]    | Constitutional / Operational Sigma / Project-only / Ephemeral | Promote / Keep in CSO / Discard | Pending / Approved / Rejected |

---

## 11. Handoff Instructions

- **Mandatory next action**: [Specific next action]
- **Files to read first**: [Files]
- **Useful commands**: [Commands for the next role]
- **Do not modify**: [Locked or sensitive sections/artifacts]
- **Recommended role next**: [ARC / AUD / FMN / DEV / DIR]

---

## 12. Summary Snapshot

[Two or three sentences summarizing current state and next step.]

---

# Quick Reference

- Create with `sigma cso new --agent <ARC|AUD|FMN|DEV|DIR>`.
- Save under `Sigma/logs/`.
- CSO is optional and never a workflow gate.
- Runtime state remains governed by `Sigma/progress.json`.
```

---

## Implementation Steps

| Step | Action | Status |
| :--- | :--- | :--- |
| 1 | Create `Sigma/templates/` folder | TODO |
| 2 | Write `DIR-INTENT-TEMPLATE.md` from Task 1 spec | TODO |
| 3 | Write `FMN-PLAN-TEMPLATE.md` from Task 2 spec | TODO |
| 4 | Write `DEV-EXEC-TEMPLATE.md` from Task 3 spec | TODO |
| 5 | Write `DIR-CLOSE-TEMPLATE.md` from Task 4 spec | TODO |
| 6 | Write `CSO-TEMPLATE.md` from Task 5 spec | TODO |
| 7 | Update `SIGMA-REGISTRY.json` to register `Sigma/templates/` folder | TODO (minor) |

> All steps are now unblocked. Steps 1–6 may proceed in order.

---

## Acceptance Criteria

- [ ] All 5 template files exist in `Sigma/templates/`
- [ ] No template file contains fields that duplicate `progress.json` runtime state (version number, lifecycle state, project ID, gate flags)
- [ ] DIR-INTENT template has 11 sections with correct audit status markers on each section
- [ ] FMN-PLAN template has 11 sections; Section 10 carries explicit append-only post-lock language
- [ ] FMN-PLAN Section 11 Director Decision values match: `OPEN_NEW_PLAN | UPDATE_CURRENT_EXEC | CONSIDER_CLOSE | ACCEPT_AS_LIMITATION | NEED_EXPLANATION`
- [ ] FMN-PLAN Section 8 FMN Verdict values match: `READY_FOR_BUILD | TEST_PASS | TEST_FAIL | COMPLETE_WITH_RISK | REVISION_REQUIRED`
- [ ] DEV-EXEC template has 12 sections; Section 1 explicitly references the FMN-PLAN version it implements
- [ ] DEV-EXEC template carries DEV Advisory Status values: `IMPLEMENTED | PARTIALLY_IMPLEMENTED | BLOCKED | NEEDS_FMN_REVIEW`
- [ ] DIR-CLOSE template has 10 sections; Section 3 (Evidence References) requires at minimum one locked DEV-EXEC
- [ ] DIR-CLOSE template carries Director Closure Decision values: `CLOSE_ACCEPTED | CLOSE_ACCEPTED_WITH_LIMITATIONS | DO_NOT_CLOSE | OPEN_NEW_PLAN | UPDATE_CURRENT_EXEC`
- [ ] CSO-TEMPLATE.md has 12 sections + Quick Reference; reflects Sigma role/artifact terminology (no Delta references)
- [ ] CSO template carries explicit "never a workflow gate" language
- [ ] CSO Advisory Judgments section (Section 6) exists and is marked advisory-only
- [ ] Naming convention: templates use `{ROLE}-{DOC}-TEMPLATE.md`, actual artifacts use `{ROLE}-{DOC}-v{VERSION}.md`, CSO instances use `CSO-{ROLE}-{YYYYMMDDHHMM}.md` in `Sigma/logs/`
- [ ] Phase 3 CLI can read each template and generate a valid artifact file from it
