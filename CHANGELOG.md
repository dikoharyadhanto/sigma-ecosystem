# Changelog

All notable changes to this project are documented in this file. The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### MCP coverage, policy, and parity (2026-10-15)

- `src/mcp/capabilityManifest.ts` is the single declaration of what each active operation is on the MCP surface: plane, `mcp_status`, tool names, mapping, rationale. `policy.ts` derives its tier, owner, and status tables from it; the hand-kept `IMPLEMENTED` set is gone. `sigma_get_effective_policy` rows now also carry `plane`, `mcp_tools`, and `registry_status`.
- `test/mcp-capability-manifest.test.ts` compares the manifest with the registry and with the tools both servers really register. It found that the old table claimed `decisions_target` without a tool and reported 30 operations with real tools as deferred.
- `notes_list`, `notes_new`, and `notes_update` are classified. Mailbox and memo operations stay deferred.
- Seven query tools: `sigma_review_check`, `sigma_close_check`, `sigma_dev_status`, `sigma_notes_list`, `sigma_intent_baseline_check`, `sigma_intent_amendment_preview`, `sigma_plan_revise_check`. Each calls the engine function its CLI command uses, writes nothing, and masks host paths. `sigma_close_check` evaluates Gate 3 and the PRODUCT REVIEW; it is not `sigma_check_document(type=close)`.
- New CLI operation `sigma plan revise ticket --v <version>` freezes the revision review into a Director approval ticket. `sigma plan revise check --prepare-ticket` remains as a deprecated alias with the same effect.
- Control tool `sigma_create_note` (equivalent of `sigma notes new`): one step, no ticket, attributed to the server's bound role with no role argument, and it lists exactly the note, the registry, and the catalog as its transaction files. It takes the same project lock as the CLI. `notes update` stays CLI-only.
- Control tool `sigma_create_review` (equivalent of `sigma review new`): ARC only, one step, one file, no chain state. It shares `resolveReviewNewTarget`/`createReviewDraft` with the CLI, records no verdict, and a second call is refused rather than overwriting a review people have edited.
- Control tools `sigma_prepare_plan_revision`, `sigma_issue_plan_revision_ticket`, `sigma_commit_plan_revision` (FMN only), mirroring `sigma plan revise prepare|ticket|commit`. A ticket and an exact Director approval are required only for a loosening or the `director` checkpoint, as in the engine. Commit also takes `expected_candidate_sha256` so what was checked is what is certified. The candidate is still edited as a file and the CONTRACT_CHANGE notice stays a CLI/skill operation. `preparePlanRevision` now calls the new `assertCanPrepareRevision` so the tool can refuse before opening a transaction.
- `Implementation/sigma-mcp/SIGMA-MCP-CAPABILITY-MATRIX.generated.md` is rendered from the manifest by `node scripts/generate-mcp-matrix.js` (`--check` reports a stale file). It states the registry baseline, how to start the control server, and the meaning of exact/functional/partial/none. `test/mcp-capability-matrix.test.ts` fails when it is stale.
- `decisions_resolve` is classified `not_admissible`: resolving a Director decision through MCP would be self-approval.
- `intent_activate` is classified `not_admissible` (tier W3), following the final Director decision of 2026-09-17: it writes an input of `state_revision` itself.
- `README.md` lists 33 query tools and 39 control tools; it had said 39 control tools when the server registered 37.
- The FMN and DEV rules and the ten FMN/DEV skill targets name `sigma plan revise ticket` for early Director approval instead of the `check --prepare-ticket` flag.
- `sigma-test` check B4 now compares each row's declared tools with the introspected tool list instead of reporting "unverifiable".

### Closure redesign — INTENT as a mandate, PRODUCT REVIEW, no scoring (2026-10-15)

- `INTENT` is a strategic mandate over one main objective. Template schema 6 (section IDs and order are unchanged, so the validator is unchanged): `Core Requirements` replaces the feature-style requirements (`Required Capability` and `Acceptance Standard`; Priority, User Story, and checkboxes are gone), `Evidence Required` replaces `Measurement Method`, Scope is the boundary of the mandate, Constraints keep only what survives a change of method, and domain-specific quality dimensions are allowed. `sigma intent clone` accepts schema 5 or 6 sources into the schema 6 template.
- ARC activation offers three paths: discussion only, check the current `INTENT` (and amend or not), final product evaluation. A new `INTENT` is not offered as a path except for the project's first. ARC gives no recommendation unless asked. `ARC-RULE.md` gains §INTENT Change Classification (T1, T2, T3).
- New artifact `PRODUCT REVIEW` (`Sigma/review/PRODUCT-REVIEW-vN.md`, `sigma review new` and `sigma review check`): FMN's review request, then ARC, AUD (unless `SKIP_FOR_AUDIT`), and Director verdicts (`PASS`, `PASS_WITH_RISK`, `REVISE`, `REJECT_RECOMMENDED`). Only `PASS` and `PASS_WITH_RISK` are accepted, and they are permanent. ARC and AUD review independently.
- `sigma close new` now needs Gate 3 and an accepted PRODUCT REVIEW. `sigma close check` reports that before the CLOSE exists and lists the `PASS_WITH_RISK` parties. `sigma close lock` has no content gate and, on every lifecycle model, needs Gate 3 (nothing left open); a CLOSE does not prevent new PLANs, before or after it is locked (work within the same mandate may continue; a new objective is a new INTENT). The CLOSE template is schema 3, a closing report of the final product; schema 2 documents keep validating.
- Removed: `sigma intent score`, the ARC Satisfaction Score, Gate 3.5 as a score gate, the score columns of `intent-history.md`, ARC's score-driven Trigger 2, and the Petition / Admission Review mechanism. Recorded `arc_score` fields on existing chains are kept and no longer read.
- FMN may recommend a final product review (never closure) and sends the request only after the Director approves.

