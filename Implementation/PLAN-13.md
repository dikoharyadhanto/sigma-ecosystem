# PLAN-13 — Bug Fixes & Improvements (Cross-Phase)

> **Phase**: Cross-Phase (impacts Phase 3–5 CLI)
> **Source**: `Discussion/SIGMA_BUGS.md` — curated by FMN, 2026-05-18
> **Priority**: Bug 1 is a design flaw and must be fixed before Phase 4 gate testing
> **Gate**: DEV to implement; FMN reviews test results; Director approves lock

---

## Objective

Fix 4 bugs and implement 2 improvements discovered during FMN session (MO2 Hardlink Builder project). All items affect the Sigma CLI (`sigma-cli` v0.9.0) and its interaction with `progress.json`, `decisions.jsonl`, CSO creation, and role bootstrap protocol.

---

## Deliverables

| # | Item | Type | Severity | Affected CLI Domain | Status |
|---|---|---|---|---|---|
| 1 | Gate 2 Lock Order — PLAN locked before EXEC verification | Bug | **High** | `plan`, `exec` | TODO |
| 2 | `sigma send --message` truncates multi-line content | Bug | Medium | `send` | TODO |
| 3 | `decisions.jsonl` — no read command | Bug | Medium | `decision` / `memory` | TODO |
| 4 | `sigma plan lock` captures director_notes prematurely | Bug | Low | `plan` | TODO |
| 5 | CSO auto-population from `progress.json` | Improvement | — | `cso` | TODO |
| 6 | Bootstrap checklist — add `decisions.jsonl` | Improvement | — | Rules files | TODO |

---

## Design Constraints

| Constraint | Rule | Source |
|---|---|---|
| Director is sole lock authority | No AI role may lock any artifact without explicit Director authorization | SIGMA_PROTOCOL.md §14 |
| FMN-PLAN Sections 1–9 immutable after lock | `sigma plan lock` freezes Sections 1–9 | PLAN-1 (Task 2) |
| FMN-PLAN Section 10 append-only after lock | Director observations can be added post-lock | PLAN-1 (Task 2) |
| FMN-PLAN + DEV-EXEC multi-active | Manual supersede only; locking new version does NOT supersede old | SIGMA_PROTOCOL.md §8 |
| decisions.jsonl is CLI-managed | Agents read via CLI command; never write directly | SIGMA_PROTOCOL.md §24 |
| CSO is optional, never a workflow gate | Advisory/handoff only | SIGMA_PROTOCOL.md §18 |
| Bootstrap Protocol mandatory for governance roles | ARC/FMN/DEV must run `sigma session bootstrap` at session start | FMN-RULE.md, DEV-RULE.md |

---

## Task 1 — Fix Bug 1: Gate 2 Lock Order (High)

### Current Behavior

```
FMN-PLAN DRAFT → sigma plan lock → LOCKED (Sections 1–9 frozen) → sigma exec new
```

FMN-PLAN can be locked BEFORE DEV-EXEC is created. Once locked, Sections 1–9 are immutable — DEV cannot request test contract changes even if implementation reveals a flaw.

### Root Cause

`sigma plan lock` does two things simultaneously: (a) records Director approval in `decisions.jsonl`, and (b) freezes Sections 1–9. These should be separate operations.

### Expected Behavior

```
FMN-PLAN DRAFT
    → Director APPROVE (record to decisions.jsonl, NO freeze)
    → DEV sigma exec new → implement → test → DEV-EXEC complete
    → Director sigma plan lock (freeze Sections 1–9 + open Gate 2)
```

The `approve` step records Director's acceptance of the plan to the decision log without freezing sections. Sections 1–9 remain editable so FMN can refine the test contract based on DEV feedback during implementation. The actual lock (freeze) happens AFTER DEV has verified the plan is accurate through EXEC.

### Implementation

| Step | Command | Effect |
|---|---|---|
| 1 | `sigma plan approve` (NEW) | Records to `decisions.jsonl`, marks `plan_approved: true` in progress.json. Does NOT freeze sections. |
| 2 | `sigma exec new` | Gate check: `plan_approved` must be true (not `plan_locked`). Creates DEV-EXEC draft. |
| 3 | DEV implements, tests, completes | Normal DEV workflow |
| 4 | `sigma plan lock` | Freezes Sections 1–9. Opens Gate 2 formally. Requires `plan_approved` + `exec_completed`. |

### Files to Change

