# PLAN-12 — Sigma Role Mailbox

**Source**: `Discussion/SIGMA_ROLE_MAILBOX_FEATURE_NOTE.md`  
**Date**: 2026-05-17  
**Status**: DRAFT

---

## Objective

Implement a local, file-backed inter-role mailbox for Sigma.

AI roles cannot communicate directly. Without a mailbox, the Director is forced to manually copy-paste messages between ARC, FMN, DEV, and AUD sessions. The Role Mailbox makes inter-role communication explicit, file-backed, and surfaced automatically at bootstrap.

Control sentence:

```
Messages notify.
CSO preserves.
Artifacts govern.
Director decides.
```

---

## Scope

### In scope — MVP

- Add `Sigma/messages/` folder tree to `sigma project start`
- Add `Sigma/messages/index.json` initialization
- Add `sigma send` command
- Add `sigma inbox` command with `list`, `read`, `archive` subcommands
- Integrate unread message summary into `sigma session bootstrap`
- Add mailbox constants to `src/config.ts`
- Add shared mailbox engine at `src/engine/mailbox.ts`
- Register new commands in `src/cli.ts`

### Out of scope — MVP

- Message threads or conversation chains
- Message search
- Message priority levels
- Cross-project messages
- Notification daemon or polling
- External network sending
- Auto-routing by lifecycle phase
- Message deletion
- Complex read receipts
- Short alias flags for CLI options

---

## Folder Structure Created

`sigma project start` will create the following inside the project:

```
Sigma/messages/
  ARC/
  FMN/
  DEV/
  AUD/
  DIRECTOR/
  attachments/
  index.json
```

---

## Message File Format

Each message is stored as a Markdown file inside the recipient role's inbox folder.

**Filename format:**

```
YYYYMMDD-HHMMSS-{TYPE}-{FROM_ROLE}-to-{TO_ROLE}.md
```

Example: `Sigma/messages/FMN/20260517-143012-CHECK-AUD-to-FMN.md`

**Message ID format:**

```
MSG-YYYYMMDD-HHMMSS-{FROM}-{TO}
```

**Markdown content:**

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
| Status | UNREAD |
| Created At | 2026-05-17T14:30:12+07:00 |
| Authority Level | Context Only |
| Attachments | — |

---

## Message

[message body here]
```

`Authority Level: Context Only` is mandatory in every message file.

---

## index.json Format

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
      "attachments": []
    }
  ]
}
```

Valid statuses: `UNREAD`, `READ`, `ARCHIVED`

---

## Task Breakdown

---

### TASK-01 — Add Mailbox Constants to `src/config.ts`

**Files**: `src/config.ts`

Add constants for the messages folder, role inbox paths, and index file path.

```typescript
export const MESSAGES_DIR = path.join(PROJECT_SIGMA_DIR, 'messages');
export const MESSAGES_INDEX_FILE = path.join(MESSAGES_DIR, 'index.json');
export const MESSAGES_ATTACHMENTS_DIR = path.join(MESSAGES_DIR, 'attachments');
export const VALID_ROLES = ['ARC', 'FMN', 'DEV', 'AUD', 'DIRECTOR'] as const;
export type SigmaRole = typeof VALID_ROLES[number];
export const VALID_MESSAGE_TYPES = ['NOTE', 'CHECK', 'RESPONSE', 'HANDOFF', 'QUESTION', 'RISK'] as const;
export type MessageType = typeof VALID_MESSAGE_TYPES[number];
```

Also update `SUBFOLDERS` to include message subfolders so `project start` creates them:

```typescript
// SUBFOLDERS remains for the main Sigma/ tree
export const SUBFOLDERS = ['design', 'build', 'close', 'rules', 'logs', 'memory'];

// Separate constant for messages subfolders (role inboxes)
export const MESSAGE_SUBFOLDERS = ['ARC', 'FMN', 'DEV', 'AUD', 'DIRECTOR', 'attachments'];
```

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-01-1 | All mailbox constants exported from `src/config.ts` | TypeScript build passes |
| AC-01-2 | `VALID_ROLES` and `VALID_MESSAGE_TYPES` are typed tuples | Type check |

