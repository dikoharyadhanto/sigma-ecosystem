# AUD Implementation Notes — Sigma Phase 2 Design Critique

> **Purpose**: Discussion material for reviewing Sigma Phase 2 implementation with another AI.
> **Mode**: Consultant / audit support, not adversarial audit.
> **Context**: Current implementation is still around **Batch B**. This document focuses on design risks and recommendations before committing to Batch D/E roadmap and planning behavior.

---

## Executive Summary

The current Sigma Phase 2 direction is strong. The proposal has moved beyond small ergonomic fixes and is becoming a coherent redesign of Sigma as a governance runtime where `ROADMAP` becomes the central trace backbone.

The strongest parts of the current direction are:

1. **ROADMAP becoming mandatory** instead of optional.
2. **PLAN and EXEC traceability through ROADMAP**.
3. **Pending plan staging** to separate immature future work from official versioned governance artifacts.
4. **Simplified DEV-EXEC state machine** from multi-step ceremonial states into `DRAFT → LOCKED`.
5. **Removal of derived memory / decisions log** in favor of reading authoritative artifacts directly.
6. **ROADMAP H2 sections as CLI-managed atomic units**.
7. **Migration commands** for existing projects already using Sigma.

However, before moving deeper into Batch D/E, several design decisions should be revised or made explicit. The most important recommendations are:

1. Add `INACTIVE` to ROADMAP state.
2. Keep official PLAN locking FIFO, but rely on `--pending` / `promote` for non-linear future planning.
3. Keep minimal lock/activation preflight for authority-sensitive operations.
4. Define Sigma artifact versions clearly as governance coordinates, not product release versions.
5. Enforce state/document consistency: `progress.json` must not claim a PLAN exists unless its PLAN file and ROADMAP section exist.
6. Treat `sync roadmap` as a one-time migration tool, not normal workflow.

---

## 1. ROADMAP State Should Include `INACTIVE`

### Current Concern

The earlier proposal used:

```text
ROADMAP: DRAFT → ACTIVE → LOCKED
```

This is correct for a project that always closes one intent before starting the next. But the current real workflow allows a project to move to a new intent without formal closure.

Example:

```text
DIR-INTENT v1 LOCKED
ROADMAP v1 ACTIVE

Director decides to create DIR-INTENT v2 without closing v1
ROADMAP v2 is created and activated
```

If Sigma only supports `DRAFT`, `ACTIVE`, and `LOCKED`, it risks having:

```text
ROADMAP v1 ACTIVE
ROADMAP v2 ACTIVE
```

That creates ambiguity for:

- `sigma plan new`
- `sigma session bootstrap`
- documentation generation
- closure generation
- AI orientation
- roadmap rendering
- audit traceability

### Recommendation

Add a fourth state:

```text
ROADMAP: DRAFT → ACTIVE → INACTIVE → LOCKED
```

### Recommended State Semantics

| State | Meaning |
| :--- | :--- |
| `DRAFT` | ROADMAP exists but is not yet the execution backbone. |
| `ACTIVE` | The only ROADMAP allowed to receive new official PLAN artifacts. |
| `INACTIVE` | A previous ROADMAP displaced by a newer active ROADMAP without formal closure. It remains readable and traceable but no longer receives new plans. |
| `LOCKED` | Final immutable ROADMAP after formal closure. |

### Core Invariant

```text
Only one ROADMAP may be ACTIVE at a time.
```

### Activation Behavior

`roadmap new` should create a DRAFT roadmap.

`roadmap activate` should be the operation that changes active state.

Recommended behavior:

```bash
sigma roadmap activate --v v2
```

If another roadmap is currently active, activation should demote it:

```text
ROADMAP v1 ACTIVE → INACTIVE
ROADMAP v2 DRAFT  → ACTIVE
```

### Why Activation, Not Creation, Should Demote the Previous Roadmap

Do not demote the current active roadmap when a new roadmap is merely created.

Reason:

```text
ROADMAP v2 DRAFT is not yet authoritative.
ROADMAP v1 should remain ACTIVE until v2 is explicitly activated.
```

