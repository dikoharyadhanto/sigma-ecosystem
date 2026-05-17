# PLAN-11 — Sigma Pre-Release Hardening: Missing Features from Delta

**Source**: `Discussion/sigma-missing-from-delta.md`  
**Date**: 2026-05-17  
**Status**: DRAFT

---

## Objective

Close the critical feature gaps identified by comparing Delta Ecosystem against Sigma Ecosystem.

Four gaps are blocking a clean public npm release. Three more are worth implementing after the initial release. This plan covers the full set, with priority tiers and task breakdown.

---

## Scope

### In scope — Priority 🔴 (before npm release)

- `.npmignore` — exclude dev/internal files from npm package
- Test suite — `vitest`-based integration tests for critical governance flows
- Cursor support — add `.cursor/rules/` as a `sigma setup install` target
- `sigma override` command — Director bypass mechanism with mandatory audit trail

### In scope — Priority 🟡 (post-release, planned)

- MCP config auto-generation during `sigma project start`
- `sigma session bootstrap` output improvements
- `sigma <artifact> flag / unflag` — lightweight artifact flagging

### Out of scope

- Delta features explicitly decided against: skills triple-gate, 6-role system, cascade quarantine, numbered folder structure, JavaScript/Python stack
- Any changes to governance gate logic or authorization language
- Changes to `Sigma/progress.json` schema

---

## Task Breakdown

---

### TASK-01 — Create `.npmignore`

**Files**: `.npmignore` (new, project root)

Create `.npmignore` to exclude development and internal files from npm publish.

```
# Development & internal docs
Discussion/
Intent/
Implementation/
.claude/
scripts/
sigma_phase_implementation.md

# Config & tooling
tsconfig.json
.gitignore

# Source (dist/ already includes compiled output)
src/

# Test files
test/
*.test.ts
*.spec.ts
```

Verification: run `npm pack --dry-run` after creation and confirm only `dist/`, `README.md`, `SIGMA_README.md`, `package.json`, `setup/`, and `Sigma/` (if applicable) are included.

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-01-1 | `.npmignore` exists at project root | `ls .npmignore` |
| AC-01-2 | `npm pack --dry-run` excludes `Discussion/`, `Implementation/`, `src/`, `.claude/` | Check pack output |
| AC-01-3 | `dist/` and essential files remain in pack | Check pack output |

---

### TASK-02 — Add Test Suite

**Files**: `package.json` (update scripts + devDependencies), `test/` (new folder), test files (new)

Add `vitest` as the test framework and write integration tests for the most critical Sigma governance flows.

#### Setup

Add to `package.json`:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
},
"devDependencies": {
  "vitest": "^1.x"
}
```

#### Test files to create

| File | Tests |
|---|---|
| `test/gate-enforcement.test.ts` | Gate blocks: `sigma plan new` fails if INTENT not LOCKED |
| `test/intent-lock.test.ts` | `sigma intent lock` writes correct state to `progress.json` |
| `test/chain-gate.test.ts` | Gate chain: INTENT → PLAN → EXEC enforced in order |
| `test/error-messages.test.ts` | Error output is human-readable, not raw stack trace |

#### Test approach

- Each test should run against the actual CLI binary (integration-style), not mocked internals
- Use a temp directory per test that simulates a `sigma project start` state
- Assert on CLI exit code and stdout/stderr content
- Port relevant patterns from Delta's test structure where applicable

#### Priority test cases

1. **Gate enforcement**: `sigma plan new` must exit non-zero with clear message if `DIR-INTENT` status is not `LOCKED`
2. **Intent lock mutation**: After `sigma intent lock`, `progress.json` must contain `{ "dirIntent": { "status": "LOCKED", ... } }`
3. **Chain gate**: Attempting `sigma exec start` before `FMN-PLAN` is `LOCKED` must be blocked at gate
4. **Error readability**: Any CLI error must not output a raw Node.js stack trace to stdout; error message must be human-readable

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-02-1 | `npm test` runs without configuration error | `npm test` |
| AC-02-2 | All 4 test files exist and pass | `npm test` output |
| AC-02-3 | Gate enforcement test fails for invalid lifecycle state | Test output |
| AC-02-4 | `progress.json` mutation test validates correct field structure | Test output |

---

### TASK-03 — Add Cursor Support to `sigma setup install`

**Files**: `src/commands/setup.ts` (install target logic), `setup/targets/cursor/` (new folder), bridge file(s) for Cursor

#### Context

Sigma currently supports: `claude_code`, `codex`, `reasonix`, `antigravity`.  
Cursor is missing despite being one of the largest AI coding tools by market share.

#### Changes

**1. Add Cursor as an install target in `sigma setup install`**

Update the target selection logic in `src/commands/setup.ts` to include `cursor` as a valid target.

Deploy destination: `.cursor/rules/` in the project directory.

**2. Create Cursor bridge file**

Create `setup/targets/cursor/SIGMA.mdc` (Cursor uses `.mdc` format for rules):

```markdown
---
description: Sigma governance rules for Cursor
alwaysApply: true
---

