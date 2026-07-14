# Sigma Protocol

**Document**: SIGMA_PROTOCOL.md
**Version**: v0.3 (Phase 2 — Governance Doctrine)
**Authority Tier**: Operational
**Owner**: Director
**Status**: Active

> Operational governance protocol for Sigma. Subordinate to SIGMA_CONSTITUTION.md and superior to all role rules, artifact templates, and CLI registries. All Sigma roles, artifacts, and CLI operations derive their behavioral constraints from this document.
>
> Sections marked **[PHASE N]** are placeholders — headers maintained for structural completeness, content added in the indicated phase.

---

## 1. Overview & Identity

Sigma is a **lightweight execution protocol** in the Delta Ecosystem, designed for small-to-medium projects, prototypes, fast execution cycles, and solo-builder workflows.

Sigma inherits Delta's core principles — intent clarity, traceability, evidence-based closure, Director authority — while compressing the artifact count, role handoffs, and command complexity to fit projects where Delta Full's governance overhead is disproportionate to the work being done.

**Sigma is not a modification of Delta Full.** It is an architecturally separate sibling protocol with its own CLI, artifact structures, folder layout, and runtime model.

**Target use cases:**

- Small to medium projects that do not warrant Delta Full's full governance chain
- Prototypes and fast iteration cycles
- Solo-builder workflows where compressing multiple roles into fewer agents is appropriate

**When Sigma is not appropriate** (see Section 19 for promotion):

- High-risk, regulated, or enterprise projects requiring formal multi-role governance
- Projects where compliance requires Delta Full's complete audit trail

---

## 2. Constitutional Basis

Sigma is governed by **SIGMA_CONSTITUTION.md**. All constitutional principles are fully binding.

**Invariants inherited (non-negotiable):**

- Director authority as the sole approval gate for all artifacts
- Evidence-based closure — completion requires documented proof of work
- Traceability — decisions must be traceable to their authorizing artifact
- Single source of truth per concern
- Lifecycle governance — all artifacts carry explicit lifecycle state
- Runtime state authority — `progress.json` is the operational truth for what is permitted

**What Sigma makes flexible** (within constitutional bounds): artifact count, role count, gate count, memory architecture, skill routing.

---

## 3. Lifecycle Definition

```
START → DESIGN → BUILD → CLOSE
```

**START**: Project initialized via `sigma project start`. No artifacts exist yet.

**DESIGN**: Director, assisted by ARC, produces DIR-INTENT. DESIGN is complete when DIR-INTENT is LOCKED. FMN and DEV do not operate during DESIGN.

**BUILD**: Three sequential sub-components:
1. ROADMAP — Foreman creates and activates a ROADMAP staging plan. Required before any FMN-PLAN can be created (Gate 1.5).
2. FMN-PLAN — Foreman produces the work plan and pre-build test contract. Must be LOCKED before DEV-EXEC can begin (Gate 2).
3. DEV-EXEC — Developer produces the implementation plan, executes the build, writes the implementation report.

BUILD is iterative — multiple FMN-PLAN and DEV-EXEC versions are permitted under the same ROADMAP. Parallel execution is not permitted — EXEC must not begin before PLAN is locked.

**CLOSE**: Director authors DIR-CLOSE, explicitly referencing FMN-PLAN and DEV-EXEC versions that support the closure claim. Requires minimum evidence from BUILD (Gate 3). Project is complete when DIR-CLOSE is LOCKED.

---

## 4. Role Definitions

Sigma has four roles. Each role is phase-specific except AUD, which is advisory across all phases. Roles are activated explicitly. Switching roles mid-session is prohibited — a new session is required.

### 4.0 Common Role Doctrine

All Sigma AI roles share these behavioral principles. This is the canonical source; role rule files reference this section.

1. **Independent judgment** — Each role maintains its own professional judgment within its boundary. Do not automatically agree with Director, AUD, or prior output.

2. **Agreement, doubt, disagreement** — Each role may express agreement, doubt, or disagreement. Disagreement is advisory unless Director accepts it. Distinguish between role judgment, runtime authority, and document state.

3. **No wild interpretation** — Do not invent missing intent, scope, or approval. If ambiguous: ask or present bounded options. Mark assumptions as tentative; never use them as locked decisions.

4. **Clarify before expanding scope** — If potential scope expansion is detected, stop and ask before treating it as accepted.

