# PLAN-10 — Sigma UX Improvement: Human-First Presentation Layer

**Source**: `Discussion/sigma_ux_improvement_notes.md`  
**Date**: 2026-05-17  
**Status**: DRAFT

---

## Objective

Fix how Sigma presents information to the Director.

The governance doctrine is correct. The problem is exposure order: artifact codes, CLI commands, and technical gate names appear before the human meaning. This makes Sigma feel heavy even when the Director is doing something simple.

**The fix**: apply a consistent presentation rule across all Director-facing surfaces.

```
Meaning first → Artifact code second → CLI command third
```

---

## Scope

### In scope

- `README.md` and `SIGMA_README.md` — structural and content improvements
- `/report` skill files (all 4 targets: `claude_code`, `reasonix`, `antigravity`, `codex`) — update output format
- `arc.md`, `fmn.md`, `dev.md`, `aud.md` skill files (all 4 targets) — add human-label usage rules for approval prompts and gate block messages
- `checkpoint.md`, `cso.md` skill files (all 4 targets) — minor label alignment
- `Sigma/SIGMA_PROTOCOL.md` — add Director-facing artifact label table
- CLI status output in `src/commands/project.ts` and `src/commands/session.ts` — use `Intent Doc (DIR-INTENT v1) [LOCKED]` format in terminal output

### Out of scope

- CLI command redesign or renaming
- Protocol rule changes (gates, authorization language, role boundaries)
- Sigma governance artifact structure changes
- New commands or features

---

## Human Label Mapping (Reference)

| Director-facing label | Formal artifact code | Meaning |
|---|---|---|
| Intent Doc | `DIR-INTENT` | Objective, scope, constraints, success definition |
| Plan Doc | `FMN-PLAN` | Build contract and test contract |
| Execution Evidence | `DEV-EXEC` | Implementation report, test results, proof |
| Closure Doc | `DIR-CLOSE` | Final closure decision |
| Roadmap Doc | `ROADMAP` | Optional staging map for large cycles |
| Context Handoff | `CSO` | Session continuity snapshot |

This mapping must be applied consistently wherever artifact references appear in Director-facing output.

**Constraint**: Human labels are presentation aliases only. They must not replace artifact codes in:
- filenames (`DIR-INTENT-v1.md`, `FMN-PLAN-v1.md`)
- `Sigma/progress.json` fields
- registry files (`SIGMA-REGISTRY.json`, `SIGMA-OPERATION-REGISTRY.json`)
- CLI arguments and command flags
- template file contents that are read by CLI

Artifact codes remain the governance identifiers everywhere except human-facing output text.

---

## Task Breakdown

### TASK-01 — README and SIGMA_README improvements

**Files**: `README.md`, `SIGMA_README.md`

Changes:

1. Add new section **before** "What Sigma Solves":

   ```markdown
   ## AI Roles Operate Sigma for You

   Sigma is designed to be operated by AI roles under your authority.

   You give intent and approval.
   AI roles operate the workflow.
   Sigma CLI enforces gates.
   Artifacts preserve proof.

   When lost, type:

   /report
   ```

2. Add **Human Labels and Formal Artifacts** table in a new section after roles table:

   ```markdown
   ## Human Labels and Formal Artifacts

   | What you see | Formal artifact | Purpose |
   |---|---|---|
   | Intent Doc | DIR-INTENT | Objective, scope, constraints |
   | Plan Doc | FMN-PLAN | Build contract and test contract |
   | Execution Evidence | DEV-EXEC | Implementation report and proof |
   | Closure Doc | DIR-CLOSE | Final closure decision |
   | Roadmap Doc | ROADMAP | Optional staging map |
   | Context Handoff | CSO | Session continuity |
   ```

3. Move the **Director Utility Shortcuts** section (`/report`, `/checkpoint`, `/cso`) earlier in the document — immediately after the Quick Start section, not buried in the middle.

4. Add `sigma setup memory` and `sigma setup memory --vscode` as **optional steps** in `README.md` Quick Start (already present in `SIGMA_README.md`). Do not insert as required steps — they must remain opt-in:

   ```markdown
   ### Optional: Configure MCP memory

   If your AI environment supports MCP reasoning and memory:

   ```bash
   sigma setup memory
   sigma setup memory --vscode
   ```
   ```

5. Add stronger `/report` positioning text near Quick Start:

   ```text
   When lost, type /report.
   Sigma will tell you the current state, open risks, and the next valid move.
   ```

---

### TASK-02 — Update `/report` skill output format

**Files**: `setup/targets/claude_code/report.md`, `setup/targets/reasonix/report.md`, `setup/targets/antigravity/report.md`, `setup/targets/codex/report`

Replace the current output template section with the Sigma Briefing format:

```markdown
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
```

Update word limits accordingly:

| Mode | Max Words |
|---|---|
| `/report` | 350 |
| `/report --brief` | 150 |
| `/report --full` | 600 |

Add trimming rule for when the report approaches the limit:

```
If the report must be trimmed, cut in this order:
1. Technical notes
2. Secondary and tertiary Director options
3. Secondary decision detail
Preserve last: Verdict + Current State + Recommended next move
```

Add options discipline rule:

```
Director options must always include one clear recommended next move.
Options are supporting context, not a decision menu. Maximum 3 options.
```

---

### TASK-03 — Add human-label rules to role skill files

**Files**: all `arc`, `fmn`, `dev`, `aud` skill files across `claude_code`, `reasonix`, `antigravity`, `codex` targets — 4 roles × 4 targets = **16 files total**. Note: `codex` target files have no `.md` extension.

