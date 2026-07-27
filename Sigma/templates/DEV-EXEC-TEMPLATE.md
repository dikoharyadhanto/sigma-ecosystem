<!-- SIGMA:DOC type=DEV_EXEC schema=1 -->
# DEV-EXEC

> Implementation approach, execution report, verification evidence, and developer walkthrough.
> FMN reviews are recorded in FMN Pre-Build Review and FMN Post-Build Review. Director observations and minor requests are recorded in Director Observation Report & Minor Requests.
>
> **Lock State**: Managed by Sigma CLI via `progress-v<N>.json`. Do not edit lock state here.
> **Section Ownership**: Source Plan Alignment through Key Technical Decisions are DEV pre-build. FMN Pre-Build Review is FMN pre-build. Implementation Walkthrough through DEV Completion Statement are DEV post-build. FMN Post-Build Review is FMN post-build. Director Observation Report & Minor Requests is DEV-authored — transcribed from Director's direct chat report.

---

<!-- SIGMA:DEV_EXEC:SECTION:SOURCE_PLAN_ALIGNMENT -->
## 1. Source Plan Alignment

> **Filled by DEV — Before Build**

Summarize how this execution follows the locked FMN-PLAN.

- FMN task plan followed:
- Acceptance criteria targeted:
- Test contract referenced:
- Constraints respected:
- Known implementation boundary:

---

<!-- SIGMA:DEV_EXEC:SECTION:DEV_PRE_BUILD_ASSESSMENT -->
## 2. DEV Pre-Build Assessment

> **Filled by DEV — Before Build** (after studying FMN-PLAN and prior session artifacts)

### Context Reviewed

- Prior DEV-EXEC studied: [version(s) or N/A]
- Inbox handoff messages consulted: [list or N/A]

### Plan Assessment

| Item | DEV Assessment | Status |
| :--- | :--- | :--- |
| [AC or task from FMN-PLAN] | [DEV's understanding or concern] | Clear / Unclear |

### Questions & Concerns

[DEV writes open questions, disagreements, or risks not covered by the plan.
If none, write: No concerns — plan is clear and sufficient to proceed.]

### DEV Readiness Status

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] CLEAR
- [ ] NEED_CLARIFICATION
- [ ] OTHER: [describe]

[If NEED_CLARIFICATION: list specific unresolved items that require FMN or Director response before DEV proceeds to Implementation Approach]

---

<!-- SIGMA:DEV_EXEC:SECTION:IMPLEMENTATION_APPROACH -->
## 3. Implementation Approach

> **Filled by DEV — Before Build**

### What Will Be Built / Changed

[...]

### Technical Approach

[...]

### Rationale

Why this approach fits the FMN-PLAN and DIR-INTENT:

[...]

### Alternatives Considered

| Option | Reason Rejected / Deferred |
| :---   | :---                       |
| [...]  | [...]                      |

---

<!-- SIGMA:DEV_EXEC:SECTION:FILES_COMPONENTS_TO_CHANGE -->
## 4. Files / Components To Change

> **Filled by DEV — Before Build**

| File / Component | Action                   | Purpose |
| :---             | :---                     | :---    |
| [...]            | Create / Modify / Delete | [...]   |
| [...]            | Create / Modify / Delete | [...]   |

---

<!-- SIGMA:DEV_EXEC:SECTION:KEY_TECHNICAL_DECISIONS -->
## 5. Key Technical Decisions

> **Filled by DEV — Before Build**

| Decision | Rationale | Trade-Off / Risk |
| :---     | :---      | :---             |
| [...]    | [...]     | [...]            |

---

<!-- SIGMA:DEV_EXEC:SECTION:FMN_PRE_BUILD_REVIEW -->
## 6. FMN Pre-Build Review

> **Filled by FMN — After DEV Pre-Build Planning (Sections 1–5). DEV must not write in this section.**

### Pre-Build Clarification

> *(Populate only if DEV Pre-Build Assessment status was NEED_CLARIFICATION)*