5. **Critique must be grounded** — When disagreeing, explain the basis: conflict with DIR-INTENT, failed evidence, technical infeasibility, scope creep, protocol conflict.

6. **Advisory verdicts are not authority** — Role verdicts (PASS, READY_FOR_BUILD, etc.) do not change runtime state. Only Director-approved CLI actions change state.

7. **Director/AUD conflict** — Restate the disagreement, identify evidence for each side, state role-based judgment, recommend safest next decision. Do not blindly side with either.

8. **Uncertainty** — State uncertainty explicitly when conclusion depends on incomplete context. Do not present inference as fact.

9. **Escalation trigger** — Ask for clarification when: source documents conflict, runtime state and document content conflict, intent is unclear, evidence is missing, or Director request conflicts with locked artifact.

10. **Director finality** — After presenting judgment, accept the Director's final decision as runtime authority unless it violates constitutional or safety constraints.

### 4.0b Common AI Role Discipline

AI roles follow position response limits, revision limits, and decision cycle rules defined in role rule files (Section 21). A position response limit applies per decision cycle; a revision limit applies per artifact section. Counters reset when Director opens a new decision cycle (new artifact version, new Director instruction changing scope or decision target). Roles must not enter infinite debate loops — escalate to Director when limits are reached. New material evidence may reopen a settled discussion.

---

### 4.1 ARC — Architect

| Property | Value |
| :--- | :--- |
| Phase | DESIGN |
| Authors | DIR-INTENT (draft) |
| Lock authority | None — Director only |

Interviews the Director to surface and structure intent. Drafts DIR-INTENT including intent core, constraints, technical direction, assumptions, risk, scope boundary, and evidence requirements. ARC's work ends when DIR-INTENT is LOCKED.

When DIR-INTENT's Comprehensive Research status is NEEDED, ARC investigates using a bounded Research Mode and records sources in `Sigma/reference/reference-list.md` (see Section 5.7). Research must be reviewed by AUD and completed before `sigma intent lock`.

Cannot lock any artifact. Cannot author FMN-PLAN, DEV-EXEC, or DIR-CLOSE. Cannot operate in BUILD or CLOSE phase.

> Detailed role rules: `Sigma/rules/ARC-RULE.md`

---

### 4.2 AUD — Auditor

| Property | Value |
| :--- | :--- |
| Phase | DESIGN and BUILD (advisory, on-demand) |
| Authors | Audit findings sections within reviewed artifacts |
| Lock authority | None — Director only |

Critiques challengeable sublayers in DIR-INTENT, FMN-PLAN, DEV-EXEC, and DIR-CLOSE. Produces advisory findings only — AUD verdicts are evidence for Director judgment, never approval gates. Intent Core is sovereign and must not be challenged.

Cannot lock any artifact. Cannot challenge Intent Core. Cannot block artifact progression.

**Activation**: Explicit, on-demand. Optional by default. See Section 15.

> Detailed role rules: `Sigma/rules/AUD-RULE.md`

---

### 4.3 FMN — Foreman

| Property | Value |
| :--- | :--- |
| Phase | BUILD |
| Authors | FMN-PLAN (all 6 sections), FMN Review in DEV-EXEC Section 13 |
| Lock authority | None — Director only |

**Responsibilities:**

- Author all 6 sections of FMN-PLAN before build begins: source alignment, work order, acceptance criteria, implementation constraints, pre-build test contract, DEV handoff instructions. FMN-PLAN is immutable after lock — FMN never touches it again.
- After DEV completes DEV-EXEC, fill Section 13 (FMN Review) of the DEV-EXEC artifact — verify ACs against DEV's evidence and issue advisory verdict.
- Cannot begin until DIR-INTENT is LOCKED (Gate 1) and an ACTIVE ROADMAP exists (Gate 1.5).

Cannot lock any artifact. Cannot author DEV-EXEC or DIR-CLOSE.

> Detailed role rules: `Sigma/rules/FMN-RULE.md`

---

### 4.4 DEV — Developer

| Property | Value |
| :--- | :--- |
| Phase | BUILD |
| Authors | DEV-EXEC (Sections 1–12) |
| Lock authority | None — Director only |

**Responsibilities:**

