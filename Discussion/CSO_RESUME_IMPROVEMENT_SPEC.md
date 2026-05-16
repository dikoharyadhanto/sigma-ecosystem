# CSO Improvement Spec — Resume-Ready Handoff Context

## Purpose

Improve CSO so it can support a new CLI command such as:

```bash
sigma resume --fmn
sigma resume --dev
sigma resume --arc
sigma resume --aud
```

The goal is to make CSO usable not only as a saved handoff artifact, but also as structured intake context for the next AI role/session.

CSO should remain informational. It must not become runtime truth. Runtime truth remains:

1. `Sigma/progress.json`
2. locked active artifacts
3. CLI-managed lifecycle state

CSO provides continuity context only.

---

## Problem

Current CSO/checkpoint flow can persist session state, but the next AI role may only see the CSO file name through `sigma session bootstrap`.

This means CSO is stored, but not necessarily consumed.

Current effective flow:

```text
/checkpoint or /cso
→ creates CSO file in Sigma/logs/
→ registers CSO in progress.json
→ later bootstrap shows recent CSO file names
```

Missing flow:

```text
/fmn or /dev in a later session
→ automatically receives relevant handoff context
→ reads important CSO sections
→ resumes with correct decisions, open threads, and warnings
```

---

## Design Direction

Add a new CLI-level resume intake command:

```bash
sigma resume --fmn
```

The command should:

1. Read current runtime state from `progress.json`.
2. Show active artifact versions and gate blockers.
3. Collect up to the latest 3 CSO files.
4. Extract selected structured sections from each CSO.
5. Present a compact role-specific resume summary.
6. Remind the AI role that CSO is handoff context only, not authority.

Do not put full CSO content into `progress.json`.

`progress.json` should remain a runtime state/index file, not a context dump.

---

## CSO Template Changes

Update `CSO-TEMPLATE.md` to include parseable sections optimized for resume intake.

Recommended structure:

```md
# CSO — Cognitive State Object

## 1. Session Identity

- Role:
- Created At:
- Lifecycle Phase:
- Active INTENT:
- Active ROADMAP:
- Active PLAN:
- Active EXEC:
- Active CLOSE:

---

## 2. Current Work State

Briefly describe what was being worked on when this CSO was created.

- Current focus:
- Completed in this session:
- Incomplete / paused work:
- Current artifact being edited or reviewed:

---

## 3. Carry-Forward Notes

These are context items the next AI role/session should preserve.

### 3.1 Director Decisions

- [ACTIVE/PENDING/SUPERSEDED] ...
  - Authority: Director
  - Applies to:
  - Impact:
  - Carry Forward: Yes / No

### 3.2 Active Constraints

- [ACTIVE/PENDING/SUPERSEDED] ...
  - Source:
  - Applies to:
  - Impact:
  - Carry Forward: Yes / No

### 3.3 Working Assumptions

- [ACTIVE/PENDING/SUPERSEDED] ...
  - Source:
  - Confidence: High / Medium / Low
  - Validation needed:
  - Carry Forward: Yes / No

### 3.4 Role Recommendations

- [ACTIVE/PENDING/SUPERSEDED] ...
  - Source Role:
  - Recommendation:
  - Requires Director Decision: Yes / No
  - Carry Forward: Yes / No

---

## 4. Open Threads

Questions, blockers, incomplete reasoning, or unresolved issues.

- [OPEN/RESOLVED/CARRIED] ...
  - Owner:
  - Needed next:
  - Affects:

---

## 5. Risks / Warnings

- Risk:
  - Severity: Low / Medium / High / Critical
  - Source:
  - Impact:
  - Recommended handling:

---

## 6. Evidence / Files / References

- Relevant files:
- Artifact references:
- Git evidence:
- Test evidence:
- External references:

---

## 7. Recommended Next Action

One concise recommendation for the next session or role.

Recommended next action:

```text
...
```

---

## 8. Resume Notes for Next AI Role

Direct notes to the next AI role. Keep this concise and operational.

- If next role is ARC:
- If next role is FMN:
- If next role is DEV:
- If next role is AUD:
- If next role is CHECKPOINT/CSO:

---

## 9. Conflict / Trust Rule

CSO is handoff context only.

If this CSO conflicts with `progress.json`, locked artifacts, or CLI state, trust runtime state and locked artifacts.

Report any conflict to the Director before acting.
```

---

## Why “Carry-Forward Notes” Instead of Just “Decisions”

Not every important handoff item is a final decision.

A CSO may contain:

- confirmed Director decisions;
- active constraints;
- pending questions;
- temporary working assumptions;
- advisory recommendations;
- unresolved risks.

Calling all of these “decisions” can make AI over-trust non-authoritative notes.

Therefore, use `Carry-Forward Notes` with subcategories and explicit status labels.

Required labels:

```text
ACTIVE
PENDING
SUPERSEDED
LOCAL
```

Recommended authority/source fields:

```text
Authority: Director / ARC / FMN / DEV / AUD / CLI / Artifact / Unknown
Carry Forward: Yes / No
Requires Director Decision: Yes / No
```

---

## Proposed `sigma resume --<role>` Output

Example:

```text
=== Sigma Resume: FMN ===

Runtime State
- Lifecycle: BUILD
- INTENT: v1 [LOCKED]
- ROADMAP: v1 [LOCKED]
- PLAN: v2 [DRAFT]
- EXEC: none
- Gate blockers: PLAN not locked

Recent CSO Context
1. Sigma/logs/CSO-FMN-20260517-2310.md
   - Work state: PLAN v2 Sections 1–4 complete; Section 5 incomplete.
   - Director decisions:
     - [ACTIVE] No destructive database migration.
   - Active constraints:
     - Data preservation evidence required.
   - Open threads:
     - Define rollback/migration safety test.
   - Recommended next action:
     - Continue FMN-PLAN Section 5.

2. Sigma/logs/CSO-DEV-20260517-2200.md
   - Work state: DEV blocked by incomplete test contract.
   - Risks:
     - Schema migration risk not yet bounded.
   - Recommended next action:
     - FMN must clarify expected migration evidence before DEV continues.

Resume Instruction
- Read active DIR-INTENT and active/latest FMN-PLAN before editing.
- Use CSO as handoff context only.
- Runtime truth remains progress.json and locked artifacts.
```

---

## CLI Behavior Recommendation

Command:

```bash
sigma resume --fmn
```

Equivalent role flags:

```bash
sigma resume --arc
sigma resume --fmn
sigma resume --dev
sigma resume --aud
sigma resume --cso
```

Default behavior:

- Read current `progress.json`.
- Print runtime state.
- Find latest 3 CSO entries:
  1. Prefer `progress.json.cso`.
  2. Fallback scan `Sigma/logs/CSO-*.md` by modified time.
- Parse selected sections from each CSO.
- Display only sections useful for the selected role.
- If no CSO exists, print `Recent CSO Context: none`.

Optional future flags:

```bash
sigma resume --fmn --limit 5
sigma resume --dev --latest
sigma resume --all
sigma resume --fmn --paths-only
```

Start minimal. `--limit` can default to 3.

---

## Role Skill Update

Update role skills such as `/fmn`, `/dev`, `/arc`, and `/aud`.

Current bootstrap step usually includes:

```text
Run sigma session bootstrap
```

Recommended update:

```text
Run `sigma resume --<role>` at activation.
Use the resume output as handoff context only.
If resume output conflicts with progress.json or locked artifacts, trust runtime state and report the conflict.
```

For example, `/fmn` should run:

```bash
sigma resume --fmn
```

Then proceed with FMN behavior:

1. Read locked DIR-INTENT.
2. Read active/latest FMN-PLAN if present.
3. Use CSO carry-forward context only when relevant.
4. Continue planning or review based on current gate state.

---

## Important Safety Rule

CSO must not become authority.

Hard rule:

```text
progress.json + locked artifacts = runtime truth
CSO = handoff context
```

If conflict is detected:

```text
- Do not silently resolve it.
- Trust progress.json and locked artifacts.
- Report the mismatch to Director.
- Ask for clarification only if the conflict affects the next action.
```

---

## Implementation Notes

Suggested helper functions:

```ts
findRecentCsoFiles(projectRoot, limit = 3): CsoRef[]
readCsoSections(filePath): ParsedCso
formatResume(role, progress, parsedCsos): string
```

Suggested parse strategy:

- Use exact markdown headings.
- Extract content between heading and next heading.
- If section missing, skip gracefully.
- Do not fail resume because one CSO is malformed.

Sections to parse first:

```text
## 2. Current Work State
## 3. Carry-Forward Notes
## 4. Open Threads
## 5. Risks / Warnings
## 7. Recommended Next Action
## 8. Resume Notes for Next AI Role
```

---

## Acceptance Criteria

- `sigma resume --fmn` prints runtime state and up to 3 recent CSO summaries.
- Resume output includes current lifecycle, active artifacts, and gate blockers.
- Resume output includes carry-forward decisions/constraints/open threads when present.
- Resume output clearly states CSO is not runtime truth.
- If no CSO exists, command still prints runtime state and says CSO context is none.
- Role skills can replace or augment `sigma session bootstrap` with `sigma resume --<role>`.
- Existing CSO files without new sections do not break the command.

---

## Summary

The issue is not CSO persistence. CSO already persists.

The missing layer is CSO intake.

Add `sigma resume --<role>` and make CSO template resume-ready through structured carry-forward sections.

This turns CSO from passive saved context into active AI-role intake context while preserving Sigma's authority model.
