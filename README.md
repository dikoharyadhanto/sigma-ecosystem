# Sigma Ecosystem

Sigma Ecosystem is an AI-operated governance runtime for AI-assisted software projects. It gives AI coding agents a shared lifecycle, shared artifacts, and clear authority boundaries, and keeps the Director in control of intent, scope, evidence, and closure.

The package is installed as `sigma-ecosystem` and used through the `sigma` command. It combines a protocol, a CLI, role rules, bridge files, memory support, and project artifacts.

Sigma turns AI-assisted work into a traceable lifecycle:

```text
Define Intent → Stage the Work → Write the Plan → Build & Verify → Closure
```

Sigma is an AI-operated governance layer under human authority. It is not an autonomous agent swarm.

---

## AI Roles Operate Sigma for You

You give intent and approval. AI roles operate the workflow. The Sigma CLI enforces gates. Artifacts preserve proof.

When you are lost, type `/report`. It states the current state, open risks, and the next valid move.

---

## What Sigma Solves

AI-assisted development often fails for governance reasons rather than coding reasons:

- the goal is unclear,
- the AI starts coding before intent is stable,
- the plan drifts from what was agreed,
- implementation claims success without evidence,
- context disappears between sessions,
- different AI tools behave differently,
- nobody can explain what was decided, why, or whether the work is done.

Sigma addresses this with one workflow, one set of artifacts, and explicit authority boundaries that every AI tool follows.

---

## Actors and Terminology

### Director

The Director is the **human** who owns the project. The Director gives intent, approves or rejects proposals, accepts or rejects risk, and decides closure. AI roles run the CLI operations.

These decisions belong exclusively to the Director:

- approving or rejecting a plan,
- locking an artifact,
- accepting an identified risk,
- superseding a locked version,
- deciding closure.

### AI Roles

AI roles are the operational layer. They read project state, draft governance artifacts, run CLI commands, and surface risks, always under Director authority.

| Role | Shortcut | Scope |
|:--- |:--- |:--- |
| ARC — Architect | `/arc` | Clarifies Director intent and drafts the `INTENT` |
| FMN — Foreman | `/fmn` | Plans the work and drafts the `ROADMAP` and `PLAN` |
| DEV — Developer | `/dev` | Implements the approved plan and records evidence in the `EXEC` |
| AUD — Auditor | `/aud` | Passive external reviewer; advisory only; never locks or blocks |

A role stays fixed within a session. A session that started as FMN does not become DEV; a new session is required.

### Sigma CLI

The CLI is the enforcement layer. It validates gates, updates runtime state, and records decisions.

A valid command is not automatically an authorized command. Approval, supersession, and risk commands require explicit Director authorization.

### Artifacts

Artifacts are governance documents that preserve decisions, evidence, and the audit trail across sessions and AI vendors.

| Artifact | Human label | Purpose |
|:--- |:--- |:--- |
| `INTENT` | Intent Doc | Objective, scope, constraints; approved by the Director |
| `ROADMAP` | Roadmap Doc | Mandatory staging map for the chain |
| `PLAN` | Plan Doc | Build contract and test contract; approved by the Director |
| `EXEC` | Execution Evidence | Implementation report and proof |
| `PRODUCT REVIEW` | Product Review | Review of the final product against the `INTENT`; ARC, AUD, and Director verdicts |
| `CLOSE` | Closing Report | Describes the final product; stamp that the mandate is finished |

Artifact versions such as `PLAN-v1.2` are governance identifiers and not product release versions.

New artifact files carry no role prefix: `INTENT-v1.md`, `PLAN-v1.1.md`, `EXEC-v1.1.md`, `PRODUCT-REVIEW-v1.md`, `CLOSE-v1.md`. Files created earlier as `DIR-INTENT-`, `FMN-PLAN-`, `DEV-EXEC-`, and `DIR-CLOSE-` keep their names and remain valid. Every command accepts both forms.

### Gates

A gate is a prerequisite that the CLI enforces before a state-advancing command runs. Gates keep downstream work from starting before upstream decisions are stable.

| Gate | Condition required |
|:--- |:--- |
| Gate 1 | The `INTENT` must be RATIFIED before a `ROADMAP` is created |
| Gate 1.5 | The chain's `ROADMAP` must exist and not be SUPERSEDED before a non-pending `PLAN` is created |
| Gate 2 | An eligible `PLAN` must be APPROVED on paired lifecycle chains, or LOCKED on legacy chains, before an `EXEC` is created |
| Gate 3 | Before a `CLOSE` is created, no `PLAN` or `EXEC` may be left in DRAFT, and every LOCKED `PLAN` needs exactly one LOCKED `EXEC` |
| Gate 3.5 | Before a `CLOSE` is created, the `PRODUCT REVIEW` must exist and its ARC, AUD (unless skipped), and Director verdicts must each be `PASS` or `PASS_WITH_RISK`; `sigma close check` reports this beforehand |

### Ratify, Approve, Lock

`sigma intent ratify` establishes the governing `INTENT` (DRAFT → RATIFIED). On paired lifecycle chains, `sigma plan approve --director-confirm` records the `PLAN` as APPROVED, and `sigma exec approve --director-confirm` locks the same-number `PLAN` and `EXEC` together. Legacy chains keep separate lock semantics through the same approve commands. The `CLOSE` is locked with `sigma close lock`.

