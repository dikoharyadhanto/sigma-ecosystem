# PLAN-16 — P24 Role Memory and Bootstrap Unification

**Source**: `Discussion/catatan_perbaikan_memori.md`  
**Date**: 2026-06-01  
**Status**: DRAFT FOR DIRECTOR REVIEW  
**Related proposal**: P24 — Role Memory Summary

---

## Objective

Implement role memory JSON and revise Sigma role activation so AI roles become more deterministic without expanding context unnecessarily.

The primary design goal is:

```text
Behavior first.
Runtime selects artifacts.
Rules handle edge cases.
Director owns authority.
```

This plan treats `Discussion/catatan_perbaikan_memori.md` as the main source of truth. The implementation must preserve its core intent:

- role memory is a reminder/checklist layer, not a new protocol authority;
- role activation must reduce over-reading and over-inspection;
- `sigma session bootstrap` must orient runtime state without pushing roles to read unrelated documents;
- runtime status output must distinguish CLI-valid operations from role-authorized actions.

This plan also incorporates later review feedback that identified the largest implementation gap: role memory must be explicitly integrated into role activation, or the files may exist but never be loaded consistently.

---

## Problem Statement

Current Sigma role activation has conflicting signals:

- role rules still describe broad session-start reading behavior;
- `sigma session bootstrap --role <role>` prints a wide `Documents to Read` list;
- `Next Valid Operations` mixes read-only, draft, approval-sensitive, and role-dependent actions;
- ARC and AUD need passive or stop-first behavior, but current bootstrap output can encourage immediate inspection;
- DEV and FMN need runtime orientation, but only within the active evidence chain selected by Sigma runtime.

The result is that AI roles may:

- read too much context;
- inspect historical artifacts silently;
- treat CLI-valid operations as authorized next actions;
- forget stop points;
- ask for routine steps that should be automatic;
- proceed too far when Director authority is required.

---

## Design Principles

| Principle | Required behavior |
|---|---|
| Reminder-only memory | Role memory never overrides role rules, protocol, runtime state, locked artifacts, CLI output, or Director instruction. |
| No artifact-path prompting | Role memory and default bootstrap output must not name historical artifact markdown files for agents to read. |
| Runtime-selected artifacts | When artifacts are needed, the role follows versions selected by Sigma runtime, not hardcoded paths in memory. |
| Stop points are first-class | Role activation output must tell the role where to stop and what Director decision is needed. |
| Valid is not authorized | CLI-valid operations must be separated from role-permitted routine actions and approval-required actions. |
| AUD remains passive | AUD does not run bootstrap, inspect files, or scan local state unless Director authorizes exact scope. |
| ARC starts conversationally | ARC does not inspect progress or create DIR-INTENT by default; ARC first asks whether Director wants to open intent documentation. |
| Memory must be loaded | Role activation instructions must explicitly call the role memory command or embed equivalent role-memory loading behavior. |
| Drift must be visible | Rule files and memory files must carry enough version/source metadata to make material divergence reviewable. |

---

## Scope

### In scope

- add role memory JSON files under `Sigma/role-memory/`;
- add a CLI command to print role memory;
- revise `sigma session bootstrap` behavior and output;
- revise role rules for ARC, FMN, DEV, and AUD so activation behavior no longer conflicts;
- update protocol and registries where they describe bootstrap or role startup;
- update setup targets / bridge files that encode role bootstrap behavior;
- add regression tests for role memory and bootstrap output.

### Out of scope

- changing Sigma artifact state machines;
- changing lock, supersede, or risk-acknowledgment authority;
- changing `progress.json` schema unless strictly necessary;
- changing mailbox send/read/archive semantics;
- implementing richer historical memory or decision logs;
- making AUD mandatory or changing AUD advisory-only authority.

---

## Role Activation Matrix

