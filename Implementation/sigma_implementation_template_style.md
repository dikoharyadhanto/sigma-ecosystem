# Sigma Implementation Review — Template Style Markers

**Source**: `Discussion/catatan_perbaikan_template_style.md`  
**Date**: 2026-06-02  
**Status**: DRAFT FOR REVIEW  
**Scope**: Review and implementation guidance for Sigma Markdown template markers, structure stability, and CLI validation behavior.

---

## Executive View

The proposal in `Discussion/catatan_perbaikan_template_style.md` is directionally strong and should move forward.

Its main strength is that it solves a structural reliability problem without expanding document burden:

```text
Improve machine stability.
Do not make human-authored artifacts heavier.
```

This is the right design priority for Sigma at this stage.

The recommendation to introduce:

- document-level markers;
- section-level markers for core H2 sections;
- CLI validation commands;
- lock-time structural checks;

is a good fit for Sigma because the current weakness is not lack of content discipline. The current weakness is lack of stable machine anchors for AI and CLI behavior.

---

## Overall Opinion

I agree with the core decision:

```text
Strengthen structure, not content weight.
```

That decision is sound for four reasons:

1. Sigma already has relatively disciplined document content.
2. Section-number-based references are brittle and will degrade as templates evolve.
3. AI-assisted rewrite flows need structural guardrails that are cheap to validate mechanically.
4. CLI features such as section-aware validation, update, and lock preflight need stable anchors that do not depend on visible heading text.

In short:

```text
The problem is not missing sections.
The problem is unstable structure identity.
```

This proposal addresses the correct layer.

---

## What Is Strong In The Proposal

### 1. Hidden HTML comment markers are the right medium

Using HTML comments such as:

```md
<!-- SIGMA:DOC type=FMN_PLAN schema=1 -->
```

and:

```md
<!-- SIGMA:FMN_PLAN:SECTION:ACCEPTANCE_CRITERIA -->
```

is a strong choice because:

- rendered Markdown stays clean for human readers;
- the marker can be parsed deterministically by CLI;
- AI can still see the marker in source form;
- the marker does not require visible syntax pollution in headings.

This gives Sigma machine-readable structure with minimal UX cost.

### 2. H1 identity and H2 structure is the correct boundary

The proposed split is good:

- H1 gets document identity marker;
- core H2 sections get section identity marker;
- H3/H4 stay unmarked unless they become machine targets later.

This keeps the implementation lean and avoids over-instrumenting the templates.

### 3. Refusing content-heavy additions is a good constraint

The proposal explicitly rejects:

- mandatory evidence matrices;
- dependency tables;
- formal evidence gates;
- extra burden sections.

That is the right call.

Sigma is still benefiting from being lightweight. Structural hardening should not quietly become content expansion.

### 4. Validation-first thinking is correct

Adding markers alone is not enough.

The strongest part of the note is that it pairs markers with:

- `sigma plan check`
- `sigma exec check`
- lock-time validation

Without these, markers become passive decoration. With these, they become part of Sigma's operational contract.

---

## Key Benefits If Implemented

If implemented carefully, this change would give Sigma several concrete advantages:

- safer AI rewrite behavior because required structural anchors can be detected if removed;
- more reliable CLI preflight before `lock`;
- cleaner future support for section-aware editing or extraction;
- less dependence on visible numbering such as `Section 8` or `Section 10`;
- easier mismatch detection when a wrong template is used for a command context.

This is especially valuable for artifacts like `FMN-PLAN` and `DEV-EXEC`, where section identity matters operationally.

---

## Important Concerns Before Implementation

The proposal is good, but a few things should be tightened before coding starts.

### 1. Marker grammar must be strict

The note defines the shape of markers conceptually, but implementation needs a much stricter contract.

Questions that should be frozen before coding:

- Is marker casing always uppercase for artifact and section IDs?
- Is whitespace flexible or exact?
- Is `schema=1` mandatory on all document markers?
- Are attributes ordered or unordered?
- Can unknown attributes exist?
- Can there be multiple spaces between tokens?

Recommendation:

```text
Define one canonical marker grammar and one canonical serializer.
```

If Sigma accepts too many marker variants, drift will happen quickly between templates, CLI output, migration tools, and AI-authored edits.

### 2. Section IDs must be treated as stable contract IDs

Names like:

```text
ACCEPTANCE_CRITERIA
DEV_HANDOFF_INSTRUCTIONS
GIT_CHANGE_EVIDENCE
```

look harmless, but once used by lint/check/migrate/update logic, they become durable API-like identifiers.

Recommendation:

- treat `SECTION_ID` as long-lived contract identifiers;
- avoid renaming them casually later;
- document naming rules once before rollout.

If these IDs change often, the system reintroduces fragility in a different form.

### 3. Do not over-introduce `mode` and `owner` too early

`mode=locked_after_plan_lock` and `owner=FMN` are promising ideas, but they should only be introduced when the CLI has a concrete rule that enforces them.

Recommendation:

- Phase 1: support core document and section markers only;
- Phase 2: add `mode` for sections with real mutability enforcement;
- Phase 3: consider `owner` only if it drives actual validation or tooling behavior.

Otherwise, Sigma risks creating metadata that looks authoritative but is not operationally enforced.

### 4. Warning policy must stay low-noise

The note suggests warning on numeric section references.

That is a reasonable direction, but detection must be conservative.

If the warning system is too eager, users will ignore it. A noisy validator is nearly as bad as no validator.

Recommendation:

- warn only on clear `Section N` patterns;
- do not attempt broad natural-language interpretation at first;
- keep this warning non-blocking.

### 5. Template order validation should be explicit per artifact

The note says required section order can be validated "if order matters."

