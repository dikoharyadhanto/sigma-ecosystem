# Sigma Ecosystem

Sigma Ecosystem is a lightweight governance ecosystem for AI-assisted software projects.

It combines a protocol, CLI, AI role rules, bridge files, memory support, and project artifacts to help humans use AI coding agents without losing control of intent, scope, evidence, and closure.

The CLI component is installed as `sigma-ecosystem` and used through the `sigma` command.

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
| Gate 1 | `DIR-INTENT` must be RATIFIED before creating a ROADMAP |
| Gate 1.5 | The chain's ROADMAP must exist (not SUPERSEDED) before creating a non-pending `FMN-PLAN` |
| Gate 2 | `FMN-PLAN` must be LOCKED before creating `DEV-EXEC` |
| Gate 3 | `DEV-EXEC` must be LOCKED before creating `DIR-CLOSE` |

### Lock / Ratify

A **lock** is a Director authorization that advances an artifact from DRAFT to LOCKED state, opening the next gate. `DIR-INTENT` uses the same mechanism under the name **ratify** (`sigma intent ratify`, DRAFT → RATIFIED) — same function, distinct term to underline that ratifying establishes the governing intent without freezing how it gets operationalized. Every other artifact (ROADMAP, FMN-PLAN, DEV-EXEC, DIR-CLOSE) keeps `lock`/`LOCKED`.

Locking (or ratifying) is irreversible without a supersede. A locked or ratified artifact is never edited in place.

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
npm install -g sigma-ecosystem
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
Create the build plan for the ratified intent.
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

## sigma-mcp — MCP Orientation Server

