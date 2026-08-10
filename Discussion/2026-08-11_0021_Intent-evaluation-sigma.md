# Intent Governance Evaluation — Sigma Lifecycle Design Brief

> **Purpose**: This document is evaluation material for the Sigma system developer. It is not a proposal already approved for implementation, and none of it has been applied to the Sigma CLI, schema, or rule files. It records a design discussion between the Director, ARC (Architect role), and AUD (Auditor role) triggered by a real Closure Evaluation on the CanopySense project, and consolidates the gap identified, the model proposed to close it, the points of disagreement that were resolved during discussion, and the points still open.
>
> **Origin**: `Sigma/rules/ARC-RULE.md` §Petition/Admission Review already anticipated part of this discussion, flagging in its own text that generalizing its clarification-vs-change question beyond score re-evaluation was "a possible future direction, not part of this scope." This document is that future direction being worked out.

---

## 1. Origin: Closure Evaluation of DIR-INTENT-v2 (CanopySense)

ARC ran a Closure Evaluation (Director-confirmed) on CanopySense's locked intent chain, covering every `FMN-PLAN` + `DEV-EXEC` pair from v1.1 through v1.38 (36 `LOCKED`, 2 `SUPERSEDED`), against `DIR-INTENT-v2` ("Phase 1 Core Foundation", locked 2026-05-22, 33-day deadline of 23 June 2026, `CON-001` marked Non-negotiable).

**Output layer (0–50, per ARC Satisfaction Score Methodology)**: fully satisfied. The literal Phase 1 promise — validated satellite pipeline, 5 vegetation indices stored, 15-table schema, Manager login + estate map + time-series — was built and evidenced by ~26 May 2026, well inside the deadline (v1.1–v1.4).

**Process layer (50–100)**: severely compromised. The chain contains repeated, large-scale builds of categories `DIR-INTENT-v2` marks Non-negotiable / explicit Non-Goal / DEV-Must-Not:

| Violation | Stages | DIR-INTENT-v2 clause |
|---|---|---|
| Pixel-level raster/COG tile serving, premium timelapse | v1.6–v1.9, then v1.36–v1.38 (still the active edge) | §4.3/§9.3: no pixel-level raster visualization or COG tile rendering (Phase 2+) |
| Company branding/logo upload | v1.17, v1.23 | §9.3: explicit Phase 4 prohibition |
| Self-registration (company + individual) | v1.17, v1.20 | §4.3: explicit Non-Goal |
| Estate Change/lifecycle management (entire feature category) | v1.17, v1.23–v1.26 | Not present anywhere in v2's scope |
| Full admin/superadmin platform, subscriptions | v1.10–v1.13 | FMN's own Director Observation Log tags these "Mismatch With Intent" at the time |
| Infrastructure: entire stack on GCP, not IDCloudHost | v1.32, uncorrected through v1.38 | CON-007, Non-negotiable |
| Timeline | — | CON-001, "no extension discussed" — 48+ days over, chain still open |

**ARC's recorded evaluation**: Band `SATISFIED_NEEDS_REVIEW`, raw 55/100. Output is real and stands; process fidelity to the locked contract is badly compromised. No `DIR-INTENT-v3` was ever opened to formally capture the scope evolution — the ROADMAP's own narrative ("matured into a staged product-hardening program") is FMN's retroactive framing, not a Director-approved intent revision.

This evaluation was **not recorded** into the Sigma system (`sigma intent score` was not run) — the Director redirected the conversation into the governance-design discussion captured below before authorizing the commit.

---

## 2. Problem Diagnosis

The Director's core observation: Sigma's intent lifecycle (`DRAFT → LOCKED → SUPERSEDED`) conflates two structurally different situations under one penalty:

1. **Director changes their mind** (e.g., "single-estate" → "must be multi-tenant") — a genuine intent evolution. A new chain makes sense here.
2. **Director's own initial articulation was incomplete**, and the real requirement only became visible through implementation — e.g., Phase 1 was understood as a simple app, but once technical work progressed, the Director recognized the expanded output as what was actually wanted all along. This is closer to *"the initial intent was under-specified"* than *"the Director replaced the intent."*

