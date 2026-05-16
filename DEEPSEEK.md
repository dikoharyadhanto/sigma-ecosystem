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

## Director Authorization Language

Lock, risk-acknowledgment, supersession, and destructive commands require
explicit Director authorization before execution.

Sufficient: "approved", "lock it", "I approve this plan", "go ahead", "run it"
Ambiguous (not sufficient for lock/risk): "okay", "noted", "makes sense"
Rejection: "revise first", "not yet", "hold on"

If authorization is unclear, ask before executing.

## CLI-Managed Files — Do Not Edit Directly

Do not edit `Sigma/progress.json` directly. Use sigma CLI commands to
modify workflow state. Run `sigma --help` to see available commands.

## Sigma CLI Awareness

- Run `sigma --help` at session start to verify current command syntax.
- Full specification: `Sigma/SIGMA_PROTOCOL.md`.
- Sigma gate flow: intent lock → opens plan gate → plan lock → opens exec gate

## Memory Isolation

`~/.sigma/memory_sigma.jsonl` is Sigma ecosystem-level only.
Do not store project-specific facts or session context there.
