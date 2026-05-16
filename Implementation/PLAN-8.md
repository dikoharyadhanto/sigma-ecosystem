# Implementation Plan — Phase 8: /report Skill

**Phase**: 8  
**Goal**: Add the `/report` universal Director briefing skill to all 4 AI platforms. Update `sigma setup install` to deploy it. Update `SIGMA_README.md` and `PLAN-6.md` skill count references. Version bump 0.7.0 → 0.8.0.  
**Status**: PENDING  
**Prerequisites**: Phase 7 complete — validation passed, version at 0.7.0, all 24 skill files deployed and verified

---

## Source Material

| File | Role |
| :--- | :--- |
| `Discussion/SIGMA_REPORT_FEATURE_NOTE.md` | Authoritative feature spec — identity, activation, word limits, output format, constraints, 12 ACs |
| `setup/targets/claude_code/cso.md` | Reference: skill file structure and content depth |
| `src/commands/setup.ts` lines 38–41 | SKILL_FILES map — where report must be added for all 4 platforms |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Check if `/report` needs a registry entry (read-only skill, likely no) |
| `SIGMA_README.md` | Updated to mention `/report` as Director briefing shortcut |
| `Implementation/PLAN-6.md` | Skill count references (24 → 28, 6 skills → 7) must be updated |

---

## Design Decisions

### 1. `/report` Is a Universal Skill, Not a Governance Role

`/report` does not switch roles, does not create artifacts, does not mutate state.

It is a read-only chat-only briefing. The active role remains active after invoking `/report`.

This means:
- No `sigma cso new` or any write operation is triggered
- No runtime state change in `progress.json`
- No new artifact in `Sigma/logs/`
- Role immutability is preserved — a session in FMN mode stays FMN mode after `/report`

### 2. Skill File Content Is Identical Across Platforms

All 4 platform skill files share the same content. Only the filename and path differ:

| Platform | File |
| :--- | :--- |
| Claude Code | `setup/targets/claude_code/report.md` |
| Codex CLI | `setup/targets/codex/report` (no extension) |
| Reasonix | `setup/targets/reasonix/report.md` |
| Antigravity | `setup/targets/antigravity/report.md` |

### 3. Skill File Content Specification

Each `/report` skill file must contain:

**Identity block:**
- Universal, read-only, not a governance role
- Does not break role immutability
- Active role remains active after report

**Activation:**
- `/report` — default, 300 words max
- `/report --brief` — 150 words max
- `/report --full` — 500 words max

**Word limit enforcement:** AI-side behavioral self-governance. The skill file must state the limits clearly and explicitly. No CLI enforcement required — consistent with Sigma's behavioral governance model.

**Information sources (read-only):**
- `sigma session bootstrap` or `sigma project status` — if CLI available
- `Sigma/progress.json` — lifecycle phase and gate status
- `Sigma/design/` — active DIR-INTENT version and state
- `Sigma/build/` — ROADMAP, FMN-PLAN, DEV-EXEC versions and states
- `Sigma/close/` — DIR-CLOSE state if applicable
- `Sigma/memory/decisions.jsonl` — recent lock events
- `Sigma/logs/` — CSO handoff artifacts if available
- `sigma git evidence` — Git branch, working tree state, changed files
- Any artifact currently in session context
- Current conversation context

**Output format (exact structure, every invocation):**

```markdown
# Sigma Report

**Current State:** [One sentence: lifecycle phase, active artifacts, gate status]

**Director Should Know:**
- [Most important fact or finding right now]
- [Second most important — omit if nothing significant]

**Decisions So Far:**
- [Key locked decision shaping current work]
- [Second locked decision if relevant — omit if not]

**Open Risk / Question:** [One unresolved issue, blocker, or open question. If none: "None at this time."]

**Recommended Next Move:** [One concrete decision or action to move the project forward]
```

**Forbidden operations (during or after `/report`):**
- Any `sigma intent lock`, `sigma plan lock`, `sigma exec lock`, `sigma close lock`
- Any `sigma plan supersede`, `sigma exec supersede`, `sigma project reset`
- Any stale-intent acknowledgment command
- Any artifact creation command
- Any Git write operation (`git add`, `git commit`, `git reset`, `git checkout`)
- Any file modification

**Perspective follows active role:**
- ARC: may surface intent clarity issues
- FMN: may surface plan gaps or test-contract issues
- DEV: may surface implementation blockers or Git evidence
- AUD: may surface risk findings or evidence weaknesses
- Professional Mode: neutral status summary

**No invented content:** Every item must be grounded in actual project state, artifact content, or conversation context. If unknown, write `unknown`. Do not guess.

### 4. `sigma setup install` Must Deploy report Skill

`src/commands/setup.ts` SKILL_FILES map (lines 38–41) must be updated to include `report` for all 4 platforms:

```typescript
claudeCode:  { ..., report: 'report.md' },
codex:       { ..., report: 'report'    },
reasonix:    { ..., report: 'report.md' },
antigravity: { ..., report: 'report.md' },
```

Skill count in any user-facing output (e.g., `OK  Claude Code (7 skills)`) updates automatically from the map size — no hardcoded count to change in the deploy logic.

### 5. SIGMA-OPERATION-REGISTRY Does Not Need a `/report` Entry

