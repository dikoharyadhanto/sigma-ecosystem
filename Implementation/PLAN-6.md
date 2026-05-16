# Implementation Plan — Phase 6: Distribution & Bridge Files

**Phase**: 6 of 7
**Goal**: Finalize the npm package for public distribution — real bridge file content (CLAUDE.md, AGENTS.md, GEMINI.md), 28 skill files for 4 AI platforms × 7 skills (/arc, /fmn, /dev, /aud, /checkpoint, /cso, /report), hook guard for progress.json, enhanced `sigma setup install` with tool detection and skill deployment, and SIGMA_README.md. Version bump 0.5.0 → 0.6.0. SIGMA_PROTOCOL.md Section 25 filled.
**Status**: PENDING
**Prerequisites**: Phase 5 complete and MCP setup gap fixed (scripts/mcp-run-*.js, src/utils/mcp.ts, sigma setup memory writes .mcp.json — all landed post-PLAN-5)

---

## Source Material

| File | Role |
| :--- | :--- |
| `Sigma/SIGMA_PROTOCOL.md` Section 25 placeholder | Defines deliverable scope for this phase |
| `Sigma/rules/ARC-RULE.md`, `FMN-RULE.md`, `DEV-RULE.md`, `AUD-RULE.md` | Authoritative role definitions — skill files summarize these |
| `I:\Works\Project\delta-ecosystem\setup\targets\claude_code\` | Reference: skill file format and content pattern |
| `I:\Works\Project\delta-ecosystem\setup\targets\hooks\protect-delta.js` | Reference: hook implementation |
| `I:\Works\Project\delta-ecosystem\src\utils\detect.js` | Reference: tool detection pattern |
| `I:\Works\Project\delta-ecosystem\CLAUDE.md` | Reference: bridge file structure and content depth |
| `src/commands/setup.ts` | Extended in Phase 6 with skill deployment and hook deployment |
| `src/config.ts` | New SETUP_TARGETS_DIR, SIGMA_HOOKS_DIR constants; version bump |
| `package.json` | Add `setup/`, `SIGMA_README.md` to `files`; version bump |

---

## Design Decisions

### 1. Skill File Architecture

Each skill file is a Markdown document deployed to a tool-specific directory. It activates an AI role within a Sigma-governed project. All skill files follow the same content structure regardless of platform — only the target path and file naming convention differ.

**Content structure** (all roles, all platforms):

```
---
description: {one-line activation description, max 80 chars}
---

# Sigma {ROLE} — {Role Full Name}

## Role Identity

{2-3 sentences: who this role is, what they own, what they do not touch.}

## Activation

Activation phrase: "{natural language trigger, e.g. 'You are my Architect'}"

Only Director instruction or explicit skill invocation may activate this role.
Do not self-activate.

## Role Immutability

This role is immutable within the current session.

Do not switch to ARC, AUD, FMN, DEV, CHECKPOINT, or CSO mode inside the same session.

If the Director requests a different role, provide a short handoff summary if
useful, then ask the Director to start a fresh session or invoke the target role
separately. The current role must not assume the target role's responsibilities.

## Scope and Authority

