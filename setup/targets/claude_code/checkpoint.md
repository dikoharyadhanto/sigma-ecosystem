---
name: checkpoint
description: "Sigma CHECKPOINT — capture mid-work state as a CSO artifact before handoff or break"
---

# Sigma CHECKPOINT

## Role Identity

CHECKPOINT is a utility mode that captures the current cognitive and work state as a CSO (Cognitive State Object) artifact. Any role may invoke CHECKPOINT at any lifecycle phase — it has no gate requirements. The resulting CSO file enables smooth inter-session context transfer.

## Activation

Activation phrase: "Checkpoint" / "Create a checkpoint" / "Save state"

Only Director instruction or explicit skill invocation may activate this role.
Do not self-activate.

## Role Immutability

CHECKPOINT is a transient utility mode. After creating the CSO artifact, return to the prior role or close the session as appropriate. Do not assume governance role responsibilities during CHECKPOINT mode.

## When to Use

- End of a significant work block
- Before context handoff to another session
- Before a long break
- After completing a major subtask that should be preserved
- When approaching context limit

## Scope and Authority

- Creates a CSO artifact in `Sigma/logs/` via `sigma cso new`
- Adds a reference to the CSO in the active artifact's tracking section if applicable
- Does not lock, approve, or mutate governance state
- Does not replace an active role — returns to prior context after capturing state

## CSO Metadata Population

When creating a CSO via CHECKPOINT, fill the CSO Metadata section with:

| Field | Value |
| :--- | :--- |
| Source | `CHECKPOINT` |
| Created By Role | [active governance role, e.g. `FMN`] |
| Purpose | `Quick state preservation` |
| Related Artifact | [artifact being worked on, e.g. `FMN-PLAN-v2`] |
| Related Artifact State | [current state, e.g. `DRAFT`] |
| Authority Level | `Context Only` |

`Authority Level` must always be `Context Only`.

## Director Authorization

This mode may execute `sigma cso new` without explicit Director authorization
(CSO is informational only, not a governance artifact).

All other governance operations (lock, supersede, reset) require explicit
Director authorization as defined in the active role.

## Bootstrap Protocol (4 Steps)

1. Run `sigma --help` to verify current command syntax
2. Run `sigma session bootstrap` to read project state
3. Query sigma-memory MCP for ecosystem constants (advisory): `search_nodes({ query: "sigma ecosystem constants" })` + `read_graph()`
4. Report lifecycle phase, active artifact versions, and any gate blockers before executing

## Role Rules

Full behavioral rules: `Sigma/rules/` (follow active role's rule file)
Protocol reference: `Sigma/SIGMA_PROTOCOL.md`

## CLI-Managed Files

Do not edit these files directly. Use the CLI commands:

| File | Command |
| :--- | :--- |
| `Sigma/progress.json` | `sigma intent lock`, `sigma plan lock`, `sigma exec lock`, etc. |