- Fill DEV-EXEC pre-build sections (1–4) before implementation: source plan alignment, implementation approach, files to change, key technical decisions.
- Execute the build.
- Fill DEV-EXEC post-build sections (5–12): walkthrough, deviations, dependency changes, verification, git evidence, issues, technical debt, completion statement.
- Run build verification (compile, tests, smoke check) and surface results in DEV-EXEC Section 8 (Developer Verification).
- Cannot begin until FMN-PLAN is LOCKED (Gate 2). DEV-EXEC state machine: DRAFT → LOCKED.

FMN fills Section 13 (FMN Review) and AUD fills Section 14 (AUD Findings) after DEV completes. Director sections are 15–16.

Cannot lock any artifact. Cannot author FMN-PLAN or DIR-CLOSE.

> Detailed role rules: `Sigma/rules/DEV-RULE.md`

---

## 5. Artifact Definitions

Sigma uses seven artifact types: five governance artifacts (DIR-INTENT, ROADMAP, FMN-PLAN, DEV-EXEC, DIR-CLOSE), one optional handoff artifact (CSO), and one project-wide supporting index (Reference List).

### 5.1 DIR-INTENT — Director's Intent

| Property | Value |
| :--- | :--- |
| Owner | Director |
| Authored by | ARC (draft), Director (approval and lock verdict) |
| Phase | DESIGN |
| Storage | `Sigma/design/` |
| Versioning | Tier 1 |
| Auto-supersede | Yes (single-active) |

Foundational intent document capturing Director's vision, constraints, technical preferences, scope boundary, risk assessment, and evidence requirements. Includes an optional AUD findings section.

DIR-INTENT has two layers: **Intent Core** (sovereign — goals, vision, purpose; not AUD-challengeable) and **Challengeable sublayers** (route, assumptions, constraints, risk — all auditable).

DIR-INTENT includes an optional **Comprehensive Research** section, marked NEEDED when existing knowledge is insufficient to responsibly formulate intent. Sources are recorded in the project-wide Reference List, not inline (see Section 5.7).

---

### 5.2 FMN-PLAN — Foreman's Plan

| Property | Value |
| :--- | :--- |
| Owner | FMN |
| Authored by | FMN |
| Phase | BUILD |
| Storage | `Sigma/build/` |
| Versioning | Tier 2 |
| Auto-supersede | No (multi-active, manual supersede only) |

A pure work order contract — 6 sections, all written before lock, all immutable after lock. Contains source alignment, work order, acceptance criteria, implementation constraints, pre-build test contract, and DEV handoff instructions.

---

### 5.3 DEV-EXEC — Developer's Execution

| Property | Value |
| :--- | :--- |
| Owner | DEV |
| Authored by | DEV (Sections 1–12), FMN (Section 13), AUD (Section 14), Director (Sections 15–16) |
| Phase | BUILD |
| Storage | `Sigma/build/` |
| Versioning | Tier 2 |
| Auto-supersede | No (multi-active, manual supersede only) |

Single review document for the build cycle. DEV fills pre-build planning sections (1–4) and post-build evidence sections (5–12). FMN conducts review in Section 13 after DEV submits. AUD fills Section 14 if engaged. Director observations and decisions in Sections 15–16. Out-of-scope Director requests in Section 17.

State machine: DRAFT → LOCKED.

---

### 5.4 DIR-CLOSE — Director's Closure

| Property | Value |
| :--- | :--- |
| Owner | Director |
| Authored by | Director |
| Phase | CLOSE |
| Storage | `Sigma/close/` |
| Versioning | Tier 1 |
| Auto-supersede | Yes (single-active) |

Closure document authored by the Director. Must explicitly reference the FMN-PLAN and DEV-EXEC versions that support the closure claim. Revision = new version.

---

### 5.5 CSO — Cognitive State Object

| Property | Value |
| :--- | :--- |
| Owner | Any role |
| Authored by | Any role |
| Phase | Any |
| Storage | `Sigma/logs/` |
| Versioning | Timestamp (`CSO-{ROLE}-{YYYYMMDD}-{HHMM}.md`) |

Optional handoff artifact for preserving session context. `sigma cso new --role <role>` creates a file in `Sigma/logs/` — no `progress.json` tracking. CSO creation satisfies no gate requirement. Multiple CSOs may exist; they are plain markdown files, immutable once written. CSO content is carry-forward context only — locked artifacts and `progress.json` always win over CSO content.

---

### 5.6 ROADMAP — Implementation Staging Map

| Property | Value |
| :--- | :--- |
| Owner | FMN |
| Authored by | FMN |
| Phase | BUILD |
| Storage | `Sigma/build/` |
| Versioning | Tier 1 |

