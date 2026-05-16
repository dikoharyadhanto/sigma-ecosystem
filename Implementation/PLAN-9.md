# Implementation Plan — Phase 9: Cross-Role CSO Check + CSO Metadata

**Phase**: 9  
**Goal**: Add Cross-Role CSO Check to all 4 governance role skill files and rule files. Add CSO Metadata section to CSO template. Update checkpoint and cso skill files to populate metadata on creation. No new CLI commands. No changes to `src/commands/cso.ts`. Version bump 0.8.0 → 0.9.0.  
**Status**: PENDING  
**Prerequisites**: Phase 8 complete — `/report` skill deployed, version at 0.8.0

---

## Revision Note

PLAN-9 was revised before execution. Original scope excluded CSO template changes and checkpoint/cso skill file updates. After Director and AUD decision, scope expanded to include:

- CSO Metadata section in `CSO-TEMPLATE.md`
- `/checkpoint` skill file updates (Source: CHECKPOINT metadata)
- `/cso` skill file updates (Source: CSO metadata)
- Expanded Cross-Role CSO Check logic (priority + filter, not just "check 3 files")

The original "no CSO template change" boundary is removed.

---

## Source Material

| File | Role |
| :--- | :--- |
| `Discussion/CSO_RESUME_IMPROVEMENT_SPEC.md` | Original resume spec — context only; PLAN-9 implements simpler skill-based alternative |
| `src/commands/cso.ts` | Confirmed: `sigma cso new` copies `CSO-TEMPLATE.md` directly — no CLI changes needed |
| `Sigma/templates/CSO-TEMPLATE.md` | Updated with CSO Metadata section |
| `setup/targets/claude_code/arc.md` | Reference: current skill file bootstrap format |
| `setup/targets/claude_code/checkpoint.md` | Updated: add Source: CHECKPOINT metadata instruction |
| `setup/targets/claude_code/cso.md` | Updated: add Source: CSO metadata instruction |
| `Sigma/rules/FMN-RULE.md` | Reference: current Session Bootstrap section format |

---

## Design Decisions

### 1. One Artifact Type, Two Source Modes

CSO remains a single artifact type. Two source modes differentiate intent:

| Source | Created by | Purpose |
| :--- | :--- | :--- |
| `CHECKPOINT` | `/checkpoint` skill | Quick state preservation mid-session |
| `CSO` | `/cso` skill | Formal handoff between sessions |

Control doctrine:

```
/checkpoint CSO preserves context.
/cso CSO transfers context.
Both readable.
Neither authority.
```

### 2. CSO Metadata Section — Added to Template

`CSO-TEMPLATE.md` gets a new `## CSO Metadata` section at the top, immediately after the file title.

Required fields:

| Field | Value |
| :--- | :--- |
| Source | `CHECKPOINT` / `CSO` |
| Created By Role | `ARC` / `FMN` / `DEV` / `AUD` / `Professional` / `CSO` |
| Purpose | `Quick state preservation` / `Formal handoff` |
| Related Artifact | Artifact type + version, if applicable |
| Related Artifact State | `DRAFT` / `LOCKED` / etc., if known |
| Authority Level | `Context Only` |

`Authority Level` is always `Context Only`. No other value is valid.

### 3. No `src/commands/cso.ts` Changes Needed

`sigma cso new` (without `--from`) copies `CSO-TEMPLATE.md` directly to `Sigma/logs/`. Updating the template is sufficient — the metadata section appears in all new CSO files automatically.

`sigma cso new --from <file>` bypasses the template and copies the source file directly. Skill files must instruct the AI: when using `--from`, ensure the draft file already contains the metadata section before running the command.

### 4. Skill File Patch — `/checkpoint` (4 files)

Add metadata population instruction to the checkpoint skill files.

The AI must fill these fields when creating a CSO via `/checkpoint`:

```
Source: CHECKPOINT
Created By Role: [active governance role, e.g. FMN]
Purpose: Quick state preservation
Related Artifact: [artifact being worked on, e.g. FMN-PLAN-v2]
Related Artifact State: [current state, e.g. DRAFT]
Authority Level: Context Only
```

### 5. Skill File Patch — `/cso` (4 files)

Add metadata population instruction to the cso skill files.

The AI must fill these fields when creating a CSO via `/cso`:

```
Source: CSO
Created By Role: [creating role or CSO if invoked as standalone]
Purpose: Formal handoff
Related Artifact: [primary artifact being handed off, if applicable]
Related Artifact State: [current state, if known]
Authority Level: Context Only
```