Sigma currently treats `DIR-INTENT locked` as if it were absolute and complete truth about Director intent. The CanopySense case shows that assumption does not always hold — and a rigid model punishes case (2) exactly as harshly as case (1), which:

- Makes correcting an intent document *more expensive* than the deviation it would prevent (full re-interview + new document + AUD review + lock ceremony vs. a cheap `sigma plan new`).
- Creates a perverse incentive: the system built to protect intent integrity ends up making intent *too expensive to keep accurate*, so drift flows silently through PLAN cycles instead.
- Leaves no state between `LOCKED` (immutable forever) and `SUPERSEDED` (start over) for "the baseline still holds, but needs formal sharpening."

Cross-reference: this is a generalization of `ARC-RULE.md` §Petition/Admission Review's existing clarification-vs-change question, applied to the intent document itself rather than to a recorded score.

---

## 3. Proposed Model (final consensus after discussion)

### 3.1 Terminology: RATIFIED is doctrinal, not a new CLI state

Recommendation (ARC): do **not** rename the `LOCKED` state value in `progress-v<N>.json` or the CLI. `LOCKED` should keep its current, narrow, mechanical meaning: *this document's text is immutable and machine-enforced.* `RATIFIED` should be introduced as a **conceptual/doctrinal framing** in the rule documentation (`ARC-RULE.md`, `SIGMA_PROTOCOL.md`) that clarifies what `LOCKED` *means in governance terms* — a governing baseline that is binding, but has a lawful amendment path — without a breaking schema migration across every historical `progress-v<N>.json`.

> Working principle: *"Ratification establishes the governing intent; it does not make the intent immutable in the sense of forbidding all future correction — only in the sense of forbidding silent, unrecorded correction."*

### 3.2 Amendment mechanism

- An **Amendment** is a formal, append-only artifact that sharpens or refines the *effective* interpretation of a ratified intent, without editing the original locked document text.
- **Parties**: Director + ARC only. AUD is explicitly **not** part of the Amendment approval chain (see §3.6 below — this was debated and resolved during the discussion).
- Flow: `Director proposes → ARC interprets/challenges → Director decides → Amendment ratified`. ARC must record an independent classification judgment (Interpretive vs. Material — see §5), not simply transcribe the Director's framing.
- Amendments are versioned and attached to the baseline (e.g., `DIR-INTENT-v2` RATIFIED, with `Amendment A-001`, `A-002`, ... listed against it), not folded silently into the original text.

### 3.3 Non-retroactivity (load-bearing principle)

Amendments take effect from their own ratification timestamp forward. They must **never** rewrite the historical record:

> *"Execution may reveal information about intent, but execution may never amend intent implicitly."*

If `v1.0` forbade X, and `v1.6` built X, and the Director later ratifies an Amendment permitting X — the history still reads: `v1.0` forbade X → `v1.6` implemented X → mismatch recorded → Director clarified intent → Amendment effective from T. Past evaluations of v1.1–v1.6 remain mismatches at the time they occurred. This preserves the integrity of any evidence/score ARC has already produced.

### 3.4 Periodic Intent Re-evaluation (governance gate, not just an amendment trigger)

- A ratified intent must undergo a mandatory ARC re-evaluation after a defined execution interval (proposed default: every 10 `LOCKED` PLAN versions — configurable per project volatility, not a constitutional invariant).
- Mechanism: a **governance gate**, not an administrative courtesy — the next PLAN version cannot be created until the checkpoint's re-evaluation is recorded.
- **Verdict must be qualitative only** — `Still adequate` / `Amendment recommended` / `Material divergence — new Intent Version needed`. It must **not** be a numeric score. Numeric satisfaction scoring (0–100) stays exclusive to Closure Evaluation, to avoid reproducing the same Goodhart's-Law risk the existing Score Methodology already guards against ("retrospective only, never prospective").
- This closes a real blind spot: currently, Sigma only discovers drift at Closure Evaluation (as happened here, after 38 version slots). A periodic checkpoint catches divergence while it's still cheap to address.

