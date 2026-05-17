---
name: report
description: "Instant Director briefing — current state, decisions, risks, next action"
---

# /report — Sigma Director Briefing

## Skill Identity

This is a universal, read-only skill.

It is not a governance role. It does not switch roles, create artifacts, lock artifacts, supersede artifacts, acknowledge risks, reset project state, commit or stage Git changes, or execute any write command.

It may be invoked by any active role without switching roles.

The active role remains active after the report is produced.

## Activation

Invoked by Director as:

```text
/report
```

Optional modes:

```text
/report --brief
/report --full
```

No role switch required. No new session required. The active role produces the report from its current context.

## Word Limits

| Mode | Max Words |
| :--- | :--- |
| `/report` | 350 words |
| `/report --brief` | 150 words |
| `/report --full` | 600 words |

The report must be concise. No preamble. No filler. No explanation of what the report is.

If the report must be trimmed to fit, cut in this order:
1. Technical notes
2. Secondary and tertiary Director options
3. Secondary decision detail
Preserve last: Verdict + Current State + Recommended next move.

## Information Sources (Read-Only)

The role may use any reasonable read-only source to compose the report:

- `sigma session bootstrap` — current state summary, if available
- `sigma project status` — lifecycle phase and gate status, if available
- `sigma git evidence` — Git branch, working tree state, and changed files, if available
- `Sigma/progress.json` — lifecycle phase and gate status
- `Sigma/design/` — active DIR-INTENT version and state
- `Sigma/build/` — ROADMAP, FMN-PLAN, and DEV-EXEC versions and states
- `Sigma/close/` — DIR-CLOSE state if applicable
- `Sigma/memory/decisions.jsonl` — recent lock events and decision log
- `Sigma/logs/` — CSO handoff artifacts if available
- Any artifact file currently in session context
- Current conversation context

If information is missing or inaccessible, the report must say so briefly.

## Output Format

Deliver in chat only. No file creation. No artifact.

Use this exact structure every time:

---

**Sigma Briefing — {project_name}**
Date: {date}

**Verdict:** {one plain-English sentence — current state and what it means}

**Current State**
- Lifecycle: {phase name in plain English}
- Locked evidence chain: {human labels + artifact codes, e.g. "Intent Doc (DIR-INTENT v1) → Plan Doc (FMN-PLAN v1)"}
- Open blockers: {none / list}

**What this means**
{1–3 sentences on practical consequence for the Director}

**Recommended next move**
{one concrete action or decision}

**Director options**
1. {primary action phrase}
2. {secondary option}
3. {deeper inspection option, if applicable}

**Technical notes** *(only if risk or blocker warrants it)*
- {entry only if relevant}

---

Director options must always include one clear recommended next move.
Options are supporting context, not a decision menu. Maximum 3 options.

## Forbidden Operations

During or after `/report` execution, the following are forbidden:

- `sigma intent lock`, `sigma roadmap lock`, `sigma plan lock`, `sigma exec lock`, `sigma close lock`
- `sigma plan supersede`, `sigma exec supersede`, `sigma project reset`
- Any stale-intent acknowledgment command
- Any artifact creation command
- Any state advance command
- Any command that writes to `Sigma/progress.json`
- Any Git write operation (`git add`, `git commit`, `git reset`, `git checkout`)
- Any file modification

## Perspective Follows Active Role

The report may reflect the active role's grounded perspective:

- ARC: may surface intent clarity issues
- FMN: may surface plan gaps or test-contract issues
- DEV: may surface implementation blockers or Git evidence
- AUD: may surface risk findings or evidence weaknesses
- Professional Mode: neutral status summary

Do not force artificial neutrality if the active role has relevant grounded context.

## No Invented Content

Every item must be grounded in actual project state, decision memory, artifact content, Git evidence, or current conversation context.

If something is unknown, write `unknown`. Do not guess.
