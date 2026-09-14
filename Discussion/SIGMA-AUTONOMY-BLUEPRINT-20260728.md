# Sigma Autonomy Blueprint — From Governance Kernel to Autonomous Agent System

- **Date:** 2026-07-28
- **Status:** Advisory discussion document (Professional Mode). NOT a governance artifact — this feeds future DIR-INTENTs, one per phase.
- **Author:** Claude (Fable 5), at Director's request
- **Scope:** The evolution path for Sigma from a manually-operated governance CLI into an autonomous multi-agent system where the Director's only manual actions are (1) intent authorship and (2) approval decisions.

---

## 1. Vision

Today, one human-driven AI session plays every role in turn: the Director activates ARC, then FMN, then DEV, then AUD, session by session, and authorizes locks in conversation.

The target state:

```
Director writes intent (with ARC, interactive — kept human by design)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│  AUTONOMOUS PIPELINE (no human in the loop)             │
│                                                         │
│  intent LOCKED ──▶ FMN agent drafts ROADMAP + FMN-PLAN  │
│  plan LOCKED ────▶ DEV agent implements in a worktree   │
│  exec drafted ───▶ kernel runs the test contract        │
│  evidence OK ────▶ AUD agent reviews adversarially      │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
              Director's approval queue
     (request + kernel-verified evidence + AUD note)
                           │
              approve ─────┴───── reject (with reason,
                 │                 routed back to the role)
                 ▼
              pipeline resumes
```

The Director's job collapses to: **talk to ARC, review the approval queue.** Everything else runs unattended.

### Why Sigma specifically can carry this

Every mainstream agent framework enforces guardrails with prompts, and long-running agents drift through prompts. Sigma's guardrails are **state**: gates and locks live in `progress-v<N>.json` and the CLI refuses invalid transitions. An autonomous DEV agent cannot start before Gate 2 opens and cannot lock its own work — not because it was told not to, but because the kernel refuses. Containment is the hard problem of autonomy, and it is the part Sigma has already built.

---

## 2. Design Principles (constitution for the autonomy layer)

1. **The kernel enforces; agents only propose.** No agent ever mutates gate/lock state. Agents draft artifacts, send mail, and file requests. Only the CLI transitions state, and Director-class transitions only happen through an approval record.
2. **Approval is state, not conversation.** "Lock it" typed in a chat is not machine-verifiable and requires the Director to be present. An approval must be a durable record the pipeline can suspend on and resume from.
3. **Evidence is collected by the kernel, never self-reported.** In a manual system, a false "tests pass" is caught socially. In an autonomous system it is caught never — unless the kernel itself runs the test contract and attaches the captured result.
4. **ARC stays interactive, permanently.** Intent is where Director sovereignty lives. Automating the intent interview would automate away the human's authority — the exact opposite of Sigma's purpose.
5. **Autonomy is added in rings, from the most mechanizable role outward.** DEV first (a locked FMN-PLAN with a test contract literally defines "done"), then AUD, then FMN. Never all at once.
6. **Every phase must be independently valuable with everything else still manual.** No phase may depend on a later phase to be useful. This is the safety net for a first-time builder: you can stop after any phase and still have a better Sigma than before.

---

## 3. Asset Inventory — what already exists and what it becomes

| Existing Sigma component | Role in the autonomous system |
| :--- | :--- |
| Role rule files (`Sigma/rules/*.md`) | Agent system prompts, essentially ready to use |
| Role memory (`role-memory/*.json`) | Per-agent persistent instructions |
| `sigma send` / `sigma inbox` | Inter-agent message bus; unread gate = built-in backpressure |
| Gates + locks in `progress-v<N>.json` | Natural suspension points where the pipeline halts itself |
| `sigma {domain} check` (lock readiness) | Agent self-assessment: "am I ready to file an approval request?" |
| MCP read-only tools (`sigma_get_state`, …) | Agent orientation without shell access |
| `operations.jsonl` | Audit trail of everything agents did unattended |
| Role immutability rule | Maps 1:1 onto "one agent process = one role" |
| `sigma git evidence` | Seed of the evidence engine |
| `sigma override` (`--director-confirm`, audit log) | The pattern to copy for the approval primitive |

Roughly 70% of the system exists. The missing 30% is three primitives: **the approval queue, the evidence engine, and the dispatcher.** Everything below is about building those three, in the right order.

---

## 4. The Three New Primitives

### 4.1 Approval Queue (the keystone)

New commands (naming indicative — final shape is ARC/FMN work):

