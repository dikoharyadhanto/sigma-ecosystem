# Sigma Feature Note — Role Mailbox

## Purpose

Add a command-backed inter-role mailbox for Sigma.

Sigma uses multiple AI roles, but AI roles cannot communicate directly with each other. Without a mailbox, the Director becomes a manual copy-paste bridge between ARC, FMN, DEV, and AUD.

The Role Mailbox solves this by allowing one role to send a directed message to another role through Sigma-managed Markdown files.

Core idea:

```text
ARC / FMN / DEV / AUD can send messages to each other.
Messages are stored as Markdown files.
session bootstrap shows incoming role messages.
Director no longer needs to manually copy-paste every role response.
```

Control sentence:

```text
Messages notify.
CSO preserves.
Artifacts govern.
Director decides.
```

---

## Product Position

The Role Mailbox is not a governance artifact chain.

It is a lightweight communication layer between Sigma roles.

It must not replace:

- `DIR-INTENT`
- `ROADMAP`
- `FMN-PLAN`
- `DEV-EXEC`
- `DIR-CLOSE`
- `CSO`
- `progress.json`
- Director approval

Role messages are context only.

They do not approve, reject, lock, block, supersede, or mutate governance state.

---

## Why This Feature Exists

Sigma is multi-role and often multi-vendor.

In practice:

- AUD may need to send findings to ARC or FMN.
- FMN may need to send implementation notes to DEV.
- DEV may need to send blockers back to FMN.
- ARC may need to send intent clarification to FMN.
- A role may need to leave a targeted note for a future session.

Without a mailbox, the Director must manually copy-paste messages between tools.

The mailbox makes inter-role communication explicit, file-backed, and discoverable.

---

## Proposed Folder Structure

Use a project-local folder:

```text
Sigma/messages/
  ARC/
  FMN/
  DEV/
  AUD/
  DIRECTOR/
  attachments/
  index.json
```

### Folder Meaning

| Path | Purpose |
| :--- | :--- |
| `Sigma/messages/ARC/` | Inbox for ARC-directed messages |
| `Sigma/messages/FMN/` | Inbox for FMN-directed messages |
| `Sigma/messages/DEV/` | Inbox for DEV-directed messages |
| `Sigma/messages/AUD/` | Inbox for AUD-directed messages |
| `Sigma/messages/DIRECTOR/` | Optional inbox for Director-directed messages |
| `Sigma/messages/attachments/` | Copied attachment files |
| `Sigma/messages/index.json` | Message index and read/archive status |

---

## Message Authority

All messages must include:

```text
Authority Level: Context Only
```

This is mandatory.

A role message must never be treated as:

- Director approval,
- runtime state,
- locked artifact content,
- formal audit gate,
- evidence by itself,
- product release decision,
- closure acceptance.

If a message conflicts with locked artifacts, `progress.json`, or explicit Director instruction:

```text
Locked artifacts / progress.json / Director instruction win.
```

---

## CLI Commands — MVP

### 1. Send a message

```bash
sigma send --to fmn --message "Please review this implementation blocker."
```

With type:

```bash
sigma send --to fmn --type check --message "Plan test contract may be insufficient."
```

With subject:

```bash
sigma send --to dev --type handoff --subject "Implementation notes" --message "Follow the locked FMN-PLAN scope exactly."
```

With attachment:

```bash
sigma send --to fmn --type response --subject "ARC response to AUD" --message "Response attached." --attach arc_response.md
```

With explicit sender role:

```bash
sigma send --from aud --to fmn --type check --subject "Weak test contract" --message "TC-003 does not verify the real failure case."
```

### 2. List inbox messages

```bash
sigma inbox --role fmn
```

### 3. Read a message

```bash
sigma inbox read MSG-20260517-143012-AUD-FMN
```

Reading a message may mark it as `READ`.

### 4. Archive a message

```bash
sigma inbox archive MSG-20260517-143012-AUD-FMN
```

Archiving hides the message from default bootstrap notification but does not delete the Markdown file.

---

## CLI Commands — Proposed Syntax

```bash
sigma send \
  --from <arc|fmn|dev|aud|director> \
  --to <arc|fmn|dev|aud|director> \
  --type <note|check|response|handoff|question|risk> \
  --subject "<short subject>" \
  --message "<message body>" \
  [--attach <path>]
```

Short alias flags may be added later, but are not required for MVP.

---

## Valid Roles

Valid sender and target roles:

```text
arc
fmn
dev
aud
director
```

Canonical stored values:

