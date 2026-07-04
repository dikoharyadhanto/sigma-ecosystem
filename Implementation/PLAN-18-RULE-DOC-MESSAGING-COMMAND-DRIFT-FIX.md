# PLAN-18 — Fix `sigma message send` Command Drift in Role Rule Files

**Source**: Director-requested drift audit, Professional Mode, 2026-07-04
**Date**: 2026-07-04
**Status**: DRAFT FOR REVIEW
**Note**: This is a plain implementation plan authored in Professional Mode. It is not a Sigma FMN-PLAN and carries no Sigma lock/gate authority.

---

## Objective

Fix a live, reproducible command-name bug in all four role rule files (`Sigma/rules/{ARC,FMN,DEV,AUD}-RULE.md`), which currently instruct AI roles to send inter-role messages using a CLI command that does not exist. Bring the rule files into agreement with the actual CLI, which the canonical protocol doc, README, and test suite already reflect correctly.

```text
The rule files are the files an activated role treats as authoritative.
Right now, following them literally for messaging fails every time.
Fix the syntax, not the workflow — no behavior change, no new command.
```

---

## Problem Statement (Investigation Findings)

An Explore-agent audit comparing all four `Sigma/rules/*.md` files against `src/commands/*.ts` and `src/cli.ts` found one critical, high-blast-radius discrepancy, plus two minor documentation gaps. Findings were independently spot-checked by directly reading `src/commands/send.ts` and grepping the rule files.

### Finding 1 (Critical) — `sigma message send` does not exist

All four rule files instruct:

```
sigma message send --to <ROLE> --subject "<subject>" --body "<body>"
```

The real, registered top-level command is `sigma send` (`src/cli.ts:38`, `src/commands/send.ts:188`), with a different flag set entirely (`src/commands/send.ts:198-208`):

- `--from <role>` is **required** and never appears in any rule-file example.
- `--to <role>` is required (matches).
- `--message <body>` or `--message-file <path>` is the real body flag — `--body` does not exist.

Reproduced directly:

```
$ node dist/cli.js message send --to FMN --subject "test" --body "test"
Unknown command: sigma message send
Run `sigma --help` for available commands.
```

**Ground truth already agrees on `sigma send`**: `Sigma/SIGMA_PROTOCOL.md:476` and `:608`, `README.md:589`, and `test/mailbox-regression.test.ts` (which passes) all use the correct command. Only the four rule files are wrong.

**This is not a stale-docs situation — it's a currently-live miss.** `SIGMA_PROTOCOL.md:658` has a changelog entry dated **2026-07-04** (today) reconciling its CLI Command Surface table against real drift (`gitignore`, `override`, `sync`, `memory`, `doctor` added). `ARC-RULE.md` was touched in the same commit window, but that pass did not catch this bug. It is not recorded in `Discussion/SIGMA_BUGS.md`, `Discussion/sigma_planned_fix.md`, or anywhere else searched.

**Impact**: every "Mandatory Message Trigger" section in all four rule files is framed as a required, non-optional step ("ARC has not completed the triggering action until the message is sent"). As written, a role following the doc literally cannot complete these triggers.

**Full occurrence list** (verified by grep, 14 occurrences across 4 files):

| File | Lines | Content |
| --- | --- | --- |
| `Sigma/rules/ARC-RULE.md` | 470 | Generic protocol example: `sigma message send --to <ROLE> --subject "<subject>" --body "<body>"` |
| `Sigma/rules/ARC-RULE.md` | 494–495 | Trigger 1 concrete example (`--to FMN`, multi-line `--body`) |
| `Sigma/rules/FMN-RULE.md` | 145 | Prose reference: "using `sigma message send`" |
| `Sigma/rules/FMN-RULE.md` | 154–155 | Concrete example (`--to DEV`) |
| `Sigma/rules/FMN-RULE.md` | 460 | Generic protocol example |
| `Sigma/rules/FMN-RULE.md` | 485–486 | Concrete example (`--to DEV`, plan-locked trigger) |
| `Sigma/rules/FMN-RULE.md` | 508–509 | Concrete example (`--to DEV`, revision trigger) |
| `Sigma/rules/DEV-RULE.md` | 620 | Generic protocol example |
| `Sigma/rules/DEV-RULE.md` | 644–645 | Concrete example (`--to FMN`, clarification trigger) |
| `Sigma/rules/DEV-RULE.md` | 665–666 | Concrete example (`--to FMN`, pre-build review trigger) |
| `Sigma/rules/DEV-RULE.md` | 685–686 | Concrete example (`--to FMN`, post-build review trigger) |
| `Sigma/rules/AUD-RULE.md` | 1061 | Generic protocol example |
| `Sigma/rules/AUD-RULE.md` | 1086–1087 | Concrete example (`--to ARC`, findings trigger) |
| `Sigma/rules/AUD-RULE.md` | 1107–1108 | Concrete example (`--to FMN`, findings trigger) |

