# Sigma Ecosystem

Sigma Ecosystem is a lightweight governance ecosystem for AI-assisted software projects.

It combines a protocol, CLI, AI role rules, bridge files, memory support, and project artifacts to help humans use AI coding agents without losing control of intent, scope, evidence, and closure.

The CLI component is installed as `sigma-cli` and used through the `sigma` command.

Sigma turns AI-assisted work into a traceable lifecycle:

```text
Define Intent → Stage the Work (optional) → Write the Plan → Build & Verify → Closure
```

Sigma Ecosystem is not an autonomous agent swarm. It is an AI-operated governance layer under human authority.

---

## AI Roles Operate Sigma for You

Sigma Ecosystem is designed to be operated by AI roles under your authority.

You give intent and approval.
AI roles operate the workflow.
Sigma CLI enforces gates.
Artifacts preserve proof.

When lost, type `/report`.
Sigma will tell you the current state, open risks, and the next valid move.

---

## What Sigma Solves

AI-assisted development often fails for governance reasons, not coding reasons:

- the goal is unclear,
- the AI starts coding before intent is stable,
- the plan drifts from what was agreed,
- implementation claims success without evidence,
- context disappears between sessions,
- different AI tools behave differently,
- nobody can explain what was decided, why, or whether the work is actually done.

Sigma Ecosystem addresses this by giving AI roles a shared workflow, shared artifacts, and clear authority boundaries.

```text
Director gives intent and approval.
AI roles operate the workflow.
Sigma CLI enforces gates.
Artifacts preserve evidence.
```

---

## Actors and Terminology

Understanding who does what in Sigma is essential before reading the workflow.

### Director

The Director is the **human** who owns the project.

The Director gives intent, approves or rejects proposals, accepts or rejects risk, and decides closure. The Director does not run CLI operations — AI roles do.

Authority decisions belong exclusively to the Director:

- approving or rejecting a plan,
- locking an artifact,
- accepting an identified risk,
- superseding a locked version,
- deciding closure.

### AI Roles

AI roles are the **operational layer**. They read project state, draft governance artifacts, run CLI commands, and surface risks — all under Director authority.

Each role has a fixed scope:

| Role | Shortcut | Scope |
|:--- |:--- |:--- |
| ARC — Architect | `/arc` | Clarifies Director intent; drafts `DIR-INTENT` |
| FMN — Foreman | `/fmn` | Plans the work; drafts `ROADMAP` and `FMN-PLAN` |
| DEV — Developer | `/dev` | Implements the locked plan; records evidence in `DEV-EXEC` |
| AUD — Auditor | `/aud` | Passive external reviewer; advisory only; never locks or blocks |

A role is immutable within a session. If FMN is active, it does not become DEV in the same session.

### Sigma CLI

The CLI is the **enforcement layer**. It validates gates, updates runtime state, and records decisions.

A valid CLI command is not automatically an authorized command. Lock, supersede, and risk commands require explicit Director authorization.

### Artifacts

Artifacts are **governance documents** that preserve decisions, evidence, and audit trail across sessions and AI vendors.

| Artifact | Human label | Purpose |
|:--- |:--- |:--- |
| `DIR-INTENT` | Intent Doc | Objective, scope, constraints — Director-approved |
| `ROADMAP` | Roadmap Doc | Optional staging map for large work |
| `FMN-PLAN` | Plan Doc | Build contract and test contract — Director-approved |
| `DEV-EXEC` | Execution Evidence | Implementation report and proof |
| `DIR-CLOSE` | Closure Doc | Final closure decision |

Artifact versions (e.g. `FMN-PLAN-v0.2`) are governance identifiers, not product release versions.

### Gates

A **gate** is a prerequisite condition the CLI enforces before allowing a state-advancing command.

Gates prevent downstream work from starting before upstream decisions are stable:

| Gate | Condition required |
|:--- |:--- |
| Gate 1 | `DIR-INTENT` must be LOCKED before creating a ROADMAP |
| Gate 1.5 | An ACTIVE ROADMAP must exist before creating a non-pending `FMN-PLAN` |
| Gate 2 | `FMN-PLAN` must be LOCKED before creating `DEV-EXEC` |
| Gate 3 | `DEV-EXEC` must be LOCKED before creating `DIR-CLOSE` |