Changes to an approved `PLAN` follow a controlled review and certification workflow. Locked evidence is retained as history. `INTENT` amendments follow the Git-based baseline and review workflow.

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
│ ARC / INTENT       │
│ Clarify objective, │
│ scope, constraints │
└─────────┬──────────┘
          │ Director approves (ratify)
          ▼
┌────────────────────┐
│ ROADMAP            │
│ FMN splits large   │
│ work into stages   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ PLAN               │
│ Build contract +   │
│ test contract      │
└─────────┬──────────┘
          │ Director approves
          ▼
┌────────────────────┐
│ EXEC               │
│ Implementation +   │
│ evidence           │
└─────────┬──────────┘
          │ Director approves (locks the pair)
          ▼
┌────────────────────┐
│ PRODUCT REVIEW     │
│ ARC, AUD, Director │
│ verdicts           │
└─────────┬──────────┘
          │ verdicts accepted (close check)
          ▼
┌────────────────────┐
│ CLOSE              │
│ Closing report of  │
│ the final product  │
└────────────────────┘
```

AUD may be invoked as a passive external reviewer at major decision points:

```text
INTENT ── AUD review ──► Director decision
PLAN   ── AUD audit  ──► Director decision
EXEC   ── AUD audit  ──► Director decision
PRODUCT REVIEW ── AUD review ──► Director verdict
CLOSE  ── AUD audit  ──► Director decision
```

---

## Minimal Effort Quick Start

No command memorization is needed. Setup commands run once at the beginning. After that, AI roles operate Sigma.

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

If the directory is not Git-managed, Sigma asks whether to initialize a local repository. The default is **No**. For non-interactive setup, use `sigma project start --id <ID> --name "<name>" --confirm --init-git`. This runs only `git init`. It does not configure GitHub, a remote, identity, branch policy, or an initial commit.

### 3. Open your AI tool and activate ARC

```text
/arc
```

Then say:

```text
Help me create the INTENT for this project.
```

ARC clarifies the goal, scope, constraints, and success definition.

### 4. Approve the intent when ready

Natural language is enough:

```text
I approve this intent. Lock it.
```

The AI role translates the approval into the correct CLI operation when the gate is valid.

### 5. Continue the workflow

```text
/fmn
Create the build plan for the ratified intent.
```

```text
/dev
Implement according to the approved PLAN.
```

```text
/aud
Audit this plan before I approve it.
```

```text
/report
Give me a quick status briefing.
```

---

## Director Utility Shortcuts

`/report` is typed by the Director. It does not switch roles. It exists to keep the Director oriented.

| Shortcut  | Use It When | What It Produces | Role Impact |
|:--------- |:------------ |:----------------- |:------------ |
| `/report` | You want the latest state, decisions, risks, and next move | Short chat-only briefing | No role switch |

`/report` answers one question: what does the Director need to know right now? The result lists the current lifecycle state, important decisions so far, open risks or blockers, and the recommended next move. It is chat-only, creates no files, and changes no project state.

Handoff between roles uses `sigma send` and `sigma inbox`. Handoff for the same role across sessions, such as leaving yourself a resume note, uses `sigma memo write`, `sigma memo list`, and `sigma memo read`. The Command Reference below has the details.

---

## What You Actually Type Most of the Time

The Director gives intent and authorization in natural language:

```text
Create intent for this project.
I approve this intent. Lock it.
Create the build plan.
I do not like this. Revise the scope.
Audit this plan.
Implement the approved plan.
Give me a report.
Accept this limitation.
Close this project.
```

AI roles handle the operational CLI work when they have access. The Director controls authority decisions: approval, rejection, lock, accepted risk, supersession, major scope change, and closure.

---

## Director Authorization Language

A valid CLI command is not automatically an authorized command. Authority-sensitive commands require explicit Director authorization.

Clear authorization:

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

If approval is unclear, the AI role asks before acting.

---

## Sigma Skills

| Skill | Shortcut | Responsibility |
|:--- |:--- |:--- |
| ARC — Architect | `/arc` | Creates and refines the `INTENT` |
| FMN — Foreman | `/fmn` | Creates the `ROADMAP` and `PLAN`; defines build and test contracts |
| DEV — Developer | `/dev` | Implements the approved plan and records evidence in the `EXEC` |
| AUD — Auditor | `/aud` | Passive external auditor; reviews provided evidence; advisory only |
| REPORT | `/report` | Chat-only Director briefing: current state, decisions, risks, next move |
| HUMANIZE | `/humanize` | Rewrites a given text for a human reader at LOW, BALANCE, or HIGH detail; changes no project state |
| WRITE-MEMO | `/write-memo` | Writes a self-addressed operational brief for the active role |
| READ-MEMO | `/read-memo` | Reads pending self-addressed memos for the active role |
| SIGMA-TEST | `/sigma-test` | Read-only diagnostic of the CLI, skills, and project structure |

Skill files are deployed by:

```bash
sigma setup install
```

Supported targets are Claude Code, Codex CLI, Reasonix, Antigravity, and opencode, each deployed when its expected directory is detected.

---

## Important Role Boundaries

### AUD is passive by default

AUD is an external auditor. It reviews evidence the Director provides or authorizes. It does not roam the repository, scan unrelated files, inspect local state, or run Sigma CLI unless the Director authorizes a specific audit scope.

AUD recommends and the Director decides.

### DEV stays inside the DEV workspace

When a DEV workspace is active, DEV writes only inside `dev/`. The Director creates the workspace with `sigma dev create-workspace`; `sigma dev status` reports whether it is active, degraded, or not registered.

---

## Why Sigma?

Sigma suits work that should be:

- intent-driven,
- bounded,
- traceable,
- evidence-based,
- reviewable across sessions,
- coordinated across one or more AI tools.

It is especially useful for solo builders, small teams, AI-assisted software projects, prototypes that still need discipline, MVPs, internal tools, and projects that use several AI vendors.

With one vendor, Sigma provides role discipline and artifact separation. With several vendors, it provides a shared governance layer so every AI tool operates under the same roles, gates, and evidence rules.

---

## When Not To Use Sigma

Sigma is built for small-to-medium projects with a single Director authority. It should not be the only governance layer for:

- safety-critical systems,
- regulated delivery,
- medical, aviation, or financial compliance workflows,
- large enterprise projects that require formal change boards,
- projects that require certification-grade audit evidence,
- fully automated pipelines with no human governance gate.

For high-stakes or regulated work, add the compliance framework that applies.

---

## AI Tool Targets

Sigma deploys role skill files to supported AI environments when their expected directories are detected.

- Claude Code
- Codex CLI
- Reasonix
- Antigravity
- opencode — role commands in `~/.config/opencode/commands/` (`/arc`, `/fmn`, `/dev`, `/aud`, and others) and a `protect-sigma.js` plugin in `~/.config/opencode/plugins/` that blocks direct edits to `Sigma/progress-v<N>.json`. It is detected by `~/.config/opencode/`; `XDG_CONFIG_HOME` is not consulted.

Bridge guidance may also be provided for Claude Desktop, Gemini CLI, or other tools, depending on setup support.

---

## Sigma MCP — Query and Control Servers

Sigma ships a read-only [MCP](https://modelcontextprotocol.io) server, `sigma-mcp`, next to the `sigma` CLI. It exposes the same orientation data that commands such as `sigma session bootstrap` print, as structured JSON that an MCP-aware client can call directly.

`sigma-mcp` cannot lock, supersede, close, or mutate `Sigma/progress-v<N>.json`. A separate `sigma-control` server provides bounded writes through the same use cases as the CLI. Governance transitions need a durable Director approval recorded through the local `sigma control` CLI, and an MCP tool cannot grant its own approval.

### Tools

The query server registers 33 tools:

| Tool | Returns |
|:--- | :--- |
| `sigma_get_state` | Project phase, active chain, schema version, gate status |
| `sigma_get_gates` | Gate 1/2/3 open or satisfied status and labels |
| `sigma_get_orientation` | Role hint, gate summary, next valid operations, blockers, compatibility warnings, `version_status` |
| `sigma_list_artifacts` | Intent, plan, exec, close, and roadmap tracker state |
| `sigma_doctor` | Reconciliation findings; report-only, never writes to disk |
| `sigma_get_memory` | Role memory reminders |
| `sigma_verify_binding` | Verified project identity and root binding |
| `sigma_get_effective_policy` | Operation availability and approval requirements; advisory, not authorization |
| `sigma_read_artifact` | Governance document content selected by type and version |
| `sigma_get_evidence` | Plan and exec status, references, and registered document hash |
| `sigma_check_document` | Structural and eligibility checks; optional quoted PLAN sources |
| `sigma_preview_clone` | Source-bound and template-bound clone preview and diff |
| `sigma_get_audit_pack` | Audit snapshot, original responses, integrity and stale status |
| `sigma_list_decisions` | Substantive questions, kept separate from control tickets |
| `sigma_intent_status` | Intent state |
| `sigma_plan_status` | Plan states and plan/exec pairing |
| `sigma_exec_status` | Execution states and plan references |
| `sigma_close_status` | Closure state |
| `sigma_list_intents` | Intent chains |
| `sigma_list_plans` | Plans and pending drafts |
| `sigma_list_execs` | Execution versions |
| `sigma_list_roadmap_stages` | Roadmap stages and plans |
| `sigma_check_mailbox_integrity` | Mailbox integrity findings, without message content |
| `sigma_get_config` | Project configuration |
| `sigma_get_operation_log` | Bounded operation log entries |
| `sigma_get_git_evidence` | Git status and change evidence |
| `sigma_review_check` | PRODUCT REVIEW structure and verdict state; never creates the review |
| `sigma_close_check` | Whether a CLOSE can be created (Gate 3 and PRODUCT REVIEW verdicts) before one exists; not a check of an existing CLOSE document |
| `sigma_dev_status` | DEV workspace state: INACTIVE, ACTIVE, or ACTIVE_DEGRADED |
| `sigma_notes_list` | Registered notes with the same warnings as `sigma notes list` |
| `sigma_intent_baseline_check` | Whether the INTENT in Git is the latest certified content; reads Git, adopts nothing |
| `sigma_intent_amendment_preview` | Review package for an amendment: baseline check, diff, hash to approve, impact |
| `sigma_plan_revise_check` | Evaluation of a staged PLAN revision; issues no ticket (that is `sigma plan revise ticket`) |

The control server registers 42 tools, including the clone, audit, and substantive-question tools, `sigma_create_note` (the equivalent of `sigma notes new`: one step, attributed to the bound role, no Director approval needed for a note), `sigma_create_review` (the equivalent of `sigma review new`: ARC only, one file, records no verdict), and the FMN-only PLAN revision trio `sigma_prepare_plan_revision`, `sigma_issue_plan_revision_ticket`, and `sigma_commit_plan_revision`. The trio mirrors `sigma plan revise prepare|ticket|commit`: a Director approval is required only for a loosening or the `director` checkpoint, approval itself stays on the trusted local CLI, and the staged candidate is edited as a file. Governance transitions keep prepare and commit approval flows, and retired lock tool names remain as tombstones.

Sending messages and reading inbox or memo content stay CLI and skill operations. The MCP tools for mailbox integrity and inbox archiving do not expose message content.

### Control server

`sigma-control` needs an explicit startup binding with `--project-root`, `--project-id`, and `--role` (`ARC`, `FMN`, `DEV`, or `AUD`). Setup commands register only the query server, so control access is configured separately. Writes enforce role, state revision, idempotency, project locking, transaction recovery, and audit recording.

For a governance transition, the role prepares an operation ticket. The Director reviews it with `sigma control show <ticketId>` and authorizes it with `sigma control approve <ticketId> --director-confirm`. The role then commits the approved operation. A stale, expired, rejected, or consumed approval cannot authorize a new transition.

### Enabling it

`sigma-mcp` is installed as a bin entry next to `sigma` (see [Install Sigma](#1-install-sigma)), so no separate install step is needed.

**Registration is automatic.** `sigma project start` and `sigma project sync` write the client config for your AI tools as part of project setup.

Project entries bind the query server with `--mode query --project-root <root> --project-id <id>`. Legacy positional-root configurations remain supported. Global entries without a project start in discovery mode.

| Command | Config written | Platforms |
|:--- |:--- |:--- |
| `sigma setup install` / `sigma setup update` | `~/.codex/config.toml` · `~/.gemini/config/mcp_config.json` | Codex CLI · Antigravity |
| `sigma project start` / `sigma project sync` | `.mcp.json` · `opencode.jsonc` or `opencode.json` | Claude Code · Reasonix · opencode |

All writes are merge-aware. MCP server entries added manually are preserved and only the `sigma` key is upserted, so running the commands twice is safe. The opencode config may contain comments and trailing commas (JSONC); they are preserved, and `opencode.jsonc` is used when it exists. A file that cannot be parsed is never overwritten. Sigma prints the entry to add by hand instead.

If `sigma-mcp` is not on your `PATH` when these commands run, a warning is printed and the config is still written. It works as soon as the global install is complete.

> **Uninstall note:** `sigma setup uninstall --confirm` removes the `sigma` entry from the two global config files, `~/.codex/config.toml` and `~/.gemini/config/mcp_config.json`. The project-local `.mcp.json` and `opencode.json` or `opencode.jsonc` are not touched. Remove the `sigma` entry there manually when Sigma is no longer needed.

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

**opencode** — `opencode.json` (or `opencode.jsonc`) at project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sigma": { "type": "local", "command": ["sigma-mcp"], "enabled": true }
  }
}
```

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

