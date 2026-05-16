# Sigma Feature Note — Add `/report` Skill

## Purpose

Add a new universal skill:

```text
/report
```

`/report` provides a short, chat-only Director briefing about the latest Sigma project state, decisions so far, open risks, and the most relevant next move.

This skill is designed to answer one question:

> What does the Director need to know right now?

---

## Product Position

`/report` is **not** a governance role.

It is a universal read-only briefing skill that may be invoked by any active mode or role:

- Professional Mode
- ARC
- FMN
- DEV
- AUD

Invoking `/report` must **not** break role immutability.

The active role remains active after the report is produced.

---

## Why This Feature Exists

Sigma is designed as an AI-operated governance protocol under Director authority.

The Director should not need to inspect every artifact, remember every CLI command, or manually reconstruct the current state of the project.

Sigma already has structured sources for reporting:

- `Sigma/progress.json` — current runtime state
- `Sigma/memory/decisions.jsonl` — lock-event decision history
- active artifacts — semantic context and evidence
- Git Diff Evidence — physical change trace
- CSO/checkpoint logs — optional handoff context

`/report` gives the Director a concise status digest from those sources.

---

## Skill Definition

```markdown
---
description: Instant Director briefing — current state, decisions, risks, next action
---

# /report — Sigma Director Briefing
```

---

## Identity

This is a universal, read-only skill.

It is not a governance role.

It does not:

- change project state,
- create artifacts,
- lock artifacts,
- supersede artifacts,
- acknowledge risks,
- reset project state,
- commit/stage/reset Git changes,
- or execute mutation, approval, or write commands.

It may be invoked by any active role without switching roles.

---

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

No role switch required.

No new session required.

The active role produces the report from its current context and access.

---

## Word Limits

The skill must enforce strict word limits:

| Mode | Max Words |
| :--- | :--- |
| `/report` | 300 words |
| `/report --brief` | 150 words |
| `/report --full` | 500 words |

The default is **300 words**.

The report must be concise. No preamble. No filler. No explanation of what the report is.

---

## Information Gathering

The role may use any reasonable read-only source to compose the report, including:

- `sigma session bootstrap` — current state summary, if available
- `sigma project status` — lifecycle phase and gate status, if available
- `sigma git evidence` — Git branch, working tree state, changed files, and diff summary, if available
- `Sigma/progress.json` — lifecycle phase and gate status
- `Sigma/design/` — active DIR-INTENT version and state
- `Sigma/build/` — ROADMAP, FMN-PLAN, and DEV-EXEC versions and states
- `Sigma/close/` — DIR-CLOSE state if applicable
- `Sigma/memory/decisions.jsonl` — recent lock events and decision log
- `Sigma/logs/` — CSO handoff artifacts if available
- `DEV-EXEC` Git Diff Evidence section, if present
- any artifact file currently in session context
- current conversation context

The method is intentionally flexible.

If information is missing or inaccessible, the report must say so briefly.

The skill must not invent or assume missing decisions, risks, evidence, or state.

---

## Output Format

Deliver in chat only.

No file creation.

No artifact.

Use this exact structure:

```markdown
# Sigma Report

**Current State:** [One sentence: lifecycle phase, active artifacts, and gate status]

**Director Should Know:**
- [Most important fact or finding right now]
- [Second most important — omit if nothing significant]

**Decisions So Far:**
- [Key locked decision that is shaping current work]
- [Second locked decision if relevant — omit if not]

**Open Risk / Question:** [One unresolved issue, blocker, or open question that may require Director attention. If none, write "None at this time."]

**Recommended Next Move:** [One concrete decision or action that can move the project forward]
```

---

## Constraints

### 1. Read-Only Only

`/report` may inspect, summarize, and recommend.

It must not mutate runtime state or source files.

Forbidden during or after `/report` execution:

- `sigma intent lock`
- `sigma roadmap lock`
- `sigma plan lock`
- `sigma exec lock`
- `sigma close lock`
- `sigma plan supersede`
- `sigma exec supersede`
- `sigma project reset`
- any stale-intent acknowledgment command
- any destructive command
- any artifact creation command
- any state advance command
- any command that writes to `Sigma/progress.json`
- any Git write operation such as `git add`, `git commit`, `git reset`, `git checkout`, or file modification