When using `--from <file>`, verify the draft file includes the metadata section. If missing, add it before running the command.

### 6. Cross-Role CSO Mapping

Each governance role checks a specific set of CSO sources:

| Role | Check CSOs from |
| :--- | :--- |
| ARC | AUD, FMN |
| FMN | ARC, AUD, FMN |
| DEV | FMN, AUD, DEV |
| AUD | Passive only — see Decision 8 |

CSO files are named `CSO-{ROLE}-{YYYYMMDD}-{HHMM}.md`. Filter by role prefix (e.g., `CSO-AUD-`, `CSO-FMN-`). Pick latest by timestamp in filename.

### 7. Cross-Role CSO Check — Full Logic

The check is not just "read 3 recent CSO files." The AI must apply this logic:

**Step 1 — Collect:** Find CSO files in `Sigma/logs/` matching relevant role prefixes.

**Step 2 — Prioritize:** Sort by:
1. `Source: CSO` (formal handoff) before `Source: CHECKPOINT` (quick snapshot)
2. Within same source type: newest first by filename timestamp

**Step 3 — Filter for relevance:**
- Compare `Related Artifact` field against current active artifact version from `progress.json`
- If mismatched version: mark as potentially stale, use with caution
- If no metadata: fallback heuristics (see Decision 9), treat with lower confidence

**Step 4 — Cap at 3:** Take the top 3 after prioritization and filtering.

**Step 5 — Apply authority rule:** All CSO content is context only. Never override locked artifacts, `progress.json`, or explicit Director decisions. Report any conflict to the Director.

### 8. AUD Is Passive — Different Rule

AUD must not independently browse `Sigma/logs/`. AUD reads CSO files only when the Director explicitly provides or authorizes them as part of the audit scope.

If CSO context would be useful, AUD asks:

> "Should I include recent [ARC/FMN/DEV] CSO files in this audit scope? If yes, please provide or authorize the specific files."

### 9. Fallback for CSO Files Without Metadata

For CSO files created before PLAN-9 (no metadata section), the AI may infer:

| Signal | Inference |
| :--- | :--- |
| Filename prefix (e.g., `CSO-FMN-`) | `Created By Role: FMN` |
| Contains phrase "Checkpoint captured" | `Source: CHECKPOINT` (low confidence) |
| Contains phrase "Formal handoff" | `Source: CSO` (low confidence) |
| No signal | Treat as `Source: CHECKPOINT`, lower priority |

Fallback inference is fragile. Treat inferred metadata with lower confidence than declared metadata. This is a safety net, not a designed behavior.

### 10. Authority Rule — Universal

All skill files and rule files must include this authority rule:

```
CSO content is carry-forward context only.

It must not override:
- locked DIR-INTENT
- locked FMN-PLAN
- locked DEV-EXEC
- DIR-CLOSE
- progress.json runtime state
- explicit Director decision

If CSO content conflicts with locked artifacts or progress.json:
- locked artifacts and progress.json win.
- Report the conflict to the Director if it affects the next action.
- Do not silently resolve the conflict.

If CSO content appears stale (related artifact version does not match active version):
- mention it briefly.
- do not rely on it as current truth.
```

---

## Output Files

