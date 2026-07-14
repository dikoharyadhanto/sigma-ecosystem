<!-- SIGMA:DOC type=DIR_INTENT schema=3 -->
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

> Operationalized as a falsifiable claim in 3.1 Concrete Outcome. That
> field must measure this outcome, not a narrower or different one.

### 1.5 Primary Value Delivered

[The core value this project must deliver.]

---

<!-- SIGMA:DIR_INTENT:SECTION:COMPREHENSIVE_RESEARCH -->
## 2. Comprehensive Research

> **Audit Status**: FULL_AUDIT
> Optional. Mark NEEDED when the Director or ARC is not confident existing
> knowledge is sufficient to responsibly formulate this Intent, or when
> Intent must match real-world conditions verified at implementation time,
> not assumed at design time.
>
> General source compass: prefer a primary source over a secondary one
> whenever available; use a secondary source only when no primary source
> exists, or to help interpret one.
>
> If status is NEEDED, AUD Verificator Mode must review source-tier
> compliance for the IDs cited below before `sigma intent lock` — see
> Section 13.

### 2.1 Status

- [ ] NEEDED
- [ ] NOT_NEEDED

If NOT_NEEDED, skip to Section 3. State briefly why existing knowledge is sufficient:

[...]

> Example: "Standard CRUD admin panel using patterns already proven elsewhere
> in this codebase. No new theory, methodology, or unverified real-world
> assumption is involved."

### 2.2 Theory and Concept

> Sources: peer-reviewed international research journals or academic/scholarly books only. No general websites, forums, Wikipedia, or similar.

[The conceptual or theoretical grounding required before this Intent can be trusted. Reference ASM-ID/REQ-ID where applicable.]

> Example: "The Rational Method (Kirpich, 1940) is the accepted standard for
> peak runoff estimation in small urban catchments (<200 ha) (WL01). This
> grounds ASM-002 (rainfall-runoff assumption)."
>
> Cite by reference-list.md row ID only (e.g. "(WL01)") — do not re-explain
> where to look or repeat the link inline.

### 2.3 Issue, Problem, and Real-World Data

> Sources: open. Prefer research journals, forums, news reporting, or official reports/documentation from the relevant official website.

[Real-world evidence of the problem — incidents, user reports, measured pain — not assumed pain.]

> Example: "BPS flood-incident records show 14 events in the target
> sub-district over the last 5 years, averaging Rp 2.1B in damage per event
> (LA02). This substantiates the Problem Being Solved stated in Intent Core —
> it is measured pain, not assumed pain."

### 2.4 Methodology

> Sources: official documentation from the official/authoritative website (preferred), or a reputable technical Q&A community (e.g. Stack Overflow, GIS Stack Exchange). Nothing outside those two tiers.

[How this investigation was conducted, and how conclusions will be validated during implementation.]

> Example: "Catchment delineation was cross-checked against the official
> BMKG rainfall API docs (WL02) and GIS Stack Exchange watershed-tool
> threads (WL03). Conclusions will be re-validated against live BMKG data
> during DEV-EXEC, not assumed to still hold at implementation time."

### 2.5 Source / Data

> Sources: open. Prefer official data-reporting or data-extraction sources (e.g. Kaggle, BPS, OpenStreetMap, or the domain-equivalent official registry). Download into Sigma/reference/data/ when practical; record in the reference list regardless.

[Brief description of what data was needed, if any. The full source list and any locally saved data live in `Sigma/reference/reference-list.md` — do not duplicate source content here.]

> Example: "Historical rainfall (2019–2023) (LA02) and catchment boundary
> data (OS01, too large to vendor) were needed for calibration."

---

<!-- SIGMA:DIR_INTENT:SECTION:SUCCESS_DEFINITION -->
## 3. Success Definition

> **Audit Status**: FULL_AUDIT
> Success criteria must be measurable, observable, or verifiable.

### 3.1 Concrete Outcome

[Specific observable result.]

> Must operationalize 1.4 Desired Outcome — the same destination, made
> falsifiable. Do not substitute an easier or narrower claim just because
> this field is fully auditable and 1.4 is not. AUD must flag a mismatch
> between 1.4 and 3.1 as a finding, not treat 3.1 in isolation.

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

