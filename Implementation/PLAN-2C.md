# Implementation Plan — Phase 2C: Doctrine Enforcement — CLI Operator Model & Authorization Policy

**Phase**: 2C (governance doctrine extension)
**Goal**: Strengthen SIGMA_PROTOCOL.md with three doctrine sections and propagate CLI authority model into every AI role rule file so that all roles operate under an explicit, consistent authorization framework.
**Status**: PENDING
**Type**: Governance / Protocol Update — no CLI implementation code
**Prerequisites**: Phase 2b complete (ROADMAP artifact added); Section 16A already written to `Sigma/SIGMA_PROTOCOL.md`
**Blocks**: Nothing blocks; PLAN-3 and later plans may reference Section 16B/16C and role rule CLI policies

---

## Source Material

| File | Role |
| :--- | :--- |
| `Discussion/Perbaikan_Lanjutan_SIGMA_1.md` | Director-authored doctrine draft — primary source for all 3 new protocol sections |
| `Sigma/SIGMA_PROTOCOL.md` | Will receive Section 16A update (Director Convenience Rule), Section 16B, Section 16C |
| `Sigma/rules/ARC-RULE.md` | Receives CLI Operation Policy section |
| `Sigma/rules/FMN-RULE.md` | Receives CLI Operation Policy section |
| `Sigma/rules/DEV-RULE.md` | Receives CLI Operation Policy section |
| `Sigma/rules/AUD-RULE.md` | Receives CLI Operation Policy section |

---

## Design Decisions

### 1. Three Protocol Additions, Not One

The Discussion file contains three logically distinct doctrine additions:

1. **Director Convenience Rule** — how AI roles should frame CLI command execution (ask vs execute silently vs tell Director to run it manually)
2. **Human-Readable vs AI-Operational Artifacts** — artifact visibility model: which documents are Director-facing, which are AI-operational
3. **Director Authorization Language Policy** — what counts as valid authorization, rejection, and ambiguous signals (bilingual)

These are separate concerns. They get separate sections:
- Director Convenience Rule → subsection of **Section 16A** (it is a behavioral extension of the CLI Operator Model)
- Human-Readable vs AI-Operational Artifacts → **Section 16B** (new)
- Director Authorization Language Policy → **Section 16C** (new)

---

### 2. Director Convenience Rule Placement: 16A Subsection, Not 16B

The Director Convenience Rule governs how AI roles handle CLI command execution relative to the Director. It is a behavioral rule about the operator model, not about artifact visibility. It belongs in Section 16A alongside Command Authority Classes and Explicit Approval Rule.

---

### 3. Artifact Visibility Model: DIR-INTENT and DIR-CLOSE are Human-Facing by Default

Section 16B establishes that DIR-INTENT and DIR-CLOSE are the primary Director-facing artifacts — they must be written for Director comprehension. All other artifacts (ROADMAP, FMN-PLAN, DEV-EXEC, AUD findings, CSO, progress.json, decisions.jsonl, role rules, protocol files) are primarily AI-operational.

This does not mean the Director may not read other artifacts. It means optimization targets differ: AI-operational artifacts optimize for AI role execution, traceability, gate enforcement, and cross-session continuity rather than casual human reading. Dense formatting, technical fields, and verbose structure are acceptable in AI-operational artifacts.

---

### 4. Authorization Language Policy: Bilingual Signals

Section 16C explicitly includes both English and Indonesian authorization signals. This project operates bilingually. "Saya setujui" and "I approve" must be treated identically. The signal lists are not exhaustive — they are representative examples. AI roles must apply the underlying principle, not just match the list.

---

### 5. Conditional Approval: Condition Must Be Confirmed Before Execution

Section 16C must include a rule for conditional approval that closes a specific failure gap: an AI role that receives "approve, but fix section 3 first" must not execute the lock command after fixing section 3 without confirming with the Director that the condition is satisfied.

The correct behavior:
1. Receive conditional approval.
2. Satisfy the condition.
3. Report to Director: "Section 3 has been updated. Condition satisfied. May I proceed with lock?"
4. Wait for Director confirmation.
5. Execute.

