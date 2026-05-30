---
name: sigma-test
description: "Sigma environment diagnostic — read-only check of CLI, MCP, memory, skills, and project structure"
---

# /sigma-test — Sigma Environment Diagnostic

## Skill Identity

This is a universal, read-only diagnostic skill.

It does not switch roles, create artifacts, lock artifacts, supersede artifacts, or execute any write command.
It may be invoked from any active role or Professional Mode without switching roles.
The active role remains active after the diagnostic is produced.

## Activation

```text
/sigma-test
```

## What This Skill Does

Runs a comprehensive read-only health check of the Sigma ecosystem installation for the current AI platform (Reasonix). Checks are grouped into five categories. Each check reports PASS, WARN, or FAIL.

## Execution Protocol

Run all checks below in order. Do not skip any step. Do not modify any file or state.

### 1. CLI Check

Run: `sigma --help`

- PASS if output lists Sigma command domains (intent, plan, exec, session, etc.) — extract and report version
- FAIL if command not found or errors out

Run: `sigma session bootstrap`

- PASS if output reports lifecycle phase and gate status
- WARN if not in a Sigma project (no `Sigma/progress.json` found) — mark all Project checks as N/A
- FAIL if command errors out unexpectedly

### 2. MCP Check

Inspect whether `.mcp.json` exists in the current working directory.

Read the file and verify its contents:

- PASS if file exists and contains both `sigma-memory` and `sequential-thinking` under `mcpServers`
- WARN if file exists but is missing one of the expected server entries
- FAIL if file does not exist

Also inspect `~/.reasonix/config.json`:

- PASS if `mcp` array contains `sigma-memory` and `sequential-thinking` as plain name entries
- WARN if `mcp` array contains a `memory=...` shorthand instead of `sigma-memory` (conflicting — run `sigma setup memory --reasonix`)
- FAIL if neither entry is present

### 3. Sigma Memory Check

Call MCP tool: `search_nodes({ query: "sigma ecosystem constants" })`
Call MCP tool: `read_graph()`

Evaluate results:

- PASS if `read_graph()` returns 5 or more entities
- WARN if `read_graph()` returns 1–4 entities (partially seeded — run `sigma setup memory --reseed`)
- FAIL if `read_graph()` returns 0 entities or MCP tools are unavailable

Also check file existence: `~/.sigma/memory_sigma.jsonl`

- PASS if file exists and is non-empty
- WARN if file exists but is empty (run `sigma setup memory --reseed`)
- FAIL if file is missing (run `sigma setup memory`)

### 4. Skill Files Check

Check that the following files exist in `~/.reasonix/skills/`:

| Skill | Expected file |
| :--- | :--- |
| /arc | `~/.reasonix/skills/arc.md` |
| /fmn | `~/.reasonix/skills/fmn.md` |
| /dev | `~/.reasonix/skills/dev.md` |
| /aud | `~/.reasonix/skills/aud.md` |
| /report | `~/.reasonix/skills/report.md` |
| /sigma-test | `~/.reasonix/skills/sigma-test.md` |

- PASS if file exists
- FAIL if file is missing (run `sigma setup install` to redeploy)

### 5. Global Setup Check

Check that the following paths exist:

- `~/.sigma/` — global Sigma directory
- `~/.sigma/rules/` — role rule files
- `~/.sigma/governance/` — SIGMA_PROTOCOL.md and SIGMA_CONSTITUTION.md
- `~/.sigma/templates/` — artifact templates
- `~/.sigma/projects.json` — project registry

- PASS if present
- FAIL if missing (run `sigma setup install`)

### 6. Project Structure Check

Only run if inside a Sigma project (`Sigma/progress.json` exists).

Check that the following paths exist relative to the project root:

- `Sigma/design/`
- `Sigma/build/`
- `Sigma/close/`
- `Sigma/rules/`
- `Sigma/logs/`

- PASS if present
- WARN if missing and lifecycle_state is START (expected for brand-new project)
- FAIL if missing in an active project (lifecycle_state is DESIGN, BUILD, or CLOSE)

If not in a Sigma project: mark all Project checks as N/A.

## Output Format

Deliver in chat only. No file creation. No artifacts.

Use this exact structure:

---

**Sigma Environment Diagnostic**
Date: {date}
Platform: Reasonix

| Category | Check | Status | Notes |
| :--- | :--- | :--- | :--- |
| CLI | `sigma --help` | PASS/FAIL | v{version} |
| CLI | `sigma session bootstrap` | PASS/WARN/FAIL | {phase or reason} |
| MCP | `.mcp.json` present | PASS/FAIL | |
| MCP | `sigma-memory` server | PASS/WARN/FAIL | {entity count} entities |
| MCP | `sequential-thinking` server | PASS/WARN/FAIL | |
| MCP | Reasonix config (`mcp` array) | PASS/WARN/FAIL | |
| Memory | `memory_sigma.jsonl` | PASS/WARN/FAIL | |
| Skills | `/arc` | PASS/FAIL | |
| Skills | `/fmn` | PASS/FAIL | |
| Skills | `/dev` | PASS/FAIL | |
| Skills | `/aud` | PASS/FAIL | |
| Skills | `/report` | PASS/FAIL | |
| Skills | `/sigma-test` | PASS/FAIL | |
| Global | `~/.sigma/` | PASS/FAIL | |
| Global | `rules/` | PASS/FAIL | |
| Global | `governance/` | PASS/FAIL | |
| Global | `templates/` | PASS/FAIL | |
| Global | `projects.json` | PASS/FAIL | |
| Project | `Sigma/design/` | PASS/WARN/N/A | |
| Project | `Sigma/build/` | PASS/WARN/N/A | |
| Project | `Sigma/rules/` | PASS/WARN/N/A | |
| Project | `Sigma/logs/` | PASS/WARN/N/A | |

**Verdict:** PASS / WARN / FAIL

{One sentence: what passed, what failed, what to fix first.}

**Recommended action:** {only if WARN or FAIL — exact command to run}

---

Verdict rules:
- ALL PASS → verdict PASS
- Any WARN, no FAIL → verdict WARN
- Any FAIL → verdict FAIL

## Forbidden Operations

During and after `/sigma-test` execution, the following are forbidden:

- Any sigma lock, supersede, reset, or close command
- Any artifact creation, draft, or edit command
- Any file write or modification
- Any Git write operation (`git add`, `git commit`, `git reset`, `git checkout`)
- Any state-advancing command

This skill is strictly observational. It reports what it finds and recommends actions. It does not take actions.
