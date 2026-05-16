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
| :---   | :---                       |
| [...]  | [...]                      |

---

## 3. Files / Components To Change

| File / Component | Action                   | Purpose |
| :---             | :---                     | :---    |
| [...]            | Create / Modify / Delete | [...]   |
| [...]            | Create / Modify / Delete | [...]   |

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

| Dependency / Tool / Environment | Action                            | Reason | Risk  |
| :---                            | :---                              | :---   | :---  |
| [...]                           | Add / Update / Remove / Configure | [...]  | [...] |

If none, write:

> No dependency or environment changes.

---

## 8. Developer Verification

DEV records checks performed before handing back to FMN.

| Check              | Command / Method | Result             | Evidence |
| :---               | :---             | :---               | :---     |
| Build / compile    | [...]            | PASS / FAIL / N/A  | [...]    |
| Unit tests         | [...]            | PASS / FAIL / N/A  | [...]    |
| Integration tests  | [...]            | PASS / FAIL / N/A  | [...]    |
| Manual smoke check | [...]            | PASS / FAIL / N/A  | [...]    |

---

## 9. Git / Change Evidence

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