{Bullet list: 3-5 items stating what this role controls, creates, and is
prohibited from doing. Reference artifact domain (e.g., "produces DIR-INTENT
drafts for Director review; does not lock artifacts").}

## Director Authorization

This role may operate Sigma CLI within its role boundary.

This role may recommend approval, lock, supersession, or risk-acknowledgment
commands. It must not execute approval-class, lock, risk-acknowledgment,
supersession, or destructive commands without explicit Director authorization.

Clear Director authorization may be given in natural language, such as:
- "approved", "lock it", "I approve this plan", "go ahead", "run it"

Ambiguous language such as "okay", "noted", "interesting", or "makes sense"
is not sufficient authorization for lock or risk commands.

If authorization is unclear, ask before executing.

## Bootstrap Protocol (4 Steps)

1. Query sigma-memory MCP: `search_nodes({ query: "sigma ecosystem constants" })` + `read_graph()`
2. Run `sigma --help` to verify current command syntax
3. Run `sigma session bootstrap` to read project state
4. Report lifecycle phase, active artifact versions, and any gate blockers before executing

## Role Rules

Full behavioral rules: `Sigma/rules/{ROLE}-RULE.md`
Protocol reference: `Sigma/SIGMA_PROTOCOL.md`

## CLI-Managed Files

Do not edit these files directly. Use the CLI commands:

| File | Command |
| :--- | :--- |
| `Sigma/progress.json` | `sigma intent lock`, `sigma plan lock`, `sigma exec lock`, etc. |
```

**Platform file map:**

| Platform | Target Dir | File Ext | Invoked as |
| :--- | :--- | :--- | :--- |
| Claude Code | `~/.claude/commands/` | `.md` | `/arc`, `/fmn`, `/dev`, `/aud`, `/checkpoint`, `/cso` |
| Codex CLI | `~/.codex/skills/` | (none) | `#arc`, `#fmn`, etc. |
| Reasonix | `~/.reasonix/skills/` | `.md` | `/arc`, `/fmn`, etc. |
| Antigravity | `~/.gemini/agents/` | `.md` | Agent selector |

---

### 2. Skill File Roster (28 files total)

Seven skill files per platform. Content is the same across platforms for the same role — only deployment path differs.

| Skill | Role | Description |
| :--- | :--- | :--- |
| `arc` | ARC — Architect | Interviews Director, drafts DIR-INTENT; no downstream artifact authority |
| `fmn` | FMN — Foreman | Drafts FMN-PLAN (work order + test contract); operates only after INTENT locked |
| `dev` | DEV — Developer | Drafts DEV-EXEC (implementation + report); operates only after PLAN locked |
| `aud` | AUD — Auditor | Passive external auditor; reviews Director-provided evidence only; never locks, never scans, never mandates; produces AUD-NOTE |
| `checkpoint` | CHECKPOINT | Mid-work state capture for any role; produces CSO snapshot |
| `cso` | CSO Handler | Creates, links, and closes CSO artifacts; used by any role at handoff |
| `report` | /report — Director Briefing | Universal read-only Director briefing; not a role; does not switch roles; chat-only |

**Total files by platform:** 4 platforms × 7 skills = **28 files**

Platform Codex uses no file extension (directory-based skill routing); all others use `.md`.

---

### 3. Bridge File Templates vs Project Start Behavior

Bridge file templates are the master content source shipped with the package. They live in `setup/targets/bridge/` inside the package.

`sigma setup install` copies templates from `setup/targets/bridge/` into `~/.sigma/bridge/` (replacing the current stubs seeded there).

`sigma project start` copies from `~/.sigma/bridge/` into the project root — this gives each project its CLAUDE.md, AGENTS.md, GEMINI.md. If `~/.sigma/bridge/` still has the old stubs (from a setup before Phase 6), `sigma project start` still works but produces stub output. Running `sigma setup update` refreshes `~/.sigma/bridge/` from the newer package.

### Design Principle

> Bridge files should not make every AI vendor equally governed.
> Bridge files should make every AI vendor safely interoperable with Sigma.
>
> For vendors that reliably follow complex multi-mode instructions: full bridge.
> For vendors with reliability constraints or platform limitations: lightweight safety bridge.

### Bridge File Tiers

**Tier 1 — Full Bridge** (CLAUDE.md, GEMINI.md, AGENTS.md)

Nine-section structure. Used for vendors that reliably follow complex multi-mode governance instructions.

Mandatory sections (in order):
1. Ownership
2. Operational Modes — Professional Mode (default) + ARC, FMN, DEV, AUD
3. Role Immutability
4. CLI Operator Model
5. Director Authorization Language
6. CLI-Managed Files — Do Not Edit Directly
7. Mandatory Bootstrap
8. MCP Tooling
9. Memory Isolation

AUD is first-class in Tier 1. AUD must be explicitly described as advisory-only: may critique and verify; may not lock, may not block, may not mandate, may not replace Director authority. This must be stated because "Auditor" implies authority by convention — Sigma must override that assumption.

**Tier 2 — Lightweight Isolation Bridge** (DEEPSEEK.md)

Seven-section structure. Non-inheritance is a safety design, not a gap. Role complexity is not added to avoid false confidence in vendors where multi-mode compliance may be unreliable.

Mandatory sections (in order):
1. Ownership (including explicit non-inheritance rule)
2. Operational Mode — Professional Mode (default) + Flexible Mode
3. CLI Operator Model (safety floor)
4. Director Authorization Language (safety floor)
5. CLI-Managed Files — Do Not Edit Directly (no-edit rule only, no full command table)
6. Sigma CLI Awareness (run `sigma --help` each session; `Sigma/SIGMA_PROTOCOL.md` reference)
7. Memory Isolation

No ARC/FMN/DEV/AUD activation sections. If Director requests governed role behavior, Flexible Mode activates and references the appropriate Tier 1 file.

**Tier 3 — Shell Whitelist Bridge** (REASONIX.md)

Six-section constrained structure. Points to DEEPSEEK.md as primary doctrine. Adds a Sigma CLI read-only shell whitelist for platforms with constrained shell access.

Mandatory sections (in order):
1. Ownership
2. Primary Doctrine (→ DEEPSEEK.md)
3. Sigma Shell Whitelist
4. CLI Operator Model (safety floor)
5. Director Authorization Language (safety floor)
6. Memory Isolation

Read-only whitelist (default — safe to run without Director authorization):
```
sigma --help
sigma session bootstrap
sigma project status
sigma project list
sigma intent status
sigma roadmap list
sigma plan status
sigma exec status
sigma close status
sigma git evidence
```

Not in default whitelist — require explicit Director authorization before execution:
```
sigma intent lock
sigma roadmap lock
sigma plan lock
sigma exec lock
sigma close lock
sigma close new --ack-stale-intent
sigma * supersede
sigma project reset
```

---

### 4. `protect-sigma.js` Hook

A Node.js PreToolUse hook deployed at `~/.sigma/hooks/protect-sigma.js`. Intercepts Edit and Write tool calls targeting `progress.json` inside any `Sigma/` folder and prints a blocking warning.

```javascript
// Block pattern: any path matching /Sigma[\/\\]progress\.json$/
// Output to stdout (Claude Code reads stdout for permission decisions):
//   { "decision": "block", "reason": "..." }
```

`sigma setup install` deploys the hook script and patches `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node \"~/.sigma/hooks/protect-sigma.js\"" }]
      }
    ]
  }
}
```

If `~/.claude/settings.json` already has the hook entry (by checking `command` string), the hook is not duplicated.

**Phase 6 scope note**: Hard hook protection is Claude Code-only in Phase 6. Other platforms (Codex, Reasonix, Antigravity) rely on bridge file and skill file behavioral rules to enforce this constraint — not a technical hook. Platform hook support for non-Claude-Code tools may be added in a future phase.

---

### 5. `src/utils/detect.ts` — Tool Detection

New utility module. Returns a detection result for all supported platforms.

```typescript
export interface DetectedTools {
  claudeCode: boolean;
  codex: boolean;
  reasonix: boolean;
  antigravity: boolean;
}

export interface ToolTargetPaths {
  claudeCommands: string;   // ~/.claude/commands/
  codexSkills: string;      // ~/.codex/skills/
  reasonixSkills: string;   // ~/.reasonix/skills/
  antigravityAgents: string; // ~/.gemini/agents/
}

export function detectTools(): DetectedTools
export function targetPaths(): ToolTargetPaths
```

Detection logic: `fs.existsSync(targetDir)` per platform. If the target directory exists, the tool is considered detected. No registry queries, no path-executable checks — directory presence is the signal.

---

### 6. Enhanced `sigma setup install`

The existing `runInstall` function in `setup.ts` is extended (not replaced). After the current governance file copy steps, Phase 6 adds:

**Step A — Bridge files**: Copy `setup/targets/bridge/*.md` into `~/.sigma/bridge/` (overwrite always — these are templates, not user-modified files).

**Step B — Skill deployment** (interactive):
1. Detect available tools (via `detectTools()`)
2. If no tools detected: print guidance and skip
3. If tools detected: prompt user to select which tools to configure (checkbox)
4. For each selected tool: copy role skill files from `setup/targets/{platform}/` to the detected target directory
5. Print deployment summary

**Step C — Hook deployment** (Claude Code only, if selected):
1. Copy `setup/targets/hooks/protect-sigma.js` to `~/.sigma/hooks/`
2. Patch `~/.claude/settings.json` PreToolUse entry (idempotent)

`--yes` flag skips all prompts (selects all detected tools, all roles). Used for CI and non-interactive reinstalls.

`sigma setup update` does NOT re-deploy skill files (those are user-space; update only touches templates, rules, governance). Bridge files in `~/.sigma/bridge/` are updated on `setup update` since they are managed templates.

---

### 7. SIGMA_README.md

Lives at package root (`sigma-ecosystem/SIGMA_README.md`), published via `files`. This becomes the npm package page content (set via `readme` field or manually).

Content structure:
1. **What is Sigma** — one-paragraph summary
2. **Install** — `npm install -g sigma-cli` + `sigma setup install`
3. **Quick Start** — `sigma project start`, then `sigma session bootstrap`
4. **Command Reference** — table of all domain commands with one-line descriptions
5. **Protocol** — link to `Sigma/SIGMA_PROTOCOL.md` for governance specification
6. **Roles** — table of 4 roles with one-line descriptions

---

### 8. Package Finalization

`package.json` additions:
- Add `"setup/"` to `files` array
- Add `"SIGMA_README.md"` to `files` array
- Version bump `"0.5.0"` → `"0.6.0"`
- `"readme": "SIGMA_README.md"` field

`src/config.ts` additions:
- `SETUP_TARGETS_DIR = path.join(PACKAGE_ROOT, 'setup', 'targets')` (in setup.ts — not global config)
- `SIGMA_VERSION = '0.6.0'`

**Note**: `SETUP_TARGETS_DIR` and `BUNDLE_SKILLS_DIR` are referenced only inside `setup.ts` as local constants (same pattern as `BUNDLE_TEMPLATES` and `BUNDLE_RULES` in the current file). They are not exported from `config.ts`.

---

### 9. SIGMA_PROTOCOL.md Section 25

The `[PHASE 6]` placeholder at line 1585 is replaced with:

1. **25.1 npm Package Structure** — `files` array, `bin/sigma.js`, how templates/rules/governance/scripts are bundled
2. **25.2 Setup Install Procedure** — What `sigma setup install` deploys: governance → bridge templates → skill files → hook (with tool detection)
3. **25.3 Bridge File Specification** — Content structure and purpose of all 5 bridge files (CLAUDE.md, GEMINI.md, AGENTS.md, DEEPSEEK.md, REASONIX.md) in project root; note that DEEPSEEK.md and REASONIX.md use a lighter pattern with no role activation
4. **25.4 Skill File Specification** — Format, platform table, 24-file roster, content pattern
5. **25.5 Hook Guard** — protect-sigma.js purpose and deployment
6. **25.6 MCP Setup** — Updated reference to `sigma setup memory` (writes .mcp.json), sequential-thinking + sigma-memory as default pair, --vscode flag

---

## Phase 6 Output Files

| File | Action | Description |
| :--- | :--- | :--- |
| `setup/targets/claude_code/arc.md` | Create | Claude Code ARC skill file |
| `setup/targets/claude_code/fmn.md` | Create | Claude Code FMN skill file |
| `setup/targets/claude_code/dev.md` | Create | Claude Code DEV skill file |
| `setup/targets/claude_code/aud.md` | Create | Claude Code AUD skill file |
| `setup/targets/claude_code/checkpoint.md` | Create | Claude Code CHECKPOINT skill file |
| `setup/targets/claude_code/cso.md` | Create | Claude Code CSO skill file |
| `setup/targets/codex/arc` | Create | Codex ARC skill (no extension) |
| `setup/targets/codex/fmn` | Create | Codex FMN skill |
| `setup/targets/codex/dev` | Create | Codex DEV skill |
| `setup/targets/codex/aud` | Create | Codex AUD skill |
| `setup/targets/codex/checkpoint` | Create | Codex CHECKPOINT skill |
| `setup/targets/codex/cso` | Create | Codex CSO skill |
| `setup/targets/reasonix/arc.md` | Create | Reasonix ARC skill file |
| `setup/targets/reasonix/fmn.md` | Create | Reasonix FMN skill file |
| `setup/targets/reasonix/dev.md` | Create | Reasonix DEV skill file |
| `setup/targets/reasonix/aud.md` | Create | Reasonix AUD skill file |
| `setup/targets/reasonix/checkpoint.md` | Create | Reasonix CHECKPOINT skill file |
| `setup/targets/reasonix/cso.md` | Create | Reasonix CSO skill file |
| `setup/targets/antigravity/arc.md` | Create | Antigravity ARC skill file |
| `setup/targets/antigravity/fmn.md` | Create | Antigravity FMN skill file |
| `setup/targets/antigravity/dev.md` | Create | Antigravity DEV skill file |
| `setup/targets/antigravity/aud.md` | Create | Antigravity AUD skill file |
| `setup/targets/antigravity/checkpoint.md` | Create | Antigravity CHECKPOINT skill file |
| `setup/targets/antigravity/cso.md` | Create | Antigravity CSO skill file |
| `setup/targets/bridge/CLAUDE.md` | Create | Bridge template for CLAUDE.md (Claude Code) |
| `setup/targets/bridge/GEMINI.md` | Create | Bridge template for GEMINI.md (Gemini / Antigravity) |
| `setup/targets/bridge/AGENTS.md` | Create | Bridge template for AGENTS.md (Codex — CODEX-RULES) |
| `setup/targets/bridge/DEEPSEEK.md` | Create | Bridge template for DEEPSEEK.md (lightweight, no role activation) |
| `setup/targets/bridge/REASONIX.md` | Create | Bridge template for REASONIX.md (thin bridge → DEEPSEEK.md) |
| `setup/targets/hooks/protect-sigma.js` | Create | PreToolUse hook guard for progress.json |
| `CLAUDE.md` (project root) | Replace stub | Real operational directives for sigma-ecosystem |
| `GEMINI.md` (project root) | Create | Real operational directives for sigma-ecosystem (Gemini) |
| `AGENTS.md` (project root) | Replace stub | Real operational directives for sigma-ecosystem (Codex) |
| `DEEPSEEK.md` (project root) | Create | Lightweight directives for sigma-ecosystem (DeepSeek) |
| `REASONIX.md` (project root) | Create | Thin bridge to DEEPSEEK.md for sigma-ecosystem (Reasonix) |
| `SIGMA_README.md` | Create | npm package README |
| `src/utils/detect.ts` | Create | Tool detection utility |
| `src/commands/setup.ts` | Modify | Add bridge copy, skill deployment, hook deployment to runInstall; --yes flag |
| `src/config.ts` | Update | SIGMA_VERSION bump to 0.6.0 |
| `package.json` | Update | files array, version bump, readme field |
| `Sigma/SIGMA_PROTOCOL.md` | Update | Fill Section 25 [PHASE 6] placeholder |

---

## Task 1 — Create `src/utils/detect.ts`

```typescript
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface DetectedTools {
  claudeCode: boolean;
  codex: boolean;
  reasonix: boolean;
  antigravity: boolean;
}

export interface ToolTargetPaths {
  claudeCommands: string;
  codexSkills: string;
  reasonixSkills: string;
  antigravityAgents: string;
}

export function targetPaths(): ToolTargetPaths {
  const home = os.homedir();
  return {
    claudeCommands: path.join(home, '.claude', 'commands'),
    codexSkills: path.join(home, '.codex', 'skills'),
    reasonixSkills: path.join(home, '.reasonix', 'skills'),
    antigravityAgents: path.join(home, '.gemini', 'agents'),
  };
}

export function detectTools(): DetectedTools {
  const t = targetPaths();
  return {
    claudeCode: fs.existsSync(t.claudeCommands),
    codex: fs.existsSync(t.codexSkills),
    reasonix: fs.existsSync(t.reasonixSkills),
    antigravity: fs.existsSync(t.antigravityAgents),
  };
}
```

---

## Task 2 — Create `setup/targets/hooks/protect-sigma.js`

Hook reads `PreToolUse` input from stdin (JSON line). If `tool_name` is `Edit` or `Write` and `tool_input.path` matches `Sigma/progress.json`, outputs block decision.

```javascript
#!/usr/bin/env node
'use strict';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }

  const tool = input.tool_name || '';
  const filePath = (input.tool_input || {}).path || '';

  if (/Edit|Write/.test(tool) && /Sigma[\/\\]progress\.json$/.test(filePath)) {
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: 'Sigma progress.json is CLI-managed. Use sigma commands (sigma intent lock, sigma plan lock, etc.) instead of direct edits.',
    }) + '\n');
    process.exit(0);
  }

  process.exit(0);
});
```

---

## Task 3 — Create 24 Skill Files

All skill files share the content structure from Design Decision 1. Role-specific differences below:

### 3a. ARC skill content additions
- Scope: draft DIR-INTENT documents only; does not create FMN-PLAN or DEV-EXEC
- Key constraint: "ARC does not lock INTENT — locking is a Director action only"
- Bootstrap: check `intent.active_state` in session bootstrap output
- Reference section: `Sigma/rules/ARC-RULE.md`

### 3b. FMN skill content additions
- Scope: draft FMN-PLAN (work order + test contract); operates only after DIR-INTENT is LOCKED
- Gate check: if `gates.gate_1_open == false`, report blocked and stop
- Key constraint: "FMN does not lock PLAN — locking is a Director action only"
- Reference section: `Sigma/rules/FMN-RULE.md`

### 3c. DEV skill content additions
- Scope: draft DEV-EXEC (implementation approach + report); operates only after FMN-PLAN is LOCKED
- Gate check: if `gates.gate_2_open == false`, report blocked and stop
- Key constraint: "DEV does not lock EXEC — locking is a Director action only"
- Reference section: `Sigma/rules/DEV-RULE.md`

### 3d. AUD skill content additions
- Scope: advisory reviews only — produces AUD-NOTE, not a governance artifact
- Key constraint: "AUD cannot lock, cannot block, cannot mandate changes. All AUD output is advisory."
- External auditor model: AUD is passive by default. AUD reviews only materials explicitly provided or authorized by the Director. AUD must not scan, discover, or read files independently.
- Evidence Boundary: every AUD-NOTE must include an Evidence Boundary block when the provided audit package is incomplete (reviewed materials, not reviewed, audit confidence: LOW/MEDIUM/HIGH).
- CLI passive: AUD does not execute Sigma CLI commands by default. If Director explicitly authorizes a specific command, AUD may run only that command and must not expand scope.
- Reviews are triggered by Director request; AUD does not self-initiate
- Reference section: `Sigma/rules/AUD-RULE.md`

### 3e. CHECKPOINT skill content additions
- Purpose: capture mid-work state as a CSO artifact (`sigma cso new`)
- When to use: end of significant work block, before context handoff, before long break
- Outputs: CSO file in `Sigma/logs/`; adds link to active artifact's tracking section
- No gating requirements — CHECKPOINT can be used at any lifecycle phase

### 3f. CSO skill content additions
- Purpose: create CSO artifacts for inter-session context transfer
- Primary command: `sigma cso new`
- Additional commands if implemented in the final operation registry: `sigma cso link`, `sigma cso list`, `sigma cso close`
- Skill file must only advertise commands that exist in `Sigma/SIGMA-OPERATION-REGISTRY.json` at time of writing
- CSO is not an approval artifact — it is informational only
- Any role may create a CSO; only Director or the creating role closes it

**Cross-platform note**: Codex skill files (no extension) use the same markdown content as Claude Code. The only difference is the file has no `.md` extension and Codex reads it via its skill routing mechanism.

---

## Task 4 — Create Bridge File Templates

### 4a. `setup/targets/bridge/CLAUDE.md`

Tier 1 — Full Bridge. Nine sections.

Content outline:
```
---
name: CLAUDE-RULES
description: System-level constraints for Claude operating in a Sigma-governed project
---

# Claude Model Directives — Sigma

## Ownership

These rules apply strictly to the Claude model in this project context.

## Operational Modes

Claude operates in one of five modes:

### 1. Professional Mode (Default)
- Activation: active by default unless explicitly overridden
- Scope: any folder
- Capabilities: general coding, editing, review, discussion, debugging
- Constraints: does not adhere to Sigma governance rules

### 2. ARC (Architect)
- Activation: explicit Director request (e.g., "You are my Architect", "Activate ARC")
- Scope: project root governance; drafts DIR-INTENT
- Constraints: follow Sigma/rules/ARC-RULE.md; invoke /arc skill

### 3. FMN (Foreman)
- Activation: explicit Director request (e.g., "You are my Foreman", "Activate FMN")
- Scope: drafts FMN-PLAN; operates after DIR-INTENT is LOCKED
- Constraints: follow Sigma/rules/FMN-RULE.md; invoke /fmn skill

### 4. DEV (Developer)
- Activation: explicit Director request (e.g., "You are my Developer", "Activate DEV")
- Scope: drafts DEV-EXEC; operates after FMN-PLAN is LOCKED
- Constraints: follow Sigma/rules/DEV-RULE.md; invoke /dev skill

### 5. AUD (Auditor)
- Activation: explicit Director request (e.g., "You are my Auditor", "Activate AUD")
- Scope: advisory reviews only; produces AUD-NOTE
- Constraints: follow Sigma/rules/AUD-RULE.md; invoke /aud skill
- IMPORTANT: AUD is advisory-only. AUD may critique and verify. AUD may not
  lock, may not block, may not mandate changes, and may not replace Director
  authority. All AUD output is a recommendation to the Director.
- EXTERNAL AUDITOR: AUD is passive by default. AUD reviews only materials
  explicitly provided or authorized by the Director. AUD must not scan files,
  inspect local state, or execute Sigma CLI commands without explicit Director
  authorization of the exact scope.

## Role Immutability

A Sigma AI role is immutable within a session.

You may switch from Professional Mode to any governance role at any point.
You CANNOT switch between ARC, FMN, DEV, and AUD inside the same session.

If the Director requests a role change mid-session, decline the role switch.
Provide a short handoff summary if useful, then ask the Director to start a
fresh session or explicitly invoke the target role separately.

## CLI Operator Model

Sigma CLI is normally operated by AI roles under Director authority.

Do not ask the Director to manually run routine Sigma commands when you can
run them through available tooling. Instead:

1. Identify the next valid CLI command.
2. State whether it requires Director authorization.
3. Ask if the Director wants you to run it.
4. Execute only after authorization when required.

A valid command is not automatically an authorized command. Most Sigma
artifacts are AI-operational; Director normally interacts through intent,
approval, risk, and closure decisions.

### AUD Exception

AUD mode does not follow the above CLI operator model. AUD is a passive
external auditor by default. AUD must not execute Sigma CLI commands unless
the Director explicitly authorizes the exact command in an agent environment.

## Director Authorization Language

Approval-class, lock, risk-acknowledgment, supersession, and destructive
commands require explicit Director authorization before execution.

Sufficient authorization: "approved", "lock it", "I approve this plan",
"go ahead", "run it", "confirmed"

Rejection / revision signal: "I don't like this", "revise first",
"not yet", "hold on"

Ambiguous — not sufficient for lock or risk commands: "okay", "noted",
"interesting", "makes sense", "sure"

If authorization is unclear, ask before executing.

## CLI-Managed Files — Do Not Edit Directly

[Full table: Sigma/progress.json → all sigma commands]
[Full table: Sigma/SIGMA-REGISTRY.json → sigma refresh]
[Full table: Sigma/SIGMA-OPERATION-REGISTRY.json → sigma refresh]

## Mandatory Bootstrap (All Governance Roles)

1. Query sigma-memory MCP: search_nodes for Sigma ecosystem constants
2. Run sigma --help to verify current command syntax
3. Run sigma session bootstrap to read current project state
4. Report lifecycle phase, active artifact versions, and gate blockers
   before executing

Hard prohibitions:
- Never manually edit Sigma/progress.json
- Never assume command syntax without verification

## MCP Tooling

Sequential thinking (sequential-thinking server):
- Use for multi-step planning, architecture review, complex analysis
- Initialize with conservative thought count; adjust dynamically

Sigma memory (sigma-memory server):
- Use for Sigma ecosystem constants, CLI behavior, host setup facts
- Do not store project-specific facts in global memory

## Memory Isolation

~/.sigma/memory_sigma.jsonl is Sigma ecosystem-level only.
Do not store project context, implementation details, or session notes there.
Project decisions are recorded in Sigma/memory/decisions.jsonl (CLI-written).
Project context for handoff uses CSO artifacts.
```

### 4b. `setup/targets/bridge/GEMINI.md`

Tier 1 — Full Bridge. Same nine-section structure as CLAUDE.md.

Vendor-specific adaptations:
- Document heading: `# Gemini Model Directives — Sigma`
- Frontmatter name: `GEMINI-RULES`
- Operational Modes section uses Gemini/Antigravity agent-selector activation language
- MCP Tooling section adapted for Gemini MCP host configuration if different from Claude Desktop

All governance content (Role Immutability, CLI Operator Model, Director Authorization Language, Bootstrap, Memory Isolation) is identical to CLAUDE.md.

AUD Exception note in CLI Operator Model section is identical to CLAUDE.md — AUD is a passive external auditor, not an active CLI operator, regardless of platform.

### 4c. `setup/targets/bridge/AGENTS.md`

Tier 1 — Full Bridge. Same nine-section structure as CLAUDE.md.

Vendor-specific adaptations:
- Document heading: `# Codex Model Directives — Sigma`
- Frontmatter name: `CODEX-RULES`
- Operational Modes activation phrases use Codex `#arc`, `#fmn`, `#dev`, `#aud` invocation syntax
- MCP Tooling section adapted for Codex MCP configuration

All governance content (Role Immutability, CLI Operator Model, Director Authorization Language, Bootstrap, Memory Isolation) is identical to CLAUDE.md.

AUD Exception note in CLI Operator Model section is identical to CLAUDE.md — AUD is a passive external auditor, not an active CLI operator, regardless of platform.

### 4d. `setup/targets/bridge/DEEPSEEK.md`

Tier 2 — Lightweight Isolation Bridge. Seven sections.

Non-inheritance is a safety design. ARC/FMN/DEV/AUD role activation sections are intentionally absent to avoid false confidence where multi-mode compliance may be unreliable.

Content outline:
```
---
name: DEEPSEEK-RULES
description: System-level rules for DeepSeek operating in a Sigma-governed project
---

# DeepSeek Directives — Sigma

## Ownership

These rules apply strictly to DeepSeek in this project context.

DeepSeek does NOT inherit from CLAUDE.md, GEMINI.md, or AGENTS.md unless
explicitly requested by the Director. Follow this file above all other
project-level AI rule files.

## Operational Mode

### Professional Mode (Default)
- Activation: active by default unless explicitly overridden
- Capabilities: general coding, editing, review, discussion, debugging
- Constraints: none — operates with full flexibility

### Flexible Mode
- Activation: Director explicitly requests reference to CLAUDE.md, GEMINI.md,
  or AGENTS.md by name
- Scope: inherits rules from the referenced file for that session only

## CLI Operator Model

Sigma CLI is normally operated by AI roles under Director authority.

Do not ask the Director to manually run Sigma commands when you can run them
through available tooling. Instead:

1. Identify the next valid CLI command.
2. State whether it requires Director authorization.
3. Ask if the Director wants you to run it.
4. Execute only after authorization when required.

## Director Authorization Language

Lock, risk-acknowledgment, supersession, and destructive commands require
explicit Director authorization before execution.

Sufficient: "approved", "lock it", "I approve this plan", "go ahead", "run it"
Ambiguous (not sufficient for lock/risk): "okay", "noted", "makes sense"
Rejection: "revise first", "not yet", "hold on"

If authorization is unclear, ask before executing.

## CLI-Managed Files — Do Not Edit Directly

Do not edit Sigma/progress.json directly. Use sigma CLI commands to
modify workflow state. Run `sigma --help` to see available commands.

## Sigma CLI Awareness

- Run `sigma --help` at session start to verify current command syntax.
- Full specification: `Sigma/SIGMA_PROTOCOL.md`.
- Sigma gate flow: intent lock → opens plan gate → plan lock → opens exec gate

## Memory Isolation

~/.sigma/memory_sigma.jsonl is Sigma ecosystem-level only.
Do not store project-specific facts or session context there.
```

### 4e. `setup/targets/bridge/REASONIX.md`

Tier 3 — Shell Whitelist Bridge. Six sections.

Points to DEEPSEEK.md as primary doctrine. Adds Sigma CLI shell whitelist for platforms with constrained shell access. Does not duplicate governance detail — DEEPSEEK.md covers that.

Content outline:
```
# Reasonix — Sigma Ecosystem Integration

## Ownership

This file bridges Reasonix with the Sigma ecosystem.
Primary doctrine for DeepSeek/Reasonix: DEEPSEEK.md at the project root.

## Primary Doctrine

Follow DEEPSEEK.md above all other project-level rule files.
Do not read CLAUDE.md, GEMINI.md, or AGENTS.md unless the Director explicitly
requests it.

## Sigma Shell Whitelist

The following commands are safe to run without Director authorization:

sigma --help
sigma session bootstrap
sigma project status
sigma project list
sigma intent status
sigma roadmap list
sigma plan status
sigma exec status
sigma close status
sigma git evidence

The following commands require explicit Director authorization before running:

sigma intent lock / sigma roadmap lock / sigma plan lock
sigma exec lock / sigma close lock
sigma close new --ack-stale-intent
sigma * supersede
sigma project reset

## CLI Operator Model

Do not ask the Director to manually run Sigma commands when you can run them
through available tooling. Identify the command, state whether it requires
authorization, ask, then execute only after authorization when required.

## Director Authorization Language

Sufficient: "approved", "lock it", "I approve this plan", "go ahead", "run it"
Ambiguous (not sufficient for lock/risk): "okay", "noted", "makes sense"

If authorization is unclear, ask before executing.

## Memory Isolation

~/.sigma/memory_sigma.jsonl is Sigma ecosystem-level only.
Do not store project-specific facts or session context there.
```

---

## Task 5 — Update `sigma setup install`

Modify `runInstall` in `src/commands/setup.ts`:

### 5a. Add imports

```typescript
import { detectTools, targetPaths, DetectedTools, ToolTargetPaths } from '../utils/detect';
```

New local constants (inside setup.ts, not config.ts):

```typescript
const SETUP_TARGETS_DIR = path.join(PACKAGE_ROOT, 'setup', 'targets');
const BUNDLE_BRIDGE_DIR = path.join(SETUP_TARGETS_DIR, 'bridge');
const BUNDLE_HOOKS_DIR = path.join(SETUP_TARGETS_DIR, 'hooks');
```

### 5b. Role file map

```typescript
const ROLE_FILES: Record<string, Record<string, string>> = {
  claudeCode: { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', checkpoint: 'checkpoint.md', cso: 'cso.md' },
  codex:      { arc: 'arc',    fmn: 'fmn',    dev: 'dev',    aud: 'aud',    checkpoint: 'checkpoint',    cso: 'cso'    },
  reasonix:   { arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', checkpoint: 'checkpoint.md', cso: 'cso.md' },
  antigravity:{ arc: 'arc.md', fmn: 'fmn.md', dev: 'dev.md', aud: 'aud.md', checkpoint: 'checkpoint.md', cso: 'cso.md' },
};

const PLATFORM_LABELS: Record<string, string> = {
  claudeCode:  'Claude Code  (~/.claude/commands/)',
  codex:       'Codex CLI    (~/.codex/skills/)',
  reasonix:    'Reasonix     (~/.reasonix/skills/)',
  antigravity: 'Antigravity  (~/.gemini/agents/)',
};
```

### 5c. runInstall additions (after existing governance copy steps)

```
Step A: Copy bridge templates from BUNDLE_BRIDGE_DIR → GLOBAL_BRIDGE_DIR (overwrite)
Step B: Detect tools
Step C: if --yes (non-interactive): select all detected tools
        else: prompt checkbox for detected tools
Step D: for each selected tool, copy role files from setup/targets/{platform}/ to targetPath
Step E: if claudeCode selected, deploy hook and patch settings.json
Step F: Print deployment summary (OK / ERR per file)
```

Interactive flow does NOT ask per-role (deploy all 6 skills per selected platform). Role selection granularity is not needed for Sigma's scope.

---

## Task 6 — Write Real Bridge Files at Project Root

Replace the current stubs and create missing bridge files at the `sigma-ecosystem/` project root. All 5 bridge files describe how to work on the **sigma-ecosystem codebase** itself — not a downstream project governed by sigma-cli.

Files to write:
- `CLAUDE.md` — replace stub with real content
- `GEMINI.md` — replace stub with real content
- `AGENTS.md` — replace stub with real content
- `DEEPSEEK.md` — create (no stub exists)
- `REASONIX.md` — create (no stub exists)

Shared context for all project root bridge files:
- Professional Mode is default (no formal role activation needed for normal dev work)
- ARC/FMN/DEV/AUD are available and refer to sigma-ecosystem's own governance (this project's `Sigma/` folder)
- CLI-Managed Files table lists `Sigma/progress.json`
- Bootstrap protocol applies when entering a governance role session
- DEEPSEEK.md and REASONIX.md follow the lightweight pattern (no role activation, CLI awareness only)

---

## Task 7 — Create SIGMA_README.md

Content sections:
1. **Sigma** — one-paragraph summary ("lightweight governance protocol for small-to-medium projects")
2. **Why Sigma?** — Sigma is not an autonomous agent swarm; it is a governance layer for keeping AI-assisted work bounded, traceable, and evidence-based
3. **When Not To Use Sigma** — not intended for safety-critical, regulated, large enterprise, or high-compliance delivery without additional governance; not for fully automated pipelines without human Director authority
4. **Install** — `npm install -g sigma-cli` then `sigma setup install`
5. **Quick Start** — `sigma project start`, `sigma session bootstrap`, `sigma intent new`
6. **Command Reference** — table: domain + command + description (all public commands)
7. **Governance Protocol** — "Full specification: Sigma/SIGMA_PROTOCOL.md after setup"
8. **Roles** — table: ARC, FMN, DEV, AUD with one-line each
9. **Memory & MCP** — `sigma setup memory` for sequential-thinking + sigma-memory config

---

## Task 8 — Config and Package Updates

### 8a. `src/config.ts`
```typescript
export const SIGMA_VERSION = '0.6.0';
```

### 8b. `package.json`
```json
"version": "0.6.0",
"readme": "SIGMA_README.md",
"files": [
  "bin/",
  "dist/",
  "scripts/",
  "setup/",
  "Sigma/templates/",
  "Sigma/rules/",
  "Sigma/SIGMA_CONSTITUTION.md",
  "Sigma/SIGMA_PROTOCOL.md",
  "Sigma/SIGMA-REGISTRY.json",
  "Sigma/SIGMA-OPERATION-REGISTRY.json",
  "SIGMA_README.md"
]
```

---

## Task 9 — Fill SIGMA_PROTOCOL.md Section 25

Replace the `[PHASE 6]` placeholder at line 1585 with the 6-subsection spec from Design Decision 9:

- 25.1 npm Package Structure
- 25.2 Setup Install Procedure
- 25.3 Bridge File Specification
- 25.4 Skill File Specification
- 25.5 Hook Guard
- 25.6 MCP Setup (reference to Phase 5 implementation, updated sigma setup memory behavior)

---

## Acceptance Criteria

| # | Criterion |
| :--- | :--- |
| AC-01 | `setup/targets/` contains exactly 28 skill files across 4 platform subdirectories (claude_code, codex, reasonix, antigravity), 7 files each |
| AC-02 | All skill files contain: frontmatter with `description:` field, Role Identity section, Activation section, Bootstrap Protocol (4-step), role rules file reference, CLI-Managed Files table |
| AC-03 | `setup/targets/bridge/` contains all 5 bridge files (CLAUDE.md, GEMINI.md, AGENTS.md, DEEPSEEK.md, REASONIX.md) with real operational content — not stubs; each file matches its tier specification |
| AC-04 | `setup/targets/hooks/protect-sigma.js` blocks Edit/Write targeting `Sigma/progress.json` — outputs `{"decision":"block",...}` JSON on stdout |
| AC-05 | `sigma setup install` successfully deploys Claude Code skill files to `~/.claude/commands/` when Claude Code is detected |
| AC-06 | `sigma setup install --yes` (non-interactive) deploys all skills for all detected platforms without prompts |
| AC-07 | `sigma setup install` patches `~/.claude/settings.json` with PreToolUse hook entry; re-running does not duplicate the entry |
| AC-08 | `sigma setup install` copies bridge templates to `~/.sigma/bridge/` (replacing stubs) |
| AC-09 | `sigma setup update` refreshes bridge templates in `~/.sigma/bridge/` but does NOT redeploy skill files to tool directories |
| AC-10 | `CLAUDE.md` and `AGENTS.md` at project root contain real operational content — the `Phase 6 will write real content` stub comment is gone |
| AC-11 | `SIGMA_README.md` exists at package root with all 7 content sections |
| AC-12 | `package.json` `files` includes `setup/` and `SIGMA_README.md`; version is `"0.6.0"` |
| AC-13 | `SIGMA_VERSION` in `config.ts` is `"0.6.0"` |
| AC-14 | `npm run build` passes with 0 TypeScript errors |
| AC-15 | SIGMA_PROTOCOL.md Section 25 `[PHASE 6]` placeholder is replaced with all 6 subsections |
| AC-16 | All 24 skill files include a `## Director Authorization` section with authorization language policy and examples |
| AC-17 | All 3 bridge file templates (CLAUDE.md, AGENTS.md, GEMINI.md) include a `## CLI Operator Model` section |
| AC-18 | All non-interactive flag references in code, docs, and acceptance criteria use `--yes` — no `--confirm` anywhere |
| AC-19 | SIGMA_README.md includes both "Why Sigma?" and "When Not To Use Sigma" sections |
| AC-20 | Skill files do not advertise CLI commands absent from `Sigma/SIGMA-OPERATION-REGISTRY.json`; CSO skill only advertises `sigma cso new` unless additional commands are registered |
| AC-21 | DEEPSEEK.md (Tier 2) contains no ARC/FMN/DEV/AUD activation sections; contains CLI Operator Model, Director Authorization Language, CLI-Managed Files no-edit rule, and Memory Isolation as safety floors |
| AC-22 | REASONIX.md (Tier 3) contains a Sigma Shell Whitelist that separates read-only commands from authorization-required commands; no role activation sections |
| AC-23 | All 24 AUD skill files include an External Auditor Isolation Policy stating: AUD reviews only Director-provided materials; no unsolicited scanning, discovery, or file reading; no default CLI execution |
| AC-24 | All 24 AUD skill files specify the Evidence Boundary output format (reviewed materials / not reviewed / audit confidence: LOW–HIGH) |
| AC-25 | AUD mode in all three Tier 1 bridge file templates (CLAUDE.md, GEMINI.md, AGENTS.md) states AUD is a passive external auditor and must not scan or execute CLI without explicit Director authorization |

---

*PLAN-6 — Phase 6: Distribution & Bridge Files — drafted 2026-05-16 — patched 2026-05-17*