---

### TASK-02 — Update `sigma project start` to Initialize Mailbox

**Files**: `src/commands/project.ts`

In `runStart()`, after the existing subfolder creation loop, add:

1. Create `Sigma/messages/` directory
2. Create role inbox subfolders: `ARC/`, `FMN/`, `DEV/`, `AUD/`, `DIRECTOR/`, `attachments/`
3. Write `Sigma/messages/index.json` with empty messages array

```typescript
// Create messages folder tree
const messagesDir = path.join(projectRoot, MESSAGES_DIR);
fs.ensureDirSync(messagesDir);
for (const sub of MESSAGE_SUBFOLDERS) {
  fs.ensureDirSync(path.join(messagesDir, sub));
}

// Initialize index.json
const indexPath = path.join(projectRoot, MESSAGES_INDEX_FILE);
fs.writeJsonSync(indexPath, { messages: [] }, { spaces: 2 });
```

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-02-1 | `sigma project start` creates `Sigma/messages/ARC`, `FMN`, `DEV`, `AUD`, `DIRECTOR`, `attachments` | Check folder tree |
| AC-02-2 | `Sigma/messages/index.json` exists with `{ "messages": [] }` after `sigma project start` | Read file |
| AC-02-3 | Existing `sigma project start` behavior is unchanged | Run full start flow |

---

### TASK-03 — Create `src/engine/mailbox.ts`

**Files**: `src/engine/mailbox.ts` (new)

Shared engine module for all mailbox operations. Keeps `send.ts` and `inbox.ts` thin.

```typescript
export interface MessageEntry {
  id: string;
  from: SigmaRole;
  to: SigmaRole;
  type: MessageType;
  subject: string;
  file: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  created_at: string;
  attachments: string[];
}

export interface MessageIndex {
  messages: MessageEntry[];
}
```

Functions to implement:

| Function | Responsibility |
|---|---|
| `readIndex(projectRoot)` | Read and parse `index.json`; return empty index if missing |
| `writeIndex(projectRoot, index)` | Write `index.json` atomically |
| `generateMessageId(from, to, timestamp)` | Return `MSG-YYYYMMDD-HHMMSS-FROM-TO` |
| `generateFilename(type, from, to, timestamp)` | Return `YYYYMMDD-HHMMSS-TYPE-FROM-to-TO.md` |
| `buildMessageMarkdown(entry, body)` | Render the full Markdown file content |
| `getUnreadForRole(index, role)` | Return unread entries for a given role |
| `updateMessageStatus(index, id, status)` | Mutate entry status in-place; throw if not found |

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-03-1 | `readIndex` returns `{ messages: [] }` if `index.json` is absent | Unit check |
| AC-03-2 | `generateMessageId` produces correct `MSG-` prefix format | Manual test |
| AC-03-3 | `buildMessageMarkdown` includes `Authority Level: Context Only` | Check output |
| AC-03-4 | TypeScript build passes with no type errors | `npm run build` |

---

### TASK-04 — Implement `sigma send`

**Files**: `src/commands/send.ts` (new), `src/cli.ts` (register)

#### CLI Syntax

```bash
sigma send \
  --from <arc|fmn|dev|aud|director> \
  --to <arc|fmn|dev|aud|director> \
  --type <note|check|response|handoff|question|risk> \
  --subject "<short subject>" \
  --message "<message body>" \
  [--attach <path>]
```

`--from` is **required**. `--type` defaults to `NOTE`. `--subject` defaults to `(no subject)`.

#### Behavior

1. Validate `--from` and `--to` against `VALID_ROLES`
2. Validate `--type` against `VALID_MESSAGE_TYPES`; default to `NOTE`
3. Generate timestamp, message ID, and filename
4. If `--attach <file>` provided:
   - Verify source file exists; throw clear error if not
   - Copy to `Sigma/messages/attachments/<MSG-ID>-<originalname>`
   - Record attachment path in entry