# Sigma Governance — Cursor Bridge

This project uses Sigma governance CLI.
Refer to SIGMA_README.md for full governance protocol.

## Quick Reference

- View current state: run `sigma project status` in terminal
- When lost: run `sigma session bootstrap`
- Do not edit `Sigma/progress.json` directly

## Artifact Status Reference

| Artifact | Human Label | Meaning |
|---|---|---|
| DIR-INTENT | Intent Doc | Objective, scope, constraints |
| FMN-PLAN | Plan Doc | Build contract and test contract |
| DEV-EXEC | Execution Evidence | Implementation report and proof |
| DIR-CLOSE | Closure Doc | Final cycle closure |
```

**3. Update `README.md` AI Tool Targets section**

Add Cursor to the list of supported targets. Update install instructions to include:

```bash
sigma setup install --target cursor
```

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-03-1 | `sigma setup install --target cursor` completes without error | Run command |
| AC-03-2 | `.cursor/rules/SIGMA.mdc` is created in project directory | `ls .cursor/rules/` |
| AC-03-3 | README lists Cursor in supported targets | Read README |
| AC-03-4 | `sigma setup install --help` lists `cursor` as valid target | Check help output |

---

### TASK-04 — Implement `sigma override` Command

**Files**: `src/commands/override.ts` (new), `src/index.ts` (register command), `Sigma/memory/decisions.jsonl` (written by CLI)

#### Context

Without an override mechanism, Directors stuck at a gate for legitimate reasons have no clean exit. The only current option is manually editing `progress.json`, which is explicitly prohibited by governance rules.

#### Design

```bash
sigma override --reason "<reason text>"
```

`--reason` is mandatory. Empty or missing reason must be rejected with a clear error.

#### Behavior

1. Read current lifecycle state from `Sigma/progress.json`
2. Display current gate status and what is being bypassed
3. Ask for explicit Director confirmation before proceeding (cannot run silently)
4. On confirmation, write an override record to `Sigma/memory/decisions.jsonl`:

```jsonl
{
  "type": "override",
  "timestamp": "<ISO 8601>",
  "artifact": "<artifact code being bypassed>",
  "phase": "<current lifecycle phase>",
  "reason": "<Director-provided reason>",
  "authorized_by": "Director"
}
```

5. Advance or patch the relevant lifecycle state in `progress.json` to allow the blocked action to proceed

#### Constraints

- `--reason` flag is mandatory; command fails without it
- Override must not silently modify state; confirmation prompt is non-negotiable
- Every override must produce a record in `decisions.jsonl`
- Override is not a reset; it bypasses a specific gate, not the entire lifecycle
- Document clearly: override is for legitimate Director decisions, not a workaround for lazy compliance

#### `sigma override --help` output

```
Usage: sigma override --reason "<reason>"

Bypass the current lifecycle gate under Director authority.

Every override is permanently recorded in Sigma/memory/decisions.jsonl.

Options:
  --reason   Required. Describe why this override is authorized.
  --dry-run  Show what would be bypassed without modifying state.

Example:
  sigma override --reason "Director decision: scope change makes plan lock obsolete"
```

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-04-1 | `sigma override` without `--reason` exits with clear error | Run without flag |
| AC-04-2 | `sigma override --reason "..."` prompts for confirmation before acting | Run command |
| AC-04-3 | Override record written to `Sigma/memory/decisions.jsonl` with all required fields | Check file |
| AC-04-4 | After override, blocked lifecycle action can proceed | Run subsequent command |
| AC-04-5 | `sigma override --dry-run` shows what would be bypassed without modifying state | Run dry-run |

---

### TASK-05 — MCP Config Auto-Generate on `sigma project start` (Post-release)

**Files**: `src/commands/project.ts` (start command), `setup/templates/mcp/` (new or existing)

#### Context

Delta generates `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, and `.codex/mcp.json` automatically at project start. Sigma requires a separate `sigma setup memory` command, which is easily missed.

#### Design options

Option A: Auto-generate `.mcp.json` during `sigma project start` (always)  
Option B: Prompt during `sigma project start` — "Configure MCP memory now? (y/N)"  
Option C: Print a reminder after `sigma project start` with the exact command to run

**Recommendation**: Option C first (zero-code, immediate improvement), then Option B in a follow-up.

For Option C, add to the `sigma project start` completion output:

```
Project initialized.

Optional: configure MCP memory integration
  sigma setup memory              (Claude Code / Reasonix / Codex)
  sigma setup memory --vscode     (VS Code)
  sigma setup memory --cursor     (Cursor)
```

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-05-1 | `sigma project start` completion output includes MCP setup reminder | Run command and read output |

---

### TASK-06 — Improve `sigma session bootstrap` Output (Post-release)

**Files**: `src/commands/session.ts` (bootstrap output), `setup/targets/*/checkpoint.md` (if skill-level changes needed)

#### Context

Delta bootstrap clearly displays: lifecycle state, artifact versions, gate blockers, and recommended next action. Sigma bootstrap is functional but less structured in its presentation.

#### Target output format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SIGMA SESSION BOOTSTRAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Project     : {project name}
  Phase       : {current lifecycle phase}

  Artifacts:
  {✓ | ●}  Intent Doc (DIR-INTENT v{n})     {status}
  {✓ | ●}  Plan Doc (FMN-PLAN v{n})         {status}
  {✓ | ●}  Execution Evidence (DEV-EXEC v{n}) {status}

  Gate Status : {Open / Blocked}
  Blocker     : {blocker description or "none"}
  Next Action : {one concrete action}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Legend: `✓` = LOCKED, `●` = in progress / DRAFT, `-` = not started

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-06-1 | Bootstrap output shows all three primary artifact statuses | Run `sigma session bootstrap` |
| AC-06-2 | Bootstrap output includes Gate Status and Next Action fields | Read output |
| AC-06-3 | Human labels used alongside artifact codes in output | Read output |

---

### TASK-07 — `sigma <artifact> flag / unflag` (Post-release)

**Files**: `src/commands/flag.ts` (new), `src/index.ts` (register command), `Sigma/memory/decisions.jsonl`

#### Context

If a LOCKED artifact is found to have a critical error, the Director has no way to mark it as "under review" without either superseding (creating v2) or resetting (destructive). A lightweight flag mechanism fills this gap without touching lifecycle state.

#### Design

```bash
sigma plan flag --reason "Critical error in test contract, pending revision"
sigma plan unflag
sigma exec flag --reason "Implementation diverged from plan, review required"
sigma exec unflag
```

#### Behavior

- Flag does **not** change lifecycle state (artifact remains LOCKED)
- Flag adds a `{ "flagged": true, "flag_reason": "..." }` annotation readable by `sigma project status`
- `sigma project status` shows flagged artifacts with a warning indicator
- Unflag removes the annotation; requires no reason (but is logged)
- All flag and unflag events written to `decisions.jsonl`

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-07-1 | `sigma plan flag --reason "..."` succeeds without changing LOCKED status | Run and check `progress.json` |
| AC-07-2 | `sigma project status` shows flagged warning on flagged artifact | Run `sigma project status` |
| AC-07-3 | `sigma plan unflag` removes the flag annotation | Run and check status |
| AC-07-4 | All flag/unflag events recorded in `decisions.jsonl` | Check file |

---

## Implementation Order

```
Phase 1 — Before npm release (🔴)
  TASK-01   .npmignore                     (no dependencies)
  TASK-02   Test suite                     (no dependencies)
  TASK-03   Cursor support                 (no dependencies)
  TASK-04   sigma override command         (no dependencies)

Phase 2 — Post-release (🟡)
  TASK-05   MCP config reminder            (depends on Phase 1 complete)
  TASK-06   Bootstrap output improvements  (depends on Phase 1 complete)
  TASK-07   sigma flag / unflag            (depends on Phase 1 complete)
```

Tasks in Phase 1 are fully independent of each other and can be implemented in parallel.

---

## Risk / Watch-Out

| Risk | Mitigation |
|---|---|
| `sigma override` misused as a routine shortcut | Require `--reason`, log every override, add clear docs that override is for legitimate Director decisions only |
| Test suite creates temp files that pollute working directory | Use `os.tmpdir()` per test, clean up in `afterEach` |
| Cursor `.mdc` format may change | Keep bridge file content minimal; reference SIGMA_README.md for full protocol |
| `.npmignore` accidentally excludes `setup/` or `dist/` | Verify with `npm pack --dry-run` before any publish |
| `decisions.jsonl` grows unbounded | Out of scope for this plan; log rotation is a future concern |

---

## Implementation Constraints

| Constraint | Reason |
|---|---|
| `progress.json` schema must not change | All existing CLI commands depend on exact field names |
| Override must always prompt; no silent mode (except `--dry-run`) | Governance requires Director to be aware of every bypass |
| Test suite must use real CLI invocations, not mocked internals | Mocked tests missed production bugs in Delta (see discussion doc) |
| `.npmignore` must not exclude `setup/` targets | They are runtime-required for `sigma setup install` |