This avoids a gap where no roadmap is usable for active planning.

### Suggested Preflight

```text
Roadmap Activation Preflight

New active roadmap:
  ROADMAP v2

Currently active roadmap:
  ROADMAP v1

Effect:
  ROADMAP v1 will become INACTIVE.
  ROADMAP v2 will become ACTIVE.
  New FMN-PLAN artifacts will link to ROADMAP v2.

Type APPROVE to continue.
```

---

## 2. PLAN Locking: FIFO Is Acceptable If Pending Plans Exist

### Earlier Concern

An earlier concern was that FIFO-only `plan lock` could be too rigid if multiple draft plans exist and the Director wants to lock a newer urgent plan before an older unfinished idea.

However, the proposed `plan new --pending` and `plan promote --id` design addresses that concern cleanly.

### Revised Position

If Sigma has two separate planning tiers, FIFO for official plans is acceptable and coherent.

Recommended model:

```text
Pending Plan
  - non-versioned
  - tracked by ID
  - not part of governance sequence
  - not in lock queue
  - can be promoted later

Official Draft Plan
  - versioned
  - part of governance sequence
  - enters FIFO lock queue
  - treated as serious formal planning artifact
```

### Recommended Rule

```text
Immature future work belongs in pending plans.
Official versioned draft plans are locked FIFO.
```

This allows creative/non-linear planning without damaging the official governance sequence.

### Recommended Workflow

```bash
sigma plan new --pending
sigma plan promote --id <pending-id>
sigma plan lock
```

### Why This Is Better Than `plan lock --v`

Using explicit `--v` for plan lock can create version order confusion if the Director or AI starts locking plans out of sequence. Since Sigma artifact versions are governance coordinates, preserving order matters.

Pending plans solve the same need without polluting the official version stream.

### Suggested Diagnostic Command

Add or extend a queue/status output:

```bash
sigma plan queue
```

Suggested output:

```text
Official Draft Queue:
  1. FMN-PLAN v1.11 DRAFT
  2. FMN-PLAN v1.12 DRAFT
  3. FMN-PLAN v1.13 DRAFT

Pending Plans:
  p7f3a — Future export feature
  k9d2c — Admin dashboard idea

Next lock target:
  FMN-PLAN v1.11
```

This keeps the model explicit without allowing arbitrary official version locking.

---

## 3. Keep Minimal Preflight for Authority-Sensitive Operations

### Clarification

The recommendation is not to build a large shared preflight framework.

The recommendation is to keep a minimal preflight summary before commands that perform irreversible or authority-sensitive mutations.

This matters even if state machines become simpler.

### Why Preflight Still Matters

The new design adds hidden or compound side effects.

Examples:

- `roadmap activate` may demote an existing active roadmap to `INACTIVE`.
- `plan lock` converts a draft into a formal governance contract.
- `exec lock` freezes execution evidence.
- `close lock` may automatically lock the roadmap.

Without preflight, the Director may authorize one action while not realizing its full side effect.

### Recommended Commands Requiring Minimal Preflight

| Command | Reason |
| :--- | :--- |
| `sigma intent lock` | Opens a formal governance target. |
| `sigma roadmap activate` | Changes the active execution backbone and may demote another roadmap. |
| `sigma plan lock` | Converts FMN-PLAN into an immutable work contract. |
| `sigma exec lock` | Converts DEV-EXEC into final implementation evidence. |
| `sigma close lock` | Closes lifecycle and may auto-lock ROADMAP. |

### Special Case: `close lock`

`close lock` needs the strongest preflight because it may lock both closure and roadmap.

Suggested output:

```text
Close Lock Preflight

Artifact to lock:
  DIR-CLOSE v1

Linked roadmap:
  ROADMAP v1 ACTIVE

Side effects:
  - DIR-CLOSE v1 will become LOCKED
  - ROADMAP v1 will become LOCKED
  - No more plans can be added to ROADMAP v1
  - Project lifecycle will be considered closed

Open stages:
  0

Deferred / inactive stages:
  2

Type APPROVE to continue.
```

