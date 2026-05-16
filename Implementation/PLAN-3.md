# Implementation Plan — Phase 3: CLI Foundation

**Phase**: 3 of 7
**Goal**: Build the `sigma` CLI binary — package scaffold, core state engine, and all infrastructure commands (setup, project, session, gitignore). Artifact lifecycle commands (intent, plan, exec, close, git, cso) are Phase 4.
**Status**: PENDING
**Prerequisites**: Phase 0B complete (SIGMA-OPERATION-REGISTRY.json + SIGMA-REGISTRY.json + progress.json schema), Phase 1 complete (5 templates), Phase 2 complete (4 rule files), Phase 2b complete (ROADMAP artifact — template, protocol, registry entries)

---

## Source Material

| File | Role |
| :--- | :--- |
| `sigma_phase_implementation.md` — Phase 3 section | Phase 3 task list and tech stack declaration |
| `Sigma/SIGMA-OPERATION-REGISTRY.json` | Pre-conditions, post-conditions, gating logic for all operations |
| `Sigma/progress.json` | Schema and seed file — ground truth for state engine |
| `Sigma/SIGMA-REGISTRY.json` | Document authority registry — read by session bootstrap |
| `Sigma/SIGMA_PROTOCOL.md` Section 22 | Phase 3 placeholder — filled in Task 9 |
| `Sigma/templates/*` | 6 templates (incl. ROADMAP-TEMPLATE.md from Phase 2b) — bundled in setup install for deployment |
| `Sigma/rules/*` | 4 rule files — bundled in setup install for deployment |

---

## Design Decisions

### 1. Language: TypeScript, CommonJS Output

TypeScript provides compile-time type safety for `progress.json` schema, state machine transitions, and gate enforcement. Mistakes in state management are caught at build time, not at runtime inside a project.

Output target: `CommonJS` (`"module": "commonjs"` in tsconfig). Avoids ESM interop issues with older Node.js environments.

Source lives in `src/` (TypeScript). Compiled output lives in `dist/` (JavaScript). Binary entry point `bin/sigma.js` requires `dist/cli.js`.

**Note**: `sigma_phase_implementation.md` listed `.js` extensions (written before TypeScript was evaluated). TypeScript is recommended here for type correctness — Director may redirect to plain JavaScript if preferred.

---

### 2. Package and Folder Structure

The CLI source lives at the sigma-ecosystem project root alongside `Sigma/`:

```
sigma-ecosystem/            ← Project root
├── Sigma/                  ← Governance layer (existing)
├── Discussion/             ← (existing)
├── Implementation/         ← (existing)
├── src/                    ← CLI source (TypeScript)
│   ├── cli.ts              ← Entry point, top-level command registration
│   ├── config.ts           ← Paths, constants, version
│   ├── engine/
│   │   ├── progress.ts     ← progress.json read/write/validate/mutate
│   │   └── registry.ts     ← SIGMA-OPERATION-REGISTRY.json loader
│   ├── commands/
│   │   ├── setup.ts        ← sigma setup install | update
│   │   ├── project.ts      ← sigma project start | status | sync | reset | register
│   │   ├── session.ts      ← sigma session bootstrap
│   │   └── gitignore.ts    ← sigma gitignore generate
│   └── utils/
│       ├── fs.ts           ← File system helpers (copy, ensure, backup)
│       └── output.ts       ← Console output formatting (chalk wrappers)
├── dist/                   ← Compiled output (gitignored)
├── bin/
│   └── sigma.js            ← Binary entry point (requires dist/cli.js)
├── package.json
├── tsconfig.json
└── .gitignore              ← Node.js + dist/ exclusions
```

---

### 3. Runtime Dependencies

Mirrors Delta CLI dependency set (per `sigma_phase_implementation.md`):

| Package | Purpose |
| :--- | :--- |
| `commander` | Command parsing and subcommand tree |
| `chalk` | Terminal color output |
| `fs-extra` | File system operations (copy, ensureDir, remove, move) |
| `inquirer` | Interactive prompts (used in `setup install` confirmation) |

Dev dependencies: `typescript`, `@types/node`, `@types/fs-extra`, `@types/inquirer`

---

### 4. Phase 3 Command Scope

Phase 3 implements **infrastructure commands only** — no artifact lifecycle state:

| Domain | Commands in Phase 3 |
| :--- | :--- |
| `setup` | `install`, `update` |
| `project` | `start`, `status`, `sync`, `reset`, `register` |
| `session` | `bootstrap` |
| `gitignore` | `generate` |

**Not in Phase 3:**
- `setup memory` → Phase 5 (requires memory architecture)
- `intent`, `plan`, `exec`, `close`, `roadmap`, `git`, `cso` → Phase 4

---

### 5. Global `~/.sigma/` Directory Structure

Created by `sigma setup install`:

```
~/.sigma/
├── templates/                  ← Deployed copies of all artifact templates
│   ├── DIR-INTENT-TEMPLATE.md
│   ├── FMN-PLAN-TEMPLATE.md
│   ├── DEV-EXEC-TEMPLATE.md
│   ├── DIR-CLOSE-TEMPLATE.md
│   ├── CSO-TEMPLATE.md
│   └── ROADMAP-TEMPLATE.md
├── rules/                      ← Deployed copies of all role rule files
│   ├── ARC-RULE.md
│   ├── AUD-RULE.md
│   ├── FMN-RULE.md
│   └── DEV-RULE.md
├── governance/                 ← Deployed copies of protocol documents
│   ├── SIGMA_CONSTITUTION.md
│   └── SIGMA_PROTOCOL.md
├── bridge/                     ← Bridge file templates (Phase 6)
│   ├── CLAUDE.md
│   ├── GEMINI.md
│   └── AGENTS.md
├── projects.json               ← Global project registry
└── sigma.config.json           ← Global CLI configuration
```

**Source for deployed files**: bundled inside the npm package. `sigma setup install` copies from the package bundle to `~/.sigma/`. `sigma setup update` re-copies without touching any project's `Sigma/` folder.

Bridge files (`bridge/`) are seeded as empty stubs in Phase 3. Phase 6 writes their content.

---

### 6. `sigma project start` Initialization Sequence

Creates the following in the current directory (project root):

1. `Sigma/` folder with subfolders: `design/`, `build/`, `close/`, `rules/`, `logs/`, `memory/`
2. Copies governance documents from `~/.sigma/governance/` → `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/SIGMA_PROTOCOL.md`
3. Copies rule files from `~/.sigma/rules/` → `Sigma/rules/*.md`
4. Creates `Sigma/SIGMA-REGISTRY.json` and `Sigma/SIGMA-OPERATION-REGISTRY.json` (copied from package bundle)
5. Creates `Sigma/progress.json` (initial seed state — lifecycle_state: DESIGN, all artifact arrays empty, all gates false)
6. Creates bridge files at project root: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` (Phase 3: stubs; Phase 6: real content)
7. Registers project in `~/.sigma/projects.json`
8. Prompts for `project_id` (short uppercase) and `project_name` if not passed via flags

**Flags**: `--id <PROJECT_ID>` `--name <project_name>` `--confirm` (skip interactive prompts)

**Idempotency**: If `Sigma/progress.json` already exists, `sigma project start` aborts with an error unless `--reinit` is passed. `--reinit` backs up existing `progress.json` to `Sigma/logs/` before rewriting.

---

### 7. `sigma session bootstrap` Output Format

Reads `Sigma/progress.json` and `Sigma/SIGMA-REGISTRY.json`. Outputs:

```
=== Sigma Session Bootstrap ===

Project: {project_name} ({project_id})
Lifecycle Phase: {lifecycle_state}

--- Artifact Status ---
INTENT:  {active_version | none} [{active_state | —}]
PLAN:    {active_version | none} [{active_state | —}]
EXEC:    {active_version | none} [{active_state | —}]
CLOSE:   {active_version | none} [{active_state | —}]

--- Gate Status ---
Gate 1 (DESIGN Complete):   {OPEN | BLOCKED}
Gate 2 (PLAN Locked):       {OPEN | BLOCKED}
Gate 3 (BUILD Evidence):    {SATISFIED | BLOCKED | STALE}

--- STALE_INTENT Warnings ---
{list of stale plan/exec versions, or: none}

--- Recent CSO Files ---
{up to 3 most recent CSO entries from logs/, or: none}

--- Next Valid Operations ---
{list of operations whose pre-conditions are currently satisfied}