```text
ARC
FMN
DEV
AUD
DIRECTOR
```

---

## Message Types

MVP message types:

| Type | Meaning |
| :--- | :--- |
| `NOTE` | General role note |
| `CHECK` | Review, critique, audit concern, or verification note |
| `RESPONSE` | Reply to a previous message |
| `HANDOFF` | Role-to-role handoff information |
| `QUESTION` | Direct question requiring another role’s judgment |
| `RISK` | Risk warning or concern |

Default type:

```text
NOTE
```

---

## Message File Naming

Recommended filename format:

```text
YYYYMMDD-HHMMSS-{TYPE}-{FROM_ROLE}-to-{TO_ROLE}.md
```

Example:

```text
Sigma/messages/FMN/20260517-143012-CHECK-AUD-to-FMN.md
Sigma/messages/AUD/20260517-144500-RESPONSE-FMN-to-AUD.md
```

Message ID format:

```text
MSG-YYYYMMDD-HHMMSS-FROM-TO
```

Example:

```text
MSG-20260517-143012-AUD-FMN
```

---

## Message Markdown Format

Each message file should use this structure:

```markdown
# Sigma Role Message

## Metadata

| Field | Value |
| :--- | :--- |
| Message ID | MSG-20260517-143012-AUD-FMN |
| Type | CHECK |
| From Role | AUD |
| To Role | FMN |
| Subject | Plan test contract is weak |
| Related Artifact | FMN-PLAN-v0.2 |
| Status | UNREAD |
| Created At | 2026-05-17T14:30:12+07:00 |
| Authority Level | Context Only |
| Attachments | Sigma/messages/attachments/MSG-20260517-143012-AUD-FMN-arc_response.md |

---

## Message

Please review the test contract. TC-003 does not verify the actual failure case.

---

## Requested Response

FMN should respond whether this requires:

- update current plan,
- open new plan,
- or accept as limitation.
```

---

## Attachment Behavior

If `--attach <file>` is used, the CLI should copy the file into:

```text
Sigma/messages/attachments/
```

Attachment filename should include the message ID:

```text
Sigma/messages/attachments/MSG-20260517-143012-AUD-FMN-arc_response.md
```

The message file should reference the copied attachment path.

Reason:

```text
Messages should remain self-contained even if the original attachment path changes.
```

---

## index.json

`Sigma/messages/index.json` may be used to track status.

Example:

```json
{
  "messages": [
    {
      "id": "MSG-20260517-143012-AUD-FMN",
      "from": "AUD",
      "to": "FMN",
      "type": "CHECK",
      "subject": "Plan test contract is weak",
      "file": "Sigma/messages/FMN/20260517-143012-CHECK-AUD-to-FMN.md",
      "status": "UNREAD",
      "created_at": "2026-05-17T14:30:12+07:00",
      "attachments": [
        "Sigma/messages/attachments/MSG-20260517-143012-AUD-FMN-arc_response.md"
      ]
    }
  ]
}
```

MVP statuses:

```text
UNREAD
READ
ARCHIVED
```

No complex thread lifecycle is required in MVP.

---

## session bootstrap Integration

`sigma session bootstrap` should surface recent unread messages for the active role.

Preferred role-aware form:

```bash
sigma session bootstrap --role fmn
```

Example output:

```text
Role Inbox — FMN
2 unread messages:

1. [AUD → FMN] CHECK: Plan test contract is weak
   File: Sigma/messages/FMN/20260517-143012-CHECK-AUD-to-FMN.md
   Attachment: Sigma/messages/attachments/MSG-20260517-143012-AUD-FMN-evidence.md

2. [ARC → FMN] NOTE: Intent scope clarified
   File: Sigma/messages/FMN/20260517-150201-NOTE-ARC-to-FMN.md
```

If no role is provided, bootstrap may either:

1. show all unread messages grouped by role, or
2. print a hint:

```text
Role mailbox available. Run `sigma session bootstrap --role <role>` or `sigma inbox --role <role>`.
```

Recommended MVP behavior:

```text
Show all unread messages grouped by role if no role is provided.
```

Limit default display:

```text
Show latest 3 unread messages per role.
```

---

## Relationship to `/check` and `/response`

If `/check` and `/response` exist, they should be skill-level wrappers around `sigma send`.

### `/check`

Creates a `CHECK` message.

Example:

```text
/check to FMN
```

AI behavior:

```bash
sigma send --from aud --to fmn --type check --subject "Weak test contract" --message "..."
```

### `/response`

Creates a `RESPONSE` message.

Example:

```text
/response to latest AUD check
```

