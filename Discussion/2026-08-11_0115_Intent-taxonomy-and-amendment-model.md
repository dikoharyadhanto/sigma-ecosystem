# Intent Taxonomy & Amendment Model — Follow-On Design Discussion

> **Purpose**: Working notes for an in-progress design discussion between the Director, Claude (Professional Mode, sigma-cli developer), and AUD (ChatGPT, external second opinion). This is a **direct continuation** of `2026-08-11_0021_Intent-evaluation-sigma.md` — read that document first for full origin/context (the CanopySense Closure Evaluation, the original RATIFIED/Amendment/Materiality Boundary proposal). Nothing in this document is implemented yet. It records where that original proposal was revised, and what the Director has decided so far in this follow-on round.
>
> **Status**: Mid-discussion capture, requested by the Director to preserve state before continuing. Command specification referenced in §4 is still pending — Director has not yet explained it in full.

---

## 1. Why the original proposal changed

The original document (`2026-08-11_0021`) proposed `RATIFIED` as a doctrinal-only relabeling of `LOCKED`, plus a standalone, versioned `Amendment` artifact (A-001, A-002, ...), plus a `Materiality Boundary` test to classify any given change as Interpretive (Amendment-eligible) or Material (→ new Intent Version only, binary).

Claude drafted a first operational test for the Materiality Boundary (a 4-step decision procedure: Intent Core field touch → explicit Non-Goal reversal → cumulative identity test → retrospective compliance-flip check). AUD reviewed it and raised substantive objections — most importantly, that "which field was touched" is the wrong axis entirely, and that collapsing every change into a Material/Interpretive binary reintroduces exactly the rigidity the whole exercise exists to remove.

Mid-argument, the Director reframed the problem at a more fundamental level: **the DIR-INTENT template itself conflates two different kinds of commitment inside one document, locked at the same strength.** That reframe turned out to be the real unlock — see §2.

---

## 2. The actual root cause (converged diagnosis)

Not: "DIR-INTENT is too rigid" or "DIR-INTENT's scope is too narrow."

Actual diagnosis (Director + AUD + Claude converged): **DIR-INTENT mixes two authority classes into one document, and downstream roles read the whole document as uniformly binding.**

- **Sovereign / Durable Intent** — the Director's actual destination and value: broad objective, target beneficiary, desired outcome, primary value delivered. Meant to be stable for the life of the project.
- **Operationalization** — ARC's *current* translation of that destination into something FMN/DEV can execute against, given what's known *right now*: concrete outcome, success threshold, scope boundary (in/out/non-goals), constraints, functional requirements. Meant to evolve as understanding deepens — evolving it is not a violation of intent, it is the normal function of a working boundary getting sharper.

**Confirmed textually, not just theoretically**: `Sigma/templates/DIR-INTENT-TEMPLATE.md` §8 (Technical & Architecture Direction) already carries the exact framing needed — "Tech stack, architecture, and solution assumptions are auditable means — not sovereign intent" — but this framing was never generalized to §6 (Scope Boundary) or §9 (Functional Requirements), which is precisely where CanopySense's actual drift occurred (Non-Goals, unaddressed feature categories). `Sigma/rules/FMN-RULE.md:164` ("FMN is subordinate to locked `DIR-INTENT`") and `:37` ("FMN MUST NOT invent requirements beyond locked `DIR-INTENT`") confirm FMN currently reads the whole document flat, with no tier distinction at all.

This reframe resolves the earlier Materiality Boundary argument almost for free: instead of a fuzzy per-change narrative judgment ("does this change the destination?"), the boundary becomes structural — **if a proposed change does not touch a Sovereign section/item, it is Amendment-eligible by definition. If it does, it is a new Intent Version, full stop — no fuzzy middle tier needed.** This also resolves Claude's standing objection to AUD's earlier "three-tier / Material Amendment" proposal (§3.6 and §4.8 of the original document) — the objection was that a fuzzy Material-but-still-Amendment tier erodes AUD's standing and closure-baseline cleanliness; anchoring the boundary to a structural tier instead of a narrative judgment removes that fuzziness.