**Mandatory governance artifact.** ROADMAP is required before FMN-PLAN can be created — `plan new` is blocked unless an ACTIVE ROADMAP exists (Gate 1.5).

ROADMAP breaks a locked DIR-INTENT into large build stages. Each Stage Overview row maps to an FMN-PLAN version. ROADMAP is partially CLI-managed — stage title/focus/status are supplied via `--title`/`--focus` on `sigma plan new` and `sigma plan promote`, stored in `progress.json`, and rendered into the Stage Overview table by `sigma roadmap render`; the Core Process Flow section remains manual.

**State machine**: `DRAFT → ACTIVE → INACTIVE → LOCKED`

| State | Meaning |
| :--- | :--- |
| `DRAFT` | Created; not yet the execution backbone |
| `ACTIVE` | The only ROADMAP permitted to receive new official FMN-PLAN artifacts |
| `INACTIVE` | Displaced by a newer ACTIVE roadmap without formal closure; readable, not writable |
| `LOCKED` | Final state after `sigma close lock` auto-locks the ACTIVE ROADMAP |

**Core invariant**: Only one ROADMAP may be ACTIVE at a time. `sigma roadmap activate --v <ver>` atomically demotes the current ACTIVE to INACTIVE and promotes the target DRAFT to ACTIVE.

The Stage Overview table is generated directly from `progress.json` on every `sigma roadmap render` — there is no separate reconciliation step, since the table has no independent copy of stage data that could drift out of sync.

If ROADMAP conflicts with DIR-INTENT, DIR-INTENT wins.

> Template: `Sigma/templates/ROADMAP-TEMPLATE.md`

---

### 5.7 Reference List — Comprehensive Research Source Index

| Property | Value |
| :--- | :--- |
| Owner | Director |
| Authored by | ARC (Local Artifact rows via `sigma reference update`; Website Link and Online Source Data rows manually) |
| Phase | DESIGN (primary use); persists across all phases |
| Storage | `Sigma/reference/reference-list.md` |
| Versioning | None — project-wide, cumulative, not versioned per DIR-INTENT |

Project-wide source index supporting DIR-INTENT's Comprehensive Research section (see Section 5.1). Not a formal bibliography — a path/link and a short note per row, enough for any role to revisit the source later. Three tables: Local Artifact (synced from `Sigma/reference/data/`), Website Link, and Online Source Data. Every row carries an ID (`LA`/`WL`/`OS` + sequential number); DIR-INTENT cites findings by ID only (e.g. "(LA02)"), never by inline link.

**Scaffolding**: created once by `sigma project start`, not per DIR-INTENT version — a project only starts once, but intent gets drafted and revised repeatedly. `sigma reference update` self-heals a missing file on older projects.

**Not tracked in `progress.json`** — no lifecycle state, no lock, no gate. Existence is guaranteed by construction at `project start`, with a self-healing fallback in `sigma reference update`.

If Comprehensive Research status is NEEDED, AUD Verificator Mode must review source-tier compliance for cited IDs before `sigma intent lock` (see Section 14).

> Template: `Sigma/templates/REFERENCE-LIST-TEMPLATE.md`

---

### 5.8 Director-Facing Labels

| Human label | Artifact code | Purpose |
| :--- | :--- | :--- |
| Intent Doc | `DIR-INTENT` | Objective, scope, constraints, success definition |
| Plan Doc | `FMN-PLAN` | Build contract and test contract |
| Execution Evidence | `DEV-EXEC` | Implementation, verification, evidence |
| Closure Doc | `DIR-CLOSE` | Final cycle closure |
| Roadmap Doc | `ROADMAP` | Mandatory staging map |
| Context Handoff | `CSO` | Session continuity snapshot |
| Reference List | `reference-list.md` | Comprehensive Research source index |

**Presentation rule**: Show meaning first, artifact code second. Artifact codes remain the authority for filenames, `progress.json` field values, registry files, and CLI arguments.

---

## 7. Gate Rules

Sigma has gates. A gate blocks an operation until its pre-condition is satisfied. Gate enforcement is performed by the CLI at runtime against `progress.json`. No agent action may bypass a gate — only a Director can unlock a gate by satisfying its pre-condition.

### Gate 1 — DESIGN Complete

