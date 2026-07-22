---
name: DEEPSEEK-RULES
description: System-level rules for DeepSeek operating in the sigma-ecosystem project
---

# DeepSeek Directives — sigma-ecosystem

## Ownership

These rules apply strictly to DeepSeek in this project context.
This project is the sigma-cli source codebase — a TypeScript/Node.js npm package
that implements the Sigma governance CLI.

DeepSeek does NOT inherit from CLAUDE.md, GEMINI.md, or AGENTS.md unless
explicitly requested by the Director. Follow this file above all other
project-level AI rule files.

## Operational Mode

### Professional Mode (Default)

- Activation: active by default unless explicitly overridden
- Capabilities: general coding, editing, review, discussion, debugging
- Constraints: none — operates with full flexibility

### Flexible Mode

- Activation: Director explicitly requests reference to CLAUDE.md, GEMINI.md,
  or AGENTS.md by name
- Scope: inherits rules from the referenced file for that session only

## CLI Operator Model

Sigma CLI is normally operated by AI roles under Director authority.

Do not ask the Director to manually run Sigma commands when you can run them
through available tooling. Instead:

1. Identify the next valid CLI command.
2. State whether it requires Director authorization.
3. Ask if the Director wants you to run it.
4. Execute only after authorization when required.

Before recommending or running any lock command (`intent lock`, `plan lock`,
`exec lock`, `close lock`), run the matching `sigma {domain} check` first
and confirm it reports `Lock readiness: Eligible` (or `Eligible with
warnings`). `check` is read-only and never requires Director authorization —
it shows exactly which Lock Requirements `lock` will enforce, without
changing anything. If `check` reports `Not eligible`, resolve the
unsatisfied Lock Requirements shown in its output before recommending lock.

## MCP Orientation Layer (read-only)

When a `sigma-mcp` client is configured, the tools `sigma_get_state`,
`sigma_get_gates`, `sigma_get_orientation`, `sigma_list_artifacts`, and
`sigma_doctor` return the same read-only orientation data as
`sigma session bootstrap`/`sigma {domain} check`, as structured JSON instead
of CLI stdout. CLI remains the sole authority for every write, gate, or lock
operation — MCP tools never lock, supersede, or mutate state.

## Director Authorization Language

Lock, risk-acknowledgment, supersession, and destructive commands require
explicit Director authorization before execution.

Sufficient: "approved", "lock it", "I approve this plan", "go ahead", "run it"
Ambiguous (not sufficient for lock/risk): "okay", "noted", "makes sense"
Rejection: "revise first", "not yet", "hold on"

If authorization is unclear, ask before executing.

## CLI-Managed Files — Do Not Edit Directly

Do not edit `Sigma/progress-v<N>.json` directly. Use sigma CLI commands to
modify workflow state. Run `sigma --help` to see available commands.

## Sigma CLI Awareness

- Run `sigma --help` at session start to verify current command syntax.
- Sigma gate flow: intent lock → opens plan gate → plan lock → opens exec gate
- Role memory and active role rules are sufficient for normal Sigma role operation.
- Do not read broader Sigma protocol documents unless a conflict, edge case, or
  explicit Director request requires it.
- If explicitly operating as a Sigma governance role, load role memory if
  available and follow the matching `Sigma/rules/{ROLE}-RULE.md`.
- Do not treat `sigma session bootstrap` as mandatory for every role; ARC and
  AUD start from bounded Director intent/evidence, while FMN and DEV orient
  only inside their direct runtime evidence chain.