Add a **Director-Facing Communication Rules** section to each role skill file:

```markdown
## Director-Facing Communication Rules

When referencing artifacts in any output to the Director, use human labels:

| Use this | Not this |
|---|---|
| Intent Doc (DIR-INTENT) | DIR-INTENT |
| Plan Doc (FMN-PLAN) | FMN-PLAN |
| Execution Evidence (DEV-EXEC) | DEV-EXEC |
| Closure Doc (DIR-CLOSE) | DIR-CLOSE |
| Roadmap Doc (ROADMAP) | ROADMAP |
| Context Handoff (CSO) | CSO |

### Approval prompt format

When asking the Director to approve a lock:

```
You are approving:
- {Human Label} ({Artifact Code + Version})
- Scope: {summary}
- Known risks: {summary if any}

Consequence:
{what becomes possible after this approval}

Authority required: Explicit Director approval.
To approve, say: "Approved. Lock it."
```

### Gate block message format

When a gate is blocking an action:

```
{Action} cannot start yet.

Reason:
{plain-English reason}

Required next step:
{what the Director needs to do}

Formal gate:
{gate name and artifact code}
```
```

---

### TASK-04 — Update CLI terminal status output format

**Files**: `src/commands/project.ts` (status output), `src/commands/session.ts` (bootstrap output)

**Change**: In terminal output, display artifact references using the human-label format:

Before:
```
DIR-INTENT v1   LOCKED
FMN-PLAN v1     LOCKED
DEV-EXEC v0.1   LOCKED
```

After:
```
Intent Doc (DIR-INTENT v1)         LOCKED
Plan Doc (FMN-PLAN v1)             LOCKED
Execution Evidence (DEV-EXEC v0.1) LOCKED
```

Scope: only `console.log` / output lines shown to the user. Do not change JSON data structures, `progress.json` fields, or internal logic.

---

### TASK-05 — Add artifact label table to SIGMA_PROTOCOL.md

**File**: `Sigma/SIGMA_PROTOCOL.md`

Add a **Director-Facing Labels** section under the artifact definitions:

```markdown
## Director-Facing Labels

Artifact codes are governance identifiers used by the CLI, rule files, and audit trail.

Director-facing output should use human labels alongside artifact codes:

| Human label | Artifact code | Purpose |
|---|---|---|
| Intent Doc | DIR-INTENT | Objective, scope, constraints, success definition |
| Plan Doc | FMN-PLAN | Build contract and test contract |
| Execution Evidence | DEV-EXEC | Implementation, verification, evidence |
| Closure Doc | DIR-CLOSE | Final cycle closure |
| Roadmap Doc | ROADMAP | Optional staging map |
| Context Handoff | CSO | Session continuity snapshot |

Rule: Show meaning first, artifact code second.
```

---

## Acceptance Criteria

| AC | Criteria | Verification |
|---|---|---|
| AC-01 | README has "You Do Not Operate Sigma Manually" section | Read README.md |
| AC-02 | README has human labels table | Read README.md |
| AC-03 | `/report` shortcut appears before or within Quick Start | Read README.md structure |
| AC-04 | All 4 `/report` skill files use Sigma Briefing output format | Read each file |
| AC-05 | All role skill files (16 files) have Director-Facing Communication Rules section | Read each file |
| AC-06 | `sigma project status` output uses `Intent Doc (DIR-INTENT v1)` format | Run `sigma project status` |
| AC-07 | `sigma session bootstrap` output uses human label format | Run `sigma session bootstrap` |
| AC-08 | SIGMA_PROTOCOL.md has Director-Facing Labels section | Read SIGMA_PROTOCOL.md |
| AC-09 | No governance gate rules, authorization language, or artifact data structures changed | Diff check |

---

## Implementation Constraints

| Constraint | Reason |
|---|---|
| No changes to `Sigma/progress.json` schema or fields | CLI depends on exact field names |
| No changes to CLI command names or flags | Would break existing user sessions and documentation |
| No changes to governance rule logic in `SIGMA_PROTOCOL.md` | Doctrine is correct; only labels change |
| `SIGMA_README.md` core content must stay in sync with `README.md` | Both are distributed; divergence on governance content causes confusion. Package-specific notes (npm install, versioning) may differ between the two. |
| Skill file structure (frontmatter, sections) must remain compatible | Claude Code and other agents load these as skill definitions |

---

## Risk / Watch-Out

- **Skill file duplication**: Changes to 16 role skill files across 4 targets are repetitive. Risk of inconsistency between targets. Mitigation: apply to `claude_code` first, then propagate to `reasonix`, `antigravity`, and `codex`.
- **Codex extensionless files**: `setup/targets/codex/` files have no `.md` extension. Content format is identical to other targets. Apply same changes, preserve no extension.
- **Word limit inflation**: Sigma Briefing format is slightly longer than current `/report` template. Word limits raised modestly (350/600). Trimming order rule mitigates runaway length.
- **`bridge` target**: `setup/targets/bridge/` contains platform bridge files (`CLAUDE.md`, `REASONIX.md`, etc.), not role skill files. Bridge target is out of scope for TASK-02 and TASK-03.

---

## Task Order

```
TASK-01 (README)
TASK-02 (/report skill)
TASK-03 (role skill files)
TASK-04 (CLI output)
TASK-05 (SIGMA_PROTOCOL)
```

TASK-01 and TASK-02 are independent. TASK-03 depends on the label mapping defined in TASK-01. TASK-04 and TASK-05 are independent of each other.
