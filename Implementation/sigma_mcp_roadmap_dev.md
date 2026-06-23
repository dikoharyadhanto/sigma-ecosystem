# Sigma MCP Roadmap Development

**Date**: 2026-06-10  
**Status**: Directional roadmap  
**Purpose**: Define the broad development direction for introducing a custom Sigma MCP layer without turning this document into an implementation plan or task contract.

---

## Executive Summary

Sigma already has a strong CLI-governed workflow:

- role activation and memory;
- lifecycle gates;
- Director authorization language;
- artifact tracking;
- runtime progress state;
- multi-agent handoff;
- AI tool bridge files.

The next architectural step is to expose this governance capability through a custom MCP interface.

The goal is not to replace the Sigma CLI.

The goal is to make Sigma easier, safer, and more consistent for AI agents to operate by giving them structured tools instead of relying only on free-form shell commands and terminal text interpretation.

In the target architecture:

```text
AI client
  -> Sigma MCP server
  -> Sigma CLI / Sigma engine behavior
  -> Sigma runtime state and artifacts
```

The CLI remains the operational authority. MCP becomes the AI-native access layer.

---

## Strategic Rationale

Sigma is designed for AI-operated governance under Director authority.

Today, AI agents operate Sigma mostly by reading instructions, running CLI commands, and interpreting stdout. This works, but it depends heavily on agent discipline and prompt compliance.

A custom Sigma MCP layer can reduce that friction by making key Sigma concepts explicit:

- current lifecycle phase;
- active role;
- gate status;
- next valid operations;
- authorization requirements;
- artifact locations;
- read-only versus state-changing operation classes.

This matters because Sigma's value is not merely command execution. Sigma's value is role discipline, lifecycle control, decision traceability, and human authority preservation.

MCP can make those boundaries visible to AI clients as structured capabilities.

---

## Product Direction

The Sigma MCP effort should develop in layers.

Each layer should preserve the existing Sigma governance model and avoid introducing a parallel source of truth.

### Layer 1: Read-Only Governance Access

The first version should expose Sigma state and orientation only.

Expected capability areas:

- lifecycle status;
- bounded role memory retrieval;
- bootstrap/orientation output;
- gate and next-operation visibility;
- artifact listing and location lookup;
- registry/status lookup;
- read-only git evidence where appropriate.

Role memory access should remain scoped. It should prefer the active role, current lifecycle phase, current operation need, bounded output size, and provenance path over broad memory dumps.

This layer should help AI agents orient themselves without mutating project state.

The first success condition is simple:

```text
An AI client should be able to understand "where Sigma currently is" without manually stitching together multiple CLI commands.
```

### Layer 2: Structured Guidance for Operations

The second layer should help agents prepare valid Sigma operations without automatically executing approval-class actions.

Expected capability areas:

- describe next valid command;
- classify command authority level;
- explain required Director authorization;
- generate command previews;
- surface gate blockers as structured errors;
- recommend safe recovery or orientation steps.

This layer should reduce accidental misuse of valid-but-unauthorized operations.

The agent should be able to ask:

```text
What can I do next, what authority does it require, and what exact command would be used?
```

### Layer 3: Gated State-Changing Tools

Only after read-only and guidance layers are stable should Sigma MCP expose state-changing operations.

Expected capability areas:

- create draft artifacts;
- lock approved artifacts;
- supersede artifacts;
- send and read role messages;
- create CSO handoff artifacts;
- run approved override flows.

This layer must preserve Sigma's Director authority model.

State-changing MCP tools should never become a shortcut around:

- role boundaries;
- lifecycle gates;
- explicit approval requirements;
- risk acknowledgment requirements;
- audit trail requirements.

### Layer 4: Multi-Client Distribution

Once the MCP server is useful and stable, Sigma should make it easy to configure across AI environments.

Expected target areas:

- generic `.mcp.json`;
- VS Code MCP config;
- Claude-compatible MCP config;
- Codex-compatible usage where applicable;
- Hermes Agent config;
- Reasonix and Gemini/Antigravity compatibility where their MCP behavior supports it.

The focus should be portability through MCP first, with platform-specific adapters only where necessary.

### Layer 5: Optional Advanced Capabilities

Advanced capabilities should come later, after the core interface is reliable.

Possible future directions:

- MCP resources for governance documents and artifacts;
- MCP prompts for role activation and safe operation workflows;
- notification-driven refresh when Sigma state changes;
- richer structured error semantics;
- dashboard or MCP app surface for lifecycle visualization;
- remote MCP mode for server-hosted Sigma environments.

These should remain optional and should not distract from the core governance interface.

---

## Architectural Principles

### CLI Remains Authoritative

MCP must not become a second Sigma runtime.

If a behavior already exists in CLI/engine code, MCP should call or reuse that behavior instead of reimplementing governance rules independently.

### No Direct State Mutation

MCP must not directly edit CLI-managed files such as:

```text
Sigma/progress.json
Sigma/SIGMA-REGISTRY.json
Sigma/SIGMA-OPERATION-REGISTRY.json
```

State mutation should continue to flow through valid Sigma operations.

### Read-Only First

The first useful Sigma MCP server should be safe enough to expose broadly.

Read-only tools create immediate value while keeping risk low.

### Structured Responses Over Terminal Text

The MCP layer should prefer structured output that agents can reason about directly.

Human-readable summaries are useful, but the main gain comes from explicit fields such as:

- `phase`;
- `role`;
- `gate_status`;
- `requires_authorization`;
- `next_valid_operations`;
- `artifact_paths`;
- `blocking_reason`.

