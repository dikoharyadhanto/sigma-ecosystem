# Implementation Plan — Phase 7: Validation & Dogfooding

**Phase**: 7 of 7
**Goal**: Verify the complete Sigma lifecycle end-to-end — simulated project walkthrough, DI success criteria verification, Sigma vs Delta separation check, protocol accuracy review, and first-time user acceptance test. No new features. Patches only where drift is found. Version bump 0.6.0 → 0.7.0 on clean pass.
**Status**: PENDING
**Prerequisites**: Phase 6 complete — all 24 skill files deployed, bridge files real, npm package finalized, SIGMA_README.md written

---

## Source Material

| File | Role |
| :--- | :--- |
| `sigma_phase_implementation.md` Phase 7 | Authoritative task list and success criteria for this phase |
| `Intent/DIR-DI-000-SIGMA-v1.0.md` | 6 original DI success criteria — each must be verified against final implementation |
| `Sigma/SIGMA_PROTOCOL.md` | Protocol spec — verified against actual CLI behavior during walkthrough |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Machine contract — verified against CLI command surface |
| `Sigma/progress.json` | State engine — verified for correct transitions and gate enforcement |
| `I:\Works\Project\delta-ecosystem\` | Reference: Delta command surface and binary name — used for separation check |
| `package.json` | Binary name, version, files array |

---

## Design Decisions

### 1. What "Validation" Means in Phase 7

Phase 7 is not a formal QA pass or a test suite run. It is a structured dogfooding exercise:

- Run the actual `sigma` CLI against a real project directory
- Observe what happens at each lifecycle step
- Verify the protocol document matches what the CLI actually does
- Identify any gaps, stale copy, or missing behavior
- Patch only what is broken or drifted — no feature additions

**Scope boundary**: If a test exposes a missing feature that was never in scope, that is a new issue tracked for a future phase, not a Phase 7 task. Phase 7 patches only drift and inaccuracy.

### 2. Simulated Project is Separate from sigma-ecosystem

The end-to-end walkthrough runs in a **fresh temporary directory**, not the sigma-ecosystem project root. This avoids governance state contamination in the project being used to build Sigma.

The walkthrough directory is deleted after Phase 7 unless the Director wants to preserve it as a reference.

### 3. Protocol Accuracy Review Is a Read-Compare-Patch Loop

The review does not aim to rewrite SIGMA_PROTOCOL.md. It reads each section and checks whether the described behavior matches the implemented CLI. For each discrepancy found:

- If CLI is wrong: patch CLI, re-test
- If protocol is wrong: patch protocol section with minimal correction
- If both are wrong: fix CLI first, then align protocol

### 4. First-Time User Test Has a Hard Pass/Fail Criterion

From `sigma_phase_implementation.md`:

> A user who has not read SIGMA_PROTOCOL.md must be able to determine the next valid action solely from `sigma project status` or `sigma session bootstrap` output.

If this fails, Phase 7 is not complete. The output of those two commands must be self-explaining without reference to the protocol doc.

---

## Phase 7 Output Files

| File | Action | Description |
| :--- | :--- | :--- |
| `Implementation/PLAN-7-WALKTHROUGH.md` | Create | Step-by-step walkthrough log with actual CLI output for each step |
| `Implementation/PLAN-7-FINDINGS.md` | Create | Drift findings from protocol accuracy review + first-time user test |
| `Sigma/SIGMA_PROTOCOL.md` | Patch (if needed) | Correct any sections where documented behavior drifts from CLI |
| `src/commands/*.ts` | Patch (if needed) | Fix CLI behavior where it diverges from protocol or produces unclear output |
| `src/config.ts` | Update | SIGMA_VERSION bump to `0.7.0` on clean validation pass |
| `package.json` | Update | Version bump to `0.7.0` on clean validation pass |

---

## Task 1 — Environment Preparation

Before running the walkthrough:

1. Run `npm run build` — confirm 0 TypeScript errors
2. Run `npm install -g .` from the `sigma-ecosystem/` project root to install the current build globally
3. Verify `sigma --help` outputs the full command surface without errors
4. Create a fresh temporary directory outside the sigma-ecosystem root (e.g., `C:\Temp\sigma-test-project\`)
5. `cd` into that directory for all walkthrough commands

Do not use the sigma-ecosystem project itself for walkthrough state — `Sigma/progress.json` already tracks the real project governance.

---

## Task 2 — End-to-End Lifecycle Walkthrough

Run the full Sigma lifecycle in the test directory. Log each command and its actual output in `PLAN-7-WALKTHROUGH.md`.

### Step sequence

```
sigma project start
sigma project status
sigma session bootstrap
sigma intent new
  → Edit the created DIR-INTENT draft (add real intent content)
sigma intent status
sigma intent list
sigma intent lock
sigma project status
  → Verify gate_1_open == true after intent lock
sigma plan new
  → Edit the created FMN-PLAN draft (add task plan + test contract skeleton)
sigma plan status
sigma plan audit
sigma plan lock
sigma project status
  → Verify gate_2_open == true after plan lock
sigma exec new
  → Edit the created DEV-EXEC draft (add implementation plan + report skeleton)
sigma exec status
sigma exec advance building
sigma exec advance testing
sigma exec advance complete
sigma exec audit
sigma exec lock
sigma project status
  → Verify gate_3_open == true after exec lock
sigma close new
  → Edit the created DIR-CLOSE draft (add closure summary + evidence references)
sigma close status
sigma close audit
sigma close lock
sigma project status
  → Verify lifecycle phase shows CLOSED
sigma cso new
sigma git evidence
sigma roadmap new
  → Optional: verify roadmap commands work outside main lifecycle
```

### What to verify at each lock step

| Lock command | Expected gate change | Expected auto-supersede behavior |
| :--- | :--- | :--- |
| `sigma intent lock` | `gate_1_open` → true | Any prior LOCKED intent superseded if version incremented |
| `sigma plan lock` | `gate_2_open` → true | Any prior LOCKED plan superseded if version incremented |
| `sigma exec lock` | `gate_3_open` → true | Any prior LOCKED exec superseded if version incremented |
| `sigma close lock` | Lifecycle phase → CLOSED | Any prior LOCKED close superseded |

### Gate enforcement verification

After project start (before any lock):

- `sigma plan new` must be blocked (gate_1_open == false)
- `sigma exec new` must be blocked (gate_2_open == false)
- `sigma close new` must be blocked (gate_3_open == false)

After intent lock only:

- `sigma plan new` must succeed
- `sigma exec new` must still be blocked
- `sigma close new` must still be blocked

After intent + plan lock:

- `sigma exec new` must succeed
- `sigma close new` must still be blocked

After full chain locked:

- `sigma close new` must succeed

If any gate does not enforce correctly, fix CLI before continuing.

---

## Task 3 — DI Success Criteria Verification

Verify each of the 6 success criteria from `DIR-DI-000-SIGMA-v1.0.md` against the implemented system.

| # | Success Criterion | Verification Method | Pass/Fail |
| :--- | :--- | :--- | :--- |
| SC-01 | One end-to-end Sigma workflow defined clearly enough to be implemented | Walkthrough in Task 2 completes without CLI errors | — |
| SC-02 | Required artifact types defined | `SIGMA-REGISTRY.json` contains DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE, CSO; each has a template in `Sigma/templates/` | — |
| SC-03 | Strategy, audit, execution, testing, implementation, closure responsibilities clear | ARC-RULE.md, FMN-RULE.md, DEV-RULE.md, AUD-RULE.md each define the role's primary responsibility, scope boundary, and prohibited actions | — |
| SC-04 | Runtime state requirements minimal but sufficient | `progress.json` after walkthrough contains lifecycle phase, artifact versions, gate flags, STALE_INTENT flag — nothing more | — |
| SC-05 | Evidence requirements prevent false closure | `sigma close new` blocked unless INTENT + PLAN + EXEC locked (same version chain); verify this is enforced | — |
| SC-06 | Sigma architecturally separate from Delta Full | See Task 4 — Sigma vs Delta separation check | — |

Record pass/fail for each criterion in `PLAN-7-FINDINGS.md`.

---

## Task 4 — Sigma vs Delta Full Separation Check

Confirm Sigma does not bleed into Delta's namespace or runtime state.

| Check | Method | Expected Result |
| :--- | :--- | :--- |
| Binary name distinct | `which sigma` vs `which delta` | Different binaries; no shared entry point |
| Command surface distinct | `sigma --help` vs `delta --help` | No shared domain or subcommand names that could confuse AI operators |
| Folder structure distinct | Sigma uses `Sigma/`; Delta uses `Delta/` | No shared folder names at project root level |
| Runtime state isolated | `sigma project start` creates `Sigma/progress.json`; does not touch `Delta/` or `~/.delta/` | Confirm by running `sigma project start` in a directory that also has a Delta project |
| Global install isolated | `~/.sigma/` vs `~/.delta/` | No file sharing between global directories |
| MCP memory isolated | `~/.sigma/memory_sigma.jsonl` vs `~/.delta/memory_delta.jsonl` | Separate files; `sigma` commands only write to sigma file |
| npm package names distinct | `package.json` name field vs Delta's | `sigma-cli` not conflicting with Delta package name |

If any overlap is found, record in `PLAN-7-FINDINGS.md` and patch before marking Phase 7 complete.

---

## Task 5 — Protocol Accuracy Review

Read-compare-patch loop: for each SIGMA_PROTOCOL.md section, verify the described behavior matches what the CLI actually does after the walkthrough.

### Sections to verify

| Section | What to check |
| :--- | :--- |
| Lifecycle phases (START/DESIGN/BUILD/CLOSE) | `sigma project status` output matches phase labels |
| Gate conditions (gates 1–3) | Gate enforcement matches Task 2 observations |
| State machine per artifact | All DRAFT/LOCKED/SUPERSEDED transitions work as documented |
| Auto-supersede policy | Old LOCKED version correctly marked SUPERSEDED on new version lock |
| STALE_INTENT warning | If intent is superseded after plan is locked, `sigma close new` warns Director |
| Folder structure | `Sigma/` subfolders created by `sigma project start` match documented structure |
| CLI command surface | Every command in SIGMA_PROTOCOL.md exists in `sigma --help`; no documented command is missing or misnamed |
| Naming convention | Created artifact files match `{ROLE}-{DOC}-{PROJECT_ID}-v{VER}.md` pattern |
| Memory architecture | `decisions.jsonl` entries written on lock events; fields match documented harvest schema |
| CSO behavior | `sigma cso new` creates timestamped file in `Sigma/logs/`; `--from` flag accepted |
| Git evidence | `sigma git evidence` outputs branch, commit hash, changed files — read-only, no write side effects |
| AUD advisory-only | `sigma plan audit` / `sigma exec audit` / `sigma close audit` outputs advisory findings; does not change `progress.json` state |

For each discrepancy found:
1. Record in `PLAN-7-FINDINGS.md`
2. Determine whether CLI or protocol is the source of truth
3. Patch the non-authoritative side

---

## Task 6 — First-Time User Acceptance Test

**Hard criterion** (from Phase 7 spec): A user who has not read `SIGMA_PROTOCOL.md` must be able to determine the next valid action solely from `sigma project status` or `sigma session bootstrap` output.

### Test procedure

Run this test at three lifecycle states in the walkthrough project:

**State A** — Fresh project (no artifacts locked):
- Run `sigma project status`
- Evaluate: does the output clearly communicate what to do next without reading the protocol?

**State B** — INTENT locked, no PLAN yet:
- Run `sigma project status`
- Evaluate: does the output indicate PLAN gate is now open and `sigma plan new` is the next step?

**State C** — Full chain locked, CLOSE not started:
- Run `sigma project status`
- Evaluate: does the output indicate `sigma close new` is available and what the closure gate requires?

### Pass criteria

At each state, `sigma project status` output must include:
- Current lifecycle phase label
- What is locked and what is not
- Which gates are open
- What the next valid action is (at minimum: which domain is now unblocked)

If the output is ambiguous or requires protocol knowledge to interpret, the CLI output needs improvement. This is a patch task — not optional.

---

## Task 7 — Patch Integration

After Tasks 2–6, collect all findings from `PLAN-7-FINDINGS.md` and apply patches:

1. **CLI patches** — Modify relevant `src/commands/*.ts` files; rebuild; re-run the affected walkthrough step to verify the patch
2. **Protocol patches** — Edit `Sigma/SIGMA_PROTOCOL.md` to align with CLI behavior; minimal corrections only — no rewrites
3. **Registry patches** — If any operation in SIGMA-OPERATION-REGISTRY.json is missing or misspecified, update; run `sigma refresh` if that command exists

All patches must pass `npm run build` with 0 errors before marking Phase 7 complete.

---

## Task 8 — Version Bump

On clean pass (all acceptance criteria below met):

### 8a. `src/config.ts`
```typescript
export const SIGMA_VERSION = '0.7.0';
```

### 8b. `package.json`
```json
"version": "0.7.0"
```

Do not bump version until all acceptance criteria pass.

---

## Acceptance Criteria

| # | Criterion |
| :--- | :--- |
| AC-01 | `npm run build` passes with 0 TypeScript errors before walkthrough begins |
| AC-02 | `sigma --help` outputs full command surface with no runtime errors after global install |
| AC-03 | Full walkthrough (Task 2 step sequence) completes without CLI errors or unhandled exceptions |
| AC-04 | Gate enforcement verified: `sigma plan new` blocked before intent lock; `sigma exec new` blocked before plan lock; `sigma close new` blocked before full chain locked |
| AC-05 | All 6 DI success criteria from `DIR-DI-000-SIGMA-v1.0.md` verified PASS; results recorded in `PLAN-7-FINDINGS.md` |
| AC-06 | `progress.json` after walkthrough contains correct final state: lifecycle CLOSED, all artifacts LOCKED, gate flags reflect closed state |
| AC-07 | Auto-supersede: locking a new version of an artifact correctly marks the prior LOCKED version as SUPERSEDED |
| AC-08 | `decisions.jsonl` in `Sigma/memory/` contains entries for each lock event in the walkthrough, with correct artifact/version/timestamp fields |
| AC-09 | Sigma vs Delta separation check (Task 4) — all 7 checks pass; no namespace overlap or runtime state sharing found |
| AC-10 | Protocol accuracy review (Task 5) complete — all discrepancies recorded in `PLAN-7-FINDINGS.md`; no open drift items |
| AC-11 | First-time user acceptance test passes at all 3 states (Task 6): `sigma project status` output clearly communicates current phase and next valid action without requiring protocol knowledge |
| AC-12 | `sigma cso new` creates a timestamped `.md` file in `Sigma/logs/` with correct naming convention |
| AC-13 | `sigma git evidence` outputs branch, latest commit hash + message, and changed files — read-only, no state changes in `progress.json` |
| AC-14 | `sigma plan audit`, `sigma exec audit`, `sigma close audit` complete without errors and produce advisory findings output; `progress.json` state is unchanged after audit commands |
| AC-15 | `PLAN-7-WALKTHROUGH.md` created with actual CLI output logged at each step |
| AC-16 | `PLAN-7-FINDINGS.md` created; lists all drift findings with resolution status (PATCHED or N/A) |
| AC-17 | All patches applied in Task 7 pass `npm run build` with 0 errors and re-verified walkthrough steps succeed |
| AC-18 | `SIGMA_VERSION` in `config.ts` and `version` in `package.json` both read `"0.7.0"` |
| AC-19 | STALE_INTENT warning appears in `sigma close new` output when intent version has been superseded after plan was locked |
| AC-20 | `sigma roadmap new` and `sigma roadmap lock` execute without errors; roadmap state tracked in `progress.json` independently from the main intent/plan/exec/close chain |

---

*PLAN-7 — Phase 7: Validation & Dogfooding — drafted 2026-05-17*