| File | Action | Description |
| :--- | :--- | :--- |
| `Sigma/templates/CSO-TEMPLATE.md` | Update | Add `## CSO Metadata` section at top |
| `setup/targets/claude_code/checkpoint.md` | Update | Add metadata population instruction (Source: CHECKPOINT) |
| `setup/targets/codex/checkpoint` | Update | Add metadata population instruction (Source: CHECKPOINT) |
| `setup/targets/reasonix/checkpoint.md` | Update | Add metadata population instruction (Source: CHECKPOINT) |
| `setup/targets/antigravity/checkpoint.md` | Update | Add metadata population instruction (Source: CHECKPOINT) |
| `setup/targets/claude_code/cso.md` | Update | Add metadata population instruction (Source: CSO) |
| `setup/targets/codex/cso` | Update | Add metadata population instruction (Source: CSO) |
| `setup/targets/reasonix/cso.md` | Update | Add metadata population instruction (Source: CSO) |
| `setup/targets/antigravity/cso.md` | Update | Add metadata population instruction (Source: CSO) |
| `setup/targets/claude_code/arc.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/claude_code/fmn.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/claude_code/dev.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/claude_code/aud.md` | Update | Add External Audit CSO Scope section |
| `setup/targets/codex/arc` | Update | Add Cross-Role CSO Check section |
| `setup/targets/codex/fmn` | Update | Add Cross-Role CSO Check section |
| `setup/targets/codex/dev` | Update | Add Cross-Role CSO Check section |
| `setup/targets/codex/aud` | Update | Add External Audit CSO Scope section |
| `setup/targets/reasonix/arc.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/reasonix/fmn.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/reasonix/dev.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/reasonix/aud.md` | Update | Add External Audit CSO Scope section |
| `setup/targets/antigravity/arc.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/antigravity/fmn.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/antigravity/dev.md` | Update | Add Cross-Role CSO Check section |
| `setup/targets/antigravity/aud.md` | Update | Add External Audit CSO Scope section |
| `Sigma/rules/ARC-RULE.md` | Update | Add CSO Check step to Session Bootstrap section |
| `Sigma/rules/FMN-RULE.md` | Update | Add CSO Check step to Session Bootstrap section |
| `Sigma/rules/DEV-RULE.md` | Update | Add CSO Check step to Session Bootstrap section |
| `Sigma/rules/AUD-RULE.md` | Update | Add passive CSO scope rule to Session Bootstrap section |
| `src/config.ts` | Update | SIGMA_VERSION bump to `0.9.0` |
| `package.json` | Update | Version bump to `0.9.0` |

**Total**: 29 file updates + 2 version bumps = 31 items

---

## Task 1 — Update CSO Template

Update `Sigma/templates/CSO-TEMPLATE.md`.

Add `## CSO Metadata` section immediately after the file title and before any existing sections.

Metadata table must contain all 6 fields from Design Decision 2. `Authority Level` value must always be `Context Only` — no placeholder, no alternatives.

---

## Task 2 — Update `/checkpoint` Skill Files (4 files)

Update all 4 platform checkpoint skill files.

Add a `## CSO Metadata Population` section instructing the AI to fill metadata when creating a CSO via `/checkpoint` (Design Decision 4).

Place after the existing Scope and Authority section.

Files:
- `setup/targets/claude_code/checkpoint.md`
- `setup/targets/codex/checkpoint`
- `setup/targets/reasonix/checkpoint.md`
- `setup/targets/antigravity/checkpoint.md`

---

## Task 3 — Update `/cso` Skill Files (4 files)

Update all 4 platform cso skill files.

Add a `## CSO Metadata Population` section instructing the AI to fill metadata when creating a CSO via `/cso` (Design Decision 5).

Include the `--from` nuance: verify draft file contains metadata section before running `sigma cso new --from <file>`.

Place after the existing Scope and Authority section.

Files:
- `setup/targets/claude_code/cso.md`
- `setup/targets/codex/cso`
- `setup/targets/reasonix/cso.md`
- `setup/targets/antigravity/cso.md`

---

## Task 4 — Update ARC, FMN, DEV Skill Files (12 files)

Add the Cross-Role CSO Check section to all 12 ARC/FMN/DEV skill files across 4 platforms.

Section must include (Design Decisions 6, 7, 10):
- Role-to-CSO mapping (all three role mappings listed inline)
- Full priority and filter logic (Source priority, staleness check, artifact relevance check)
- Fallback heuristics for CSO files without metadata
- Authority rule (CSO is context only; locked artifacts and progress.json win)

Place immediately after the existing Bootstrap Protocol section.

Files: `arc`, `fmn`, `dev` across `claude_code`, `codex`, `reasonix`, `antigravity`.

---

## Task 5 — Update AUD Skill Files (4 files)

Add the External Audit CSO Scope section to all 4 AUD skill files (Design Decision 8).

Section must state:
- AUD does not independently browse `Sigma/logs/`
- CSO files reviewed only when Director explicitly provides or authorizes
- Sample Director authorization question

Place immediately after the existing Bootstrap Protocol section.

Files: `aud` across `claude_code`, `codex`, `reasonix`, `antigravity`.

---

## Task 6 — Update Role Rule Files (4 files)

Update Session Bootstrap section in `Sigma/rules/ARC-RULE.md`, `FMN-RULE.md`, `DEV-RULE.md`.

Add after the existing artifact read steps:

