# CLI Operator Model

Sigma CLI is designed to be operated primarily by AI roles under Director authority.

The Director is not expected to manually execute every lifecycle command. In normal use, AI roles may run read-only, draft, operational, and artifact-preparation commands within their role boundary.

However, AI roles must not infer Director approval. Any command that represents approval, closure, accepted risk, stale-intent acknowledgment, supersession, destructive reset, or artifact lock requires explicit Director authorization.

### Command Authority Classes

| Class               | Commands                                                                                         | AI May Execute?                         | Requires Explicit Director Instruction?  |
|:------------------- |:------------------------------------------------------------------------------------------------ |:---------------------------------------:|:----------------------------------------:|
| Read-only           | `status`, `list`, `session bootstrap`, `git evidence`                                            | Yes                                     | No                                       |
| Draft / Operational | `intent new`, `roadmap new`, `plan new`, `exec new`, `exec advance`, `close new`, `cso new`      | Yes, within role boundary               | Usually no, unless scope or risk changes |
| Advisory            | `intent review`, `plan audit`, `exec audit`, `close audit`                                       | Yes, when requested or role-appropriate | Usually yes                              |
| Approval            | `intent lock`, `roadmap lock`, `plan lock`, `exec lock`, `close lock`                            | Only after Director approval            | Yes                                      |
| Risk / Supersession | `close new --ack-stale-intent`, `plan supersede`, `exec supersede`, reset/destructive operations | Only after Director approval            | Yes                                      |

AI roles may recommend the next valid command, but must distinguish recommendation from authorization.

### Explicit Approval Rule

AI roles may execute approval-class or risk-acknowledgment commands only after the Director gives clear authorization.

Clear authorization includes phrases such as:

- `approved`
- `lock this`
- `lanjut lock`
- `accept risk`
- `ack stale intent`
- `supersede this version`
- equivalent unambiguous instruction

Ambiguous approval-like language is not sufficient.

Examples of insufficient authorization:

- `looks good`
- `menarik`
- `sepertinya oke`
- `lanjut bahas`
- `apa pendapatmu?`

If authorization is unclear, the AI role must ask before executing.

### Next Command Recommendation

AI roles should report the next valid command when useful.

Format:

Next valid command:
sigma plan lock

Authority required:
Explicit Director approval.

## Human-Readable vs AI-Operational Artifacts

Sigma artifacts are not equally human-facing.

Sigma is designed as an AI-operated governance protocol under Director authority. Most governance artifacts exist primarily to give AI roles a precise, traceable, and enforceable operating context.

The Director is not expected to read every artifact in full during normal operation.

### Human-Facing Artifacts

The primary human-facing artifacts are:

- **DIR-INTENT** — especially the intent explanation and Director-facing intent sections.
- **DIR-CLOSE** — because it records what was completed, what evidence supports closure, and what limitations or risks were accepted.

These documents should be written clearly enough for Director review and decision-making.

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

Humans may inspect these artifacts when desired, but they are optimized for AI role execution, traceability, gate enforcement, and cross-session continuity rather than casual human reading.

### Director Interaction Model

In normal Sigma operation, the Director mainly interacts through:

- reviewing or refining DIR-INTENT,
- requesting AUD review when desired,
- approving or rejecting lock decisions,
- reviewing DIR-CLOSE before project closure,
- giving explicit authorization for risk acknowledgment, supersession, or major scope change.

AI roles are responsible for reading operational artifacts, maintaining role boundaries, surfacing only decision-relevant issues, and translating Director decisions into valid Sigma CLI operations.

### Director Convenience Rule

Sigma CLI is normally operated by AI roles under Director authority.

AI roles should not ask the Director to manually run routine Sigma CLI commands when the AI role has tool access and the command is within its role boundary.

Instead of saying:

> “Please run `sigma plan lock`.”

The AI role should say:

> “The next valid command is `sigma plan lock`. This requires explicit Director approval. Do you want me to run it?”

For authority-sensitive commands, the AI role must ask for explicit authorization before execution.

Authority-sensitive commands include:

- artifact locks,
- stale-intent acknowledgment,
- supersession,
- destructive reset,
- closure-related risk acceptance,
- major scope-changing operations.

AI roles may execute the command only after the Director gives clear approval.

Examples of clear approval:

- “yes, run it”
- “approved, lock it”
- “lanjut lock”
- “jalankan”
- “accept risk”
- “acknowledge stale intent”

If approval is ambiguous, the AI role must ask again instead of executing.

## Director Authorization Language Policy

Director authorization may be given in natural language. The Director is not required to type Sigma CLI commands manually.

AI roles must interpret clear Director authorization language as permission to execute the relevant Sigma CLI command, provided that:

1. the target artifact is unambiguous,
2. the command is valid under Sigma runtime gates,
3. the command is within the role’s operational boundary,
4. the authorization is explicit enough for the command class.

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

These may authorize the relevant lock command if the active artifact is clear.

### Rejection Signals

Examples of rejection or non-approval signals:

- `I don't like this`
- `reject this`
- `jangan lock`
- `revisi dulu`
- `ini belum sesuai`
- `kurang cocok`
- `saya tidak setuju`

These must not trigger lock commands.

### Ambiguous Signals

Examples of ambiguous or insufficient authorization:

- `okay`
- `noted`
- `interesting`
- `makes sense`
- `lanjut`
- `setuju secara konsep`
- `good point`

These are not sufficient for approval-class commands.

If authorization is unclear, the AI role must ask for confirmation before executing.

### Conditional Approval

If the Director gives conditional approval, the AI role must satisfy or record the condition before executing the command.

Examples:

- `approve, but fix section 3 first`
- `lock after adding the risk note`
- `approved with accepted risk`

The AI role must not ignore conditions attached to approval.

```text

```