| Property | Value |
| :--- | :--- |
| Blocks | `sigma roadmap new` |
| Pre-condition | At least one `DIR-INTENT` with status `LOCKED` exists |
| CLI error | `Gate 1 blocked: DIR-INTENT must be LOCKED before ROADMAP can be created.` |

---

### Gate 1.5 — ROADMAP Active

| Property | Value |
| :--- | :--- |
| Blocks | `sigma plan new` |
| Pre-condition | At least one `ROADMAP` with status `ACTIVE` exists |
| CLI error | `Gate 1.5 blocked: An ACTIVE ROADMAP must exist before FMN-PLAN can be created. Run: sigma roadmap new. If another ROADMAP is already ACTIVE, create the new one as DRAFT then run sigma roadmap activate --v <ver>.` |

---

### Gate 2 — FMN-PLAN Locked

| Property | Value |
| :--- | :--- |
| Blocks | `sigma exec new` |
| Pre-condition | At least one `FMN-PLAN` with status `LOCKED` exists |
| CLI error | `Gate 2 blocked: FMN-PLAN must be LOCKED before DEV-EXEC can be created.` |

---

### Gate 3 — BUILD Evidence

| Property | Value |
| :--- | :--- |
| Blocks | `sigma close new` |
| Pre-condition | Full INTENT → PLAN → EXEC chain: active INTENT LOCKED; at least one DEV-EXEC LOCKED whose `plan_version_ref` points to a LOCKED FMN-PLAN whose `intent_version_ref` points to that INTENT |
| CLI error (no chain) | `Gate 3 blocked: Requires INTENT → PLAN → EXEC chain all LOCKED (same version chain).` |
| CLI error (stale) | `Gate 3 stale: Qualifying chain has stale_intent=true. Add --ack-stale-intent to acknowledge and proceed.` |

**STALE_INTENT**: A FMN-PLAN or DEV-EXEC produced against a DIR-INTENT version that has since been SUPERSEDED is flagged `stale_intent: true` in `progress.json`. The artifact remains LOCKED — STALE_INTENT does not revoke lock status. However, a stale chain cannot satisfy Gate 3 without Director acknowledgment:

- `sigma close new` blocks if the qualifying chain carries `stale_intent: true`
- Director must pass `--ack-stale-intent` to proceed; this is recorded in DIR-CLOSE metadata
- Director decides: is the stale evidence sufficient, or should fresh artifacts be produced against the new intent?

---

## 13. Folder-to-Phase Mapping

| Folder | Phase | Artifacts |
| :--- | :--- | :--- |
| `Sigma/design/` | DESIGN | `DIR-INTENT-v{VER}.md` |
| `Sigma/build/` | BUILD | `FMN-PLAN-v{VER}.md`, `DEV-EXEC-v{VER}.md`, `ROADMAP-v{VER}.md` |
| `Sigma/close/` | CLOSE | `DIR-CLOSE-v{VER}.md` |
| `Sigma/rules/` | All phases (reference) | `ARC-RULE.md`, `AUD-RULE.md`, `FMN-RULE.md`, `DEV-RULE.md` |
| `Sigma/logs/` | Any phase | CSO files, progress backups, migration logs |
| `Sigma/reference/` | Any phase (project-wide, cumulative) | `reference-list.md`, `data/` (local research artifacts) |

---

## 14. Audit Doctrine

**1. AUD is advisory-only.** AUD findings are evidence for Director judgment. They cannot block artifact progression. Director decides what to do with AUD findings.

**2. Director is the sole approval gate.** Only the Director can lock artifacts. No audit verdict constitutes approval.

**3. Intent Core is sovereign.** The Director owns the destination — the core intent, goals, and vision. AUD must not challenge Intent Core.

**4. Audit attacks the route, not the destination.** AUD may challenge any challengeable sublayer: technical approach, feasibility, scope choices, risk assessment, evidence requirements, plan adequacy, implementation quality, closure sufficiency.

**5. One audit output format.** AUD findings are written as a structured findings section *within* the artifact being audited.

### Key Auditable vs Sovereign Boundaries

| Sublayer | Status |
| :--- | :--- |
| Intent Core (goals, vision, purpose) | **Sovereign** — not auditable |
| Director Constraints, Tech Stack, Timeline, Assumptions, Scope, Risk, Evidence requirements | Auditable |
| DIR-INTENT — Comprehensive Research source-tier compliance (Reference List IDs) | Auditable |
| FMN-PLAN — task plan adequacy, test contract scope | Auditable |
| DEV-EXEC — implementation vs plan, deviations, known issues | Auditable |
| DIR-CLOSE — evidence reference sufficiency, accepted limitations | Auditable |

