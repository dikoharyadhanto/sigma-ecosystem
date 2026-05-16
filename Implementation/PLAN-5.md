# Implementation Plan — Phase 5: Memory & Decision Harvest

**Phase**: 5 of 7
**Goal**: Implement the memory layer — Decision auto-harvest on every lock event (INTENT, ROADMAP, PLAN, EXEC, CLOSE), `sigma setup memory` subcommand, empty decisions.jsonl init on project start, and MCP query guidance documentation. Phase 4's lock commands are the hook points; Phase 5 inserts harvest calls without rewriting them.
**Status**: PENDING
**Prerequisites**: Phase 4 complete (all lock commands must exist before harvest can be wired in); PLAN-2b accepted (ROADMAP is first-class — `roadmap.lock` included in harvest scope)

---

## Source Material

| File | Role |
| :--- | :--- |
| `sigma_phase_implementation.md` — Phase 5 section | Phase 5 task list and memory model spec |
| `src/engine/progress.ts` | Lock mutation functions — Phase 5 wires harvest after each lock |
| `src/commands/intent.ts` | `intent lock` action — hook point for INTENT harvest |
| `src/commands/roadmap.ts` | `roadmap lock` action — hook point for ROADMAP harvest |
| `src/commands/plan.ts` | `plan lock` action — hook point for PLAN harvest |
| `src/commands/exec.ts` | `exec lock` action — hook point for EXEC harvest |
| `src/commands/close.ts` | `close lock` action — hook point for CLOSE harvest |
| `src/commands/project.ts` | `project start` — creates empty decisions.jsonl |
| `src/commands/setup.ts` | Extended with `sigma setup memory` subcommand |
| `Sigma/templates/*` | Source templates — defines section headings used for extraction |
| `Sigma/SIGMA_PROTOCOL.md` | Section 24 `[PHASE 5]` placeholder — filled in Task 6 |

---

## Design Decisions

### 1. Memory Engine Isolation

`src/engine/memory.ts` is a new file dedicated to harvest logic. It does not import from `commands/` (no circular deps). Lock commands import `harvestXxxLock` from `engine/memory`. The engine has no dependency on CLI output helpers — it uses `process.stderr.write` directly for warning cases.

This keeps harvest logic testable in isolation and prevents growth of per-command files.

---

### 2. Best-Effort Section Extraction

Artifact files are markdown. The harvest extracts fields by scanning for known heading strings and collecting content until the next `##` heading. This is **best-effort** — if a heading is not found, the field is an empty string. Extraction never throws; a failed extract returns `''`.

Field-to-heading mapping per artifact type:

| Artifact | Field | Heading Searched (case-insensitive pattern) |
| :--- | :--- | :--- |
| INTENT | `director_notes` | First heading matching `/director/i` after section 9 — typically empty; `''` acceptable |
| INTENT | `risk_notes` | `## 8. Risk & Failure Definition` |
| INTENT | `evidence_references` | `## 2. Success Definition` (subsection 2.4) |
| ROADMAP | `stage_summary` | `## 3. Stage Overview` |
| ROADMAP | `recommended_next_plan` | `## 8. FMN Roadmap Notes` → "Recommended next PLAN:" text |
| ROADMAP | `pending_items` | `## 7. Pending Items` |
| ROADMAP | `director_notes` | `## 9. Director Roadmap Notes` |
| PLAN | `task_plan_summary` | `## 2. Work Order / Task Plan` |
| PLAN | `test_contract_summary` | `## 5. Pre-Build Test Contract` |
| PLAN | `director_notes` | Last heading matching `/director/i` in file |
| EXEC | `implementation_summary` | `## 2. Implementation Approach` |
| EXEC | `known_issues` | Heading matching `/known.*(issues\|limitations)/i` or last section |
| EXEC | `director_notes` | Last heading matching `/director/i` in file |
| CLOSE | `plan_refs` | `## 3. Evidence References` (same raw content as `exec_refs`) |
| CLOSE | `exec_refs` | `## 3. Evidence References` |
| CLOSE | `closure_verdict` | `## 10. Director Closure Decision Notes` |
| CLOSE | `accepted_limitations` | `## 6. Known Limitations` |
| CLOSE | `director_notes` | `## 10. Director Closure Decision Notes` (same as closure_verdict) |