| Role | Default activation | Progress/bootstrap behavior | Artifact reading behavior | First stop point |
|---|---|---|---|---|
| ARC | Stop-first intent intake | Do not run progress/bootstrap by default unless Director asks | Do not read roadmap, plan, exec, code, or historical artifacts by default | Ask whether Director wants to open a new `DIR-INTENT` |
| FMN | Runtime orientation and planning router | Run role-aware session orientation and roadmap listing | Use active roadmap/locked intent selected by runtime after Director selects planning direction | Brief Director on planning options and stop |
| DEV | Locked-plan execution preparation | Run role-aware bootstrap when Gate 2 permits | Study locked FMN-PLAN selected by runtime before DEV-EXEC work | After pre-implementation plan and FMN review request |
| AUD | Passive external audit | Do not run CLI or inspect local state unless exact scope is authorized | Review only provided or explicitly authorized evidence | State evidence boundary and whether audit can proceed |

---

## Proposed CLI Surface

### Role memory command

Command:

```bash
sigma memory --arc
sigma memory --fmn
sigma memory --dev
sigma memory --aud
```

The command must:

- print general rules plus role-specific rules;
- print the authority note;
- remain short and deterministic;
- never print historical artifact paths;
- never trigger artifact reading;
- be usable by role skill activation.

No new progress-check command is planned for P24. `sigma project status` remains the read-only runtime state command.

### Session bootstrap command

Revise:

```bash
sigma session bootstrap --role <arc|fmn|dev|aud>
```

Default output should become role-aware runtime orientation, not a broad reading list.

The current `Documents to Read` section should be removed from default output or hidden behind:

```bash
sigma session bootstrap --role <role> --show-docs
```

If retained, the section should be renamed to `Reference Documents` and explicitly marked as fallback/reference, not mandatory immediate reading.

The key constraint is not "never read Markdown." The constraint is to avoid role activation creating a blanket obligation to read broad Sigma doctrine files or unrelated project files. This includes default prompts to read governance background files, role rules, setup bridge files, skills, and project artifacts such as Intent Doc (DIR-INTENT), Plan Doc (FMN-PLAN), Execution Evidence (DEV-EXEC), Roadmap Doc (ROADMAP), and Closure Doc (DIR-CLOSE) unless the runtime flow or Director request makes them directly relevant.

### Role activation integration

Role memory must be part of activation, not a passive file that agents may forget.

The implementation should update every canonical role activation path so the role either:

- runs `sigma memory --<role>` during activation; or
- receives the same role memory content through the role skill/bridge file.

This applies to:

- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DEEPSEEK.md`, and `REASONIX.md`;
- `setup/targets/bridge/`;
- `setup/targets/codex/`;
- `setup/targets/claude_code/`;
- `setup/targets/antigravity/`;
- `setup/targets/reasonix/`.

Role activation must not rely on agents discovering memory files by convention.

---

## External Review Notes

Claude review feedback agreed with the core design and raised four implementation risks:

| Review point | Plan response |
|---|---|
| Enforcement mechanism is undefined | Add explicit role activation integration for `sigma memory --<role>` or equivalent embedded memory loading. |
| Memory/RULE drift risk | Add metadata and tests that make rule-memory divergence visible. |
| `sigma memory` command does not exist yet | Keep CLI command implementation as a required P24 task. |
| ARC stop-first confirmation may add friction | Keep as default, but leave an explicit Director review question for optional skip-confirm behavior. |

This feedback does not change the core design. It sharpens implementation requirements around activation and maintenance.

---

## Task Breakdown

---

## Stage 1 — AI Role Rules and Bridge Rules

Stage 1 fixes the behavioral source-of-truth before changing skills or CLI behavior. The goal is to remove contradictory activation instructions from canonical role rules and AI bridge files.

### TASK-01 — Reconcile role activation doctrine

**Primary areas**:

- `Sigma/SIGMA_PROTOCOL.md`
- `Sigma/rules/ARC-RULE.md`
- `Sigma/rules/FMN-RULE.md`
- `Sigma/rules/DEV-RULE.md`
- `Sigma/rules/AUD-RULE.md`
- root bridge files: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `DEEPSEEK.md`, `REASONIX.md`
- bridge templates under `setup/targets/bridge/`

#### Required changes

- Remove the blanket idea that all governance roles run the same bootstrap sequence.
- Make ARC explicitly stop-first and non-inspecting by default.
- Make FMN explicitly run orientation before planning, then stop for Director route selection.
- Make DEV explicitly follow Gate 2 / locked-plan execution flow without asking routine startup questions.
- Preserve AUD as passive and exact-scope-only.
- Keep `sigma session bootstrap` as read-only, but not universally mandatory for every role.
- Remove mandatory read-all bootstrap language from AI bridge rules.
- Add role memory activation language without making role memory a higher authority than role rules.

#### Acceptance criteria

- No role rule contradicts the activation matrix above.
- ARC rule no longer says ARC should read progress/bootstrap by default.
- AUD rule remains stricter than other roles and forbids unsolicited local inspection.
- FMN and DEV rules refer to runtime-selected artifacts, not historical artifact filenames.
- Role rules clearly distinguish routine read-only/draft commands from Director approval commands.
- Root bridge files and bridge templates no longer force all governance roles through the same bootstrap sequence.

---

## Stage 2 — Sigma Skills and Activation Targets

Stage 2 updates role skill files after the canonical rules are consistent. The goal is to make actual role activation follow the revised doctrine across supported AI environments.

### TASK-02 — Wire role memory into skill activation paths

**Primary areas**:

- `setup/targets/codex/`
- `setup/targets/claude_code/`
- `setup/targets/antigravity/`
- `setup/targets/reasonix/`

#### Required behavior

- ARC activation loads ARC memory before deciding whether to inspect runtime state.
- FMN activation loads FMN memory before session orientation.
- DEV activation loads DEV memory before locked-plan execution flow.
- AUD activation loads AUD memory before evidence-boundary reporting.
- Activation instructions must not say that role memory overrides `*-RULE.md`.
- Skill activation must not impose broad reading of Sigma doctrine files, bridge files, skills, or project artifacts unless directly relevant to the role flow.

#### Acceptance criteria

- Every generated role skill references role memory activation.
- No role activation path depends on the AI manually discovering `Sigma/role-memory/`.
- AUD activation still does not authorize local file scans or Sigma CLI commands beyond the exact approved scope.
- ARC activation still stops before progress/artifact inspection unless Director asks.
- FMN and DEV skill bootstrap flows refer to runtime-selected artifacts and stop points.

---

## Stage 3 — Activation Context Simplification

Stage 3 removes activation-time context sources that are now redundant or actively harmful. The goal is to reduce accidental context expansion from global memory lookups and stale CSO discovery.

### TASK-03 — Remove `sigma-memory` MCP from activation doctrine

**Primary areas**:

- root bridge files
- `setup/targets/bridge/`
- role skill files under `setup/targets/codex/`, `setup/targets/claude_code/`, `setup/targets/antigravity/`, and `setup/targets/reasonix/`
- any remaining role activation docs that tell ARC/FMN/DEV/AUD to query sigma-memory during startup

#### Required changes

- Remove sigma-memory MCP as a normal activation step for governance roles.
- Remove wording that suggests AI should query ecosystem constants before normal role work begins.
- Reposition role memory as the primary short operational cue for role activation.
- Keep room for explicit Director-requested memory lookup only if a later edge case truly requires it.

#### Rationale

- The old sigma-memory activation step is no longer necessary once role memory exists.
- sigma-memory is ecosystem-level and too broad for focused project-role activation.
- The practical value of sigma-memory during normal activation is lower than the cost of extra context and extra ceremony.

#### Acceptance criteria

- ARC/FMN/DEV/AUD activation instructions no longer require sigma-memory MCP lookup.
- No canonical role activation path treats sigma-memory as mandatory startup context.
- Role activation guidance points to role memory and role rules instead of global memory lookup.

#### Implementation note

- Local project `.mcp.json` may be cleaned manually during transition so active workspaces stop surfacing `sigma-memory` immediately.
- That manual cleanup does **not** complete the system change by itself, because current setup/generator paths can still write `sigma-memory` back into project MCP config.
- Stage 4 must align CLI/setup behavior with the doctrine change before `sigma-memory` can be considered removed from the normal project configuration path.

---

### TASK-04 — Remove automatic CSO surfacing from `session bootstrap`

**Primary areas**:

- `src/commands/session.ts`
- related docs/spec text in planning artifacts if needed

#### Required changes

- Remove the `Recent CSO Files` section from default `sigma session bootstrap` output.
- Do not encourage automatic CSO discovery during role activation.
- Treat CSO as Director-provided or explicitly authorized context, not auto-surfaced startup context.

#### Rationale

- CSO files are often outdated relative to locked artifacts and runtime state.
- Automatic CSO surfacing tempts AI roles to read stale context that was not explicitly selected by the Director.
- CSO is safer when manually referenced by the Director or explicitly requested for a narrow purpose.

#### Acceptance criteria

- `sigma session bootstrap` no longer lists recent CSO files by default.
- Role activation guidance does not imply that reading recent CSO files is a normal bootstrap step.
- CSO remains available as explicit/manual context when the Director chooses to reference it.

---

## Stage 4 — CLI Command and Bootstrap Output

Stage 4 implements the CLI support after rules, skills, and activation-context cleanup agree on the intended behavior.

This stage also absorbs the remaining MCP config cleanup needed so local manual `.mcp.json` edits do not get reverted by Sigma CLI setup flows.

### TASK-05 — Add role memory JSON files

**Primary area**:

- `Sigma/role-memory/`

#### Required files

```text
Sigma/role-memory/arc-memory.json
Sigma/role-memory/fmn-memory.json
Sigma/role-memory/dev-memory.json
Sigma/role-memory/aud-memory.json
```

Each file should include:

- `schema_version`;
- `role`;
- `authority`;
- `source_rule`;
- `source_rule_version` or `source_rule_updated_at`;
- `memory_updated_at`;
- `general`;
- `role_specific`;

#### Authority note

Each file must include this exact authority meaning:

```json
"authority": "Reminder only. Role rules, Sigma protocol, CLI output, runtime state, locked artifacts, and Director instructions override this file."
```

#### Acceptance criteria

- General rules match the approved general rules from `catatan_perbaikan_memori.md`.
- Role-specific rules match the approved ARC/FMN/DEV/AUD memory intent.
- No memory JSON contains specific historical artifact filenames.
- JSON parses cleanly.
- Role memory remains short enough to act as an operating cue.
- Memory files carry enough source metadata to identify the related rule file and review drift.

#### Drift control

Minimum drift control:

- each role memory file records its source rule path;
- each role memory file records the date or version of the source rule it summarizes;
- tests verify that every role has both a rule file and memory file.

Hash-based drift control is out of scope for P24. If rule-memory drift becomes a recurring maintenance problem later, a follow-up can add hash validation.

---

### TASK-06 — Implement role memory CLI output

**Primary areas**:

- `src/cli.ts`
- new or existing command module under `src/commands/`
- package file inclusion if needed

#### Required behavior

- `sigma memory --arc` prints ARC memory.
- `sigma memory --fmn` prints FMN memory.
- `sigma memory --dev` prints DEV memory.
- `sigma memory --aud` prints AUD memory.
- invalid or missing role flags return a clear usage error.
- command is read-only and must not mutate project files.

#### Output constraints

- Print authority note.
- Print general reminders.
- Print role-specific reminders.
- Do not print artifact content.
- Do not read or print `progress.json`.
- Do not print `Documents to Read`.

#### Acceptance criteria

- Every role memory command exits 0 and prints expected role label.
- Invalid role usage exits non-zero with clear help.
- Command works inside a Sigma project.
- Command does not require a Sigma project if implementation can safely read bundled memory files.
- Command does not mutate filesystem state.
- Role activation docs and setup targets explicitly tell agents when to run or load the role memory.

---

### TASK-07 — Revise `sigma session bootstrap`

**Primary area**:

- `src/commands/session.ts`

#### Required changes

- Make `--role` behavior role-aware.
- Remove default `Documents to Read` from bootstrap output.
- Add `--show-docs` if document registry display is still needed.
- Rename `Next Valid Operations` to `CLI-Valid Operations` or similar.
- Add a section that distinguishes:
  - routine role-permitted actions;
  - approval-required actions;
  - current stop point.
- For ARC, print stop-first guidance and avoid encouraging progress/artifact inspection.
- For AUD, print passive evidence-boundary guidance and avoid local inspection prompts.
- For FMN, print orientation/roadmap/planning-option guidance.
- For DEV, print Gate 2 / locked-plan execution guidance.

#### Acceptance criteria

- `sigma session bootstrap --role arc` does not print `Documents to Read` by default.
- `sigma session bootstrap --role aud` does not suggest scanning artifacts or running additional CLI commands without authorization.
- `sigma session bootstrap --role fmn` tells FMN to orient, brief, and stop for Director planning route.
- `sigma session bootstrap --role dev` tells DEV to follow locked plan flow when Gate 2 is open.
- `--show-docs` preserves access to registry-based reference documents for debugging or explicit review.
- Existing role mailbox summaries still work.
- Bootstrap remains read-only.

---

### TASK-08 — Keep runtime status on `sigma project status`

**Primary areas**:

- `src/commands/project.ts`

#### Required behavior

Do not add a new progress command in P24. Keep `sigma project status` as the read-only runtime state command.

If needed, lightly adjust the output terminology so it is clear that listed operations are CLI-valid runtime operations, not automatic role authorization.

#### Acceptance criteria

- `sigma project status` remains read-only.
- Output includes lifecycle phase, artifact states, gate status, stale-intent warnings when present, and CLI-valid operations.
- Output does not include documents to read.
- Output does not include role activation guidance.
- Output does not mutate `progress.json` or any artifact.

---

### TASK-09 — Update registries and package inclusion

**Primary areas**:

- `Sigma/SIGMA-REGISTRY.json`
- `Sigma/SIGMA-OPERATION-REGISTRY.json`
- `package.json`

#### Required changes

- Registry entries must stop implying that bootstrap always means broad document reading.
- Operation registry must include the new read-only `sigma memory --<role>` command surface if registries track command metadata.
- Package inclusion must ensure `Sigma/role-memory/` ships with the npm package.

#### Acceptance criteria

- New project setup can receive role memory files.
- Packaged installs include role memory files.
- Registries no longer create a default expectation that role activation means broad document reading.

---

### TASK-10 — Add regression tests

**Primary area**:

- `test/`

#### Required tests

- role memory command prints the authority note;
- role memory command prints general and role-specific reminders;
- role memory command output does not contain historical artifact markdown paths;
- `session bootstrap --role arc` omits `Documents to Read` by default;
- `session bootstrap --role aud` omits document-reading prompts by default;
- `session bootstrap --role fmn` includes stop/brief planning guidance;
- `session bootstrap --role dev` includes locked-plan / Gate 2 guidance;
- `session bootstrap --role <role> --show-docs` still prints registry reference documents;
- `project status` prints runtime state and CLI-valid operations;
- read-only commands do not mutate `progress.json`.
- every role memory file references an existing `Sigma/rules/{ROLE}-RULE.md`;
- every setup target role activation path references role memory;

#### Optional integration check

Use `/home/dikoharyadhanto/Documents/Works/Projects/CanopySense` as a read-only smoke-test project.

Allowed commands only:

```bash
sigma --help
sigma project status
sigma session bootstrap --role arc
sigma session bootstrap --role fmn
sigma session bootstrap --role dev
sigma session bootstrap --role aud
sigma session bootstrap --role arc --show-docs
```

Forbidden in CanopySense:

```bash
sigma intent new
sigma roadmap new
sigma plan new
sigma exec new
sigma close new
sigma * lock
sigma * supersede
sigma sync *
sigma project start
sigma config set
```

---

## Expected Output Examples

### ARC bootstrap

```text
=== Sigma Session Bootstrap — ARC ===

