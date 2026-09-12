---
name: write-memo
description: "Write a self-to-self operational brief (sigma memo write) so the active role can resume cleanly in a later session"
---

# /write-memo — Sigma Memo Operational Brief

## Skill Identity

This is a universal, cross-role skill.

It is not a governance role. It does not switch roles, lock artifacts, ratify anything, supersede anything, or create any Sigma governance artifact. It writes exactly one memo via `sigma memo write` — a message the active role leaves for itself, not for anyone else.

It may be invoked by any active role (ARC, FMN, DEV, AUD) or by Professional Mode without switching roles. The active role remains active after the memo is written.

Reference: `PLAN-IMPL-SIGMA-MEMO-OPERATIONAL-BRIEF-20260902.md` and `Sigma/templates/MEMO-TEMPLATE.md`.

## What A Memo Is — And Is Not

> A memo is an operational brief — short, dense, to the point. It is not a supplement to, or a replacement for, any Sigma artifact.

- A memo holds **operational instructions and pointers**, not copies of artifact content. Correct: "read exec-evidence §1.2 before continuing." Wrong: retyping a decision that already lives in a DEV-EXEC.
- A memo does not go stale, because it points rather than snapshots. "Read section X" always resolves to that artifact's current version.
- A memo must never become a shadow artifact. A substantive conclusion that has not yet been persisted anywhere may appear only paired with an instruction to formalize it: `Conclusion: <X>. → formalize into exec-evidence §1.2 before proceeding.` A decision must not live only in a memo across more than one session hop.

This skill never applies `--to` — a memo is always self-addressed. A note meant for a different role is a `sigma send`, not a memo.

## Keeping Memos Brief

A memo must stay brief — a few dense sentences per section, not a report. If a piece of information genuinely needs a detailed explanation, do not write that explanation inside the memo.

Instead:

1. Check whether something already covers it — a DEV-EXEC, another Sigma artifact, or an existing file under `Sigma/notes/`. If so, point to that from "Reorientation — Read" instead of writing anything new.
2. If nothing existing covers it, create a new `.md` file under `Sigma/notes/` with the detailed explanation, and point to that file from "Reorientation — Read" instead of inlining the detail into the memo.
3. Creating a new file under `Sigma/notes/` for this purpose does not require Director approval — it is a normal AI-operational action, exactly like writing the memo itself.

This keeps the memo short while still making sure the detail is captured somewhere durable and pointed-to, rather than lost or crammed into a section that is supposed to stay brief.

## Assumption: Writing A Memo Signals The Session Is Ending

Writing a memo always assumes the Director intends to end the current session soon and move to a new one. The point is to let the *same role*, in that new session, pick the discussion back up or continue pending work — instead of re-explaining everything from scratch. This is normally needed to avoid an excessively long conversation or to work around the active AI's context limits.

In practice, writing a memo is a session-ending action. Once it is written, do not keep working in this session as if nothing happened — the memo's entire purpose is to hand off to the next session, not to serve as a checkpoint inside an ongoing one. It is recommended not to continue this session after the memo is written.

## Activation

```text
Create Memo
Write Memo
Write memo about this discussion in this session
Write memo about <topic we discussed in this session>
/write-memo
```

Does not self-activate. Only run this when the Director explicitly asks for a memo, or the active role itself decides a session is ending mid-work and asks the Director's permission first.

The Director may give the activation phrase in whichever language the current session is actively using for interaction (e.g. Indonesian or English — see `sigma config show` → AI Communication Language) — recognize the equivalent phrase in that language the same way. This skill document itself, like all Sigma skill and template documentation, is written in English regardless of the session's interaction language; only the Director's spoken trigger phrase adapts to it.

## Steps

1. **Determine the active role.** ARC, FMN, DEV, or AUD — whichever role is active in the current session. DIRECTOR never writes or receives memos.
2. **Determine `--ref`.** One of `INTENT-vN`, `PLAN-vN`, `EXEC-vN` (whichever artifact this memo's content actually concerns — not necessarily the chain's current phase), or `GENERAL` if the memo is not tied to a specific governed artifact (e.g. pre-INTENT Professional Mode exploration, or a purely operational note). If genuinely ambiguous, ask the Director once rather than guessing.
3. **Compose `--topic`.** One sentence, concrete enough that it is useful on its own in a list of memos (`sigma memo list`). This becomes the memo's subject if `--subject` is not given separately.
4. **Write the four narrative sections**, following `Sigma/templates/MEMO-TEMPLATE.md`. Keep every section brief — see "Keeping Memos Brief" above if something needs more than a couple of sentences:
   - **Context** — 2-3 sentences on the direction of this session's discussion and why it stopped here. Not a summary of artifact content. May be `—` if there is nothing beyond what the artifacts already say.
   - **Reorientation — Read** — concrete pointers (artifact + section, or an inbox message id) the next session should read first. Must not be empty.
   - **Next Actions** — concrete operational instructions for what to do next, and what to avoid (a path already tried and failed, with why). Must not be empty.
   - **Blocked — Do Not Proceed Until** — any Director decision or role reply this is waiting on. May be `—` if nothing is blocking.
5. **Write the body to a temporary file** (do not attempt to pass multi-line content through `--message` — newlines will not survive shell quoting).
6. **Run the command:**
   ```text
   sigma memo write --role <role> --ref <ref> --topic "<one sentence>" --message-file <path>
   ```
7. **Report the result to the Director** in one or two sentences: memo written, its id, and the current quota (the CLI's `Slot : n/limit` line).

## If The Quota Is Full

`sigma memo write` fails with the current role's unread memo list when the per-role quota (default 5) is reached. Do not attempt to force it. Surface the blocked list to the Director and ask whether to read (and act on) the oldest unread memos first, or whether one of them is now safe to leave unread a while longer.

## Forbidden Operations

- `sigma intent ratify`, `sigma plan lock`, `sigma exec lock`, `sigma close lock`, any supersede command, any Sigma governance artifact-creation command (`sigma intent new`, `sigma plan new`, `sigma exec new`, `sigma roadmap new`, `sigma close new`).
- `--to` on `sigma memo write` — not supported; use `sigma send` for cross-role messages instead.
- Switching the active role.
- Treating a memo as a place to record a decision permanently — see the shadow-artifact guardrail above.

The free-form `Sigma/notes/` file this skill may create per "Keeping Memos Brief" above is not a governance artifact and is not covered by this list — it needs no CLI command and no Director approval.

## No Invented Content

Every pointer under "Reorientation — Read" and every instruction under "Next Actions" must be grounded in the actual current session — an artifact that exists, a message id that exists, a path genuinely tried. Do not invent a reference to make the memo look more complete.