`director_notes` for INTENT will almost always be empty string — this is expected and acceptable. DIR-INTENT lock state is managed via CLI, not via a document section.

The extractor function signature:

```typescript
function extractSection(content: string, pattern: RegExp): string
// Returns trimmed section content until next ## heading, or '' if not found
```

---

### 3. JSONL Append Pattern

Each harvest event appends one JSON line to `Sigma/memory/decisions.jsonl`. The file is created if not exists (`fs.ensureFileSync` before appending). Writes are append-only — no read-modify-write. Existing entries are never touched.

```typescript
function appendEntry(projectRoot: string, entry: DecisionEntry): void {
  const filePath = path.join(projectRoot, PROJECT_DECISIONS_FILE);
  fs.ensureFileSync(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}
```

This is sufficient for normal single-user CLI usage. Concurrent lock operations are not a supported workflow in Sigma — no file locking is implemented and none is required.

Reading decisions.jsonl is for agents via MCP. The CLI never reads it after appending.

---

### 4. DecisionEntry Schema

Artifact-specific optional fields (`?`) are always written with their value for that artifact type — never omitted when the artifact produces them. If extraction yields empty string, the field is still included as `""` in the JSON output. This ensures consistent parseable shape per artifact type, without requiring agents to handle missing keys.

INTENT entries do NOT include PLAN/EXEC/CLOSE/ROADMAP-specific fields. Each artifact type has a fixed set of additional fields it always writes.

```typescript
export interface DecisionEntry {
  // Base fields — all artifacts
  artifact: 'INTENT' | 'ROADMAP' | 'PLAN' | 'EXEC' | 'CLOSE';
  version: string;
  lock_event: 'intent.lock' | 'roadmap.lock' | 'plan.lock' | 'exec.lock' | 'close.lock';
  source_file: string;
  timestamp: string;
  director_notes: string;   // always present; may be '' for INTENT
  risk_notes: string;       // always present; may be '' if no risk section found
  evidence_references: string;

  // ROADMAP-specific (always present for ROADMAP entries)
  stage_summary?: string;
  recommended_next_plan?: string;
  pending_items?: string;

  // PLAN-specific (always present for PLAN entries)
  task_plan_summary?: string;
  test_contract_summary?: string;

  // EXEC-specific (always present for EXEC entries)
  implementation_summary?: string;
  known_issues?: string;

  // CLOSE-specific (always present for CLOSE entries)
  plan_refs?: string;
  exec_refs?: string;
  closure_verdict?: string;
  accepted_limitations?: string;
}
```

In implementation: when building a PLAN entry, always include `task_plan_summary: extracted || ""` — never omit it. Same for all artifact-specific field groups.

---

### 5. Harvest Is Non-Blocking

If the artifact markdown file does not exist at harvest time (e.g., deleted after `lock`), harvest is skipped with a stderr warning. The lock operation has already committed `progress.json` — it completes successfully regardless of harvest outcome. Harvest failure never exits with code 1 or propagates an exception past the lock command.

```typescript
export function harvestIntentLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    // extract and append
  } catch (e) {
    process.stderr.write(`[harvest] unexpected error — skipping: ${(e as Error).message}\n`);
  }
}
```

Optional improvement (not required for v1): append harvest errors to `Sigma/logs/harvest-errors.log` in addition to stderr, so Director can inspect missed harvests after a session.

---

### 6. `sigma setup memory` — Subcommand of Setup

Added as a third subcommand to existing `src/commands/setup.ts`. Keeps setup-related operations co-located. No new command file is created.

**Policy**: `sigma setup memory` only creates the file and prints config. It does not write project decisions into global memory. It does not auto-promote CSO or decision entries from any project into the global memory file. The global file is a blank slate for agent-managed memory — the CLI does not populate it.