These are practical starting points and not product claims. Model capabilities change over time, so use the model that performs best in your environment.

| Model | Recommended Roles | Reason |
|:--- |:--- |:--- |
| Gemini | ARC / FMN | Often useful for long-context strategy and intent refinement |
| ChatGPT | ARC / AUD | Good for structured reasoning, consulting, and critique |
| Perplexity | AUD | Good for document verification and cross-referencing |
| Codex | FMN / DEV | Good at planning synthesis before implementation and at code review |
| Claude | FMN / DEV | Strong for coding and work planning synthesis |
| Deepseek | FMN / DEV | Solid technical implementation quality at low API cost |

---

## Command Reference for AI Operators and Advanced Users

Most users do not need these commands. AI roles run operational commands after reading project state, role rules, and Director instructions. Approval, supersession, reconstruct, stale-intent acknowledgment, and risk-related commands need explicit Director authorization.

`sigma --help` and `sigma <domain> --help` are authoritative for exact syntax.

| Domain | Command | Description |
|:--- |:--- |:--- |
| project | `sigma project start [--init-git]` | Initialize a Sigma project; optionally initialize local Git when none exists |
| project | `sigma project status` | Show lifecycle phase, gate status, and active artifact versions |
| project | `sigma project sync` | Preview per-file differences between installed assets and this project |
| project | `sigma project sync --confirm` | Copy missing files; differing files need an exact `--accept` token and are backed up |
| project | `sigma project register` | Repair or backfill `.sigma-identity.json` at the project root (not a global registry) |
| session | `sigma session bootstrap` | Load project state at session start |
| intent | `sigma intent new` | Create an `INTENT` draft |
| intent | `sigma intent clone` | Preview a new `INTENT` draft from a registered source; `--confirm` with the preview token creates it |
| intent | `sigma intent ratify` | Ratify the active `INTENT` with Director approval |
| intent | `sigma intent baseline check` | Verify that the `INTENT` in Git is the latest certified content (read-only) |
| intent | `sigma intent baseline adopt` | Bind the certified `INTENT` to a Git commit and local tag (Director-confirmed) |
| intent | `sigma intent amendment preview` | Show the diff against the Git baseline, the hash to approve, and the impact on `PLAN` and `EXEC` (read-only) |
| intent | `sigma intent amendment` | Record a Director-approved amendment from a verified Git commit; creates a tag |
| intent | `sigma intent check` | Validate `INTENT` structure and report lock readiness (read-only) |
| intent | `sigma intent status` | Show active intent version and state |
| intent | `sigma intent list` | List intent versions |
| intent | `sigma intent activate --v <ver>` | Switch which chain is active (analog of `git checkout <branch>`) |
| intent | `sigma intent supersede` | Supersede a RATIFIED chain and cascade to its artifacts (`--director-confirm`) |
| roadmap | `sigma roadmap new` | Create the chain's `ROADMAP` draft (needs a ratified `INTENT`; one per chain) |
| roadmap | `sigma roadmap check` | Validate the chain's `ROADMAP` structure and markers |
| roadmap | `sigma roadmap render` | Regenerate the Stage Overview table in the chain's `ROADMAP` |
| roadmap | `sigma roadmap list` | List stages in the chain's `ROADMAP` with title, focus, and plan status |
| plan | `sigma plan new` | Create a `PLAN` draft (needs a ratified `INTENT` and an existing `ROADMAP`) |
| plan | `sigma plan new --pending` | Stage a future plan without entering the version queue |
| plan | `sigma plan promote` | Promote a pending plan into the official draft queue |
| plan | `sigma plan clone` | Preview a new `PLAN` draft from a registered source; `--confirm` with the preview token creates it |
| plan | `sigma plan approve [--v <ver>] [--director-confirm]` | Preview or approve an exact `PLAN` and its dependencies; confirmation needs Director authorization |
| plan | `sigma plan check [--v <ver>] [--sources]` | Validate `PLAN` structure and report approval readiness (read-only); `--v` is required when ambiguous |
| plan | `sigma plan revise prepare\|check\|ticket\|commit` | FMN stages, checks, and commits a controlled revision of an APPROVED `PLAN`; `ticket --v <ver>` freezes the review into a Director approval ticket (`check --prepare-ticket` is a deprecated alias) |
| plan | `sigma plan status` | Show DRAFT, APPROVED, and LOCKED plans, exec pairing, pending plans, Gate 2 |
| plan | `sigma plan list` | List plan versions |
| plan | `sigma plan update --v <ver>` | Update stage title or focus for an existing plan (`--title`, `--focus`) |
| plan | `sigma plan supersede --v <ver>` | Supersede a DRAFT, APPROVED, or LOCKED plan; cascades to any linked non-final `EXEC` |
| exec | `sigma exec new [--plan <ver>]` | Create an `EXEC` draft for an eligible `PLAN` with no open `EXEC` (one `EXEC` per `PLAN`) |
| exec | `sigma exec approve [--v <ver>] [--director-confirm]` | Preview or approve an `EXEC`; paired lifecycle locks `PLAN` and `EXEC` together |
| exec | `sigma exec acknowledge-plan --v <ver> --revision <n>` | DEV acknowledges the latest `PLAN` revision; grants no coding authority |
| exec | `sigma exec check [--v <ver>]` | Validate `EXEC` structure and report approval readiness (read-only) |
| exec | `sigma exec status` | Show open DRAFTs with plan pairing, LOCKED execs, Gate 3 |
| exec | `sigma exec list` | List execution versions |
| review | `sigma review new` | Create the chain's `PRODUCT REVIEW` (needs a ratified `INTENT`; one per `INTENT`) |
| review | `sigma review check` | Validate `PRODUCT REVIEW` structure and report whether its verdicts permit closure (read-only) |
| close | `sigma close new` | Create a `CLOSE` draft (Gate 3 and an accepted `PRODUCT REVIEW`) |
| close | `sigma close lock` | Lock the active `CLOSE` with Director approval; a stamp with no content gate, but nothing may be left open (Gate 3) |
| close | `sigma close check` | Report whether a `CLOSE` can be created: Gate 3 and the `PRODUCT REVIEW` verdicts (read-only) |
| close | `sigma close status` | Show closure state |
| dev | `sigma dev create-workspace` | Create the DEV workspace `dev/` (only on explicit Director instruction) |
| dev | `sigma dev status` | Show whether the DEV workspace is active, degraded, or not registered (read-only) |
| config | `sigma config` | Interactive wizard for all three language preferences |
| config | `sigma config show` | Show current project configuration |
| config | `sigma config set language <name> --interaction\|--sigma-document\|--output-document` | Set one language preference (free-form name, for example `English` or `Indonesia`) |
| config | `sigma config set mailbox-outdate-keep <n>` | How many recent READ messages `sigma inbox read` keeps before aging the rest to OUTDATED (`0` disables; default `5`) |
| config | `sigma config set memo-limit <n>` | Maximum unread memos per INTENT and role before `sigma memo write` is blocked (`0` disables memo; default `5`) |
| send | `sigma send --from <role> --to <role> --related-artifact <ref> --message <text>` | Send a message between roles; `--related-artifact` names the registered artifact or `GENERAL` |
| inbox | `sigma inbox --role <role>` | List UNREAD messages for the active `INTENT` plus `GENERAL` |
| inbox | `sigma inbox --role <role> --all` | List UNREAD, READ, and ARCHIVED messages (excludes OUTDATED) |
| inbox | `sigma inbox --role <role> --outdated` | List only OUTDATED messages |
| inbox | `sigma inbox read <id>` | Read a message and mark it READ; surplus READ messages age to OUTDATED |
| inbox | `sigma inbox archive <id>` | Archive a message |
| inbox | `sigma inbox clear --role <role> [--keep 5] [--dry-run]` | Age surplus READ messages to OUTDATED; files are retained |
| inbox | `sigma inbox clear --all-roles --director-confirm` | The same, across every messaging role |
| inbox | `sigma inbox check` | Run the inbox integrity check |
| memo | `sigma memo write --role <role> --ref <ref> --topic "<sentence>" --message "..."` | Write a self-addressed operational brief (`--ref`: `INTENT-vN`, `PLAN-vN.M`, `EXEC-vN.M`, or `GENERAL`) |
| memo | `sigma memo list --role <role> [--all]` | List memos for a role, oldest first (default: unread only) |
| memo | `sigma memo read <id>` | Read a memo and mark it READ, freeing one quota slot |
| memo | `sigma memo clear` | Age surplus READ memos to OUTDATED; files are retained |
| git | `sigma git evidence` | Show a read-only Git state summary |
| memory | `sigma memory --<role>` | Show role activation memory reminders for arc, fmn, dev, aud (read-only) |
| reference | `sigma reference update` | Rebuild the project-wide reference list |
| notes | `sigma notes new --title <title> [--role <role>]` | Create a registered note in `Sigma/notes/note-list/` and refresh `note-list.md`; the only way to register a note |
| notes | `sigma notes list [--search <kw>]` | List registered notes, newest first (read-only) |
| notes | `sigma notes update [--dry-run]` | Refuse non-Markdown files under `Sigma/notes/`, move unregistered Markdown to `unregistered-notes/`, regenerate `note-list.md`; run only on the Director's instruction |
| notes | `sigma notes update --rebuild-registry [--director-confirm]` | Restore a missing or unreadable `Sigma/notes-registry.json` from `note-list.md` (preview unless confirmed) |
| audit | `sigma audit new\|show\|record` | Build audit snapshots and record original AUD responses (see below) |
| decisions | `sigma decisions list\|add\|resolve\|assess\|target` | Substantive questions and advisory assessments (see below) |
| control | `sigma control show\|approve\|reject <ticketId>` | Trusted local Director surface for `sigma-control` operation tickets |
| report | `sigma report logs` | View the operation history log with filters (read-only) |
| scan | `sigma scan --file <path>` | Scan a file for Sigma terminology before sharing it externally (read-only) |
| override | `sigma override --reason <text> --director-confirm` | Bypass the current lifecycle gate under Director authority; recorded in the audit log |
| doctor | `sigma doctor` | Diagnose and reconcile runtime state; repairs drift and marks unresolved breaks INVALID |
| doctor | `sigma doctor --check-assets` | Compare master, installed, and project assets, and report version status, without writing |
| doctor | `sigma doctor --reconstruct [--v <ver>]` | Rebuild `progress-v<N>.json` from artifact files when missing or corrupted |
| doctor | `sigma doctor --migrate-lifecycle --director-confirm` | Convert one chain from the legacy lock model to paired approval (`--dry-run` previews) |
| doctor | `sigma doctor --migrate-mailbox [--dry-run]` | Isolate v1 messages and memos into `LEGACY` (one-time; refuses when a message file is missing from the index). Sigma v2 operations never read, list, or report `LEGACY`; open those files directly |
| doctor | `sigma doctor --migrate-mailbox --adopt-orphans [--dry-run] [--director-confirm]` | First register such files as READ entries when their metadata parses fully, then migrate; the real run needs `--director-confirm` |
| doctor | `sigma doctor --repair-workspace` | Recreate a missing DEV workspace folder or marker |
| setup | `sigma setup install` | Install Sigma globally to `~/.sigma/` and deploy skill files and the hook |
| setup | `sigma setup update` | Update global templates and governance, and redeploy skill files and the hook |
| setup | `sigma setup uninstall --confirm` | Remove `~/.sigma/`, deployed skill files, and the hook entry (global only) |

