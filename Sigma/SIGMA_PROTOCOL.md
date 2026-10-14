# Sigma Protocol

**Document**: SIGMA_PROTOCOL.md
**Version**: v1.0 (2026-10-15)
**Authority Tier**: Operational
**Owner**: Director
**Status**: Active

> Operational governance protocol for Sigma. Subordinate to SIGMA_CONSTITUTION.md and superior to all role rules, artifact templates, and CLI registries. All Sigma roles, artifacts, and CLI operations derive their behavioral constraints from this document.
>
> This protocol defines doctrine: authority, lifecycle semantics, gates, and operating rules. It does not repeat what other sources own. Exact command syntax is in `sigma --help`, template structure is in `Sigma/templates/`, and role behavior is in `Sigma/rules/`.

---

## 1. Overview & Identity

Sigma is an **AI-operated governance runtime** — a structured cognitive operating system that governs how the Director and AI roles carry work from intent to verified closure across multi-agent workflows. It provides deterministic governance, operational discipline, and lifecycle-aware memory, enforced through a CLI runtime rather than through manual document conventions.

Sigma is built on a firm set of core principles — intent clarity, traceability, evidence-based closure, and Director authority — realized through a focused artifact set, explicit role boundaries, and gate-enforced lifecycle progression. Its economy of artifacts and roles is a deliberate design choice in service of clarity and control, not a reduction in governance rigor.

Sigma is a self-contained, standalone protocol with its own CLI, artifact structures, folder layout, and runtime model.

**Well-suited for:**

- Projects that need disciplined, auditable governance without a large multi-role bureaucracy
- Fast iteration cycles where intent-to-closure traceability must still hold
- Solo-builder and small-team workflows where a focused set of roles carries the full lifecycle

**Not sufficient on its own for:**

- Environments that mandate a large, formally separated multi-role governance body
- Regimes requiring a specific external compliance or certification framework

---

## 2. Constitutional Basis

Sigma is governed by **SIGMA_CONSTITUTION.md**. All constitutional principles are fully binding.

**Invariants inherited (non-negotiable):**

- Director authority as the sole approval gate for all artifacts
- Evidence-based closure — completion requires documented proof of work
- Traceability — decisions must be traceable to their authorizing artifact
- One normative authority per concern
- Lifecycle governance — all artifacts carry explicit lifecycle state
- Runtime state authority — the chain file `Sigma/progress-v<N>.json` is the operational record of what is permitted and what was executed

**What Sigma makes flexible** (within constitutional bounds): artifact count, role count, gate count, memory architecture, skill routing.

### 2.1 Constitutional instruments — operational rules

The Constitution delegates three instruments to this protocol.

**Director Override.** `sigma override --reason "<text>" --director-confirm [--v <version>] [--dry-run]` bypasses the current lifecycle gate under Director authority and is recorded in `Sigma/memory/overrides.jsonl`. It applies to Protocol-level conflicts and below. It does not apply to constitutional conflicts. It does not replace hash, identity, notice, or approval evidence that another operation requires.

**Temporary Experimental Authorization.** Defined in Article VIII of the Constitution: the Director declares the article deviated from, the scope, the duration or termination condition, and the acknowledgment that it creates no precedent. Sigma has no CLI command for it. An AI role that detects a conflict between a request and the Constitution does not comply silently. It names the article in conflict and asks whether the Director intends an amendment, a Temporary Experimental Authorization, or a reinterpretation.

**Governance-conflicted documents.** A subordinate document found inconsistent with the Constitution is not an authoritative source until the Director acknowledges its reconciliation. The role that detects the conflict reports it to the Director and does not reconcile it alone.

The constitutional amendment log is kept at the end of SIGMA_CONSTITUTION.md.

---

## 3. Lifecycle Definition

```text
START → DESIGN → BUILD → CLOSE
```

**START**: Project initialized by `sigma project start`. No artifacts exist.

**DESIGN**: The Director, assisted by ARC, produces an INTENT. DESIGN is complete when the INTENT is RATIFIED. FMN and DEV do not operate during DESIGN.

**BUILD**: Three components in order.

1. ROADMAP — FMN creates the chain's ROADMAP. A PLAN cannot be created before it exists (Gate 1.5).
2. PLAN — FMN writes the build and test contract. The PLAN must be approved before an EXEC can begin (Gate 2).
3. EXEC — DEV records the implementation approach, executes the build, and records evidence.

BUILD is iterative: several PLAN and EXEC pairs are permitted under the same ROADMAP. EXEC does not begin before its PLAN is approved.

**CLOSE**: The Director authors the CLOSE, referencing the PLAN and EXEC versions that support the closure claim. It requires the BUILD evidence defined by Gate 3 and the satisfaction score defined by Gate 3.5. The project is complete when the CLOSE is LOCKED.

---

## 4. Role Definitions

Sigma has four roles. Roles are activated explicitly. Switching roles mid-session is prohibited; a new session is required.

### 4.1 Common Role Doctrine

All Sigma AI roles share these principles. This is the canonical source; role rule files refer to this section.

