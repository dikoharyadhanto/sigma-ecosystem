---
name: sigma-test
description: "Sigma environment diagnostic — read-only check of CLI, skills, and project structure"
---

# /sigma-test — Sigma Environment Diagnostic

## Product-audit session guard

Before any source read, command, memo listing, or bootstrap below, check the
session context. If one of the four AUD product-audit skills is or has been bound
in this session, do not execute this workflow or discover Sigma evidence. Explain
that a new session is required for this workflow; preserve the existing audit
binding. A request for a short status may be answered only from already-permitted
current audit context, without reading additional sources or writing a memo.

## Skill Identity

This is a universal, read-only diagnostic skill.

It does not switch roles, create artifacts, lock artifacts, supersede artifacts, activate or register a project, repair state, or execute any write command.
It may be invoked from any active role or Professional Mode without switching roles.
The active role remains active after the diagnostic is produced.

## Activation

```text
/sigma-test
```

## What This Skill Does

Runs a layered, read-only health check of the Sigma ecosystem installation for the current AI platform (Antigravity / Gemini). The depth is deliberate: cheap invariants run every time, expensive exhaustive coverage runs only in a fixture or CI, so the routine diagnostic stays fast, quiet, and free of false failures.

| Layer | Runs | Cost | Purpose |
| :--- | :--- | :--- | :--- |
| A — Baseline | every invocation | low | CLI, skills, asset drift, global setup, project structure, MCP reachability, side-effect cleanliness |
| B — Parity | every invocation | low (metadata only) | every registry operation is classified; policy and tombstones are consistent |
| C — Representative smoke | only inside an active Sigma project | medium | one observational call per family, to prove the read paths work |
| D — Exhaustive read-only conformance | never interactively; fixture/CI only | high | run every read-only operation, check no state mutation |

Each check reports `PASS`, `WARN`, `FAIL`, or `N/A`.

## Status Semantics

- `PASS` — the invariant holds, with evidence.
- `FAIL` — a required invariant is broken. Always actionable.
- `WARN` — works, but drift, staleness, or an unverifiable claim needs a decision.
- `N/A` — a *named* prerequisite is absent (for example "not inside a Sigma project"). `N/A` is valid only when the prerequisite is stated. A core invariant is never downgraded to `N/A` to avoid a failure.

Every row carries a stable check ID, brief evidence, and — for `WARN`/`FAIL` — the remediation command. Remediation is **recommended, never executed**.

## Execution Protocol

Run Layers A and B in order. Run Layer C only when the project prerequisites hold. Do not run Layer D. Do not modify any file or state. Do not retry a failing check by changing state to make it pass.

### Layer A — Baseline

#### A1 — CLI (`A1.cli`)

Run: `sigma --version` and `sigma --help`

- PASS if a version prints and `--help` lists Sigma command domains — report the version
- FAIL if the command is not found or errors out

#### A2 — Orientation (`A2.bootstrap`)

Run: `sigma session bootstrap`

- PASS if output reports lifecycle phase and gate status
- N/A if not inside a Sigma project (no `Sigma/activate_status.json`) — state "not a Sigma project" and mark every project check N/A. Do **not** run `sigma project start`, `register`, or any activation.
- FAIL if the command errors unexpectedly inside a project

#### A3 — Skill files (`A3.skills`)

Check that the following skill directories exist in `~/.gemini/config/skills/`:

| Skill | Expected directory |
| :--- | :--- |
| /arc | `~/.gemini/config/skills/sigma-arc/` |
| /fmn | `~/.gemini/config/skills/sigma-fmn/` |
| /dev | `~/.gemini/config/skills/sigma-dev/` |
| /aud | `~/.gemini/config/skills/sigma-aud/` |
| /aud-security | `~/.gemini/config/skills/sigma-aud-security/` |
| /aud-ui-ux-design | `~/.gemini/config/skills/sigma-aud-ui-ux-design/` |
| /aud-performance-cost | `~/.gemini/config/skills/sigma-aud-performance-cost/` |
| /aud-code-logic | `~/.gemini/config/skills/sigma-aud-code-logic/` |
| /report | `~/.gemini/config/skills/sigma-report/` |
| /sigma-test | `~/.gemini/config/skills/sigma-test/` |

For each directory, verify it contains both `SKILL.md` and `plugin.json`.

- PASS if directory and both files exist
- FAIL if directory or files are missing (run `sigma setup install` to redeploy)

Verify all four product-audit entries as well as base AUD. Inspect files only; do not invoke audit skills as a diagnostic.

#### A4 — Asset drift (`A4.assets`)

Run: `sigma doctor --check-assets`

This compares the repository master, the installed host copies, and (inside a project) the project copies. It is read-only and does not log an operation. It exits `0` even when differences exist, so read the report, not the exit code.

