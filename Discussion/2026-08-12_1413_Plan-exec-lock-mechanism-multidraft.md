# FMN-PLAN & DEV-EXEC Lock Mechanism — Multi-Draft Handling Design

> **Purpose**: Design discussion between the Director and Claude (Professional Mode, sigma-cli developer) on how `sigma plan lock` / `sigma exec new` / `sigma exec lock` should behave when more than one draft artifact exists at once. Triggered by the Director asking how the current system handles two concrete multi-draft scenarios, discovering a real limitation, then proposing a redesign. Nothing in this document is implemented yet.
>
> **Separately noted, explicitly deferred**: while studying FMN-PLAN/DEV-EXEC mechanics for this discussion, a documentation-drift issue was found — `SIGMA_PROTOCOL.md` §5.2/§5.3 (artifact definition tables for FMN-PLAN and DEV-EXEC) are stale relative to the actual current templates (undercounts FMN-PLAN's sections, wrongly claims full post-lock immutability, and DEV-EXEC's section/ownership numbering in the protocol doesn't match the real 17-section template at all — e.g. it claims an "AUD (Section 14)" that doesn't exist in the current template). The Director asked for this to be recorded for later, not addressed now — it is unrelated to the lock-mechanism topic below.

---

## 1. Current system behavior (verified against source, not assumed)

Verified directly against `src/engine/chain.ts`, `src/commands/plan.ts`, `src/commands/exec.ts` — not inferred from rule docs, which describe discipline/intent but not always exact CLI mechanics.

### 1.1 `sigma plan new` / `sigma plan promote`

No guard prevents creating multiple DRAFT FMN-PLANs. Each call pushes a new entry to `chain.plan.versions[]` and points `chain.plan.active_version` at the newest one — `active_version` is a display pointer only, not a lock target.

### 1.2 `sigma plan lock` — FIFO, no version targeting

`lockOldestPlanDraft()` filters all `DRAFT` plans, sorts by `created_at` ascending, and always locks the **oldest**. The `plan lock` command has no `--v` option at all. `sigma plan activate --v <version>` only changes `active_version` for display — its own description says explicitly: *"for display/status only; lock order remains FIFO."* There is no way to lock a specific non-oldest DRAFT plan directly, and no way to discard/drop a DRAFT plan (`plan supersede` only accepts `LOCKED` targets).

### 1.3 `sigma exec new` — plan selection already exists, exec-concurrency does not

Two separate mechanisms, easy to conflate (see §3 below — this was a real point of confusion resolved mid-discussion):

- **Plan-reference selection (`--plan`, already implemented)**: `exec new` computes `unexecutedPlans` — `LOCKED` plans with no corresponding `LOCKED` exec. Zero candidates → error directing to `plan new`. Exactly one → auto-resolved silently. More than one → **rejected**, with an error listing every candidate version and instructing `--plan <version>`. This already does exactly what the Director asked for in §4 of this document, for plan selection specifically — no new work needed here.
- **Chain-wide single-draft guard (the actual limitation)**: before any plan-selection logic runs, `exec new` checks `chain.exec.versions` for **any** entry not in a final state (`LOCKED`/`SUPERSEDED`) — regardless of which plan it references — and refuses outright:

  ```text
  EXEC CONFLICT: DEV-EXEC {version} is in {state} state.
  Lock it before creating a new exec: sigma exec lock
  ```

  This blocks concurrent DRAFT execs entirely, even against two different `LOCKED` plans.

### 1.4 `sigma exec lock` — no version targeting

`lockActiveExec()` always operates on `chain.exec.active_version`, whichever was most recently registered by `exec new`. No `--v` option exists.

### 1.5 The gap this surfaced

Traced against a concrete scenario (PLAN A locked → EXEC A drafted, incomplete → PLAN B created and locked → attempt to create EXEC B): steps up to creating EXEC B all succeed (`plan new`/`plan lock` never check exec state). Creating EXEC B is where it breaks — blocked by §1.3's chain-wide guard, regardless of EXEC B referencing a different plan than EXEC A. **There is currently no way to pause an incomplete DRAFT exec, work on a different locked plan's exec, and return to the first one later.** The system enforces strict single-exec-in-flight discipline chain-wide, not per-plan. This is the limitation the Director's redesign (§2 below) directly addresses.