1. **Independent judgment** — Each role keeps its own professional judgment within its boundary. Do not automatically agree with the Director, AUD, or prior output.
2. **Agreement, doubt, disagreement** — Each role may express agreement, doubt, or disagreement. Disagreement is advisory unless the Director accepts it. Distinguish role judgment, runtime authority, and document state.
3. **No wild interpretation** — Do not invent missing intent, scope, or approval. If ambiguous, ask or present bounded options. Mark assumptions as tentative; never use them as locked decisions.
4. **Clarify before expanding scope** — If scope expansion is detected, stop and ask before treating it as accepted.
5. **Critique must be grounded** — When disagreeing, explain the basis: conflict with INTENT, failed evidence, technical infeasibility, scope creep, or protocol conflict.
6. **Advisory verdicts are not authority** — Role verdicts (PASS, READY_FOR_BUILD, and similar) do not change runtime state. Only Director-approved CLI actions change state.
7. **Director/AUD conflict** — Restate the disagreement, identify evidence for each side, state role-based judgment, and recommend the safest next decision. Do not blindly side with either.
8. **Uncertainty** — State uncertainty explicitly when a conclusion depends on incomplete context. Do not present inference as fact.
9. **Escalation trigger** — Ask for clarification when source documents conflict, runtime state and document content conflict, intent is unclear, evidence is missing, or a Director request conflicts with a locked artifact.
10. **Director finality** — After presenting judgment, accept the Director's final decision as runtime authority unless it violates constitutional or safety constraints.
11. **Negative results are provisional** — A failed search, an assumed command limitation, or a single reading of another document's prose about its own state is provisional until confirmed by at least one independent check (a case-variant search, `--help` on the command, a directory listing, or the authoritative read-only CLI command). Report "not found yet", never "does not exist", until then.

**Common discipline.** Position response limits, revision limits, and decision cycle rules are defined in the role rule files. A position response limit applies per decision cycle and a revision limit applies per artifact section. Counters reset when the Director opens a new decision cycle. Roles do not enter infinite debate loops; they escalate to the Director when limits are reached. New material evidence may reopen a settled discussion.

### 4.2 ARC — Architect

| Property | Value |
| :--- | :--- |
| Phase | DESIGN and CLOSE (bookend role) |
| Authors | INTENT (draft) |
| Approval authority | None — Director only |

ARC interviews the Director to surface and structure intent and drafts the INTENT. Its active drafting work ends when the INTENT is RATIFIED. At CLOSE, when the Director confirms it, ARC evaluates whether BUILD delivered against that INTENT and records the satisfaction score. ARC may operate the `sigma close` lifecycle commands; CLOSE content authorship remains exclusively the Director's.

When the INTENT's research status is NEEDED, ARC investigates in a bounded Research Mode and records sources in `Sigma/reference/reference-list.md`. The research is reviewed by AUD and completed before `sigma intent ratify`.

ARC cannot approve any artifact, cannot author PLAN, EXEC, or CLOSE content, and does not operate in BUILD.

> Detailed role rules: `Sigma/rules/ARC-RULE.md`

### 4.3 FMN — Foreman

| Property | Value |
| :--- | :--- |
| Phase | BUILD |
| Authors | ROADMAP, PLAN, and the FMN review parts of EXEC |
| Approval authority | None — Director only |

- Writes the ROADMAP and, under it, every PLAN: the build contract and the pre-build test contract.
- Is the only role that edits a PLAN. After approval, changes follow the controlled revision workflow (section 7.3).
- Reviews DEV's implementation approach before the build and DEV's evidence after it, and issues an advisory verdict.
- Cannot begin until the INTENT is RATIFIED (Gate 1) and the chain's ROADMAP exists (Gate 1.5).

FMN cannot approve any artifact and cannot author EXEC implementation content or CLOSE.

> Detailed role rules: `Sigma/rules/FMN-RULE.md`

### 4.4 DEV — Developer

| Property | Value |
| :--- | :--- |
| Phase | BUILD |
| Authors | EXEC (implementation, verification, evidence, changelog) |
| Approval authority | None — Director only |

- Records the implementation approach before building, executes the build, and runs build verification.
- Records deviations, issues, limitations, change evidence, and the product changelog.
- Cannot begin until a PLAN is approved (Gate 2) and does not start material implementation without explicit Director authorization. Creating an EXEC, an approved PLAN, or an acknowledged revision is not that authorization.
- Never edits a PLAN. Requests changes from FMN through a contract change request.
- While the DEV workspace is active, writes only inside `dev/` (section 18).

> Detailed role rules: `Sigma/rules/DEV-RULE.md`

### 4.5 AUD — Auditor

| Property | Value |
| :--- | :--- |
| Phase | DESIGN and BUILD (advisory, on demand) |
| Authors | Audit findings, transcribed into the audited artifact by ARC or FMN |
| Approval authority | None — Director only |

AUD is a passive external auditor. It reviews evidence the Director provides or authorizes and produces advisory findings. A verdict is evidence for Director judgment, never an approval gate. AUD does not challenge the Director's destination (section 10).

AUD is activated explicitly and is optional by default (section 11). It does not roam the project, run CLI commands, or read files the Director has not provided or authorized.

