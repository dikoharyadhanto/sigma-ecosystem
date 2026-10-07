<!-- SIGMA:DOC type=DEV_EXEC schema=3 -->
# DEV-EXEC

> Implementation plan, build result, and verification evidence for the locked PLAN.
> Lock state is managed by Sigma CLI. Do not record it here.
> Ownership: DEV fills Implementation Plan and Technical Research before the build, and Build Result and Verification and Deviations, Issues, and Limitations after it. FMN fills FMN Pre-Build Review and FMN Post-Build Review; DEV does not write in them. DEV transcribes Director Observation Report & Minor Requests from the Director's chat report. DEV or FMN fills Director Summary, last.

---

<!-- SIGMA:DEV_EXEC:SECTION:DIRECTOR_SUMMARY -->
## Director Summary

> Five sentences at most, in plain language and without IDs. The Director should be able to judge from this section alone what was built and whether it is ready. Fill it last, after FMN Post-Build Review. Include any decision or deviation the Director must know about.

### Summary

[...]

### Open Question / Unclear Decision

> Optional. Delete this heading and the placeholder when nothing applies.

[...]

---

<!-- SIGMA:DEV_EXEC:SECTION:IMPLEMENTATION_PLAN -->
## Implementation Plan

> Filled by DEV before the build, after studying the PLAN and prior session artifacts.

### Source Alignment

| Link | References |
|:---- |:---------- |
| PLAN version | PLAN-v{X} |
| Acceptance criteria targeted | [AC-xxx, ...] |
| Constraints respected | [...] / none |
| Known implementation boundary | [...] |
| Prior EXEC studied | [version(s)] / N/A |
| Inbox handoff messages consulted | [...] / N/A |

### Plan Assessment

| Item | DEV Assessment | Status |
|:---- |:-------------- |:------ |
| [AC or task from the PLAN] | [DEV's understanding or concern] | Clear / Unclear |

### Questions & Concerns

[Open questions, disagreements, or risks the PLAN does not cover. If none: No concerns. The plan is clear and sufficient to proceed.]

### Readiness Status

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] CLEAR
- [ ] NEED_CLARIFICATION
- [ ] OTHER: [describe]

[If NEED_CLARIFICATION: list the unresolved items that need an FMN or Director response before DEV continues.]

### Approach

[What will be built or changed, and how.]

### Files / Components To Change

| File / Component | Action | Purpose |
|:---------------- |:------ |:------- |
| [...] | Create / Modify / Delete | [...] |

### Key Technical Decisions

> A rejected alternative is recorded in Trade-Off / Risk.

| Decision | Rationale | Trade-Off / Risk |
|:-------- |:--------- |:---------------- |
| [...] | [...] | [...] |

---

<!-- SIGMA:DEV_EXEC:SECTION:TECHNICAL_RESEARCH -->
## Technical Research

> Optional. Delete this section when not needed. Filled by DEV before the build, at DEV's discretion; there is no gate and no AI role reviews it. Procedure and limits are in DEV-RULE.

### Status

- [ ] NEEDED
- [ ] NOT_NEEDED

If NOT_NEEDED, state briefly why existing knowledge is sufficient:

[...]

### Implementation Approach Research

| Question | Finding | Decision | Implication |
|:-------- |:------- |:-------- |:----------- |
| [...] | [...] (reference-list row ID) | [...] | [...] |

### Technical Risk / Unknown Resolution

| Question | Finding | Decision | Implication |
|:-------- |:------- |:-------- |:----------- |
| [...] | [...] (reference-list row ID) | [...] | [...] |

---

<!-- SIGMA:DEV_EXEC:SECTION:FMN_PRE_BUILD_REVIEW -->
## FMN Pre-Build Review

> Filled by FMN after DEV completes Implementation Plan. DEV must not write in this section.

### Pre-Build Clarification

> Only if Readiness Status was NEED_CLARIFICATION.

[FMN answers to DEV's open items]

### Plan Review

| Item | FMN Assessment | Status |
|:---- |:-------------- |:------ |
| [AC or constraint from the PLAN] | [FMN's assessment of DEV's plan] | Approved / Concern / Rejected |

### Pre-Build Verdict

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] CLEARED_TO_BUILD
- [ ] NEEDS_DEV_REVISION
- [ ] BLOCKED
- [ ] OTHER: [describe]

### FMN Pre-Build Notes

[...]

---

<!-- SIGMA:DEV_EXEC:SECTION:BUILD_RESULT_AND_VERIFICATION -->
## Build Result and Verification