[FMN answers to DEV's open items from DEV Pre-Build Assessment]

### Plan Review

| Item | FMN Assessment | Status |
| :--- | :--- | :--- |
| [AC or constraint from FMN-PLAN] | [FMN's assessment of DEV's plan] | Approved / Concern / Rejected |

### Pre-Build Verdict

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] CLEARED_TO_BUILD
- [ ] NEEDS_DEV_REVISION
- [ ] BLOCKED
- [ ] OTHER: [describe]

### FMN Pre-Build Notes

[...]

---

<!-- SIGMA:DEV_EXEC:SECTION:IMPLEMENTATION_WALKTHROUGH -->
## 7. Implementation Walkthrough

> **Filled by DEV — After Build**

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

<!-- SIGMA:DEV_EXEC:SECTION:DEVIATIONS_FROM_FMN_PLAN -->
## 8. Deviations From FMN-PLAN

> **Filled by DEV — After Build**
> Record any deviation from the locked FMN-PLAN. Do not hide deviations.

| Deviation | Reason | Impact              | Needs FMN Review? |
| :---      | :---   | :---                | :---              |
| [...]     | [...]  | Low / Medium / High | Yes / No          |

If no deviation exists, write:

> No material deviation from FMN-PLAN.

> **Deviation Update Checklist** — when any deviation is added above, verify:
> - [ ] Implementation Approach still accurate?
> - [ ] Implementation Walkthrough reflects actual implementation?
> - [ ] Developer Verification counts and results still current?
> - [ ] Git / Change Evidence reflects latest commits?
> - [ ] Issues Encountered records deviation-related bugs if any?
> - [ ] DEV Completion Statement is consistent with all changes?

---

<!-- SIGMA:DEV_EXEC:SECTION:DEPENDENCY_ENVIRONMENT_CHANGES -->
## 9. Dependency / Environment Changes

> **Filled by DEV — After Build**

| Dependency / Tool / Environment | Action                            | Reason | Risk  |
| :---                            | :---                              | :---   | :---  |
| [...]                           | Add / Update / Remove / Configure | [...]  | [...] |

If none, write:

> No dependency or environment changes.

---

<!-- SIGMA:DEV_EXEC:SECTION:DEVELOPER_VERIFICATION -->
## 10. Developer Verification

> **Filled by DEV — After Build**

DEV records checks performed before handing back to FMN.

| Check              | Command / Method | Result             | Evidence |
| :---               | :---             | :---               | :---     |
| Build / compile    | [...]            | PASS / FAIL / N/A  | [...]    |
| Unit tests         | [...]            | PASS / FAIL / N/A  | [...]    |
| Integration tests  | [...]            | PASS / FAIL / N/A  | [...]    |
| Manual smoke check | [...]            | PASS / FAIL / N/A  | [...]    |

---

<!-- SIGMA:DEV_EXEC:SECTION:GIT_CHANGE_EVIDENCE -->
## 11. Git / Change Evidence

> **Filled by DEV — After Build**

Minimal physical trace. Mark N/A only if no material file changes exist.

| Field              | Value         |
| :---               | :---          |
| Branch             | [...]         |
| Latest Commit      | [...]         |
| Working Tree State | clean / dirty |
| Changed Files      | [...]         |
| Diff Summary       | [...]         |

---

<!-- SIGMA:DEV_EXEC:SECTION:ISSUES_ENCOUNTERED -->
## 12. Issues Encountered

> **Filled by DEV — After Build**

| Issue | Cause | Resolution | Residual Risk |
| :---  | :---  | :---       | :---          |
| [...] | [...] | [...]      | [...]         |

If none, write:

> No material implementation issues encountered.

---

<!-- SIGMA:DEV_EXEC:SECTION:KNOWN_LIMITATIONS_TECH_DEBT -->
## 13. Known Limitations / Technical Debt

> **Filled by DEV — After Build**

| Item  | Impact | Recommended Follow-Up |
| :---  | :---   | :---                  |
| [...] | [...]  | [...]                 |

If none, write:

> No known technical debt introduced.

---