### Recommended Design Position

Do not remove Proposal 6 entirely.

Revise it to:

```text
Minimal lock/activation preflight is required for authority-sensitive commands.
No large shared preflight infrastructure is required.
Each command may render its own concise preflight summary.
```

---

## 4. Sigma Version Naming Must Be Explained Explicitly

### Current Risk

Sigma uses artifact versions such as:

```text
DIR-INTENT v1
ROADMAP v1
FMN-PLAN v1.1
DEV-EXEC v1.1
```

To an external reader, this looks like software/product semantic versioning. It is not.

If this is not explicitly documented, new users and AI roles may misinterpret artifact versions as product release versions.

### Recommended Explanation

Add this wording to README / SIGMA_PROTOCOL:

```text
Sigma artifact versions are governance coordinates, not product release versions.

Major version identifies the current Director intent target.
Minor version identifies the sequence of planning and execution documents created while moving toward that target.
```

### Example

```text
DIR-INTENT v1
ROADMAP v1
FMN-PLAN v1.1
FMN-PLAN v1.2
DEV-EXEC v1.1
DEV-EXEC v1.2

This does not mean the product is version 1.2.
It means the project is executing the second plan under Intent/Roadmap v1.
```

### Why This Matters

This helps prevent:

- confused documentation
- incorrect release notes
- AI treating Sigma artifact versions as software versions
- roadmap/plan version interpretation errors
- mismatch between governance history and product release lifecycle

---

## 5. Enforce State / Document Consistency

### Current Risk

A central concern is mismatch between runtime state and document content.

Example failure mode:

```text
progress.json says:
  FMN-PLAN v1.12 exists and is linked to ROADMAP v1

But ROADMAP-v1.md does not contain:
  ## Stage 1.12 — ...
```

This creates false governance truth.

Sigma would appear traceable in JSON while the human-readable roadmap is outdated.

### Recommended Invariant

```text
If a PLAN is registered in progress.json,
then the FMN-PLAN file must exist,
and the matching ROADMAP H2 stage section must exist.
```

### Recommended `plan new` Write Order

`progress.json` should be written last.

Recommended sequence:

```text
1. Validate gates.
2. Compute next plan version.
3. Prepare FMN-PLAN file content.
4. Prepare updated ROADMAP file content with new H2 stage stub.
5. Write FMN-PLAN file.
6. Write ROADMAP file.
7. Render ROADMAP derived sections.
8. Write progress.json last.
```

If any artifact write fails, `progress.json` should not claim success.

### Why This Matters

`progress.json` is runtime truth. If it is updated before the artifact files are safely written, Sigma can desynchronize itself.

This is especially important because ROADMAP is becoming the trace backbone for documentation, closure, and AI orientation.

---

## 6. ROADMAP Reconciliation Should Exist

### Current Need

Even with correct `plan new` behavior, manual edits or migration can still create mismatch.

Sigma needs a way to check whether ROADMAP document content matches `progress.json`.

### Recommended Command

```bash
sigma roadmap reconcile --check
```

Optional later:

```bash
sigma roadmap reconcile --fix
```

### Recommended Check

The command should verify two directions:

```text
Every PLAN in progress.json must have a matching H2 stage in ROADMAP.
Every ROADMAP H2 stage must map to a known PLAN version or pending/legacy marker.
```

### Recommended Stage Marker

Current proposal uses:

```markdown
## Stage X.Y — Title
```

This is acceptable and human-readable.

If stronger machine safety is desired later, add an HTML marker above the H2:

```markdown
<!-- SIGMA:PLAN version=v1.12 artifact=FMN-PLAN-v1.12 -->
## Stage 1.12 — Title
```

The H2 remains the human-facing atomic unit; the comment becomes the machine-safe anchor.

### Blocking Behavior

Suggested policy:

| Command | Behavior if ROADMAP mismatch exists |
| :--- | :--- |
| `sigma project status` | Warn only. |
| `sigma session bootstrap` | Warn only. |
| `sigma plan lock` | Block. |
| `sigma exec new` | Block. |
| `sigma close lock` | Block. |
| `sigma roadmap render` | Warn or fail depending on severity. |

---

## 7. `sync roadmap` Should Be Treated as One-Time Migration

### Current Understanding

`sync roadmap` exists because there are already live Sigma projects using the older roadmap format. There may be no cleaner way to migrate those projects.

The intended migration flow is:

```text
1. Generate a new Sigma-managed ROADMAP.
2. Register it correctly.
3. Reconstruct H2 sections from existing plans.
4. Copy H3 content from the old roadmap into the new one.
5. Delete or retire the old roadmap.
```

This is acceptable as a migration-only path.

### Recommendation

Document clearly:

```text
sigma sync roadmap is not normal workflow.
It is a one-time migration command for legacy projects.
```

### Safety Recommendation

Even if the old roadmap is eventually deleted, the command should make loss of content difficult.

Minimum recommendation:

```text
Before replacing ROADMAP-vX.md, create a temporary backup or require explicit APPROVE.
```

Suggested confirmation:

```text
This command will regenerate ROADMAP v1 into Sigma-managed format.

Existing roadmap content may require manual H3 migration.

Type APPROVE to continue.
```

---

## 8. Batch B Context: What Should Not Be Prematurely Implemented Yet

Since implementation is currently around Batch B, avoid prematurely locking Batch D/E design details until the roadmap lifecycle decisions are updated.

### Safe for Batch B

The following remain safe and coherent:

```text
P2 — simplify DEV-EXEC state machine
P11 — remove decision memory system
P17 — simplify CSO tracking
```

These are mostly removal/simplification work and do not depend heavily on the final roadmap lifecycle design.

### Should Be Revisited Before Batch D/E

Before implementing roadmap infrastructure and plan behavior, revisit:

```text
P4  — ROADMAP mandatory gate and lifecycle
P5  — multiple draft plans + FIFO + pending staging
P6  — minimal preflight
P13 — auto-append stage stub on plan new
P14 — roadmap render
P18 — sync roadmap migration
```

The most important dependency is P4. If ROADMAP lifecycle changes from `DRAFT → LOCKED` to `DRAFT → ACTIVE → INACTIVE → LOCKED`, downstream commands must reflect that from the start.

---

## Final Recommendation

The Sigma Phase 2 direction is good and should continue.

The core correction is not to reduce the roadmap design. The correction is to make the roadmap lifecycle precise enough for real commercial projects where closure is not always performed before a new intent begins.

Recommended final model:

```text
DIR-INTENT v1 LOCKED
  ↓
ROADMAP v1 DRAFT
  ↓ activate
ROADMAP v1 ACTIVE
  ↓
FMN-PLAN v1.1 / v1.2 / v1.3 official FIFO queue
  ↓
DEV-EXEC linked by plan_version_ref
  ↓ optional closure
DIR-CLOSE v1 LOCKED
  ↓
ROADMAP v1 LOCKED

Or without closure:

DIR-INTENT v2 LOCKED
ROADMAP v2 DRAFT
  ↓ activate
ROADMAP v1 ACTIVE → INACTIVE
ROADMAP v2 DRAFT  → ACTIVE
```

Recommended PLAN model:

```text
Pending Plan
  ↓ promote
Official Draft Plan
  ↓ FIFO lock
Locked Plan
  ↓ exec
Locked Exec
```

Recommended key invariants:

```text
Only one ROADMAP may be ACTIVE at a time.
Only ACTIVE ROADMAP may receive new official PLAN artifacts.
INACTIVE ROADMAP is readable but not writable for new plans.
LOCKED ROADMAP is immutable.
Official PLAN lock is FIFO.
Future immature work belongs in pending plans.
progress.json must not claim a plan exists unless the PLAN file and ROADMAP H2 section exist.
close lock must clearly disclose that it will auto-lock ROADMAP.
```

These revisions preserve Sigma's strict governance model while making the system more realistic for long-running commercial projects.
