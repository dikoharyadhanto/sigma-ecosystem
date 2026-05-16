# Rekomendasi - DIR-INTENT Document

Untuk Sigma, **`DIR-INTENT` memang paling tepat menjadi gabungan terkompresi dari Delta `DIR-DI` + bagian inti `GMN-STRAT`**.

Tapi kompresinya harus hati-hati. Jangan sekadar menempel dua template. Delta `DIR-DI` berfungsi sebagai **strategic intent & decision constraint layer**, sedangkan `GMN-STRAT` berfungsi sebagai **execution control system** dengan strategic control, requirement, risk, architecture, validation gate, dan role consumption rules.

Untuk Sigma, hasil terbaik adalah:

```
DIR-INTENT = Intent + Strategic Control + Auditable Route
```

## Prinsip kompresi

Yang dipertahankan dari Delta `DIR-DI`:

```
Project identity
Strategic vision
Success definition
Core principles
Trade-offs
Risk appetite
Primary failure concern
Scope in/out
Timeline & constraints
Decision authority
```

Yang dipertahankan dari Delta `GMN-STRAT`:

```
Strategic Control Layer
Critical Decisions
Non-negotiable constraints
Instruction hierarchy
Anti-ambiguity rules
Failure definition
Risk register ringkas
Architecture / tech direction
Functional requirements + acceptance criteria
Final validation gate
Advisory audit evidence
```

Yang dibuang dari Sigma `DIR-INTENT`:

```
Skill allowlist
NLM request
WO validation detail
ANT/CDC/PPX operational read scopes
Full ADR template berat
Mermaid flow
Long risk schema
Delta-specific STRAT lock gate
```

Rekomendasi Template: `DIR-INTENT`