### Lock

A **lock** is a Director authorization that advances an artifact from DRAFT to LOCKED state, opening the next gate.

Locking is irreversible without a supersede. A locked artifact is never edited in place.

---

## End-to-End Workflow

```text
┌────────────────────┐
│  Director Intent   │
│  Human decides     │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ ARC / DIR-INTENT   │
│ Clarify objective, │
│ scope, constraints │
└─────────┬──────────┘
          │ Director approves / locks
          ▼
┌────────────────────┐
│ ROADMAP            │
│ FMN splits large   │
│ work into stages   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ FMN-PLAN           │
│ Build contract +   │
│ test contract      │
└─────────┬──────────┘
          │ Director approves / locks
          ▼
┌────────────────────┐
│ DEV-EXEC           │
│ Implementation +   │
│ evidence           │
└─────────┬──────────┘
          │ Director approves / locks
          ▼
┌────────────────────┐
│ DIR-CLOSE          │
│ Closure summary,   │
│ proof, limitations │
└────────────────────┘
```

AUD may be invoked as a passive external reviewer at major decision points:

```text
DIR-INTENT ── AUD review ──► Director decision
FMN-PLAN   ── AUD audit  ──► Director decision
DEV-EXEC   ── AUD audit  ──► Director decision
DIR-CLOSE  ── AUD audit  ──► Director decision
```

---

## Minimal Effort Quick Start

You do **not** need to memorize Sigma commands.

You only run setup commands at the beginning. After that, AI roles normally operate Sigma for you.

### 1. Install Sigma

```bash
npm install -g sigma-cli
sigma setup install
```

### 2. Start Sigma in your project

```bash
cd your-project
sigma project start
```

### 3. Open your AI tool and activate ARC

Use your installed AI role shortcut:

```text
/arc
```

Then say:

```text
Help me create the DIR-INTENT for this project.
```

ARC will help clarify the goal, scope, constraints, and success definition.

### 4. Approve the intent when ready

You do not need to type lock commands manually. Use natural language:

```text
I approve this intent. Lock it.
```

The AI role translates your approval into the correct Sigma CLI operation, if the gate is valid.

### 5. Continue the workflow

Use the next role when needed:

```text
/fmn
Create the build plan for the locked intent.
```

```text
/dev
Implement according to the locked FMN-PLAN.
```

```text
/aud
Audit this plan before I approve it.
```

Use the Director utility shortcut whenever you need situational awareness:

```text
/report
Give me a quick status briefing.
```

---

## Director Utility Shortcuts

This shortcut is intentionally typed by the Director.

It is not a role-switching command in the same way as `/arc`, `/fmn`, `/dev`, or `/aud`. It exists to help the Director stay oriented.

| Shortcut  | Use It When                                                         | What It Produces         | Role Impact     |
|:--------- |:-------------------------------------------------------------------- |:------------------------- |:--------------- |
| `/report` | You want to know the latest state, decisions, risks, and next move | Short chat-only briefing | No role switch  |

### `/report` — know where you are

Use `/report` when you feel lost, return after a break, or want a quick project briefing.

It answers:

```text
What does the Director need to know right now?
```

Recommended use:

```text
/report
```

Typical result:

- current lifecycle state,
- important decisions so far,
- open risk or blocker,
- recommended next move.

`/report` is chat-only. It does not create files and does not change project state.

Handoff between sessions or roles uses `sigma send` / `sigma inbox` directly (see Command Reference below).

---

## What You Actually Type Most of the Time

Sigma is designed so the Director gives intent and authorization in natural language.

Examples:

```text
Create intent for this project.
I approve this intent. Lock it.
Create the build plan.
I do not like this. Revise the scope.
Audit this plan.
Implement the locked plan.
Give me a report.
Accept this limitation.
Close this project.
```

AI roles handle the operational CLI work when they have access.

The Director controls authority decisions: approval, rejection, lock, accepted risk, supersession, major scope change, and closure.

---

## Director Authorization Language

A valid CLI command is not automatically an authorized command.

Authority-sensitive commands require explicit Director authorization.

Examples of clear authorization:

```text
approved
lock it
I approve this plan
I give my approval
accept this risk
supersede this version
```

