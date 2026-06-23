<!-- SIGMA:DOC type=DIR_INTENT schema=2 -->
# DIR-INTENT

> **Purpose**: Captures Director intent, strategic constraints, execution direction, auditable assumptions, and minimum evidence requirements for a Sigma project.
> 
> **Authority Rule**: Director owns the destination. ARC, AUD, FMN, and DEV may advise, challenge, and interpret — but only the Director approves runtime state changes.
> 
> **Lock State**: Managed by Sigma CLI via `progress.json`. Do not edit lock state here.

---

<!-- SIGMA:DIR_INTENT:SECTION:INTENT_CORE -->
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

<!-- SIGMA:DIR_INTENT:SECTION:SUCCESS_DEFINITION -->
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

<!-- SIGMA:DIR_INTENT:SECTION:QUALITY_BAR -->
## 3. Quality Bar — Minimum Standard for This Intent

> **Audit Status**: FULL_AUDIT
> A feature is not successful merely because it works functionally. It must also satisfy the minimum quality standard selected for this Intent.
>
> State the minimum acceptable standard for each dimension according to the scope and ambition of this Intent. The expected standard may be lightweight, internal-only, pilot-grade, production-grade, or explicitly not applicable, but it must be stated.

| Dimension | Minimum Standard For This Intent | Must Not Happen | Evidence Required |
|:--------- |:-------------------------------- |:--------------- |:----------------- |
| Security | [What must be true for this to be safe enough?] | [Credential leak, tenant leak, privilege bypass, unsafe public exposure, etc.] | [Security review, RBAC test, secret scan, network evidence, etc.] |
| UX Trust | [What must be true for users to understand the product state correctly?] | [False success, hidden fallback, misleading loading, unclear failure, unsafe action, etc.] | [Browser walkthrough, screenshots, state tests, copy review, fallback evidence, etc.] |
| UI / Product Packaging | [What must be true for the product to feel coherent and ready for its intended audience?] | [Broken layout, inconsistent copy, debug-like UX, inaccessible critical action, visual mismatch, etc.] | [UI screenshots, responsive check, i18n check, design review, Director walkthrough, etc.] |
| Performance / Cost | [What must be true for speed, reliability, and cost to be acceptable?] | [Unbounded cost growth, unacceptable latency, no cache/lifecycle policy, hidden quota risk, etc.] | [Timing table, p50/p95, cost worksheet, scale estimate, cache/lifecycle evidence, etc.] |

### 3.1 Quality Notes

[Optional. Explain which quality dimensions matter most for this Intent and why.]

### 3.2 Quality Trade-Offs

[Optional. State explicit quality trade-offs, such as stronger security over faster implementation, simpler UI for internal tooling, slower first load if cached interaction is fast, or higher storage cost only if retention is bounded.]

---

<!-- SIGMA:DIR_INTENT:SECTION:STRATEGIC_TRADE_OFFS -->
## 4. Strategic Trade-Offs

> **Audit Status**: FULL_AUDIT
> AUD may challenge whether trade-offs are coherent, feasible, or risky.

### 4.1 Primary Trade-Off

We prioritize **[X]** over **[Y]**.

### 4.2 Secondary Trade-Offs

- We are willing to sacrifice **[X]** to gain **[Y]**.
- We are willing to sacrifice **[X]** to gain **[Y]**.

### 4.3 Why These Trade-Offs Matter

[How these choices affect scope, architecture, timeline, risk, and evidence.]

---

<!-- SIGMA:DIR_INTENT:SECTION:SCOPE_BOUNDARY -->
## 5. Scope Boundary

> **Audit Status**: FULL_AUDIT
> Scope must be explicit enough for FMN to produce execution work without inventing intent.

### 5.1 In Scope

- [Must deliver item 1]
- [Must deliver item 2]

### 5.2 Out of Scope

- [Explicitly deferred item 1]
- [Explicitly deferred item 2]

### 5.3 Non-Goals

We will NOT do the following:

- [Non-goal 1]
- [Non-goal 2]

### 5.4 Why This Boundary Matters

[What goes wrong if this scope expands?]

---

<!-- SIGMA:DIR_INTENT:SECTION:CONSTRAINTS_AND_PREFERENCES -->
## 6. Constraints & Preferences — Challengeable Means Layer

> **Audit Status**: CHALLENGEABLE
> Director may state preferences here, but AUD may challenge feasibility, risk, cost, mismatch, or hidden trade-offs.

| ID      | Type            | Statement | Binding Level  | Notes |
|:------- |:--------------- |:--------- |:-------------- |:----- |
| CON-001 | Hard Constraint | [...]     | Non-negotiable | [...] |
| CON-002 | Preference      | [...]     | Challengeable  | [...] |
| CON-003 | Timeline        | [...]     | Conditional    | [...] |
| CON-004 | Technical       | [...]     | Challengeable  | [...] |

### Binding Level Definitions

- **Non-negotiable**: Cannot be changed without Director revision.
- **Conditional**: Can change only if risk/trade-off is accepted by Director.
- **Challengeable**: Can be challenged by AUD/FMN if it weakens execution.
- **Preference**: Desired, but not binding if better route exists.

---

<!-- SIGMA:DIR_INTENT:SECTION:TECHNICAL_AND_ARCHITECTURE_DIRECTION -->
## 7. Technical & Architecture Direction

> **Audit Status**: FULL_AUDIT
> Tech stack, architecture, and solution assumptions are auditable means — not sovereign intent.

### 7.1 Preferred Tech Stack