```
# DIR-INTENT-{PROJECT_ID}-{VERSION}

**Sigma Director Intent & Strategic Control**

> **Purpose**: This document captures the Director's intent, strategic constraints, execution direction, auditable assumptions, and minimum evidence expectations for a Sigma project.
>
> **Authority Rule**: The Director owns the destination. ARC, AUD, FMN, and DEV may advise, challenge, and interpret, but only the Director approves runtime state changes.

---

## 1. Metadata

| Field | Value |
| :--- | :--- |
| Project Name | [Project Name] |
| Document Type | DIR-INTENT |

---

## 2. Intent Core — Sovereign Layer

> **Audit Status**: CLARITY_ONLY  
> AUD may identify ambiguity, contradiction, missing success criteria, or unclear scope.  
> AUD may not oppose, replace, or re-rank the Director's intent.

### 2.1 Objective

[What are we trying to create or change?]

### 2.2 Problem Being Solved

[What pain, gap, inefficiency, risk, or opportunity does this project address?]

### 2.3 Target User / Beneficiary

[Who benefits from this project?]

### 2.4 Desired Outcome

[What should be observably different when this project succeeds?]

### 2.5 Primary Value Delivered

[The core value this project must deliver.]

---

## 3. Success Definition

> **Audit Status**: FULL_AUDIT  
> Success criteria must be measurable, observable, or verifiable.

### 3.1 Concrete Outcome

[Specific observable result.]

### 3.2 Success Threshold

[Quantified or binary threshold.]

### 3.3 Measurement Method

[How will success be verified?]

### 3.4 Minimum Viable Evidence

Before this project can close, Sigma must have:

- [ ] At least one locked `FMN-PLAN`
- [ ] Test results recorded against a pre-build test contract
- [ ] Implementation summary completed
- [ ] Known limitations documented
- [ ] Director closure verdict recorded

---

## 4. Strategic Trade-Offs

> **Audit Status**: FULL_AUDIT  
> AUD may challenge whether the trade-offs are coherent, feasible, or risky.

### 4.1 Primary Trade-Off

We prioritize **[X]** over **[Y]**.

### 4.2 Secondary Trade-Offs

- We are willing to sacrifice **[X]** to gain **[Y]**.
- We are willing to sacrifice **[X]** to gain **[Y]**.

### 4.3 Why These Trade-Offs Matter

[Explain how these choices affect scope, architecture, timeline, risk, and evidence.]

---

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

## 6. Constraints & Preferences — Challengeable Means Layer

> **Audit Status**: CHALLENGEABLE  
> The Director may state preferences here, but AUD may challenge feasibility, risk, cost, mismatch, or hidden trade-offs.

| ID | Type | Statement | Binding Level | Notes |
| :--- | :--- | :--- | :--- | :--- |
| CON-001 | Hard Constraint | [...] | Non-negotiable | [...] |
| CON-002 | Preference | [...] | Challengeable | [...] |
| CON-003 | Timeline | [...] | Conditional | [...] |
| CON-004 | Technical | [...] | Challengeable / Hard | [...] |

### Binding Level Definitions

- **Non-negotiable**: Cannot be changed without Director revision.
- **Conditional**: Can change only if risk/trade-off is accepted by Director.
- **Challengeable**: Can be challenged by AUD/FMN if it weakens execution.
- **Preference**: Desired, but not binding if better route exists.

---

## 7. Technical & Architecture Direction

> **Audit Status**: FULL_AUDIT  
> Tech stack, architecture, and solution assumptions are not sovereign intent. They are auditable means.

### 7.1 Preferred Tech Stack

| Layer | Technology | Reason | Risk / Trade-Off |
| :--- | :--- | :--- | :--- |
| Frontend | [...] | [...] | [...] |
| Backend | [...] | [...] | [...] |
| Database | [...] | [...] | [...] |
| Hosting | [...] | [...] | [...] |

### 7.2 Architecture Direction

[High-level architecture or product structure.]

### 7.3 Solution Assumptions

| Assumption ID | Assumption | Confidence | What if wrong? |
| :--- | :--- | :--- | :--- |
| ASM-001 | [...] | Low / Medium / High | [...] |

### 7.4 Explicitly Rejected Approaches

| Rejected Option | Reason Rejected | Trade-Off Accepted |
| :--- | :--- | :--- |
| [...] | [...] | [...] |

---

## 8. Functional Requirements

> **Audit Status**: FULL_AUDIT  
> These are execution-shaping requirements. FMN uses this section to create the `FMN-EXEC` task plan and test contract.

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

## 9. Risk & Failure Definition

> **Audit Status**: FULL_AUDIT  
> Risks should be practical, not decorative.

### 9.1 Risk Appetite

| Risk Type | Tolerance |
| :--- | :--- |
| Fatal Risk | Zero / Conditional |
| Degraded Capability | Low / Medium / High |
| Unknowns | Low / Medium / High |

### 9.2 Primary Failure Concern

**The Failure**:  
[Worst realistic outcome to avoid.]

**Why This Matters**:  
[Impact.]

**Guardrail / Mitigation**:  
[How we reduce the chance or impact.]

### 9.3 Risk Register

| Risk ID | Classification | Description | Impact | Mitigation | Accepted? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| RR-001 | Fatal / Degrading / Noise | [...] | [...] | [...] | Yes / No / Conditional |

### 9.4 Failure Definition

- **Project Failure**: [...]
- **Build Blocker**: [...]
- **Acceptable Degraded State**: [...]

---

## 10. Execution Direction for FMN-EXEC

> **Audit Status**: FULL_AUDIT  
> This section tells FMN how to convert intent into execution without creating a separate ARC-PLAN artifact.

### 10.1 Execution Focus

| Focus Area | Why It Matters | Watch-Out |
| :--- | :--- | :--- |
| [...] | [...] | [...] |

### 10.2 FMN Must Produce

The first `FMN-PLAN` must include:

- [ ] Work Order / Task Plan
- [ ] Pre-Build Test Contract
- [ ] Implementation constraints
- [ ] Post-Build Test Report section
- [ ] Implementation Report section
- [ ] Evidence Summary

### 10.3 DEV Must Not

- [Forbidden implementation behavior]
- [Out-of-scope expansion]
- [Assumption not allowed]

---

## 11. Audit Findings — Advisory Only

> **Audit Status**: ADVISORY  
> AUD findings support Director judgment. They do not approve, reject, lock, or block runtime state.

### 11.1 AUD Review Scope

AUD may review:

- Intent clarity
- Scope consistency
- Technical feasibility
- Architecture assumptions
- Risk coverage
- Success criteria
- Evidence sufficiency
- Route vs destination alignment

AUD may not:

- Replace Director intent
- Re-rank Director values
- Treat advisory findings as runtime approval

### 11.2 AUD Advisory Verdict

**Verdict**: PASS / PASS_WITH_RISK / REVISE / REJECT_RECOMMENDED / PROMOTE_TO_HEAVIER_PROCESS

**Major Findings**:

1. [...]
2. [...]
3. [...]

**Recommended Director Action**:

[...]

---

## 12. Final Validation Checklist

Before `DIR-INTENT` can be locked:

- [ ] Intent Core is clear enough to guide execution.
- [ ] Scope in/out is explicit.
- [ ] Success criteria are observable or measurable.
- [ ] Constraints and preferences are separated.
- [ ] Technical choices are marked as auditable means, not sovereign intent.
- [ ] At least one execution direction exists for FMN.
- [ ] Risk appetite is stated.
- [ ] Primary failure concern is stated.
- [ ] Evidence requirement is stated.
- [ ] Director verdict is recorded.
```

## Kenapa template ini lebih cocok untuk Sigma

Template Delta `DIR-DI` terlalu “pure intent” jika berdiri sendiri, sementara Sigma tidak punya `ARC-PLAN` terpisah. Jadi Sigma butuh `DIR-INTENT` yang tidak hanya menyatakan tujuan, tapi juga memuat **strategic execution direction**. Delta `GMN-STRAT` punya Strategic Control Layer, Critical Decisions, Non-Negotiable Constraints, Instruction Hierarchy, Failure Definition, Functional Requirements, Risk & Architecture, dan Final Validation Gate — tapi terlalu berat jika dibawa penuh ke Sigma.

Template di atas mengambil fungsi kritisnya, lalu mengompresi menjadi:

```
Intent Core
Success
Trade-Offs
Scope
Constraints
Tech Direction
Requirements
Risk
Execution Direction
Audit Findings
Director Verdict
```

Itu cukup untuk menggantikan DIR-DI + GMN-STRAT

## Catatan

Bagian paling rawan adalah **Section 7: Technical & Architecture Direction**.

Di sinilah Director sering mencampur:

```
tujuan
preferensi
asumsi solusi
pilihan teknologi
```

Template harus memaksa pemisahan:

```
Intent Core = sovereign
Tech stack = auditable
Architecture = auditable
Timeline = auditable
Scope choices = auditable
```

Ini menjaga prinsip yang sudah ditetapkan 

```
Director owns the destination.
Audit attacks the route.
```

## Rekomendasi naming

Gunakan:

DIR-INTENT-{PROJECT_ID}-{MAJOR TIER VERSION}.md