Sigma ships a native, read-only [MCP](https://modelcontextprotocol.io) server, `sigma-mcp`, alongside the `sigma` CLI. It exposes the same orientation data CLI commands like `sigma session bootstrap` print to stdout — but as structured JSON an MCP-aware AI client can call directly, without parsing terminal text.

**CLI remains the sole authority for every write, gate, or lock operation.** `sigma-mcp` is strictly additive and read-only — it cannot lock, supersede, close, or mutate `Sigma/progress-v<N>.json` in any way.

### Tools

| Tool | Returns |
|:--- | :--- |
| `sigma_get_state` | Project phase, active chain, schema version, gate status |
| `sigma_get_gates` | Gate 1/2/3 open/satisfied status and labels |
| `sigma_get_orientation` | Role hint, gate summary, next valid operations, blockers |
| `sigma_list_artifacts` | Intent/plan/exec/close/roadmap tracker state |
| `sigma_doctor` | Reconciliation findings (report-only — never writes to disk) |

### Enabling it

`sigma-mcp` is installed as a bin entry alongside `sigma` (see [Install Sigma](#1-install-sigma) above) — no separate install step.

**Registration is automatic** — `sigma project start` and `sigma project sync` write the client config for your AI tools as part of project setup. No manual JSON editing needed.

| Command | Config written | Platforms |
|:--- |:--- |:--- |
| `sigma setup install` / `sigma setup update` | `~/.codex/config.toml` · `~/.gemini/config/mcp_config.json` | Codex CLI · Antigravity |
| `sigma project start` / `sigma project sync` | `.mcp.json` · `.cursor/mcp.json` | Claude Code · Reasonix · Cursor |

All writes are **merge-aware** — existing MCP server entries you've added manually are preserved; only the `sigma` key is upserted. Running the commands twice is safe (idempotent).

If `sigma-mcp` is not yet on your `PATH` when you run these commands, a warning is printed but the config is still written — it will work as soon as you complete the global install.

> **Uninstall note:** `sigma setup uninstall --confirm` automatically removes the `sigma` entry from the two global config files (`~/.codex/config.toml`, `~/.gemini/config/mcp_config.json`). The project-local `.mcp.json` and `.cursor/mcp.json` files are not touched — remove or edit the `sigma` entry from those files manually if sigma is no longer needed.

<details>
<summary>Manual registration reference (troubleshooting)</summary>

**Claude Code / Reasonix** — `.mcp.json` at project root:

```json
{
  "mcpServers": {
    "sigma": { "command": "sigma-mcp", "args": [] }
  }
}
```

**Cursor** — same shape at `.cursor/mcp.json` at project root.

**Codex CLI** — `~/.codex/config.toml`:

```toml
[mcp_servers.sigma]
command = "sigma-mcp"
args = []
```

**Antigravity** — `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "sigma": { "command": "sigma-mcp", "args": [] }
  }
}
```

</details>


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
| project  | `sigma project register`           | Repair/backfill `.sigma-identity.json` at project root (not a global registry) |
| session  | `sigma session bootstrap`          | Load project state at session start                                            |
| intent   | `sigma intent new`                 | Create a `DIR-INTENT` draft                                                    |
| intent   | `sigma intent ratify`              | Ratify the active `DIR-INTENT` with Director approval                          |
| intent   | `sigma intent amendment --change`  | Record a Director-approved Amendment against a RATIFIED intent                 |
| intent   | `sigma intent check`               | Validate `DIR-INTENT` structure and report lock readiness (read-only)          |
| intent   | `sigma intent status`              | Show active intent version and state                                           |
| intent   | `sigma intent list`                | List intent versions                                                           |
| intent   | `sigma intent activate --v <ver>`  | Switch which chain is active (analog `git checkout <branch>`)                  |
| intent   | `sigma intent score <n>`           | Record ARC Satisfaction Score (0–100) for a RATIFIED intent (Gate 3.5)         |
| intent   | `sigma intent supersede`           | Supersede a RATIFIED chain — cascades to its artifacts (`--director-confirm`)  |
| roadmap  | `sigma roadmap new`                | Create the chain's `ROADMAP` draft (ratified `DIR-INTENT`; one per chain)      |
| roadmap  | `sigma roadmap check`              | Validate the chain's `ROADMAP` structure and markers                           |
| roadmap  | `sigma roadmap render`             | Regenerate the Stage Overview table in the chain's `ROADMAP`                   |
| roadmap  | `sigma roadmap list`               | List stages in the chain's `ROADMAP` with title, focus, and plan status        |
| plan     | `sigma plan new`                   | Create an `FMN-PLAN` draft (requires ratified INTENT + existing ROADMAP)       |
| plan     | `sigma plan new --pending`         | Stage a future plan without entering the version queue                         |
| plan     | `sigma plan promote`               | Promote a pending plan into the official draft queue                          |
| plan     | `sigma plan lock [--v <ver>]`      | Lock a DRAFT `FMN-PLAN` (opens Gate 2); `--v` required when more than one DRAFT is open |
| plan     | `sigma plan check [--v <ver>]`     | Validate `FMN-PLAN` structure and report lock readiness (read-only); `--v` required when ambiguous |
| plan     | `sigma plan status`                | Show open DRAFTs, LOCKED plans with exec pairing, pending plans, Gate 2        |
| plan     | `sigma plan list`                  | List plan versions                                                             |
| plan     | `sigma plan update --v <ver>`      | Update stage title/focus for an existing plan (`--title`/`--focus`)            |
| plan     | `sigma plan supersede --v <ver>`   | Supersede a plan version, DRAFT or LOCKED (auto-cascades any linked non-final exec) |
| exec     | `sigma exec new [--plan <ver>]`    | Create a `DEV-EXEC` draft for a LOCKED plan with no open exec (one exec per plan) |
| exec     | `sigma exec lock [--v <ver>]`      | Lock a DRAFT `DEV-EXEC` (re-evaluates Gate 3); `--v` required when more than one DRAFT is open |
| exec     | `sigma exec check [--v <ver>]`     | Validate `DEV-EXEC` structure and report lock readiness (read-only); `--v` required when ambiguous |
| exec     | `sigma exec status`                | Show open DRAFTs with plan pairing, LOCKED execs, Gate 3                       |
| exec     | `sigma exec list`                  | List execution versions                                                        |
| close    | `sigma close new`                  | Create a `DIR-CLOSE` draft                                                     |
| close    | `sigma close lock`                 | Lock the active `DIR-CLOSE` with Director approval                             |
| close    | `sigma close check`                | Validate `DIR-CLOSE` structure and report lock readiness (read-only)           |
| close    | `sigma close status`               | Show closure state                                                             |
| config   | `sigma config`                     | Interactive wizard for all 3 language preferences (yes/no per field)           |
| config   | `sigma config show`                | Show current project language preferences                                      |
| config   | `sigma config set language <name> --interaction\|--sigma-document\|--output-document` | Set one language preference non-interactively (free-form name, e.g. `English`, `Indonesia`) |
| config   | `sigma config set mailbox-outdate-keep <n>` | How many recent READ messages `sigma inbox read` keeps before aging the rest to OUTDATED (`0` disables; default `5`) |
| send     | `sigma send`                       | Send a message from one role to another (`--from`, `--to`, `--message`)        |
| inbox    | `sigma inbox --role <role>`        | List unread messages for a role                                                |
| inbox    | `sigma inbox --role <role> --all`  | List UNREAD + READ + ARCHIVED (excludes OUTDATED)                              |
| inbox    | `sigma inbox --role <role> --outdated` | List only OUTDATED messages (READ aged out by clear / auto-sweep)          |
| inbox    | `sigma inbox read <id>`            | Read a message and mark it as READ (auto-ages surplus READ to OUTDATED)        |
| inbox    | `sigma inbox archive <id>`         | Archive a message                                                              |
| inbox    | `sigma inbox clear --role <role> [--keep 5] [--dry-run]` | Age stale READ messages to OUTDATED, keeping the N most recent READ |
| inbox    | `sigma inbox clear --all-roles --director-confirm` | Same, swept across every messaging role                             |
| inbox    | `sigma inbox check`                | Run inbox integrity check (index vs disk files, attachments, field values)     |
| git      | `sigma git evidence`               | Show read-only Git state summary                                               |
| memory   | `sigma memory --<role>`            | Show role activation memory reminders for arc/fmn/dev/aud (read-only)          |
| reference| `sigma reference update`           | Rebuild the project-wide reference list (Comprehensive Research source index)  |
| report   | `sigma report logs`                | View the operation history log with filters (read-only)                        |
| override | `sigma override`                   | Bypass current lifecycle gate under Director authority (recorded in audit log) |
| doctor   | `sigma doctor`                     | Diagnose and reconcile runtime state (repairs gate drift and stale artifact-folder paths, marks unresolved breaks INVALID) |
| doctor   | `sigma doctor --all-versions`      | Same, applied to every chain on disk (not just the active one)                 |
| doctor   | `sigma doctor --recovery`          | Explicit alias for the default `sigma doctor` behavior                        |
| doctor   | `sigma doctor --reconstruct`       | Rebuild `progress-v<N>.json` from artifact files when missing or corrupted     |
| setup    | `sigma setup install`              | Install Sigma globally to `~/.sigma/`, deploy skill files + hook               |
| setup    | `sigma setup update`               | Update global templates/governance and redeploy skill files + hook             |
| setup    | `sigma setup uninstall --confirm`  | Remove `~/.sigma/`, deployed skill files, and the hook entry (global only)     |
| notion   | `sigma notion setup --token <t> --parent-id <id>` | Configure Notion integration; token is stored per-machine in `~/.sigma/notion.credentials.json`, never inside the project |
| notion   | `sigma notion status`              | Check Notion API connection and active configuration                          |
| notion   | `sigma notion push`                | Push the governance dashboard + state backup to Notion (manual only — never triggered by lock/ratify) |
| notion   | `sigma notion pull-state [chain]`  | Restore local state from Notion (e.g. after switching devices)                |
| notion   | `sigma notion pull <type> <version>` | Fetch a single page from Notion by type + version (read-only preview)       |
| notion   | `sigma notion progress [chain]`    | Read progress & gate status from Notion without a local `Sigma/` directory     |

`sigma notion push` never sends raw `DIR-INTENT`/`FMN-PLAN`/`DEV-EXEC` markdown — Notion only ever holds the dashboard and a machine-readable state backup. Human-readable artifact content is planned separately under the Sigma Humanize Operation.

---

## Updating Sigma — Backward Compatibility for Existing Projects

When `sigma-ecosystem` is updated, existing projects created with `sigma project start` may need to be migrated to stay compatible with the new schema and doctrine files.

### When to run migration

Run migration after:

- `npm update -g sigma-ecosystem` installs a new version
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
- `Sigma/progress-v<N>.json` gate and lock decisions
- `.sigma-identity.json` at project root (project identity — untouched by migration or `sigma setup uninstall`)
- `Sigma/logs/` — legacy CSO handoff files (if present; CSO was removed from current Sigma)
- All content inside `Sigma/contract/`, `Sigma/roadmap/`, `Sigma/evidence/`, `Sigma/charter/`, `Sigma/close/`

Migration commands only update schema wrappers, doctrine files, and template structure — not Director decisions or locked evidence.

### Removing Sigma — `sigma setup uninstall`

```bash
sigma setup uninstall          # dry run — lists what would be removed
sigma setup uninstall --confirm
```

Removes the global installation only: `~/.sigma/` (templates, rules, governance, bridge, `sigma.config.json`), role skill files deployed to detected AI tool directories, and the `protect-sigma.js` hook entry in `~/.claude/settings.json` (removed surgically — only Sigma's entry, not the rest of the file).

Global-only by construction: uninstall never resolves a project-local path, so no `Sigma/` folder, `.sigma-identity.json`, or bridge file in any project is ever touched, regardless of which directory you run it from. The only consequence is that the `sigma` command stops working until you reinstall.

---

## State Integrity

Sigma governance truth remains in:

```text
Sigma/progress-v<N>.json   (one per chain)
Sigma artifacts
Sigma/memory/overrides.jsonl
```

State-changing Sigma commands validate the target chain's `Sigma/progress-v<N>.json` before they mutate runtime state. If the file is structurally valid but internally contradictory, the CLI blocks the mutation and names the affected field with recovery guidance.

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