---

## Updating Sigma — Backward Compatibility for Existing Projects

After `sigma-ecosystem` is updated, an existing project may need to be synchronized to stay compatible with the new schema and doctrine files.

### When to run the update

Run it after:

- `npm update -g sigma-ecosystem` installs a new version,
- a command prints an "outdated" line (see below),
- `sigma session bootstrap` reports a schema mismatch or unknown field warning,
- a governance role reports an unexpected gate error on an existing project.

### Update sequence

Run these steps in order for each registered project:

```bash
# 1. Update global templates and governance files
sigma setup update

# 2. Go to your project
cd your-project

# 3. Preview per-file differences and note the exact tokens for replacements
sigma project sync

# 4. Apply missing files; add --accept <token> for each approved replacement
sigma project sync --confirm

# 5. Verify project state
sigma session bootstrap
```

### What each command does

| Command | What it updates |
|:--- |:--- |
| `sigma setup update` | Updates global `~/.sigma/` templates and governance files and records the installed version in `sigma.config.json` |
| `sigma project sync` | Previews managed files with source and target hashes and shows an acceptance token for each difference |
| `sigma project sync --confirm` | Copies missing files and approved replacements and backs up previous bytes before replacement. It creates an empty product `CHANGE-RECORD.md` only when neither `CHANGE-RECORD.md` nor `dev/CHANGE-RECORD.md` exists. It records the applied version in `.sigma-identity.json` when every managed file then matches its source |
| `sigma session bootstrap` | Verifies project state after the update |