Ambiguous agreement is not enough:

```text
okay
interesting
makes sense
looks good
continue
```

If approval is unclear, the AI role must ask before acting.

---

## Sigma Skills

| Role            | Shortcut      | Responsibility                                                                |
|:--------------- |:------------- |:----------------------------------------------------------------------------- |
| ARC — Architect | `/arc`        | Helps create and refine `DIR-INTENT`                                          |
| FMN — Foreman   | `/fmn`        | Creates `ROADMAP` or `FMN-PLAN`; defines build and test contracts             |
| DEV — Developer | `/dev`        | Implements the locked plan and records evidence in `DEV-EXEC`                 |
| AUD — Auditor   | `/aud`        | Passive external auditor; reviews provided evidence; advisory only            |
| REPORT          | `/report`     | Short chat-only Director briefing: current state, decisions, risks, next move |

Role skill files are deployed by:

```bash
sigma setup install
```

Supported targets include Claude Code, Codex CLI, Reasonix, and Antigravity when their expected directories are detected.

---

## Important Role Boundaries

### AUD is passive by default

AUD is an external auditor role.

AUD reviews submitted evidence or files explicitly provided or authorized by the Director.

AUD does not roam the repository, scan unrelated files, inspect local state, or run Sigma CLI unless the Director explicitly authorizes a specific audit scope.

AUD recommends. Director decides.

---

## Why Sigma?

Sigma is useful when you want AI-assisted work to be:

- intent-driven,
- bounded,
- traceable,
- evidence-based,
- reviewable across sessions,
- coordinated across one or more AI tools.

Sigma is especially useful for:

- solo builders,
- small teams,
- AI-assisted software projects,
- prototypes that still need discipline,
- MVPs,
- internal tools,
- projects using multiple AI vendors.

Sigma can work with one AI vendor or many.

With one vendor, Sigma provides role discipline and artifact separation.

With multiple vendors, Sigma provides a shared governance layer so different AI tools operate under the same roles, gates, and evidence rules.

---

## When Not To Use Sigma

Sigma is a lightweight protocol for small-to-medium projects with a single Director authority.

Do not use Sigma as your only governance layer for:

- safety-critical systems,
- regulated delivery,
- medical, aviation, or financial compliance workflows,
- large enterprise projects requiring formal change boards,
- projects requiring certification-grade audit evidence,
- fully automated pipelines with no human governance gate.

For high-stakes or regulated work, use additional compliance frameworks or a heavier governance process.

---

## AI Tool Targets

Sigma can deploy role skill files to supported AI environments when their expected directories are detected.

Currently supported targets:

- Claude Code
- Codex CLI
- Reasonix
- Antigravity

Additional bridge guidance may be provided for Claude Desktop, Gemini CLI, or other supported tools depending on setup support.

---

## Suggested AI Role Assignments

These are practical starting points, not product claims. Model capabilities change over time. Use the model that performs best in your environment.

| Model      | Recommended Roles | Reason                                                            |
|:---------- |:----------------- |:----------------------------------------------------------------- |
| Gemini     | ARC / FMN         | Often useful for long-context strategy and intent refinement.     |
| ChatGPT    | ARC / AUD         | Good for structured reasoning, consulting, and critique.          |
| Perplexity | AUD               | Good for document verification and cross-referencing.             |
| Codex      | FMN / DEV         | Good at planning synthesis before implementation and code review. |
| Claude     | FMN / DEV         | Strong for coding and work planning synthesis.                    |
| Deepseek   | FMN / DEV         | Solid technical implementation quality at low API cost.           |

## Command Reference for AI Operators and Advanced Users

Most users do not need to memorize these commands.

AI roles normally execute operational commands after reading project state, role rules, and Director instructions.

Lock, supersede, reconstruct, stale-intent acknowledgment, and risk-related commands require explicit Director authorization.

