# Changelog

All notable changes to this project are documented in this file. The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### F10 — artifact file names without a role prefix (2026-10-14)

- `intent new`, `plan new`, `exec new`, `close new`, `plan new --pending`, plan promote and F08 clone create `INTENT-vN.md`, `PLAN-vN.M.md`, `EXEC-vN.M.md`, `CLOSE-vN.md` and `pending/PLAN-<id>.md`. ROADMAP names are unchanged.
- Files created before this change (`DIR-INTENT-`, `FMN-PLAN-`, `DEV-EXEC-`, `DIR-CLOSE-`) keep their names and are never renamed. Reconstruct, MCP artifact reads, chain identity checks, approval, `sigma scan` and mailbox references accept both forms in one place (`src/engine/artifactNames.ts`).
- A version that exists under both names in the same folder is reported by reconstruct and refused by every create path instead of being resolved silently.
- `sigma scan` recognizes artifact files by folder as well as name, so `Sigma/revisions/staging/PLAN-v1.1.md`-style names elsewhere are still scanned.
- Template file names, document type markers and the type names shown in command output are unchanged.

### F17 — product changelog from the EXEC (2026-10-14)

- DEV-EXEC template schema 4 adds a required `Changelog` section (a flat list, or exactly `No product changes.`). Schemas 3 and earlier validate unchanged and have no changelog to record.
- When `sigma exec approve --director-confirm` (or the MCP commit) makes an EXEC LOCKED, the list is added to the project `CHANGE-RECORD.md` under its EXEC version (`## v1.1`, most recently locked first, no date). Recording runs after the lock is committed, happens once, and never blocks the lock. The only valid files are `<project_root>/CHANGE-RECORD.md` and `<project_root>/dev/CHANGE-RECORD.md`; with both present the DEV workspace state decides.
- When a condition is not met or anything goes wrong, nothing is written and a message says why: `Changelog was not recorded because <reason>, so it was skipped. Update the changelog manually first, then resolve this issue; otherwise the next changelog record will fail again.`
- `sigma project start` and `sigma project sync --confirm` create an empty `CHANGE-RECORD.md` only when neither valid location has one.
- DEV and FMN rules and role memory describe the Changelog section.
- The record is named `CHANGE-RECORD.md`, not `CHANGELOG.md`, so release tools and manual edits of the conventional name cannot break the recording format. A presentation copy can be made under any other name.

### F08 — source review, draft reuse, audit and decisions (2026-10-14)

- Add read-only PLAN source review with quoted INTENT references and separate structural, certification and explicit advisory readiness results.
- Add preview-bound INTENT/PLAN cloning with fresh identity, reset approvals/checklists, diff, provenance and transaction recovery. Unsupported schema mappings are refused.
- Add audit snapshots with hash-bound original AUD responses and opt-in registered text evidence; report missing/stale material.
- Add intent-scoped substantive questions separately from control tickets. Director answers stay CLI-only and never approve artifacts.
- Align master role rules, memory hashes, five skill targets, bridges and operation/MCP policy. Host/project distribution remains F09.


### Added

- Project-bound MCP queries for policy, artifacts, evidence, status, validation, configuration, operation logs, and Git evidence.
- A separate `sigma-control` MCP server with bounded writes, operation tickets, durable local Director approvals, transaction recovery, idempotency, and audit records.
- Shared CLI/MCP services for draft and governance operations, with regression coverage for role boundaries, concurrent writes, and stale approvals.
- opencode as a setup target, detected by `~/.config/opencode/`: the nine role commands (`/arc`, `/fmn`, `/dev`, `/aud`, `/report`, `/sigma-test`, `/humanize`, `/write-memo`, `/read-memo`) are deployed to `~/.config/opencode/commands/`, and a `protect-sigma.js` plugin in `~/.config/opencode/plugins/` blocks direct edits to `Sigma/progress-v<N>.json` (`edit`, `write`, `apply_patch`). `sigma project start` and `sigma project sync` write a project-bound `mcp.sigma` entry to `opencode.jsonc` (when present) or `opencode.json`; comments and trailing commas are preserved, and a file that cannot be parsed is left unchanged with the entry printed for manual addition. This adds the `jsonc-parser` dependency.
- `sigma notes new|list|update`: free-form Markdown notes in `Sigma/notes/`. Only `sigma notes new --title` registers a note (`NOTE-<YYMMDDHHMM>-<slug>.md` in `note-list/`, ID `N01`, `N02`, ...); `Sigma/notes-registry.json` is the source of truth and `Sigma/notes/note-list.md` (ID, file name, title) is regenerated from it on every `new` and `update`. `sigma notes update` refuses the whole run if any non-Markdown file is found under `Sigma/notes/` and otherwise moves every Markdown file that is not a registered note to `unregistered-notes/` (never overwriting); `--dry-run` previews, and `--rebuild-registry` (with `--director-confirm`) restores a lost registry from `note-list.md`. Notes are independent of governance artifacts: an artifact may cite a note by ID and path, a note never references an artifact. `sigma project start` creates the structure; existing projects get it on first use. The `write-memo` and `read-memo` skills and `MEMO-TEMPLATE.md` now require `sigma notes new` for notes a memo points to, the bridges document the rules, and `DEV-RULE` lets DEV write a note created with `sigma notes new` while the DEV workspace is active.

### Changed