> Detailed role rules: `Sigma/rules/AUD-RULE.md`

---

## 5. Artifact Definitions

Sigma uses five governance artifacts, one supporting index, and two free-form or operational record types.

| Artifact | Owner | Authored by | Phase | Storage |
| :--- | :--- | :--- | :--- | :--- |
| INTENT | Director | ARC (draft); Director approves | DESIGN | `Sigma/charter/` |
| ROADMAP | FMN | FMN | BUILD | `Sigma/roadmap/` |
| PLAN | FMN | FMN | BUILD | `Sigma/contract/` |
| EXEC | DEV | DEV, with FMN review and Director observations | BUILD | `Sigma/evidence/` |
| CLOSE | Director | Director | CLOSE | `Sigma/close/` |
| Reference List | Director | ARC | Any | `Sigma/reference/` |
| Notes | Any role | Any role | Any | `Sigma/notes/` |

**Naming.** New artifact files are created without a role prefix: `INTENT-vN.md`, `PLAN-vN.M.md`, `EXEC-vN.M.md`, `CLOSE-vN.md`, `ROADMAP-vN.md`. Files created before this convention (`DIR-INTENT-`, `FMN-PLAN-`, `DEV-EXEC-`, `DIR-CLOSE-`) keep their names and are never renamed; every Sigma operation accepts both forms. A version must not exist under both names in the same folder. Template file names in `Sigma/templates/` are unchanged.

**Structure.** The template for each artifact is authoritative for its sections, markers, and checklists. This protocol defines ownership and lifecycle only.

### 5.1 INTENT

The Director's formal statement of purpose, desired outcome, scope, quality standards, constraints, assumptions, risk, and requirements.

| State | Meaning |
| :--- | :--- |
| `DRAFT` | Created; not yet the governing intent |
| `RATIFIED` | The current, active intent; opens Gate 1 |
| `SUPERSEDED` | Retired by `sigma intent supersede --director-confirm` |

Each chain file holds exactly one INTENT. A complementary or replacing INTENT is a separate chain. Ratifying a new INTENT never supersedes another automatically. `sigma intent supersede` is the only path to `SUPERSEDED`; it cascades `SUPERSEDED` to every ROADMAP, PLAN, EXEC, and CLOSE of that chain, including `LOCKED` ones, after a mandatory preflight.

A RATIFIED INTENT may be changed only by an amendment (section 7.4). It may contain a research section; sources are recorded in the project Reference List, not inline.

### 5.2 ROADMAP

A staging map for a ratified INTENT. **Mandatory.** There is exactly one ROADMAP per chain, created by `sigma roadmap new` after `sigma intent ratify`.

States: `DRAFT`, `LOCKED` (set by `sigma close lock`, which locks a still-DRAFT ROADMAP), `SUPERSEDED` (by the INTENT supersede cascade). The Stage Overview table is generated from the chain file by `sigma roadmap render` and is never edited by hand; the Core Process Flow and Planned Stage parts are written manually. If the ROADMAP conflicts with the INTENT, the INTENT governs.

### 5.3 PLAN

The build and test contract for one stage. Acceptance criteria and the test contract are the part that DEV and the Director rely on, so changes to them are controlled (section 7.3).

States and approval follow section 7. A PLAN may be staged as pending (`sigma plan new --pending`) and promoted into the version queue by `sigma plan promote`. An append-only AUD notes part may receive audit findings after approval; it does not change the contract.

### 5.4 EXEC

DEV's record of the build for one PLAN: implementation approach, FMN pre-build review, build result and verification, deviations and limitations, FMN post-build review, Director observations, and the product changelog.

State machine: `DRAFT → LOCKED`. At most one non-final EXEC exists for a PLAN, and an EXEC always carries the version of its PLAN. When an EXEC becomes LOCKED, its changelog is recorded in the project `CHANGE-RECORD.md` (section 18).

### 5.5 CLOSE

The Director's closure document. It must reference the PLAN and EXEC versions that support the closure claim. There is one non-superseded CLOSE per INTENT; a second draft for the same INTENT is rejected. A CLOSE is `SUPERSEDED` only as a cascade from `sigma intent supersede`. A revision is a new version.

### 5.6 Reference List

A project-wide source index supporting the INTENT's research section. Not versioned and not tracked in the chain file. Three tables: local artifacts (synced from `Sigma/reference/data/` by `sigma reference update`), website links, and online source data. An INTENT cites sources by ID only.

### 5.7 Notes

Notes are free-form Markdown files with no governance authority. They live under `Sigma/notes/`:

- `note-list/` holds registered notes. A note is registered only by `sigma notes new`.
- `unregistered-notes/` receives Markdown files that were not created through `sigma notes new`.
- `note-list.md` is the generated catalog; `Sigma/notes-registry.json` is the registry it is built from.

`sigma notes update` moves unregistered Markdown to `unregistered-notes/`, refuses non-Markdown files, and regenerates the catalog. A note does not replace or amend an artifact.

### 5.8 Director-Facing Labels