The AI role must not self-certify that a condition is satisfied and proceed unilaterally.

---

### 6. Role-Specific CLI Authority in Role Rules

Each role rule receives a **CLI Operation Policy** section that specifies:

- Which authority class the role's typical commands fall into
- What the role may execute without Director approval
- What requires explicit Director approval
- The Director Convenience Rule applied to this role
- Any role-specific restrictions

This makes each role rule self-contained on CLI authority — an AI operating a specific role does not need to look up Section 16A to know what it can run.

| Role | Typical Command Classes | Approval-Class Commands (requires Director) |
| :--- | :--- | :--- |
| ARC | Draft/Operational, Advisory | `intent lock` |
| FMN | Draft/Operational, Advisory, (Approval with Director OK) | `roadmap lock`, `plan lock`, `exec lock`, `close lock` |
| DEV | Draft/Operational | `exec lock`, any supersede |
| AUD | Advisory | All lock commands (AUD does not lock by design) |

---

### 7. AUD CLI Policy: Advisory-Only, Never Locks

AUD's CLI Operation Policy must make explicit that AUD does not execute lock commands under any circumstance — not even with Director approval in the session. Lock commands are Director-authorized operations executed by the role managing that artifact (ARC → intent lock, FMN → plan/roadmap lock, DEV → exec lock, Director-delegated role → close lock). AUD provides critique; another role or the Director executes the gate.

---

### 8. No Change to Existing Rule Structure

The CLI Operation Policy section is appended to each role rule before the **Final Doctrine** section. No existing rule content is modified. This is a clean addition, not a refactor.

---

## Deliverables

| File | Action | Notes |
| :--- | :--- | :--- |
| `Sigma/SIGMA_PROTOCOL.md` | **Update** | Section 16A: add Director Convenience Rule subsection |
| `Sigma/SIGMA_PROTOCOL.md` | **Update** | Add Section 16B after Section 16A |
| `Sigma/SIGMA_PROTOCOL.md` | **Update** | Add Section 16C after Section 16B |
| `Sigma/rules/ARC-RULE.md` | **Update** | Add CLI Operation Policy section before Final Doctrine |
| `Sigma/rules/FMN-RULE.md` | **Update** | Add CLI Operation Policy section before Final Doctrine |
| `Sigma/rules/DEV-RULE.md` | **Update** | Add CLI Operation Policy section before Final Doctrine |
| `Sigma/rules/AUD-RULE.md` | **Update** | Add CLI Operation Policy section before Final Doctrine |

---

## Tasks

| Task ID | Task | Priority |
| :--- | :--- | :--- |
| TASK-2C-01 | Update `SIGMA_PROTOCOL.md` Section 16A — add Director Convenience Rule subsection | Must |
| TASK-2C-02 | Add `SIGMA_PROTOCOL.md` Section 16B — Human-Readable vs AI-Operational Artifacts | Must |
| TASK-2C-03 | Add `SIGMA_PROTOCOL.md` Section 16C — Director Authorization Language Policy | Must |
| TASK-2C-04 | Update `Sigma/rules/ARC-RULE.md` — add CLI Operation Policy | Must |
| TASK-2C-05 | Update `Sigma/rules/FMN-RULE.md` — add CLI Operation Policy | Must |
| TASK-2C-06 | Update `Sigma/rules/DEV-RULE.md` — add CLI Operation Policy | Must |
| TASK-2C-07 | Update `Sigma/rules/AUD-RULE.md` — add CLI Operation Policy | Must |

---

## Implementation Steps

### TASK-2C-01: Update SIGMA_PROTOCOL.md Section 16A

**Step 1**: Read `Sigma/SIGMA_PROTOCOL.md` — locate Section 16A. It currently ends at the `Director Authority Preservation` subsection.

**Step 2**: Append a new `Director Convenience Rule` subsection to Section 16A, before the closing `---` divider.

Content:

```markdown
### Director Convenience Rule

AI roles should not ask the Director to manually run routine Sigma CLI commands when the AI role has tool access and the command is within its role boundary.

Instead of:

> "Please run `sigma plan lock`."

The AI role should say:

> "The next valid command is `sigma plan lock`. This requires explicit Director approval. Shall I run it?"

For authority-sensitive commands (approval-class or risk/supersession-class), the AI role must ask for explicit authorization before execution. The Director may give authorization in natural language — the AI role interprets that as permission to run the command.

For operational commands within the role's authority class, the AI role may execute and report rather than asking permission for each step.
```

---

### TASK-2C-02: Add SIGMA_PROTOCOL.md Section 16B

**Step 3**: Read `Sigma/SIGMA_PROTOCOL.md` — locate Section 16A closing `---` divider and Section 17 opening (`## 17. Git Evidence`).

**Step 4**: Insert Section 16B between Section 16A and Section 17.

Content:

```markdown
## 16B. Human-Readable vs AI-Operational Artifacts

Sigma artifacts are not equally human-facing.

Sigma is designed as an AI-operated governance protocol under Director authority. Most governance artifacts exist primarily to give AI roles a precise, traceable, and enforceable operating context. The Director is not expected to read every artifact in full during normal operation.

### Human-Facing Artifacts

The primary Director-facing artifacts are:

- **DIR-INTENT** — especially the intent explanation and Director decision sections. Must be written clearly enough for Director review and approval.
- **DIR-CLOSE** — because it records what was completed, what evidence supports closure, and what limitations or risks were accepted. Must be written clearly enough for Director final review.

These documents MUST be written for Director comprehension. Dense AI-operational formatting is inappropriate for these artifacts.

### AI-Operational Artifacts

The following artifacts are primarily AI-operational:

- **ROADMAP**
- **FMN-PLAN**
- **DEV-EXEC**
- **AUD findings**
- **CSO**
- **progress.json**
- **memory/decisions.jsonl**
- role rule files
- protocol and registry files

Humans may inspect these artifacts when desired, but they are optimized for AI role execution, traceability, gate enforcement, and cross-session continuity rather than casual human reading. Dense formatting, technical fields, and verbose structure are acceptable in AI-operational artifacts.

### Director Interaction Model

In normal Sigma operation, the Director interacts primarily through:

- reviewing or refining DIR-INTENT,
- requesting AUD review when desired,
- approving or rejecting lock decisions,
- reviewing DIR-CLOSE before project closure,
- giving explicit authorization for risk acknowledgment, supersession, or major scope change.

AI roles are responsible for:

- reading and consuming operational artifacts,
- maintaining role boundaries,
- surfacing only decision-relevant issues to the Director,
- translating Director decisions into valid Sigma CLI operations.

The Director should not be required to navigate operational artifacts to make governance decisions. AI roles are the interface layer between operational detail and Director decision-making.
```

---

### TASK-2C-03: Add SIGMA_PROTOCOL.md Section 16C

**Step 5**: Read `Sigma/SIGMA_PROTOCOL.md` — locate Section 16B closing `---` divider and Section 17 opening.

**Step 6**: Insert Section 16C between Section 16B and Section 17.

Content:

```markdown
## 16C. Director Authorization Language Policy

Director authorization may be given in natural language. The Director is not required to type Sigma CLI commands manually.

AI roles must interpret clear Director authorization language as permission to execute the relevant Sigma CLI command, provided that:

1. the target artifact is unambiguous,
2. the command is valid under Sigma runtime gates,
3. the command is within the role's operational boundary,
4. the authorization is explicit enough for the command class (see Section 16A).

### Clear Approval Signals

Examples of clear approval signals:

- `approved`
- `approve this`
- `I approve this plan`
- `I give my approval`
- `lock it`
- `lanjut lock`
- `silakan lock`
- `saya approve`
- `saya setujui`
- `kunci dokumen ini`
- `jalankan`
- `yes, run it`
- `approved, lock it`
- `accept risk`
- `acknowledge stale intent`
- `ack stale intent`
- `supersede this version`

These may authorize the relevant command if the active artifact is clear.

The signal list is representative, not exhaustive. AI roles must apply the underlying principle: authorization must be unambiguous.

### Rejection Signals

Examples of rejection or non-approval signals:

- `I don't like this`
- `reject this`
- `jangan lock`
- `revisi dulu`
- `ini belum sesuai`
- `kurang cocok`
- `saya tidak setuju`

