# CSO-[ROLE]-[YYYYMMDDHHMM]

## CSO Metadata

| Field | Value |
| :--- | :--- |
| Source | `CHECKPOINT` / `CSO` |
| Created By Role | `ARC` / `FMN` / `DEV` / `AUD` / `Professional` / `CSO` |
| Purpose | `Quick state preservation` / `Formal handoff` |
| Related Artifact | [artifact type + version, e.g. `FMN-PLAN-v2`] |
| Related Artifact State | `DRAFT` / `LOCKED` / `SUPERSEDED` / `none` |
| Authority Level | `Context Only` |

---

**Sigma Cognitive State Object (CSO)**

> **Purpose**: A CSO captures session context for handoff and audit support. It is optional, complete-state evidence and never a workflow gate. Project-specific context belongs here or in governed Sigma artifacts, not in global memory.

---

## 1. Session Metadata

| Field              | Value                                                     |
| :---               | :---                                                      |
| Role / Agent       | [ARC / AUD / FMN / DEV / DIR]                             |
| Created At         | [YYYYMMDDHHMM]                                            |
| Runtime State      | DRAFT / COMPLETE                                          |
| Linked Artifact(s) | [DIR-INTENT / FMN-PLAN / DEV-EXEC / DIR-CLOSE / none]     |
| Session Topic      | [Brief title]                                             |

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

| Decision   | Rationale | Trade-Off  | Approved By          |
| :---       | :---      | :---       | :---                 |
| [decision] | [why]     | [cost/risk] | Director / Pending  |

---

## 6. Advisory Judgments

> Advisory judgments are decision-support signals only. They do not approve, reject, lock, or block runtime state.

| Role                  | Advisory Verdict | Reason   | Recommended Director Action |
| :---                  | :---             | :---     | :---                        |
| ARC / AUD / FMN / DEV | [verdict]        | [reason] | [recommendation]            |

---

## 7. Work Completed

| Item   | Owner  | Status                       | Evidence              |
| :---   | :---   | :---                         | :---                  |
| [task] | [role] | Pending / In Progress / Done | [file/command/result] |

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

| Candidate | Classification                                                  | Promotion Recommendation          | Director Approval              |
| :---      | :---                                                            | :---                              | :---                           |
| [fact]    | Constitutional / Operational Sigma / Project-only / Ephemeral  | Promote / Keep in CSO / Discard   | Pending / Approved / Rejected  |

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