- PASS if `differences: 0`
- WARN if differences are listed — report each `[layer] DIFF|MISSING path` and state that the report identifies byte differences only, not their origin or approval
- FAIL if the command errors

Remediation (recommended, not executed): `sigma setup update`, then `sigma project sync --confirm` inside a project. Both are separate, Director-approved steps.

#### A5 — Global setup (`A5.global`)

Check that the following paths exist:

- `~/.sigma/` — global Sigma directory
- `~/.sigma/rules/` — role rule files
- `~/.sigma/governance/` — SIGMA_PROTOCOL.md and SIGMA_CONSTITUTION.md
- `~/.sigma/templates/` — artifact templates

- PASS if present
- FAIL if missing (run `sigma setup install`)

#### A6 — Project structure (`A6.project`)

Only run if inside a Sigma project (`Sigma/activate_status.json` exists). Otherwise mark N/A: "not a Sigma project".

Check that the following paths exist relative to the project root:

- `Sigma/charter/`
- `Sigma/contract/`
- `Sigma/roadmap/`
- `Sigma/evidence/`
- `Sigma/close/`
- `Sigma/notes/`
- `Sigma/notes/note-list/`
- `Sigma/notes/unregistered-notes/`
- `Sigma/rules/`
- `Sigma/logs/`
- `Sigma/memory/`
- `Sigma/role-memory/`
- `Sigma/reference/`

- PASS if present
- WARN if missing and lifecycle_state is START (expected for a brand-new project)
- FAIL if missing in an active project (lifecycle_state is DESIGN, BUILD, or CLOSE)

#### A7 — MCP reachability (`A7.mcp`)

Check whether the Sigma **query** MCP server is available to this session and list its tools (introspection only).

- PASS if the query server responds and lists tools; report the tool count
- N/A if no Sigma MCP server is configured on this platform — "MCP not configured"
- WARN if configured but not responding

The **control** server is configured manually and is intentionally not required. Report it as `N/A: not configured` when absent. Never start, install, or reconfigure a server.

#### A8 — Side-effect cleanliness (`A8.clean`)

Record, before the first check and again after the last: `git status --short` (when in a Git repository) and, inside a project, the size and modification time of `Sigma/logs/operations.jsonl`.

- PASS if both are unchanged by this diagnostic
- FAIL if the diagnostic itself changed either one — state which, and stop reporting further PASS results as trustworthy
- N/A if not a Git repository and not a project

### Layer B — Parity (metadata only)

Requires an active Sigma project and the query MCP server. Otherwise every B check is `N/A: prerequisite absent` — and say which one.

Call `sigma_get_effective_policy` (no role filter) and evaluate its rows. Do not call any other operation.

- `B1.classified` — every row has a non-null `tier` and `registry_level`. FAIL listing each `operation_id` with `tier: null` (remediation: add a record for it to the capability manifest, `src/mcp/capabilityManifest.ts`).
- `B2.tombstones` — `intent_lock`, `plan_lock`, `exec_lock` are present with tier `NA`, `mcp_status: not_admissible` and `registry_status: tombstone`, and are not counted as active operations. FAIL otherwise.
- `B3.count` — the row count equals the registry operation count in the project's `Sigma/SIGMA-OPERATION-REGISTRY.json`. FAIL on mismatch, listing the missing or extra IDs.
- `B4.mcp_status` — each row carries `plane`, `mcp_status` and `mcp_tools`, all declared by the capability manifest. `mcp_status: implemented` is a *claim*, not proof that a tool exists, so compare it with the tool list introspected in A7:
  - every row with `mcp_status: implemented` and `plane: query` must have each name in `mcp_tools` present in the A7 list. FAIL listing each `operation_id` and the missing tool name.
  - rows with `plane: control` are checked the same way only when the control server's tool list is available. Otherwise they are not verifiable here: report them as `N/A: control server not connected`, never as PASS.
  - PASS only when every query row verified and none failed. If control rows were unverifiable, say how many in the evidence column; this is informational, not a WARN.
  - `N/A: prerequisite absent` when A7 produced no tool list.
  - Never PASS this check from `mcp_status` alone. The reverse direction (a registered tool that no row accounts for) is not visible in this payload; it is covered by `test/mcp-capability-manifest.test.ts`.

### Layer C — Representative smoke

Run only inside an active Sigma project with a readable chain. Each call is an observational, registry-classified read-only operation. Run **one** per family; do not enumerate every operation.