`/report` is an AI-side skill, not a CLI command. The registry tracks CLI operations only. No registry update required.

### 6. PLAN-6.md Is a Living Document — Update the Counts

PLAN-6.md references "24 skill files" and "6 skills." These are now stale. Update them to reflect the new total: 28 files, 7 skills. This is a doc correction, not a re-execution of Phase 6.

---

## Output Files

| File | Action | Description |
| :--- | :--- | :--- |
| `setup/targets/claude_code/report.md` | Create | `/report` skill file for Claude Code |
| `setup/targets/codex/report` | Create | `/report` skill file for Codex CLI (no extension) |
| `setup/targets/reasonix/report.md` | Create | `/report` skill file for Reasonix |
| `setup/targets/antigravity/report.md` | Create | `/report` skill file for Antigravity |
| `src/commands/setup.ts` | Update | Add `report` to SKILL_FILES map for all 4 platforms |
| `SIGMA_README.md` | Update | Add `/report` to skill roster and Director shortcuts section |
| `Implementation/PLAN-6.md` | Update | Change skill count references: 24 → 28 files, 6 → 7 skills |
| `src/config.ts` | Update | SIGMA_VERSION bump to `0.8.0` |
| `package.json` | Update | Version bump to `0.8.0` |

---

## Task 1 — Create `/report` Skill Files

Create all 4 platform skill files with identical content following Design Decision 3.

Files to create:
- `setup/targets/claude_code/report.md`
- `setup/targets/codex/report`
- `setup/targets/reasonix/report.md`
- `setup/targets/antigravity/report.md`

Verify content includes:
- Identity: universal, read-only, not a governance role
- Activation: `/report`, `/report --brief`, `/report --full`
- Word limits: 300 / 150 / 500
- Forbidden operations list
- Output format (exact 5-section structure)
- Perspective-follows-active-role guidance
- No-invented-content rule

---

## Task 2 — Update `src/commands/setup.ts`

Add `report` to the SKILL_FILES map for all 4 platforms (Design Decision 4).

Verify:
- `npm run build` passes with 0 TypeScript errors after the change
- The skill count in `sigma setup install` user-facing output reflects 7 skills per platform

---

## Task 3 — Update `SIGMA_README.md`

Add `/report` to the skill roster section.

Minimum additions:
1. Add `/report` to the skill list alongside `/arc`, `/fmn`, `/dev`, `/aud`, `/checkpoint`, `/cso`
2. Add a one-line description: "Quick Director briefing — current state, decisions, risks, next move"
3. Add `/report` to the Director quick-reference shortcuts section if one exists

Do not rewrite sections that are not affected.

---

## Task 4 — Update `Implementation/PLAN-6.md`

Correct stale skill count references:

| Find | Replace |
| :--- | :--- |
| `24 skill files` | `28 skill files` |
| `6 skills` | `7 skills` |
| `4 platforms × 6 skills = 24 files` | `4 platforms × 7 skills = 28 files` |

Add `/report` to any skill roster list in PLAN-6.md.

Do not change PLAN-6.md Status or any other content.

---

## Task 5 — Version Bump

On clean pass (all acceptance criteria below met):

### 5a. `src/config.ts`
```typescript
export const SIGMA_VERSION = '0.8.0';
```

### 5b. `package.json`
```json
"version": "0.8.0"
```

Do not bump version until all acceptance criteria pass.

---

## Acceptance Criteria

| AC ID | Criterion |
| :--- | :--- |
| AC-REPORT-01 | `setup/targets/claude_code/report.md` exists |
| AC-REPORT-02 | `setup/targets/codex/report` exists |
| AC-REPORT-03 | `setup/targets/reasonix/report.md` exists |
| AC-REPORT-04 | `setup/targets/antigravity/report.md` exists |
| AC-REPORT-05 | `/report` skill file states it is universal, read-only, and not a governance role |
| AC-REPORT-06 | `/report` skill file states it does not break role immutability |
| AC-REPORT-07 | `/report` skill file defines word limits: 300 default, 150 brief, 500 full |
| AC-REPORT-08 | `/report` skill file forbids lock, supersede, reset, state advance, artifact creation, and Git write operations |
| AC-REPORT-09 | `/report` skill file includes Git Diff Evidence (`sigma git evidence`) as an allowed read-only source |
| AC-REPORT-10 | `/report` output format includes all 5 required sections: Current State, Director Should Know, Decisions So Far, Open Risk / Question, Recommended Next Move |
| AC-REPORT-11 | `PLAN-6.md` skill count updated: 24 → 28 files, 6 → 7 skills |
| AC-REPORT-12 | `SIGMA_README.md` mentions `/report` as a quick Director briefing skill |
| AC-13 | `src/commands/setup.ts` SKILL_FILES map includes `report` entry for all 4 platforms (claudeCode, codex, reasonix, antigravity) |
| AC-14 | `sigma setup install` deploys report skill file to detected tool directories (verified by manual install test or file existence check after install) |
| AC-15 | `npm run build` passes with 0 TypeScript errors after all changes |
| AC-16 | `SIGMA_VERSION` in `config.ts` and `version` in `package.json` both read `"0.8.0"` |

---

*PLAN-8 — Phase 8: /report Skill — drafted 2026-05-17*