| Label | Artifact | Purpose |
| :--- | :--- | :--- |
| Intent | INTENT | Objective, scope, constraints, success definition |
| Plan | PLAN | Build contract and test contract |
| Execution Evidence | EXEC | Implementation, verification, evidence |
| Closure | CLOSE | Final cycle closure |
| Roadmap | ROADMAP | Staging map |
| Reference List | `reference-list.md` | Research source index |

**Presentation rule**: show meaning first, artifact name second. Artifact names remain the authority for filenames, chain-file values, registry files, and CLI arguments.

---

## 6. Chain Identity and Numbering

A chain is the set of artifacts that descends from one INTENT, stored in one chain file `Sigma/progress-v<N>.json`. Several chains may exist side by side; `sigma intent activate` switches the active one and `sigma intent list` lists them.

Each chain records its numbering scheme:

| Scheme | Meaning |
| :--- | :--- |
| `intent_aligned` | PLAN and EXEC major version equals the INTENT major version. Used by chains created under Sigma v2. |
| `legacy_offset` | PLAN and EXEC major version equals the INTENT major version minus one. Kept for chains created earlier. |

A chain without the recorded scheme is read as `legacy_offset` and reported with a compatibility warning. Reading never changes the scheme. A role uses the scheme the chain reports, as shown by `sigma session bootstrap`.

---

## 7. Lifecycle States and Approval

### 7.1 Lifecycle model

Each chain records its `lifecycle_model`, which is independent of its numbering scheme.

| Model | PLAN | EXEC | Approval commands |
| :--- | :--- | :--- | :--- |
| `paired_approval` (new chains) | `DRAFT → APPROVED → LOCKED` | `DRAFT → LOCKED` | `plan approve` records APPROVED. `exec approve` locks the same-number PLAN and EXEC together in one transaction. |
| `legacy_lock` (older chains) | `DRAFT → LOCKED` | `DRAFT → LOCKED` | `plan approve` and `exec approve` keep the previous separate-lock behavior. |

`plan lock` and `exec lock` are retired. They exit with an error and change nothing. A chain is converted between models only by an explicit `sigma doctor --migrate-lifecycle` run with Director confirmation; reading never migrates.

`approve` without `--director-confirm` is a preview. A PLAN or EXEC may be approved only when its `check` reports approval readiness, and only on explicit Director authorization (section 12).

### 7.2 Revision identity

An artifact keeps its version number (`vN`, `vN.M`) and a separate positive-integer content revision. An edit that bypasses the controlled workflow does not change the revision and is reported as `UNCERTIFIED_EDIT`. A PLAN and an EXEC bind the revision and hash of their source: a PLAN binds the INTENT revision and document hash, and an EXEC binds the PLAN revision and contract hash. A number alone is not evidence.

### 7.3 PLAN revisions after approval

Only FMN edits a PLAN. After approval, a change goes through `sigma plan revise prepare`, `check`, and `commit`, working on a staging copy under `Sigma/revisions/staging/`, never on the approved file.

- An **ordinary** revision at a pre-build or post-build review checkpoint is reviewed by the Director together with the EXEC.
- A revision that **loosens** acceptance criteria or the test contract, or any change outside those checkpoints, needs Director approval of the exact staged candidate before it is committed and before DEV continues affected work. The classification is a role declaration; when it is uncertain, FMN treats the change as needing approval.
- After every committed revision, FMN sends a `CONTRACT_CHANGE` message to DEV. The message carries the exact revision identity, and the send records a receipt.
- DEV reads the notice and the current PLAN, then runs `sigma exec acknowledge-plan`. Reading or archiving the message is not acknowledgment. Acknowledgment is evidence of the reference, not of understanding and not permission to code.
- DEV asks for a change through a `CONTRACT_CHANGE_REQUEST`. A request changes nothing and approves nothing.
- Each committed revision is stored as an append-only snapshot with a ledger entry.

Direct edits, missing evidence, source drift, and pending notices are blockers. An INVALID recovery or an override does not replace them.

### 7.4 INTENT amendments

A RATIFIED INTENT may be changed by an amendment, and an amendment may change any part of it. Amendments run through Git:

1. ARC runs `sigma intent baseline check` to confirm the working copy is the committed, certified content. A chain without a Git baseline needs `sigma intent baseline adopt` with Director confirmation first. A project without a local Git repository cannot run an amendment.
2. ARC gives the Director the list of planned changes and the sections each affects. The Director approves the list.
3. ARC edits the INTENT and runs `sigma intent amendment preview`, which shows the diff against the baseline, the document hash, and the impact on PLAN and EXEC. The Director reviews and approves the content.
4. The reviewed content is committed to Git under the Director's direction.
5. `sigma intent amendment` with the commit, the document hash, and `--director-confirm` verifies the commit, creates a local annotated tag, and records the amendment.

An amendment takes effect from its ratification forward and does not retroactively validate work built ahead of it. After an amendment, each APPROVED PLAN needs FMN review, a revision that binds the current INTENT, a notice, and DEV acknowledgment. LOCKED history is not demoted or recertified. The Director authorizes an amendment directly; approval relayed by another role is not approval. Sigma never stages, commits, or pushes. Pushing the tag is the Director's action.