### Finding 2 (Minor, documentation gap) — Approval-class lock commands are not code-enforced

Rule files present `sigma intent lock` / `sigma plan lock` / `sigma exec lock` / `sigma close lock` / supersede commands as "Approval-class: requires explicit Director authorization" (e.g. `DEV-RULE.md:588-596`). In code, these execute immediately with no `--director-confirm`-style flag or interactive gate (`src/commands/intent.ts:99-119`) — contrast `src/commands/override.ts:74-79`, which does hard-enforce `--director-confirm`. This matches `SIGMA_PROTOCOL.md` Section 16A's own framing (approval is a written behavioral rule, not a runtime gate), so it is likely intentional. Flagged here for Director visibility, **not proposed for a code change in this plan** — see Out of Scope.

### Finding 3 (Minor, documentation gap) — CLOSED→reopen flow undocumented in canonical lifecycle docs

`SIGMA_PROTOCOL.md:53-70` describes a strictly linear `START → DESIGN → BUILD → CLOSE` lifecycle. In practice, `sigma intent new` against a CLOSED project triggers a tested reopen flow (`src/commands/intent.ts:43-58`, `test/intent-reopen.test.ts`) that isn't mentioned in `SIGMA_PROTOCOL.md`, `SIGMA_CONSTITUTION.md`, or `ARC-RULE.md`'s Role Activation section. Flagged for visibility; **not proposed for a fix in this plan** — see Out of Scope.

---

## Scope

### In scope

- Fix all 14 occurrences of the `sigma message send ... --body ...` pattern across `ARC-RULE.md`, `FMN-RULE.md`, `DEV-RULE.md`, `AUD-RULE.md`, replacing with the real `sigma send --from <role> --to <role> --subject "<subject>" --message "<body>"` syntax (or `--message-file` where the example already implies multi-line content).
- Fix the one prose reference at `FMN-RULE.md:145` ("using `sigma message send`" → "using `sigma send`").
- For each concrete trigger example, add the correct `--from <ROLE>` value matching that rule file's own role (e.g. all examples inside `ARC-RULE.md` get `--from arc`, inside `DEV-RULE.md` get `--from dev`), since `--from` is a required flag today and is currently missing from every example.
- Spot-check the four generic "Inter-Role Communication Protocol" template lines (one per file) for consistency with the corrected concrete examples.
- No other content in these files changes — this is a syntax correction only, not a rewrite of messaging policy, triggers, or role behavior.

### Out of scope

- Finding 2 (approval-class code enforcement) — no code change proposed here; this is a design-tradeoff observation for Director awareness, not a bug being fixed in this plan.
- Finding 3 (CLOSED→reopen documentation gap) — not fixed here; would belong in a separate plan touching `SIGMA_PROTOCOL.md` / `SIGMA_CONSTITUTION.md` / `ARC-RULE.md`'s lifecycle section.
- Any change to `src/commands/send.ts`, `src/cli.ts`, or any other CLI code. The CLI is correct; only the rule-file documentation is wrong.
- Any change to `SIGMA_PROTOCOL.md`, `README.md`, or `test/mailbox-regression.test.ts` — already correct, used here as the reference for what "correct" looks like.
- Adding a `message` command alias/namespace to the CLI to match the (wrong) docs — rejected, since the fix belongs in the docs, not by bending the CLI to match a typo.

---

## Task Breakdown

### Stage 1 — `ARC-RULE.md`