| Domain   | Command                            | Description                                                                    |
|:-------- |:---------------------------------- |:------------------------------------------------------------------------------ |
| project  | `sigma project start`              | Initialize a Sigma project in the current directory                            |
| project  | `sigma project status`             | Show lifecycle phase, gate status, and active artifact versions                |
| project  | `sigma project sync --confirm`     | Sync doctrine files from global templates into this project                    |
| session  | `sigma session bootstrap`          | Load project state at session start                                            |
| intent   | `sigma intent new`                 | Create a `DIR-INTENT` draft                                                    |
| intent   | `sigma intent lock`                | Lock the active `DIR-INTENT` with Director approval                            |
| intent   | `sigma intent status`              | Show active intent version and state                                           |
| intent   | `sigma intent list`                | List intent versions                                                           |
| roadmap  | `sigma roadmap new`                | Create a `ROADMAP` draft (auto-activates if no ACTIVE exists)                  |
| roadmap  | `sigma roadmap check`              | Validate the active `ROADMAP` structure and markers                            |
| roadmap  | `sigma roadmap activate`           | Activate a DRAFT `ROADMAP` (demotes current ACTIVE to INACTIVE)                |
| roadmap  | `sigma roadmap render`             | Regenerate the Stage Overview table in the active `ROADMAP`                     |
| roadmap  | `sigma roadmap list`               | List stages in the active `ROADMAP` with title, focus, and plan status         |
| plan     | `sigma plan new`                   | Create an `FMN-PLAN` draft (requires locked INTENT + ACTIVE ROADMAP)           |
| plan     | `sigma plan new --pending`         | Stage a future plan without entering the version queue                         |
| plan     | `sigma plan promote`               | Promote a pending plan into the official FIFO draft queue                      |
| plan     | `sigma plan activate`              | Set an existing DRAFT version as the active plan (FIFO lock order unchanged)   |
| plan     | `sigma plan queue`                 | Show the FIFO draft lock queue and pending plans (read-only)                   |
| plan     | `sigma plan lock`                  | Lock the oldest DRAFT `FMN-PLAN` in FIFO order (opens Gate 2)                  |
| plan     | `sigma plan status`                | Show active plan version and state                                             |
| plan     | `sigma plan supersede`             | Supersede a locked plan version                                                |
| exec     | `sigma exec new`                   | Create a `DEV-EXEC` draft                                                      |
| exec     | `sigma exec lock`                  | Lock the active `DEV-EXEC` with Director approval                              |
| exec     | `sigma exec status`                | Show active execution version and state                                        |
| close    | `sigma close new`                  | Create a `DIR-CLOSE` draft                                                     |
| close    | `sigma close lock`                 | Lock the active `DIR-CLOSE` with Director approval                             |
| close    | `sigma close status`               | Show closure state                                                             |
| config   | `sigma config`                     | Interactive wizard for all 3 language preferences (yes/no per field)           |
| config   | `sigma config show`                | Show current project language preferences                                      |
| config   | `sigma config set language <name> --interaction\|--sigma-document\|--output-document` | Set one language preference non-interactively (free-form name, e.g. `English`, `Indonesia`) |
| send     | `sigma send`                       | Send a message from one role to another (`--from`, `--to`, `--message`)        |
| inbox    | `sigma inbox --role <role>`        | List unread messages for a role                                                |
| inbox    | `sigma inbox read <id>`            | Read a message and mark it as READ                                             |
| inbox    | `sigma inbox archive <id>`         | Archive a message                                                              |
| inbox    | `sigma inbox check`                | Run inbox integrity check (index vs disk files, attachments, field values)     |
| git      | `sigma git evidence`               | Show read-only Git state summary                                               |
| override | `sigma override`                   | Bypass current lifecycle gate under Director authority (recorded in audit log) |
| doctor   | `sigma doctor`                     | Diagnose and reconcile runtime state (repairs drift, marks unresolved breaks INVALID) |
| doctor   | `sigma doctor --recovery`          | Explicit alias for the default `sigma doctor` behavior                        |
| doctor   | `sigma doctor --reconstruct`       | Rebuild `progress.json` from artifact files on disk when it is missing or corrupted |
| setup    | `sigma setup install`              | Install Sigma globally to `~/.sigma/`                                          |
| setup    | `sigma setup update`               | Update global Sigma templates and governance files                             |

---

## Updating Sigma — Backward Compatibility for Registered Projects

When `sigma-cli` is updated, existing projects registered in the Sigma system may need to be migrated to stay compatible with the new schema and doctrine files.

### When to run migration

Run migration after:

- `npm update -g sigma-cli` installs a new version
- `sigma session bootstrap` reports a schema mismatch or unknown field warning
- A governance role reports an unexpected gate error on an existing project

### Migration sequence

Run these in order for each registered project:

```bash
# 1. Update global templates and governance files
sigma setup update

# 2. Navigate to your project
cd your-project

# 3. Sync doctrine files from updated global templates into the project
sigma project sync --confirm

# 4. Verify project state is consistent
sigma session bootstrap
```

### What each command does

| Command                        | What it updates                                                                            |
|:------------------------------ |:------------------------------------------------------------------------------------------ |
| `sigma setup update`           | Updates global `~/.sigma/` templates and governance files                                  |
| `sigma project sync --confirm` | Syncs doctrine files (role rules, protocol) from updated global templates into the project |
| `sigma session bootstrap`      | Verifies project state after migration                                                     |

> **No automatic legacy schema/ROADMAP migration.** Older projects with a pre-current `progress.json` schema (legacy `BUILDING`/`TESTING`/`COMPLETED` exec states, a leftover root-level `cso` array) or a freeform ROADMAP (no H2 stage convention) no longer have a CLI migration path — `sigma sync progress`/`sigma sync roadmap` were removed as trivial/redundant. This is an accepted risk; such projects require manual schema/document adjustment.

### What is preserved

The following are never modified by migration commands:

- Locked artifacts (`DIR-INTENT`, `FMN-PLAN`, `DEV-EXEC`, `DIR-CLOSE`)
- `Sigma/progress.json` gate and lock decisions
- `Sigma/logs/` — legacy CSO handoff files (if present; CSO was removed from current Sigma)
- All content inside `Sigma/build/`, `Sigma/design/`, `Sigma/close/`

Migration commands only update schema wrappers, doctrine files, and template structure — not Director decisions or locked evidence.

---

## State Integrity

Sigma governance truth remains in:

```text
Sigma/progress.json
Sigma artifacts
Sigma/memory/overrides.jsonl
```

State-changing Sigma commands validate `Sigma/progress.json` before they mutate runtime state. If the file is structurally valid but internally contradictory, the CLI blocks the mutation and names the affected field with recovery guidance.

Read-only status/bootstrap commands remain the safest first step when recovery is needed:

```bash
sigma session bootstrap
```

---

## Governance Protocol

Full specification:

```text
Sigma/SIGMA_PROTOCOL.md
```

This file is written into your project by:

```bash
sigma project start
```

The protocol covers lifecycle phases, artifact types, gates, role rules, CLI operator model, Director authorization language, memory architecture, and distribution behavior.

---

## Dev Tools (sigma-ecosystem contributors only)

These tools are for maintaining the sigma-ecosystem source repository.
They are not part of the user-facing CLI and are not distributed to end-user projects.

### `scripts/refresh-registries.js`

Keeps `Sigma/SIGMA-OPERATION-REGISTRY.json` and `Sigma/SIGMA-REGISTRY.json` in sync with the
actual CLI implementation after new commands are added.

How it works:

1. Loads the compiled CLI from `dist/commands/` (requires `npm run build` first)
2. Walks the Commander.js command tree to discover all executable operations
3. Diffs the discovered operations against the registry
4. Injects stubs (marked `NEEDS_REVIEW: true`) for operations not yet in the registry
5. Flags registry entries that no longer exist in the CLI
6. Adds known new document types to `SIGMA-REGISTRY.json`

Guard: aborts if run outside the `sigma-ecosystem` root (checks `package.json` name).

```bash
# Preview — no writes
npm run refresh-registries:dry

# Apply
npm run refresh-registries
```

After running, manually fill in the `gating`, `constraints`, and `outputs` fields
for any entries marked `NEEDS_REVIEW: true` in `SIGMA-OPERATION-REGISTRY.json`.

When to run:

- after adding a new `sigma <command>` subcommand
- after removing or renaming a command
- after adding a new document type to the `Sigma/` folder structure

---

## Summary

Sigma Ecosystem is for humans who use AI coding agents but do not want to surrender project control.

```text
You give intent.
AI roles operate.
Sigma CLI enforces gates.
Artifacts preserve proof.
You decide.
```
