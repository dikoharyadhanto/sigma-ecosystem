# PLAN-14 — Core Hardening & Consistency Pass

**Source**: Post-`PLAN-13` hardening review of current `sigma-ecosystem` codebase  
**Date**: 2026-05-18  
**Status**: DRAFT

---

## Objective

Harden the Sigma CLI core after the `PLAN-13` bug-fix tranche.

This plan does not introduce a new governance feature. It strengthens the correctness of the existing lifecycle engine, removes duplicated command-layer logic, expands regression coverage, and aligns protocol claims with the behavior the CLI actually enforces.

The target outcome is simple:

```text
Existing Sigma workflow stays the same.
Invalid persisted state becomes harder to ignore.
Shared command behavior becomes easier to maintain.
Regression risk drops as feature work continues.
```

---

## Scope

### In scope

- Harden `Sigma/progress.json` validation and invariant enforcement
- Extract duplicated command helpers used across artifact commands
- Stabilize decision harvesting from locked artifact documents
- Expand tests beyond basic gate enforcement
- Align minimal protocol/documentation statements with actual runtime behavior

### Out of scope

- Any new governance role or lifecycle phase
- Any replacement of the existing artifact model
- Broad README marketing rewrite
- Re-specifying `PLAN-13` items such as `sigma plan approve` or `sigma decision log`
- Any change to artifact naming conventions unless required by a correctness fix

### Dependency boundary

`PLAN-13` remains the owner of:

- Gate 2 redesign
- `decisions.jsonl` read command
- CSO auto-population improvements
- bootstrap checklist additions tied directly to those new features

`PLAN-14` must support those changes, not redefine them.

---

## Design Constraints

| Constraint | Rule |
|---|---|
| Backward compatibility | Existing valid Sigma projects must continue to load without manual migration. |
| Strict on contradictions | Mutating commands must fail on impossible or contradictory persisted state. |
| Read path tolerance | Read-only commands may remain more tolerant than mutating commands where that improves recoverability. |
| No workflow drift | Refactors must not silently change command names, artifact paths, or normal lifecycle order. |
| Protocol honesty | Runtime enforcement and `SIGMA_PROTOCOL.md` must not diverge on hard guarantees. |
| Thin commands | Command modules should orchestrate; shared helpers should own repeated mechanics. |

---

## Task Breakdown

---

### TASK-01 — Harden `progress.json` validation and lifecycle invariants

**Primary area**: `src/engine/progress.ts`

Current validation is structurally useful but semantically shallow. Required top-level fields are checked, but internal contradictions can still survive load and affect command behavior.

#### Problems to address

- `active_version` can exist without a matching version entry
- `active_state` can drift from the actual active version state
- reference fields such as `intent_version_ref` and `plan_version_ref` are not fully verified
- gate flags can contradict artifact state
- mutating commands can proceed even when persisted state is logically impossible
- schema mismatch behavior is documented more strictly than current runtime enforcement

#### Required implementation

Add semantic invariant validation on top of the current structural validation.

Validation must check:

- each tracker has a coherent `active_version`, `active_state`, and `versions` relationship
- an active version reference resolves to exactly one entry
- the resolved active entry state matches `active_state`
- `LOCKED` entries contain `locked_at`
- superseded entries contain the metadata required by current Sigma semantics
- `plan.intent_version_ref` points to an existing intent version when present
- `exec.plan_version_ref` points to an existing plan version when present
- `gate_1_open`, `gate_2_open`, and `gate_3_satisfied` do not contradict the artifact chain

Add a helper that detects impossible gate contradictions from artifact state.

This helper is not a full gate recomputation engine. Some gate values may depend on explicit Director approval or future approval commands introduced by `PLAN-13`. The helper must only reject states that are impossible under any valid Sigma workflow, for example:

- `gate_1_open = true` while no active locked intent exists
- `gate_2_open = true` while no valid plan approval/lock condition exists under the current implemented workflow
- `gate_3_satisfied = true` while no clean qualifying intent -> plan -> exec chain exists

If a gate can be valid only because of approval metadata introduced by `PLAN-13`, the helper must inspect that metadata once available. Until then, it should avoid treating "not derivable from artifact lock alone" as automatically invalid.

