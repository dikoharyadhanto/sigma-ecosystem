# PLAN-0A — Phase 0A: Doctrine

> **Phase**: 0A — Doctrine
> **Output**: `SIGMA_CONSTITUTION.md` + `SIGMA_PROTOCOL.md` (v0.1 foundational)
> **Gate**: Director review required before Phase 0B begins
> **Location**: Both files created at sigma-ecosystem root

---

## Objective

Establish the doctrine layer — Sigma's identity, constitutional basis, lifecycle, roles, artifacts, gates, and operational principles. Everything downstream (registries, templates, CLI) must conform to what is defined here.

SIGMA_PROTOCOL.md is a **living document** — Phase 0A writes foundational content only. Each subsequent phase will extend it with phase-relevant details (CLI commands in Phase 4, memory model in Phase 5, etc.).

---

## Deliverables

| File                    | Location                      | Description                                            |
| ----------------------- | ----------------------------- | ------------------------------------------------------ |
| `SIGMA_CONSTITUTION.md` | `sigma-ecosystem/Sigma/` root | Constitution with Sigma preface (Sigma-adapted content)|
| `SIGMA_PROTOCOL.md`     | `sigma-ecosystem/Sigma/` root | Foundational doctrine — v0.1, to be extended per phase |

---

## Task 1 — SIGMA_CONSTITUTION.md

**Approach**: Copy DELTA_CONSTITUTION.md verbatim. Add a Sigma-specific preface at the top explaining the document's relationship to Delta.

**Preface must cover**:

- This document is the Sigma copy of the Delta Constitution
- The Delta Constitution governs the entire Delta Ecosystem, including Sigma
- Sigma does not have a separate constitution; Delta Constitution is the constitutional layer for both
- If Delta Constitution is amended, Sigma MUST follow (copy must be updated)
- Source: `DELTA_CONSTITUTION.md` in the Delta Ecosystem package

**Source file**: `I:\Works\Project\delta-ecosystem\DELTA_CONSTITUTION.md`

**Acceptance**: Preface present, 10 Articles intact, no content modification.

---

## Task 2 — SIGMA_PROTOCOL.md (Phase 0A content)

Write foundational sections. Sections marked `[PHASE X]` are placeholders — section headers only with a note that content will be added in that phase.

### Sections in scope for Phase 0A

Coverage legend:
- **FULL** — written completely in Phase 0A; stable, no significant additions expected
- **FOUNDATIONAL** — written in Phase 0A; section header + core content present, but a later phase adds references or detail
- **HIGH-LEVEL** — written at summary/pattern level only in Phase 0A; full spec added in a later phase

