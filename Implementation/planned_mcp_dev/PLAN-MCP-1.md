# PLAN-MCP-1 — Sigma MCP Server: Concept Validation & Read-Only Prototype

> **⚠️ SUPERSEDED (2026-07-22)** — digantikan oleh
> `Implementation/planned_sigma_mcp_server_2026_07_22/` (PLAN-EVAL-01 +
> PLAN-IMPL-01), per keputusan Director. Dokumen ini diarsipkan sebagai
> referensi historis. Rujukan API-nya sudah **usang**: menyebut
> `src/engine/progress.ts`, `readProgress`, dan `ProgressJson`, yang sudah
> dimigrasikan ke `src/engine/chain.ts` (`ChainState`, `readActiveChain`,
> `getGateStatus(chain)`). Jangan pakai peta fungsi di dokumen ini untuk
> implementasi baru — gunakan PLAN-IMPL-01. Penamaan tool juga berubah dari
> dot-notation (`sigma.status`) ke snake_case (`sigma_get_state`).

**Source**: `Implementation/sigma_mcp_roadmap_dev.md`
**Date**: 2026-07-03
**Status**: DRAFT FOR REVIEW
**Related roadmap milestones**: Milestone A (Concept Validation), Milestone B (Read-Only Prototype)
**Reference**: [MCP TypeScript server quickstart](https://modelcontextprotocol.io/docs/develop/build-server) — verified against `@modelcontextprotocol/sdk@1.29.0` package metadata during this planning pass.
**Note**: This is a plain implementation plan authored in Professional Mode. It is not a Sigma FMN-PLAN and carries no Sigma lock/gate authority.

---

## Objective

Turn the directional MCP roadmap into the first concrete, buildable increment: a minimal, read-only Sigma MCP server that lets an AI client understand Sigma's current lifecycle state without shelling out to `sigma` commands and parsing terminal text.

This plan covers only Milestone A and Milestone B from the roadmap. It does not cover setup/distribution (Milestone C), guided operations (Milestone D), or mutation (Milestone E/F).

```text
Prove the shape first.
Prove it reuses existing engine code, not a parallel implementation.
Prove an AI client can orient from it.
```

---

## Problem Statement

Today, an AI role operating Sigma has to run CLI commands and interpret stdout to answer basic orientation questions: what lifecycle phase is this project in, is Gate 2 open, is there a stale intent, what's the active plan version. That logic already exists as typed engine code (`src/engine/progress.ts`, `src/utils/artifacts.ts`, `src/utils/roadmap.ts`) — it's just not exposed as a structured, tool-callable interface.

The roadmap (`Implementation/sigma_mcp_roadmap_dev.md`) already settled the strategic direction and the architectural principles. What's missing is a plan that:

- names the exact existing functions to wrap, instead of restating the concept abstractly;
- fixes a minimal literal tool surface for this increment only;
- defines where the new code lives and what dependency it needs;
- gives a testable exit condition.

---

## Design Principles (inherited from roadmap, restated as constraints)

| Principle | Constraint for this plan |
|---|---|
| CLI remains authoritative | MCP tools call existing engine/util functions (`readProgress`, `getGateStatus`, …); no reimplementation of gate/state logic inside the MCP layer. |
| No direct state mutation | This increment ships zero write tools. Every tool in scope is read-only. |
| Read-only first | Milestone A/B only. Guidance (Milestone D) and mutation (Milestone E) are explicitly out of scope here. |
| Structured responses over terminal text | Tool outputs return typed JSON objects (`phase`, `gate_status`, `active_artifacts`, …), not formatted strings meant for a human terminal. |
| Vendor-neutral core | Server is a plain `@modelcontextprotocol/sdk` stdio server; no client-specific behavior baked into tool logic. |
| stdout is reserved for JSON-RPC | Per the MCP stdio contract, nothing but protocol frames may hit stdout. Any `console.log`/chalk call reached from a reused function corrupts the transport. `console.error` (stderr) is safe for diagnostics. |

---

## Scope

### In scope

- Add `@modelcontextprotocol/sdk` and `zod` as dependencies (see SDK Integration Notes below).
- New `src/mcp/` module: server bootstrap, tool registry, per-tool handlers.
- New `sigma-mcp` bin entry point so the server can be launched by an MCP client independent of the `sigma` CLI command tree.
- Implement the following read-only tools by wrapping existing engine/util code:
  - `sigma.status` → wraps `readProgress` + `getGateStatus` + `hasInvalidRuntime`/`getInvalidMarkers`.
  - `sigma.orientation` → wraps the same data `runBootstrap` (`src/commands/session.ts`) currently formats for terminal output, returned as structured fields instead of printed text.
  - `sigma.gates` → wraps `getGateStatus`, `isGateInvalid`, `getGateStatusLabel` for all three gates.
  - `sigma.artifacts.list` → wraps progress tracker fields (`intent`, `plan`, `exec`, `close`, `roadmap` trackers) already present in `ProgressJson`.
  - `sigma.doctor` → wraps `runDoctorReconciliation` (already read-only/report-producing).
- Manual verification: connect a local MCP client (e.g. Claude Code `.mcp.json` or an MCP inspector) to the server and confirm each tool returns correct structured data against this repo's own (nonexistent) `progress.json` and against a scratch project that has one.
- Minimal automated tests: one test per tool asserting the returned shape against a fixture `ProgressJson`.

### Out of scope

- Any state-changing tool (lock, supersede, override, close, send).
- `sigma.operations.next` / `sigma.operations.classify` / `sigma.operations.preview` (Milestone D — guidance layer; needs its own design pass on how "authorization required" is classified).
- Setup/config integration for VS Code, Reasonix, Gemini, etc. (Milestone C). `src/utils/mcp.ts` already generates client configs for *external* servers; wiring the new Sigma server into that generator is a separate follow-up, not part of this increment.
- Resources/prompts, notification-driven refresh, dashboard surface (roadmap Layer 5 — explicitly deferred).
- Changing `progress.json` schema or any engine function signature. This plan only adds a wrapping layer.

---

## Existing Reusable Surfaces (Milestone A output)

This is the concrete answer to the roadmap's Milestone A questions ("what should the first tools be", "which existing functions can be reused", "what must remain CLI-only").

| Roadmap capability area | Existing code to reuse | File |
|---|---|---|
| lifecycle status | `readProgress`, `ProgressJson.state` | `src/engine/progress.ts` |
| gate status | `getGateStatus`, `isGateInvalid`, `getGateStatusLabel`, `getOperationalGate` | `src/engine/progress.ts` |
| invalid/stale warnings | `hasInvalidRuntime`, `getInvalidMarkers`, `getInvalidWarningLines`, `isStaleIntentPresent` | `src/engine/progress.ts` |
| bootstrap/orientation output | `runBootstrap` (currently prints; needs a data-returning variant) | `src/commands/session.ts` |
| artifact tracker state | `ProgressJson.intent` / `.plan` / `.exec` / `.close` / `.roadmap` trackers | `src/engine/progress.ts` |
| registry/status lookup | `SIGMA-REGISTRY.json`, `SIGMA-OPERATION-REGISTRY.json` readers | `src/engine/registry.ts` |
| doctor/reconciliation report | `runDoctorReconciliation` | `src/engine/progress.ts` |
| role memory (bounded) | role-memory read helpers | `src/engine/roleMemory.ts` |

What must stay CLI-only for this increment: everything that mutates `progress.json`, the registries, or artifact files (`sigma intent/plan/exec lock`, `supersede`, `send`, `override`, `close`). No engine function that writes is touched by this plan.

**Implementation note surfaced during this planning pass**: `runBootstrap` in `src/commands/session.ts` currently builds its output by printing directly (`console.log`/chalk formatting) rather than returning a data structure. `sigma.orientation` cannot cleanly wrap it as-is — Stage 1 below includes extracting the underlying data assembly into a plain function that both the CLI command and the MCP tool call, so the CLI output and the MCP output can never drift apart.

---

## SDK Integration Notes (from `@modelcontextprotocol/sdk` docs, checked against this repo)

Checked during this planning pass, not assumed:

- **Module format is compatible as-is.** `npm view @modelcontextprotocol/sdk exports` (v1.29.0) shows dual `import`/`require` conditions on every subpath (`./server`, `./server/*`, …). This repo's `tsconfig.json` is `"module": "commonjs"` with no `"type": "module"` in `package.json` — the SDK can be `require()`'d directly through its CJS build. **No project-wide ESM migration is needed**, unlike the plain quickstart which assumes a fresh `"type": "module"` project.
- **Node version is already satisfied.** SDK `engines.node` is `>=18`; this repo's `package.json` already declares `"engines": { "node": ">=18.0.0" }`.
- **Core API shape** (TypeScript quickstart, adapted to this repo's CJS/import style):

  ```typescript
  import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
  import { z } from "zod";

  const server = new McpServer({ name: "sigma", version: "0.9.0" });

  server.registerTool(
    "sigma.status",
    {
      description: "Return current Sigma lifecycle phase and gate summary",
      inputSchema: {}, // no arguments for this tool
    },
    async () => {
      const data = readProgress(projectRoot); // src/engine/progress.ts
      return {
        content: [{ type: "text", text: JSON.stringify({ ...buildStatus(data), source: "engine" }) }],
      };
    },
  );

  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Sigma MCP server running on stdio"); // stderr only, never console.log
  }
  main().catch((error) => {
    console.error("Fatal error in Sigma MCP server:", error);
    process.exit(1);
  });
  ```

- **`inputSchema` is a plain object of zod fields**, not a wrapped `z.object(...)` — matches the pattern above (`{ state: z.string().length(2)... }` in the quickstart's `get_alerts` tool). Our tools mostly take no arguments, so most `inputSchema` values will be `{}`.
- **Tool responses are `{ content: [{ type: "text", text }] }`**, not arbitrary JSON return values — the frozen field contracts in "Proposed Tool Surface" below become the JSON payload serialized into that single `text` block, not a native structured MCP response type. (The SDK does support structured/`outputSchema` results in newer versions; worth a spike in Stage 1 to check if `1.29.0` lets us skip the JSON-stringify step and return real structured content instead of a text blob — cleaner for a client to parse.)
- **This confirms and sharpens the Stage-1 refactor requirement**: the MCP stdio contract explicitly forbids anything but protocol frames on stdout. `runBootstrap` currently mixes `console.log`/chalk calls with its data assembly — if the MCP tool called it unmodified, every orientation call would corrupt the JSON-RPC stream, not just duplicate logic. This is a hard correctness requirement, not a style preference.

---

## Proposed Tool Surface (this increment only)

```text
sigma.status              -> { phase, project_id, project_name, schema_version, has_invalid_runtime }
sigma.gates                -> { gate_1_open, gate_2_open, gate_3_satisfied, labels, invalid_markers[] }
sigma.orientation           -> { phase, active_role_hint, gate_summary, stale_intent_warnings[], blockers[] }
sigma.artifacts.list        -> { intent: {...tracker}, plan: {...tracker}, exec: {...tracker}, close: {...tracker}, roadmap: {...tracker} }
sigma.doctor                -> { findings[], reconciled: boolean }
```

Every response includes a `source: "engine"` provenance field so a client can tell the value came from the same code path as the CLI, not a reimplementation.

Final field names may change during implementation; this table is the frozen starting contract for coding, per the roadmap's Milestone A exit signal.

---

## Task Breakdown

### Stage 1 — Scaffold and Data-Layer Prep

- `npm install @modelcontextprotocol/sdk zod` (SDK's CJS build works with the existing `commonjs`/no-`"type": "module"` setup — no tsconfig or package.json module-format migration needed; confirmed against v1.29.0 package exports).
- Create `src/mcp/server.ts` (`McpServer` + `StdioServerTransport` bootstrap, per SDK Integration Notes above) and `src/mcp/tools/` (one file per tool, `registerTool` calls).
- Refactor `runBootstrap` in `src/commands/session.ts` to separate data assembly from console/chalk output, so both the CLI and the new MCP tool call the same underlying function. This is a hard requirement, not just a DRY nicety — any stray `console.log`/chalk write reached from an MCP tool corrupts the stdio JSON-RPC stream.
- Add `bin/sigma-mcp.js` entry point and register it in `package.json` `"bin"`.
- Spike: check whether SDK `1.29.0`'s `registerTool` supports structured/`outputSchema` responses so tools can return real JSON instead of a stringified `text` block; fall back to `JSON.stringify` in the `text` field if not.

### Stage 2 — Read-Only Tool Implementation

- Implement `sigma.status`, `sigma.gates`, `sigma.artifacts.list`, `sigma.doctor` as thin wrappers over the functions listed in the reuse table above.
- Implement `sigma.orientation` using the Stage 1 refactor of `runBootstrap`.
- Each tool validates it never calls a mutating engine function (enforced by code review, not runtime — no write functions are imported into `src/mcp/tools/`).

### Stage 3 — Tests

- Fixture-based unit tests per tool (valid `ProgressJson`, invalid/stale-intent `ProgressJson`, missing `progress.json`).
- One integration-style test that boots the server in-process and calls each tool through the MCP SDK's client harness, if the SDK supports an in-process transport; otherwise a documented manual verification script.

### Stage 4 — Manual Verification

- Configure a local MCP client (Claude Code or an MCP inspector CLI) against `bin/sigma-mcp.js`.
- Walk through each tool against: (a) this repo (no `progress.json` — confirms graceful "no active project" response), (b) a scratch project with a real `progress.json` in a representative state (open gates, stale intent).
- Record the verification transcript in this plan's follow-up notes before calling Milestone B done.

---

## Risk Notes

- **stdout corruption, not just drift**: verified against the SDK docs — stdio-based MCP servers must never write anything but protocol frames to stdout. `runBootstrap`'s current chalk/`console.log` calls would break the transport if reused unmodified, not merely duplicate logic. Mitigated by the Stage 1 refactor requirement.
- **SDK dependency footprint**: `@modelcontextprotocol/sdk` (+`zod`) are new runtime dependencies for a package that currently only depends on `commander`, `chalk`, `fs-extra`, `inquirer`. Verified the SDK's dual CJS/ESM build means no module-format migration is forced, which lowers this risk from "possible breaking change to the build" to "one new dependency pair" — still worth confirming the Director is fine adding it before Stage 1 lands.
- **No progress.json in this repo**: this repo (sigma-ecosystem itself) has no live `progress.json`, so end-to-end manual verification needs a second scratch project directory — noted explicitly in Stage 4 so it isn't skipped.
- **Scope creep into Milestone D**: "next valid operation" style output is tempting to add once `sigma.gates` exists, but authorization classification is explicitly deferred — resist adding it here.

---

## Backward Compatibility

This plan must not change any behavior for a project already running `sigma` before MCP existed.

| Guarantee | Enforcement |
| --- | --- |
| No `progress.json` schema change | Out-of-scope declared above; no engine function signature touched. |
| No registry format change | `SIGMA-REGISTRY.json` / `SIGMA-OPERATION-REGISTRY.json` readers are wrapped, never modified. |
| `sigma` CLI behavior, output, and exit codes unchanged | New code lives in `src/mcp/` and `bin/sigma-mcp.js`, a separate entry point from `bin/sigma.js`. A project that never installs an MCP client never executes any new code path. |
| No runtime dependency change for existing commands | `@modelcontextprotocol/sdk` and `zod` are imported only from `src/mcp/*`; no `src/commands/*` file imports them except the `runBootstrap` refactor, which imports neither — it only changes internal structure, not its dependency set. |
| `sigma session bootstrap` stdout stays identical after the Stage 1 refactor | Already covered by existing regression tests that spawn the real CLI and assert on stdout per role: `test/role-memory-bootstrap.test.ts` (ARC/AUD/FMN/DEV variants) and `test/lifecycle-hardening.test.ts` (gate/next-operations output). The refactor is not complete until these pass unmodified — no new test scaffolding required, just don't skip running them. |
| Version signaling | Ship as a semver **minor** bump (e.g. `0.9.0` → `0.10.0`). No existing command's inputs, outputs, or exit codes change, so a major bump would overstate the impact and a patch bump would understate it (new public surface is being added). |

Added to Draft Acceptance Criteria: full existing `npm test` suite passes unmodified (not just the new MCP-specific tests) before this increment is considered done.

---

## Director Decisions Recorded

1. **Bin name**: `sigma-mcp` (confirmed 2026-07-03). `bin/sigma-mcp.js`, registered in `package.json` `"bin"` alongside the existing `sigma` entry.
2. **Dependencies**: approved — add `@modelcontextprotocol/sdk@^1.29.0` and `zod` in Stage 1 (confirmed 2026-07-03).
3. **Stage 4 verification method**: scratch project directory, not a committed fixture (confirmed 2026-07-03). A throwaway project outside this repo with a real `progress.json` in representative states (open gates, stale intent, missing file) — not checked in anywhere. Automated coverage of those same states still lives in Stage 3's fixture-based unit tests; the scratch project is only for the manual end-to-end MCP-client walkthrough.

No open questions remain before Stage 1 can start.

---

## Draft Acceptance Criteria

- [ ] `sigma-mcp` server starts over stdio and lists exactly the five tools defined above.
- [ ] Each tool's output matches the frozen field contract and includes `source: "engine"`.
- [ ] No tool imports a mutating engine/util function.
- [ ] `runBootstrap` no longer contains the only copy of orientation data assembly; CLI and MCP consume the same function.
- [ ] Unit tests cover valid, stale-intent, invalid-runtime, and no-`progress.json` cases for every tool.
- [ ] Manual verification transcript recorded against a real scratch `progress.json`.
- [ ] This satisfies the roadmap's Milestone B exit signal: *"An AI client can understand current Sigma phase, active role, gate status, active artifact, and blockers without shell-output interpretation."*