### Authorization Is a First-Class Concept

Director authorization should appear directly in MCP responses.

Approval-class, lock, risk, supersession, and destructive operations should be visibly classified before execution.

MCP should distinguish:

- whether an operation is valid under current Sigma state;
- whether an operation is authorized by the Director;
- whether the MCP layer may execute it;
- whether it is only providing a non-executing preview.

### Vendor-Neutral Core

The custom MCP server should be designed as a general Sigma interface, not as a Hermes-specific, Claude-specific, or Codex-specific feature.

Specific clients can receive setup adapters later.

---

## MCP Governance Contract

This roadmap should be read with the following governance contract.

MCP is an access layer, not an authority layer.

Sigma CLI / Sigma engine behavior remains authoritative. MCP should expose, organize, and safely route Sigma operations; it should not become a parallel interpreter of governance truth.

MCP may describe operation validity, but it must separately classify authorization.

A command can be valid while still not authorized.

MCP must not infer Director approval from ambiguous natural-language conversation.

Mutating MCP tools must flow through Sigma-authoritative operations, not direct runtime file edits.

Every mutating result should return artifact or audit evidence.

Read-only and guidance tools must be stable before mutating tools are exposed.

Unsafe ambiguity should appear as a blocker, not as a guessed next action.

---

## Candidate Initial Tool Surface

This is a non-binding candidate surface for concept validation.

Final names, schemas, and implementation details belong to the implementation plan.

Recommended initial read-only and guidance capabilities:

- `sigma.status`
- `sigma.orientation`
- `sigma.gates`
- `sigma.artifacts.list`
- `sigma.artifacts.get_active`
- `sigma.operations.next`
- `sigma.operations.classify`
- `sigma.operations.preview`

Capabilities deferred until controlled mutation:

- lock operations;
- supersession operations;
- override operations;
- close operations.

The candidate surface is intentionally small. Its purpose is to prove that AI clients can orient and reason about Sigma governance before they are allowed to change Sigma state.

---

## Expected Difference From Current Workflow

### Current AI + CLI Workflow

The current workflow depends on the AI agent to:

- know which Sigma command to run;
- run shell commands safely;
- interpret terminal output correctly;
- infer gate state;
- remember role boundaries;
- distinguish valid commands from authorized commands.

This is workable, but cognitively expensive.

### Future AI + Sigma MCP Workflow

With Sigma MCP, the AI agent should be able to discover Sigma capabilities through tools and receive structured governance information.

Instead of asking:

```text
Which command should I run and how do I interpret the output?
```

The agent can ask:

```text
What is the current Sigma state?
What operations are valid?
Which operations require Director authorization?
What artifact is active?
What is blocking the next gate?
```

This makes Sigma more legible to AI clients.

---

## Roadmap Milestones

### Milestone A: Concept Validation

Establish the minimal MCP shape for Sigma.

This milestone should answer:

- What should the first Sigma MCP tools be?
- Which outputs should be structured?
- Which existing CLI/engine functions can be reused?
- What must remain CLI-only for now?

Exit signal:

```text
The candidate MCP surface, CLI reuse strategy, and non-goals are clear enough for implementation planning.
```

### Milestone B: Read-Only Prototype

Introduce a local stdio MCP server that exposes safe Sigma orientation capabilities.

The prototype should prove that an AI client can connect to Sigma and understand project state without relying on raw shell command interpretation.

Exit signal:

```text
An AI client can understand current Sigma phase, active role, gate status, active artifact, and blockers without shell-output interpretation.
```

### Milestone C: Setup Integration

Add installation/configuration support so users can enable the Sigma MCP server without hand-editing client config files.

This milestone should keep target support modest and avoid overfitting to one AI client.

Exit signal:

```text
At least one supported MCP client can be configured through Sigma setup flow without manual config editing.
```

### Milestone D: Guided Operations

Expose structured guidance for valid operations and authorization requirements.

This milestone should make Sigma's governance boundaries clearer before any mutating MCP tools are introduced.

Exit signal:

```text
Guided operations distinguish validity, authorization, blockers, and command previews without executing approval-class actions.
```

### Milestone E: Controlled Mutation

Add state-changing MCP tools only where the authorization model is explicit and enforceable.

This milestone should preserve the same governance guarantees as direct CLI use.

Exit signal:

```text
Controlled mutation preserves the same governance guarantees and evidence trail as direct CLI use.
```

### Milestone F: Ecosystem Distribution

Expand compatibility across MCP-capable clients and document recommended usage patterns.

Hermes Agent can be treated as an important early target because it supports MCP, skills, and `AGENTS.md` context files, but the core MCP server should remain vendor-neutral.

Exit signal:

```text
Sigma MCP has documented setup and usage guidance across the selected MCP-capable clients without making any one client the architectural center.
```

---

## Non-Goals For The Initial Roadmap

The first MCP roadmap should not attempt to:

- replace the Sigma CLI;
- create a separate Sigma daemon requirement;
- bypass Director approval;
- make Sigma autonomous;
- expose mutating tools before read-only orientation is stable;
- encode Hermes-specific behavior into the core server;
- turn MCP into a new source of truth.

---

## Recommended First Direction

The recommended first development direction is:

```text
Build a read-only Sigma MCP server first.
Then add setup support.
Then add guided operation tools.
Only later add gated mutation.
```

This path gives immediate value while protecting the governance model.

It also keeps the architecture aligned with Sigma's existing identity:

```text
AI roles operate.
Sigma CLI enforces.
Director authorizes.
MCP makes that interface AI-native.
```
