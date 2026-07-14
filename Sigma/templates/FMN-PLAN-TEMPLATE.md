<!-- SIGMA:DOC type=FMN_PLAN schema=1 -->
# FMN-PLAN

> Build contract and test contract for DEV implementation.
> AUD findings on the plan are recorded in AUD Findings.
>
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.
> **Post-Lock Rule**: Source Alignment through DEV Handoff Instructions are immutable after lock. AUD Findings may be appended post-lock.

---

<!-- SIGMA:FMN_PLAN:SECTION:SOURCE_ALIGNMENT -->
## 1. Source Alignment

> Filled by FMN — Before lock.

Summarize how this plan serves the locked Director Intent.

- Intent point served:
- Scope boundary respected:
- Success criteria supported:
- Constraint or risk addressed:
- Source Roadmap Stage: ROADMAP-v{X} — Stage {N} ({Name}) / N/A

---

<!-- SIGMA:FMN_PLAN:SECTION:WORK_ORDER_TASK_PLAN -->
## 2. Work Order / Task Plan

> Filled by FMN — Before lock.

### Build Objective

[...]

### Task Breakdown

| Task ID  | Task  | Expected Output | Priority       |
| :---     | :---  | :---            | :---           |
| TASK-001 | [...] | [...]           | Must           |
| TASK-002 | [...] | [...]           | Should         |

---

<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_CRITERIA -->
## 3. Acceptance Criteria

> Filled by FMN — Before lock.

| AC ID  | Criteria | Verification Method | Required Result |
| :---   | :---     | :---                | :---            |
| AC-001 | [...]    | [...]               | [...]           |
| AC-002 | [...]    | [...]               | [...]           |

---

<!-- SIGMA:FMN_PLAN:SECTION:IMPLEMENTATION_CONSTRAINTS -->
## 4. Implementation Constraints

> Filled by FMN — Before lock.

| Constraint | Source / Reason | DEV Freedom                        |
| :---       | :---            | :---                               |
| [...]      | [...]           | Non-negotiable / Guided / Flexible |

---

<!-- SIGMA:FMN_PLAN:SECTION:PRE_BUILD_TEST_CONTRACT -->
## 5. Pre-Build Test Contract

> Filled by FMN — Before lock. Must be defined before DEV starts implementation.

| Test ID | Behavior / Requirement | Test Method | Expected Result | Evidence Required |
| :---    | :---                   | :---        | :---            | :---              |
| TC-001  | [...]                  | [...]       | [...]           | [...]             |
| TC-002  | [...]                  | [...]       | [...]           | [...]             |

---

<!-- SIGMA:FMN_PLAN:SECTION:DEV_HANDOFF_INSTRUCTIONS -->
## 6. DEV Handoff Instructions

> Filled by FMN — Before lock.

DEV must:

- [...]
- [...]

DEV must not:

- [...]

DEV should report in DEV-EXEC:

- Pre-build assessment and any concerns before coding
- Implementation approach
- Deviations from plan
- Changed files / components
- Known issues
- Evidence summary

---

<!-- SIGMA:FMN_PLAN:SECTION:AUD_FINDINGS -->
## 7. AUD Findings

> **Advisory only. AUD findings do not approve, reject, or block lock state.**
> This section may be appended after the plan is locked.
>
> **Who may write this section**: ARC or FMN, sourced from either (a) an AUD
> message received via `sigma send`/`sigma inbox` mailbox, or (b) the Director relaying
> audit results directly in a chat session. DEV must not write in this
> section.
>
> **Verdict integrity**: The checkbox verdict below must be transcribed
> exactly as AUD stated it — ARC/FMN must not alter, soften, or upgrade it.
> Narrative content (Major Findings, Recommended Director Action) may be
> ARC/FMN's interpretation of the audit — verbatim copy-paste is not
> required.

### 7.1 AUD Advisory Verdict

**Verdict**:

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] PASS
- [ ] PASS_WITH_RISK
- [ ] REVISE
- [ ] REJECT_RECOMMENDED
- [ ] PROMOTE_TO_HEAVIER_PROCESS
- [ ] OTHER: [describe]
- [ ] SKIP_FOR_AUDIT — Director explicitly approved skipping audit for this lock cycle

**Director Instruction (verbatim)** *(required only if SKIP_FOR_AUDIT is checked — transcribe the Director's exact words, not a paraphrase)*: [...]

**Major Findings**:

1. [...]
2. [...]
3. [...]

**Recommended Director Action**:

[...]