### Version stamp and the "outdated" warning

Sigma records which assets each layer was last made identical to:

| Layer | Where | Written by |
|:--- |:--- |:--- |
| Global installation | `~/.sigma/sigma.config.json` (`cli_version`, `assets_hash`, `synced_at`) | `sigma setup install` / `sigma setup update` |
| Project | `.sigma-identity.json` (`sigma_applied`: `sigma_version`, `assets_hash`, `synced_at`) | `sigma project start` / `register` / `sync --confirm` |

A stamp is written only when every managed file on that layer matches its source, so it never claims a state that was not reached. It records the last sync. Edits made afterwards are not detected by the warning, and `sigma doctor --check-assets` lists them.

Inside a project, every command except `setup`, `doctor`, `project start|register|sync`, and `session bootstrap` prints one line to stderr when a layer is behind:

| Situation | Next step |
|:--- |:--- |
| `~/.sigma` is behind the installed CLI, or has no stamp | `sigma setup update` |
| The project is behind `~/.sigma`, or has no stamp | `sigma project sync`, then `sigma project sync --confirm` |

The global installation is reported first, because syncing a project from an outdated `~/.sigma` would copy outdated files into it. `sigma session bootstrap` and the MCP `sigma_get_orientation` include the same message in their compatibility warnings, and orientation also returns a structured `version_status`. A project created before this feature has no stamp. One `sigma project sync --confirm` records it once the files match.

