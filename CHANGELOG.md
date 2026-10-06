# Changelog

All notable changes to this project are documented in this file. The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project-bound MCP queries for policy, artifacts, evidence, status, validation, configuration, operation logs, and Git evidence.
- A separate `sigma-control` MCP server with bounded writes, operation tickets, durable local Director approvals, transaction recovery, idempotency, and audit records.
- Shared CLI/MCP services for draft and governance operations, with regression coverage for role boundaries, concurrent writes, and stale approvals.

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