```
sigma request lock --domain exec        # filed BY an agent (or manually);
                                        # runs `exec check` first, refuses to file
                                        # unless Eligible; captures the readiness
                                        # report into the request record

sigma approvals                         # Director: list pending requests, each with
                                        # artifact ref, check report, evidence refs,
                                        # AUD note ref (when Phase 4 exists)

sigma approvals show <id>               # full detail of one request

sigma approve <id> --director-confirm   # execute the requested command (e.g. exec lock)
                                        # and record the authorization
sigma reject <id> --reason "<text>"     # record rejection; deliver reason to the
                                        # requesting role via sigma send
```

Storage sketch:

- `Sigma/approvals/pending/REQ-<id>.json` — one file per pending request (same isolation philosophy as one-chain-per-file)
- `Sigma/approvals/approvals.jsonl` — append-only decision log (approve/reject, timestamp, reason), sibling of `overrides.jsonl`

Semantics that matter:

- A request is **bound to chain state at filing time**: it records chain version + artifact version + a content hash of the artifact file. If the artifact changes after filing, the request auto-invalidates (prevents approve-after-edit).
- `approve` does not merely *permit* the lock — it **executes** it, atomically with recording the decision. There is never an approved-but-not-executed limbo.
- Rejection routes the reason back to the requesting role's inbox, so the loop is closed inside the existing mailbox system.

**Why this phase is first:** it is valuable with zero automation. Even fully manual, it means the Director no longer has to be present in the working session to authorize — they review a queue on their own schedule. It also creates the exact interface the dispatcher will later suspend on.

### 4.2 Evidence Engine

New command family (indicative):

```
sigma exec verify                       # parse the test contract from the LOCKED
                                        # FMN-PLAN, run it, capture exit codes +
                                        # output + timestamp into an evidence record

sigma exec verify -- <command>          # explicit command variant while the
                                        # test-contract format stabilizes
```

- Evidence records live in the chain (`progress-v<N>.json`) or `Sigma/evidence/`, referenced by the DEV-EXEC artifact — captured by the kernel, hash-stamped, never hand-written.
- `exec check` gains a rule: a DEV-EXEC claiming test success without a matching kernel evidence record is **Not eligible** for lock.
- `sigma request lock --domain exec` refuses to file without fresh evidence (evidence older than the last artifact edit = stale).

Prerequisite inside this phase: the FMN-PLAN test-contract section needs a small machine-readable convention (e.g. fenced block listing runnable commands) — an FMN-PLAN-TEMPLATE change plus doc-check validation.

**Why second:** it makes every approval the Director grants *grounded* — and it is the hard precondition for ever trusting an unattended DEV.

### 4.3 Dispatcher (autonomy itself)

A thin orchestrator — `sigma-agent` (separate bin, same repo), not part of the governance kernel:

- **Watch:** poll chain state + inboxes (later: file watching). Detect transitions: intent LOCKED and no plan → FMN's turn; plan LOCKED and no exec → DEV's turn; exec drafted + evidence green → AUD's turn.
- **Spawn:** launch a headless role session (Claude Agent SDK / `claude -p`) with the role rule file + role memory + inbox contents as context, in the project directory. One process = one role = one session — role immutability holds by construction.
- **Contain:** DEV runs in a dedicated git worktree/branch; the dispatcher enforces budget caps (max turns, max spend, wall-clock timeout) and a retry limit (e.g. two failed verify cycles → stop and message the Director instead of looping).
- **Suspend/resume:** when an agent files an approval request, its process ends. On `sigma approve`, the dispatcher spawns the next role. The pipeline's "memory" is entirely in Sigma state — no long-lived agent processes, no hidden state. Crash-safe by design.
- **Notify:** on new approval request or escalation, ping the Director (start dumb: desktop notification or a watched file; a messaging-app channel can come later).

The dispatcher holds **no authority**: it can be killed at any moment and the system degrades gracefully back to manual operation. That property should be treated as an invariant and tested.

---

## 5. Phase Plan

Each phase = one future DIR-INTENT. Definition of done is written so a future ARC/FMN can lift it into acceptance criteria.

### Phase 0 — Foundations hardening *(recommended, small)*
- **Build:** `sigma doctor --docs` — validate every `sigma …` command string in rules/protocol/README against the live command tree (the 2026-07-28 drift sweep, automated). Optionally wire into CI.
- **Why:** autonomous agents read the rule docs as system prompts; drifted docs become drifted agent behavior. This closes Sigma's most recurrent bug class before agents start trusting the docs blindly.
- **Done when:** a deliberately planted fake command in a rule file fails the check; the real docs pass.