<!-- SIGMA:DIR_INTENT:SECTION:QUALITY_BAR -->
## 4. Quality Bar — Minimum Standard for This Intent

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

### 4.1 Quality Notes

[Optional. Explain which quality dimensions matter most for this Intent and why.]

### 4.2 Quality Trade-Offs

[Optional. State explicit quality trade-offs, such as stronger security over faster implementation, simpler UI for internal tooling, slower first load if cached interaction is fast, or higher storage cost only if retention is bounded.]

---

<!-- SIGMA:DIR_INTENT:SECTION:STRATEGIC_TRADE_OFFS -->
## 5. Strategic Trade-Offs

> **Audit Status**: FULL_AUDIT
> AUD may challenge whether trade-offs are coherent, feasible, or risky.

### 5.1 Primary Trade-Off

We prioritize **[X]** over **[Y]**.

### 5.2 Secondary Trade-Offs

- We are willing to sacrifice **[X]** to gain **[Y]**.
- We are willing to sacrifice **[X]** to gain **[Y]**.

### 5.3 Why These Trade-Offs Matter

[How these choices affect scope, architecture, timeline, risk, and evidence.]

---

<!-- SIGMA:DIR_INTENT:SECTION:SCOPE_BOUNDARY -->
## 6. Scope Boundary

> **Audit Status**: FULL_AUDIT
> Scope must be explicit enough for FMN to produce execution work without inventing intent.

### 6.1 In Scope

- [Must deliver item 1]
- [Must deliver item 2]

### 6.2 Out of Scope

- [Explicitly deferred item 1]
- [Explicitly deferred item 2]

### 6.3 Non-Goals

We will NOT do the following:

- [Non-goal 1]
- [Non-goal 2]

### 6.4 Why This Boundary Matters

[What goes wrong if this scope expands?]

---

<!-- SIGMA:DIR_INTENT:SECTION:CONSTRAINTS_AND_PREFERENCES -->
## 7. Constraints & Preferences — Challengeable Means Layer

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
## 8. Technical & Architecture Direction

> **Audit Status**: FULL_AUDIT
> Tech stack, architecture, and solution assumptions are auditable means — not sovereign intent.

### 8.1 Preferred Tech Stack

| Layer   | Technology | Reason | Risk / Trade-Off |
|:------- |:---------- |:------ |:---------------- |
| [Layer] | [...]      | [...]  | [...]            |

### 8.2 Architecture Direction

[High-level architecture or product structure.]

### 8.3 Solution Assumptions

| Assumption ID | Assumption | Confidence          | What if wrong? |
|:------------- |:---------- |:------------------- |:-------------- |
| ASM-001       | [...]      | Low / Medium / High | [...]          |

### 8.4 Explicitly Rejected Approaches

| Rejected Option | Reason Rejected | Trade-Off Accepted |
|:--------------- |:--------------- |:------------------ |
| [...]           | [...]           | [...]              |

---

<!-- SIGMA:DIR_INTENT:SECTION:FUNCTIONAL_REQUIREMENTS -->
## 9. Functional Requirements

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
## 10. Risk & Failure Definition

> **Audit Status**: FULL_AUDIT
> Risks should be practical, not decorative.

### 10.1 Risk Appetite

| Risk Type           | Tolerance           |
|:------------------- |:------------------- |
| Fatal Risk          | Zero / Conditional  |
| Degraded Capability | Low / Medium / High |
| Unknowns            | Low / Medium / High |

### 10.2 Primary Failure Concern

**The Failure**:
[Worst realistic outcome to avoid.]

**Why This Matters**:
[Impact.]

**Guardrail / Mitigation**:
[How we reduce the chance or impact.]

### 10.3 Risk Register

| Risk ID | Classification            | Description | Impact | Mitigation | Accepted?              |
|:------- |:------------------------- |:----------- |:------ |:---------- |:---------------------- |
| RR-001  | Fatal / Degrading / Noise | [...]       | [...]  | [...]      | Yes / No / Conditional |

