# Sigma

Sigma is a lightweight governance protocol and CLI for AI-assisted software projects.

It helps humans use AI coding agents without losing control of intent, scope, evidence, and closure.

Sigma turns AI-assisted work into a traceable lifecycle:

```text
DIR-INTENT → optional ROADMAP → FMN-PLAN → DEV-EXEC → DIR-CLOSE
```

Sigma is not an autonomous agent swarm. It is an AI-operated governance layer under human authority.

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

Sigma addresses this by giving AI roles a shared workflow, shared artifacts, and clear authority boundaries.

```text
Director gives intent and approval.
AI roles operate the workflow.
Sigma CLI enforces gates.
Artifacts preserve evidence.
```

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
│ Optional ROADMAP   │
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
sigma setup memory
sigma setup memory --vscode
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

Use Director utility shortcuts whenever you need situational awareness or handoff:

```text
/report
Give me a quick status briefing.
```

```text
/checkpoint
Save the current context before we continue.
```

```text
/cso
Create a formal handoff summary for the next session.
```

---

## Director Utility Shortcuts

These shortcuts are intentionally typed by the Director.

They are not role-switching commands in the same way as `/arc`, `/fmn`, `/dev`, or `/aud`. They exist to help the Director stay oriented, preserve context, and hand off work between sessions.

| Shortcut      | Use It When                                                                   | What It Produces                 | Role Impact                |
|:------------- |:----------------------------------------------------------------------------- |:-------------------------------- |:-------------------------- |
| `/report`     | You want to know the latest state, decisions, risks, and next move            | Short chat-only briefing         | No role switch             |
| `/checkpoint` | You are mid-session and want to save the current context before continuing    | Quick CSO file in `Sigma/logs/`  | No role switch             |
| `/cso`        | You are ending a session, changing context, or preparing a deliberate handoff | Formal CSO file in `Sigma/logs/` | Activates CSO Handler role |

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

### `/checkpoint` — save the moment

Use `/checkpoint` during an active role session when you have reached a useful pause point.

Good moments to use `/checkpoint`:

- after a major decision,
- after finishing a planning block,
- before switching topic,
- before a long break,
- before the context window gets too large,
- before asking another role to continue later.

`/checkpoint` creates a quick CSO file in `Sigma/logs/`, then returns to the current role.

Example:

```text
/checkpoint
```

If you were working as FMN, you are still FMN after the checkpoint.

Control sentence:

```text
/checkpoint preserves context.
```

### `/cso` — create a formal handoff

Use `/cso` when you want a more deliberate handoff document.

Good moments to use `/cso`:

- at the end of a session,
- before handing work to another AI role,
- before handing work to another AI vendor,
- before pausing a project for several days,
- when you want a cleaner handoff than a quick checkpoint.

Unlike `/checkpoint`, `/cso` activates the CSO Handler role for the session.

Control sentence:

```text
/cso transfers context.
```

### Recommended habit

Use these three shortcuts often:

```text
/report      → when you need orientation
/checkpoint  → when you want to preserve progress without stopping
/cso         → when you want a formal handoff
```

They are small commands, but they are important. They prevent context loss, reduce confusion, and make AI-assisted work easier to resume.

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

## Operating Model

| Actor     | Responsibility                                                               |
|:--------- |:---------------------------------------------------------------------------- |
| Director  | Gives intent, approves locks, accepts or rejects risk, decides closure       |
| AI Roles  | Read artifacts, run operational CLI commands, draft documents, surface risks |
| Sigma CLI | Enforces gates, updates runtime state, records decisions                     |
| Artifacts | Preserve meaning, evidence, decisions, and audit trail                       |

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

## Roles

| Role            | Shortcut      | Responsibility                                                                |
|:--------------- |:------------- |:----------------------------------------------------------------------------- |
| ARC — Architect | `/arc`        | Helps create and refine `DIR-INTENT`                                          |
| FMN — Foreman   | `/fmn`        | Creates `ROADMAP` or `FMN-PLAN`; defines build and test contracts             |
| DEV — Developer | `/dev`        | Implements the locked plan and records evidence in `DEV-EXEC`                 |
| AUD — Auditor   | `/aud`        | Passive external auditor; reviews provided evidence; advisory only            |
| REPORT          | `/report`     | Short chat-only Director briefing: current state, decisions, risks, next move |
| CHECKPOINT      | `/checkpoint` | Quick CSO capture that preserves context without switching role               |
| CSO Handler     | `/cso`        | Formal CSO handoff for session transfer or role/vendor handoff                |

Role skill files are deployed by:

```bash
sigma setup install
```

Supported targets include Claude Code, Codex CLI, Reasonix, and Antigravity when their expected directories are detected.

---

## Important Role Boundaries

### Role immutability

A Sigma governance role does not switch roles inside the same session.

If a session is active as FMN, it should not become DEV or AUD in the same session.

Use a fresh session or invoke the new role separately.

`/checkpoint` and `/report` are utility skills. They do not switch the active role.

### AUD is passive by default

AUD is an external auditor role.

AUD reviews submitted evidence or files explicitly provided or authorized by the Director.

AUD does not roam the repository, scan unrelated files, inspect local state, or run Sigma CLI unless the Director explicitly authorizes a specific audit scope.

AUD recommends. Director decides.