`sigma intent ratify` and `sigma intent amendment` are the only commands that certify the INTENT. Any other edit makes the file's hash differ from the certified one and is reported as `UNCERTIFIED_EDIT`. A warning is not a lock block. It clears through an amendment or by discarding the edit. `sigma doctor` reports it and never re-certifies.

---

## 8. Gate Rules

Gates block an operation until its pre-condition holds. The CLI enforces gates against the chain file at runtime. No agent action bypasses a gate; only the Director can satisfy a pre-condition or use `sigma override`.

### Gate 1 — DESIGN Complete

| Property | Value |
| :--- | :--- |
| Blocks | `sigma roadmap new` |
| Pre-condition | An INTENT with status `RATIFIED` exists |

### Gate 1.5 — ROADMAP Exists

| Property | Value |
| :--- | :--- |
| Blocks | `sigma plan new`, `sigma plan promote` |
| Pre-condition | The chain's ROADMAP exists and is not `SUPERSEDED` |

### Gate 2 — PLAN Eligible

| Property | Value |
| :--- | :--- |
| Blocks | `sigma exec new` |
| Pre-condition | The target PLAN is APPROVED and current on a `paired_approval` chain, or LOCKED on a `legacy_lock` chain, and has no open EXEC |

The summary Gate 2 is open when at least one PLAN is eligible. The target PLAN must still meet every requirement itself; one healthy PLAN does not justify creating an EXEC for a stale one. Creation order carries no meaning, and `--plan` selects the target when several are eligible. Concurrent EXEC drafts are allowed across different PLANs, never within one PLAN. The only exit for an unwanted EXEC draft is `sigma plan supersede` on its PLAN, which cascades to the EXEC.

### Gate 3 — BUILD Evidence

| Property | Value |
| :--- | :--- |
| Blocks | `sigma close new` |
| Pre-condition | The INTENT is RATIFIED; at least one PLAN and EXEC pair is completed; no PLAN or EXEC is in DRAFT and no PLAN is APPROVED but unfinished; every LOCKED PLAN has exactly one LOCKED EXEC with the same version and a correct reference |

`SUPERSEDED` artifacts are excluded. Abandoning a PLAN with `sigma plan supersede` never blocks Gate 3.

### Gate 3.5 — ARC Satisfaction Score

| Property | Value |
| :--- | :--- |
| Blocks | `sigma close new` |
| Pre-condition | An ARC score of at least 50 is recorded with `sigma intent score <n> --notes "..."` |

Gate 3.5 gates `close new`, never `close lock`; the CLOSE verdict stays the Director's sole closure authority. There is no override below 50. A chain may stay unclosed indefinitely. From 50 to 79 the gate is open but ARC does not recommend closure, and the Director may still run `close lock` on explicit authorization. The scale and evaluation doctrine are in `Sigma/rules/ARC-RULE.md`.

### Readiness is separate from validity

`check` reports document validity and approval eligibility separately and lists blockers. It never approves or revises. A passing `check` cannot be followed by an `approve` that fails for the same requirement; if that happens it is a CLI defect.

---

## 9. Folder-to-Phase Mapping

| Path | Phase | Contents |
| :--- | :--- | :--- |
| `Sigma/charter/` | DESIGN | `INTENT-vN.md` (earlier: `DIR-INTENT-vN.md`) |
| `Sigma/roadmap/` | BUILD | `ROADMAP-vN.md` |
| `Sigma/contract/` | BUILD | `PLAN-vN.M.md` (earlier: `FMN-PLAN-vN.M.md`), `pending/` |
| `Sigma/evidence/` | BUILD | `EXEC-vN.M.md` (earlier: `DEV-EXEC-vN.M.md`) |
| `Sigma/close/` | CLOSE | `CLOSE-vN.md` (earlier: `DIR-CLOSE-vN.md`) |
| `Sigma/revisions/` | BUILD | PLAN revision snapshots and staging copies |
| `Sigma/messages/` | Any | Messages by role and context, with `index.json` and `attachments/` |
| `Sigma/memo/` | Any | Self-addressed memos by role and context |
| `Sigma/notes/` | Any | Notes (section 5.7) |
| `Sigma/reference/` | Any | `reference-list.md`, `data/` |
| `Sigma/rules/`, `Sigma/templates/`, `Sigma/role-memory/` | All | Governance assets copied from the global installation |
| `Sigma/logs/`, `Sigma/memory/` | Any | Operation log, F08 records, overrides |
| `dev/` | BUILD | DEV workspace (section 18) |
| `.sigma-identity.json` | Any | Project identity, at the project root |

Projects created before this layout keep working: every command resolves stored file paths first and falls back to folder-derived defaults only when none is stored.

---

## 10. Audit Doctrine

1. **AUD is advisory only.** Findings are evidence for Director judgment and cannot block artifact progression.
2. **The Director is the sole approval gate.** No audit verdict constitutes approval.
3. **Destination vs route.** The Director owns the destination: core objective, intended beneficiary, desired outcome, core values, and final acceptance. AUD does not challenge it.
4. **AUD attacks the route.** Tech stack, architecture assumptions, scope choices, timeline, test contract, implementation approach, evidence, and closure claims are auditable.
5. **One findings format.** Findings are written as a structured section within the audited artifact, or kept in an audit record (section 11).