### 3.5 Petition vs. Amendment — kept structurally separate

| Mechanism | Challenges |
|---|---|
| Petition (existing, `ARC-RULE.md` §Petition/Admission Review) | A recorded score/evaluation |
| Amendment (new) | The adequacy of the intent representation itself |

Explicit guardrail: a Petition must never become a backdoor to change intent in order to make a past score look better. Amendments do not rewrite historical verdicts (§3.3) — this is the enforcement mechanism for that guardrail.

### 3.6 AUD's role — explicitly excluded from the Amendment approval gate

This was debated and reversed during the discussion. AUD's initial position proposed a three-tier split (Interpretive → Director+ARC; Borderline/Material-risk → mandatory AUD clarity review; Material → new intent). AUD's **final position withdrew** the mandatory-AUD-for-borderline-amendments recommendation, reasoning:

- Amendment answers *"does this intent representation still reflect what the Director means?"* — a Director-ownership question. AUD's domain answers a different question: *"does execution comply with whatever intent is currently effective?"*
- Making AUD a gate on Amendments risks giving AUD implicit standing over whether a Director's intent change is *valid* — which conflicts with Director's sovereign ownership of intent, and blurs a role boundary that is otherwise clean in Sigma's three-layer model: *Director determines intent → ARC guards continuity and interpretation → AUD tests compliance against whatever intent is currently in effect.*
- If AUD could reject an Amendment, either the Director can override anyway (making the AUD gate meaningless) or the Director cannot (giving AUD de facto authority over Director's own intent) — neither fits Sigma's constitutional model.
- AUD retains a purely **advisory** channel: AUD may comment on the *consequences* of an amendment if the Director asks, via ordinary Sigma messaging — same as any other role-to-role advisory input — but has no approval, veto, or mandatory-review standing over Amendments.
- AUD's actual enforcement point moves downstream: once an Amendment is ratified and FMN drafts new PLANs against the updated effective intent, AUD evaluates *those PLANs/EXECs* for compliance as normal — that is where AUD's compliance-testing role naturally re-enters, without becoming a gatekeeper on intent itself.

ARC's counterpart guardrail (retained, not removed by dropping AUD): ARC must still explicitly state its own independent classification for every proposed Amendment — *"this still reads as consistent with the intent lineage"* or *"this reads as material; I do not recommend Amendment, a new Intent Version is needed"* — before the Director ratifies. This preserves ARC's "not a stenographer" discipline without introducing AUD as a second gate.

### 3.7 Visibility (implementation-level requirement, not a constitutional principle)

Invariant: *"Every active role must be able to determine the current effective intent and whether amendments exist without reconstructing the entire amendment history manually."* Concrete form deferred to implementation (e.g., a summary line in `sigma project status` / `sigma_get_state`: `DIR-INTENT-v2 (RATIFIED, 3 amendments, latest A-003, effective 2026-08-11)`).

---

## 4. Decided now (conceptual/design level) vs. deferred (implementation planning)

**Must be settled as design principles now:**

1. `RATIFIED` replaces the *functional* meaning of `LOCKED` as "governing baseline" — without necessarily requiring a CLI/schema rename (ARC's recommendation, §3.1).
2. Intent text remains immutable as a historical artifact.
3. Amendment is a formal change to *effective* intent, never an edit of the original locked text.
4. An Interpretive/Material boundary exists and gates which mechanism applies (definition still open — see §5).
5. Director + ARC are the only substantive parties to an Amendment; AUD is not a gate (§3.6).
6. Amendments never rewrite historical evidence or verdicts (§3.3).
7. Periodic Intent Re-evaluation is the mechanism for detecting divergence before closure (§3.4).
8. A Material change still requires a new Intent Version — Amendment is not a substitute for that.

**Deferred to implementation planning:**

- CLI commands (e.g., an `sigma intent amend` equivalent) and Amendment file format/storage location.
- Legacy migration procedure for intents locked under the old model (see §6 — explicitly *not* automatic).
- How periodic re-evaluation is enforced mechanically (which command blocks, how the N-version counter is computed, whether `SUPERSEDED` plan versions count toward the interval).
- How amendment/effective-intent state is surfaced to FMN/DEV at runtime (§3.7).

---

## 5. Open design question: the Materiality Boundary

Flagged by AUD as the most fundamental unresolved piece — more fundamental than the four governance questions above. "Intent may be amended" is not itself a workable rule without an operational test for *what* may be amended.

**Strong candidates for Material (→ new Intent Version, never Amendment):**
- Change to the core objective
- Change to the fundamental outcome
- Change in strategic direction
- Change in product/project identity
- A change that would void the contractual basis of most existing locked PLANs

**Strong candidates for Interpretive/Refinement (→ Amendment-eligible):**
- Clarification of an ambiguous clause
- Correction of a misformulated constraint
- Detail that could not have been known before execution began
- Refinement that narrows or sharpens scope without changing the objective

No operational test currently exists to classify cases that fall between these poles. This is the item the Sigma developer should treat as the design center of gravity — the rest of the mechanism (Amendment format, periodic re-evaluation, visibility) is comparatively mechanical once this boundary has a workable test.

---

## 6. Worked test case: CanopySense DIR-INTENT-v2 under the proposed model

Two points of explicit agreement reached during discussion:

1. **Legacy intents are not automatically migrated.** `DIR-INTENT-v2` was locked under the old model ("`LOCKED` = immutable, full stop"). Retroactively declaring it `RATIFIED` under a new rule set would be a governance retcon — unfair to a document created under different rules, and inconsistent with Sigma's own principle that governance changes must not silently rewrite governance history. Migration to the new model must be an explicit, Director-elected step (`Legacy Intent → Migration Review → RATIFIED under new governance`), never automatic.

2. **Even under the new model, CanopySense's drift still reads as Material, not Amendment-eligible**, by the candidate criteria in §5: the shift from "single-company internal demo" to "multi-tenant platform with admin governance, self-registration, and production raster serving" changes product/business identity and fundamental scope — squarely in the Material category both ARC and AUD independently arrived at. This means the new mechanism does **not** retroactively rescue or soften the Closure Evaluation score recorded in §1; it changes what happens for CanopySense's *next* intent decision, not the historical read of `DIR-INTENT-v2`.

The Director's own framing of the case, endorsed by AUD as the more neutral diagnosis: *"CanopySense shows that Sigma does not yet have a proportionate mechanism for handling divergence between a ratified intent and an evolving realization — not that DIR-INTENT-v2 was wrong."* Output was genuinely satisfied; process genuinely diverged from the locked baseline. Both are true at once, and the current lifecycle model has no state that expresses that combination cleanly.

---

## 7. Summary of roles in this discussion

- **Director**: raised the original tension (output satisfied vs. process non-compliant), proposed the constitutional/legislative framing (RATIFIED + Amendment + periodic interval), and made the final calls on AUD's role and on treating this as design material rather than an immediate implementation request.
- **ARC**: ran the Closure Evaluation that surfaced the gap; pushed back on parts of AUD's first draft (CLI rename cost, need for a qualitative-not-numeric periodic verdict, confirmation that CanopySense itself still reads as Material); retained the requirement that ARC state independent classification judgment on every Amendment.
- **AUD**: proposed the RATIFIED/Amendment/periodic-re-evaluation model, supplied the Interpretive-vs-Material framing and the Materiality Boundary candidates, and — after further discussion — withdrew its own initial proposal to require AUD review for borderline amendments, concluding AUD should have no approval standing over Amendments to keep Sigma's three-role boundary (Director owns intent / ARC guards continuity / AUD tests compliance) clean.