| #   | Section                 | Coverage        | Extended in | Notes                                                                             |
| --- | ----------------------- | --------------- | ----------- | --------------------------------------------------------------------------------- |
| 1   | Overview & Identity     | **FULL**        | —           | What Sigma is, target use case, relationship to Delta                             |
| 2   | Constitutional Basis    | **FULL**        | —           | Reference to SIGMA_CONSTITUTION.md, inherited principles                          |
| 3   | Lifecycle Definition    | **FULL**        | —           | START → DESIGN → BUILD → CLOSE, what happens in each phase                        |
| 4   | Role Definitions        | **FOUNDATIONAL**| Phase 2     | ARC, AUD, FMN, DEV — responsibilities, phase assignment, activation rules. Phase 2 adds rule file references. |
| 5   | Artifact Definitions    | **FOUNDATIONAL**| Phase 1     | DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE, CSO — what each is, who authors it. Phase 1 adds template references. |
| 6   | State Machine           | **FULL**        | —           | Per-artifact states and valid transitions                                         |
| 7   | Gate Rules              | **FULL**        | —           | 3 gates with pre-conditions spelled out                                           |
| 8   | Auto-Supersede Policy   | **FULL**        | —           | DIR-INTENT and DIR-CLOSE: single-active. FMN-PLAN and DEV-EXEC: manual only       |
| 9   | STALE_INTENT Warning    | **FULL**        | —           | Definition, trigger condition, effect on CLOSE gate                               |
| 10  | Naming Convention       | **FULL**        | —           | `{ROLE}-{DOC}-{PROJECT_ID}-v{VER}.md` with examples                               |
| 11  | Versioning Tiers        | **FULL**        | —           | Tier 1 (DIR-INTENT, DIR-CLOSE), Tier 2 (FMN-PLAN, DEV-EXEC), Tier L (CSO)         |
| 12  | Folder Structure        | **FULL**        | —           | `Sigma/` with `rules/`, `strategy/`, `execution/`, `closure/`, `logs/`, `memory/` |
| 13  | Folder-to-Phase Mapping | **FULL**        | —           | strategy/ = DESIGN; execution/ = BUILD; closure/ = CLOSE                          |
| 14  | Audit Doctrine          | **FULL**        | —           | AUD advisory-only, Director sole approval gate, Intent Core sovereign             |
| 15  | AUD Activation Policy   | **FULL**        | —           | Optional by default; recommended scenarios; mandatory trigger                     |
| 16  | CLI Command Surface     | **HIGH-LEVEL**  | Phase 4     | Domain list + review/audit pattern in Phase 0A. Full command-by-command spec added in Phase 4. |
| 17  | Git Evidence            | **FULL**        | —           | Minimal/read-only is the full Sigma spec — no further expansion expected          |
| 18  | CSO Lifecycle           | **FULL**        | —           | Optional artifact, timestamp naming, stored in `Sigma/logs/`                      |
| 19  | Promotion Boundary      | **FULL**        | —           | When Sigma is insufficient → Director closes Sigma, opens Delta Full              |

### Sections deferred (placeholder headers only)

| Section                      | Added in Phase |
| ---------------------------- | -------------- |
| Document Templates           | Phase 1        |
| Role Rule Files              | Phase 2        |
| CLI Setup & Installation     | Phase 3        |
| CLI Command Reference (full) | Phase 4        |
| Memory & MCP Configuration   | Phase 5        |
| Distribution & Bridge Files  | Phase 6        |

### AUD Activation Policy (confirmed — Open Item #1 resolved)

> AUD is **optional by default**. Mandatory AUD is not the default — it would undermine Sigma's lightweight advantage.
> 
> **Recommended** (not required):
> 
> - Before DIR-INTENT is locked for the first time
> - Before build begins if scope/tech risk is non-trivial
> - Before DIR-CLOSE is locked for public release
> 
> **Mandatory** only when Director explicitly marks the project as risk-sensitive.

---

## Execution Order

1. Read `DELTA_CONSTITUTION.md` from delta-ecosystem
2. Write `SIGMA_CONSTITUTION.md` (preface + verbatim copy)
3. Write `SIGMA_PROTOCOL.md` (all Phase 0A sections)
4. Director review pass
5. Patch any issues → Phase 0B begins

---

## Acceptance Criteria (Director Gate)

Before Phase 0B can start, Director must confirm:

- [x] SIGMA_CONSTITUTION.md: preface accurate, 10 Articles intact
- [x] SIGMA_PROTOCOL.md covers all 19 in-scope sections
- [x] Lifecycle definition is unambiguous (DESIGN vs BUILD phase separation is clear)
- [x] 3 gate rules are explicit and machine-interpretable
- [x] State machines per artifact are complete
- [x] AUD activation policy is stated correctly
- [x] No section conflicts with decisions in `Discussion/discussion.md`
- [x] Deferred sections have placeholder headers (not missing entirely)



---

## Open Items Resolved in This Phase

| Item                                         | Resolution                       |
| -------------------------------------------- | -------------------------------- |
| AUD activation policy wording (Open Item #1) | Confirmed — see Section 15 above |

---

*Created: 2026-05-16 — Phase 0A planning*