**Open sub-problem, not yet resolved**: tier assignment is likely needed at **item granularity, not section granularity** — e.g. within §6 Non-Goals, some individual items may genuinely be Sovereign-level (e.g. a jurisdiction/data-residency exclusion tied to a real value) while others are ARC's current best guess (e.g. "no raster tiles yet"). The existing §7 Constraints table already has the right *pattern* for this (per-row Binding Level: Non-negotiable / Conditional / Challengeable / Preference) — the working assumption is to extend that per-row pattern to §6 and §9 rather than inventing something new, but this has not been mapped out section-by-section yet.

---

## 2A. Governing Principle (Director-formulated)

The Director distilled the diagnosis in §2 into a single load-bearing doctrinal statement — this supersedes and sharpens the original document's §3.1 "Working principle" quote, and should be treated as the constitutional boundary for every subsequent Amendment/RATIFIED design decision:

> **Ratification establishes the governing Director intent. It does not freeze its operationalization. Operationalization may evolve through explicit Director-approved amendment without creating a new Intent Version, provided the sovereign/durable intent remains unchanged.**

And its counterpart, stated with equal weight — not a corollary added for symmetry, but an independent enforcement clause:

> **No operational amendment may be used to silently alter, bypass, or reinterpret the sovereign/durable intent.**

Both halves matter. The first clause is what makes Amendment legitimate at all — it authorizes evolution instead of forcing every refinement through a full new Intent Version. The second clause is what keeps that permission from becoming the exact loophole the whole model exists to close: an Amendment is only ever a *legitimate* mechanism to the extent it cannot be used, deliberately or by drift, as a side door into changing what §2A's first clause puts out of its reach. Every open item in §4 — who may authorize a revision, item-level tagging, cumulative-drift detection — is downstream implementation detail in service of making this second clause actually enforceable in practice, not just true on paper.

---

## 3. Decisions made by the Director in this round

These are explicit, Director-confirmed decisions — not proposals still up for debate:

1. **`LOCKED` → `RATIFIED`, scoped to DIR-INTENT only.** Every other artifact (ROADMAP, FMN-PLAN, DEV-EXEC, DIR-CLOSE) keeps `LOCKED` unchanged. New DIR-INTENT state machine: `DRAFT → RATIFIED → INACTIVE → SUPERSEDED` (unchanged transition logic otherwise — only the `LOCKED` label at that position is renamed).
   - Note: this explicitly **reverses** the original document's §3.1 recommendation, which argued for keeping `RATIFIED` doctrinal-only (rule-doc framing) specifically to avoid a schema migration across every historical `progress-v<N>.json`. The Director was told this consequence directly and chose to proceed anyway. Scope of the rename was narrowed to DIR-INTENT-only precisely to bound that migration cost (Director's explicit choice between two options presented).
   - **Cross-document clarity (AUD second-pass finding, withdrawn as an open issue but kept as a documentation note)**: this rename does **not** change `INACTIVE`/`SUPERSEDED` transition semantics. Those are pre-existing, already defined in `SIGMA_PROTOCOL.md` §5.1 ("`INACTIVE` — Displaced by a newer LOCKED intent; not cancelled, just not the current focus... never implies cancellation and never triggers a cascade") and untouched by this discussion — only the `LOCKED` label at the `RATIFIED` position is renamed, nothing about what happens before/after it. AUD's initial audit flagged this as an open question because its evidence package was limited to this discussion file alone, without `SIGMA_PROTOCOL.md` for cross-reference; once shown that citation, AUD withdrew the finding.