### 2. No Artifact Creation

`/report` lives only in chat.

It must not be saved to `Sigma/logs/`.

If the Director wants a saved handoff artifact, use `/cso`, not `/report`.

### 3. No Role Switch

Producing `/report` does not end or switch the active role.

The role remains active after the report.

### 4. Perspective Follows Active Role

The report may reflect the active role’s grounded perspective.

Examples:

- ARC may surface intent clarity issues.
- FMN may surface plan gaps or test-contract issues.
- DEV may surface implementation blockers or Git evidence.
- AUD may surface risk findings or evidence weaknesses.
- Professional Mode may provide a neutral status summary.

Do not force artificial neutrality if the active role has relevant grounded context.

### 5. No Invented Content

Every item must be grounded in actual project state, decision memory, artifact content, Git evidence, or current conversation context.

If something is unknown, write:

```text
unknown
```

Do not guess.

---

## Relationship to Existing Sigma Skills

| Skill | Purpose |
| :--- | :--- |
| `/checkpoint` | Mark or capture a discussion checkpoint |
| `/cso` | Create a saved handoff/state object |
| `/report` | Produce a short chat-only Director briefing |

Control sentence:

```text
/checkpoint preserves context.
/cso transfers context.
/report informs the Director.
```

---

## Impact on Phase 6 Skill Roster

Current Phase 6 skill roster:

```text
/arc
/fmn
/dev
/aud
/checkpoint
/cso
```

New roster:

```text
/arc
/fmn
/dev
/aud
/checkpoint
/cso
/report
```

This changes the skill file count:

```text
4 platforms × 6 skills = 24 files
```

to:

```text
4 platforms × 7 skills = 28 files
```

Affected platforms:

- Claude Code: `~/.claude/commands/report.md`
- Codex CLI: `~/.codex/skills/report`
- Reasonix: `~/.reasonix/skills/report.md`
- Antigravity: `~/.gemini/agents/report.md`

---

## Required PLAN-6 Updates

Update `PLAN-6.md` as follows:

1. Change all references from **24 skill files** to **28 skill files**.
2. Change all references from **6 skills** to **7 skills**.
3. Add `/report` to the skill roster.
4. Add report skill files to the output file list:
   - `setup/targets/claude_code/report.md`
   - `setup/targets/codex/report`
   - `setup/targets/reasonix/report.md`
   - `setup/targets/antigravity/report.md`
5. Add `/report` to bridge file role/skill references.
6. Add `/report` to `SIGMA_README.md` role/shortcut section.
7. Add acceptance criteria:
   - all 4 platform directories contain `/report` skill file,
   - `/report` skill has max word limits,
   - `/report` forbids mutation commands,
   - `/report` states it does not break role immutability,
   - `/report` output format matches the required Sigma Report structure.

---

## Suggested Acceptance Criteria

| AC ID | Criteria |
| :--- | :--- |
| AC-REPORT-01 | `setup/targets/claude_code/report.md` exists |
| AC-REPORT-02 | `setup/targets/codex/report` exists |
| AC-REPORT-03 | `setup/targets/reasonix/report.md` exists |
| AC-REPORT-04 | `setup/targets/antigravity/report.md` exists |
| AC-REPORT-05 | `/report` skill states it is universal, read-only, and not a governance role |
| AC-REPORT-06 | `/report` skill states it does not break role immutability |
| AC-REPORT-07 | `/report` skill defines word limits: 300 default, 150 brief, 500 full |
| AC-REPORT-08 | `/report` skill forbids lock, supersede, reset, state advance, artifact creation, and Git write operations |
| AC-REPORT-09 | `/report` skill includes Git Diff Evidence as an allowed read-only source |
| AC-REPORT-10 | `/report` output format includes Current State, Director Should Know, Decisions So Far, Open Risk / Question, and Recommended Next Move |
| AC-REPORT-11 | PLAN-6 total skill count is updated from 24 to 28 |
| AC-REPORT-12 | SIGMA_README.md mentions `/report` as a quick Director briefing skill |

---

## Final Doctrine

`/report` is a quick Director briefing.

It may inspect.

It may summarize.

It may recommend.

It must not mutate.

It must not become CSO.

It must not break role immutability.