| File / Component | Action | Purpose |
|---|---|---|
| `src/commands/plan.ts` | Modify | Split `plan lock` into `plan approve` + `plan lock`. Add new `plan approve` command. |
| `src/commands/exec.ts` | Modify | Gate check: require `plan_approved` instead of `plan_locked` for `exec new`. |
| `src/utils/state.ts` | Modify | Add `plan_approved` field to progress.json workflow_state. |
| `progress.json` schema | Modify | Add `plan_approved: boolean` to `workflow_state`. |
| `SIGMA_PROTOCOL.md` §7 | Modify | Update Gate 2 wording: `plan_approved` required before `exec new`; `plan_locked` required before Gate 3. |

### Migration

Existing projects with already-locked FMN-PLAN: `plan_locked=true` implies `plan_approved=true`. CLI must handle backward compatibility by treating locked plans as implicitly approved.

### Acceptance Criteria

- [ ] `sigma plan approve` exists and writes to `decisions.jsonl`
- [ ] `sigma plan approve` does NOT freeze Sections 1–9 — FMN can still edit
- [ ] `sigma exec new` gate checks `plan_approved`, not `plan_locked`
- [ ] `sigma plan lock` requires `plan_approved` + DEV-EXEC must exist and be `COMPLETED`
- [ ] `sigma plan lock` freezes Sections 1–9 (same behavior as before)
- [ ] Backward compatible: locked plans from pre-fix projects are treated as approved

---

## Task 2 — Fix Bug 2: `sigma send --message` truncates multi-line content (Medium)

### Current Behavior

`sigma send --message "line1\nline2\nline3"` truncates after the first line or fails to parse newlines correctly.

### Root Cause

Likely shell escaping issue — `--message` value is parsed as a single argument and newline characters are lost during argument parsing.

### Expected Behavior

`sigma send --message` should accept multi-line content. Alternatively, `--message-file <path>` (already exists as workaround) should be documented as the primary method for multi-line content, and `--message` should be documented as single-line only.

### Implementation

| Step | Action |
|---|---|
| 1 | Investigate argument parsing in `src/commands/send.ts` |
| 2 | If fixable: support `\n` escape sequences in `--message` |
| 3 | If not fixable (OS-level limitation): document `--message` as single-line only; promote `--message-file` as canonical multi-line method |
| 4 | Add validation: if `--message` contains literal newlines, print warning pointing to `--message-file` |

### Files to Change

| File / Component | Action | Purpose |
|---|---|---|
| `src/commands/send.ts` | Modify | Fix parsing or add warning. |
| `SIGMA_README.md` | Modify | Document `--message` vs `--message-file`. |
| `sigma --help` output | Modify | Update help text. |

### Acceptance Criteria

- [ ] Multi-line content via `--message-file` works and is documented
- [ ] `--message` either supports `\n` or prints clear warning with pointer to `--message-file`
- [ ] Help text is unambiguous

---

## Task 3 — Fix Bug 3: `decisions.jsonl` — no read command (Medium)

### Current Behavior

CLI WRITES to `Sigma/memory/decisions.jsonl` on lock events (`sigma intent lock`, `sigma plan lock`, `sigma override`), but there is NO CLI command to READ it. Agents must use `read_file("Sigma/memory/decisions.jsonl")` to inspect decision history.

### Expected Behavior

A new command `sigma decision log` that displays:
- All lock events with timestamp
- Director notes per artifact
- Risk notes and evidence references
- Filterable by artifact type or version

### Implementation

| Step | Action |
|---|---|
| 1 | Add `src/commands/decision.ts` with `sigma decision log` command |
| 2 | Read `Sigma/memory/decisions.jsonl`, parse JSONL, format as readable output |
| 3 | Support filters: `--artifact intent|plan|exec|close`, `--v <version>`, `--latest` |
| 4 | Default output: timestamp, artifact, version, director_notes summary |

### CLI Design

```bash
sigma decision log                          # All decisions, latest first
sigma decision log --artifact plan          # Only FMN-PLAN decisions
sigma decision log --v 0.1                  # Specific version
sigma decision log --latest                 # Most recent decision only
sigma decision log --since 2026-05-01       # Date filter
```

### Files to Change

| File / Component | Action | Purpose |
|---|---|---|
| `src/commands/decision.ts` | Create | New decision log command. |
| `src/cli.ts` | Modify | Register `decision` domain. |
| `SIGMA_PROTOCOL.md` §24 + §23 | Modify | Add `sigma decision log` to memory layer and CLI command tables. |
| `SIGMA_README.md` | Modify | Document `sigma decision log`. |

### Acceptance Criteria

