# Implementation of four AUD product-audit skills

Authorization: the Director agreed to the design in the conversation and
requested implementation for review, particularly the four skills. This document
records that implementation scope; it is not a governance PLAN authored by AUD.

## Scope

- Add `aud-security`, `aud-ui-ux-design`, `aud-performance-cost`, and
  `aud-code-logic` to the Codex, Claude Code, opencode, Reasonix, and Antigravity
  skill bundles, following the repository's distribution structure.
- Align the base skill, AUD rules, role memory, and bridge activation guidance.
- Invocation activates AUD and grants the selected skill's access to the designated
  target. One skill type per session; simultaneous invocations are refused.
  Switching requires a new session.
- The product README provides the core idea and big picture only; it is not an
  audit target or acceptance specification. Insufficient understanding requires
  clarification from the Director.
- Sigma is not product evidence or an audit target. Exceptions cover only AUD
  instructions and the current session's own test results in
  `Sigma/Audit Product/<category>/`.
- UI–UX uses only live product interaction, screenshots, accessibility structure,
  and the README exception. The other three skills may explore source code.
- AUD may author test code in audit space; it must not modify main source code or
  implement repairs. New free-form Markdown reports named
  `{timedate}-AUDIT-{title}.md` provide references for FMN, followed by DEV.
- Register skills in the existing install/update/uninstall lifecycle. Do not add
  governance operations, redesign the engine, or audit the current product.

## Verification

- Validate skill frontmatter and explicit-invocation metadata.
- Check platform-variant consistency and local references.
- Run the build and isolated install/update/uninstall distribution tests.
- Review refusal scenarios: simultaneous skills, switching after completion,
  attempts to read Sigma documentation, unclear README, and test code becoming
  repair patches. Session boundaries are instruction-based, not a new sandbox.

Primary review locations: `setup/targets/codex/aud-*/SKILL.md` and the
Product Audit Skills section in `Sigma/rules/AUD-RULE.md`.

## Review amendments (2026-10-27)

The Director requested incorporation of the supplied Claude review and the English
`{title}` placeholder. Follow-up decisions: inspect .env only as key names and
sanitized configuration; keep the ban on previous audit reports, including retests.
Protocol and README now align with the product-audit contract. The review also
adds environment/credential and temporary-workspace boundaries, tool/glob checks,
explicit invocation and contamination guards, UI automation/privacy boundaries,
provenance, FMN advisory intake, diagnostic coverage, cross-platform body parity,
and a tested Claude PreToolUse hook using file_path and the current denial format.

Native manual-only invocation is configured for Codex and Claude Code. Other
platforms retain an explicit-Director gate in the shared skill body; no unsupported
native enforcement is claimed. Claude invocation and hook fields were checked
against the official [skills](https://code.claude.com/docs/en/skills) and
[hooks](https://code.claude.com/docs/en/hooks) documentation.

### Review resolution

| Review item | Implemented resolution |
| --- | --- |
| H1 | Amend Protocol section 4.5/startup wording and README; retain advisory authority and legacy passive reviews. No runtime approvals performed. |
| H2–H3 | Verify sanitized environment before execution; require specific authorization for production/external effects/paid tests; never use discovered credentials. Director chose key names/sanitized configuration only for .env. |
| H4–H5 | Define original source as the entire product tree except selected audit category; permit scoped temporary work, transient caches and disposable sanitized copies; check ignore/tool globs without editing them. |
| M1–M2 | Fresh session after prohibited Sigma evidence for all four; auto-loaded operational bridges exempt; startup reads only the governing contract section and role memory. |
| M3 | Native explicit-only metadata for Codex and Claude; shared body rejects implicit activation everywhere. No equivalent native enforcement claimed for unverified platforms. |
| M4–M5 | Concrete UI automation allow/deny list; screenshot pixel sampling with limitations; request output root and exclusion status; redact PII. |
| M6–M7 | Free-form provenance when available; clock-derived timestamp, Director timezone/UTC fallback, ASCII kebab-case title and quoted paths. |
| M8 | FMN accepts Director-selected reports as advisory references. Director retained the ban on previous audit reports, including retests. |
| L1–L2 | Extend diagnostics for all four skills and add session guards; test instruction-body parity across all five platforms. |
| L3–L4 | Define defensible expected-result sources for code logic; record hardware, OS and runtime versions for measurements. |
| Claude protection hook | Read native file_path (plus legacy aliases), use current PreToolUse denial response, and verify behavior with subprocess tests. |

## Final approved refinement and minor release

Director approved the final four-point refinement and requested the minor version
bump from verified 2.3.0 to 2.4.0. Retests accept Director-authored scenario briefs
as instructions only; old reports, pastes, excerpts and attachments remain barred.
Secret handling applies to any known/suspected secret-bearing file, with a
non-exhaustive pattern list in AUD-RULE and metadata-only handling of private keys.
Protocol now retains six principles; AUD-RULE owns operational detail and bridge/
memory remain short references. UI–UX runs automation from temporary storage by
default and asks about ignore/include globs only before persisting code. Security-
specific scan/brute-force/lockout text is confined to Security Audit.

Package metadata, the root lockfile entries and runtime version advance together;
SCHEMA_VERSION stays unchanged. CHANGELOG records 2.4.0. Build regenerates dist.
The Director will perform commit and push; this implementation creates neither.

Release validation found that the existing version-stamp negative test required
Windows file-symlink privileges. Its fixture now uses a real directory junction on
Windows (directory symlink elsewhere), asserts isSymbolicLink, and tests the same
managed-asset rejection behavior without skipping or mocking that boundary.
