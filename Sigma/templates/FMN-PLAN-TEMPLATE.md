<!-- SIGMA:DOC type=FMN_PLAN schema=2 -->
# FMN-PLAN

> Build contract and test contract for DEV implementation.
> AUD findings on the plan are recorded in AUD Findings.
>
> **Lock State**: Managed by Sigma CLI via `progress-v<N>.json`. Do not edit lock state here.
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

<!-- SIGMA:FMN_PLAN:SECTION:PRE_REQUIREMENT -->
## 2. Pre-requirement

> Filled by FMN — Before lock, freely editable up to that point. Immutable
> after lock, like every other Section 1–7 content.
> Answers a different question than Source Alignment (§1): Source Alignment
> is about formulation input — what informed how this plan was written.
> Pre-requirement is about execution dependency — what must already be true
> before this plan's own DEV-EXEC can begin.
> Template-only mechanism — no CLI gate, no mechanical validation against
> `progress-v<N>.json`. Same discipline tier as Protocol Overrides &
> Expansions (§5): reviewed by Director before lock, never cross-checked by
> Sigma.
> If nothing in this plan depends on prior DEV-EXEC output or another
> file, write "No prerequisites for this plan." under each sub-section
> instead of leaving the tables empty.

### 2.1 Sigma Artefact Requirement

> Lists which DEV-EXEC artifacts must reach a given state before this
> plan's own DEV-EXEC can proceed. **Status is the artifact's real
> governance state** (`DRAFT` / `LOCKED` / `SUPERSEDED`), never DEV's own
> advisory self-report — an artifact is only authoritative once
> Director-approved CLI actions have moved it there. If DEV has reported a
> status like `IMPLEMENTED` but the artifact has not yet passed FMN
> Post-Build Review and been locked, record the governance Status here and
> put the advisory detail in Notes.
> **This is a snapshot, not a live-synced field** — it records the
> prerequisite's state as FMN observed it when drafting this plan, not a
> claim that stays current automatically. Never write a value like
> `UNSATISFIED` here; satisfaction is not stored, it is evaluated by
> whoever reads this table, at the moment they need the answer, by
> comparing this snapshot against the artifact's actual current state
> (`sigma exec check --v` / `sigma exec list`).
> **Direct prerequisites only.** If a listed EXEC itself depends on another
> EXEC, that is the listed EXEC's own concern — this table does not walk
> transitive dependencies.

| No | Sigma Artefact | Status | Notes |
| :--- | :--- | :--- | :--- |
| [...] | [...] | DRAFT / LOCKED / SUPERSEDED | [...] |

### 2.2 Output Requirement

> Lists concrete files needed as reference/input — outputs of previously
> locked DEV-EXECs that this plan's work depends on. Different granularity
> from §2.1: §2.1 asks "is the prerequisite artifact governance-final
> (LOCKED)?"; §2.2 asks "does the specific deliverable file exist, and
> where?"
> **`AVAILABLE` means only that the file is physically/locationally
> findable at Location** — not that it is correct, current, validated, or
> approved. Validating an output's quality is a separate layer (FMN
> Post-Build Review, Developer Verification) — this table is not a
> miniature acceptance system.

| No | Output | Status | Notes | Location |
| :--- | :--- | :--- | :--- | :--- |
| [...] | [...] | AVAILABLE / NOT_YET_AVAILABLE | [...] | [...] |

### 2.3 Ownership

FMN declares Pre-requirement while drafting the plan, pre-lock — freely
editable up to that point, same as every other Section 1–7 content.

**DEV reads, does not write.** DEV must not unilaterally add, remove, or
edit a Pre-requirement entry — doing so would let DEV silently expand the
plan's declared dependency contract. If DEV discovers a missing or
incorrect prerequisite mid-build, the path is DEV's Escalation Path to FMN
(`Sigma/rules/DEV-RULE.md` §Escalation Path), not a silent edit. Because
this section sits inside the immutable-after-lock block, a genuine
correction requires FMN opening a revised plan version, consistent with
how any other Section 1–7 correction is already handled.