- [ ] `sigma decision log` displays all lock events from `decisions.jsonl`
- [ ] Filter `--artifact` works for intent/plan/exec/close
- [ ] Filter `--v <version>` works
- [ ] Output is human-readable (table format)
- [ ] Empty decisions.jsonl shows "No decisions recorded" (not error)

---

## Task 4 — Fix Bug 4: `sigma plan lock` captures director_notes prematurely (Low)

### Current Behavior

When `sigma plan lock` runs, CLI reads FMN-PLAN Section 10 (Director Observation Testing Report) and saves it as `director_notes` in `decisions.jsonl`. But Section 10 is designed as **append-only post-lock** — Director observations added AFTER lock won't be captured.

### Root Cause

Lock happens too early (see Bug 1). When lock occurs after Director observations are complete, Section 10 will be fully populated.

### Implementation

**Dependency**: Bug 1 must be fixed first. Once `sigma plan lock` requires DEV-EXEC completion, Section 10 will naturally be filled before lock.

If Bug 1 is not yet fixed, apply a lightweight patch:

| Step | Action |
|---|---|
| 1 | In `sigma plan lock`, read Section 10 AND Section 11 (Director Follow-Up Decision Notes) |
| 2 | Append both to `director_notes` field in decisions.jsonl |
| 3 | Document that `director_notes` captures at-lock snapshot only; post-lock observations are in the FMN-PLAN file |

### Files to Change

| File / Component | Action | Purpose |
|---|---|---|
| `src/commands/plan.ts` | Modify | Read Sections 10+11 for decision log capture. |
| `SIGMA_PROTOCOL.md` | Modify | Note: `director_notes` = at-lock snapshot; full history is in FMN-PLAN file. |

### Acceptance Criteria

- [ ] `sigma plan lock` captures Section 10 + Section 11 content in `director_notes`
- [ ] Documentation clarifies that `director_notes` is an at-lock snapshot
- [ ] No data loss — if Bug 1 is fixed, this is automatically resolved

---

## Task 5 — Improvement 1: CSO Auto-Population

### Current Behavior

`sigma cso new` creates a CSO from `Sigma/templates/CSO-TEMPLATE.md`. The template contains placeholders (`[ROLE]`, `[YYYYMMDDHHMM]`) that must be filled manually by the agent.

### Expected Behavior

`sigma cso new --role <ARC|AUD|FMN|DEV|DIR>` auto-fills:
- `Created By Role` → from `--role` flag
- `Created At` → current timestamp
- `Runtime State` → DRAFT
- `Related Artifact` → detected from active artifact in `progress.json`
- `Related Artifact State` → LOCKED/DRAFT from `progress.json`

### Implementation

| Step | Action |
|---|---|
| 1 | Modify `sigma cso new` to read `progress.json` for active artifact context |
| 2 | Auto-populate known fields; leave rest as template placeholders |
| 3 | If `--role` is omitted, prompt or error (role is mandatory for CSO) |

### Files to Change

| File / Component | Action | Purpose |
|---|---|---|
| `src/commands/cso.ts` | Modify | Read progress.json, auto-fill template fields. |
| `CSO-TEMPLATE.md` | Verify | Ensure placeholders are compatible with auto-fill. |

### Acceptance Criteria

- [ ] `sigma cso new --role FMN` auto-fills Role, Timestamp, Runtime State
- [ ] Related Artifact is detected from `progress.json` active artifact
- [ ] Fields that cannot be auto-detected remain as placeholders (no false data)
- [ ] Without `--role`, CLI errors with clear message

---

## Task 6 — Improvement 2: Bootstrap Checklist Update

### Current Behavior

Governance role rules (FMN-RULE.md, DEV-RULE.md, ARC-RULE.md) specify a Bootstrap Protocol at session start. The checklist includes:
1. `sigma session bootstrap`
2. Active DIR-INTENT
3. CSO cross-role check

But does NOT include `Sigma/memory/decisions.jsonl`.

### Expected Behavior

Bootstrap checklist for all governance roles (ARC, FMN, DEV) should include `decisions.jsonl` as a mandatory read. This ensures agents are aware of recent Director decisions before acting.

### Updated Bootstrap Protocol

```
1. sigma session bootstrap --role <ARC|FMN|DEV>
2. Sigma/memory/decisions.jsonl          ← NEW
3. Active DIR-INTENT
4. CSO cross-role check (ARC/FMN/DEV only; AUD is passive)
```

### Files to Change

**Rule files (Sigma/rules/):**