AI behavior:

```bash
sigma send --from fmn --to aud --type response --subject "FMN response to AUD check" --message "..."
```

The command-backed mailbox is the source of truth. The skills only help AI produce the correct message content.

---

## Relationship to CSO

Role messages are not CSO.

| Feature | Purpose | Folder | Authority |
| :--- | :--- | :--- | :--- |
| Role Message | Directed note from one role to another | `Sigma/messages/` | Context only |
| `/checkpoint` CSO | Quick context preservation | `Sigma/logs/` | Context only |
| `/cso` CSO | Formal handoff | `Sigma/logs/` | Context only |
| Governance Artifact | Intent, plan, execution, closure | `Sigma/design`, `Sigma/build`, `Sigma/close` | Governed artifact |

Control sentence:

```text
Messages notify.
CSO preserves.
Artifacts govern.
Director decides.
```

---

## Role Immutability

Sending, reading, or archiving messages does not switch roles.

A role may send a message from its active role context.

A role must not pretend to be another role.

If `--from` is provided, it must match the active role unless explicitly authorized by the Director.

---

## Security and Safety Boundaries

### 1. No runtime mutation

Role messages do not mutate lifecycle state.

They must not change:

- `Sigma/progress.json`
- artifact state
- lock status
- gate status
- closure status

### 2. No authority escalation

A message from AUD is still advisory.

A message from FMN is still planning context.

A message from DEV is still implementation context.

A message from ARC is still intent/context support.

Only Director can approve, reject, lock, accept risk, supersede, or close.

### 3. No hidden external send

This mailbox is local-project only.

No network sending.

No external messaging integration in MVP.

### 4. Attachments are copied locally

Attachments must be copied into `Sigma/messages/attachments/`.

Do not reference external or unstable paths as the only attachment location.

---

## Suggested PLAN Scope

This should be a separate implementation plan.

Suggested title:

```text
PLAN-11 — Sigma Role Mailbox
```

### In scope

- Add `Sigma/messages/` initialization during `sigma project start`
- Add `sigma send`
- Add `sigma inbox --role <role>`
- Add `sigma inbox read <message-id>`
- Add `sigma inbox archive <message-id>`
- Add `Sigma/messages/index.json`
- Add message file creation logic
- Add attachment copy logic
- Add bootstrap notification output
- Update role skill files to mention mailbox use
- Add protocol section for Role Mailbox

### Out of scope for MVP

- message threads
- message search
- message priority
- cross-project messages
- notification daemon
- external network sending
- auto-routing
- full conversation UI
- complex read receipts
- deleting messages

---

## Suggested Acceptance Criteria

| AC ID | Criteria |
| :--- | :--- |
| AC-MSG-01 | `sigma project start` creates `Sigma/messages/ARC`, `FMN`, `DEV`, `AUD`, `DIRECTOR`, and `attachments` folders |
| AC-MSG-02 | `sigma send --to fmn --message "..."` creates a Markdown message file in `Sigma/messages/FMN/` |
| AC-MSG-03 | Message file includes required metadata table |
| AC-MSG-04 | Message metadata includes `Authority Level: Context Only` |
| AC-MSG-05 | `sigma send --attach file.md` copies the attachment into `Sigma/messages/attachments/` |
| AC-MSG-06 | `Sigma/messages/index.json` records message ID, sender, target, type, subject, path, status, timestamp, and attachments |
| AC-MSG-07 | `sigma inbox --role fmn` lists messages addressed to FMN |
| AC-MSG-08 | `sigma inbox read <message-id>` prints message content and marks status as READ |
| AC-MSG-09 | `sigma inbox archive <message-id>` marks message status as ARCHIVED |
| AC-MSG-10 | `sigma session bootstrap --role fmn` shows latest unread FMN messages |
| AC-MSG-11 | `sigma session bootstrap` without role shows unread messages grouped by role or gives clear role-inbox guidance |
| AC-MSG-12 | Role messages do not mutate `progress.json` or artifact state |
| AC-MSG-13 | Protocol documents that messages are context-only and non-authoritative |
| AC-MSG-14 | Role skill files explain when to use mailbox vs CSO |
| AC-MSG-15 | No external network sending exists in MVP |

---

## Final Doctrine

Sigma Role Mailbox is a local, file-backed message system for AI roles.

It reduces Director copy-paste burden without giving AI roles authority over each other.

Messages are visible.

Messages are directed.

Messages are context only.

```text
Messages notify.
CSO preserves.
Artifacts govern.
Director decides.
```
