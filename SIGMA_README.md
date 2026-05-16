# Sigma

Sigma is a lightweight governance protocol and CLI for AI-assisted software projects. It turns AI work into a traceable lifecycle:

`DIR-INTENT → ROADMAP → FMN-PLAN → DEV-EXEC → DIR-CLOSE`

It gives small-to-medium teams a structured, evidence-based workflow without the overhead of enterprise-grade process frameworks.

---

## Why Sigma?

Sigma is not an autonomous agent swarm. It is a governance layer.

Most AI-assisted development problems are not technical — they are governance problems: unclear intent that gets implemented literally, plans that drift from what was agreed, implementations that claim completion without evidence, and context that evaporates between sessions.

Sigma addresses these problems by:

- Requiring locked, versioned intent before planning begins
- Allowing optional ROADMAP staging before detailed plans when the project is too large for one build cycle
- Requiring a locked FMN-PLAN before implementation begins
- Requiring evidence before closure
- Keeping the Director in authority over all state transitions
- Making every AI role's scope explicit and bounded

The result is AI-assisted work that is bounded, traceable, and evidence-based — not a black box where something was done but nobody can explain what was agreed, why, or whether it was actually finished.

---

## When Not To Use Sigma

Sigma is a lightweight protocol designed for small-to-medium projects with a single Director authority.

Do not use Sigma as your primary governance layer for:

- Safety-critical or regulated delivery (medical, aviation, financial compliance) without additional review frameworks
- Large enterprise projects requiring formal change boards, sign-off chains, or audit trails beyond what Sigma provides
- Fully automated pipelines with no human Director authority at governance gates
- Projects where you need a heavyweight audit trail or certification evidence

For high-stakes regulated work, consider Delta or a purpose-built compliance framework alongside or instead of Sigma.

---

## Install

```bash
npm install -g sigma-cli
sigma setup install
```

`sigma setup install` creates `~/.sigma/` with templates, rules, governance docs, and bridge file templates, then deploys skill files to any detected AI tool directories (`~/.claude/commands/`, `~/.codex/skills/`, etc.).

---

## Quick Start

```bash
# Install Sigma once
npm install -g sigma-cli
sigma setup install

# Initialize a Sigma project once
sigma project start
```

After that, activate an AI role in your AI tool:

```
/arc  — create or refine DIR-INTENT
/fmn  — create ROADMAP or FMN-PLAN
/dev  — implement and prepare DEV-EXEC
/aud  — external/passive audit
/cso  — create handoff summary
```

In normal operation, let the AI role run Sigma CLI commands for you. Your job is to give intent, review decision points, and authorize lock and risk actions.

---

## How You Actually Use Sigma

Sigma is not designed for you to manually operate every lifecycle command.

In normal use:

1. You install Sigma and initialize a project.
2. You activate an AI role such as `/arc`, `/fmn`, `/dev`, or `/aud`.
3. The AI role runs operational Sigma CLI commands for you.
4. You make the authority decisions: approve, reject, lock, accept risk, supersede, or request revision.
5. Sigma CLI enforces gates and records runtime state.

You do not need to memorize the full command surface.

The command reference below exists so AI roles, advanced users, and maintainers can inspect what Sigma can do.

---

## Operating Model

| Actor | Responsibility |
| :--- | :--- |
| Director | Gives intent, approves locks, accepts/rejects risk, decides closure |
| AI Roles | Read artifacts, run operational CLI commands, draft documents, surface risks |
| Sigma CLI | Enforces gates, updates runtime state, records decisions |
| Artifacts | Preserve meaning, evidence, and audit trail |

---

## Roles

| Role | Activation | Responsibility |
| :--- | :--- | :--- |
| ARC — Architect | `/arc` skill or "You are my Architect" | Interviews Director, drafts DIR-INTENT; no downstream artifact authority |
| FMN — Foreman | `/fmn` skill or "You are my Foreman" | Drafts FMN-PLAN (work order + test contract); operates after INTENT locked |
| DEV — Developer | `/dev` skill or "You are my Developer" | Drafts DEV-EXEC (implementation + report); operates after PLAN locked |
| AUD — Auditor | `/aud` skill or "You are my Auditor" | Passive external auditor; reviews Director-provided evidence; advisory only |

AUD is passive by default. It audits submitted evidence, not the entire project. AUD does not scan files, inspect local state, or run Sigma CLI unless the Director explicitly authorizes a specific audit scope.