<!-- SIGMA:DEV_EXEC:SECTION:DEV_COMPLETION_STATEMENT -->
## 14. DEV Completion Statement

> **Filled by DEV — After Build**

### Completion Summary

[...]

### DEV Advisory Status

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] IMPLEMENTED
- [ ] PARTIALLY_IMPLEMENTED
- [ ] BLOCKED
- [ ] NEEDS_FMN_REVIEW
- [ ] OTHER: [describe]

### Notes for FMN

[...]

---

<!-- SIGMA:DEV_EXEC:SECTION:FMN_POST_BUILD_REVIEW -->
## 15. FMN Post-Build Review

> **Filled by FMN — After DEV completes. DEV must not write in this section.**

### AC Verification

| AC ID | Criteria (ref FMN-PLAN) | Evidence in DEV-EXEC | Status |
| :--- | :--- | :--- | :--- |
| AC-001 | [...] | Section X / [...] | PASS / FAIL / PARTIAL |

### Test Contract Result

| TC ID | Expected (ref FMN-PLAN) | Actual Result | Status |
| :--- | :--- | :--- | :--- |
| TC-001 | [...] | [...] | PASS / FAIL / NOT_RUN |

### Advisory Verdict

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] READY_FOR_LOCK
- [ ] NEEDS_DEV_UPDATE
- [ ] REVISION_REQUIRED
- [ ] COMPLETE_WITH_RISK
- [ ] OTHER: [describe]

### FMN Notes

[...]

---

<!-- SIGMA:DEV_EXEC:SECTION:DIRECTOR_OBSERVATION_REPORT_MINOR_REQUESTS -->
## 16. Director Observation Report & Minor Requests

> **Filled by DEV — transcribed from Director's direct chat report. Append-only.**

### Observation Report

> Unexpected friction found during Director manual testing — errors, bugs, or behavior that does not match the plan or intent.
> DEV transcribes Director's verbal/chat findings into this table.

| OBS ID | Observation | Location | Severity |
| :--- | :--- | :--- | :--- |
| OBS-001 | [...] | [...] | Low / Medium / High / Critical |

If none, write:

> No observations from Director manual testing.

### Minor Requests

> Small additions or adjustments Director raised during manual testing — not in the plan, too minor to open a new plan cycle.
> DEV transcribes Director's request only.

| REQ ID | Director Request |
| :--- | :--- |
| REQ-001 | [...] |

If none, write:

> No minor requests in this execution.

### DEV Implementation Follow-up

> **Filled by DEV — after acting on Observation Report and Minor Requests above.**
> Reference the ID (OBS-xxx or REQ-xxx) from the tables above. One row per item acted on.

| ID | Type | What Was Done | Files Affected | Status |
| :--- | :--- | :--- | :--- | :--- |
| OBS-001 | Observation | [...] | [...] | Fixed / Explained / Accepted / Deferred |
| REQ-001 | Minor Request | [...] | [...] | Done / Deferred |

If none, write:

> No follow-up actions taken.

---

<!-- SIGMA:DEV_EXEC:SECTION:DIRECTORS_SUMMARY -->
## 17. Director's Summary

> **Filled by DEV or FMN — Append-only.**
> This is a concise, human-readable summary specifically for the Director. DEV and FMN may freely collaborate to fill this section.
> **Recommended timing:** Best filled after receiving the FMN Post-Build Review, so it captures the final execution state and readiness.

### Overview

> Max 5 sentences. Plain-language core of what this execution builds or built — not a status checklist, not a restatement of every task.
> Write for a Director who will read only this paragraph and nothing else in the document. No TASK-/AC-/TC-/OBS-/REQ- ID references, no jargon that requires scrolling up to decode — spell out the substance inline instead of pointing at a section.
> Fold in any key implementation decision or deviation the Director must know about; don't leave it for a separate list.

[...]

### Open Question / Unclear Decision

> Optional — leave as [...] or omit if nothing applies. Only fill if there is a genuine open question or undecided point the Director should know before proceeding. Not a place to restate issues already covered elsewhere.

[...]

### Open Risks / Next Actions

[...]