- Line 470: replace generic example with corrected `sigma send --from arc --to <ROLE> --subject "<subject>" --message "<body>"`.
- Lines 494–495: replace Trigger 1 example with `sigma send --from arc --to FMN --subject "DIR-INTENT-v{X} LOCKED — Begin FMN-PLAN" --message "..."` (or `--message-file` if multi-line content is kept as-is).

### Stage 2 — `FMN-RULE.md`

- Line 145: change prose "using `sigma message send`" → "using `sigma send`".
- Lines 154–155: replace with `sigma send --from fmn --to DEV --subject "Implementation Request: FMN-PLAN-vX.Y" --message "..."`.
- Line 460: replace generic example with `--from fmn` corrected form.
- Lines 485–486: replace with `sigma send --from fmn --to DEV --subject "FMN-PLAN-v{X.Y} LOCKED — Open DEV-EXEC" --message "..."`.
- Lines 508–509: replace with `sigma send --from fmn --to DEV --subject "Revision Required: DEV-EXEC-v{X.Y}" --message "..."`.

### Stage 3 — `DEV-RULE.md`

- Line 620: replace generic example with `--from dev` corrected form.
- Lines 644–645: replace with `sigma send --from dev --to FMN --subject "Clarification Needed: DEV-EXEC-v{X.Y} Pre-Build Assessment" --message "..."`.
- Lines 665–666: replace with `sigma send --from dev --to FMN --subject "Pre-Build Review Request: DEV-EXEC-v{X.Y}" --message "..."`.
- Lines 685–686: replace with `sigma send --from dev --to FMN --subject "Post-Build Review Request: DEV-EXEC-v{X.Y}" --message "..."`.

### Stage 4 — `AUD-RULE.md`

- Line 1061: replace generic example with `--from aud` corrected form.
- Lines 1086–1087: replace with `sigma send --from aud --to ARC --subject "AUD Findings: DIR-INTENT-v{X}" --message "..."`.
- Lines 1107–1108: replace with `sigma send --from aud --to FMN --subject "AUD Findings: FMN-PLAN-v{X}" --message "..."`.

### Stage 5 — Verification

- Grep all four files afterward for `message send` and `--body` to confirm zero remaining occurrences.
- Spot-run one corrected example command against `dist/cli.js` (with harmless placeholder values, no real send if possible via `--dry-run` if supported, otherwise verify `--help` output for `send` matches the corrected flags) to confirm the corrected syntax is actually valid, not just visually plausible.
- No test suite changes needed — `test/mailbox-regression.test.ts` already tests the real command and is unaffected, since this plan only touches prose/example text inside rule `.md` files, not code.

---

## Risk Notes

- **Scope creep risk**: this plan is intentionally narrow (syntax fix only). Findings 2 and 3 are recorded for Director visibility but deliberately excluded from execution here to avoid bundling an unrelated design discussion into a mechanical bug fix.
- **Multi-line body handling**: several concrete examples (e.g. `ARC-RULE.md:495`, `FMN-RULE.md:486`) use multi-line `--body` content. The real CLI's `--message` flag is documented as single-line, with `--message-file` for multi-line content (`src/commands/send.ts:203-204`). Each corrected example needs a judgment call: keep as inline `--message` with the multi-line text (may not match real single-line-flag behavior) or switch to `--message-file` with a short note. This plan proposes resolving each occurrence individually in Stage 1–4 rather than picking one blanket approach, since some triggers may fit inline and others clearly need a file.
- **No functional/behavioral change**: this fix does not alter what any role is required to do, only the literal command syntax used to do it. Risk of unintended side effects is low.

---

## Draft Acceptance Criteria

- [ ] Zero occurrences of `sigma message send` remain in `Sigma/rules/*.md`.
- [ ] Zero occurrences of a bare `--body` flag remain in `Sigma/rules/*.md` messaging examples.
- [ ] Every corrected example includes a `--from <role>` value matching the rule file it appears in.
- [ ] Every corrected example uses `--message` or `--message-file` consistent with actual content length (single-line vs. multi-line), decided per-occurrence.
- [ ] `npm test` still passes unchanged (no code touched, no test expected to be affected).
- [ ] Findings 2 and 3 are left untouched in this plan and explicitly called out to the Director as candidates for a separate future plan.