| Target | Auditable focus |
| :--- | :--- |
| INTENT | Assumptions, constraints, scope, risk, evidence requirements, research source compliance |
| PLAN | Plan adequacy, test contract scope, alignment to INTENT |
| EXEC | Implementation against plan, deviations, known issues |
| CLOSE | Evidence reference sufficiency, accepted limitations |

---

## 11. AUD Activation and Audit Records

AUD is **optional by default.**

**Recommended, not required:**

| Scenario | Reason |
| :--- | :--- |
| Before an INTENT is ratified for the first time | Faulty assumptions propagate into all of BUILD |
| Before an EXEC build begins, when scope or technical risk is non-trivial | Plan weaknesses are cheaper to catch before implementation |
| Before a CLOSE is locked for public release | Evidence gaps are easier to address before publication |

AUD becomes **mandatory** only when the Director explicitly marks the project as risk-sensitive. The CLI does not assign risk sensitivity.

**Recording findings.** AUD findings are written into the AUD notes of INTENT or PLAN by ARC or FMN, sourced from an AUD message in the mailbox or from the Director relaying the result. ARC and FMN transcribe the verdict exactly and never soften it. A skipped audit requires an explicit Director instruction recorded verbatim.

**Audit packs and decisions.**

- `sigma audit new` snapshots a registered target and its available registered sources. `sigma audit show` renders the pack for manual handoff and reports missing or stale sources. `sigma audit record` preserves the original AUD response with its declared origin and refuses a stale pack.
- `sigma decisions add`, `list`, and `target` record substantive questions against current content. `sigma decisions assess` records an advisory FMN readiness assessment tied to the PLAN and INTENT hashes; a changed hash requires reassessment. `sigma decisions resolve --director-confirm` records the Director's answer on the local CLI and does not approve an artifact.
- `sigma plan check --sources` shows quoted INTENT references and separates structural eligibility, source certification, and advisory semantic readiness. A found reference does not establish alignment.
- `sigma plan clone` and `sigma intent clone` create a new draft from registered content with a fresh identity, after a preview and a preview token. Approvals, checklists, and revision history are reset. Superseding and approval remain separate operations.
- Records live in `Sigma/logs/f08.json`, managed by the CLI and MCP. No command sends material to another role or vendor automatically, and a self-declared response origin is not authenticated.

---

## 12. CLI Command Surface and Operator Model

**Binary**: `sigma`. **Pattern**: `sigma {domain} {action} [options]`. The CLI is authoritative for exact syntax; run `sigma --help` or `sigma {domain} --help`.

| Domain | Responsibility |
| :--- | :--- |
| `setup` | Global installation, update, and removal |
| `project` | Project start, status, sync, and identity repair |
| `session` | Read-only runtime orientation |
| `intent`, `roadmap`, `plan`, `exec`, `close` | Artifact lifecycle |
| `reference`, `notes` | Reference List and free-form notes |
| `send`, `inbox`, `memo` | Messaging and self-addressed memos |
| `audit`, `decisions` | Audit packs and substantive questions |
| `control` | Trusted local Director surface for operation tickets |
| `dev` | DEV workspace |
| `git`, `report`, `scan`, `memory`, `config` | Evidence, reports, terminology scan, role memory, configuration |
| `doctor`, `override` | Diagnosis and reconciliation; Director override |

### 12.1 Operator model

Sigma is operated primarily by AI roles under Director authority. The Director is not expected to run every lifecycle command. AI roles must not infer Director approval. Any command that represents approval, closure, accepted risk, supersession, or an artifact lock requires explicit Director authorization.

| Layer | Identity | Role |
| :--- | :--- | :--- |
| Director | Human | Sole approval authority |
| AI roles | ARC, FMN, DEV, AUD | Command operators within their boundary |
| CLI and MCP | `sigma`, `sigma-mcp`, `sigma-control` | Validate prerequisites and enforce gates |
| Chain file | `Sigma/progress-v<N>.json` | Operational record of what is permitted |
| Artifacts | Markdown files | Permanent record of decisions and approvals |

### 12.2 Command authority classes

| Class | Examples | AI may execute? | Director instruction needed? |
| :--- | :--- | :---: | :---: |
| Read-only | `status`, `list`, `check`, `session bootstrap`, `git evidence`, `intent baseline check`, `intent amendment preview`, `notes list`, `audit show`, `decisions list`, `dev status`, `doctor --check-assets`, `scan` | Yes | No |
| Draft / Operational | `intent new`, `roadmap new`, `plan new`, `exec new`, `close new`, `plan revise prepare`, `exec acknowledge-plan`, `reference update`, `notes new`, `send`, `inbox`, `memo`, `audit new`, `decisions add` | Yes, within role boundary | Usually no |
| Approval | `intent ratify`, `plan approve`, `exec approve`, `close lock`, `intent score`, `intent amendment`, `intent baseline adopt`, loosening `plan revise commit`, `dev create-workspace` | Only after Director approval | Yes |
| Risk / Supersession | `intent supersede`, `plan supersede`, `override`, `doctor --migrate-lifecycle`, `doctor --migrate-mailbox`, destructive or reset operations | Only after Director approval | Yes |