> **No automatic legacy schema or ROADMAP migration.** Projects with a pre-current `progress.json` schema (legacy `BUILDING`/`TESTING`/`COMPLETED` exec states, a leftover root-level `cso` array) or a freeform ROADMAP (no H2 stage convention) have no CLI migration path. `sigma sync progress` and `sigma sync roadmap` were removed as trivial and redundant. This is an accepted risk, and such projects need manual schema and document adjustment.

### What is preserved

Update commands never modify:

- locked artifacts (`INTENT`, `PLAN`, `EXEC`, `CLOSE`, including files created under the earlier prefixed names),
- `Sigma/progress-v<N>.json` gate and lock decisions,
- `.sigma-identity.json` project identity, apart from adding or refreshing its `sigma_applied` version stamp; `sigma setup uninstall` does not touch it,
- `Sigma/logs/`, including legacy CSO handoff files if present (CSO was removed from current Sigma),
- anything inside `Sigma/contract/`, `Sigma/roadmap/`, `Sigma/evidence/`, `Sigma/charter/`, and `Sigma/close/`.

Update commands change only schema wrappers, doctrine files, and template structure. Director decisions and locked evidence stay as they are.

### Removing Sigma — `sigma setup uninstall`

```bash
sigma setup uninstall          # dry run — lists what would be removed
sigma setup uninstall --confirm
```

