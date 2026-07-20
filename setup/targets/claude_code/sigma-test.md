---
name: sigma-test
description: "Sigma environment diagnostic — read-only check of CLI, skills, and project structure"
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

Runs a comprehensive read-only health check of the Sigma ecosystem installation for the current AI platform (Claude Code). Checks are grouped into four categories. Each check reports PASS, WARN, or FAIL.

## Execution Protocol

Run all checks below in order. Do not skip any step. Do not modify any file or state.

### 1. CLI Check

Run: `sigma --help`

- PASS if output lists Sigma command domains (intent, plan, exec, session, etc.) — extract and report version
- FAIL if command not found or errors out

Run: `sigma session bootstrap`

- PASS if output reports lifecycle phase and gate status
- WARN if not in a Sigma project (no `Sigma/progress-v<N>.json` found) — mark all Project checks as N/A
- FAIL if command errors out unexpectedly

### 2. Skill Files Check

Check that the following files exist in `~/.claude/commands/`:

| Skill | Expected file |
| :--- | :--- |
| /arc | `~/.claude/commands/arc.md` |
| /fmn | `~/.claude/commands/fmn.md` |
| /dev | `~/.claude/commands/dev.md` |
| /aud | `~/.claude/commands/aud.md` |
| /report | `~/.claude/commands/report.md` |
| /sigma-test | `~/.claude/commands/sigma-test.md` |

- PASS if file exists
- FAIL if file is missing (run `sigma setup install` to redeploy)

### 3. Global Setup Check

Check that the following paths exist:

- `~/.sigma/` — global Sigma directory
- `~/.sigma/rules/` — role rule files
- `~/.sigma/governance/` — SIGMA_PROTOCOL.md and SIGMA_CONSTITUTION.md
- `~/.sigma/templates/` — artifact templates
- `~/.sigma/projects.json` — project registry

- PASS if present
- FAIL if missing (run `sigma setup install`)

### 4. Project Structure Check

Only run if inside a Sigma project (`Sigma/progress-v<N>.json` exists).

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
Platform: Claude Code

| Category | Check | Status | Notes |
| :--- | :--- | :--- | :--- |
| CLI | `sigma --help` | PASS/FAIL | v{version} |
| CLI | `sigma session bootstrap` | PASS/WARN/FAIL | {phase or reason} |
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
