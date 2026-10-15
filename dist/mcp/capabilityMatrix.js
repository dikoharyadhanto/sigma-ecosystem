"use strict";
// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 — WP-MCP-07.
//
// Renders the human-readable capability matrix from the SAME manifest the
// policy and the parity tests use, so the document cannot become a second
// source of truth. Pure and deterministic: no clock, no environment, no file
// access. The baseline it states is the registry's own `generated_at`, never
// the time of rendering, so rendering twice from one input gives one output
// (TC-MCP-10).
//
// scripts/generate-mcp-matrix.js writes the result to
// Implementation/sigma-mcp/SIGMA-MCP-CAPABILITY-MATRIX.generated.md, and
// test/mcp-capability-matrix.test.ts fails when that file is stale.
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderCapabilityMatrix = renderCapabilityMatrix;
const capabilityManifest_1 = require("./capabilityManifest");
const PLANE_TITLE = {
    query: 'Query plane (`sigma-mcp`)',
    control: 'Control plane (`sigma-control`)',
    cli_only: 'CLI only',
    deferred: 'Deferred (design not final)',
};
const PLANE_ORDER = ['query', 'control', 'cli_only', 'deferred'];
const cell = (text) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const tools = (names) => (names.length ? names.map((n) => `\`${n}\``).join(', ') : '—');
function rows(records, reg) {
    return [...records]
        .sort((a, b) => a.operation_id.localeCompare(b.operation_id))
        .map((r) => {
        const meta = reg.get(r.operation_id);
        return `| \`${r.operation_id}\` | ${r.tier} | ${meta?.level ?? '?'} | ${r.mcp_status} | ${tools(r.tool_names)} | ${r.mapping} | ${cell(r.rationale)} |`;
    });
}
function renderCapabilityMatrix(input) {
    const reg = new Map(input.registry.operations.map((o) => [o.operation_id, { level: o.level, role: o.role }]));
    const by = (plane) => capabilityManifest_1.CAPABILITY_MANIFEST.filter((r) => r.plane === plane);
    const count = (pred) => capabilityManifest_1.CAPABILITY_MANIFEST.filter(pred).length;
    const out = [];
    out.push('# Sigma MCP — Capability Matrix');
    out.push('');
    out.push('> Generated from `src/mcp/capabilityManifest.ts` by `scripts/generate-mcp-matrix.js`. Do not edit by hand:');
    out.push('> `test/mcp-capability-matrix.test.ts` fails when this file differs from a fresh render.');
    out.push('');
    out.push('## Baseline');
    out.push('');
    out.push(`- Sigma version: \`${input.sigmaVersion}\``);
    out.push(`- Operation registry: schema \`${input.registry.schema_version}\`, generated \`${input.registry.generated_at}\`, ${input.registry.total_operations} entries`);
    out.push(`- Active operations: ${capabilityManifest_1.CAPABILITY_MANIFEST.length}; tombstones: ${Object.keys(capabilityManifest_1.TOMBSTONES).length} (${Object.keys(capabilityManifest_1.TOMBSTONES).map((t) => `\`${t}\``).join(', ')})`);
    out.push(`- Implemented on MCP: ${count((r) => r.mcp_status === 'implemented')}; deferred: ${count((r) => r.mcp_status === 'deferred')}; not admissible: ${count((r) => r.mcp_status === 'not_admissible')}`);
    out.push('');
    out.push('This matrix replaces `Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md` as the');
    out.push('reference for what exists. That file stays as the record of the original reasoning and decisions.');
    out.push('');
    out.push('## How to read it');
    out.push('');
    out.push('| Field | Values | Meaning |');
    out.push('|:--|:--|:--|');
    out.push('| tier | `Q`, `W1`, `W2`, `W3`, `NA` | Authority class. `Q` observes; `W1` a bound role may write; `W2` needs a durable Director approval; `W3` and `NA` have no MCP primitive today. |');
    out.push('| plane | `query`, `control`, `cli_only`, `deferred` | Where the operation is meant to live. It says nothing about whether a tool exists. |');
    out.push('| mcp_status | `implemented`, `deferred`, `not_admissible` | `implemented`: a registered tool realises it. `deferred`: allowed in principle, not built or not designed (not a permanent ban). `not_admissible`: a security boundary says it must never be MCP. |');
    out.push('| mapping | `exact`, `functional`, `partial`, `none` | `exact`: same inputs, outputs, side effects. `functional`: same purpose, different shape or an added guard. `partial`: covers only part of the operation. `none`: no tool. |');
    out.push('');
    out.push('A `functional` or `partial` mapping is never counted as full support without its rationale.');
    out.push('Tombstones are never counted as active operations and can never receive a record.');
    out.push('');
    out.push('## Enabling the servers');
    out.push('');
    out.push('- Query server `sigma-mcp`: registered for your AI tools by `sigma project start` / `sigma project sync` and by `sigma setup install` / `sigma setup update`. It is read-only.');
    out.push('- Control server `sigma-control`: never registered automatically. Start it yourself with an explicit binding, for example');
    out.push('  `sigma-control --project-root <root> --project-id <id> --role <ARC|FMN|DEV|AUD>`. It refuses to start without all three.');
    out.push('- Neither server, nor any tool or this document\'s generator, registers a project. A directory that is not a Sigma project stays untouched.');
    out.push('- A Director approval is never given by an MCP tool. It is recorded with `sigma control approve <ticketId> --director-confirm` on the trusted local CLI.');
    out.push('');
    for (const plane of PLANE_ORDER) {
        const recs = by(plane);
        out.push(`## ${PLANE_TITLE[plane]} — ${recs.length}`);
        out.push('');
        out.push('| operation | tier | registry level | mcp_status | tools | mapping | rationale |');
        out.push('|:--|:--|:--|:--|:--|:--|:--|');
        out.push(...rows(recs, reg));
        out.push('');
    }
    out.push('## Tools that realise no active operation');
    out.push('');
    out.push('MCP-native conveniences over engine state, with no CLI operation of the same shape:');
    out.push('');
    out.push('| tool | plane | rationale |');
    out.push('|:--|:--|:--|');
    for (const [name, meta] of Object.entries(capabilityManifest_1.MCP_NATIVE_TOOLS).sort(([a], [b]) => a.localeCompare(b))) {
        out.push(`| \`${name}\` | ${meta.plane} | ${cell(meta.rationale)} |`);
    }
    out.push('');
    out.push('## Compatibility tools (not support for any active operation)');
    out.push('');
    out.push('Retained so a completed historical ticket can still be replayed. They cannot start a new lock, and they');
    out.push('are never counted as coverage:');
    out.push('');
    out.push('| tool | tombstone | replacement |');
    out.push('|:--|:--|:--|');
    for (const [name, meta] of Object.entries(capabilityManifest_1.COMPATIBILITY_TOOLS).sort(([a], [b]) => a.localeCompare(b))) {
        out.push(`| \`${name}\` | \`${meta.tombstone}\` | \`${capabilityManifest_1.TOMBSTONES[meta.tombstone].replacement}\` |`);
    }
    out.push('');
    return out.join('\n');
}
//# sourceMappingURL=capabilityMatrix.js.map