# Phase 7 Findings

**Date**: 2026-05-17
**Status**: All findings resolved

---

## Drift Findings

### F-01: `sigma project status` missing "Next Valid Operations" section

**Type**: CLI gap vs AC-11 (first-time user acceptance test)

**Description**: `sigma project status` showed lifecycle phase, artifact states, and gate status, but did not show "Next Valid Operations." Only `sigma session bootstrap` included this section. A first-time user reading only `sigma project status` would see all gates BLOCKED but would not know that `sigma intent new` is the next step.

AC-11 requires: "At each state, `sigma project status` output must include... What the next valid action is."

**Source of truth**: CLI must match AC-11. `getNextValidOperations()` was already available in `../engine/progress` — same function used by session bootstrap.

**Resolution**: PATCHED — added `getNextValidOperations` import and "Next Valid Operations" section to `runStatus()` in `src/commands/project.ts`.

**Verified**: All three FTU test states pass after patch.

---

## Protocol Accuracy Checks

| Section | Finding | Resolution |
| :--- | :--- | :--- |
| Lifecycle phases | CLI lifecycle labels (DESIGN/BUILD/CLOSE/CLOSED) match protocol | N/A |
| Gate conditions | All 3 gates enforced correctly per protocol | N/A |
| State machine | DRAFT→LOCKED, DRAFT→BUILDING→TESTING→COMPLETED→LOCKED transitions work | N/A |
| Auto-supersede | Prior LOCKED intent correctly marked SUPERSEDED on new version lock | N/A |
| STALE_INTENT | Warning fires in bootstrap when plan refs superseded intent | N/A |
| Folder structure | `design/`, `build/`, `close/` match SIGMA_PROTOCOL.md Section 20 | N/A |
| Naming convention | `DIR-INTENT-v1.md`, `FMN-PLAN-v1.md` etc. match protocol (PROJECT_ID excluded by design) | N/A |
| CLI command surface | All commands in SIGMA_PROTOCOL.md present in `sigma --help` | N/A |
| Memory harvest | `decisions.jsonl` written on all 4 lock events with correct fields | N/A |
| CSO behavior | Timestamped file created in `Sigma/logs/` | N/A |
| Git evidence | Read-only; no progress.json state changes | N/A |
| Audit commands | `plan audit`, `exec audit`, `close audit` — advisory only, no state changes | N/A |

---

## DI Success Criteria Results

| # | Criterion | Result |
| :--- | :--- | :--- |
| SC-01 | End-to-end workflow defined and implementable | PASS — walkthrough completed without CLI errors |
| SC-02 | Required artifact types defined | PASS — DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE, CSO, ROADMAP all in registry and templates |
| SC-03 | Role responsibilities clear | PASS — ARC/FMN/DEV/AUD rule files present in `Sigma/rules/` |
| SC-04 | Runtime state minimal but sufficient | PASS — `progress.json` contains lifecycle state, artifact versions, gate flags only |
| SC-05 | Evidence requirements prevent false closure | PASS — `sigma close new` blocked unless full INTENT→PLAN→EXEC chain LOCKED |
| SC-06 | Sigma architecturally separate from Delta Full | PASS — see separation check below |

---

## Sigma vs Delta Separation Results

| Check | Result |
| :--- | :--- |
| Binary names distinct | PASS — `sigma` vs `delta`, separate executables |
| Command domains | PASS — no shared subcommand names at OS level |
| Project folder | PASS — `Sigma/` vs `Delta/`, no overlap |
| Global directories | PASS — `~/.sigma/` vs `~/.delta/`, separate registries |
| Runtime state | PASS — `sigma project start` does not touch `~/.delta/` |
| MCP memory files | PASS — `memory_sigma.jsonl` vs `memory_delta.jsonl` (separate) |
| npm package names | PASS — `sigma-cli` (Sigma) vs Delta package |

---

## First-Time User Acceptance Test Results

| State | `sigma project status` shows next action | Result |
| :--- | :--- | :--- |
| A: Fresh project | `sigma intent new` listed under Next Valid Operations | PASS (after F-01 patch) |
| B: INTENT locked, no PLAN | `sigma plan new` listed under Next Valid Operations | PASS (after F-01 patch) |
| C: Full chain locked, no CLOSE | `sigma close new` listed under Next Valid Operations | PASS (after F-01 patch) |

---

## Open Items

None. All findings resolved.