5. Write message Markdown file to `Sigma/messages/<TO_ROLE>/<filename>.md`
6. Append entry to `index.json` via `writeIndex`
7. Print confirmation:

```
Message sent.
  ID      : MSG-20260517-143012-AUD-FMN
  From    : AUD → FMN
  Type    : CHECK
  Subject : Plan test contract is weak
  File    : Sigma/messages/FMN/20260517-143012-CHECK-AUD-to-FMN.md
```

#### Constraints

- Message must not mutate `progress.json` in any way
- `--from` must be provided; no silent default sender
- `--to` must be provided; no default target

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-04-1 | `sigma send --from aud --to fmn --message "..."` creates file in `Sigma/messages/FMN/` | Check folder |
| AC-04-2 | Message file includes metadata table with `Authority Level: Context Only` | Read file |
| AC-04-3 | Message file includes correct From Role, To Role, Type, Subject, Created At | Read file |
| AC-04-4 | `Sigma/messages/index.json` entry added with all required fields | Read file |
| AC-04-5 | `sigma send` without `--from` exits with clear error | Run command |
| AC-04-6 | `sigma send` without `--to` exits with clear error | Run command |
| AC-04-7 | `sigma send --attach file.md` copies file to `Sigma/messages/attachments/` | Check folder |
| AC-04-8 | `sigma send --attach missing.md` exits with clear error if file not found | Run command |
| AC-04-9 | `progress.json` is not modified by any `sigma send` invocation | Check file before/after |

---

### TASK-05 — Implement `sigma inbox`

**Files**: `src/commands/inbox.ts` (new), `src/cli.ts` (register)

#### Subcommands

**1. `sigma inbox --role <role>`** — list inbox messages

```bash
sigma inbox --role fmn
```

Output example:

```
Role Inbox — FMN
2 unread messages:

1. [AUD → FMN] CHECK: Plan test contract is weak
   ID   : MSG-20260517-143012-AUD-FMN
   File : Sigma/messages/FMN/20260517-143012-CHECK-AUD-to-FMN.md

2. [ARC → FMN] NOTE: Intent scope clarified
   ID   : MSG-20260517-150201-ARC-FMN
   File : Sigma/messages/FMN/20260517-150201-NOTE-ARC-to-FMN.md
```

If no unread messages:

```
Role Inbox — FMN
No unread messages.
```

Default behavior: show only `UNREAD` messages. Use `--all` to include `READ` and `ARCHIVED`.

**2. `sigma inbox read <message-id>`** — print message and mark READ

```bash
sigma inbox read MSG-20260517-143012-AUD-FMN
```

Behavior:
1. Look up message ID in `index.json`
2. Read and print the full Markdown file content
3. Update status to `READ` in `index.json`

**3. `sigma inbox archive <message-id>`** — archive a message

```bash
sigma inbox archive MSG-20260517-143012-AUD-FMN
```

Behavior:
1. Look up message ID in `index.json`
2. Update status to `ARCHIVED` in `index.json`
3. Print confirmation: `Message MSG-20260517-143012-AUD-FMN archived.`

Archiving does **not** delete the Markdown file.

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-05-1 | `sigma inbox --role fmn` lists unread messages for FMN | Run command after `sigma send` |
| AC-05-2 | `sigma inbox --role fmn` shows "No unread messages." if inbox is empty | Run on empty inbox |
| AC-05-3 | `sigma inbox read <id>` prints message content | Run command |
| AC-05-4 | `sigma inbox read <id>` updates status to `READ` in `index.json` | Check file |
| AC-05-5 | `sigma inbox archive <id>` updates status to `ARCHIVED` in `index.json` | Check file |
| AC-05-6 | `sigma inbox archive <id>` does not delete the Markdown file | Check file still exists |
| AC-05-7 | `sigma inbox read <unknown-id>` exits with clear error | Run command |
| AC-05-8 | `sigma inbox` without `--role` exits with clear usage hint | Run command |