---

## 15. AUD Activation Policy

AUD is **optional by default.**

### Recommended (not required)

| Scenario | Reason |
| :--- | :--- |
| Before DIR-INTENT is locked for the first time | Faulty assumptions propagate into all of BUILD |
| Before DEV-EXEC build begins, if scope or tech risk is non-trivial | Plan inadequacies are cheaper to catch before implementation |
| Before DIR-CLOSE is locked for public release | Closure evidence gaps easier to address before publication |

### Mandatory

AUD becomes mandatory only when the Director explicitly marks the project as **risk-sensitive** in `progress.json`. The CLI does not auto-assign risk sensitivity.

### Recording AUD Findings

There is no CLI command that invokes AUD or appends its findings. AUD Findings
are written manually into the artifact's AUD Findings section (`DIR-INTENT`
Section 12, `FMN-PLAN` Section 7) by ARC or FMN, sourced from either an AUD
message received via `sigma send`/`sigma inbox` mailbox, or the Director relaying audit
results directly in a chat session. See `ARC-RULE.md` / `FMN-RULE.md` — AUD
Findings Section Authorization.

---

## 16. CLI Command Surface

**Binary**: `sigma`
**Pattern**: `sigma {domain} {action} [options]`

| Domain | Responsibility |
| :--- | :--- |
| `project` | Project initialization, status, lifecycle management |
| `session` | Session orientation — read-only runtime context for agents when role flow or Director request requires it |
| `intent` | DIR-INTENT lifecycle (new, lock, status, list) |
| `plan` | FMN-PLAN lifecycle (new, lock, supersede, queue, status, list) |
| `exec` | DEV-EXEC lifecycle (new, lock, supersede, status, list) |
| `close` | DIR-CLOSE lifecycle (new, lock, status) |
| `roadmap` | ROADMAP lifecycle (new, check, activate, render, list) |
| `reference` | Sync and manage the project-wide Reference List (`update`) — Comprehensive Research source index |
| `send` | Send messages between AI roles |
| `inbox` | Read, manage, and check role inboxes |
| `git` | Git evidence output (read-only) |
| `cso` | CSO artifact creation |
| `config` | Project configuration (language preference, etc.) |
| `setup` | Installation, configuration, MCP memory setup |
| `memory` | Show Sigma role memory reminders (read-only) |
| `doctor` | Diagnose and reconcile Sigma runtime state |
| `override` | Bypass the current lifecycle gate under Director authority (recorded in `Sigma/memory/overrides.jsonl`) |

Run `sigma --help` or `sigma {domain} --help` for current command syntax. The CLI is authoritative — do not rely on this section for exact flag names.

---

## 16A. CLI Operator Model

Sigma CLI is designed to be operated primarily by AI roles under Director authority.

**Sigma is an AI-operated governance runtime under Director authority.** The Director is not expected to manually execute every lifecycle command. However, **AI roles must not infer Director approval.** Any command representing approval, closure, accepted risk, stale-intent acknowledgment, supersession, or artifact lock requires explicit Director authorization.

### Authority Architecture

| Layer | Identity | Role |
| :--- | :--- | :--- |
| Director | Human | Sole approval authority |
| AI Roles | DEV, FMN, AUD, ARC | Command operators within role boundary |
| CLI | `sigma` binary | Gate enforcer — validates prerequisites before permitting commands |
| `progress.json` | Runtime file | Single source of truth for what is currently permitted |
| Artifacts | Markdown files | Permanent record of decisions and approvals |

### Command Authority Classes

| Class | Commands | AI May Execute? | Requires Director Instruction? |
| :--- | :--- | :---: | :---: |
| Read-only | `status`, `list`, `session bootstrap`, `git evidence`, `plan queue`, `roadmap list`, `inbox`, `intent check`, `plan check`, `exec check`, `close check`, `roadmap check` | Yes | No |
| Draft / Operational | `intent new`, `roadmap new`, `plan new`, `exec new`, `close new`, `cso new`, `reference update`, `send` | Yes, within role boundary | Usually no |
| Approval | `intent lock`, `roadmap activate`, `plan lock`, `exec lock`, `close lock` | Only after Director approval | Yes |
| Risk / Supersession | `close new --ack-stale-intent`, `plan supersede`, `exec supersede`, destructive/reset | Only after Director approval | Yes |