Behavior:
1. Ensures `~/.sigma/` exists (aborts with error if not installed)
2. Creates `~/.sigma/memory_sigma.jsonl` (empty file) if not exists; if exists, prints "already configured" and continues
3. Prints MCP configuration snippet with the absolute path resolved for the current user

Output format:

```
=== Sigma MCP Memory Setup ===

  Memory file: /home/user/.sigma/memory_sigma.jsonl

Add to your MCP configuration (.mcp.json or equivalent):

  {
    "mcpServers": {
      "sigma-memory": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "env": {
          "MEMORY_FILE_PATH": "/home/user/.sigma/memory_sigma.jsonl"
        }
      }
    }
  }

Agents query memory using MCP tools: search_nodes, read_graph
Project decision log: Sigma/memory/decisions.jsonl (per-project, CLI-written)
```

---

### 7. `decisions.jsonl` Init on Project Start

`sigma project start` creates `Sigma/memory/decisions.jsonl` as an **empty file** — no seed entries. Decision log entries begin empty and are populated exclusively by actual lock events.

Rationale: `decisions.jsonl` is a project lock-event history. Constitutional and operational doctrine lives in `Sigma/SIGMA_CONSTITUTION.md` and `Sigma/SIGMA_PROTOCOL.md` — those files are already copied into the project by `sigma project start`. There is no value in writing pseudo lock events with fake versions into the decision log; it would mislead agents querying for real Director decisions.

The `seedMemory` function signature:

```typescript
export function initDecisionsFile(projectRoot: string): void
// Creates Sigma/memory/decisions.jsonl as empty file if not exists
// Non-blocking — any error printed to stderr, never thrown
```

Renamed from `seedMemory` to `initDecisionsFile` to make the behavior unambiguous.

---

### 8. Config Constants

Two new constants added to `src/config.ts`:

```typescript
export const GLOBAL_MEMORY_FILE = path.join(GLOBAL_SIGMA_DIR, 'memory_sigma.jsonl');
export const PROJECT_DECISIONS_FILE = path.join(PROJECT_SIGMA_DIR, 'memory', 'decisions.jsonl');
```

Path safety: `PROJECT_SIGMA_DIR = 'Sigma'` is a relative string constant (confirmed in config.ts). Therefore `path.join(projectRoot, PROJECT_DECISIONS_FILE)` always resolves correctly as `{projectRoot}/Sigma/memory/decisions.jsonl`. No absolute-path collision risk.

---

### 9. Version Bump

`0.4.0` → `0.5.0` in `package.json` and `src/config.ts`.

---

### 10. SIGMA_PROTOCOL.md Section 24

The `[PHASE 5]` placeholder at Section 24 is replaced with the full memory model spec. No new section is created — Section 24 already exists at line 1203.

Content must cover:

1. **Memory Architecture** — Two tiers: per-project `decisions.jsonl` (CLI writes on lock) vs global `memory_sigma.jsonl` (agent-managed, Director-curated). Both JSONL. CLI writes only to `decisions.jsonl`.
2. **DecisionEntry Schema** — Full field table with type, artifact scope, and extraction source.
3. **Harvest Trigger Table** — Which lock event produces which fields (see Design Decision 4 table).
4. **Non-Blocking Guarantee** — Harvest failure never aborts lock operation.
5. **MCP Configuration** — `sigma setup memory` creates `memory_sigma.jsonl`; agents configure MCP server; CLI does not populate global memory.
6. **Agent Query Pattern** — `search_nodes({ query: "..." })` for semantic search; `read_graph()` for full graph; filter by `artifact` field.
7. **Memory Promotion Policy** — see Design Decision 11.

---

### 11. Memory Promotion Policy

The following policy applies to both `decisions.jsonl` and `memory_sigma.jsonl`. It must be documented in SIGMA_PROTOCOL.md Section 24.