> Filled by DEV after the build.

### What Was Implemented

[...]

### How It Works

[...]

### Main Flow

> Optional. Keep for a non-trivial change; delete for a small one.

1. [...]

### Important Logic / Abstractions

> Optional. Keep for a non-trivial change; delete for a small one.

- [...]

### Key Output Locations

> One row per Key Output of the PLAN. A behavior change with no file is "No file output".

| Key Output No | Location |
|:------------- |:-------- |
| 1 | [...] |

### Dependency / Environment Changes

| Dependency / Tool / Environment | Action | Reason | Risk |
|:------------------------------- |:------ |:------ |:---- |
| [...] | Add / Update / Remove / Configure | [...] | [...] |

If none, replace the table with: No dependency or environment changes.

### Verification

| Check | Command / Method | Result | Evidence |
|:----- |:---------------- |:------ |:-------- |
| Build / compile | [...] | PASS / FAIL / N/A | [...] |
| Unit tests | [...] | PASS / FAIL / N/A | [...] |
| Integration tests | [...] | PASS / FAIL / N/A | [...] |
| Manual smoke check | [...] | PASS / FAIL / N/A | [...] |

### Change Evidence

> Snapshot at implementation handoff. DEV fills it from `sigma git evidence`; it is not updated after the Director commits or pushes. A Git repository is enough; a remote and a push are not required. If the project is not managed by Git, write `N/A — project is not managed by Git` for the Git fields and use Changed Files and Diff Summary as the change trace.

| Field | Value |
|:----- |:----- |
| Branch | [...] |
| Commit at Evidence Capture | [...] |
| Changed Files | [...] |
| Diff Summary | [...] |

### DEV Status

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] IMPLEMENTED
- [ ] PARTIALLY_IMPLEMENTED
- [ ] BLOCKED
- [ ] NEEDS_FMN_REVIEW
- [ ] OTHER: [describe]

### Notes for FMN

[...]

---

<!-- SIGMA:DEV_EXEC:SECTION:DEVIATIONS_ISSUES_LIMITATIONS -->
## Deviations, Issues, and Limitations

> Filled by DEV after the build. Record every deviation from the PLAN. Type is `Deviation`, `Issue`, or `Limitation`. Fill `Needs FMN Review?` for a Deviation; write N/A for the other types.

| No | Type | Item | Cause / Reason | Impact / Residual Risk | Resolution / Follow-Up | Needs FMN Review? |
|:-- |:---- |:---- |:-------------- |:---------------------- |:---------------------- |:----------------- |
| 1 | Deviation / Issue / Limitation | [...] | [...] | [...] | [...] | Yes / No / N/A |

If none, replace the table with: No material deviation, issue, or limitation.

---

<!-- SIGMA:DEV_EXEC:SECTION:FMN_POST_BUILD_REVIEW -->
## FMN Post-Build Review

> Filled by FMN after DEV completes Build Result and Verification. DEV must not write in this section.

### AC Verification

> One row per AC of the PLAN.

| AC ID | Expected Result (PLAN) | Actual Result and Evidence | Status |
|:----- |:---------------------- |:-------------------------- |:------ |
| AC-001 | [...] | [...] | PASS / FAIL / PARTIAL / NOT_RUN |

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
## Director Observation Report & Minor Requests

> Filled by DEV, transcribed from the Director's direct chat report. Append-only.

### Observation Report

> Unexpected friction found in the Director's manual testing: errors, bugs, or behavior that does not match the PLAN or INTENT. To record one, replace the sentence below with a table with columns `OBS ID | Observation | Location | Severity` (Low / Medium / High / Critical), IDs `OBS-001`, `OBS-002`, and so on.

No observations from Director manual testing.

### Minor Requests

> Small additions or adjustments the Director raised in manual testing that are too minor to open a new PLAN cycle. DEV transcribes the request only. To record one, replace the sentence below with a table with columns `REQ ID | Director Request`, IDs `REQ-001`, `REQ-002`, and so on.

No minor requests in this execution.

### DEV Implementation Follow-up

> Filled by DEV after acting on the items above. One row per item acted on, referencing its ID. To record one, replace the sentence below with a table with columns `ID | Type | What Was Done | Files Affected | Status`. Type is `Observation` or `Minor Request`. Status is `Fixed`, `Explained`, `Accepted`, or `Deferred` for an observation, and `Done` or `Deferred` for a minor request.

No follow-up actions taken.
