---
name: read-memo
description: Check and read pending self-addressed memos (sigma memo list / sigma memo read) for the active role
---

# /read-memo — Sigma Memo Check

## Skill Identity

This is a universal, cross-role skill.

It is not a governance role. It does not switch roles, lock artifacts, ratify anything, or create any Sigma governance artifact. It only lists and reads memos — messages the active role previously left for itself — via `sigma memo list` and `sigma memo read`.

It may be invoked by any active role (ARC, FMN, DEV, AUD) or by Professional Mode without switching roles. The active role remains active after the check.

Reference: `PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF-20260902.md` and `Sigma/templates/MEMO-TEMPLATE.md`.

## Activation

This skill activates only on an explicit trigger — never silently, never on its own initiative:

```text
Check Memo
Read Memo
Check memo before we continue
Read memo about <topic>
#read-memo
```

...or any explicit Director instruction that plainly asks to read or check memo(s). A role rule may separately advise checking memos at the start of a session (an advisory, not a gate) — that advisory is itself an explicit instruction when it fires, not the skill deciding on its own to run.

The Director may give the activation phrase in whichever language the current session is actively using for interaction (e.g. Indonesian or English — see `sigma config show` → AI Communication Language) — recognize the equivalent phrase in that language the same way. This skill document itself, like all Sigma skill and template documentation, is written in English regardless of the session's interaction language; only the Director's spoken trigger phrase adapts to it.

## If More Than One Memo Is Listed — Ask, Don't Choose

After `sigma memo list --role <role>`:

- **Zero memos** — see "If The List Is Empty" below.
- **Exactly one memo** — read it directly with `sigma memo read <id>`; there is no ambiguity to resolve.
- **More than one memo** — do not decide on your own which ones are "relevant." Present the full list to the Director — each memo's id and topic (and status, if it helps) — and ask explicitly which one(s) the Director wants read. Wait for the Director's answer before running `sigma memo read` on anything.

## Executing A Memo's Instructions — Read-Only vs. Write-Class

A memo's content may instruct next steps. Whether those steps can run without stopping depends entirely on whether they are read-only:

- **Read-only instructions** — opening or reading an artifact section, an inbox message, or a `Sigma/notes/` file the memo points to; running a read-only Sigma command (`sigma ... check`, `sigma ... list`, `sigma config show`, `sigma inbox read`, `sigma memo read`, etc.) — may be carried out without asking the Director for separate approval. The Director already authorized this by triggering `#read-memo`.
- **Write-class instructions** — anything that locks, ratifies, supersedes, creates a Sigma artifact, writes or edits a file, sends a message, changes configuration, or otherwise mutates project state — must **not** be executed automatically, even if the memo's own author (the same role, in an earlier session) wrote it as the obvious next step. Stop and ask the Director for explicit approval before running that specific action.
- This includes the shadow-artifact guardrail line (`Conclusion: ... → formalize into ...`) from `/write-memo` — formalizing a conclusion into a real artifact is a write action. Surface it to the Director as a priority follow-up; do not perform the formalization yourself without approval.

## Steps

1. **Determine the active role.** ARC, FMN, DEV, or AUD.
2. **Run** `sigma memo list --role <role>`. This shows unread memos by default (oldest first).
3. **Resolve which memo(s) to read** per "If More Than One Memo Is Listed" above.
4. **Read the selected memo(s)** with `sigma memo read <id>`. This prints the content and marks it READ.
5. **Act on each memo's content**, per "Executing A Memo's Instructions" above:
   - Follow every pointer under "Reorientation — Read" — actually open the artifact section, inbox message, or `Sigma/notes/` file it names, do not just note that it exists.
   - Follow the read-only instructions under "Next Actions" directly; hold write-class ones for Director approval. Avoid whatever path it says was already tried and failed.
   - If "Blocked — Do Not Proceed Until" names an unresolved condition (a pending Director decision, a reply not yet received), do not proceed past it — surface it to the Director instead.
6. **Report what was learned** to the Director — the memo's content and whatever its references turned up — and ask for direction on further action. Do not decide the next step unilaterally; a memo exists precisely because the previous session ended before that decision was made.

## If The List Is Empty

Say so plainly — "no unread memos for `<role>`" — and continue. Do not treat an empty list as an error or invent content to report.

## Forbidden Operations

- `sigma intent ratify`, `sigma plan lock`, `sigma exec lock`, `sigma close lock`, any supersede command, any Sigma governance artifact-creation command, or any other write-class action a memo's content recommends — reading a memo never triggers any of these on its own. Run them only after the Director explicitly approves that specific action.
- Choosing which memo to read on your own when more than one is listed.
- Switching the active role.
- Marking a "Blocked" condition as resolved without the Director actually resolving it.
- Deciding the next action after reporting findings, instead of asking the Director for direction.

## No Invented Content

Report only what the memo's content actually says and what was actually found when following its pointers under "Reorientation — Read". If a pointer resolves to something unexpected (the artifact section no longer says what the memo claims, the referenced message is gone), say so — do not paper over the discrepancy.