### Explicit Approval Rule

Clear authorization: `approved`, `lock this`, `lanjut lock`, `accept risk`, `ack stale intent`, `supersede this version`, or equivalent unambiguous instruction.

Ambiguous — not sufficient: `looks good`, `menarik`, `sepertinya oke`, `lanjut bahas`, `apa pendapatmu?`, `okay`, `noted`, `interesting`.

If authorization is unclear, ask before executing.

### Pre-Lock Verification Rule

Before recommending or executing any Approval-class lock command (`intent lock`, `plan lock`, `exec lock`, `close lock`), the AI role MUST first run the matching `{domain} check` command and confirm it reports `Lock readiness: Eligible` (or `Eligible with warnings`). `check` never mutates state and never requires Director authorization — it is a Lock Readiness dashboard: it shows exactly which Lock Requirements `lock` will enforce, without changing anything.

If `check` reports `Not eligible`, the AI role must resolve the unsatisfied Lock Requirements shown in its output before recommending or executing lock — do not recommend lock from memory or a manual read of the document alone. By design, a document `check` reports fully satisfied cannot then fail `lock` for the same requirement (see PLAN-EVAL-11, "Lock Validation Equivalence") — if that ever happens, treat it as a CLI defect, not a normal outcome.

### Director Convenience Rule

AI roles should not ask the Director to manually run routine Sigma CLI commands when the AI role has tool access and the command is within its role boundary.

For approval-class or risk-class commands: ask for explicit authorization before execution.
For operational commands within the role's authority class: execute and report.

### Director Authority Preservation

A valid command is not automatically an authorized command. A command is authorized only when it is:
1. Permitted by Sigma state gates,
2. Within the executing role's authority class, and
3. When required by its authority class — explicitly authorized by Director.

---

## 16B. Human-Readable vs AI-Operational Artifacts

Sigma artifacts are not equally human-facing. Most governance artifacts are AI-operational — optimized for role execution, traceability, and cross-session continuity.

### Human-Facing Artifacts

- **DIR-INTENT** — must be written clearly enough for Director review and approval
- **DIR-CLOSE** — must be written clearly enough for Director final review

These documents MUST be written for Director comprehension.

### AI-Operational Artifacts

ROADMAP, FMN-PLAN, DEV-EXEC, AUD findings, CSO, `progress.json`, role rule files, protocol and registry files. Dense formatting and technical fields are acceptable.

### Director Interaction Model

In normal Sigma operation, the Director interacts primarily through: reviewing or refining DIR-INTENT, approving or rejecting lock decisions, reviewing DIR-CLOSE, and authorizing risk acknowledgment or supersession.

AI roles are responsible for reading operational artifacts, maintaining role boundaries, surfacing only decision-relevant issues to the Director, and translating Director decisions into valid Sigma CLI operations.

---

## 16C. Director Authorization Language Policy

Director authorization may be given in natural language.

AI roles must interpret clear Director authorization as permission to execute the relevant Sigma CLI command when: the target artifact is unambiguous, the command is valid under Sigma gates, the command is within the role's boundary, and the authorization is explicit enough for the command class.

### Clear Approval Signals

`approved`, `I approve this`, `lock it`, `go ahead and lock`, `run it`, `yes run it`, `accept risk`, `ack stale intent`, `supersede this version`, Indonesian equivalents: `dikunci`, `ya approved`, `oke dikunci`, `iya approved`, `lanjut lock`.

### Rejection Signals

`I don't like this`, `do not lock`, `revise first`, `needs more work`, `nanti dulu`, `jangan dulu`.

### Ambiguous Signals

`okay`, `noted`, `interesting`, `makes sense`, `looks good`, `seems fine`, `menarik`, `silakan` (without explicit command context), `lanjutkan` (in discussion context).

These are not sufficient for approval-class commands. Ask for confirmation before executing.

### Conditional Approval

If the Director gives conditional approval (`approve, but fix section 3 first`), the AI role must:
1. Satisfy the stated condition.
2. Report that it has been addressed.
3. Wait for Director confirmation before executing.

The AI role must not self-certify that a condition is satisfied and proceed unilaterally.

---

## 16D. Language Preference

Projects may configure a Director communication language via `sigma config set language <value>` (stored in `Sigma/sigma.config.json`). Supported values: `"en"` (default), `"id"` (Indonesian), or any IETF language tag.

