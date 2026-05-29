# DEV-EXEC

> Implementation approach, execution report, verification evidence, and developer walkthrough.
> FMN review and Director observations are recorded in Sections 13–16.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.
> **Section Ownership**: Sections 1–12 are DEV-authored. Sections 13–14 are FMN-authored. Sections 15–16 are Director-authored.

---

## 1. Source Plan Alignment

> **Filled by DEV — Before Build**

Summarize how this execution follows the locked FMN-PLAN.

- FMN task plan followed:
- Acceptance criteria targeted:
- Test contract referenced:
- Constraints respected:
- Known implementation boundary:

---

## 1b. DEV Pre-Build Assessment

> **Filled by DEV — Before Build** (after studying FMN-PLAN and prior session artifacts)

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

[If NEED_CLARIFICATION: list specific unresolved items that require FMN or Director response before DEV proceeds to Section 2]

---

## 2. Implementation Approach

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

## 3. Files / Components To Change

> **Filled by DEV — Before Build**

| File / Component | Action                   | Purpose |
| :---             | :---                     | :---    |
| [...]            | Create / Modify / Delete | [...]   |
| [...]            | Create / Modify / Delete | [...]   |

---

## 4. Key Technical Decisions

> **Filled by DEV — Before Build**

| Decision | Rationale | Trade-Off / Risk |
| :---     | :---      | :---             |
| [...]    | [...]     | [...]            |

---

## 5. Implementation Walkthrough

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

## 6. Deviations From FMN-PLAN

> **Filled by DEV — After Build**
> Record any deviation from the locked FMN-PLAN. Do not hide deviations.

| Deviation | Reason | Impact              | Needs FMN Review? |
| :---      | :---   | :---                | :---              |
| [...]     | [...]  | Low / Medium / High | Yes / No          |

If no deviation exists, write:

> No material deviation from FMN-PLAN.

> **Deviation Update Checklist** — when any deviation is added above, verify:
> - [ ] Section 2 — implementation approach still accurate?
> - [ ] Section 5 — walkthrough reflects actual implementation?
> - [ ] Section 8 — test counts and results still current?
> - [ ] Section 9 — git evidence reflects latest commits?
> - [ ] Section 10 — issue recorded if deviation came from a bug?
> - [ ] Section 12 — completion summary consistent with all changes?

---

## 7. Dependency / Environment Changes

> **Filled by DEV — After Build**

| Dependency / Tool / Environment | Action                            | Reason | Risk  |
| :---                            | :---                              | :---   | :---  |
| [...]                           | Add / Update / Remove / Configure | [...]  | [...] |

If none, write:

> No dependency or environment changes.

---

## 8. Developer Verification

> **Filled by DEV — After Build**

DEV records checks performed before handing back to FMN.

| Check              | Command / Method | Result             | Evidence |
| :---               | :---             | :---               | :---     |
| Build / compile    | [...]            | PASS / FAIL / N/A  | [...]    |
| Unit tests         | [...]            | PASS / FAIL / N/A  | [...]    |
| Integration tests  | [...]            | PASS / FAIL / N/A  | [...]    |
| Manual smoke check | [...]            | PASS / FAIL / N/A  | [...]    |

---

## 9. Git / Change Evidence

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

## 10. Issues Encountered

> **Filled by DEV — After Build**

| Issue | Cause | Resolution | Residual Risk |
| :---  | :---  | :---       | :---          |
| [...] | [...] | [...]      | [...]         |

If none, write:

> No material implementation issues encountered.

---

## 11. Known Limitations / Technical Debt

> **Filled by DEV — After Build**

| Item  | Impact | Recommended Follow-Up |
| :---  | :---   | :---                  |
| [...] | [...]  | [...]                 |

If none, write:

> No known technical debt introduced.

---

## 12. DEV Completion Statement

> **Filled by DEV — After Build**

### Completion Summary

[...]

### DEV Advisory Status

IMPLEMENTED / PARTIALLY_IMPLEMENTED / BLOCKED / NEEDS_FMN_REVIEW

### Notes for FMN

[...]

---

## 13. FMN Review

> **Filled by FMN — After DEV completes. DEV must not write in this section.**

### Pre-Build Clarification

> *(Populate only if DEV Section 1b status was NEED_CLARIFICATION)*

[FMN answers to DEV's open items from Section 1b]

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

---

## 14. AUD Findings

> **Filled by AUD — Advisory only. AUD findings do not approve, reject, or block runtime state.**
> DEV and FMN must not write in this section.

[...]

---

## 15. Director Observation Testing Report

> **Filled by Director — Post-FMN review. Append-only.**
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

## 16. Director Follow-Up Decision Notes

> **Filled by Director — Always writable.**
> Runtime approval and lock state are managed by Sigma CLI — not by this section.

Decision:

OPEN_NEW_PLAN / UPDATE_CURRENT_EXEC / CONSIDER_CLOSE / ACCEPT_AS_LIMITATION / NEED_EXPLANATION

Notes:

[...]
