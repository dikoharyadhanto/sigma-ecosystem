<!-- SIGMA:DOC type=DIR_INTENT schema=5 -->
# DIR-INTENT

> Director intent, constraints, and execution direction for this project. Director owns the destination; ARC, AUD, FMN, and DEV advise and interpret.
> Lock state is managed by Sigma CLI. Do not record it here.

---

<!-- SIGMA:DIR_INTENT:SECTION:DIRECTOR_SUMMARY -->
## Director Summary

> Five sentences at most. The Director should be able to judge from this section alone what the project is and where it stops.

### Summary

[...]

### Included Scenarios

> Three concrete scenarios that are in scope.

- [Scenario 1]
- [Scenario 2]
- [Scenario 3]

### Excluded Scenarios

> Three concrete scenarios that are out of scope.

- [Scenario 1]
- [Scenario 2]
- [Scenario 3]

---

<!-- SIGMA:DIR_INTENT:SECTION:PURPOSE_AND_PROBLEM -->
## Purpose and Problem

### Objective

[What this project creates or changes.]

### Problem

[The pain, gap, or risk it addresses.]

### Target User

[Who benefits.]

### Primary Value

[The core value it must deliver.]

---

<!-- SIGMA:DIR_INTENT:SECTION:DESIRED_OUTCOME_AND_MEASUREMENT -->
## Desired Outcome and Measurement

> The outcome must be observable and falsifiable. The threshold and method must measure this outcome, not a narrower one.

### Desired Outcome

[What is observably different when the project succeeds.]

### Success Threshold

[Quantified or binary threshold.]

### Measurement Method

[How success is verified.]

---

<!-- SIGMA:DIR_INTENT:SECTION:SCOPE -->
## Scope

> Explicit enough for FMN to plan without inventing intent.

### In Scope

| ID | Must Deliver | Reason |
|:-- |:------------ |:------ |
| SC-001 | [...] | [...] |

### Out of Scope

> Deferred items and non-goals.

| ID | Excluded | Reason |
|:-- |:-------- |:------ |
| OS-001 | [...] | [...] |

---

<!-- SIGMA:DIR_INTENT:SECTION:QUALITY_STANDARDS -->
## Quality Standards

> State a minimum standard for each dimension, or N/A. Each must be stated.

| Dimension | Minimum Standard | Must Not Happen | Evidence Required |
|:--------- |:---------------- |:--------------- |:----------------- |
| Security | [...] | [...] | [...] |
| UX Trust | [...] | [...] | [...] |
| UI / Product Packaging | [...] | [...] | [...] |
| Performance / Cost | [...] | [...] | [...] |

---

<!-- SIGMA:DIR_INTENT:SECTION:PRIORITIES_AND_CONSTRAINTS -->
## Priorities and Constraints

### Priorities

> What is prioritized over what, and what is knowingly sacrificed.

- We prioritize [X] over [Y].

### Constraints and Technical Direction

> Type: Hard Constraint, Preference, Timeline, Technical, Rejected Approach, or DEV Must Not. Binding Level: Non-negotiable, Conditional, Challengeable, or Preference.

| ID | Type | Statement | Binding Level | Notes |
|:-- |:---- |:--------- |:------------- |:----- |
| CON-001 | [...] | [...] | [...] | [...] |

---

<!-- SIGMA:DIR_INTENT:SECTION:ASSUMPTIONS_AND_RISKS -->
## Assumptions and Risks

### Assumptions

| ID | Assumption | Confidence | If Wrong |
|:-- |:---------- |:---------- |:-------- |
| ASM-001 | [...] | Low / Medium / High | [...] |

### Risks

| ID | Classification | Description | Impact | Mitigation | Accepted |
|:-- |:-------------- |:----------- |:------ |:---------- |:-------- |
| RR-001 | Fatal / Degrading / Noise | [...] | [...] | [...] | Yes / No / Conditional |

### Project Failure

[The project is considered failed if ...]

---

<!-- SIGMA:DIR_INTENT:SECTION:FUNCTIONAL_REQUIREMENTS -->
## Functional Requirements

> FMN builds the task plan and test contract from these requirements.

### REQ-001 - [Requirement Title]

**Priority**: Must / Should / Could

**User Story**: As a [role], I want to [action], so that [benefit].

**Acceptance Criteria**:

- [ ] [Measurable or binary condition]

---

<!-- SIGMA:DIR_INTENT:SECTION:GUIDANCE_FOR_FMN -->
## Guidance for FMN

> FMN carries the Quality Standards, with their evidence requirements, into every PLAN.

| Focus Area | Why It Matters | Watch-Out |
|:---------- |:-------------- |:--------- |
| [...] | [...] | [...] |

---

<!-- SIGMA:DIR_INTENT:SECTION:RESEARCH -->
## Research

> Optional. Delete this section when existing knowledge is sufficient. Cite sources by `reference-list.md` row ID. Source rules are in ARC-RULE.

### Theory and Concept

[Conceptual or theoretical grounding.]

### Issue, Problem, and Real-World Data

[Evidence of the problem.]

### Methodology

[How the investigation was done and how conclusions are validated.]

### Source and Data

[Data needed, with the full list in `Sigma/reference/reference-list.md`.]

---

<!-- SIGMA:DIR_INTENT:SECTION:AUD_NOTES -->
## AUD Notes

> Advisory only. Written by ARC or FMN from an AUD message or from audit results the Director relays. DEV must not write here. Transcribe the verdict exactly as AUD stated it. Verdict meanings are in AUD-RULE.

### Verdict

> Pick one. If none fit, tick OTHER and describe.

- [ ] PASS
- [ ] PASS_WITH_RISK
- [ ] REVISE
- [ ] REJECT_RECOMMENDED
- [ ] OTHER: [describe]
- [ ] SKIP_FOR_AUDIT - Director explicitly approved skipping audit for this ratify cycle

**Director Instruction (verbatim)** *(required only if SKIP_FOR_AUDIT is checked; the Director's exact words)*: [...]

### Verification Status

> Independent of the verdict; not checked by CLI.

- [ ] NEED_VERIFICATION - Research is present and the Verificator Mode audit is pending.
- [ ] NO_NEED_VERIFICATION - No Research section; no Verificator Mode audit applies.
- [ ] SKIP_VERIFICATION - Research is present; the Director waived the Verificator Mode audit.

### Findings

> Append-only. Add a `<Mode> - Audit <N>` block per round; never edit a prior round. Verificator Mode applies only when Research is present.

Critic Mode - Audit 1:

1. [...]

Verificator Mode - Audit 1:

1. [...]

### Recommended Director Action

[...]

---

<!-- SIGMA:DIR_INTENT:SECTION:AMENDMENT_HISTORY -->
## Amendment History

> Auto-rendered by `sigma intent amendment`. Do not edit by hand.

<!-- SIGMA:RENDER:START:amendment-history -->
<!-- SIGMA:RENDER:END:amendment-history -->
