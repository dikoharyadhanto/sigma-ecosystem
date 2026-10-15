> **DRAF UNTUK PERSETUJUAN, bukan template yang berlaku.**
> Berkas ini menggantikan `Sigma/templates/DIR-INTENT-TEMPLATE.md` (schema 5) hanya setelah Director menyetujui daftar perubahan di `DISKUSI_SIGMA_INTENT_CLOSE_PER_SEKSI_2026-10-15.md`, Seksi 2.
> Badan template di bawah garis adalah teks akhir yang diusulkan (bahasa Inggris). Penanda `[TENTATIF]` pada komentar HTML menandai redaksi yang belum disetujui eksplisit Director dan dihapus saat template dipasang.
> Bagian yang tidak berubah dari schema 5 disalin apa adanya: Purpose and Problem, Assumptions and Risks (kecuali Project Failure), Research, AUD Notes.

---

<!-- SIGMA:DOC type=DIR_INTENT schema=6 -->
# DIR-INTENT

> Strategic mandate over one main objective: what is to be produced, for whom, why, to what quality standard, and how success is recognised on the final product. It survives changes of feature, method, and stage. Director owns the destination; ARC, AUD, FMN, and DEV advise and interpret.
> Lock state is managed by Sigma CLI. Do not record it here.

> **How to fill this document.** Every item must describe a result or quality worth preserving, not a temporary way of building it. Test: if the feature, method, or stage changes and the goal stays, is this item still true?
> The sections whose standards are assessed on the final product are Desired Outcome and Acceptance, Core Requirements, Quality Standards, and Project Failure. Define each obligation once, in its home section; refer to it from elsewhere by ID or name instead of restating it.

---

<!-- SIGMA:DIR_INTENT:SECTION:DIRECTOR_SUMMARY -->
## Director Summary

> Five sentences at most. The Director should be able to judge from this section alone what the project is and where it stops.

### Summary

[...]

### Included Scenarios

> Three concrete scenarios that are in scope. They illustrate the boundary of the mandate; they are not a feature list.

- [Scenario 1]
- [Scenario 2]
- [Scenario 3]

### Excluded Scenarios

> Three concrete scenarios that are out of scope. They illustrate the boundary of the mandate; they are not a feature list.

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
## Desired Outcome and Acceptance

> The outcome must be observable and falsifiable. The threshold and the evidence required must measure this outcome itself, not a narrower one.

### Desired Outcome

[What is observably different when the project succeeds.]

### Success Threshold

[Quantified or binary standard the final product must meet. A standard, not a result.]

### Evidence Required

[The kind of evidence on the final product that must exist for the outcome to be judged met. Not a test procedure; the reviewer chooses how to obtain and check it. Evidence that cannot be obtained is recorded as not verified.]

---

<!-- SIGMA:DIR_INTENT:SECTION:SCOPE -->
## Scope

> The boundary of the mandate, not a work list. Explicit enough for FMN to plan without inventing intent. Staging inside the mandate belongs to ROADMAP and PLAN.

### In Scope

<!-- [TENTATIF] column name "Mandate Coverage" replaces "Must Deliver"; final wording not yet approved. -->

| ID | Mandate Coverage | Reason |
|:-- |:---------------- |:------ |
| SC-001 | [What the mandate covers, stated at outcome level.] | [...] |

### Out of Scope

> What lies outside this mandate. Work that is only later in the sequence is not listed here; it belongs to ROADMAP or PLAN. A follow-up objective after the mandate is closed becomes a new INTENT.

| ID | Excluded | Reason |
|:-- |:-------- |:------ |
| OS-001 | [...] | [...] |

---

<!-- SIGMA:DIR_INTENT:SECTION:QUALITY_STANDARDS -->
## Quality Standards

> State a minimum standard for each dimension, or N/A with a reason. Add rows for dimensions specific to the product domain when they matter (for example methodological validity for an academic manuscript). Each row is assessed once, at product review.

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

### Constraints

> A constraint belongs here only if it would still hold when the method changes: it protects the mandate, a Director boundary, or an external requirement. A technology or design choice that is only the current way of building belongs to PLAN. When a technology is a real requirement (target environment, external standard), state it here and say in Notes why it must be protected at INTENT level.
>
> Type: Hard Constraint, Preference, Timeline, Technical (external requirement only), Rejected Approach, or DEV Must Not. Binding Level: Non-negotiable, Conditional, Challengeable, or Preference.

| ID | Type | Statement | Binding Level | Notes |
|:-- |:---- |:--------- |:------------- |:----- |
| CON-001 | [...] | [...] | [...] | [Why this is protected at INTENT level] |

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

> State only the failure condition that the outcome, requirements, and quality standards do not already imply. Refer to them by ID or name instead of restating them.

[The project is considered failed if ...]

---

<!-- SIGMA:DIR_INTENT:SECTION:FUNCTIONAL_REQUIREMENTS -->
## Core Requirements

> Core capabilities and result qualities the final product must have, stated at outcome level. Each REQ is one obligation, defined once here; other sections refer to it by ID. Features, technology, and technical tests belong to PLAN.

### REQ-001 - [Short name]

**Required Capability**: [What the product must enable, or what quality the result must have.]

**Acceptance Standard**:

- [Condition verifiable on the final product, without prescribing the check method.]

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