### 10.4 Failure Definition

- **Project Failure**: [...]
- **Build Blocker**: [...]
- **Acceptable Degraded State**: [...]

---

<!-- SIGMA:DIR_INTENT:SECTION:EXECUTION_DIRECTION_FOR_FMN -->
## 11. Execution Direction for FMN

> **Audit Status**: FULL_AUDIT
> This section tells FMN how to convert intent into execution. Replaces ARC-PLAN — Sigma does not have a separate ARC artifact.

### 11.1 Execution Focus

| Focus Area | Why It Matters | Watch-Out |
|:---------- |:-------------- |:--------- |
| [...]      | [...]          | [...]     |

### 11.2 FMN Must Produce

The first `FMN-PLAN` must include:

- [ ] Work Order / Task Plan
- [ ] Pre-Build Test Contract
- [ ] Implementation constraints
- [ ] Quality Bar carry-forward for Security, UX Trust, UI / Product Packaging, and Performance / Cost
- [ ] Post-Build Test Report section
- [ ] Implementation Report section
- [ ] Evidence Summary

### 11.3 FMN Must Preserve Quality Bar

The first `FMN-PLAN` must explicitly carry forward:

- [ ] Security minimum standard and evidence requirement
- [ ] UX Trust minimum standard and evidence requirement
- [ ] UI / Product Packaging minimum standard and evidence requirement
- [ ] Performance / Cost minimum standard and evidence requirement

### 11.4 DEV Must Not

- [Forbidden implementation behavior]
- [Out-of-scope expansion]
- [Assumption not allowed]

---

<!-- SIGMA:DIR_INTENT:SECTION:AUD_FINDINGS_ADVISORY_ONLY -->
## 12. AUD Findings — Advisory Only

> **Audit Status**: ADVISORY
> AUD findings support Director judgment. They do not approve, reject, lock, or block runtime state.
>
> **Who may write this section**: ARC or FMN, sourced from either (a) an AUD
> message received via `sigma send`/`sigma inbox` mailbox, or (b) the Director relaying
> audit results directly in a chat session. DEV must not write in this
> section.
>
> **Verdict integrity**: The checkbox verdict in 12.2 must be transcribed
> exactly as AUD stated it — ARC/FMN must not alter, soften, or upgrade it.
> Narrative content (Major Findings, Recommended Director Action) may be
> ARC/FMN's interpretation of the audit — verbatim copy-paste is not
> required.

### 12.1 AUD Review Scope

AUD may review: intent clarity, scope consistency, technical feasibility, architecture assumptions, risk coverage, success criteria, evidence sufficiency, route vs destination alignment, and — when Comprehensive Research status is NEEDED — source-tier compliance for each cited `reference-list.md` ID (provide `Sigma/reference/reference-list.md` as part of AUD's Evidence Package for this check).

AUD may not: replace Director intent, re-rank Director values, or treat advisory findings as runtime approval.

### 12.2 AUD Advisory Verdict

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

---

<!-- SIGMA:DIR_INTENT:SECTION:FINAL_VALIDATION_CHECKLIST -->
## 13. Final Validation Checklist

> Complete this checklist before running `sigma intent lock`.

### 13.1 Lock Requirement

> All items below must be checked before `sigma intent lock` will succeed.
> For the four Quality Bar items, `sigma intent lock` validates the actual
> Section 4 table content (a real minimum standard or an explicit "N/A"),
> not just this checkbox.

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

### 13.2 Conditional Requirement

> These items are not a lock gate — they only matter when their own
> condition applies. Leave unchecked and irrelevant when the condition
> does not apply; `sigma intent lock` does not evaluate them.

- [ ] If Comprehensive Research status = NEEDED, all four subsections are filled or explicitly marked N/A, and `reference-list.md` has real entries for this intent's research — not just leftover entries from earlier work.
- [ ] If Comprehensive Research status = NEEDED, AUD Verificator Mode has reviewed source-tier compliance for the cited IDs and recorded a verdict in Section 12 — or the Director has explicitly accepted the risk of locking without that review.