```
Cross-Role CSO Check: After reading runtime state and active artifacts,
apply the Cross-Role CSO Check logic — collect relevant CSO files by role prefix,
prioritize Source: CSO over Source: CHECKPOINT, filter by artifact relevance,
cap at 3. CSO is context only. Locked artifacts and progress.json win over
any CSO content. Conflicts must be reported to Director, not silently resolved.
```

Update `Sigma/rules/AUD-RULE.md` Session Bootstrap section:

```
CSO Scope: AUD does not independently scan Sigma/logs/ for CSO files.
AUD reads CSO files only when the Director explicitly provides or authorizes
them as part of the audit scope. If CSO context is needed, ask the Director
with an explicit scope question before reading any CSO file.
```

---

## Task 7 — Version Bump

On clean pass (all acceptance criteria met):

### 7a. `src/config.ts`
```typescript
export const SIGMA_VERSION = '0.9.0';
```

### 7b. `package.json`
```json
"version": "0.9.0"
```

Do not bump version until all acceptance criteria pass.

---

## Acceptance Criteria

| AC ID | Criterion |
| :--- | :--- |
| AC-01 | `Sigma/templates/CSO-TEMPLATE.md` contains `## CSO Metadata` section with all 6 fields |
| AC-02 | `Authority Level` field in CSO template is hardcoded to `Context Only` with no alternative values |
| AC-03 | All 4 `/checkpoint` skill files contain `## CSO Metadata Population` section instructing `Source: CHECKPOINT` |
| AC-04 | All 4 `/cso` skill files contain `## CSO Metadata Population` section instructing `Source: CSO` |
| AC-05 | `/cso` skill files include `--from` nuance: verify metadata in draft before running command |
| AC-06 | All 12 ARC/FMN/DEV skill files across 4 platforms contain Cross-Role CSO Check section after Bootstrap Protocol |
| AC-07 | Cross-Role CSO Check section includes full role-to-CSO mapping (ARC → AUD/FMN; FMN → ARC/AUD/FMN; DEV → FMN/AUD/DEV) |
| AC-08 | Cross-Role CSO Check section includes priority logic: `Source: CSO` before `Source: CHECKPOINT` |
| AC-09 | Cross-Role CSO Check section includes staleness filter: compare Related Artifact version against active version |
| AC-10 | Cross-Role CSO Check section includes fallback heuristics for CSO files without metadata |
| AC-11 | Cross-Role CSO Check section caps check at 3 CSO files |
| AC-12 | All 4 AUD skill files contain External Audit CSO Scope section stating AUD does not independently browse `Sigma/logs/` |
| AC-13 | AUD skill files include sample Director authorization question for CSO scope |
| AC-14 | `Sigma/rules/ARC-RULE.md` Session Bootstrap includes Cross-Role CSO Check step with authority rule |
| AC-15 | `Sigma/rules/FMN-RULE.md` Session Bootstrap includes Cross-Role CSO Check step with authority rule |
| AC-16 | `Sigma/rules/DEV-RULE.md` Session Bootstrap includes Cross-Role CSO Check step with authority rule |
| AC-17 | `Sigma/rules/AUD-RULE.md` Session Bootstrap includes passive CSO scope rule |
| AC-18 | Authority rule present in all ARC/FMN/DEV skill file CSO Check sections: locked artifacts and progress.json win; conflicts reported to Director |
| AC-19 | `src/commands/cso.ts` is unchanged |
| AC-20 | No new CLI commands added — `sigma --help` output unchanged from Phase 8 |
| AC-21 | `npm run build` passes with 0 TypeScript errors after all changes |
| AC-22 | `SIGMA_VERSION` in `config.ts` and `version` in `package.json` both read `"0.9.0"` |

---

## Scope Boundary

**In scope:**
- `CSO-TEMPLATE.md` metadata section (1 file)
- `/checkpoint` skill file metadata instruction (4 files)
- `/cso` skill file metadata instruction (4 files)
- ARC/FMN/DEV skill file CSO Check section (12 files)
- AUD skill file CSO scope section (4 files)
- Role rule file Session Bootstrap updates (4 files)
- Version bump

**Out of scope:**
- `src/commands/cso.ts` — no changes needed; template copy handles metadata automatically
- `sigma cso list` or any new CLI command — deferred
- `sigma resume` command — deferred to Sigma v2
- `/report` skill files — handled in PLAN-8
- Any changes to `progress.json` schema

---

*PLAN-9 — Phase 9: Cross-Role CSO Check + CSO Metadata — revised 2026-05-17*
