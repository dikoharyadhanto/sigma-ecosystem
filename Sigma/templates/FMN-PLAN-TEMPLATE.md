<!-- SIGMA:DOC type=FMN_PLAN schema=3 -->
# FMN-PLAN

> Build contract and test contract for DEV. FMN fills every section before lock.
> Lock state is managed by Sigma CLI. Do not record it here. After lock, AUD Notes may be appended.

---

<!-- SIGMA:FMN_PLAN:SECTION:DIRECTOR_SUMMARY -->
## Director Summary

> Five sentences at most, in plain language and without IDs. The Director should be able to judge from this section alone what DEV is asked to build and why. Fill it last, after the AUD verdict or after SKIP_FOR_AUDIT.

### Summary

[...]

### Open Question / Unclear Decision

> Optional. Delete the placeholder when nothing applies.

[...]

---

<!-- SIGMA:FMN_PLAN:SECTION:SOURCE_ALIGNMENT -->
## Source Alignment

- Intent version: INTENT-v{X}
- Intent point served: [...]
- Scope boundary and constraints respected: [...]
- Source Roadmap Stage: ROADMAP-v{X} - Stage {N} ({Name}) / N/A

---

<!-- SIGMA:FMN_PLAN:SECTION:OBJECTIVE -->
## Objective

> One to three sentences in plain language. No IDs, no task list.

[...]

---

<!-- SIGMA:FMN_PLAN:SECTION:REQUIREMENT -->
## Requirement

> Optional. Delete this section when nothing is needed. List only files or artifacts the contract cannot be met or verified without. Status `AVAILABLE` means the item exists and can be read; it does not mean the item is correct, final, or LOCKED.

| No | Item | Role | Why Matters | Status |
|:-- |:---- |:---- |:----------- |:------ |
| 1 | [...] | Reference / Input | [...] | AVAILABLE / NOT_YET_AVAILABLE |

---

<!-- SIGMA:FMN_PLAN:SECTION:KEY_OUTPUT -->
## Key Output

> Only final outputs the Director will look for, named in the Objective. Intermediate files and logs belong in Work Order or Constraints. If the result is a behavior change with no file, write one row: "No file output".

| No | Output | Category | Description | Location |
|:-- |:------ |:-------- |:----------- |:-------- |
| 1 | [...] | Creation / Modification / Report | [...] | [...] |

---

<!-- SIGMA:FMN_PLAN:SECTION:WORK_ORDER -->
## Work Order

| Task ID | Task | Expected Output | Priority |
|:------- |:---- |:--------------- |:-------- |
| TASK-001 | [...] | [...] | Must |

---

<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_AND_TEST_CONTRACT -->
## Acceptance Criteria and Test Contract

> Fixed before DEV starts. One row per criterion and test. A criterion that needs several tests is split into several rows.

| AC ID | Criteria | Test Method | Expected Result | Evidence Required |
|:----- |:-------- |:----------- |:--------------- |:----------------- |
| AC-001 | [...] | [...] | [...] | [...] |

---

<!-- SIGMA:FMN_PLAN:SECTION:CONSTRAINTS_FOR_DEV -->
## Constraints for DEV

| Constraint | Source / Reason | DEV Freedom |
|:---------- |:--------------- |:----------- |
| [...] | [...] | Non-negotiable / Guided / Flexible |

DEV must:

- [...]

DEV must not:

- [...]

---

<!-- SIGMA:FMN_PLAN:SECTION:WORK_OUTSIDE_INTENT -->
## Work Outside Intent

> Optional. Delete this section when this plan stays within INTENT. Status: `NOTED`, `AMENDMENT_REQUESTED`, or `AMENDMENT_RATIFIED` (cite the amendment in Notes).

| Item | Justification | Status | Notes |
|:---- |:------------- |:------ |:----- |
| [...] | [...] | NOTED | [...] |

---

<!-- SIGMA:FMN_PLAN:SECTION:CONTRACT_CHANGES -->
## Contract Changes

> Optional. Records changes made to this contract after lock.

| No | Checkpoint | What Changed | Reason | Requested By | Loosening? | Director Approval |
|:-- |:---------- |:------------ |:------ |:------------ |:---------- |:----------------- |
| 1 | [...] | [...] | [...] | [...] | Yes / No | [...] |

---

<!-- SIGMA:FMN_PLAN:SECTION:AUD_NOTES -->
## AUD Notes

> Advisory only. Written by ARC or FMN from an AUD message or from audit results the Director relays. DEV must not write here. Transcribe the verdict exactly as AUD stated it. Verdict meanings are in AUD-RULE.

### Verdict

> Pick one. If none fit, tick OTHER and describe.

- [ ] PASS
- [ ] PASS_WITH_RISK
- [ ] REVISE
- [ ] REJECT_RECOMMENDED
- [ ] OTHER: [describe]
- [ ] SKIP_FOR_AUDIT - Director explicitly approved skipping audit for this lock cycle

**Director Instruction (verbatim)** *(required only if SKIP_FOR_AUDIT is checked; the Director's exact words)*: [...]

### Findings

> Append-only. Add an `Audit <N>` block per round; never edit a prior round.

Audit 1:

1. [...]

### Recommended Director Action

[...]
