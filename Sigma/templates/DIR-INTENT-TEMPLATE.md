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

| ID      | Type             | Statement | Binding Level   | Notes |
| :---    | :---             | :---      | :---            | :---  |
| CON-001 | Hard Constraint  | [...]     | Non-negotiable  | [...] |
| CON-002 | Preference       | [...]     | Challengeable   | [...] |
| CON-003 | Timeline         | [...]     | Conditional     | [...] |
| CON-004 | Technical        | [...]     | Challengeable   | [...] |

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

| Layer   | Technology | Reason | Risk / Trade-Off |
| :---    | :---       | :---   | :---             |
| [Layer] | [...]      | [...]  | [...]            |

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

| Risk Type            | Tolerance             |
| :---                 | :---                  |
| Fatal Risk           | Zero / Conditional    |
| Degraded Capability  | Low / Medium / High   |
| Unknowns             | Low / Medium / High   |

### 8.2 Primary Failure Concern

**The Failure**:
[Worst realistic outcome to avoid.]

**Why This Matters**:
[Impact.]

**Guardrail / Mitigation**:
[How we reduce the chance or impact.]

### 8.3 Risk Register

| Risk ID | Classification            | Description | Impact | Mitigation | Accepted?              |
| :---    | :---                      | :---        | :---   | :---       | :---                   |
| RR-001  | Fatal / Degrading / Noise | [...]       | [...]  | [...]      | Yes / No / Conditional |

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