---

## Artifacts

| Artifact     | Purpose                                                              |
|:------------ |:-------------------------------------------------------------------- |
| `DIR-INTENT` | Director objective, scope, constraints, and success definition       |
| `ROADMAP`    | Optional stage map for larger work                                   |
| `FMN-PLAN`   | Build contract and test contract                                     |
| `DEV-EXEC`   | Implementation report, verification, Git Diff Evidence, known issues |
| `DIR-CLOSE`  | Closure summary, evidence, accepted limitations                      |
| `CSO`        | Context handoff object stored in `Sigma/logs/`                       |

Sigma artifact versions are governance identifiers.

They are not product release versions.

For example, `FMN-PLAN-v0.2` does not mean the product is version `0.2.0`.

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

## Command Reference for AI Operators and Advanced Users

Most users do not need to memorize these commands.

AI roles normally execute operational commands after reading project state, role rules, and Director instructions.

Lock, supersede, reset, stale-intent acknowledgment, and risk-related commands require explicit Director authorization.

| Domain  | Command                         | Description                                                     |
|:------- |:------------------------------- |:--------------------------------------------------------------- |
| project | `sigma project start`           | Initialize a Sigma project in the current directory             |
| project | `sigma project status`          | Show lifecycle phase, gate status, and active artifact versions |
| project | `sigma project list`            | List registered Sigma projects                                  |
| project | `sigma project sync --confirm`  | Sync doctrine files from global templates into this project     |
| project | `sigma project reset --confirm` | Reset `progress.json` to initial state                          |
| session | `sigma session bootstrap`       | Load project state at session start                             |
| intent  | `sigma intent new`              | Create a `DIR-INTENT` draft                                     |
| intent  | `sigma intent lock`             | Lock the active `DIR-INTENT` with Director approval             |
| intent  | `sigma intent status`           | Show active intent version and state                            |
| intent  | `sigma intent list`             | List intent versions                                            |
| roadmap | `sigma roadmap new`             | Create a `ROADMAP` draft                                        |
| roadmap | `sigma roadmap lock`            | Lock the active `ROADMAP` with Director approval                |
| roadmap | `sigma roadmap list`            | List roadmap versions                                           |
| plan    | `sigma plan new`                | Create an `FMN-PLAN` draft                                      |
| plan    | `sigma plan lock`               | Lock the active `FMN-PLAN` with Director approval               |
| plan    | `sigma plan audit`              | Run advisory audit of the active `FMN-PLAN`                     |
| plan    | `sigma plan status`             | Show active plan version and state                              |
| plan    | `sigma plan supersede`          | Supersede a locked plan version                                 |
| exec    | `sigma exec new`                | Create a `DEV-EXEC` draft                                       |
| exec    | `sigma exec advance building`   | Advance execution from DRAFT to BUILDING                        |
| exec    | `sigma exec advance testing`    | Advance execution from BUILDING to TESTING                      |
| exec    | `sigma exec advance complete`   | Advance execution from TESTING to COMPLETED                     |
| exec    | `sigma exec lock`               | Lock the active `DEV-EXEC` with Director approval               |
| exec    | `sigma exec audit`              | Run advisory audit of the active `DEV-EXEC`                     |
| exec    | `sigma exec status`             | Show active execution version and state                         |
| close   | `sigma close new`               | Create a `DIR-CLOSE` draft                                      |
| close   | `sigma close lock`              | Lock the active `DIR-CLOSE` with Director approval              |
| close   | `sigma close audit`             | Run advisory audit of the active `DIR-CLOSE`                    |
| close   | `sigma close status`            | Show closure state                                              |
| cso     | `sigma cso new`                 | Create a CSO handoff artifact in `Sigma/logs/`                  |
| git     | `sigma git evidence`            | Show read-only Git state summary                                |
| setup   | `sigma setup install`           | Install Sigma globally to `~/.sigma/`                           |
| setup   | `sigma setup update`            | Update global Sigma templates and governance files              |
| setup   | `sigma setup memory`            | Configure sequential-thinking and sigma-memory MCP integration  |

---

## Memory & MCP

Sigma may use MCP servers for reasoning and reusable ecosystem memory.

- `sequential-thinking` is a reasoning aid for complex planning, architecture, debugging, or audit reasoning.
- `sigma-memory` stores Sigma ecosystem-level knowledge.

Sequential-thinking does not create governance state, approval, or evidence.

Sigma governance truth remains in:

```text
Sigma/progress.json
Sigma artifacts
Sigma/memory/decisions.jsonl
```

Configure MCP integration:

```bash
sigma setup memory
```

Optional VS Code MCP config:

```bash
sigma setup memory --vscode
```

Optional Reasonix MCP config (writes to `~/.reasonix/config.json`, merged):

```bash
sigma setup memory --reasonix
```

Refresh ecosystem memory with fresh seed (e.g. after a CLI update):

```bash
sigma setup memory --reseed
```

Memory file:

```text
~/.sigma/memory_sigma.jsonl
```

Project decision log:

```text
Sigma/memory/decisions.jsonl
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

## Summary

Sigma is for humans who use AI coding agents but do not want to surrender project control.

```text
You give intent.
AI roles operate.
Sigma enforces gates.
Artifacts preserve proof.
You decide.
```