- The `AGENTS.md` bridge is now written for both Codex and opencode: the ownership line names both, and role activation lists `#arc` (Codex) and `/arc` (opencode). Existing projects keep their current `AGENTS.md`; `sigma project sync` does not touch bridge files, and `sigma project start --reinit --overwrite-bridge` replaces it (discarding local edits).
- The Claude Code `protect-sigma` hook message names `sigma plan approve` instead of the removed `sigma plan lock`. The same correction (`sigma plan approve` / `sigma exec approve` for the tombstoned `plan lock` / `exec lock`) is applied to every deployed bridge and skill, for all platforms; `close lock` and `intent ratify` are unchanged. The `CLAUDE.md` and `GEMINI.md` bridges now carry the `--related-artifact` handoff rule that `AGENTS.md` already had.
- `sigma project start` and `sigma project sync` write `~/.codex/config.toml` and `~/.gemini/config/mcp_config.json` only when Codex or Antigravity is detected (the same rule as `sigma setup install`), instead of creating them unconditionally. Run `sigma setup install` or `sigma project sync` after installing either tool to get the project binding.

### Removed

Breaking: the Cursor target was removed.

- `sigma setup` no longer deploys `SIGMA.mdc` to `~/.cursor/rules/` (current Cursor documentation has no file-based global rules location, so that target had no effect), and `sigma project start` / `sigma project sync` no longer write `.cursor/mcp.json`. `sigma setup update` and `sigma setup uninstall` remove a previously installed `~/.cursor/rules/SIGMA.mdc` only when it carries the Sigma marker; other Cursor files, including existing `.cursor/mcp.json` files in projects, are left alone. Cursor reads `AGENTS.md` natively.

Breaking: the human-readable projections and the Notion integration were removed.

- The `sigma notion` command and its eight subcommands (`setup`, `enable`, `disable`, `status`, `push`, `pull-state`, `pull`, `progress`), with their code, credential handling, and `.sigma-remote-state.json` marker handling.
- The `sigma intent humanize`, `sigma exec humanize`, and `sigma close humanize` commands, the three `sigma_intent_humanize`, `sigma_exec_humanize`, and `sigma_close_humanize` MCP control tools, and the `intent_humanize`, `exec_humanize`, and `close_humanize` operation registry entries (61 operations become 58; the control server registers 29 tools instead of 32).
- The Notion humanize gate: `plan new` and `close new` are no longer blocked by `notion_humanize_gate`, the `--humanize-gate` and `--no-humanize-gate` options of `sigma project start` (scripts that pass them now fail with "unknown option"), the Notion Humanize Gate line of `sigma config show`, and the `notion_humanize_gate_enabled` field of `sigma_get_config`.
- The `DIR-INTENT-HUMAN`, `PLAN-EXEC-HUMAN`, `DIR-CLOSE-HUMAN`, and `HUMAN-FIDELITY-LEDGER` templates, the Fidelity Ledger coverage check, and the `human` field of `sigma_get_evidence` results. New projects no longer get a `Sigma/human/` folder.
- The `notion_humanize_gate`, `Fidelity Ledger`, and `humanize` entries of the bundled terminology list.

Existing data is left in place and ignored: `notion` and `notion_humanize_gate` keys in `project.config.json`, `human` fields in chain files (both are preserved when the file is rewritten), `Sigma/human/` files, and the Notion credentials file in `~/.sigma`. Data already pushed to Notion is not touched. The `/humanize` skill and `sigma scan` are kept.

### Fixed

- Shared current/legacy artifact layout resolution between CLI reconstruction and MCP reads.
- Atomic JSON writes and explicit version hints for ambiguous plan/exec lock targets.
- Client MCP configuration binding and tool detection for existing supported clients.

## [1.0.0] — 2026-09-12

First official stable release.

### Included in this release

The `sigma` CLI governs the DIR-INTENT → FMN-PLAN → DEV-EXEC → DIR-CLOSE lifecycle through four AI roles (ARC, FMN, DEV, AUD) under Director authority, with the following command domains: `project`, `session`, `intent`, `plan`, `exec`, `close`, `roadmap`, `reference`, `send`, `inbox`, `git`, `config`, `setup`, `memory`, `doctor`, `override`, `notion`, `scan`, `report`. See `Sigma/SIGMA_PROTOCOL.md` for the full governance model.

### Added

- `/humanize` technical detail levels (`LOW` / `BALANCE` / `HIGH`), with a documented Activation Scope invariant (per-file, session-only, never persisted as memory), ported identically across the Claude Code, Codex, Reasonix, and Antigravity skill targets.
- `test/humanize-detail-level-parity.test.ts` — regression coverage locking the humanize skill contract across all four targets.
- Verdict-selection criteria for `PASS` / `PASS_WITH_RISK` / `REVISE` / `REJECT_RECOMMENDED` written directly into the `AUD Advisory Verdict` section of `DIR-INTENT-TEMPLATE.md` and `FMN-PLAN-TEMPLATE.md`.

### Changed

- `/report` and `/sigma-test` skills updated to the current project folder layout (`Sigma/charter/`, `Sigma/contract/`, `Sigma/roadmap/`, `Sigma/evidence/` — replacing the retired `design/`/`build/` names) and the current project-detection anchor (`Sigma/activate_status.json`, replacing `Sigma/progress-v<N>.json` for that purpose).
- `/sigma-test`'s Project Structure Check now covers all twelve canonical `Sigma/` subfolders instead of five.

### Removed

- The `PROMOTE_TO_HEAVIER_PROCESS` AUD advisory verdict — ambiguous in practice and never selected — from `AUD-RULE.md`, both artifact templates, and the `docCheck` verdict validator.
- The dead `~/.sigma/projects.json` reference from `/sigma-test` — no command in the CLI ever created this file.

Pre-1.0 development history is available in the Git log; earlier `0.x` versions are not individually catalogued here.