2. **Amendment can never touch a Sovereign/durable section.** It applies exclusively to Operationalization-tier content. A change that requires touching Sovereign content is never an Amendment — it is a new Intent Version.
3. **Amendment mechanism simplified from the original "standalone versioned artifact" (A-001, A-002, ...) model** to: a new **Section 14 — Amendment History** inside the DIR-INTENT document itself (proposed placement: after the existing Section 13 Final Validation Checklist), recording a changelog — date, which section/item changed, summary of the change, and a reference to the command that certified it. The actual content edit happens in place, directly in the relevant Operationalization section — consistent with the project's existing principle that `RATIFIED`/`LOCKED` governs the document's binding force, not literal textual immutability for in-place edits (see prior project memory: "LOCKED ≠ immutable").
4. **One new CLI command**, `sigma intent amendment --change "..."`, responsible for three things:
   - Certifying/stamping that a given Amendment has taken effect.
   - Recording the action to a new log file, `intent_amendment.log`.
   - Gated as Approval-class — requires explicit Director authorization before it runs (same authorization-language discipline already used for `intent lock`/`close lock`/`intent score`).

   **Render mechanics — confirmed to mirror `sigma roadmap render` exactly**, grounded in the real implementation (`src/utils/roadmap.ts`), not a new pattern:
   - The command writes a new structured entry to a new `chain.intent.amendments[]` array in `progress-v<N>.json` — this array is the render source, exactly parallel to how `chain.plan.versions[]` is the source `generateStageOverview()` reads to build ROADMAP's Stage Overview table.
   - `intent_amendment.log` plays the same role `Sigma/logs/operations.jsonl` plays elsewhere: an append-only audit trail, never itself the render source.
   - The command then regenerates only the content between a new delimiter pair — `<!-- SIGMA:RENDER:START:amendment-history -->` / `<!-- SIGMA:RENDER:END:amendment-history -->` — inside DIR-INTENT.md, via `replaceSection()`-equivalent logic. Everything else in the document (all Director/ARC-authored prose in other sections) is left untouched, exactly as `renderRoadmapFile()` leaves the rest of ROADMAP.md untouched.
   - Each amendment record: `{ id, created_at, change, director_approved_at }`. `created_at` is captured automatically at command execution time (`new Date().toISOString()`), matching the existing `created_at`/`locked_at` convention already used everywhere in `chain.ts` — the Director never types a timestamp manually.
   - **ID convention**: `AMD-001`, `AMD-002`, `AMD-003`, ... — zero-padded, matching the `PREFIX-NNN` pattern already established for every other formal identifier in the DIR-INTENT template (`REQ-001`, `CON-001`, `ASM-001`, `RR-001`). Chosen over a plain "Amendment 1/2/3" label for consistency with existing formal-identifier convention (`SIGMA_PROTOCOL.md` §16: formal identifiers stay in English/fixed format regardless of interaction language).
   - **Section 14 (Amendment History) placement**: confirmed as the **last section** of the DIR-INTENT document — it is a running record of what changed, so it belongs after everything else, not interleaved with the substantive content it documents changes to.
   - **`--change` is single free-text, git-commit-message style — no separate `--section`/`section_ref` flag.** Decided against a structured section reference: nothing in this command reads an actual diff of the document (unlike git), so a `--section` flag would be unenforced, unverified metadata with the *appearance* of rigor rather than real rigor. Section 14's table is three columns only: `| Amendment | Date | Change |`. If the Operationalization section/item touched matters for the reader, it belongs inside the `--change` text itself (e.g. `"§6.3 Non-Goals: removed prohibition on COG rendering — Director determined this is part of intended realization, not scope creep."`), not a separate structured field.
   - **Real enforcement of §2A's second clause (no silent Sovereign reinterpretation via Amendment) is two gates in sequence, not Director approval alone** (tightened after AUD second-pass review — the original wording here undersold the first gate, which §5.2 already established separately): **(1) ARC's independent classification** — Operationalization vs Sovereign — is a prerequisite for every amendment regardless of who originates it, before Director ever sees a `--change` to authorize (see §5.2); **(2) Director's explicit authorization** of the command itself, using the same commit-specific authorization-language discipline already used elsewhere in Sigma (`intent score` commit-language requirement, `SKIP_FOR_AUDIT` verbatim-instruction requirement). Neither gate substitutes for the other — ARC classifying something as Amendment-eligible does not itself make it effective, and Director authorizing a command does not itself establish that the underlying change was correctly classified.
   - **Effective-state semantics — still open, tracked in §4.** What "effective" means for an in-place Operationalization edit before/after the certifying command runs is not yet fully specified — see §4.

