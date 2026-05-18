# PLAN-15 — Mailbox Send Feature Corrections

**Source**: Review findings for the recently added mailbox send/inbox feature  
**Date**: 2026-05-18  
**Status**: DRAFT

---

## Objective

Correct the real flaws in Sigma's mailbox send flow while keeping the current unread-message gate as an intentional temporary policy.

The current implementation works for the happy path, but it still contains two serious issues:

- non-unique message IDs and filenames under same-second sends
- silent mailbox index recovery that can destroy prior message history

This plan stabilizes the temporary mailbox model now in use:

```text
One unread message per recipient is enforced temporarily.
Each message must still be uniquely addressable.
Mailbox corruption must fail loudly, not self-heal by dropping history.
```

---

## Scope

### In scope

- preserve and document the unread-message send gate as temporary flow-control policy
- make message IDs and filenames collision-resistant
- harden mailbox index read/write behavior
- add regression tests for send/inbox behavior
- update mailbox docs/spec text to match actual implemented behavior

### Out of scope

- message threads
- priority queues
- cross-project mailbox
- message search
- inbox UX redesign
- changes to governance artifacts or `progress.json`

---

## Design Constraints

| Constraint | Rule |
|---|---|
| Mailbox is context-only | `sigma send` and `sigma inbox` must never mutate `progress.json`. |
| Temporary sequential gate stays | A recipient may not receive a new message while they still have unread mailbox entries. |
| Message identity must be stable | `read` and `archive` must always target exactly one message. |
| Corruption must be visible | Broken `index.json` must not be silently reset to an empty mailbox. |
| Existing mailbox structure stays | Keep `Sigma/messages/<ROLE>/`, `attachments/`, and `index.json`. |

---

## Task Breakdown

---

### TASK-01 — Formalize unread-message send gating

**Primary area**: [send.ts](I:\Works\Project\sigma-ecosystem\src\commands\send.ts)

The current send flow blocks any new message if the recipient already has unread mail. That is now treated as an intentional temporary flow-control policy to prevent AI roles from skipping unread mailbox entries.

This policy must be revisited when Sigma has either:

- explicit mailbox threading / message acknowledgment semantics strong enough to prevent unread skipping, or
- a later approved mailbox redesign that safely supports multi-unread queueing per recipient

Until then, treat the gate as a medium-term operational safeguard, not a permanent product guarantee.

#### Required implementation

- keep the unread-recipient gate in `sigma send`
- make the policy explicit in command help, documentation, and examples
- ensure the blocking error remains actionable and points to `sigma inbox --role <role>` and `sigma inbox read <id>`
- align mailbox examples so they no longer imply multiple unread messages per recipient under the current policy

#### Acceptance criteria

- `sigma send` is blocked when the recipient already has unread messages
- the blocking error clearly explains why sending is blocked and how to clear the unread queue
- no canonical mailbox doc claims that multiple unread messages for one recipient are valid under the current policy
- no mailbox command writes to `progress.json`

---

### TASK-02 — Make message identity collision-resistant

**Primary areas**: [mailbox.ts](I:\Works\Project\sigma-ecosystem\src\engine\mailbox.ts), [send.ts](I:\Works\Project\sigma-ecosystem\src\commands\send.ts), [inbox.ts](I:\Works\Project\sigma-ecosystem\src\commands\inbox.ts)

Current IDs and filenames are derived from second-level timestamp plus sender/recipient. That is not unique enough. Two messages sent within the same second can overwrite files or create duplicate IDs.

#### Required implementation

Introduce collision-resistant identity generation.

Use one fixed approach:

- extend ID and filename generation with millisecond precision plus a short random suffix

The chosen identity format must guarantee:

- unique `MessageEntry.id`
- unique markdown filename per message
- unique attachment filename prefix when attachment is copied

#### Behavior requirements

- `sigma inbox read <id>` must resolve exactly one message
- `sigma inbox archive <id>` must resolve exactly one message
- duplicate IDs in `index.json` must be treated as mailbox corruption, not tolerated silently

#### Acceptance criteria

- two messages from the same sender to the same recipient sent in the same second produce different IDs
- two such messages produce different markdown filenames
- attachment filenames remain distinct across fast repeated sends
- `read` and `archive` operate on one unique message only

---

### TASK-03 — Harden mailbox index integrity

**Primary area**: [mailbox.ts](I:\Works\Project\sigma-ecosystem\src\engine\mailbox.ts)

`readIndex()` currently falls back to `{ messages: [] }` if `index.json` is malformed. That makes the next successful send capable of overwriting mailbox history with a partial index.

#### Required implementation

Replace silent fallback with explicit mailbox integrity validation.

Validation must check:

- `index.json` parses as JSON
- top-level object contains `messages`
- `messages` is an array
- each message has required fields with valid types
- each `id` is unique
- each `file` path is unique
- each `status` is one of `UNREAD`, `READ`, `ARCHIVED`

#### Error policy

- send/list/read/archive must fail with a clear mailbox corruption error if `index.json` is malformed
- the error must name `Sigma/messages/index.json`
- the error must tell the operator to inspect or restore the mailbox index instead of silently continuing
- the error must include a concrete recovery path for existing duplicate-ID mailboxes, such as rebuilding the index from message files or manually removing the corrupt duplicate entries

Optional helper:

- add a small mailbox validation helper in `mailbox.ts` used by both send and inbox flows

#### Acceptance criteria

- malformed `index.json` blocks `sigma send`
- malformed `index.json` blocks `sigma inbox`
- malformed `index.json` is never auto-replaced with an empty mailbox
- duplicate IDs are reported as corruption
- corruption errors include operator-facing recovery guidance for duplicate-ID mailbox states created by older builds

---

### TASK-04 — Add mailbox regression tests

**Primary area**: `test/`

The current repository does not appear to have dedicated tests for `sigma send` and `sigma inbox`. That leaves the mailbox contract exposed to regressions.

#### Required test additions

Add focused tests for:

- `sigma send` creates message file and index entry
- `sigma send` does not modify `progress.json`
- `sigma send` is blocked when the recipient already has unread messages
- same-second repeated sends produce distinct IDs and filenames
- attachments are copied with unique names
- `sigma inbox --role <role>` lists unread messages correctly under the one-unread gate
- `sigma inbox read <id>` marks exactly one target message as `READ`
- `sigma inbox archive <id>` marks exactly one target message as `ARCHIVED`
- malformed `index.json` blocks send/list/read/archive with a clear error
- duplicate ID corruption is detected

#### Acceptance criteria

- mailbox test coverage exists for both happy path and corruption path
- tests prove unread-gate behavior explicitly
- tests prove uniqueness behavior explicitly
- same-second collision tests use a stubbed or injected timestamp source so they are deterministic in CI

---

### TASK-05 — Sync mailbox docs and examples

**Primary areas**: [PLAN-12.md](I:\Works\Project\sigma-ecosystem\Implementation\PLAN-12.md), [README.md](I:\Works\Project\sigma-ecosystem\README.md), [SIGMA_README.md](I:\Works\Project\sigma-ecosystem\SIGMA_README.md), [SIGMA_PROTOCOL.md](I:\Works\Project\sigma-ecosystem\Sigma\SIGMA_PROTOCOL.md)

After the code lands, mailbox documentation must match the corrected behavior.

#### Required implementation

- document the unread-recipient gate as a temporary mailbox control policy
- document message identity as unique and stable, not just timestamp-derived
- document that mailbox index corruption is an explicit error state
- remove or revise examples that imply multiple unread messages for a single recipient under the current implementation

#### Acceptance criteria

- canonical docs explicitly describe the unread-send gate
- examples no longer imply unsupported multi-unread mailbox behavior
- docs reflect corruption-fails-loudly behavior

---

## Implementation Order

1. TASK-04 (partial) — write failing tests for unread-gate behavior, ID collisions, and index corruption
2. TASK-01 — formalize unread gate behavior in runtime messaging and docs
3. TASK-02 — fix identity generation and uniqueness checks
4. TASK-03 — harden `index.json` validation and corruption handling
5. TASK-05 — sync docs to actual landed behavior

This order keeps the send behavior under test before changing mailbox internals.

---

## Test Plan

Verify with:

- `npm run build`
- `npm test`

Key scenarios:

- second send to the same recipient is blocked while the first message remains unread
- back-to-back sends in the same second remain uniquely addressable
- `inbox read/archive` touch only the intended message
- corrupt mailbox index fails loudly and preserves history on disk

---

## Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| ID format change breaks assumptions | Existing tools or docs may rely on old timestamp-only shape | Keep prefix stable as `MSG-...`; document the new suffix/precision shape |
| Corruption checks feel stricter than current behavior | Existing malformed test fixtures may stop working | Add explicit recovery messaging and fixture updates alongside validation |
| Temporary unread gate becomes de facto permanent | "Temporary" policies tend to persist unless revisit conditions are named | Tie removal to future threading/acknowledgment or approved mailbox redesign |
| Same-second send tests are flaky | Clock-dependent tests can fail intermittently | Stub timestamp generator or inject deterministic timestamp in mailbox tests |

---

## Done Criteria

`PLAN-15` is complete when:

- mailbox unread-send gate is explicitly documented and tested as temporary policy
- every message has a unique ID and unique file path
- malformed mailbox index is treated as an error, not silently reset
- send/inbox behavior is covered by dedicated regression tests
- mailbox docs match the corrected implementation