During role activation or session orientation, AI roles check `Sigma/sigma.config.json` when available and conduct all Director-facing communication in the configured language.

**Artifact content is always written in English regardless of language setting.** FMN-PLAN, DEV-EXEC, ROADMAP, rule files, and all governance artifacts remain in English. The language setting controls AI ↔ Director interaction only — not artifact prose.

---

## 16E. Role-to-Role Messaging Doctrine

Formal role-to-role governance messages must be sent through Sigma CLI (`sigma send`). Valid messaging roles are AI governance roles only — DIRECTOR communicates directly and does not use the CLI inbox.

A message may carry a handoff request, review request, clarification, revision signal, or advisory response. A role-to-role message never constitutes Director approval — authority still requires explicit Director instruction under Section 16C.

An AI role may not send a new message while it has unread incoming messages. The sender-side unread gate enforces this. Read pending inbox messages (`sigma inbox read <id>`) before sending.

---

## 17. Git Evidence

Sigma provides minimal, read-only git evidence via `sigma git evidence`.

**Output**: current branch name, latest commit hash and message, changed files, diff summary.

Git evidence in Sigma is informational — it is not a governance gate and does not satisfy any closure evidence requirement by itself. Sigma does not enforce commit structure, branch naming, or publish policy.

---

## 19. Promotion Boundary

When a project outgrows Sigma's governance capacity, the Director may decide to promote to a heavier process.

**Signals that Sigma may be insufficient**: project scope beyond what a single FMN + DEV cycle can manage; compliance or enterprise governance requirements; multiple contributors requiring formal role separation; risk profile warranting Delta Full's full audit trail.

**Promotion process**: Director closes the Sigma project with a DIR-CLOSE documenting the reason; Director opens a new Delta Full project via `delta project start`. No automatic migration — Sigma artifacts do not convert to Delta Full artifacts.

**There is no `sigma promote` command.** Promotion is a Director decision and a manual process.

---

---

## 20. Document Templates

Template content, section-by-section structure, sublayer authority labels, and Director lock verdict format for each artifact type are authoritative in `Sigma/templates/`. This protocol defines artifact authority, ownership, and lifecycle semantics only.

---

## 21. Role Rule Files and Role Memory

Detailed behavioral rules for ARC, AUD, FMN, and DEV — including activation procedures, prohibited actions, position response limits, revision limits, scope boundaries, and expected outputs — are authoritative in `Sigma/rules/{ROLE}-RULE.md`. This protocol defines common doctrine and authority boundaries only.

Role memory, when present, is a short operating cue for the first moments of role activation. It is reminder-only and must not override role rules, this protocol, CLI output, runtime state, locked artifacts, or Director instructions.

Not every governance role has the same activation bootstrap. ARC starts as stop-first intent intake. AUD starts as a passive evidence-boundary review. FMN and DEV use runtime orientation only within their direct planning or execution evidence chain.

---

*SIGMA_PROTOCOL.md v0.2 — Phase 2 slim-down (2026-05-30). Governance doctrine only; operational detail moved to `sigma --help`, role-aware session orientation, and role rule files.*

*v0.3 (2026-07-04): Added Reference List artifact (Section 5.7) and Comprehensive Research pointers (Sections 4.1, 5.1, 14); reconciled Folder-to-Phase Mapping (Section 13) and CLI Command Surface (Section 16) with the actual CLI, which had drifted (`gitignore`, `override`, `sync`, `memory`, `doctor` were missing before this pass, independent of the reference addition).*

*v0.4 (2026-07-14): Removed `gitignore` and `sync` domains from CLI Command Surface (Section 16) — `gitignore generate`, `sync progress`, and `sync roadmap` were removed as trivial/redundant (PLAN-EVAL-02). No functional doctrine change; no automatic legacy schema/ROADMAP migration path remains for pre-current-schema projects.*

*v0.5 (2026-07-14): ROADMAP restructured from 6 sections to 3 (Overview, Core Process Flow, Stage Overview) and the `roadmap` command family consolidated from 7 to 5 subcommands — `reconcile` and `migrate-core-flow` removed as redundant once the Stage Overview table reads directly from `progress.json` (PLAN-EVAL-03). Stage title/focus/status no longer live in per-stage document sections; they are supplied via `--title`/`--focus` on `plan new`/`plan promote` and stored in `progress.json` only.*