- **Project decision log** (`decisions.jsonl`): populated automatically by CLI on lock events. Read-only for agents — they query but do not write to it via CLI. Agents may reference entries when drafting artifacts.
- **Global memory** (`memory_sigma.jsonl`): written exclusively by agents via MCP `create_entities`, `add_observations`, etc. Agents may propose memory candidates; only Director-approved items are promoted to global memory.
- **Promotion boundary**: project-specific facts (implementation details, known issues, deviation notes) must stay in project artifacts, CSO files, or `decisions.jsonl`. Only generalizable, reusable knowledge is promoted to global memory.
- **No auto-promotion**: no CLI command or lock event automatically writes to `memory_sigma.jsonl`. The CLI has no reference to this file at runtime (only `sigma setup memory` touches it at setup time).

---

## Phase 5 Output Files

| File | Action | Description |
| :--- | :--- | :--- |
| `src/engine/memory.ts` | Create | Harvest engine: `DecisionEntry` type, `extractSection`, per-artifact harvest functions (5 total), JSONL append, `initDecisionsFile` |
| `src/commands/intent.ts` | Modify | After `writeProgress`: call `harvestIntentLock` |
| `src/commands/roadmap.ts` | Modify | After `writeProgress` in `lock`: call `harvestRoadmapLock` |
| `src/commands/plan.ts` | Modify | After `writeProgress`: call `harvestPlanLock` |
| `src/commands/exec.ts` | Modify | After `writeProgress`: call `harvestExecLock` |
| `src/commands/close.ts` | Modify | After `writeProgress`: call `harvestCloseLock` |
| `src/commands/project.ts` | Modify | After `progress.json` created: call `initDecisionsFile(projectRoot)` |
| `src/commands/setup.ts` | Modify | Add `setup memory` subcommand (`runMemorySetup`) |
| `src/config.ts` | Update | Add `GLOBAL_MEMORY_FILE`, `PROJECT_DECISIONS_FILE`; version bump to 0.5.0 |
| `package.json` | Update | Version bump `0.4.0` → `0.5.0` |
| `Sigma/SIGMA_PROTOCOL.md` | Update | Fill Section 24 `[PHASE 5]` placeholder |

---

## Task 1 — Create `src/engine/memory.ts`

### 1a. Imports and Constants

```typescript
import fs from 'fs-extra';
import path from 'path';
import { PROJECT_DECISIONS_FILE } from '../config';
```

### 1b. DecisionEntry Interface

```typescript
export interface DecisionEntry {
  artifact: 'INTENT' | 'ROADMAP' | 'PLAN' | 'EXEC' | 'CLOSE';
  version: string;
  lock_event: 'intent.lock' | 'roadmap.lock' | 'plan.lock' | 'exec.lock' | 'close.lock';
  source_file: string;
  timestamp: string;
  director_notes: string;
  risk_notes: string;
  evidence_references: string;
  stage_summary?: string;
  recommended_next_plan?: string;
  pending_items?: string;
  task_plan_summary?: string;
  test_contract_summary?: string;
  implementation_summary?: string;
  known_issues?: string;
  plan_refs?: string;
  exec_refs?: string;
  closure_verdict?: string;
  accepted_limitations?: string;
}
```

### 1c. Section Extractor (private)

```typescript
function extractSection(content: string, pattern: RegExp): string {
  const match = content.match(pattern);
  if (!match || match.index === undefined) return '';
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/^## /m);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  return section.trim();
}
```

### 1d. JSONL Append (private)

```typescript
function appendEntry(projectRoot: string, entry: DecisionEntry): void {
  const filePath = path.join(projectRoot, PROJECT_DECISIONS_FILE);
  fs.ensureFileSync(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}
```

### 1e. Per-Artifact Harvest Functions

Five exported functions — one per lock event. All follow the same structure:

```typescript
export function harvestIntentLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const entry: DecisionEntry = {
      artifact: 'INTENT',
      version,
      lock_event: 'intent.lock',
      source_file: sourceFile,
      timestamp: new Date().toISOString(),
      director_notes: extractSection(content, /^## .*director/im),
      risk_notes: extractSection(content, /^## 8\. Risk/im),
      evidence_references: extractSection(content, /^## 2\. Success Definition/im),
    };
    appendEntry(projectRoot, entry);
  } catch (e) {
    process.stderr.write(`[harvest] intent.lock error — skipping: ${(e as Error).message}\n`);
  }
}

export function harvestRoadmapLock(projectRoot: string, version: string, sourceFile: string): void {
  try {
    const absPath = path.join(projectRoot, sourceFile);
    if (!fs.existsSync(absPath)) {
      process.stderr.write(`[harvest] source file not found — skipping: ${sourceFile}\n`);
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    const entry: DecisionEntry = {
      artifact: 'ROADMAP',
      version,
      lock_event: 'roadmap.lock',
      source_file: sourceFile,
      timestamp: new Date().toISOString(),
      director_notes: extractSection(content, /^## 9\. Director Roadmap Notes/im),
      risk_notes: '',
      evidence_references: extractSection(content, /^## 2\. Source Intent Alignment/im),
      stage_summary: extractSection(content, /^## 3\. Stage Overview/im),
      recommended_next_plan: extractSection(content, /^## 8\. FMN Roadmap Notes/im),
      pending_items: extractSection(content, /^## 7\. Pending Items/im),
    };
    appendEntry(projectRoot, entry);
  } catch (e) {
    process.stderr.write(`[harvest] roadmap.lock error — skipping: ${(e as Error).message}\n`);
  }
}

export function harvestPlanLock(projectRoot: string, version: string, sourceFile: string): void {
  // same pattern:
  // artifact: 'PLAN', lock_event: 'plan.lock'
  // task_plan_summary: ## 2. Work Order / Task Plan
  // test_contract_summary: ## 5. Pre-Build Test Contract
  // director_notes: last heading matching /director/i
  // risk_notes: '' (PLAN doesn't have a risk section — use empty string)
  // evidence_references: '' (not in PLAN template)
}

export function harvestExecLock(projectRoot: string, version: string, sourceFile: string): void {
  // artifact: 'EXEC', lock_event: 'exec.lock'
  // implementation_summary: ## 2. Implementation Approach
  // known_issues: heading matching /known.*(issues|limitations)/i or ''
  // director_notes: last heading matching /director/i
  // risk_notes: ''
  // evidence_references: ''
}

export function harvestCloseLock(projectRoot: string, version: string, sourceFile: string): void {
  // artifact: 'CLOSE', lock_event: 'close.lock'
  // plan_refs: ## 3. Evidence References
  // exec_refs: ## 3. Evidence References (same content)
  // closure_verdict: ## 10. Director Closure Decision Notes
  // accepted_limitations: ## 6. Known Limitations
  // director_notes: ## 10. Director Closure Decision Notes (same as closure_verdict)
  // risk_notes: ''
  // evidence_references: ## 3. Evidence References
}
```

Pseudocode bodies shown for PLAN/EXEC/CLOSE above — full implementations follow the same pattern as INTENT and ROADMAP above.

### 1f. initDecisionsFile

```typescript
export function initDecisionsFile(projectRoot: string): void {
  try {
    const filePath = path.join(projectRoot, PROJECT_DECISIONS_FILE);
    fs.ensureFileSync(filePath);
  } catch (e) {
    process.stderr.write(`[memory] failed to initialize decisions.jsonl: ${(e as Error).message}\n`);
  }
}
```

Creates an empty file. Does not write any entries.

---

## Task 2 — Wire Harvest into Lock Commands

### 2a. `src/commands/intent.ts` — `intent lock`

```typescript
import { harvestIntentLock } from '../engine/memory';
```

In the `lock` action, immediately after `writeProgress(projectRoot, data)`:

```typescript
const activeVer = data.intent.active_version!;
const sourceFile = data.intent.versions.find(v => v.version === activeVer)?.file ?? '';
harvestIntentLock(projectRoot, activeVer, sourceFile);
```

### 2b. `src/commands/roadmap.ts` — `roadmap lock`

```typescript
import { harvestRoadmapLock } from '../engine/memory';
```

After `writeProgress`:

```typescript
const activeVer = data.roadmap.active_version!;
const sourceFile = data.roadmap.versions.find(v => v.version === activeVer)?.file ?? '';
harvestRoadmapLock(projectRoot, activeVer, sourceFile);
```

### 2c. `src/commands/plan.ts` — `plan lock`

```typescript
import { harvestPlanLock } from '../engine/memory';
```

After `writeProgress`:

```typescript
const activeVer = data.plan.active_version!;
const sourceFile = data.plan.versions.find(v => v.version === activeVer)?.file ?? '';
harvestPlanLock(projectRoot, activeVer, sourceFile);
```

### 2d. `src/commands/exec.ts` — `exec lock`

```typescript
import { harvestExecLock } from '../engine/memory';
```

After `writeProgress`:

```typescript
const activeVer = data.exec.active_version!;
const sourceFile = data.exec.versions.find(v => v.version === activeVer)?.file ?? '';
harvestExecLock(projectRoot, activeVer, sourceFile);
```

### 2e. `src/commands/close.ts` — `close lock`

```typescript
import { harvestCloseLock } from '../engine/memory';
```

After `writeProgress`:

```typescript
const activeVer = data.close.active_version!;
const sourceFile = data.close.versions.find(v => v.version === activeVer)?.file ?? '';
harvestCloseLock(projectRoot, activeVer, sourceFile);
```

---

## Task 3 — Init decisions.jsonl on Project Start

In `src/commands/project.ts`, `runStart` function. Add import:

```typescript
import { initDecisionsFile } from '../engine/memory';
```

After `fs.writeJsonSync(progressPath, initial, { spaces: 2 })`:

```typescript
initDecisionsFile(projectRoot);
console.log('  Memory: Sigma/memory/decisions.jsonl initialized (empty).');
```

---

## Task 4 — `sigma setup memory` in `setup.ts`

### 4a. Import

Add to existing imports:

```typescript
import { GLOBAL_MEMORY_FILE } from '../config';
```

### 4b. `runMemorySetup` Function

```typescript
function runMemorySetup(): void {
  if (!fileExists(GLOBAL_SIGMA_DIR)) {
    error('Sigma is not installed. Run: sigma setup install');
  }

  const alreadyExists = fileExists(GLOBAL_MEMORY_FILE);
  if (!alreadyExists) {
    fs.ensureFileSync(GLOBAL_MEMORY_FILE);
    success(`Memory file created: ${GLOBAL_MEMORY_FILE}`);
  } else {
    info(`Memory file already configured: ${GLOBAL_MEMORY_FILE}`);
  }

  const mcpConfig = {
    mcpServers: {
      'sigma-memory': {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: { MEMORY_FILE_PATH: GLOBAL_MEMORY_FILE },
      },
    },
  };

  console.log('\n=== Sigma MCP Memory Setup ===\n');
  console.log(`  Memory file: ${GLOBAL_MEMORY_FILE}\n`);
  console.log('Add to your MCP configuration (.mcp.json or equivalent):\n');
  console.log(JSON.stringify(mcpConfig, null, 2));
  console.log('\nAgents query memory using MCP tools: search_nodes, read_graph');
  console.log('Project decision log: Sigma/memory/decisions.jsonl (per-project, CLI-written)\n');
}
```

### 4c. Register as Subcommand

In `setupCommand()`, after the `update` subcommand block:

```typescript
cmd
  .command('memory')
  .description('Configure Sigma MCP memory node store (~/.sigma/memory_sigma.jsonl)')
  .action(() => {
    try { runMemorySetup(); } catch (e) { error((e as Error).message); }
  });
```

---

## Task 5 — Config and Version Updates

### 5a. `src/config.ts`

After `GLOBAL_BRIDGE_DIR`:

```typescript
export const GLOBAL_MEMORY_FILE = path.join(GLOBAL_SIGMA_DIR, 'memory_sigma.jsonl');
```

After `DOCUMENT_REGISTRY_FILE`:

```typescript
export const PROJECT_DECISIONS_FILE = path.join(PROJECT_SIGMA_DIR, 'memory', 'decisions.jsonl');
```