Director rules on disputes and on whether a discovered gap is significant
enough to require plan revision versus being absorbed as an accepted risk.

---

<!-- SIGMA:FMN_PLAN:SECTION:WORK_ORDER_TASK_PLAN -->
## 3. Work Order / Task Plan

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
## 4. Acceptance Criteria

> Filled by FMN — Before lock.

| AC ID  | Criteria | Verification Method | Required Result |
| :---   | :---     | :---                | :---            |
| AC-001 | [...]    | [...]               | [...]           |
| AC-002 | [...]    | [...]               | [...]           |

---

<!-- SIGMA:FMN_PLAN:SECTION:IMPLEMENTATION_CONSTRAINTS -->
## 5. Implementation Constraints

> Filled by FMN — Before lock.

| Constraint | Source / Reason | DEV Freedom                        |
| :---       | :---            | :---                               |
| [...]      | [...]           | Non-negotiable / Guided / Flexible |

---

<!-- SIGMA:FMN_PLAN:SECTION:PROTOCOL_OVERRIDES_EXPANSIONS -->
## 6. Protocol Overrides & Expansions

> Filled by FMN — Before lock.
> Record any work in this plan that falls outside the scope originally
> bounded by the ratified Director Intent (e.g. an added build area, a
> relaxed constraint). This is the explicit place for scope
> deviations/expansions — do not fold them into Implementation Constraints.
>
> **Status** is `NOTED` (default — recorded, not a claim that it's harmless
> to DIR-INTENT), `AMENDMENT_REQUESTED` (escalated via
> `Sigma/rules/ARC-RULE.md` §Amendment Request, outcome not yet final), or
> `AMENDMENT_RATIFIED` (a real `AMD-NNN` already covers this — cite it in
> Notes). This table is a snapshot as of lock — DIR-INTENT Section 14
> (Amendment History) is the live record if status changes afterward.

| Item | Justification | Status | Notes |
| :--- | :---          | :---   | :---  |
| [...] | [...]        | [...]  | [...] |

If no override or expansion exists, write:

> No protocol overrides or scope expansions in this plan.

---

<!-- SIGMA:FMN_PLAN:SECTION:PRE_BUILD_TEST_CONTRACT -->
## 7. Pre-Build Test Contract

> Filled by FMN — Before lock. Must be defined before DEV starts implementation.

| Test ID | Behavior / Requirement | Test Method | Expected Result | Evidence Required |
| :---    | :---                   | :---        | :---            | :---              |
| TC-001  | [...]                  | [...]       | [...]           | [...]             |
| TC-002  | [...]                  | [...]       | [...]           | [...]             |

---

<!-- SIGMA:FMN_PLAN:SECTION:DEV_HANDOFF_INSTRUCTIONS -->
## 8. DEV Handoff Instructions

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
## 9. AUD Findings

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

### 9.1 AUD Advisory Verdict

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

<!-- SIGMA:FMN_PLAN:SECTION:DIRECTORS_SUMMARY -->
## 10. Director's Summary

> **Filled by FMN — Before lock.**
> This is a concise, human-readable summary specifically for the Director.
> **Recommended timing:** Fill this section after receiving the AUD advisory verdict or after the Director approves `SKIP_FOR_AUDIT` to capture the final pre-lock state.

### Overview

> Max 5 sentences. Plain-language core of the contract this plan sets — what DEV is actually being asked to build and why, distilled from the Work Order and Acceptance Criteria.
> Write for a Director who will read only this paragraph and nothing else in the document. No TASK-/AC-/TC- ID references, no jargon that requires scrolling up to decode — spell out the substance inline instead of pointing at a section.
> Fold in any non-negotiable constraint the Director must know before lock; don't leave it for a separate list.

[...]

### Open Question / Unclear Decision

> Optional — leave as [...] or omit if nothing applies. Only fill if there is a genuine open question or undecided point the Director should know before lock. Not a place to restate risks already covered elsewhere.

[...]