---

## 4. Explicitly open / not yet decided

Resolved since the last pass and removed from this list: exact command name (`sigma intent amendment`, settled — §3 item 4), whether the command updates `progress-v<N>.json` (yes, `chain.intent.amendments[]` — §3 item 4), and who may authorize an Operationalization revision (Director + ARC, with FMN able to request — fully specified in §5).

- **Effective-state semantics when an in-place edit precedes certification.** Raised by AUD second-pass review, and this is now judged the more important of the two framings that were discussed (superseding Claude's earlier "no gap between edit and certification" framing, which AUD correctly noted depends on human/AI behavioral discipline rather than a real guarantee). The invariant needed is stronger and system-level, not procedural: **effective-state consumers (FMN, DEV, any role reading DIR-INTENT) must resolve current Operationalization from the last *ratified* amendment state, not merely the latest filesystem text.** Concretely, this likely needs structured metadata — e.g. an `effective_amendment` pointer on the chain's intent state in `progress-v<N>.json` — such that a section whose filesystem text has been edited but has no corresponding ratified `AMD-NNN` yet is treated by every role as *proposed/unratified working state*, never as current effective Operationalization, regardless of what the `.md` file currently shows. Left open deliberately until the command spec (§3 item 4) is finalized — this is where it should be resolved, not before.
- **Item-level (not just section-level) Sovereign/Operationalization tagging**, extending the existing §7 Binding Level pattern to §6 (Scope Boundary) and §9 (Functional Requirements) — still not mapped, and confirmed by both Claude and AUD as a major open design item, not a minor implementation detail: the whole model rests on Amendment being confined to Operationalization, which is unusable in practice without a way for ARC/FMN to know which items qualify. Explicit guardrail carried forward from AUD: this taxonomy must live in the template/rule docs as human/AI-interpretable classification — do not jump to building a CLI semantic validator for it prematurely.
- **`FMN-RULE.md` rewrite** to replace the current flat "FMN is subordinate to locked DIR-INTENT" framing with tier-aware guidance — not yet drafted.
- **Periodic Intent Re-evaluation**, reframed from "is Amendment needed?" to "does current Operationalization still represent the underlying Sovereign intent well?" with three outcomes (Still valid / Needs refinement / Material destination change → new Intent Version). Now has a concrete evidence basis, per AUD second-pass review: three sources feed this review rather than re-reading full project history from scratch — **(1)** DIR-INTENT Section 14 Amendment History, **(2)** FMN-PLAN Protocol Overrides & Expansions entries (§5.1), and **(3)** the accumulated `NOTED` deviations specifically (§5.1) as the raw material for spotting cumulative drift before it needs escalation. Mechanism for actually detecting cumulative drift from these three sources is still unresolved — Claude's earlier suggestion (an ARC-maintained, diffable "current one-paragraph project description" as a non-formulaic anchor for judgment) has not been adopted or rejected yet.
- **Legacy migration** for intents already `LOCKED` under the old, undifferentiated model (e.g. CanopySense's `DIR-INTENT-v2`) — the original document's principle (no automatic migration, explicit Director-elected `Legacy Intent → Migration Review → RATIFIED` step) has not been revisited against the new Sovereign/Operationalization taxonomy specifically. Both Claude and AUD agree this does not need resolving now, only that no future implementation plan should assume migration behavior without an explicit decision.

---

## 5. Amendment Request Mechanism (FMN → ARC)

Who may *request* an Amendment (distinct from who may *approve/execute* one — that remains Director + ARC only, per §3 item 2 and the original document's §3.2, unchanged): **Director, ARC itself, and FMN.** FMN's path exists for the case where, during BUILD, FMN determines DIR-INTENT itself (not just FMN-PLAN) needs correction to accommodate the Director's evolving realization of intent — not a request to relax a PLAN-level detail, which stays inside ordinary FMN-PLAN revision.

### 5.1 Prior-art collision, must be resolved — Protocol Overrides & Expansions

`FMN-RULE.md` (§FMN-PLAN Creation Rules, lines ~256–261) already has a mechanism for "FMN needs to build outside DIR-INTENT scope": FMN-PLAN Section 5, **Protocol Overrides & Expansions** — "FMN MUST fill... whenever a plan introduces work outside the scope originally bounded by DIR-INTENT... each entry must record the item, justification, **who approved it**, and the date."

This is almost certainly the actual mechanical pathway that let CanopySense drift undetected for 38 versions: each override was recorded and locally justified per-PLAN, but never rolled up or traced back to DIR-INTENT itself — there was nothing forcing an aggregate view across the whole chain until Closure Evaluation caught it, 48 days late.

**Decision direction (not yet written into the rule files)**: Protocol Overrides & Expansions is not replaced, but must be wired to the new Amendment Request mechanism going forward — an override entry significant enough to need a "who approved it" field should cite a real `AMD-NNN` from DIR-INTENT Section 14, not stand as a freestanding local note with no upward trace. This also gives the still-open Periodic Re-evaluation gate (§4) concrete material to check: AMD-NNN entries plus Protocol Overrides entries together are exactly what cumulative-drift detection should be reading.

**Table redesigned (confirmed by Director).** Current `FMN-PLAN-TEMPLATE.md:77-79` table is `| Item | Justification | Approved By | Date |`. `Approved By` and `Date` are dropped; replaced with `Status` and `Notes`:

| Item | Justification | Status | Notes |
| :--- | :--- | :--- | :--- |
| [...] | [...] | NOTED / AMENDMENT_REQUESTED / AMENDMENT_RATIFIED | [...] |

Status vocabulary — deliberately **not** "every override needs an Amendment" (that would reintroduce exactly the heavyweight-process cost this whole model exists to avoid; `ARC-RULE.md`'s own doctrine already warns against expanding Sigma into a heavyweight process):

- `NOTED` — default/common case. **Refined per AUD second-pass review**: `NOTED` means the deviation and its rationale are recorded — it does **not** mean FMN has determined the deviation is harmless to DIR-INTENT. FMN records a fact; it does not get to close the question of intent impact by choosing this status. That determination is deferred to Periodic ARC Re-evaluation (§4), which reads accumulated `NOTED` entries across the chain as raw evidence for cumulative drift. This matters specifically because FMN is the role that, per the CanopySense diagnosis (§2), previously misread Operationalization as immutable law — it should not now unilaterally acquire the opposite failure mode of deciding unilaterally what doesn't matter.
- `AMENDMENT_REQUESTED` — escalated via §5's Amendment Request mechanism; outcome not yet final as of this PLAN's lock.
- `AMENDMENT_RATIFIED` — a real `AMD-NNN` already exists and covers this override before the PLAN locks; cite the ID in Notes.

**Immutability constraint, and why it's acceptable**: Protocol Overrides & Expansions is FMN-PLAN Section 5, one of the pre-build sections that is immutable after lock — so `Status` is a **snapshot as of lock time**, not a continuously-updated field. If an override's status changes after this PLAN is already locked (e.g. `NOTED` → later escalated → `AMENDMENT_RATIFIED`), that later table can't be edited retroactively; the live, authoritative record of amendments remains DIR-INTENT Section 14, not any individual FMN-PLAN. Director's framing, worth keeping verbatim: **this is simply the relationship between a work contract (FMN-PLAN — point-in-time, immutable once locked) and a design document (DIR-INTENT — living, the actual source of truth)** — the snapshot nature of Section 5 is not a flaw to fix, it correctly reflects what kind of artifact FMN-PLAN is.

### 5.2 Division of labor

**ARC's independent classification is a prerequisite for every amendment, regardless of who originates it** — not only FMN-initiated requests. This was strengthened after AUD's second-pass review flagged a real blind spot in the earlier framing: if only the FMN→ARC path required ARC classification, Director-originated or ARC-originated amendment proposals could skip that independent check entirely, meaning Director could in principle route an actual Sovereign change through the lighter Amendment path with no independent classification at all. The same doctrine already established for Petition applies here without modification: *"ARC does not represent Director-today; ARC represents the Director who locked/ratified DIR-INTENT."* Authority to decide destination and independent responsibility for interpreting whether a given change stays within that destination are two different things — Director retains the former unconditionally; ARC's classification role exists precisely so the latter is never skipped, including when Director is the one proposing.

```text
                Proposed Amendment
                       │
             ┌─────────┴─────────┐
             │                   │
           FMN                Director
        (or ARC itself)          │
             │                   │
             └─────────┬─────────┘
                       ▼
                      ARC
                       │
                classification
                       │
              ┌────────┴────────┐
              │                 │
        Operationalization   Sovereign
              │                 │
              ▼                 ▼
         Amendment-eligible   New Intent
              │
              ▼
        Director authorizes
              │
              ▼
       sigma intent amendment
              │
              ▼
        AMD-NNN effective
```

- **FMN** (when it is the originator) states *what* section/area of DIR-INTENT needs amending and *why* (rationale/evidence) — nothing more. FMN does not draft the amendment text itself.
- **ARC classifies and advises — ARC does not "approve."** This precise verb distinction matters (AUD second-pass refinement): ARC's output is a classification judgment — "this reads as Operationalization" or "this reads as Sovereign, not Amendment-eligible" — never an approval verdict. Calling it "approval" would imply ARC holds authority over Director's intent, which contradicts Sigma's constitutional model everywhere else (see original document §3.6). ARC drafts the actual `--change` content once classified as proceeding, mirroring the existing "ARC is not a stenographer" discipline already established for Petition and the AUD Findings section — ARC must not simply transcribe the originator's framing as-is, even when the originator is Director.
- **Director authorizes** — the verb for Director's action is "authorize," not "approve ARC's approval": Director authorizes the amendment to become effective, at two separate points (see §5.3), and is the only party who can run `sigma intent amendment`.

### 5.3 FMN's gate — informal, conversational, not a separate CLI mechanism

Director's explicit clarification: FMN needs Director's permission before sending the Amendment Request to ARC, but this permission is granted **through ordinary conversational Approval-class authorization** (e.g. Director saying "go ahead, send it" in a chat/session) — **not** a dedicated CLI command or a formal structured gate. This is consistent with how Sigma already handles most Approval-class authorization elsewhere (plain-language Director confirmation, not always a distinct command). So there are two Director touchpoints in the full flow, of different weight:

1. **Informal** — Director's conversational go-ahead before FMN sends the `sigma send` request to ARC at all.
2. **Formal, CLI-gated** — Director's explicit authorization before `sigma intent amendment` actually runs (already established in §3 item 4).

### 5.4 Message shape

Mirrors the existing Petition Message Parameters (`ARC-RULE.md` §Petition/Admission Review) exactly, same rationale for `--type QUESTION` (FMN is asking ARC to decide something, not reporting status):

```bash
sigma send --from fmn --to arc --type QUESTION --action RESPOND \
  --subject "Amendment Request: <section/topic>" \
  --message "<which DIR-INTENT section needs amending, and why>"
```

### 5.5 Non-retroactivity applies here too, explicitly

If FMN requests an Amendment *after* already having built the out-of-scope work (rather than before), the request is still evaluated the same way, but ARC must state explicitly that a ratified Amendment only takes effect from its ratification date forward (§2A / original document §3.3) — it does **not** retroactively clean the historical evaluation of the work already built ahead of it. This exists to prevent "build first, request Amendment if caught" from becoming a viable strategy.

### 5.6 Structural placement — not yet written

This should become its own new subsection in `ARC-RULE.md` (tentatively "§Amendment Request"), placed near but structurally separate from §Petition/Admission Review — consistent with the original document's §3.5, which already established Petition and Amendment as deliberately separate mechanisms answering different questions. `FMN-RULE.md`'s escalation clause (line 317, "If strategic ambiguity prevents build planning, FMN must escalate to ARC or Director") and the Protocol Overrides & Expansions clause (lines 256–261) both need updating to reference this mechanism explicitly, matching how line 323 already explicitly names the Petition path for score disagreements. **Not yet applied to the actual rule files** — recorded here as the agreed direction first.

---

## 6. Audit Resolution (AUD second-pass review)

AUD (ChatGPT, external second opinion) ran a full audit against this document's decisions as of the round captured in §1–§5, verdict **REVISE**. After Claude's response — which accepted two documentation inconsistencies as real bugs, accepted the effective-state timing risk as substantive, extended ARC classification to all amendment origins, refined the `NOTED` semantics, and produced textual evidence from `SIGMA_PROTOCOL.md` §5.1 that AUD's own evidence package (this discussion file alone) did not include — AUD reviewed the response and updated its verdict.

**Withdrawn**: the `INACTIVE` semantics finding (§3 item 1 note above) — AUD confirmed Claude's citation resolves it as pre-existing, unchanged behavior, not a gap introduced by this redesign.

**Accepted as resolved, not just addressed**:

- Sovereign vs Operationalization split, and `RATIFIED` semantics generally.
- Amendment confined to Operationalization only.
- Director authorization requirement.
- ARC's independent classification, now confirmed required for every amendment origin (FMN, ARC, and Director), not FMN-originated requests only (§5.2).
- FMN request pathway (§5).
- `NOTED` as recording without a harmlessness claim (§5.1).
- Non-retroactivity (§5.5).
- Amendment History as a projection over structured state, with `progress-v<N>.json` and `intent_amendment.log` playing distinct, non-overlapping roles (§3 item 4).
- Periodic review reframed as a health check, not an amendment-generating cadence.

**Confirmed still open** (unchanged from §4, now with AUD's explicit concurrence): item-level Sovereign/Operationalization taxonomy; effective-state semantics for an in-place edit before certification; legacy migration behavior.

**AUD's updated verdict**: `PASS_WITH_RISK` for the overall design direction; `REVISE` still stands for treating this document, as currently written, as a sufficient basis for an implementation plan — the item-level taxonomy and effective-state semantics items in §4 are the two AUD considers blocking, not merely nice-to-have, before implementation planning begins.

AUD's closing framing of the model, worth preserving verbatim as it crisply states what this whole discussion converged on:

> *"Director owns the destination. ARC owns the integrity of its interpretation. FMN owns the current work contract. DEV owns execution. Amendment is a mechanism to update interpretation, not a mechanism to change destination silently."*

---

## 7. Relationship to the original document

Read together with `2026-08-11_0021_Intent-evaluation-sigma.md`:

- §1–2 of that document (CanopySense origin, problem diagnosis) still stand as-is.
- §3 (Proposed Model) is **superseded in part** by this document: §3.1 (RATIFIED as doctrinal-only, no schema rename) is reversed per §3 item 1 above; §3.2 (Amendment as standalone versioned artifact) is superseded by §3 item 3 above; §3.5/§3.6 (Petition vs Amendment separation, AUD excluded from Amendment gate) still stand, not revisited in this round.
- §5 (Materiality Boundary as an open question) is **effectively resolved differently than either candidate list originally framed it** — see §2 of this document. The "operational test" is no longer a multi-factor judgment call; it collapses to a structural tier check, with the remaining open work being *where the tier line is drawn per item*, not *how to judge materiality per change*.
- §6 (CanopySense worked test case) is unaffected — still reads as Material either way, since the drift touched what would clearly be Sovereign-tier content (product identity, target scope) regardless of which model is applied.

This document should be treated as the current source of truth for the Amendment/RATIFIED design direction going forward; where it conflicts with `2026-08-11_0021`, this document wins.