Role activation: ARC intent intake
Default behavior: stop-first, no progress/artifact inspection unless Director asks
Stop point: Ask whether Director wants to open a new DIR-INTENT

Runtime summary: hidden by default for ARC unless requested
Reference documents: hidden; pass --show-docs if explicitly needed
```

### AUD bootstrap

```text
=== Sigma Session Bootstrap — AUD ===

Role activation: AUD external auditor
Default behavior: passive evidence-boundary review
Stop point: Ask Director for the exact artifact, evidence, command output, or file scope to audit

No local inspection is authorized by bootstrap alone.
```

### DEV bootstrap

```text
=== Sigma Session Bootstrap — DEV ===

Lifecycle Phase: BUILD
Gate 2 (Plan Locked): OPEN
Locked plan selected by runtime: FMN-PLAN vX

Role-permitted routine action:
  sigma exec new

Stop point:
  Fill DEV-EXEC pre-implementation plan, message FMN for review, then stop.
```

---

## Risk Notes

| Risk | Mitigation |
|---|---|
| Existing users rely on `Documents to Read` in bootstrap | Keep `--show-docs` as an explicit compatibility/debug path. |
| Role memory becomes stale | Add schema/source metadata and drift tests; defer hash validation unless drift becomes a recurring issue. |
| Role memory exists but is not loaded | Wire memory loading into bridge files and all setup target role activation paths. |
| `CLI-valid operations` still tempt AI to act | Add separate approval-required and role-stop-point sections. |
| ARC becomes too blind | ARC can run progress/bootstrap when Director explicitly asks or when opening intent documentation requires it. |
| ARC stop-first confirmation feels repetitive | Keep default stop-first behavior, then consider an explicit Director-configured skip-confirm option later. |
| AUD cannot verify enough evidence | AUD should state evidence limitation and request exact additional scope. |

---

## Director Decisions Recorded

- Use `sigma memory --arc|--fmn|--dev|--aud`.
- Store final role memory files in `Sigma/role-memory/`.
- Do not add `sigma progress check` in P24; keep `sigma project status` as the runtime state command.
- Remove `Documents to Read` from default bootstrap output; keep `--show-docs` only as an explicit reference/debug option.

---

## Stage 5 — Post-Stage-4 Findings Review

Stage 5 is a review-and-decision stage only. It captures residual findings discovered after Stage 4 so the Director can decide whether they belong in a follow-up implementation stage, a separate stabilization track, or a test-update track.

### Finding Group A — Missing `src/engine/memory.ts`

**Observed during verification**:

- `test/memory-harvest.test.ts` imports `../src/engine/memory`
- the source file does not exist in the current tree
- the suite fails before assertions run

#### Why this matters

- This is not a role-memory regression, but it blocks full green verification.
- It suggests either:
  - the harvesting engine was removed without removing/updating the tests; or
  - the file is missing from the source tree but still conceptually required.

#### Decision needed

Choose one of these directions:

1. Restore `src/engine/memory.ts` and keep plan-lock harvesting behavior.
2. Retire the harvesting feature and remove/update the associated tests and references.

#### Recommended direction

Treat this as a separate stabilization task unless the Director explicitly wants plan-lock harvesting preserved as an active feature.

---

### Finding Group B — `sigma plan new` gate ordering vs test expectations

**Observed during verification**:

- `test/plan-activate.test.ts` expects `plan new` to fail with `DRAFT CONFLICT` when a draft plan already exists
- current CLI behavior fails earlier with `Gate 1.5 blocked: An ACTIVE ROADMAP must exist...`

#### Why this matters

- This is a behavioral-ordering question:
  - should `plan new` first report draft conflict; or
  - should it first report missing ACTIVE ROADMAP gate?
- Both are defensible, but the doctrine and tests need to agree.

#### Decision needed

Choose one of these directions:

1. **Keep current gate-first behavior**
   - update tests to expect Gate 1.5 first
   - better reflects lifecycle gate ordering

2. **Restore conflict-first behavior**
   - change `plan new` validation ordering so draft conflict is surfaced before Gate 1.5
   - preserves earlier UX/test expectation

#### Recommended direction

Keep gate-first behavior unless there is a strong UX reason to prioritize draft conflict before lifecycle gate validation.

---

### Finding Group C — Progress hardening expectation drift

**Observed during verification**:

- `test/progress-hardening.test.ts` expects:
  - `intent lock` to surface an `active_state`-specific semantic recovery error
  - `cso new --role DEV` to reject impossible `gate_3_satisfied` state
- current behavior instead:
  - returns the narrower operational lock error for `intent lock`
  - allows `cso new` despite impossible Gate 3 state

#### Why this matters

- These are not role-memory issues, but they reveal unclear boundaries in runtime hardening:
  - should semantic consistency checks always fire before command-specific operational checks?
  - should `cso new` validate impossible progress states even though CSO is optional and non-gating?

#### Decision needed

1. **Strict hardening with official recovery**
   - validate semantic consistency before command-specific checks
   - do not normalize impossible states silently
   - introduce a formal recovery path so Director/AI do not edit `progress.json` manually

2. **Keep current runtime tolerance**
   - treat these tests as too strict and update them
   - document that some commands tolerate inconsistent state more than lock commands

#### Director direction recorded

- Prefer **strict hardening**, but without forcing manual `progress.json` edits.
- Add a future `sigma doctor` recovery path.
- Impossible or contradictory runtime conditions should be marked `INVALID`.
- When `sigma doctor` is run again and the underlying conditions are satisfied, the affected invalid state should recover automatically.

#### Clarified model

The desired recovery model is:

- if a state exists in `progress.json` that should not be valid under Sigma rules, mark it as `INVALID`;
- do not pretend the state is normal;
- do not require manual `progress.json` repair as the standard path;
- let `sigma doctor` reconcile and restore validity when the real conditions are later satisfied.

This applies especially to:

- impossible gate claims;
- contradictory active tracker fields;
- runtime combinations that violate artifact-chain requirements.

---

### Finding Group D — Remaining global `sigma-memory` adapters

**Observed during verification**:

- local project `.mcp.json` and local `.vscode/mcp.json` were cleaned
- Stage 4 intentionally did **not** remove global `sigma-memory` adapter paths for:
  - `Reasonix`
  - `Gemini/Antigravity`
  - global setup memory seed/reseed flows

#### Why this matters

- Local activation is now aligned with role memory.
- Global Sigma memory still exists as an optional ecosystem-level integration path.
- This is now a product decision, not just cleanup:
  - deprecate Sigma memory completely; or
  - keep it as optional non-activation infrastructure.

#### Decision needed

1. **Full deprecation**
   - remove `sigma-memory` from global setup flows, wrappers, docs, sigma-test expectations, and MCP helper code

2. **Optional infrastructure**
   - keep global Sigma memory for ecosystem facts only
   - keep it out of all role activation doctrine and local project defaults

#### Director minimum direction recorded

- No global AI setup target should require checking MCP for `sigma-memory`.
- No global AI setup target should detect `sigma-memory` as a Sigma requirement.
- No instruction should tell AI to check Sigma memory during activation or normal startup.

This means that even if some legacy/global Sigma memory infrastructure remains temporarily in code, it must be invisible to normal AI activation doctrine and must not be treated as required setup knowledge.

---

### Suggested Next Planning Split

If the Director wants to continue after P24 Stage 4, the cleanest split is:

1. **Stabilization Track**
   - resolve missing `src/engine/memory.ts`
   - resolve progress-hardening expectation drift

2. **Behavior Doctrine Track**
   - decide gate-first vs conflict-first for `plan new`

3. **Global MCP Deprecation Track**
   - decide whether `sigma-memory` remains optional infrastructure or is fully removed

---

## Candidate Stage 6 — Runtime Doctor and CSO Simplification

Stage 6 is the proposed next implementation stage based on the post-Stage-4 review.

### TASK-11 — Add `sigma doctor`

**Primary areas**:

- `src/cli.ts`
- new command module under `src/commands/`
- runtime validation helpers under `src/engine/`

#### Required behavior

- `sigma doctor` runs a read-first reconciliation pass over runtime state.
- It checks:
  - active tracker consistency;
  - artifact chain validity;
  - impossible gate claims;
  - stale-intent propagation consistency;
  - other contradictory runtime combinations worth formalizing.
- It reports findings clearly as diagnostic output.

#### Recovery behavior

- When `sigma doctor` finds a runtime condition that should not be valid but currently exists, it marks the affected state as `INVALID`.
- `INVALID` means:
  - the state exists in data;
  - Sigma acknowledges it happened;
  - Sigma does not treat it as valid for governance/runtime purposes.
- When `sigma doctor` is run again and the underlying conditions are now satisfied, it automatically restores the affected state from `INVALID` back to normal valid status.

#### Design note

The exact representation of invalidity still needs implementation design review:

1. explicit `INVALID` artifact/gate status values; or
2. a separate runtime-validity layer that marks affected trackers/gates invalid.

The Director intent is clear even if the storage model is still open:

- impossible runtime states must not appear normal;
- recovery must come through `sigma doctor`, not manual `progress.json` edits.

---

### TASK-12 — Tighten command hardening around invalid state

**Primary areas**:

- mutating governance commands

#### Required behavior

- Governance-mutating commands should refuse to proceed when affected runtime state is `INVALID`.
- Error messages should direct the operator to run `sigma doctor`.
- The system should prefer official reconciliation over ad hoc manual edits.

#### Recovery messaging

Errors should bias toward:

```text
Runtime state is invalid for this operation.
Run: sigma doctor
```

instead of implicitly encouraging manual `progress.json` repair.

---

### TASK-13 — Simplify CSO to standalone mode

**Primary areas**:

- `src/commands/cso.ts`
- `Sigma/SIGMA_PROTOCOL.md`
- related rules, skills, templates, and registries

#### Required behavior

- simplify command surface to:

```bash
sigma cso new
```

- remove `--role` requirement;
- remove assumptions that CSO is tied to a specific Sigma role;
- remove assumptions that CSO is tied to a specific governance artifact;
- keep CSO as a standalone optional handoff document only.

#### Doctrine direction

- CSO is mainly useful for passive/non-agent chat environments.
- CSO is not part of the normal activation path for local agent-based Sigma work.
- CSO should be hard to misuse and should not look like a governance requirement.

#### Hardening direction

- Because CSO is standalone and non-governance, it should not be treated like a normal gate artifact.
- If the runtime state model is inconsistent, the Director may still want CSO as a debugging or handoff note.
- Therefore CSO simplification should be designed together with `sigma doctor`, not by forcing CSO into the same strict command category as artifact locks.
- Do not add `rule_content_hash` in P24.

## Remaining Review Questions

1. Should role memory files be copied into every Sigma project, read from the installed Sigma package, or both?
2. Should ARC support an explicit Director-configured "skip confirmation" mode for repeat workflows, or should stop-first remain absolute?

---

## Final Acceptance Criteria

- Role activation doctrine is internally consistent across protocol, rules, setup targets, and memory JSON.
- Role memory JSON exists for ARC, FMN, DEV, and AUD.
- `sigma memory --<role>` prints short deterministic reminders.
- Canonical role activation paths explicitly load or display role memory.
- `sigma session bootstrap` no longer expands context by default.
- `sigma project status` remains the read-only runtime state command.
- CLI output separates runtime-valid operations from role-authorized actions and approval-required actions.
- CanopySense read-only smoke tests pass without running any Sigma write command.