`sigma control approve`, `sigma control reject`, and `sigma decisions resolve` are the Director's own commands on the trusted local CLI. AI roles do not run them and the MCP servers do not expose them.

Two Approval commands have a narrower scope:

- `intent score`: what the Director approves is committing the score to the chain file, not its content, which ARC has already reasoned through in conversation. Authorization uses distinct commit language ("record the score"), not "do you agree with this score".
- `intent amendment`: what the Director authorizes is recording an amendment whose content the Director has already reviewed in the preview.

### 12.3 Explicit approval

Clear authorization: `approved`, `lock this`, `lanjut lock`, `accept risk`, `supersede this version`, or an equivalent unambiguous instruction.

Ambiguous, and not sufficient: `looks good`, `menarik`, `sepertinya oke`, `lanjut bahas`, `apa pendapatmu?`, `okay`, `noted`, `interesting`.

If authorization is unclear, ask before executing.

**Conditional approval** (for example "approve, but fix section 3 first"): satisfy the condition, report that it has been addressed, and wait for the Director's confirmation. Do not self-certify and proceed.

**Rejection signals**: `I don't like this`, `do not lock`, `revise first`, `needs more work`, `nanti dulu`, `jangan dulu`.

### 12.4 Pre-approval verification

Before recommending or executing any approval command, the AI role runs the matching `check` and confirms it reports approval readiness (`Eligible` or `Eligible with warnings`). If `check` reports `Not eligible`, the role resolves the unsatisfied requirements first. Do not recommend approval from memory or from a manual read of the document alone.

### 12.5 Director authority preservation

A valid command is not automatically an authorized command. A command is authorized only when it is permitted by the state gates, within the executing role's authority class, and, when its class requires it, explicitly authorized by the Director. AI roles do not ask the Director to run routine commands that are within their own boundary.

### 12.6 MCP servers

`sigma-mcp` is a read-only query server. It cannot approve, supersede, close, or mutate chain state. `sigma-control` provides bounded writes through the same use cases as the CLI, bound to a project and a role at startup. A governance transition through `sigma-control` is a prepare and commit pair. The Director reviews the operation ticket on the trusted local CLI (`sigma control show`) and records approval there (`sigma control approve`). An MCP tool cannot grant its own approval, and a retired lock tool name is a tombstone that changes nothing.

---

## 13. Human-Readable and AI-Operational Artifacts

Most governance artifacts are AI-operational: optimized for role execution, traceability, and cross-session continuity.

**Human-facing:**

- **INTENT** — must be written clearly enough for the Director to review and approve.
- **CLOSE** — must be written clearly enough for the Director's final review.

**AI-operational:** ROADMAP, PLAN, EXEC, audit findings, chain files, role rule files, protocol, and registry files. Dense formatting and technical fields are acceptable.

In normal operation the Director reviews or refines the INTENT, approves or rejects approval decisions, reviews the CLOSE, and authorizes risk acknowledgment or supersession. AI roles read operational artifacts, maintain boundaries, surface only decision-relevant issues, and translate Director decisions into valid operations.

Sigma generates no separate "human version" of an artifact. The `/humanize` skill rewrites text for a human reader on request and does not change project state.

---

## 14. Language Preference

Language preferences are configured in `Sigma/project.config.json` through `sigma config`. Values are free-form language names, not codes. The default is `"English"`. Three independent fields exist:

- `interaction_language` — AI and Director communication.
- `document_language` — prose inside Sigma governance artifacts.
- `output_document_language` — prose inside non-Sigma output documents.

At role activation or orientation, AI roles check the configuration (shown by `sigma session bootstrap`) and follow all three.

**Formal Sigma identifiers always stay in English**: artifact names, lifecycle and gate state names, CLI commands, filenames, JSON keys, and other machine-readable syntax. Only human-readable prose follows the configured language.

**Language preferences govern write and response direction, not comprehension.** An AI role never switches its response or document language because the Director's message is in another language. Only an explicit Director instruction changes the language for a turn or session, and persisting it to `sigma config` requires explicit Director approval.

---

## 15. Role-to-Role Messaging and Memo

### 15.1 Messaging

Formal role-to-role messages go through `sigma send`. The valid messaging roles are ARC, FMN, DEV, and AUD. The Director communicates directly and does not use the inbox.

- **Context.** Messages and memos belong to a context: an INTENT, `GENERAL`, or `LEGACY`. Files are stored under `Sigma/messages/<ROLE>/<CONTEXT>/`. Every new message states `--related-artifact` for the registered artifact it concerns. `GENERAL` is used explicitly only for content unrelated to any artifact. `LEGACY` holds migrated old messages and is never a target for new ones. A reply may inherit its parent's context. An unknown or ambiguous reference stops the send; it is never replaced by `GENERAL`.
- **Sender gate.** A role cannot send a new message while it has unread incoming messages in the target INTENT context or in `GENERAL`. It reads them with `sigma inbox read <id>` first.
- **Status.** A message is `UNREAD`, `READ`, `ARCHIVED`, or `OUTDATED`. Aging a surplus of `READ` messages to `OUTDATED` never deletes, moves, or renames the file.
- **Types.** Including `CONTRACT_CHANGE` and `CONTRACT_CHANGE_REQUEST` (section 7.3). A message is never Director approval; authority needs explicit Director instruction under section 12.
- **Migration.** `sigma doctor --migrate-mailbox` moves legacy messages to `LEGACY`; `--dry-run` previews it.