| Layer   | Technology | Reason | Risk / Trade-Off |
|:------- |:---------- |:------ |:---------------- |
| [Layer] | [...]      | [...]  | [...]            |

### 7.2 Architecture Direction

[High-level architecture or product structure.]

### 7.3 Solution Assumptions

| Assumption ID | Assumption | Confidence          | What if wrong? |
|:------------- |:---------- |:------------------- |:-------------- |
| ASM-001       | [...]      | Low / Medium / High | [...]          |

### 7.4 Explicitly Rejected Approaches

| Rejected Option | Reason Rejected | Trade-Off Accepted |
|:--------------- |:--------------- |:------------------ |
| [...]           | [...]           | [...]              |

---

<!-- SIGMA:DIR_INTENT:SECTION:FUNCTIONAL_REQUIREMENTS -->
## 8. Functional Requirements

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

<!-- SIGMA:DIR_INTENT:SECTION:RISK_AND_FAILURE_DEFINITION -->
## 9. Risk & Failure Definition

> **Audit Status**: FULL_AUDIT
> Risks should be practical, not decorative.

### 9.1 Risk Appetite

| Risk Type           | Tolerance           |
|:------------------- |:------------------- |
| Fatal Risk          | Zero / Conditional  |
| Degraded Capability | Low / Medium / High |
| Unknowns            | Low / Medium / High |

### 9.2 Primary Failure Concern

**The Failure**:
[Worst realistic outcome to avoid.]

**Why This Matters**:
[Impact.]

**Guardrail / Mitigation**:
[How we reduce the chance or impact.]

### 9.3 Risk Register

| Risk ID | Classification            | Description | Impact | Mitigation | Accepted?              |
|:------- |:------------------------- |:----------- |:------ |:---------- |:---------------------- |
| RR-001  | Fatal / Degrading / Noise | [...]       | [...]  | [...]      | Yes / No / Conditional |

### 9.4 Failure Definition

- **Project Failure**: [...]
- **Build Blocker**: [...]
- **Acceptable Degraded State**: [...]

---

<!-- SIGMA:DIR_INTENT:SECTION:EXECUTION_DIRECTION_FOR_FMN -->
## 10. Execution Direction for FMN

> **Audit Status**: FULL_AUDIT
> This section tells FMN how to convert intent into execution. Replaces ARC-PLAN — Sigma does not have a separate ARC artifact.

### 10.1 Execution Focus

| Focus Area | Why It Matters | Watch-Out |
|:---------- |:-------------- |:--------- |
| [...]      | [...]          | [...]     |

### 10.2 FMN Must Produce

The first `FMN-PLAN` must include:

- [ ] Work Order / Task Plan
- [ ] Pre-Build Test Contract
- [ ] Implementation constraints
- [ ] Quality Bar carry-forward for Security, UX Trust, UI / Product Packaging, and Performance / Cost
- [ ] Post-Build Test Report section
- [ ] Implementation Report section
- [ ] Evidence Summary

### 10.3 FMN Must Preserve Quality Bar

The first `FMN-PLAN` must explicitly carry forward:

- [ ] Security minimum standard and evidence requirement
- [ ] UX Trust minimum standard and evidence requirement
- [ ] UI / Product Packaging minimum standard and evidence requirement
- [ ] Performance / Cost minimum standard and evidence requirement

### 10.4 DEV Must Not

- [Forbidden implementation behavior]
- [Out-of-scope expansion]
- [Assumption not allowed]

---

<!-- SIGMA:DIR_INTENT:SECTION:AUD_FINDINGS_ADVISORY_ONLY -->
## 11. AUD Findings — Advisory Only

> **Audit Status**: ADVISORY
> AUD findings support Director judgment. They do not approve, reject, lock, or block runtime state.

### 11.1 AUD Review Scope

AUD may review: intent clarity, scope consistency, technical feasibility, architecture assumptions, risk coverage, success criteria, evidence sufficiency, route vs destination alignment.

AUD may not: replace Director intent, re-rank Director values, or treat advisory findings as runtime approval.

### 11.2 AUD Advisory Verdict

**Verdict**:

> Pick one. Do not edit or add options. If none fit, tick OTHER and describe.

- [ ] PASS
- [ ] PASS_WITH_RISK
- [ ] REVISE
- [ ] REJECT_RECOMMENDED
- [ ] PROMOTE_TO_HEAVIER_PROCESS
- [ ] OTHER: [describe]

**Major Findings**:

1. [...]
2. [...]
3. [...]

**Recommended Director Action**:

[...]

---

<!-- SIGMA:DIR_INTENT:SECTION:FINAL_VALIDATION_CHECKLIST -->
## 12. Final Validation Checklist

> Complete this checklist before running `sigma intent lock`.

- [ ] Intent Core is clear enough to guide execution.
- [ ] Scope in/out is explicit.
- [ ] Success criteria are observable or measurable.
- [ ] Security minimum standard is stated or explicitly marked not applicable.
- [ ] UX Trust minimum standard is stated or explicitly marked not applicable.
- [ ] UI / Product Packaging minimum standard is stated or explicitly marked not applicable.
- [ ] Performance / Cost minimum standard is stated or explicitly marked not applicable.
- [ ] FMN is instructed to preserve the Quality Bar in every PLAN.
- [ ] Constraints and preferences are separated.
- [ ] Technical choices are marked as auditable means, not sovereign intent.
- [ ] At least one execution direction exists for FMN (Execution Direction for FMN).
- [ ] Risk appetite is stated.
- [ ] Primary failure concern is stated.
- [ ] Evidence requirement is stated.
- [ ] Director verdict is recorded.