--- Documents to Read ---
{list based on active role if --role flag passed; otherwise: full governance document list}
```

**Flags**: `--role <ARC|AUD|FMN|DEV>` (filters "Documents to Read" to role-specific list)

---

### 8. SIGMA-OPERATION-REGISTRY Enforcement Approach

Phase 3 does **not** implement generic dynamic operation enforcement. Each command validates its own pre-conditions directly from `progress.json`.

`registry.ts` is a loader only in Phase 3 — it reads and parses `SIGMA-OPERATION-REGISTRY.json` for reference and for `session bootstrap` display, but does not dynamically enforce gates.

Full dynamic enforcement (read pre-condition from registry, validate against progress.json, emit operation-registry-defined error messages) is Phase 4 work — implemented once artifact commands exist.

---

### 9. Schema Version and Migration

`progress.json` schema_version is `"1.0.0"` for Phase 3.

Phase 3 validates schema_version on read. If version mismatch is detected, CLI warns but does not block. Full migration logic (auto-migrate older schemas, block newer schemas) is Phase 4 work — schema is not expected to change before Phase 4.

---

### 10. SIGMA_PROTOCOL.md Section 22

Section 22 (CLI Setup & Installation) must be filled in as part of Phase 3. The placeholder `> **[PHASE 3]**` is replaced with the actual spec covering:

- `sigma setup install` behavior
- `~/.sigma/` structure
- `sigma project start` initialization sequence
- `sigma session bootstrap` output format
- Project ID and name requirements
- Schema version handling

---

## Phase 3 Output Files

| File | Action | Description |
| :--- | :--- | :--- |
| `package.json` | Create | npm package, bin entry, dependencies |
| `tsconfig.json` | Create | TypeScript config, CommonJS output |
| `.gitignore` | Create | Node.js + dist/ exclusions |
| `bin/sigma.js` | Create | Binary entry point |
| `src/cli.ts` | Create | Top-level CLI, command registration |
| `src/config.ts` | Create | Paths, constants, package version |
| `src/engine/progress.ts` | Create | progress.json CRUD + state engine |
| `src/engine/registry.ts` | Create | SIGMA-OPERATION-REGISTRY.json loader |
| `src/commands/setup.ts` | Create | `sigma setup install \| update` |
| `src/commands/project.ts` | Create | `sigma project start \| status \| sync \| reset \| register` |
| `src/commands/session.ts` | Create | `sigma session bootstrap` |
| `src/commands/gitignore.ts` | Create | `sigma gitignore generate` |
| `src/utils/fs.ts` | Create | File system helpers |
| `src/utils/output.ts` | Create | Console output formatting |
| `Sigma/SIGMA_PROTOCOL.md` | Update | Fill Section 22 with Phase 3 spec |

---

## Task 1 — Package Scaffold

### `package.json`

```json
{
  "name": "sigma-cli",
  "version": "0.3.0",
  "description": "Sigma — Lightweight project governance CLI",
  "bin": {
    "sigma": "./bin/sigma.js"
  },
  "main": "./dist/cli.js",
  "files": ["bin/", "dist/", "Sigma/templates/", "Sigma/rules/", "Sigma/SIGMA_CONSTITUTION.md", "Sigma/SIGMA_PROTOCOL.md", "Sigma/SIGMA-REGISTRY.json", "Sigma/SIGMA-OPERATION-REGISTRY.json"],
  "scripts": {
    "build": "tsc",
    "start": "node bin/sigma.js",
    "prepare": "npm run build"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^4.1.2",
    "fs-extra": "^11.0.0",
    "inquirer": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/fs-extra": "^11.0.0",
    "@types/inquirer": "^8.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Version note**: `0.3.0` — Phase 3 (Foundation). Phase 4 bumps to `0.4.0`. Stable release (Phase 7) is `1.0.0`.

**`chalk` version note**: Chalk v5+ is ESM-only. Pin to `^4.1.2` (CommonJS-compatible) to match CommonJS output target.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `bin/sigma.js`

```js
#!/usr/bin/env node
require('../dist/cli.js');
```

Must have execute permission. The `#!/usr/bin/env node` shebang is required for global binary invocation.

### `.gitignore`

```
node_modules/
dist/
*.js.map
```

---

## Task 2 — Core Infrastructure

### `src/config.ts`

Constants used across all commands:

```typescript
import path from 'path';
import os from 'os';

export const SIGMA_VERSION = '0.3.0';
export const SCHEMA_VERSION = '1.0.0';

export const GLOBAL_SIGMA_DIR = path.join(os.homedir(), '.sigma');
export const GLOBAL_TEMPLATES_DIR = path.join(GLOBAL_SIGMA_DIR, 'templates');
export const GLOBAL_RULES_DIR = path.join(GLOBAL_SIGMA_DIR, 'rules');
export const GLOBAL_GOVERNANCE_DIR = path.join(GLOBAL_SIGMA_DIR, 'governance');
export const GLOBAL_BRIDGE_DIR = path.join(GLOBAL_SIGMA_DIR, 'bridge');
export const GLOBAL_PROJECTS_FILE = path.join(GLOBAL_SIGMA_DIR, 'projects.json');
export const GLOBAL_CONFIG_FILE = path.join(GLOBAL_SIGMA_DIR, 'sigma.config.json');

export const PROJECT_SIGMA_DIR = 'Sigma';
export const PROGRESS_FILE = path.join(PROJECT_SIGMA_DIR, 'progress.json');
export const OPERATION_REGISTRY_FILE = path.join(PROJECT_SIGMA_DIR, 'SIGMA-OPERATION-REGISTRY.json');
export const DOCUMENT_REGISTRY_FILE = path.join(PROJECT_SIGMA_DIR, 'SIGMA-REGISTRY.json');

export const SUBFOLDERS = ['design', 'build', 'close', 'rules', 'logs', 'memory'];
```

### `src/engine/progress.ts`

Provides typed read, write, validate, and mutate operations for `progress.json`.

**Types to define** (matching `Sigma/progress.json` schema from Phase 0B):

```typescript
type LifecycleState = 'DESIGN' | 'BUILD' | 'CLOSE' | 'CLOSED';
type IntentState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
type PlanState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
type ExecState = 'DRAFT' | 'BUILDING' | 'TESTING' | 'COMPLETED' | 'LOCKED' | 'SUPERSEDED';
type CloseState = 'DRAFT' | 'LOCKED' | 'SUPERSEDED';
type CsoState = 'DRAFT' | 'COMPLETE';

interface ProgressJson { ... }  // full schema from Phase 0B
```

**Functions to implement**:

| Function | Behavior |
| :--- | :--- |
| `readProgress(projectRoot: string): ProgressJson` | Read and parse progress.json. Error if missing. |
| `writeProgress(projectRoot: string, data: ProgressJson): void` | Write progress.json (atomically via temp file + rename). Update `updated_at`. |
| `validateProgress(data: unknown): ProgressJson` | Validate schema. Throw if required fields missing or types wrong. |
| `createInitialProgress(projectId: string, projectName: string): ProgressJson` | Return initial seed state. |
| `checkSchemaVersion(data: ProgressJson): void` | Compare `schema_version` against `SCHEMA_VERSION`. Warn if mismatch (Phase 3 does not block or migrate). |
| `getGateStatus(data: ProgressJson): GateStatus` | Return gate_1_open, gate_2_open, gate_3_satisfied. |
| `isStaleIntentPresent(data: ProgressJson): StaleIntentWarning[]` | Return list of PLAN/EXEC versions with stale_intent=true. |
| `getNextValidOperations(data: ProgressJson): string[]` | Return list of operations whose pre-conditions are met (used in session bootstrap). |

### `src/engine/registry.ts`

Loads and parses `SIGMA-OPERATION-REGISTRY.json`.

**Functions**:

| Function | Behavior |
| :--- | :--- |
| `loadOperationRegistry(projectRoot: string): OperationRegistry` | Read and parse SIGMA-OPERATION-REGISTRY.json. |
| `getOperation(registry: OperationRegistry, operationId: string): Operation \| undefined` | Look up a specific operation by ID. |

Phase 3 uses this for `session bootstrap` output only. Gate enforcement via registry is Phase 4.

### `src/utils/fs.ts`

Wrappers around `fs-extra`:

| Function | Behavior |
| :--- | :--- |
| `ensureDir(dir: string): void` | Ensure directory exists (create if not). |
| `copyFile(src: string, dest: string): void` | Copy single file. |
| `copyDir(src: string, dest: string): void` | Copy directory recursively. |
| `backupFile(filePath: string, backupDir: string): string` | Copy file to backupDir with timestamp suffix. Returns backup path. |
| `fileExists(filePath: string): boolean` | True if file exists. |
| `findProjectRoot(): string` | Walk up from cwd to find a directory containing `Sigma/progress.json`. Throws if not found. |

### `src/utils/output.ts`

Chalk wrappers for consistent output:

| Function | Behavior |
| :--- | :--- |
| `success(msg: string): void` | Green output |
| `info(msg: string): void` | Cyan output |
| `warn(msg: string): void` | Yellow output |
| `error(msg: string): void` | Red output, then `process.exit(1)` |
| `section(title: string): void` | Section divider with `---` |
| `table(rows: string[][]): void` | Simple aligned table output |

---

## Task 3 — `sigma setup` Commands

### `sigma setup install`

**Pre-conditions**: None (no progress.json required)
**Post-conditions**: `~/.sigma/` exists with all subdirectories and files

Behavior:

1. If `~/.sigma/` already exists, prompt "Sigma is already installed. Reinstall? (y/N)" unless `--force` flag passed.
2. Create `~/.sigma/` directory and all subdirectories.
3. Copy templates from package bundle → `~/.sigma/templates/`.
4. Copy rule files from package bundle → `~/.sigma/rules/`.
5. Copy governance files from package bundle → `~/.sigma/governance/`.
6. Create empty bridge file stubs in `~/.sigma/bridge/` (Phase 6 writes real content).
7. Create `~/.sigma/projects.json` with initial structure if not present.
8. Create `~/.sigma/sigma.config.json` with initial config if not present.
9. Output success summary.

**Package bundle structure**: The `files` array in `package.json` includes `Sigma/templates/`, `Sigma/rules/`, `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/SIGMA_PROTOCOL.md`, `Sigma/SIGMA-REGISTRY.json`, `Sigma/SIGMA-OPERATION-REGISTRY.json`. Install reads from these paths relative to the package root.

**`~/.sigma/projects.json` initial state**:

```json
{
  "schema_version": "1.0.0",
  "projects": []
}
```

**`~/.sigma/sigma.config.json` initial state**:

```json
{
  "schema_version": "1.0.0",
  "cli_version": "0.3.0",
  "installed_at": "<ISO 8601 timestamp>"
}
```

---

### `sigma setup update`

**Pre-conditions**: `~/.sigma/` must exist (i.e., `sigma setup install` must have run first)
**Post-conditions**: `~/.sigma/templates/`, `~/.sigma/rules/`, `~/.sigma/governance/` are updated from package bundle

Behavior:

1. Check `~/.sigma/` exists. If not: error "Run `sigma setup install` first."
2. Back up current `~/.sigma/templates/`, `~/.sigma/rules/`, `~/.sigma/governance/` to `~/.sigma/backups/{timestamp}/`.
3. Copy updated files from package bundle → `~/.sigma/` subdirectories.
4. Update `cli_version` in `~/.sigma/sigma.config.json`.
5. Output list of files updated.
6. **Do NOT touch any project's `Sigma/` folder.**

If the Director wants to update a project's governance files, they must run `sigma project sync` explicitly.

---

## Task 4 — `sigma project` Commands

### `sigma project start`

**Pre-conditions**: `~/.sigma/` must exist. Current directory must not already have `Sigma/progress.json` (unless `--reinit`).
**Post-conditions**: `Sigma/` folder structure created, `progress.json` seeded, bridge files created, project registered.

Behavior:

1. If `~/.sigma/` does not exist: error "Run `sigma setup install` first."
2. If `Sigma/progress.json` already exists and `--reinit` not passed: error "This directory is already a Sigma project. Use `sigma project status` to inspect, or pass `--reinit` to re-initialize."
3. If `--reinit` passed: back up `Sigma/progress.json` to `Sigma/logs/progress-backup-{timestamp}.json`.
4. Collect `project_id` and `project_name`:
   - From `--id` and `--name` flags if provided.
   - Otherwise: interactive prompts.
   - `project_id`: short uppercase, e.g. `MYPROJ`. Validated: uppercase alphanumeric + hyphen, max 12 chars.
   - `project_name`: free text, max 64 chars.
5. Create `Sigma/` and all subfolders: `design/`, `build/`, `close/`, `rules/`, `logs/`, `memory/`.
6. Copy from `~/.sigma/governance/` → `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/SIGMA_PROTOCOL.md`.
7. Copy from `~/.sigma/rules/` → `Sigma/rules/`.
8. Copy from package bundle → `Sigma/SIGMA-REGISTRY.json`, `Sigma/SIGMA-OPERATION-REGISTRY.json`.
9. Create `Sigma/progress.json` with initial seed state (project_id, project_name, lifecycle_state: DESIGN, all empty, schema_version: 1.0.0, created_at and updated_at: now).
10. Create bridge file stubs at project root: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` (stubs in Phase 3; Phase 6 writes real content).
    - Do not overwrite existing bridge files unless `--overwrite-bridge` is passed.
11. Register project in `~/.sigma/projects.json` (add entry or update path if project_id already present).
12. Output success summary with project path, project_id, and next step hint: "Run `sigma session bootstrap` to confirm state."

---

### `sigma project status`

**Pre-conditions**: Must be inside a Sigma project (finds `Sigma/progress.json` by walking up from cwd).
**Post-conditions**: Read-only — no state change.

Behavior:

1. Find project root via `findProjectRoot()`.
2. Read and validate `progress.json`.
3. Output:
   - Project name, project_id, lifecycle_state
   - Each artifact domain: active_version, active_state, stale_intent (if applicable)
   - Gate status: gate_1_open, gate_2_open, gate_3_satisfied
   - STALE_INTENT warnings if any
   - Last updated timestamp

---

### `sigma project sync`

**Pre-conditions**: Must be inside a Sigma project. `~/.sigma/` must exist.
**Post-conditions**: `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/SIGMA_PROTOCOL.md`, `Sigma/rules/*` updated from `~/.sigma/`.

Behavior:

1. Require explicit `--confirm` flag. Without it: error and show what would be updated (dry-run output).
2. Back up all files to be updated into `Sigma/logs/sync-backup-{timestamp}/` before writing.
3. Copy from `~/.sigma/governance/` → `Sigma/SIGMA_CONSTITUTION.md`, `Sigma/SIGMA_PROTOCOL.md`.
4. Copy from `~/.sigma/rules/` → `Sigma/rules/`.
5. Copy from package bundle → `Sigma/SIGMA-REGISTRY.json`, `Sigma/SIGMA-OPERATION-REGISTRY.json`.
6. Output: list of files updated, backup location.
7. **Does NOT touch `Sigma/progress.json`, `Sigma/design/`, `Sigma/build/`, `Sigma/close/`, `Sigma/logs/`, `Sigma/memory/`.**

---

### `sigma project reset`

**Pre-conditions**: Must be inside a Sigma project. Requires `--confirm`.
**Post-conditions**: `progress.json` reset to initial seed state, or (with `--wipe`) artifact files also archived.

Two modes:

**Soft reset** (default — `--confirm` only):
1. Back up `progress.json` to `Sigma/logs/progress-backup-{timestamp}.json`.
2. Write new initial seed `progress.json` (preserves project_id, project_name; resets all artifact arrays and gates).
3. `Sigma/design/`, `Sigma/build/`, `Sigma/close/` artifact files are NOT touched.

**Archive reset** (`--confirm --wipe`):
1. Soft reset steps above.
2. Archive all files in `Sigma/design/`, `Sigma/build/`, `Sigma/close/` to `Sigma/logs/reset-archive-{timestamp}/`.
3. Empty the artifact folders after archiving.
4. **Never permanently delete.** All files go to `Sigma/logs/`.

---

### `sigma project register`

**Pre-conditions**: Must be inside a Sigma project (`Sigma/progress.json` must exist). `~/.sigma/` must exist.
**Post-conditions**: Project entry added or updated in `~/.sigma/projects.json`.

Behavior:

1. Read `project_id` and `project_name` from `Sigma/progress.json`.
2. Add or update entry in `~/.sigma/projects.json` with current path and timestamp.
3. Output confirmation.

Use case: project moved to a new path, or global registry is missing.

---

## Task 5 — `sigma session bootstrap`

**Pre-conditions**: Must be inside a Sigma project. Finds root via `findProjectRoot()`.
**Post-conditions**: Read-only.

Behavior:

1. Read `Sigma/progress.json` (validate schema).
2. Read `Sigma/SIGMA-REGISTRY.json` for document list.
3. Read `Sigma/SIGMA-OPERATION-REGISTRY.json` for operation list (used to determine next valid ops).
4. Collect up to 3 most recent CSO files from `Sigma/logs/` (by filename timestamp).
5. Determine next valid operations: operations whose pre-conditions in `SIGMA-OPERATION-REGISTRY.json` are satisfied by current `progress.json` state.
6. If `--role <ARC|AUD|FMN|DEV>` passed: filter "Documents to Read" to role-specific list from SIGMA-REGISTRY.json `mandatory_when: session_bootstrap` entries for that role.
7. Output in the format defined in Design Decision 7.

**Exit behavior**: Always exits 0 (read-only; session bootstrap must not block session start).

---

## Task 6 — `sigma gitignore generate`

**Pre-conditions**: None (does not require a Sigma project).
**Post-conditions**: Prints to stdout only — no files created.

Output:

```
# Sigma CLI
node_modules/
dist/
*.js.map

# Sigma runtime (do not commit)
# Note: Sigma/ governance folder SHOULD be committed — it is the project record
# Only exclude CLI build artifacts and local backups if needed:
# Sigma/logs/      ← optional: exclude if logs are too verbose for git
```

---

## Task 7 — `sigma cli.ts` — Top-Level Command Registration

`src/cli.ts` registers all Phase 3 commands using `commander`:

```typescript
import { Command } from 'commander';
const program = new Command();

program
  .name('sigma')
  .description('Sigma — Lightweight project governance CLI')
  .version(SIGMA_VERSION);

// Register domain command groups
program.addCommand(setupCommand());    // sigma setup ...
program.addCommand(projectCommand());  // sigma project ...
program.addCommand(sessionCommand());  // sigma session ...
program.addCommand(gitignoreCommand()); // sigma gitignore ...

program.parse(process.argv);
```

Unknown commands must output a helpful error: `"Unknown command: sigma <domain> <action>. Run \`sigma --help\` for available commands."`

---

## Task 8 — Update `SIGMA_PROTOCOL.md` Section 22

**Target**: Replace `> **[PHASE 3]** — ...` placeholder in Section 22 with the actual spec.

Section 22 content after Phase 3:

```markdown
## 22. CLI Setup & Installation

### Installation

Sigma is distributed as an npm package. Install globally:

```bash
npm install -g sigma-cli
```

After npm install, run the global setup:

```bash
sigma setup install
```

This creates `~/.sigma/` with the following structure:

```
~/.sigma/
├── templates/      ← Artifact templates (DIR-INTENT, FMN-PLAN, DEV-EXEC, DIR-CLOSE, CSO)
├── rules/          ← Role rule files (ARC-RULE, AUD-RULE, FMN-RULE, DEV-RULE)
├── governance/     ← Protocol documents (SIGMA_CONSTITUTION.md, SIGMA_PROTOCOL.md)
├── bridge/         ← Bridge file templates (CLAUDE.md, GEMINI.md, AGENTS.md)
├── projects.json   ← Global project registry
└── sigma.config.json
```

### Project Initialization

In the root of a new project:

```bash
sigma project start --id MYPROJ --name "My Project Name"
```

This creates:
- `Sigma/` governance folder with all subfolders and governance documents
- `Sigma/progress.json` seeded to initial state
- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` bridge files at project root

### CLI Update

When a new version of Sigma CLI is installed:

```bash
npm install -g sigma-cli@latest
sigma setup update
```

`sigma setup update` syncs `~/.sigma/templates/`, `~/.sigma/rules/`, and `~/.sigma/governance/` from the new package. It does NOT touch any active project's `Sigma/` folder.

To update governance files inside an existing project:

```bash
sigma project sync --confirm
```

### Session Bootstrap

At the start of every agent session:

```bash
sigma session bootstrap [--role ARC|AUD|FMN|DEV]
```

Outputs: lifecycle phase, artifact states, gate status, STALE_INTENT warnings, recent CSO files, and next valid operations. With `--role`, filters the document reading list to the active role's required reads.

### Project ID Rules

- Short uppercase string: uppercase letters, digits, and hyphens only
- Maximum 12 characters
- Examples: `MYPROJ`, `ALPHA-1`, `WEBAPP`

### Schema Version

`Sigma/progress.json` carries a `schema_version` field. When the CLI reads a `progress.json`, it validates that the schema version is supported. If the file's schema version is newer than the CLI supports, all state-mutating operations are blocked until the CLI is updated.
```

---

## Implementation Steps

| Step | Action | Target | Status |
| :--- | :--- | :--- | :--- |
| 1 | `npm init` + install dependencies | `package.json` | TODO |
| 2 | Create `tsconfig.json` | TypeScript config | TODO |
| 3 | Create `.gitignore` | Root | TODO |
| 4 | Create `bin/sigma.js` | Binary entry point | TODO |
| 5 | Write `src/config.ts` | Constants and paths | TODO |
| 6 | Write `src/engine/progress.ts` | State engine | TODO |
| 7 | Write `src/engine/registry.ts` | Registry loader | TODO |
| 8 | Write `src/utils/fs.ts` | FS helpers | TODO |
| 9 | Write `src/utils/output.ts` | Output formatting | TODO |
| 10 | Write `src/commands/setup.ts` | `sigma setup install \| update` | TODO |
| 11 | Write `src/commands/project.ts` | `sigma project start \| status \| sync \| reset \| register` | TODO |
| 12 | Write `src/commands/session.ts` | `sigma session bootstrap` | TODO |
| 13 | Write `src/commands/gitignore.ts` | `sigma gitignore generate` | TODO |
| 14 | Write `src/cli.ts` | Top-level command registration | TODO |
| 15 | Run `npm run build` | Compile TypeScript → dist/ | TODO |
| 16 | Smoke test: `node bin/sigma.js --help` | Verify binary runs | TODO |
| 17 | Smoke test: `sigma setup install` | Verify `~/.sigma/` created | TODO |
| 18 | Smoke test: `sigma project start` | Verify `Sigma/` created, progress.json seeded | TODO |
| 19 | Smoke test: `sigma project status` | Verify output correct | TODO |
| 20 | Smoke test: `sigma session bootstrap` | Verify output correct | TODO |
| 21 | Update `Sigma/SIGMA_PROTOCOL.md` Section 22 | Fill Phase 3 placeholder | TODO |

---

## Acceptance Criteria

| # | Criterion | Check |
| :--- | :--- | :--- |
| AC-01 | `package.json` exists with correct `bin`, `dependencies`, `engines` | Read |
| AC-02 | `tsconfig.json` targets CommonJS output, strict mode on | Read |
| AC-03 | `npm run build` completes without TypeScript errors | Build |
| AC-04 | `node bin/sigma.js --help` outputs domain list with all Phase 3 domains | Run |
| AC-05 | `sigma setup install` creates `~/.sigma/` with all subdirectories and files | Run |
| AC-06 | `sigma setup update` re-copies files to `~/.sigma/` without touching any project `Sigma/` folder | Run |
| AC-07 | `sigma project start` creates `Sigma/` with all 6 subfolders | Run |
| AC-08 | `sigma project start` creates `Sigma/progress.json` with correct seed state (schema_version 1.0.0, lifecycle_state DESIGN, all gates false) | Read |
| AC-09 | `sigma project start` registers project in `~/.sigma/projects.json` | Read |
| AC-10 | `sigma project start` in existing Sigma project (without `--reinit`) outputs error — does not overwrite | Run |
| AC-11 | `sigma project status` reads `progress.json` and outputs lifecycle state, artifact states, gate status | Run |
| AC-12 | `sigma project sync --confirm` backs up governance files before overwriting | Run |
| AC-13 | `sigma project reset --confirm` backs up `progress.json` before resetting, does not touch artifact files | Run |
| AC-14 | `sigma project reset --confirm --wipe` archives artifact files to `Sigma/logs/` — no permanent delete | Run |
| AC-15 | `sigma project register` updates `~/.sigma/projects.json` entry for current project | Run |
| AC-16 | `sigma session bootstrap` outputs all required sections: lifecycle, artifacts, gates, stale warnings, CSO list, next valid ops, documents to read | Run |
| AC-17 | `sigma session bootstrap --role ARC` filters document list to ARC-relevant reads | Run |
| AC-18 | `sigma session bootstrap` exits 0 always (never blocks session start) | Run |
| AC-19 | `sigma gitignore generate` outputs to stdout only, creates no files | Run |
| AC-20 | `SIGMA_PROTOCOL.md` Section 22 placeholder replaced with actual Phase 3 spec | Read |
| AC-21 | `progress.json` schema validation: missing required fields throw informative error | Code |
| AC-22 | `findProjectRoot()` correctly walks up directory tree to find `Sigma/progress.json` | Code |
| AC-23 | Unknown `sigma <domain>` outputs helpful error (not stack trace) | Run |
| AC-24 | `sigma setup install` in non-installed state creates `~/.sigma/projects.json` with correct initial structure | Read |