### 15.2 Self-addressed memo

A memo (`sigma memo write`, `list`, `read`, `clear`) is a role leaving an operational brief for itself in a later session. `from` and `to` are always the same role. Memos share the mailbox index with type `MEMO` but are excluded from the sender gate and from `sigma inbox`. The unread-memo quota applies per role within each context, with `GENERAL` counted separately (default 5, `mailbox.memo_unread_limit`). A memo carries pointers and instructions, not copies of artifact content, and is never a substitute for a ratified or locked artifact. Its required `--ref` follows the same artifact policy as `--related-artifact`.

---

## 16. Git Evidence and Baselines

`sigma git evidence` outputs the current branch, latest commit, changed files, and a diff summary. It is read-only and informational; it satisfies no gate or closure evidence requirement by itself.

Sigma never stages, commits, pushes, configures a remote, or sets Git identity. `sigma project start --init-git` runs only `git init` after confirmation. INTENT baselines and amendment tags (section 7.4) are the only Git-bound records Sigma creates, and they are local.

---

## 17. Project Assets, Versions, and Sync

The global installation `~/.sigma/` holds governance documents, rules, templates, and bridge files. A project holds its own copies under `Sigma/`.

- `sigma setup update` refreshes `~/.sigma/` from the installed package. It does not touch any project.
- `sigma project sync` previews, per file, the difference between the managed sources and the project. `sigma project sync --confirm` copies missing files and, for each differing file, only after an exact `--accept` token for that file, with a backup of the previous bytes. Sync never replaces a differing file silently.
- `sigma doctor --check-assets` compares master, installed, and project assets without writing.

**Version stamp.** Each layer records the version and content hash of the sources it was last made identical to: `~/.sigma/sigma.config.json` for the global installation and `sigma_applied` in `.sigma-identity.json` for a project. A stamp is written only when every managed file on that layer matches its source. A project whose layer is behind prints one warning line on stderr in every command except `setup`, `doctor`, `project start|register|sync`, and `session bootstrap`; orientation carries the same message. The global installation is reported first, because syncing a project from an outdated installation copies outdated files. A project without a stamp is reported as unknown. The stamp records the last sync and does not detect later edits.

**Rule and memory hashes.** A role memory file records the hash of its rule file in `source_rule_version`. A mismatch is reported by `sigma doctor --check-assets`.

---

## 18. DEV Workspace and Product Changelog

**DEV workspace.** The workspace is `<project_root>/dev/`, registered in `.sigma-identity.json` and marked by `dev/.sigma-workspace.json`. `sigma dev create-workspace` creates it, only on explicit Director instruction. `sigma dev status` reports whether it is active, degraded, or not registered. `sigma doctor --repair-workspace` recreates a missing folder or marker.

While it is active, DEV writes only inside `dev/`, apart from the EXEC file, Sigma operations that write inside `Sigma/`, and notes created with `sigma notes new`. DEV may read anywhere in the project. When the workspace is degraded, DEV stops writing outside `dev/` and asks for repair.

**Product changelog.** Each EXEC at template schema 4 or later carries a Changelog. When the EXEC becomes LOCKED, the list is added to the project `CHANGE-RECORD.md` under the EXEC version, most recently locked first. The valid locations are `<project_root>/CHANGE-RECORD.md` and `<project_root>/dev/CHANGE-RECORD.md`; with both present the DEV workspace state decides. Recording happens once, after the lock is committed, and never blocks the lock. When a condition is not met, nothing is written and a message states why.

---

## 19. Document Templates and Role Files

Template content, markers, and the Director verdict format for each artifact are authoritative in `Sigma/templates/`.

Detailed behavioral rules for ARC, AUD, FMN, and DEV, including activation, prohibited actions, response and revision limits, scope boundaries, and expected outputs, are authoritative in `Sigma/rules/{ROLE}-RULE.md`.

Role memory is a short operating cue for the first moments of role activation. It is reminder-only and must not override rules, this protocol, CLI output, runtime state, locked artifacts, or Director instructions.

Roles do not share one activation bootstrap. ARC starts as stop-first intent intake. AUD starts as a passive evidence-boundary review. FMN and DEV use runtime orientation only within their direct planning or execution chain.

Skill files for each role are deployed by `sigma setup install` to the AI tool directories it detects: Claude Code, Codex CLI, Reasonix, Antigravity, and opencode.

---

*SIGMA_PROTOCOL.md v1.0 (2026-10-15). Rewritten to describe Sigma v2 as implemented. Earlier versions (v0.2 to v0.11) are available in the Git history of this file.*