Bump version:

```typescript
export const SIGMA_VERSION = '0.5.0';
```

### 5b. `package.json`

```json
"version": "0.5.0"
```

---

## Task 6 — Fill SIGMA_PROTOCOL.md Section 24

Replace the placeholder at Section 24 (line 1205) with full memory model spec covering all 7 items from Design Decision 10 plus Memory Promotion Policy (Design Decision 11).

Key tables to include:

**Harvest trigger table:**

| Lock Event | Artifact-Specific Fields Added |
| :--- | :--- |
| `intent.lock` | (base fields only) |
| `roadmap.lock` | `stage_summary`, `recommended_next_plan`, `pending_items` |
| `plan.lock` | `task_plan_summary`, `test_contract_summary` |
| `exec.lock` | `implementation_summary`, `known_issues` |
| `close.lock` | `plan_refs`, `exec_refs`, `closure_verdict`, `accepted_limitations` |

**Memory tier table:**

| Tier | File | Writer | Reader | Scope |
| :--- | :--- | :--- | :--- | :--- |
| Project decision log | `Sigma/memory/decisions.jsonl` | CLI (lock events) | Agents via MCP | Per-project |
| Global memory | `~/.sigma/memory_sigma.jsonl` | Agents via MCP | Agents via MCP | Cross-project |

---

## Acceptance Criteria

| # | Criterion |
| :--- | :--- |
| AC-01 | `sigma intent lock` appends exactly one line to `Sigma/memory/decisions.jsonl`; line is valid JSON; `artifact == "INTENT"`, `lock_event == "intent.lock"` |
| AC-02 | `sigma roadmap lock` appends one line with `artifact == "ROADMAP"`; `stage_summary`, `recommended_next_plan`, and `pending_items` fields always present (value may be `""`) |
| AC-03 | `sigma plan lock` appends one line with `artifact == "PLAN"`; `task_plan_summary` and `test_contract_summary` always present (value may be `""`) |
| AC-04 | `sigma exec lock` appends one line with `artifact == "EXEC"`; `implementation_summary` and `known_issues` always present (value may be `""`) |
| AC-05 | `sigma close lock` appends one line with `artifact == "CLOSE"`; `plan_refs`, `exec_refs`, `closure_verdict`, `accepted_limitations` always present (value may be `""`) |
| AC-06 | Every appended line in `decisions.jsonl` is parseable with `JSON.parse` — one JSON object per line, no trailing commas, no multi-line entries |
| AC-07 | If the artifact file at `source_file` does not exist at harvest time, a warning is printed to stderr and the lock command exits 0 (lock still completes) |
| AC-08 | Any other exception during harvest is caught, printed to stderr, and does not abort the lock command |
| AC-09 | `sigma setup memory` creates `~/.sigma/memory_sigma.jsonl` as an empty file when it does not exist |
| AC-10 | `sigma setup memory` prints the MCP config JSON snippet including the absolute resolved path to `memory_sigma.jsonl` |
| AC-11 | Re-running `sigma setup memory` when file already exists prints "already configured" and does NOT truncate or overwrite the file |
| AC-12 | `sigma project start` creates `Sigma/memory/decisions.jsonl` as an empty file — zero bytes or zero lines |
| AC-13 | No seed entries are written to `decisions.jsonl` by `sigma project start` |
| AC-14 | `extractSection` returns `''` for a heading that does not exist in the file — no exception thrown |
| AC-15 | `npm run build` passes with 0 TypeScript errors |
| AC-16 | `SIGMA_VERSION` in `config.ts` and `version` in `package.json` are both `"0.5.0"` |
| AC-17 | SIGMA_PROTOCOL.md Section 24 contains the `DecisionEntry` schema table, harvest trigger table, memory tier table, and Memory Promotion Policy — the `[PHASE 5]` placeholder is replaced |

---

*PLAN-5 — Phase 5: Memory & Decision Harvest — drafted 2026-05-16, patched post-Director review 2026-05-16*
