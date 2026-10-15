"use strict";
// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §12 — policy projection.
// PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY-20261015 WP-MCP-02 — manifest-driven.
//
// This module answers "what may be done here, and by whom" as a *projection*.
// It is advisory. Enforcement happens again inside every command, on the
// server, against the same inputs. A consumer that trusts this projection
// instead of attempting the operation is using it wrong, and a command that
// trusts it instead of re-checking is a bug.
//
// The tier, owner and mcp_status of every operation come from ONE place,
// capabilityManifest.ts, an explicit allowlist. It is deliberately NOT derived
// from the registry's own `level`/`role` fields:
//
//   - `level: read_only` does not imply admissible. `scan` is read_only by
//     label and takes an arbitrary file path, which would be sigma_read_file in
//     disguise.
//   - the registry has no ARC/FMN/DEV/AUD dimension at all, only any/director.
//   - a CLI subcommand may exist with no registry entry, so an unknown
//     operation_id must mean FORBIDDEN, never "not restricted".
//
// Hence: anything absent from the manifest is forbidden. The old matrix
// (Implementation/sigma-mcp/SIGMA-MCP-OPERATION-CAPABILITY-MATRIX-20260915.md)
// is a stale baseline and is not a source of truth.
//
// This module never imports a server: the control server is a separate module
// graph by design. That the manifest's `implemented` claims match the tools the
// servers really register is enforced by test/mcp-capability-manifest.test.ts.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERATION_OWNER = exports.OPERATION_TIERS = void 0;
exports.mcpStatusFor = mcpStatusFor;
exports.availabilityFor = availabilityFor;
exports.computeEffectivePolicy = computeEffectivePolicy;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const chain_1 = require("../engine/chain");
const lifecycleView_1 = require("../engine/lifecycleView");
const shared_1 = require("./shared");
const capabilityManifest_1 = require("./capabilityManifest");
// Derived views of the manifest. Tombstones keep their historical tier NA so
// they stay forbidden and never read as unrestricted.
exports.OPERATION_TIERS = Object.freeze({
    ...Object.fromEntries(capabilityManifest_1.CAPABILITY_MANIFEST.map((r) => [r.operation_id, r.tier])),
    ...Object.fromEntries(Object.keys(capabilityManifest_1.TOMBSTONES).map((id) => [id, 'NA'])),
});
/** Owner role per matrix §3. Derived, NOT ratified — advisory only. */
exports.OPERATION_OWNER = Object.freeze(Object.fromEntries(capabilityManifest_1.CAPABILITY_MANIFEST.filter((r) => r.owner_role).map((r) => [r.operation_id, r.owner_role])));
/**
 * Whether an MCP primitive exists, as declared by the manifest. Tombstones and
 * unknown ids are never implemented. `mcp_status` is a claim; the parity test
 * is what proves the named tools are registered on the declared plane.
 */
function mcpStatusFor(operationId) {
    if ((0, capabilityManifest_1.isTombstone)(operationId))
        return 'not_admissible';
    return (0, capabilityManifest_1.capabilityFor)(operationId)?.mcp_status ?? 'not_admissible';
}
/**
 * Only the operations whose precondition is stated unambiguously in the
 * registry are gate-evaluated. The rest report their tier authority with
 * gate_evaluated:false rather than guessing — an advisory projection that
 * invents preconditions is worse than one that admits it does not know.
 */
function gateBlocks(operationId, g) {
    switch (operationId) {
        case 'plan_new':
        case 'plan_clone': return !g.gate_1_open;
        case 'exec_new': return !g.gate_2_open;
        case 'close_new': return !g.gate_3_satisfied;
        case 'intent_ratify': return g.intent_state !== 'DRAFT';
        default: return null;
    }
}
function availabilityFor(operationId, gates) {
    const tier = exports.OPERATION_TIERS[operationId];
    // Unknown operation → forbidden: absent from the registry must not read as
    // "unrestricted".
    if (tier === undefined || tier === 'NA' || tier === 'W3') {
        return { availability: 'forbidden', gate_evaluated: false };
    }
    if (tier === 'Q')
        return { availability: 'observe', gate_evaluated: false };
    const blocked = gates ? gateBlocks(operationId, gates) : null;
    if (blocked === true)
        return { availability: 'gate_blocked', gate_evaluated: true };
    const availability = tier === 'W2' ? 'director_required' : 'role_action';
    return { availability, gate_evaluated: blocked === false };
}
function readRegistry(root) {
    try {
        const raw = fs_extra_1.default.readJsonSync(path_1.default.join(root, config_1.OPERATION_REGISTRY_FILE));
        return Array.isArray(raw.operations) ? raw.operations : null;
    }
    catch {
        return null;
    }
}
function gateFacts(root) {
    try {
        if ((0, chain_1.listChainVersions)(root).length === 0)
            return null;
        const { data } = (0, chain_1.readActiveChain)(root);
        const g = (0, chain_1.getGateStatus)({ ...data, gates: (0, lifecycleView_1.effectiveLifecycleGates)(root, data) });
        return {
            gate_1_open: g.gate_1_open,
            gate_2_open: g.gate_2_open,
            gate_3_satisfied: g.gate_3_satisfied,
            intent_state: data.intent?.state ?? null,
        };
    }
    catch {
        return null;
    }
}
function computeEffectivePolicy(root, roleFilter) {
    if (!root) {
        return {
            active: false,
            message: 'No active Sigma project or chain in this directory.',
            source: shared_1.SOURCE_ENGINE,
        };
    }
    const registry = readRegistry(root);
    if (!registry) {
        return {
            active: false,
            message: 'Operation registry not readable in this project.',
            registry_available: false,
            source: shared_1.SOURCE_ENGINE,
        };
    }
    const gates = gateFacts(root);
    const operations = registry
        .map((op) => {
        const { availability, gate_evaluated } = availabilityFor(op.operation_id, gates);
        return {
            operation_id: op.operation_id,
            tier: exports.OPERATION_TIERS[op.operation_id] ?? null,
            availability,
            gate_evaluated,
            owner_role: exports.OPERATION_OWNER[op.operation_id] ?? null,
            registry_role: op.role ?? null,
            registry_level: op.level ?? null,
            ...(op.operation_id === 'plan_revise_commit' ? { conditional_director_approval: 'Required for loosening or director checkpoint; ordinary pre/post-build changes are reviewed with EXEC.' } : {}),
            mcp_status: mcpStatusFor(op.operation_id),
            // Declared by the manifest, not introspected: this tool runs in the
            // query server and must not import the control server. The parity test
            // proves the declaration against both servers' real tool lists.
            plane: (0, capabilityManifest_1.capabilityFor)(op.operation_id)?.plane ?? null,
            mcp_tools: (0, capabilityManifest_1.capabilityFor)(op.operation_id)?.tool_names ?? [],
            registry_status: (0, capabilityManifest_1.isTombstone)(op.operation_id) ? 'tombstone' : 'active',
        };
    })
        .filter((row) => !roleFilter || row.owner_role === null || row.owner_role === roleFilter);
    const counts = operations.reduce((acc, row) => {
        acc[row.availability] = (acc[row.availability] ?? 0) + 1;
        return acc;
    }, {});
    return {
        active: true,
        registry_available: true,
        gates_evaluated: gates !== null,
        role_filter: roleFilter ?? null,
        counts,
        operations,
        // Said plainly in the payload so a model cannot mistake the projection for
        // permission: nothing here grants anything (§12).
        advisory: true,
        enforcement: 'server-side, re-checked per command',
        source: shared_1.SOURCE_ENGINE,
    };
}
//# sourceMappingURL=policy.js.map