Role skill files are deployed to AI tool directories by `sigma setup install`.
Supported platforms: Claude Code (`~/.claude/commands/`), Codex CLI (`~/.codex/skills/`), Reasonix (`~/.reasonix/skills/`), Antigravity (`~/.gemini/agents/`).

---

## Command Reference for AI Operators and Advanced Users

Most users do not need to memorize these commands. AI roles normally execute operational commands after reading project state, role rules, and Director instructions.

Lock, supersede, reset, stale-intent acknowledgment, and risk-related commands require explicit Director authorization.

| Domain | Command | Description |
| :--- | :--- | :--- |
| project | `sigma project start` | Initialize a Sigma project in the current directory |
| project | `sigma project status` | Show lifecycle phase, gate status, and active artifact versions |
| project | `sigma project list` | List all registered Sigma projects |
| project | `sigma project sync --confirm` | Sync doctrine files from global templates into this project |
| project | `sigma project reset --confirm` | Reset progress.json to initial seed state |
| session | `sigma session bootstrap` | Load project state at session start |
| intent | `sigma intent new` | Create a DIR-INTENT DRAFT |
| intent | `sigma intent lock` | Lock the active DIR-INTENT (Director only) |
| intent | `sigma intent status` | Show active INTENT version and state |
| intent | `sigma intent list` | List all INTENT versions |
| plan | `sigma plan new` | Create an FMN-PLAN DRAFT (Gate 1: INTENT must be LOCKED) |
| plan | `sigma plan lock` | Lock the active FMN-PLAN (Director only) |
| plan | `sigma plan audit` | AUD advisory audit of the active FMN-PLAN |
| plan | `sigma plan status` | Show active PLAN version and state |
| plan | `sigma plan supersede` | Supersede a locked PLAN version |
| exec | `sigma exec new` | Create a DEV-EXEC DRAFT (Gate 2: PLAN must be LOCKED) |
| exec | `sigma exec lock` | Lock the active DEV-EXEC (Director only) |
| exec | `sigma exec audit` | AUD advisory audit of the active DEV-EXEC |
| exec | `sigma exec status` | Show active EXEC version and state |
| exec | `sigma exec advance building` | Advance EXEC from DRAFT to BUILDING |
| exec | `sigma exec advance testing` | Advance EXEC from BUILDING to TESTING |
| exec | `sigma exec advance complete` | Advance EXEC from TESTING to COMPLETED |
| close | `sigma close new` | Create a DIR-CLOSE DRAFT (Gate 3: full chain must be LOCKED) |
| close | `sigma close lock` | Lock the active DIR-CLOSE (Director only) |
| close | `sigma close audit` | AUD advisory audit of the active DIR-CLOSE |
| close | `sigma close status` | Show active CLOSE version and state |
| roadmap | `sigma roadmap new` | Create a ROADMAP DRAFT |
| roadmap | `sigma roadmap lock` | Lock the active ROADMAP (Director only) |
| roadmap | `sigma roadmap list` | List all ROADMAP versions |
| cso | `sigma cso new` | Create a CSO handoff artifact in Sigma/logs/ |
| git | `sigma git evidence` | Read-only Git state summary |
| setup | `sigma setup install` | Install Sigma globally to ~/.sigma/ |
| setup | `sigma setup update` | Update ~/.sigma/ templates and governance files |
| setup | `sigma setup memory` | Configure sequential-thinking + sigma-memory MCP integration |

---

## Governance Protocol

Full specification: `Sigma/SIGMA_PROTOCOL.md` (written to your project by `sigma project start`)

The protocol covers: lifecycle phases, artifact types, gate conditions, role definitions, CLI operator model, Director authorization language, memory architecture, and distribution specification.

---

## Memory & MCP

Sigma uses two MCP servers for AI memory and reasoning:

- **sequential-thinking** — structured multi-step reasoning for planning and architecture review
- **sigma-memory** — persistent knowledge graph for Sigma ecosystem constants

Sequential-thinking is a reasoning aid only. It does not create governance state, approval, or evidence. Sigma governance truth remains in `progress.json`, artifacts, and decision logs.

To configure:

```bash
# Write MCP config files to the current project directory
sigma setup memory

# Also write .vscode/mcp.json for VS Code extension
sigma setup memory --vscode
```

`sigma setup memory` configures MCP integration and writes supported MCP config files.

Memory file: `~/.sigma/memory_sigma.jsonl` — Sigma ecosystem-level only.
Project decisions: `Sigma/memory/decisions.jsonl` — written by CLI on lock events.