This is correct, but implementation should not leave that vague.

Recommendation:

- define an explicit ordered list of required section IDs per artifact type;
- treat missing required section markers as blocking;
- treat duplicates as blocking;
- treat unknown markers as warning unless explicitly reserved.

This makes validator behavior deterministic.

---

## Recommended Implementation Strategy

I recommend a staged rollout rather than shipping the full concept at once.

### Stage 1 — Minimum viable structural contract

Implement:

- H1 document marker on all managed templates;
- H2 required section markers on core structural sections;
- parser and validator for required markers;
- `sigma plan check`;
- `sigma exec check`;
- light lock-time validation.

Do not implement migration complexity or rich attributes first unless needed.

### Stage 2 — Lock rule integration

After the minimum contract is stable:

- auto-run document validation after `sigma [doc] new` commands;
- block lock if required marker is missing;
- block lock if required marker is duplicated;
- warn on unknown markers;
- warn on obvious numeric `Section N` references.

This stage makes the structure operationally meaningful.

### Stage 3 — Controlled metadata extension

Only after the core flow works well:

- add `mode` support for sections with real lifecycle constraints;
- add migration tooling;
- consider section-aware editing helpers.

This preserves implementation focus and reduces rollout risk.

---

## CLI Design Notes

If this moves forward, the CLI should treat markers as structural metadata only.

It should not treat them as the new semantic source of truth.

The right boundary is:

- marker = structural identity;
- heading/body text = human-readable content;
- `progress.json` and registries = runtime truth.

That separation is important. The proposal already points in that direction and should keep it.

I also recommend that any future parser implementation support:

- exact document type validation;
- exact required section presence validation;
- normalized extraction of ordered section IDs;
- clear error output with heading context when a marker is malformed or missing.

Good error messages will matter as much as the parser itself.

---

## Auto-Check On Document Creation

I recommend that Sigma automatically run the relevant structural check after every document creation command.

Examples:

- `sigma plan new` should auto-run `sigma plan check`;
- `sigma exec new` should auto-run `sigma exec check`;
- any future `sigma intent new` or `sigma close new` flow should run the matching document check.

This is a strong addition because it turns `new` into a quality gate for generated artifacts, not just a file-writing action.

### Why auto-check on `new` is valuable

It gives Sigma several benefits immediately:

- generator output is verified against the same contract used later by `lock`;
- template drift is detected early;
- parser/template mismatches become visible at creation time;
- AI or CLI template bugs are easier to diagnose;
- newly created artifacts begin life in a structurally valid state.

This is especially useful because Sigma-managed templates are machine-sensitive documents. If Sigma creates them, Sigma should verify them.

### Recommended behavior

The safest behavior is:

1. Create the file first.
2. Run the matching structural check automatically.
3. Show the result immediately in the CLI output.

I do not recommend silently skipping this validation.

I also do not recommend preventing file creation before validation runs, because keeping the generated file on disk is useful for debugging if generation logic is wrong.

### Recommended result policy

Recommended policy:

- if auto-check passes, return success;
- if auto-check returns warnings only, return success with warning output;
- if auto-check returns structural errors, keep the generated file but return non-zero exit status and clearly state that the document is not lock-eligible yet.

This gives strong feedback without hiding the generated artifact from inspection.

### Suggested CLI output shape

Example success flow:

```text
$ sigma plan new --project SIGMA --version 0.1

Created: Sigma/execution/FMN-PLAN-SIGMA-v0.1.md
Running automatic validation...

[PASS] Document marker found
[PASS] Document type matches command context
[PASS] Required section markers complete
[PASS] No duplicate section markers
[PASS] Section order valid

Result: OK
Lock readiness: Eligible
```

Example failure flow:

```text
$ sigma plan new --project SIGMA --version 0.1

Created: Sigma/execution/FMN-PLAN-SIGMA-v0.1.md
Running automatic validation...

[ERROR] Missing required section marker: ACCEPTANCE_CRITERIA
[ERROR] Expected H2 heading after marker: DEV_HANDOFF_INSTRUCTIONS

Result: FAILED
Lock readiness: Not eligible
Warning: generated document requires repair before lock.
```

### Implementation note

To keep behavior consistent, `sigma [doc] new` should reuse the same validator engine as:

- `sigma [doc] check`;
- lock-time preflight validation.

That prevents the system from having different definitions of "valid document" depending on which command path is used.

---

## Migration View

The migration section is sensible.

I agree that:

- new templates should adopt markers first;
- old documents should not be forcibly migrated immediately;
- migration should be opt-in or command-triggered when needed.

This is the right operational tradeoff.

A forced full backfill would create unnecessary churn and a larger bug surface.

The only caution is that migration tooling must be conservative:

- insert markers only when heading match is high-confidence;
- never rewrite section content;
- report unresolved headings instead of guessing.

---

## Final Assessment

My conclusion is:

```text
This proposal is worth implementing.
```

It addresses a real Sigma weakness, keeps document burden low, and creates a solid foundation for safer AI and CLI interaction with Markdown artifacts.

The biggest implementation caution is not conceptual. It is contractual discipline:

```text
Freeze marker grammar early.
Keep the first rollout narrow.
Only add attributes that the CLI can actually enforce.
```

If Sigma follows that discipline, this proposal should improve reliability without making the system heavier.

---

## Recommended Next Decision

Before implementation starts, I recommend freezing these four items in one short follow-up decision note:

1. Canonical marker grammar.
2. Canonical required section ID list per artifact.
3. Exact blocking vs warning behavior for `check` and `lock`.
4. Whether `mode` attributes are in scope for the first rollout or deferred.

Once those are locked, implementation can proceed with much lower ambiguity.