## [2.1.0] - 2026-10-15

### F09 — distribution support (2026-10-15)

- `sigma doctor --migrate-mailbox --adopt-orphans` registers legacy message files that are missing from the index as READ entries, then migrates them with the rest. A file is adopted only when its metadata parses completely (message ID, type, from, to, created time, and a directory that matches the recipient). The earliest format is read through its field names (`From Role`, `To Role`, `Ref Message`); its retired types `REPLY` and `REQUEST` are indexed as `NOTE` with the original type kept in the log; an attachment that is a path under `Sigma/messages/attachments/` must exist and is registered, and free text in that cell is left in the message file. Any file that does not parse, or a duplicate ID, refuses the whole run and changes nothing. `--dry-run` previews and the real run needs `--director-confirm`. The adopted files are recorded in `Sigma/messages/migrations/v2/adopted-orphans.json`.
- `sigma setup install` and `sigma setup update` remove assets Sigma no longer ships: the four HUMAN templates in `~/.sigma/templates` and the retired `cso` and `checkpoint` skills on every target. A skill is removed only when its content identifies it as the Sigma skill. Other files in the global directories that the package does not contain are listed and kept.
- `sigma project sync` includes the project's bridge files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `DEEPSEEK.md`, `REASONIX.md`), each behind its own acceptance token. They are not part of the version stamp.
- Version 2.1.0. The previous `Unreleased` entries are part of this release.

### F18 — Consistency of Protocol, Constitution, README and shipped assets (2026-10-15)

- `SIGMA_CONSTITUTION.md`: Amendments 003 to 005. `INTENT` is the single name for the Director's intent document, "ad hoc instruction" and "session" are defined, Article IV orders normative authority only (RUNTIME_STATE and DEV output are execution records), Article II separates the Director's reserved authority from taking part in every decision, Article V forbids independent redefinition and permits quotation with the source identified, Article X states what happens to authority when runtime state cannot be trusted, and the Temporary Experimental Authorization is defined once, in Article VIII.
- `SIGMA_PROTOCOL.md` is rewritten as v1.0 and describes Sigma v2 as implemented: lifecycle models, APPROVED and LOCKED, gates including Gate 3.5, PLAN revisions and notices, INTENT amendments through Git, per-INTENT mailbox and memo, notes, audit packs and decisions, DEV workspace, product changelog, version stamp, and the MCP servers. The Sovereign/Operationalization tiers, section-number tables, and the "heavier process" promotion section are removed.
- `README.md` is rewritten for the same state. ROADMAP is described as mandatory, Gate 3.5 is listed, artifact names follow the unprefixed convention, and the command reference covers `plan revise`, `exec acknowledge-plan`, `dev`, `control`, `scan`, the clone commands, and the doctor modes.
- `SIGMA-OPERATION-REGISTRY.json` registers 11 operations that existed in the CLI and replaces the single `intent_baseline` entry with `intent_baseline_check` and `intent_baseline_adopt`. Eleven operations are classified in the MCP policy table.
- The CLI banner and `package.json` description no longer say "Lightweight". Command descriptions use `INTENT`, `PLAN`, `EXEC`, and `CLOSE`.
- Skills for ARC, FMN, DEV, AUD, REPORT, and HUMANIZE on all five targets, the bridge files, the Antigravity plugin descriptions, and the CLOSE template cross-references use the unprefixed names and the APPROVED lifecycle wording.
- A Temporary Experimental Authorization is recorded as a registered note titled `TEA: <article> — <scope>` after the role restates the declared fields to the Director. Sigma still has no command for it (Protocol, constitutional instruments).
- `test/registry-sync.test.ts` fails when a CLI operation is missing from the operation registry, when the registry lists one the CLI no longer has, or when an entry is still marked `NEEDS_REVIEW`.

### F12 — Sigma version stamp and "outdated" warning (2026-10-15)

- `sigma setup install|update` record `cli_version`, `assets_hash` and `synced_at` in `~/.sigma/sigma.config.json`. `sigma project start`, `register` and `sync --confirm` record `sigma_applied` (`sigma_version`, `assets_hash`, `synced_at`) in `.sigma-identity.json`. A stamp is written only when every managed file on that layer matches its source; a rejected or partial sync leaves the previous stamp unchanged.
- Inside a project, commands print one stderr line when `~/.sigma` is behind the installed CLI (`sigma setup update`) or the project is behind `~/.sigma` or has no stamp (`sigma project sync`). The global installation is reported first. `setup`, `doctor`, `project start|register|sync` and `session bootstrap` do not print it.
- `session bootstrap` and `sigma_get_orientation` carry the message in their compatibility warnings; orientation also returns `version_status`. `doctor --check-assets` reports the version status read-only.
- `SCHEMA_VERSION` is unchanged; the new fields are additive and older readers ignore them. Existing projects show the "no version stamp" line until `sigma project sync --confirm` is run once.

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