This removes the global installation only: `~/.sigma/` (templates, rules, governance, bridge, `sigma.config.json`), role skill files deployed to detected AI tool directories, and the `protect-sigma.js` hook entry in `~/.claude/settings.json`. The hook entry is removed surgically, and the rest of the file is untouched.

Uninstall never resolves a project-local path. No `Sigma/` folder, `.sigma-identity.json`, or bridge file in any project is touched, whichever directory the command runs from. The `sigma` command stops working until Sigma is reinstalled.

---

## State Integrity

Sigma governance truth remains in:

```text
Sigma/progress-v<N>.json   (one per chain)
Sigma artifacts
Sigma/memory/overrides.jsonl
```

State-changing commands validate the target chain's `Sigma/progress-v<N>.json` before they mutate runtime state. If the file is structurally valid but internally contradictory, the CLI blocks the mutation and names the affected field with recovery guidance.

Read-only status commands are the safest first step when recovery is needed:

```bash
sigma session bootstrap
```

---

## Governance Protocol

The full specification is in:

```text
Sigma/SIGMA_PROTOCOL.md
```

`sigma project start` writes this file into your project. The protocol covers lifecycle phases, artifact types, gates, role doctrine, the CLI operator model, Director authorization language, messaging, and distribution. The constitutional charter above it is `Sigma/SIGMA_CONSTITUTION.md`.

