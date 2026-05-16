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

| Task ID  | Task  | Expected Output | Priority       |
| :---     | :---  | :---            | :---           |
| TASK-001 | [...] | [...]           | Must           |
| TASK-002 | [...] | [...]           | Should         |

---

## 3. Acceptance Criteria

| AC ID  | Criteria | Verification Method | Required Result |
| :---   | :---     | :---                | :---            |
| AC-001 | [...]    | [...]               | [...]           |
| AC-002 | [...]    | [...]               | [...]           |

---

## 4. Implementation Constraints

| Constraint | Source / Reason | DEV Freedom                        |
| :---       | :---            | :---                               |
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

| Test ID | Expected Result | Actual Result | Status                 | Evidence |
| :---    | :---            | :---          | :---                   | :---     |
| TC-001  | [...]           | [...]         | PASS / FAIL / NOT_RUN  | [...]    |
| TC-002  | [...]           | [...]         | PASS / FAIL / NOT_RUN  | [...]    |

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