These must not trigger lock commands or approval-class operations.

### Ambiguous Signals

Examples of ambiguous or insufficient authorization:

- `okay`
- `noted`
- `interesting`
- `makes sense`
- `lanjut`
- `setuju secara konsep`
- `good point`
- `looks good`
- `menarik`
- `sepertinya oke`
- `lanjut bahas`
- `apa pendapatmu?`

These are not sufficient for approval-class commands. If authorization is unclear, the AI role must ask for confirmation before executing.

### Conditional Approval

If the Director gives conditional approval, the AI role must satisfy the condition AND confirm with the Director that the condition is satisfied before executing the command.

Examples of conditional approval:

- `approve, but fix section 3 first`
- `lock after adding the risk note`
- `approved with accepted risk`

**Correct behavior for conditional approval:**

1. Receive conditional approval.
2. Satisfy the stated condition.
3. Report to Director: "[Condition] has been addressed. May I proceed with [command]?"
4. Wait for Director confirmation.
5. Execute only after Director confirms.

The AI role must not self-certify that a condition is satisfied and proceed unilaterally. Even if the condition appears satisfied, the Director must confirm before the lock or approval-class command runs.

The AI role must not ignore conditions attached to approval.
```

---

### TASK-2C-04: Update ARC-RULE.md — add CLI Operation Policy

**Step 7**: Read `Sigma/rules/ARC-RULE.md` — locate `## Final Doctrine` section at end of file.

**Step 8**: Insert CLI Operation Policy section immediately before `## Final Doctrine`.

Content:

```markdown
## CLI Operation Policy

ARC operates primarily in the **Draft/Operational** and **Advisory** command authority classes.

### Commands ARC may execute without Director approval

| Command | Class |
| :--- | :--- |
| `sigma intent new` | Draft/Operational |
| `sigma intent review` | Advisory |
| `sigma session bootstrap` | Read-only |
| `sigma project status` | Read-only |
| `sigma git evidence` | Read-only |

These commands are within ARC's role boundary. ARC may execute them and report results to the Director.

### Commands that require explicit Director approval

| Command | Class |
| :--- | :--- |
| `sigma intent lock` | Approval |

ARC MUST NOT run `sigma intent lock` until the Director gives explicit approval. ARC may recommend it.

### Director Convenience Rule (ARC)

ARC should not ask the Director to manually run CLI commands that are within ARC's role boundary.

Instead of:
> "Please run `sigma intent lock` to lock the intent."

ARC should say:
> "DIR-INTENT is ready for lock. This requires your explicit approval. Shall I run `sigma intent lock`?"

For operational commands (e.g., `sigma intent new`), ARC may execute and report without asking permission each time.

### Authorization Reference

See `Sigma/SIGMA_PROTOCOL.md` Section 16A (CLI Operator Model), Section 16B (Artifact Visibility), and Section 16C (Director Authorization Language Policy).
```

---

### TASK-2C-05: Update FMN-RULE.md — add CLI Operation Policy

**Step 9**: Read `Sigma/rules/FMN-RULE.md` — locate `## Final Doctrine` section at end of file.

**Step 10**: Insert CLI Operation Policy section immediately before `## Final Doctrine`.

Content:

```markdown
## CLI Operation Policy

FMN operates primarily in the **Draft/Operational** and **Advisory** command authority classes. With explicit Director approval, FMN may execute Approval-class lock commands.

### Commands FMN may execute without Director approval

| Command | Class |
| :--- | :--- |
| `sigma roadmap new` | Draft/Operational |
| `sigma plan new` | Draft/Operational |
| `sigma plan audit` | Advisory |
| `sigma exec audit` | Advisory |
| `sigma close audit` | Advisory |
| `sigma session bootstrap` | Read-only |
| `sigma project status` | Read-only |
| `sigma roadmap list` | Read-only |
| `sigma git evidence` | Read-only |

Advisory commands (audit/review) require Director context — FMN should run them when Director requests or when role-appropriate at a lifecycle gate.

### Commands that require explicit Director approval

| Command | Class |
| :--- | :--- |
| `sigma roadmap lock` | Approval |
| `sigma plan lock` | Approval |
| `sigma exec lock` | Approval |
| `sigma close lock` | Approval |
| `sigma plan supersede` | Risk/Supersession |
| `sigma exec supersede` | Risk/Supersession |

FMN MUST NOT run any of these commands until the Director gives explicit approval.

### Director Convenience Rule (FMN)

FMN should not ask the Director to manually run CLI commands that are within FMN's role boundary.

Instead of:
> "Please run `sigma plan lock` to lock the plan."

FMN should say:
> "FMN-PLAN is ready for lock. This requires your explicit approval. Shall I run `sigma plan lock`?"

For operational commands (e.g., `sigma plan new`), FMN may execute and report without asking permission each time.

### Authorization Reference

See `Sigma/SIGMA_PROTOCOL.md` Section 16A (CLI Operator Model), Section 16B (Artifact Visibility), and Section 16C (Director Authorization Language Policy).
```

---

### TASK-2C-06: Update DEV-RULE.md — add CLI Operation Policy

**Step 11**: Read `Sigma/rules/DEV-RULE.md` — locate `## Final Doctrine` section at end of file.

**Step 12**: Insert CLI Operation Policy section immediately before `## Final Doctrine`.

Content:

```markdown
## CLI Operation Policy

DEV operates primarily in the **Draft/Operational** command authority class.

### Commands DEV may execute without Director approval

| Command | Class |
| :--- | :--- |
| `sigma exec new` | Draft/Operational |
| `sigma exec advance` | Draft/Operational |
| `sigma session bootstrap` | Read-only |
| `sigma project status` | Read-only |
| `sigma git evidence` | Read-only |

These commands are within DEV's role boundary. DEV may execute them and report results.

### Commands that require explicit Director approval

| Command | Class |
| :--- | :--- |
| `sigma exec lock` | Approval |
| `sigma exec supersede` | Risk/Supersession |
| Any destructive or reset operation | Risk/Supersession |

DEV MUST NOT run these commands until the Director gives explicit approval.

Note: `git commit`, `git push`, and pull request creation are also in this category — see Section 8 (Git Diff Evidence). Git access is capability, not authorization.

### Director Convenience Rule (DEV)

DEV should not ask the Director to manually run CLI commands that are within DEV's role boundary.

Instead of:
> "Please run `sigma exec advance testing` to advance the execution phase."

DEV should say:
> "Implementation is ready to advance. Shall I run `sigma exec advance testing`?" or just execute it and report.

For approval-class commands, DEV must ask first.

### Authorization Reference

See `Sigma/SIGMA_PROTOCOL.md` Section 16A (CLI Operator Model), Section 16B (Artifact Visibility), and Section 16C (Director Authorization Language Policy).
```

---

### TASK-2C-07: Update AUD-RULE.md — add CLI Operation Policy

**Step 13**: Read `Sigma/rules/AUD-RULE.md` — locate `## Final Doctrine` section at end of file.

**Step 14**: Insert CLI Operation Policy section immediately before `## Final Doctrine`.

Content:

```markdown
## CLI Operation Policy

AUD operates exclusively in the **Advisory** and **Read-only** command authority classes.

AUD does not execute lock commands under any circumstance. AUD provides critique; the role managing the artifact (ARC, FMN, DEV) executes the gate with Director approval.

### Commands AUD may execute

| Command | Class |
| :--- | :--- |
| `sigma intent review` | Advisory |
| `sigma plan audit` | Advisory |
| `sigma exec audit` | Advisory |
| `sigma close audit` | Advisory |
| `sigma session bootstrap` | Read-only |
| `sigma project status` | Read-only |
| `sigma git evidence` | Read-only |

Advisory commands should be run when Director requests or when AUD has been explicitly asked to audit a specific artifact.

### Commands AUD must not execute

AUD MUST NOT execute any of the following, regardless of context:

- `sigma intent lock`
- `sigma roadmap lock`
- `sigma plan lock`
- `sigma exec lock`
- `sigma close lock`
- `sigma plan supersede`
- `sigma exec supersede`
- Any destructive or reset operation

AUD's role is critique and verification, not execution. A lock command executed by AUD would conflate advisory judgment with Director approval — a governance violation.

### Director Convenience Rule (AUD)

AUD should surface audit results and recommended Director action clearly. AUD does not ask for permission to run audit/review commands when audit has been requested. AUD runs the audit and reports.

After audit, AUD may recommend:
> "Advisory verdict: REVISE. The next valid command is `sigma plan lock` — but only after the issues listed above are addressed. This command requires explicit Director approval."

AUD does not run the lock command. AUD recommends; the Director approves; the appropriate role executes.

### Authorization Reference

See `Sigma/SIGMA_PROTOCOL.md` Section 16A (CLI Operator Model), Section 16B (Artifact Visibility), and Section 16C (Director Authorization Language Policy).
```

---

## Acceptance Criteria

| AC ID | Criteria | Verification Method |
| :--- | :--- | :--- |
| AC-01 | `SIGMA_PROTOCOL.md` Section 16A contains Director Convenience Rule subsection | Read section |
| AC-02 | Director Convenience Rule states AI should ask "Shall I run X?" not "Please run X" | Read section |
| AC-03 | `SIGMA_PROTOCOL.md` Section 16B exists after Section 16A | Read file, grep |
| AC-04 | Section 16B names DIR-INTENT and DIR-CLOSE as Human-Facing; names all other artifact types as AI-Operational | Read section |
| AC-05 | Section 16B states Director Interaction Model — what Director does vs what AI roles handle | Read section |
| AC-06 | `SIGMA_PROTOCOL.md` Section 16C exists after Section 16B | Read file, grep |
| AC-07 | Section 16C contains Clear Approval Signals list with bilingual entries (English + Indonesian) | Read section |
| AC-08 | Section 16C contains Rejection Signals list | Read section |
| AC-09 | Section 16C contains Ambiguous Signals list | Read section |
| AC-10 | Section 16C contains Conditional Approval rule with 5-step confirmation protocol | Read section |
| AC-11 | Conditional Approval rule states: AI must not self-certify condition satisfied and proceed | Read section |
| AC-12 | All 4 role rule files have CLI Operation Policy section before Final Doctrine | Read each file |
| AC-13 | ARC-RULE.md CLI Operation Policy: `intent lock` listed as requiring Director approval | Read file |
| AC-14 | FMN-RULE.md CLI Operation Policy: all 4 lock commands and 2 supersede commands listed as requiring Director approval | Read file |
| AC-15 | DEV-RULE.md CLI Operation Policy: `exec lock`, `exec supersede`, git operations listed as requiring Director approval | Read file |
| AC-16 | AUD-RULE.md CLI Operation Policy: explicitly states AUD must not execute any lock command | Read file |
| AC-17 | AUD-RULE.md CLI Operation Policy: states AUD may not lock "regardless of context" | Read file |
| AC-18 | Each role rule CLI Operation Policy references SIGMA_PROTOCOL.md Sections 16A, 16B, 16C | Read each file |
| AC-19 | Sections 16B and 16C are positioned between Section 16A and Section 17 | Read file structure |

---

## Notes

This plan modifies 7 files — all governance documents, no CLI source code. The changes are additive only. Existing content in all 7 files is preserved verbatim; new sections are inserted at specified locations.

Section 16A was already written in the previous session. TASK-2C-01 adds one subsection to it (Director Convenience Rule). TASK-2C-02 and TASK-2C-03 insert entirely new sections.

The CLI Operation Policy tables in role rules are intentionally simple. They do not enumerate every possible command — they establish the principle and the most important boundaries for each role. Roles refer to Section 16A for the full authority class table.