### Phase 1 — Approval as state
- **Build:** §4.1 in full. Manual filing first (`sigma request lock` run by the human-driven session).
- **Done when:** a lock can be requested in one session and approved from a completely separate terminal at a later time; rejection lands in the requesting role's inbox; an artifact edited after filing invalidates its request; every decision appears in `approvals.jsonl`.

### Phase 2 — Evidence engine
- **Build:** §4.2 in full, including the test-contract convention in FMN-PLAN-TEMPLATE.
- **Done when:** an exec-lock approval request cannot be filed without fresh kernel-captured evidence, and `sigma approvals show` displays the evidence beside the request.

### Phase 3 — DEV autonomy pilot
- **Build:** dispatcher v0 — single role, single trigger: plan LOCKED → spawn headless DEV in a worktree → implement → `exec verify` → file request → exit. Budget caps + retry limit + escalation message.
- **Run it on a real but low-stakes chain in a real project.**
- **Done when:** a plan locked in the evening produces, by morning, either a pending exec-lock approval with green evidence, or an escalation message explaining why — with zero human involvement in between and total spend within the configured cap.

### Phase 4 — Multi-role pipeline
- **Build:** dispatcher triggers for FMN (intent LOCKED → draft ROADMAP + plan → request plan lock) and AUD (evidence green → produce AUD-NOTE → attach to the pending request before it surfaces to the Director). Notification channel. `sigma approvals` becomes the Director's single pane of glass.
- **Done when:** from `intent lock` to a closure-ready chain, the Director's only actions were approvals — and every request arrived carrying both kernel evidence and an AUD note.
- **Deliberately excluded, permanently:** automating the ARC interview (Principle 4).

### Phase 5 — Horizon (unscoped ideas, revisit after Phase 4 has operating history)
- Cycle-time metrics from `operations.jsonl` (`sigma report cycle`) — find where the pipeline stalls.
- Lightweight "micro-chain" track so autonomy overhead scales with task size.
- Multi-project dispatcher (one daemon, many registered projects).
- Approval from mobile (messaging-bot bridge to `sigma approve`).

---

## 6. Risks and Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Approval fatigue** — Director rubber-stamps green-looking requests | Never surface a request without kernel evidence + AUD note (Phases 2 & 4 are the mitigation, which is why they precede full autonomy); keep per-chain request volume low |
| **Runaway loops / cost** — DEV retries forever on a failing contract | Dispatcher budget caps (turns, spend, wall-clock) + retry limit + escalation-instead-of-loop; caps live in config, not prompts |
| **Blast radius of an unattended DEV** | Worktree/branch isolation; dispatcher never runs agents on `main`; cleanup = `git branch -D` |
| **Evidence gaming** — agent edits tests to pass | Test contract lives in the LOCKED FMN-PLAN (agent cannot edit a locked artifact); evidence records the contract hash it ran against; AUD reviews diffs to test files as a standing checklist item |
| **Prompt injection via mailbox** — a compromised/confused role sends manipulative messages | Messages are advisory input only (already doctrine); state transitions only via kernel + approval records, so a poisoned message cannot move a gate |
| **Approve-after-edit races** | Content-hash binding in the request record (§4.1) |
| **Dispatcher becomes a hidden authority** | Invariant: kill the dispatcher at any moment → system degrades to manual Sigma with zero state loss; test this explicitly |

---

## 7. Open Decisions (Director input needed before Phase 1 planning)

1. **Agent runtime:** Claude Agent SDK (programmatic, recommended) vs. `claude -p` subprocess (simpler)?
2. **Notification channel** for the approval queue: terminal/desktop first, or messaging-app bridge from day one?
3. **Approval granularity:** approvals only for today's Director-class commands (locks, supersede), or also for chain-creating steps (`plan new` by an autonomous FMN)?
4. **Budget policy:** per-chain spend/turn caps — configured where (`project.config.json` vs. global `~/.sigma/`)?
5. **Pilot project:** which real project hosts the Phase 3 DEV pilot?

---

## 8. How to Use This Document

1. Start a **fresh session** and activate ARC (role immutability — planning must not share a session with this drafting work).
2. Point ARC at this file; pick **one phase** (recommended: Phase 0 or Phase 1).
3. ARC interviews you and produces a DIR-INTENT for that phase alone — this document is raw material, not a substitute for the interview.
4. Lock intent → FMN plans it → DEV builds it → run the phase's "done when" checks → close the chain.
5. Return here, pick the next phase. Each phase leaves Sigma better even if you never build the next one (Principle 6).

The end state is Sigma developing its own successor capabilities under its own governance — which is also the best possible proof that the governance works.