---

### TASK-06 — Integrate Mailbox into `sigma session bootstrap`

**Files**: `src/commands/session.ts`

In `runBootstrap()`, after the existing output block, add a mailbox summary section.

#### Behavior

If `--role <role>` is provided:
- Read `index.json`
- Filter for `UNREAD` messages addressed to that role
- Show up to 3 most recent unread messages

```
Role Inbox — FMN
2 unread messages:

1. [AUD → FMN] CHECK: Plan test contract is weak
   Sigma/messages/FMN/20260517-143012-CHECK-AUD-to-FMN.md

2. [ARC → FMN] NOTE: Intent scope clarified
   Sigma/messages/FMN/20260517-150201-NOTE-ARC-to-FMN.md

Run: sigma inbox --role fmn
```

If no `--role` provided:
- Group unread messages by recipient role
- Show latest 3 unread per role that has messages
- If no messages at all, print nothing (no mailbox noise when it's empty)

```
Role Mailbox — Unread Messages

  FMN (2 unread)
  1. [AUD → FMN] CHECK: Plan test contract is weak

  ARC (1 unread)
  1. [DEV → ARC] RISK: Implementation diverged from plan

Run: sigma inbox --role <role>    sigma inbox read <id>
```

If `index.json` does not exist (old project without mailbox), skip silently — no crash.

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-06-1 | `sigma session bootstrap --role fmn` shows unread FMN messages | Run after `sigma send --to fmn` |
| AC-06-2 | `sigma session bootstrap` without role shows unread messages grouped by role | Run with multiple messages |
| AC-06-3 | Bootstrap shows at most 3 unread messages per role | Send 5 messages and run bootstrap |
| AC-06-4 | Bootstrap does not crash if `index.json` is absent | Run on project without mailbox |
| AC-06-5 | Bootstrap shows nothing if no unread messages | Run on empty inbox |

---

### TASK-07 — Register Commands in `src/cli.ts`

**Files**: `src/cli.ts`

Import and register the two new commands:

```typescript
import { sendCommand } from './commands/send';
import { inboxCommand } from './commands/inbox';

// ... existing registrations ...
program.addCommand(sendCommand());
program.addCommand(inboxCommand());
```

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-07-1 | `sigma send --help` shows correct usage | Run command |
| AC-07-2 | `sigma inbox --help` shows correct usage | Run command |
| AC-07-3 | `sigma --help` lists `send` and `inbox` in command list | Run command |

---

### TASK-08 — Update Role Rule Files with Mailbox Section

**Files**: `Discussion/ARC-RULE.md`, `Discussion/FMN-RULE.md`, `Discussion/DEV-RULE.md`, `Discussion/AUD-RULE.md`

Two additions per rule file:

#### Addition 1 — Session Bootstrap section

Add one instruction to the existing Session Bootstrap section of each rule file:

```
- Run `sigma session bootstrap --role <role>` — check the Role Mailbox section
  for unread messages before starting work. Or run `sigma inbox --role <role>`
  mid-session if Director indicates a message has arrived.
```

#### Addition 2 — New "Role Mailbox" section

Add a new section to each rule file defining when that role should send messages,
to whom, and what is forbidden.

**ARC — Role Mailbox**

| Send to | Type | Trigger |
|---|---|---|
| FMN | `HANDOFF` | Before DIR-INTENT is locked; strategic context that cannot fit in the document itself |
| AUD | `RESPONSE` | Replying to an AUD CHECK about DIR-INTENT |

**FMN — Role Mailbox**

| Send to | Type | Trigger |
|---|---|---|
| DEV | `HANDOFF` | After FMN-PLAN is locked; implementation notes that supplement the plan |
| ARC | `QUESTION` | DIR-INTENT is ambiguous; ARC session needed for clarification |
| AUD | `RESPONSE` | Replying to an AUD CHECK about the test contract |

**DEV — Role Mailbox**

| Send to | Type | Trigger |
|---|---|---|
| FMN | `RISK` | Implementation hit a blocker that may require plan revision |
| FMN | `QUESTION` | Plan is unclear enough that implementation cannot proceed safely |

**AUD — Role Mailbox**

| Send to | Type | Trigger |
|---|---|---|
| ARC | `CHECK` | DIR-INTENT has a concern that ARC must address |
| FMN | `CHECK` | Test contract is weak, missing, or does not verify real failure cases |
| DEV | `CHECK` | Evidence in DEV-EXEC is insufficient to support a closure decision |

#### Universal constraint (add to all four rule files)

```
Role Mailbox is not a substitute for Director escalation.

If a decision is required — escalate to Director.
Do not send a message to another role expecting it to function as approval,
rejection, or authority. Messages are context only.

Before sending a message, follow the CLI Operator Model:
  1. State what you intend to send and why.
  2. Run: sigma send --from <role> --to <role> --type <type> --subject "..." --message "..."
```

**Acceptance criteria**:

| AC | Criteria | Verification |
|---|---|---|
| AC-08-1 | All four rule files have mailbox instruction added to Session Bootstrap section | Read each file |
| AC-08-2 | All four rule files have a new "Role Mailbox" section with trigger table | Read each file |
| AC-08-3 | All four rule files include the universal constraint paragraph | Read each file |
| AC-08-4 | No rule file gives a role authority to approve, reject, or lock via message | Read each file |

---

## Implementation Order

```
Phase 1 — Foundation (no dependencies between these)
  TASK-01   src/config.ts constants
  TASK-03   src/engine/mailbox.ts

Phase 2 — Commands (depends on Phase 1)
  TASK-02   sigma project start — mailbox init
  TASK-04   sigma send
  TASK-05   sigma inbox

Phase 3 — Integration (depends on Phase 2)
  TASK-06   sigma session bootstrap integration
  TASK-07   Register commands in src/cli.ts

Phase 4 — Documentation (independent, can run in parallel with Phase 1–3)
  TASK-08   Update role rule files
```

TASK-01 and TASK-03 can be done in parallel.  
TASK-02, TASK-04, TASK-05 can be done in parallel after Phase 1.  
TASK-07 must come last (depends on send.ts and inbox.ts existing).  
TASK-08 is documentation-only and can run at any point independently.

---

## Risk / Watch-Out

| Risk | Mitigation |
|---|---|
| `--from` accidentally omitted causes unclear errors | Validate early in `send.ts` with explicit message: `--from is required. Use: sigma send --from <role> --to <role>` |
| `index.json` write collision if two sends happen simultaneously | Acceptable for MVP (CLI is single-process; no daemon) |
| Old projects without `Sigma/messages/` folder | Bootstrap skips mailbox silently if `index.json` absent |
| Attachment source path contains spaces or special chars | Use `path.resolve()` and `fs-extra` copy; no shell interpolation |
| `sigma inbox read` on large messages floods terminal | MVP: print as-is; paging is post-MVP |
| index.json grows unbounded over time | Out of scope for MVP; archive status is the only cleanup mechanism |
| Rule files updated but installed copies in `~/.sigma/rules/` are stale | Remind Director to re-run `sigma setup install` after rule file updates |

---

## Implementation Constraints

| Constraint | Reason |
|---|---|
| `progress.json` must not be touched by any mailbox command | Messages are context only; lifecycle state is unchanged |
| `--from` is required for `sigma send` | Role immutability and auditability require explicit sender declaration |
| Attachment files must be copied, not referenced by original path | Messages must remain self-contained if the original file moves |
| Bootstrap mailbox block must be silent if no messages exist | Avoid noise when mailbox is empty or absent |
| No external network calls | MVP is local-only; no integration with email, Slack, or any remote service |