---

## Source review, draft reuse, and audit records

`sigma plan check --sources --v v1.1` shows quoted `INTENT` references, source certification, and advisory semantic readiness as separate results. A found ID or an eligible structural check does not establish scope alignment. FMN may record an assessment with `sigma decisions assess`. Changing the `PLAN` or the `INTENT` invalidates that assessment.

An `INTENT` or `PLAN` can start from registered source content with a fresh identity:

```bash
sigma plan clone --from-chain v1 --from v1.1 --title "Revised stage" --focus "Revised output"
# Review the returned diff, reset sections, activation effects and preview_token.
sigma plan clone --from-chain v1 --from v1.1 --title "Revised stage" --focus "Revised output" --confirm --preview-token "<preview_token>"
```

`sigma intent clone` follows the same preview and confirm pattern and creates and activates a new `INTENT` chain. A CLOSED chain needs `--yes` on both preview and confirmation. Sources remain unchanged. Cloning supports `INTENT` schema 5 or 6 into the current schema 6 template, and `PLAN` schema 3 to 3. Older or unmapped schemas are refused and need manual drafting. Summaries, source alignment, audit verdicts, approvals, revision history, and checked boxes are reset, and retained obligations still need substantive review. Superseding and approval remain separate operations.

Audit and decision commands:

| Command | Behavior |
|:--- |:--- |
| `sigma decisions target --type plan --v v1.1` | Read a registered target identity and hash |
| `sigma audit new --type plan --v v1.1 --target-sha256 <hash>` | Snapshot the target and the available registered sources |
| `sigma audit show <id> --markdown` | Render the pack for manual handoff and report missing or stale sources |
| `sigma audit record <id> --text <original-response> --origin <source> --pack-sha256 <hash>` | Preserve the original AUD response and its declared origin |
| `sigma decisions add --type plan --v v1.1 --question <text> --role FMN --target-sha256 <hash>` | Record a substantive question against current content |
| `sigma decisions list [--chain v1] [--history]` | List questions separately from pending control transactions |
| `sigma decisions resolve <id> --answer <text> --target-sha256 <hash> --director-confirm` | Trusted local Director answer; does not approve an artifact |
| `sigma decisions assess --v v1.1 --status SCOPE_GAP --reason <text> --target-sha256 <plan-hash> --source-sha256 <intent-hash>` | Explicit advisory FMN readiness, tied to both sources |

For `EXEC` audit targets, `audit new --include-evidence` can also snapshot registered text evidence whose current hash matches its citation. Each evidence file is limited to 512 KiB. Binary, changed, missing, or unselected evidence is listed as not included. Packs detect changed artifact and evidence hashes and project state, and response recording refuses stale packs. No command sends material to another role or vendor automatically, and none extracts an authoritative verdict from response text.

Internal records live in `Sigma/logs/f08.json`, which the CLI and MCP manage (16 MiB limit, no automatic pruning). Do not edit it manually. Original responses and snapshots are preserved, and a self-declared external response origin carries no authenticity claim. These records never replace artifact approval, certification, or the revision ledger.

The query plane adds `sigma_preview_clone`, `sigma_get_audit_pack`, and `sigma_list_decisions`, and `sigma_check_document` accepts `sources: true` for a `PLAN`. The control plane adds `sigma_clone_draft`, `sigma_create_audit_pack`, `sigma_record_audit_response`, `sigma_add_decision`, and `sigma_record_readiness`, with role, expected-state, target and hash, idempotency, and transaction checks. Director decision resolution stays on the local CLI.

---

## Dev Tools (sigma-ecosystem contributors only)

These tools maintain the sigma-ecosystem source repository. They are not part of the user-facing CLI and are not distributed to end-user projects.

### `scripts/refresh-registries.js`

Keeps `Sigma/SIGMA-OPERATION-REGISTRY.json` and `Sigma/SIGMA-REGISTRY.json` in step with the CLI implementation after commands are added.

It works in these steps:

1. Load the compiled CLI from `dist/commands/` (needs `npm run build` first).
2. Walk the Commander.js command tree to discover every executable operation.
3. Diff the discovered operations against the registry.
4. Inject stubs marked `NEEDS_REVIEW: true` for operations not yet registered.
5. Flag registry entries that no longer exist in the CLI.
6. Add known new document types to `SIGMA-REGISTRY.json`.

The script aborts when run outside the `sigma-ecosystem` root, which it checks through the `package.json` name.

```bash
# Preview — no writes
npm run refresh-registries:dry

# Apply
npm run refresh-registries
```

After it runs, fill in `gating`, `constraints`, and `outputs` for every entry marked `NEEDS_REVIEW: true` in `SIGMA-OPERATION-REGISTRY.json`. Add the new operation to the MCP policy table in `src/mcp/policy.ts` as well.

Run it:

- after adding a new `sigma <command>` subcommand,
- after removing or renaming a command,
- after adding a new document type to the `Sigma/` folder structure.

---

## Summary

Sigma Ecosystem is for people who use AI coding agents and want to keep control of the project.

```text
You give intent.
AI roles operate.
Sigma CLI enforces gates.
Artifacts preserve proof.
You decide.
```