#### Enforcement policy

- `readProgress()` may continue to parse structurally valid files
- mutating commands must block when semantic invariant checks fail
- read-only commands may either warn or fail depending on whether safe display is still possible
- newer unsupported schema versions must block mutating commands
- older compatible schema versions may warn if the shape is still usable

#### Acceptance criteria

- contradictory persisted state produces a clear user-facing error
- invalid-state errors include recovery guidance, such as running `sigma session bootstrap`, inspecting the named `Sigma/progress.json` field, or using the appropriate supersede/recreate command path
- valid current project states continue to work unchanged
- impossible gate state cannot be silently carried forward by a mutating command
- schema mismatch behavior matches documented expectations

---

### TASK-02 — Extract shared artifact-command helpers

**Primary areas**: `src/commands/intent.ts`, `plan.ts`, `exec.ts`, `close.ts`, `roadmap.ts`, `cso.ts`

Several command files currently duplicate the same support logic:

- template resolution
- audit/advisory section appending
- artifact file creation flow
- repeated display formatting patterns

This duplication is manageable now, but it raises maintenance cost and increases the chance that future bug fixes land in one command but not the others.

#### Required implementation

Create a shared helper module for artifact-command support.

The shared layer should own:

- template lookup from global install path first, bundle path second
- common markdown advisory append block generation
- shared artifact file copy/bootstrap helpers
- small formatting helpers where output structure is identical

Command modules should remain responsible for:

- gate checks
- domain-specific state transitions
- command-specific output text
- domain-specific harvesting hooks

#### Refactor boundaries

- do not change command names
- do not change artifact locations
- do not rewrite command output text unless inconsistency or bug correction requires it
- do not merge unrelated lifecycle logic into the helper module

#### Required refactor sequence

Refactor incrementally rather than touching all command files in one pass:

1. Add command-level regression coverage for the affected behavior in all six command domains.
2. Extract template resolution first and run `npm test`.
3. Extract advisory append generation next and run `npm test`.
4. Extract file/bootstrap helpers only after the first two helper extractions are stable.
5. Leave formatting helpers for last, and skip them if the abstraction would make command output harder to read.

#### Acceptance criteria

- repeated local `resolveTemplate` implementations are removed
- repeated local advisory append helpers are removed
- command files become thinner without losing domain clarity
- behavior and output remain functionally unchanged for normal flows
- each helper extraction is protected by command-level output/path regression tests before the affected command file is refactored

---

### TASK-03 — Harden decision harvesting from artifact markdown

**Primary area**: `src/engine/memory.ts`

Decision harvesting is important because `decisions.jsonl` is used as CLI-written evidence memory. The current implementation works against current templates, but extraction is fragile because heading patterns are embedded inline and depend on narrow markdown shapes.

#### Problems to address

- heading extraction logic is scattered across artifact harvest functions
- section matching can fail silently if heading wording or capitalization shifts
- output stability depends on raw whitespace from source documents
- future template evolution can break harvesting without obvious test coverage

#### Required implementation

Introduce a centralized heading/section extraction map per artifact type.

For each artifact type, explicitly define:

- which headings are expected
- which extracted fields are required
- which extracted fields are optional

Normalize harvested content before append:

- trim outer whitespace
- normalize repeated blank lines
- preserve meaning but reduce formatting noise in JSONL entries

Handle missing sections as follows:

- optional fields: empty string, no failure
- required fields: empty string plus concise stderr warning, but no hard crash during lock unless protocol already requires that section to exist

#### Acceptance criteria

- current templates still harvest successfully
- minor heading-case or spacing differences no longer break extraction unexpectedly
- harvesting behavior is deterministic across newline styles
- JSONL output stays stable enough for snapshot-style assertions if needed

---

### TASK-04 — Expand regression coverage around real lifecycle risks

**Primary area**: `test/`

The current suite proves that baseline gate checks and error readability work. It does not yet provide enough protection for lifecycle integrity, stale-chain behavior, or future hardening refactors.

#### Required test additions

Add integration-oriented tests for:

- `sigma project start` creates expected Sigma structure and initializes `Sigma/memory/decisions.jsonl`
- `sigma session bootstrap` reports artifact state, gate status, stale warnings, and fallback reading lists correctly
- stale-intent propagation when a new intent supersedes a previously referenced plan/exec chain
- supersede flows for plan and exec, including metadata updates
- `sigma close new` chain validation, including stale-chain acknowledgment behavior
- schema mismatch behavior for read-only versus mutating commands
- malformed `progress.json` invariants such as missing active entry, mismatched active state, broken refs, and impossible gate state
- decision harvesting against representative markdown fixtures

#### Test strategy

- prefer CLI-level tests for user-visible behavior
- add lower-level tests only where CLI execution would make the assertion unnecessarily brittle
- extend `test/helpers.ts` with builders for malformed, stale, and multi-version progress states
- keep test outputs readable and aligned with real user recovery paths

#### Acceptance criteria

- every lifecycle domain has at least one focused regression test
- `npm test` remains the single entrypoint
- failing assertions clearly identify the broken invariant or lifecycle rule

---

### TASK-05 — Minimal documentation and protocol consistency pass

**Primary areas**: `README.md`, `SIGMA_README.md`, `Sigma/SIGMA_PROTOCOL.md`

Once runtime hardening lands, the canonical documents must reflect only what the CLI truly guarantees.

This is not a broad rewrite. It is a bounded consistency pass.

#### Required implementation

Update only the docs needed to reflect:

- stricter validation/error behavior for invalid persisted state
- actual schema mismatch handling
- any invariant rule that becomes an enforced runtime contract

#### Boundaries

- do not rewrite the product narrative
- do not pre-document `PLAN-13` features unless they are already implemented
- do not change examples unless the old example becomes misleading because of new enforcement
- document only the hardening behavior that actually landed; if TASK-01 through TASK-04 are partially implemented, TASK-05 must be narrowed to that implemented subset

#### Acceptance criteria

- no canonical doc promises unsupported validation behavior
- newly enforced runtime rules are reflected in protocol/docs
- documentation changes remain minimal and correctness-focused

---

## Implementation Order

Recommended execution order:

1. TASK-01 — establish invariant model first
2. TASK-04 (partial) — add failing tests for broken state scenarios
3. TASK-02 — refactor duplicated command helpers incrementally under command-level regression coverage
4. TASK-03 — harden harvest logic and add markdown fixture tests
5. TASK-05 — sync docs only to final behavior that actually landed

This order minimizes the risk of refactoring before correctness rules are pinned down.

---

## Test Plan

The completed work must be verified with:

- `npm test`
- targeted regression tests for malformed and contradictory `progress.json`
- lifecycle-chain tests covering clean chain and stale chain behavior
- harvesting tests using representative artifact markdown input

Key scenarios:

- valid project state still passes all existing command flows
- invalid project state blocks mutation with explicit recovery-oriented errors
- stale chain propagation remains intact after invariant hardening
- refactored command helpers do not change artifact path creation or standard output text
- harvested decision entries remain stable after markdown normalization

---

## Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Over-strict validation breaks real projects | Existing projects may contain tolerated inconsistencies | Start by codifying only impossible states; include recovery guidance in every invalid-state error |
| Gate derivation is over-modeled | Some gates may depend on explicit Director approval metadata, especially after PLAN-13 | Use contradiction detection, not full recomputation, and incorporate approval metadata only when implemented |
| Refactor alters CLI output | Existing tests and docs rely on current phrasing | Add command-level path/output regression tests before each helper extraction |
| Harvest normalization loses useful formatting | Some harvested notes may rely on markdown spacing | Normalize conservatively: trim and collapse excess blanks only |
| Documentation drifts again later | Protocol and code can diverge after future features | Keep doc changes bounded and tie them to tests where possible |

---

## Done Criteria

`PLAN-14` is complete when:

- lifecycle invariant validation is materially stronger
- command helper duplication is reduced without workflow drift
- decision harvesting is more robust and covered by tests
- the test suite covers the main lifecycle integrity risks beyond basic gates
- protocol/docs no longer overstate runtime guarantees in the hardened areas

At that point, Sigma should be in a better position to accept post-`PLAN-13` feature work without accumulating silent state corruption or command-layer inconsistency.