| File | Action | Purpose |
|---|---|---|
| `Sigma/rules/ARC-RULE.md` | Modify | Add `decisions.jsonl` to Bootstrap. |
| `Sigma/rules/FMN-RULE.md` | Modify | Add `decisions.jsonl` to Bootstrap. |
| `Sigma/rules/DEV-RULE.md` | Modify | Add `decisions.jsonl` to Bootstrap. |

**Skill files (setup/targets/ — 6 files across 3 platforms):**

| File | Action | Purpose |
|---|---|---|
| `setup/targets/claude_code/fmn.md` | Modify | Add `sigma decision log` to Bootstrap Protocol. |
| `setup/targets/claude_code/dev.md` | Modify | Add `sigma decision log` to Bootstrap Protocol. |
| `setup/targets/antigravity/fmn.md` | Modify | Add `sigma decision log` to Bootstrap Protocol. |
| `setup/targets/antigravity/dev.md` | Modify | Add `sigma decision log` to Bootstrap Protocol. |
| `setup/targets/reasonix/fmn.md` | Modify | Add `sigma decision log` to Bootstrap Protocol. |
| `setup/targets/reasonix/dev.md` | Modify | Add `sigma decision log` to Bootstrap Protocol. |

> **ARC skill files** tidak perlu diupdate — ARC membaca `decisions.jsonl` sebagai bagian dari `sigma session bootstrap --role arc`, yang sudah mencakup semua artifact state. ARC tidak perlu pengecekan terpisah.
>
> **AUD skill files** tidak perlu diupdate — AUD bootstrap bersifat pasif, membaca hanya yang diberikan Director.

**Discussion drafts (sync):**

| File | Action | Purpose |
|---|---|---|
| `Discussion/ARC-RULE.md` | Modify | Sync change. |
| `Discussion/FMN-RULE.md` | Modify | Sync change. |
| `Discussion/DEV-RULE.md` | Modify | Sync change. |

### Updated Bootstrap Protocol (FMN + DEV skill files)

```
1. Query sigma-memory MCP: search_nodes + read_graph
2. Run sigma --help to verify current command syntax
3. Run sigma session bootstrap to read project state
4. Run sigma decision log --latest     ← NEW (or read Sigma/memory/decisions.jsonl)
5. Report lifecycle phase, active artifact versions, gate blockers, and latest decision
```

### Acceptance Criteria

- [ ] ARC-RULE.md Bootstrap lists `decisions.jsonl`
- [ ] FMN-RULE.md Bootstrap lists `decisions.jsonl`
- [ ] DEV-RULE.md Bootstrap lists `decisions.jsonl`
- [ ] 3 FMN skill files (`claude_code`, `antigravity`, `reasonix`) include `sigma decision log --latest` in Bootstrap
- [ ] 3 DEV skill files (`claude_code`, `antigravity`, `reasonix`) include `sigma decision log --latest` in Bootstrap
- [ ] AUD-RULE.md + AUD skill files NOT modified
- [ ] ARC skill files NOT modified (covered by `sigma session bootstrap`)
- [ ] Discussion drafts synced with rule files

---

## Execution Order

```
Task 1 (Bug 1: Gate 2 Lock Order) → MUST BE FIRST
    ↓ (unblocks Task 4)
Task 4 (Bug 4: director_notes premature) → DEPENDS ON Task 1
    ↓
Task 3 (Bug 3: decisions.jsonl read command)
Task 2 (Bug 2: sigma send --message)        → independent
Task 5 (CSO auto-population)                 → independent
Task 6 (Bootstrap checklist)                 → independent
```

Tasks 2, 3, 5, 6 can run in parallel after or alongside Task 1.
Task 4 must wait for Task 1 to complete.

---

## Acceptance Criteria (Director Gate)

Before this PLAN is considered complete:

- [ ] Bug 1: `sigma plan approve` works; `sigma plan lock` requires EXEC completed
- [ ] Bug 2: Multi-line message handling documented or fixed
- [ ] Bug 3: `sigma decision log` exists and displays readable output
- [ ] Bug 4: `director_notes` captures post-lock observations (or resolved by Bug 1)
- [ ] Improvement 1: CSO auto-fill works for known fields
- [ ] Improvement 2: All governance role rules include `decisions.jsonl` in Bootstrap
- [ ] All changes reflected in `SIGMA_PROTOCOL.md` and `SIGMA_README.md`
- [ ] Existing tests pass (or updated)
- [ ] Backward compatible: existing locked projects continue to work

---

*Created: 2026-05-18 — FMN PLAN for Bug Fixes (Source: SIGMA_BUGS.md)*