| Family | CLI | MCP query equivalent |
| :--- | :--- | :--- |
| State / orientation | `sigma project status` | `sigma_get_orientation` |
| Status / list | `sigma plan status`, `sigma plan list` | `sigma_plan_status`, `sigma_list_plans` |
| Document check | `sigma intent check` | `sigma_check_document` |
| Mailbox integrity | `sigma inbox check` | `sigma_check_mailbox_integrity` |
| Config | `sigma config show` | `sigma_get_config` |
| Log / audit | `sigma report logs -n 5` | `sigma_get_operation_log` |
| Git inspection | `sigma git evidence` | `sigma_get_git_evidence` |

- PASS if the call exits `0` and returns well-formed output
- N/A (`prerequisite absent`) if the lifecycle artifact the call needs does not exist yet — name it (for example "no INTENT document"). This is **not** a failure and must never trigger creating the artifact.
- FAIL if the call errors although its prerequisite is present, or if it changed state (A8 re-check)

### Layer D — Exhaustive read-only conformance

Not run by this skill. It lives in the Sigma source repository as fixture tests:

- `test/read-only-conformance.test.ts` — runs every registry `read_only` operation and fails on any file, global, or Git mutation
- `test/operation-parity.test.ts` — registry ↔ policy tier parity and tombstone handling
- `test/mcp-capability-manifest.test.ts` — capability manifest ↔ registry ↔ the tools both MCP servers actually register

Report a single informational row: `D — conformance: N/A (fixture/CI only)`, and the command a maintainer would run: `npx vitest run test/read-only-conformance.test.ts test/operation-parity.test.ts test/mcp-capability-manifest.test.ts`.

## Output Format

Deliver in chat only. No file creation. No artifacts.

Use this exact structure:

---

**Sigma Environment Diagnostic**
Date: {date}
Platform: Antigravity (Gemini)
Project: {active Sigma project / not a Sigma project}

| Layer | ID | Check | Status | Evidence / impact |
| :--- | :--- | :--- | :--- | :--- |
| A | A1.cli | `sigma --version` / `--help` | PASS/FAIL | v{version} |
| A | A2.bootstrap | `sigma session bootstrap` | PASS/N/A/FAIL | {phase or reason} |
| A | A3.skills | skill files (/arc, /fmn, /dev, /aud, /aud-security, /aud-ui-ux-design, /aud-performance-cost, /aud-code-logic, /report, /sigma-test) | PASS/FAIL | {missing items} |
| A | A4.assets | `sigma doctor --check-assets` | PASS/WARN/FAIL | {N differences} |
| A | A5.global | `~/.sigma/` and subdirectories | PASS/FAIL | |
| A | A6.project | `Sigma/` structure | PASS/WARN/FAIL/N/A | |
| A | A7.mcp | query MCP server and tool list | PASS/WARN/N/A | {tool count} |
| A | A8.clean | no side effects from this run | PASS/FAIL/N/A | |
| B | B1.classified | every operation has a tier | PASS/FAIL/N/A | {unclassified IDs} |
| B | B2.tombstones | tombstones inadmissible, not active | PASS/FAIL/N/A | |
| B | B3.count | policy rows = registry operations | PASS/FAIL/N/A | |
| B | B4.mcp_status | `mcp_status` verified against tools | PASS/FAIL/N/A | {verified query rows; unverifiable control rows} |
| C | C.state … C.git | one smoke call per family | PASS/N/A/FAIL | {prerequisite named if N/A} |
| D | D.conformance | exhaustive read-only conformance | N/A | fixture/CI only |

**Verdict:** PASS / WARN / FAIL

{One sentence: what failed, what to fix first. List the unclassified IDs or drifted files if any.}

**Recommended action:** {only for WARN or FAIL — the exact command, marked "not executed"}

---

Verdict rules:
- Any `FAIL` → verdict `FAIL` (non-zero outcome)
- No `FAIL`, any `WARN` → verdict `WARN` (zero outcome)
- Only `PASS` and `N/A` → verdict `PASS`
- `N/A` and `WARN` never raise the outcome to non-zero unless the Director explicitly asks for **strict** mode; in strict mode `WARN` counts as `FAIL`, and `N/A` counts as `FAIL` only for a prerequisite the Director said should be present.

## Forbidden Operations

During the `/sigma-test` invocation, including side effects triggered by it, the following are forbidden:

- Any artifact, message, memo, configuration, lifecycle, or control-plane write
- Any project or role activation, registration, initialization, migration, repair, approval, or state advance
- Any operation not classified `read_only` in the operation registry (do not use `sigma scan`, `sigma inbox read`, or any `--fix`/`--repair`/`--confirm` flag)
- Any command that writes an operation log or other project/global state
- Any Git mutation or network operation, including add, commit, tag, push, fetch, reset, checkout, switch, merge, rebase, or clean
- Installing, updating, or reconfiguring skills, hooks, or MCP servers

This skill is strictly observational. It reports what it finds and recommends actions. It does not take actions.