---

## 2. Director's proposed redesign

### 2.1 `plan lock` — remove FIFO, require `--v` when ambiguous

- Drop automatic oldest-first locking.
- If exactly one `DRAFT` plan exists, `plan lock` (no args) still works — unambiguous, no friction added.
- If more than one `DRAFT` plan exists, `plan lock` without `--v` is **rejected**, with an error listing every lockable version — mirroring `exec new`'s existing "more than one candidate → list + require explicit flag" pattern exactly (see §1.3 and §3).
- If zero `DRAFT` plans exist, an explicit "nothing lockable" message, rather than a generic/silent failure.

Motivation, confirmed during discussion: FIFO currently has no escape hatch. If PLAN v1.5 is stale/deprioritized and the Director wants to move straight to v1.6, there is today no way to do that without locking v1.5 first — `plan supersede` only accepts already-`LOCKED` targets, so a `DRAFT` plan can't be skipped or discarded. Removing FIFO in favor of explicit `--v` selection resolves this directly.

### 2.2 `exec new` — narrow the guard to per-PLAN, per Director's explicit confirmation

**Resolved, no longer a refinement pending confirmation.** The Director confirmed directly: *"tidak ada kepentingan satu plan punya lebih dari satu exec... lebih baik sistemnya append ke dalam satu exec"* — there is no legitimate case for one PLAN to have more than one EXEC in flight. Reasons stated: pairing stays traceable, no two EXECs can attempt to realize the same PLAN contract with divergent state, unfinished work continues in the *same* EXEC rather than spawning a new one, and history stays append-only (matches Sigma's existing versioning philosophy elsewhere: a new artifact version represents a genuinely new contract, not every iteration of work on an existing one).

**Formal cardinality invariant** (Director's decision, formalized during AUD's review — this is the governing rule going forward):

> **At most one non-final DEV-EXEC may reference a given LOCKED FMN-PLAN. The next EXEC is never an alternative to an existing one — unfinished work continues by appending to the same EXEC, not by creating a new one.**

Concurrency exists **across** PLAN workstreams, never as branching **within** one PLAN's execution lineage:

```text
PLAN A ────── EXEC A            PLAN A ──┬── EXEC A1
                  │                       └── EXEC A2   ← NOT ALLOWED
                  ├── draft progress
                  ├── correction
                  ├── additional evidence
                  └── final lock

PLAN B ────── EXEC B  (independent, concurrent workstream — allowed)
```

Guard behavior for `exec new --plan <X>`: if PLAN X already has a non-final EXEC, refuse and point at it rather than a generic conflict message — e.g. `EXEC CONFLICT: FMN-PLAN v1.6 already has DEV-EXEC v1.6 in DRAFT state. Continue that EXEC instead.` If PLAN X has none, proceed normally. This makes the guard strictly per-plan instead of chain-wide, without permitting branching.

**"Continuing" an existing DRAFT EXEC needs no new CLI surface** (closing the one point AUD left open): there is no separate "resume" command. Continuation is simply reopening and editing the same DRAFT EXEC markdown file in a later session — the file and its `DRAFT` registration already are the continuation point. The only two things that actually need to work are (a) `exec new --plan X` correctly refusing and redirecting when X already has an open EXEC (above), and (b) reorienting to a parked EXEC via explicit `--v` on `exec check`/`exec status` (§4.1) when `active_version` currently points elsewhere. No third mechanism is required.

### 2.3 `exec lock` — add `--v`, same disambiguation pattern as `plan lock`

Once concurrent `DRAFT` execs are possible (§2.2), `exec lock` needs the same treatment as §2.1: unambiguous case (one `DRAFT` exec) locks with no args; ambiguous case (more than one) rejected with an error listing lockable versions and requiring `--v`; zero case gets an explicit "nothing lockable" message.

### 2.4 Chain scoping — already inherent, not new work

The Director added: lock-candidate visibility should only ever show the single active chain, never across chains. Confirmed this requires no new mechanism — every command already operates through `readActiveChain()`, which resolves to exactly one `progress-v<N>.json` via `activate_status.json`. Cross-chain lock listing was never possible and isn't being introduced by this redesign.

---

## 3. Resolved mid-discussion: `exec new --plan` already implements part of this

The Director's initial framing of the `exec new` requirement ("exec new menolak membuat exec baru jika terdeteksi ada FMN-PLAN locked yang tidak punya pasangan exec lebih dari satu... akan menampilkan daftar versi yang bisa dibuat") is **already fully implemented**, verbatim, as `--plan` (§1.3) — not `--v`. Clarified why the flag name differs: at `exec new` time, the EXEC's own version doesn't exist yet (it's computed automatically via `nextExecVersion()` from the referenced plan's major version) — what needs disambiguating is *which locked PLAN* the new exec references, not *which exec version* to act on. `--v` is the right name for `plan lock`/`exec lock` (selecting among existing artifact versions); `--plan` is the right name for `exec new` (selecting a reference for something not yet created). No redesign needed for this specific piece — only confirmation that it already satisfies the requirement.

Division of remaining work, restated cleanly:

| Command | Disambiguates | Status |
| :--- | :--- | :--- |
| `plan lock --v` | Which DRAFT plan to lock | New — §2.1 |
| `exec new --plan` | Which LOCKED plan a new exec references | **Already implemented** |
| `exec new` guard | Whether PLAN X already has a non-final EXEC (per-PLAN, not chain-wide) | New — §2.2, confirmed cardinality invariant |
| `exec lock --v` | Which DRAFT exec (among concurrent ones) to lock | New — §2.3 |

---

## 4. Claude's assessment

Overall view: this is a good direction, not a novel pattern — it extends conventions the codebase already established elsewhere (`plan check --v`/`exec check --v` already accept an explicit version override today; `exec new --plan` already implements exactly the "auto-resolve at one candidate, force explicit choice with a listed set otherwise" behavior being proposed for `plan lock`/`exec lock`). Adopting it makes the CLI's ambiguity-handling philosophy consistent across all four commands instead of having FIFO as a one-off special case.

### 4.1 Governing principle: `active_version` is presentation state, never selection authority

Generalized during AUD's audit from a narrower, exec-only observation (`registerExecDraft()` unconditionally overwrites `chain.exec.active_version` to the newest exec on every call) into a system-wide principle, because the same risk applies to `plan.active_version` too — nothing about it is exec-specific. Stated formally:

> **`active_version` is presentation state. It may serve as an implicit default only when exactly one non-final candidate exists. The moment more than one exists, no command may treat it as if it uniquely identified "the" current work state.**

This is not a new pattern — `plan supersede --v` and `intent supersede --v` already never rely on `active_version` at all; they always require an explicit version. This principle extends that existing discipline to `plan lock`, `exec lock`, and `exec new`, rather than introducing something foreign.

**Two different enforcement strengths, by command class** (Claude's refinement to AUD's blanket "must always surface ambiguity" framing):

- **State-mutating / consequential commands** (`lock`, `supersede`, `discard` — see §4.4): **hard block**. Refuse to proceed without explicit `--v` the moment more than one non-final candidate exists. Already the plan for `plan lock`/`exec lock` (§2.1/§2.3).
- **Read-only inspection commands** (`status`, `check`): **soft warn, don't block**. Still default to `active_version` when no `--v` is given, but print a visible banner when other non-final candidates exist — e.g. *"2 other DRAFT versions also open: v1.5, v1.7 — run `exec list`/`plan queue`, or pass `--v` to inspect one directly."* Forcing `--v` on every inspection of an ambiguous chain adds friction to something that changes nothing — inconsistent with Sigma's standing preference to avoid unnecessary ceremony. A loud, honest warning closes the actual risk (a role being misled by a single silent pointer) without that cost.

**Pre-implementation requirement, not yet done** (AUD's point, adopted as-is): before this reaches an implementation plan, every consumer of `plan.active_version`/`exec.active_version` in the codebase needs to be inventoried (not just `status`/`check`/`lock`) — fixing one call site while others still silently trust `active_version` only relocates the bug.

### 4.2 Stale DRAFT plans — elevated from open question to a real design gap

Removing FIFO (§2.1) creates a new problem if left unaddressed: a `DRAFT` plan the Director no longer wants (e.g. deprioritized `v1.5`) can't be locked (not wanted) and can't be superseded (`plan supersede` only accepts `LOCKED` targets) — it would sit forever with no legitimate exit, accumulating clutter exactly because FIFO no longer forces it toward resolution.

**Proposed direction**: a distinct verb, not an extension of `supersede`'s existing meaning. `supersede` already carries a specific meaning in this system — retiring something that *was* authoritative (`LOCKED`). A `DRAFT` was never authoritative, so folding "abandon a draft" into the same verb would blur that distinction. Proposed instead: **`plan discard`** (or `plan withdraw`) as a separate command/state exit, scoped to `DRAFT` only, terminal, distinct from `SUPERSEDED`. Not yet designed in detail — naming, exact terminal state, and whether an equivalent is needed for `DRAFT` `DEV-EXEC` are all open (see §5).

### 4.3 Downstream rule-doc consequence — behavioral, not just syntactic

`FMN-RULE.md` and `DEV-RULE.md` (§Role Activation) currently tell FMN/DEV to use "the active locked `DIR-INTENT`... the locked `FMN-PLAN` selected by Sigma runtime" — language that assumes a single, unambiguous implicit target. AUD's sharpening, adopted: the fix isn't just "mention `--v` exists somewhere." Role behavior needs to change:

- **FMN**, facing multiple `DRAFT` plans: must not silently pick which one "should" lock — surface the choice, let Director decide via `--v`.
- **DEV**, facing multiple `DRAFT` execs (across different plan workstreams): must not assume the most recently created one is "the" current execution — check explicitly before acting.
- **All roles**: treat runtime-reported ambiguity as a stop-and-ask condition, not something to silently resolve on the role's own judgment.

This belongs in each role's CLI Operation Policy section as behavioral guidance, not scattered as a footnote. Not yet drafted.

### 4.4 Named but not elaborated

This is a real CLI behavior change (FIFO removal is a breaking change to existing lock ordering assumptions). Low practical risk given the current single-operator context of this project, but worth naming plainly rather than treating as free.

---

## 5. New: FMN-PLAN "Pre-requirement" section (template-only addition, no CLI gate)

Raised as a related but separate topic from §1–§4 above. First step, per Director's request: verified whether either `FMN-PLAN-TEMPLATE.md` or `DEV-EXEC-TEMPLATE.md` already has anything serving this purpose. Neither does — the closest neighbor is DEV-EXEC §9 (Dependency / Environment Changes), which is a **post-build report** of what changed during implementation, not a **pre-declared prerequisite check** before work starts.

**Confirmed scope, explicitly by Director**: template-only. No CLI gate, no mechanical validation against `progress-v<N>.json` — documentation/discipline tier, the same tier as Protocol Overrides & Expansions (filled by FMN, reviewed by Director before lock, never cross-checked by the CLI).

**Why this matters now, not just "nice to have"**: directly connected to §2's multi-draft redesign above. Once PLANs can be worked concurrently across workstreams (§2.2), a PLAN quietly depending on a different EXEC's completion — with no formal place to declare that — becomes a materially higher real risk than under the old strictly-serial system, where dependency order was mostly enforced by construction rather than declared explicitly.

**Placement**: FMN-PLAN, not DEV-EXEC — prerequisites must be visible before the plan locks and DEV starts (Gate 2), not documented after the fact. Proposed as the new **Section 2**, immediately after Source Alignment, shifting every following section down by one (Work Order becomes 3, Acceptance Criteria becomes 4, and so on through the existing 9). Claude's placement suggestion, not yet confirmed by Director against the full renumbering consequence — see §6.

**Semantic tier, sharpened by AUD's second-pass review**: three possible readings existed for what "requirement" means here once CLI enforcement was ruled out — (A) purely informational, (B) a declared prerequisite for execution whose enforcement lives in FMN/DEV/Director workflow discipline rather than the CLI, or (C) a governance gate. (C) was already explicitly rejected. **This document adopts (B)**: Pre-requirement is a real, binding declaration DEV/FMN/Director are expected to honor procedurally — not mere FYI — it just isn't mechanically checked by `sigma`. This distinction matters because it sets the ownership expectations in §5.3 below.

**Explicit distinction from Source Alignment (§1 of FMN-PLAN), so the two don't blur together**: Source Alignment answers *"what informs how this plan was formulated"* (its relationship to DIR-INTENT, ROADMAP stage, scope, constraints). Pre-requirement answers a different question — *"what must already be true for this plan's execution to begin."* One is about formulation input, the other is about execution dependency.

### 5.1 Sub-section 1 — Sigma Artefact Requirement

Table: `| No | Sigma Artefact | Status | Notes |`

Lists which DEV-EXEC artifacts must reach a given state before this PLAN can proceed into its own EXEC.

**Status vocabulary — resolved via discussion, differs from Director's original wording.** Director's initial proposal reused DEV-EXEC's own advisory vocabulary (`IMPLEMENTED` / `PARTIALLY_IMPLEMENTED` / etc. — DEV-EXEC §14, DEV Completion Statement). Claude objected, Director accepted the objection: a prerequisite should be checked against the artifact's actual **lock state**, not DEV's own advisory self-report, which is unratified and has not necessarily passed FMN Post-Build Review yet. This directly follows the Common Role Doctrine principle already governing the rest of Sigma (`SIGMA_PROTOCOL.md` §4.0, point 6): *"Advisory verdicts are not authority... only Director-approved CLI actions change state."* **Confirmed Status values: `DRAFT` / `LOCKED` / `SUPERSEDED`.** DEV's advisory-status color (e.g. "DEV reports IMPLEMENTED, awaiting FMN Post-Build Review") belongs in Notes as supplementary detail, never as the authoritative Status value.

**Declaration vs. runtime verdict — a distinction AUD's second-pass review made explicit, adopted as-is.** The Status column records the prerequisite's governance state **as FMN observed it when drafting this plan** — a snapshot, not a live-synced field (there is no CLI gate to keep it current). It must never contain a value like `UNSATISFIED` — that would conflate two different things: an artifact's actual state (a fact) versus whether a declared requirement is currently met (a relationship judgment). Satisfaction is never stored in the table; it is evaluated by whoever reads it, at the moment they need the answer, by comparing this declared snapshot against the artifact's real current state (`exec check --v`/`exec list`). This matters specifically because the snapshot can go stale between plan-authoring and DEV actually starting — more likely now than before, since concurrent workstreams (§2) mean a `DRAFT` plan can sit for a while before its EXEC begins.

**Hard scope boundary, adopted from AUD's second-pass review**: this table records only the **direct** prerequisites of this plan — never transitive dependency resolution. If `EXEC v1.4` (listed here) itself depends on `EXEC v1.2`, that is `EXEC v1.4`'s own concern, not something this PLAN's Pre-requirement table walks or resolves. This section must not grow into a dependency-graph engine.

### 5.2 Sub-section 2 — Output Requirement

Table: `| No | Output | Status | Notes | Location |`

Lists concrete files needed as reference/input — outputs of previously locked EXECs that this plan's work depends on. Different granularity from §5.1, not redundant with it: §5.1 asks *"is the prerequisite artifact governance-final (LOCKED)?"*; §5.2 asks *"does the specific deliverable file exist, and where?"* An EXEC being `LOCKED` doesn't by itself tell a reader where its output lives or which exact file is the one needed — §5.2 adds that concrete pointer.

Status vocabulary: `AVAILABLE` / `NOT_YET_AVAILABLE` — file-existence framing, deliberately different from §5.1's governance-state framing since the two subsections check different things. `Location` column (added mid-discussion, after the initial four-column proposal) records the file's actual path, making the reference directly actionable instead of requiring a separate lookup.

**Scope caveat on `AVAILABLE`, adopted from AUD's second-pass review**: `AVAILABLE` means only *"the referenced output is physically/locationally findable at Location"* — it is not a claim that the file is correct, current, validated, or approved. A file can be `AVAILABLE` and still be stale, corrupted, superseded, or simply the wrong artifact. Validating an output's quality/correctness is a separate layer (FMN Post-Build Review, Developer Verification, etc.) — Pre-requirement must not become a miniature acceptance/validation system layered on top of those.

### 5.3 Ownership — who may write and who may only read

Not addressed in the original proposal; added following AUD's second-pass review, which flagged this as the section's most concrete remaining gap. Modeled directly on FMN-PLAN's existing authorship discipline (Sections 1–7, including Pre-requirement once added, are pre-build content FMN owns and are immutable after lock — matching the rule already established for the rest of FMN-PLAN):

- **FMN** declares Pre-requirement while drafting the plan, pre-lock — freely editable up to that point, same as every other Section 1–7 content.
- **DEV reads, does not write.** DEV must not unilaterally add, remove, or edit a Pre-requirement entry — doing so would let DEV silently expand the plan's declared dependency contract, the same failure mode Sigma already guards against elsewhere (e.g. FMN-PLAN's existing "Protocol Overrides & Expansions" discipline, and DEV-RULE.md's general prohibition on DEV inventing or expanding scope).
- **If DEV discovers a missing or incorrect prerequisite mid-build**, the path is DEV's existing Escalation Path to FMN (`DEV-RULE.md` §Escalation Path) — not a silent edit. Because Pre-requirement sits inside the immutable-after-lock block, a genuine correction cannot be patched into the already-locked plan at all; it requires FMN opening a revised plan version, consistent with how any other Section 1–7 correction is already handled today.
- **Director** rules on disputes and on whether a discovered gap is significant enough to require plan revision versus being absorbed as an accepted risk — same general authority Director already holds over every other FMN-PLAN section.

---

## 6. New: DEV-EXEC "Technical Research" section (DEV's sole discretion, no gate, no AI review)

A third, independent template addition raised in this same session — unrelated to the multi-draft lock redesign (§1–§4) and to Pre-requirement (§5), kept in this document at the Director's request rather than split out.

**Origin**: DIR-INTENT already has a Comprehensive Research mechanism (§2, governed in detail by `ARC-RULE.md` §Research Mode) — four sub-sections (Theory and Concept, Issue/Problem/Real-World Data, Methodology, Source/Data), triggered when Director or ARC marks status `NEEDED`, gated by mandatory AUD Verificator Mode review before `intent lock`. The Director wants an analogous mechanism in DEV-EXEC, scoped narrowly to **technical implementation support** — whether DEV has sufficient grounding to implement responsibly — explicitly **not** a duplicate of what DIR-INTENT's research already covers.

### 6.1 Why this doesn't duplicate DIR-INTENT's Comprehensive Research

Of DIR-INTENT §2's four sub-sections, two are squarely ARC/Director's domain and settled before BUILD even starts: **Theory and Concept** (conceptual/theoretical grounding for the intent itself) and **Issue, Problem, and Real-World Data** (evidence the problem is real). DEV-EXEC's version must not re-litigate either — if relevant, DEV cites the locked DIR-INTENT by ID (e.g. *"per DIR-INTENT §2.2, ASM-002"*) rather than re-arguing it.

The one DIR-INTENT tier that is *already* implementation-flavored is **Methodology** — its source tier is explicitly "official documentation from the official/authoritative website (preferred), or a reputable technical Q&A community (e.g. Stack Overflow, GIS Stack Exchange)." This is the natural anchor for DEV-EXEC's version, not the other three tiers.

### 6.2 Proposed structure — two sub-sections, not DIR-INTENT's four

- **Technical/Implementation Approach Research** — investigating the correct way to implement a specific technical requirement (library/API/framework behavior, established pattern or algorithm). Same source tier as DIR-INTENT §2.4 Methodology.
- **Technical Risk / Unknown Resolution** — resolving a specific technical uncertainty already flagged in DEV Pre-Build Assessment's "Questions & Concerns" or in Key Technical Decisions, before DEV commits to an approach.

Proposed template shape:

```text
## 3. Technical Research

> Filled by DEV — Before Build. Entirely DEV's discretion.
> Technical Research is an execution-time mechanism for resolving
> implementation-specific knowledge gaps. It does not re-open, replace, or
> supersede DIR-INTENT Comprehensive Research.

### 3.1 Status
- [ ] NEEDED
- [ ] NOT_NEEDED
If NOT_NEEDED, state briefly why existing knowledge is sufficient.

### 3.2 Technical / Implementation Approach Research
> Sources: official documentation from the official/authoritative source
> (preferred), or a reputable technical Q&A community. Cite by
> reference-list.md row ID only. Each entry: Question / Finding / Decision /
> Implication — see §6.4.

### 3.3 Technical Risk / Unknown Resolution
> Must NOT re-derive DIR-INTENT's Theory/Concept or Problem/Data grounding —
> cite DIR-INTENT by ID if relevant, do not re-argue it. Same entry shape as
> §3.2: Question / Finding / Decision / Implication.
```

**Doctrine statement, adopted verbatim from AUD's second-pass review**: *"Technical Research is an execution-time research mechanism for resolving implementation-specific knowledge gaps. It does not re-open, replace, or supersede DIR-INTENT Comprehensive Research."* Included directly in the template's section header note above, not left implicit.

**Infrastructure — reuse, don't duplicate**: cites `Sigma/reference/reference-list.md` by row ID (LA/WL/OS), the same project-wide reference list DIR-INTENT's research already uses via `sigma reference update` — no parallel citation system. If DEV needs a source ARC already recorded, DEV cites the same ID rather than re-recording it.

**Placement**: proposed as the new **Section 3** in DEV-EXEC, between DEV Pre-Build Assessment (2) and Implementation Approach (3) — research findings should inform the approach about to be written, not follow it. This shifts every subsequent section down by one, all the way through the existing 17 (Implementation Approach → 4, ... Director's Summary → 18) — the same category of renumbering ripple already accepted for Pre-requirement in FMN-PLAN (§5).

### 6.3 Director's two confirmations for this section

1. **No gate, no AI-role review — DEV's sole discretion.** Explicit contrast with DIR-INTENT's Comprehensive Research: no AUD Verificator Mode requirement, nothing blocks `exec lock` on this section's status or content, and — unlike DIR-INTENT, where Director or ARC can trigger `NEEDED` — only DEV's own judgment triggers it here. No AI role (FMN, AUD, ARC) is required to review, verify, or approve what DEV writes in this section.
2. **Recorded in this same document**, not split into a separate one, despite being topically unrelated to §1–§5 — Director's explicit choice.

### 6.4 Refinements from AUD's second-pass review, adopted

**Research must resolve into a decision, not just collect notes.** The biggest risk AUD flagged: an entry like *"Research performed on library documentation. Library supports COG"* is epistemically weak — it records that browsing happened, not what was concluded or what changes because of it. Each entry in §3.2/§3.3 should follow a fixed shape: **Question → Finding → Decision → Implication** (e.g. *"Can library X stream COG tiles while preserving CRS Y?" → "Official docs state Z" → "Use X with configuration Y" → "Implementation Approach §4 will use this configuration"*). "Decision" here is DEV's own implementation-level judgment call — already within DEV's existing authority under `DEV-RULE.md` §Freedom of Method (DEV may choose implementation pattern, algorithm, internal structure) — not a contract-level decision. Ideally "Implication" cross-references the specific Implementation Approach/Key Technical Decisions item the finding feeds into, the same cross-referencing discipline already used elsewhere in Sigma (AC-/TC-/REQ- IDs).

**"No gate" does not mean "no accountability."** DEV marking `NOT_NEEDED` is still a real judgment call, not exempt from ordinary consequences. If an unverified assumption later causes a problem, that remains legitimate content for Issues Encountered or FMN Post-Build Review, exactly as any other DEV judgment already is — this doesn't require any new review machinery, it's just confirming existing accountability mechanisms apply here as they do everywhere else in DEV-EXEC.

**Technical Research must not become a backdoor to silently change FMN-PLAN.** If research reveals that a PLAN-specified approach (e.g. a named library) is actually wrong, that is a finding — not authority for DEV to unilaterally substitute a different approach. This connects directly to mechanisms already in place, not new ones: if the finding stays within DEV's Freedom of Method, DEV proceeds and records it in Deviations From FMN-PLAN as usual; if it actually touches a contract-level constraint or decision, DEV must use the existing Escalation Path (`DEV-RULE.md` §Escalation Path) before acting, not treat the research finding itself as sufficient authority to deviate.

**Three-tier readiness framing, worth keeping as a closing synthesis** (AUD's second-pass review): Pre-requirement (§5) answers *"what must already be available before I start?"* — dependency readiness. Technical Research (§6) answers *"what don't I know yet?"* — knowledge readiness. Implementation Approach (DEV-EXEC's existing §3, unrenumbered reference) answers *"now that I know, how do I proceed?"* — execution decision. Three previously-blurred concerns now have distinct, non-overlapping homes across the FMN-PLAN/DEV-EXEC lifecycle.

---

## 7. Resolved this round vs. still open

**Resolved, no longer open** (superseding the equivalent bullets from the previous version of this document): the PLAN↔EXEC cardinality invariant (§2.2, Director-confirmed) and its guard shape; that "continuing" a DRAFT EXEC needs no new CLI surface (§2.2); the hard-block-vs-soft-warn split by command class (§4.1); that stale `DRAFT` plans need a real lifecycle exit, not just discussion (§4.2, elevated from open question to confirmed design gap — though the exact mechanism is still undesigned, see below); the Pre-requirement section's two-subsection structure, column sets, both status vocabularies, its template-only/no-CLI-gate scope, its semantic tier (declared-prerequisite-via-workflow-discipline, not informational-only), its declaration-vs-runtime-verdict distinction, its direct-dependency-only boundary, its `AVAILABLE` scope caveat, and its FMN-writes/DEV-reads-only ownership model (§5, incorporating AUD's second-pass review, Director-confirmed on the original proposal with these refinements layered on top); the DEV-EXEC Technical Research section's naming, two-subsection structure, source-tier reuse, no-gate/DEV's-sole-discretion scope, its Question/Finding/Decision/Implication entry shape, its no-gate-≠-no-accountability clarification, and its anti-backdoor boundary against silently altering FMN-PLAN (§6, Director-confirmed with AUD's second-pass refinements layered on top).

**Still explicitly open:**

- Full inventory of every `plan.active_version`/`exec.active_version` consumer in the codebase (§4.1) — required before implementation planning, not yet done.
- Exact shape of `plan discard`/`plan withdraw` (§4.2): command name, resulting terminal state, whether an equivalent is needed for `DRAFT` `DEV-EXEC`, and interaction with the existing `chain.plan.pending[]` queue (plans staged via `plan new --pending` already avoid entering the official DRAFT queue at all until promoted — worth checking whether that mechanism already covers part of this need before designing a new one).
- Exact error message wording for the "nothing lockable" case (§2.1, §2.3) and for the soft-warn banner text (§4.1) — not yet drafted.
- `FMN-RULE.md`/`DEV-RULE.md` CLI Operation Policy and Role Activation section updates (§4.3) — not yet drafted.
- Pre-requirement's exact section number/placement in `FMN-PLAN-TEMPLATE.md` (§5's Section 2 proposal, not yet confirmed against full renumbering consequence) — and the actual template edit itself is not yet applied, this document records the design only.
- A corresponding `FMN-RULE.md` "FMN-PLAN Creation Rules" addition for Pre-requirement (mirroring the existing paragraph for Protocol Overrides & Expansions) — not yet drafted.
- Technical Research's exact section number/placement in `DEV-EXEC-TEMPLATE.md` (§6's Section 3 proposal, not yet confirmed against the full 17→18 renumbering) — and the actual template edit itself is not yet applied, this document records the design only.
- A corresponding `DEV-RULE.md` addition documenting the Technical Research discipline (entry shape, anti-backdoor boundary, accountability note) — not yet drafted.
- The `SIGMA_PROTOCOL.md` §5.2/§5.3 documentation drift noted in this document's header — explicitly deferred by the Director, tracked here only as a pointer to revisit later, not part of this design.
