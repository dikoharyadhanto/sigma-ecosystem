"use strict";
// PLAN-IMPL-01 §3.2 — sigma_get_gates
//
// Read-only. Wraps getGateStatus + getGateStatusLabel + getInvalidMarkers.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGates = computeGates;
exports.registerGatesTool = registerGatesTool;
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const GATE_KEYS = ['gate_1_open', 'gate_2_open', 'gate_3_satisfied'];
// Pure core (PLAN-IMPL-01 §4-A) — unit-testable without the transport.
function computeGates(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    const { data } = (0, chain_1.readActiveChain)(root);
    const gates = (0, chain_1.getGateStatus)(data);
    const labels = {};
    for (const key of GATE_KEYS) {
        labels[key] = (0, chain_1.getGateStatusLabel)(data, key);
    }
    return {
        active: true,
        gate_1_open: gates.gate_1_open,
        gate_2_open: gates.gate_2_open,
        gate_3_satisfied: gates.gate_3_satisfied,
        labels,
        invalid_markers: (0, chain_1.getInvalidMarkers)(data),
        source: shared_1.SOURCE_ENGINE,
    };
}
const zod_1 = require("zod");
function registerGatesTool(server) {
    server.registerTool('sigma_get_gates', {
        title: 'Get Sigma Gate Status',
        description: 'Return the three Sigma lifecycle gates with human-readable labels and any INVALID runtime markers. Read-only. Accepts optional project_root parameter. Returns { active, gate_1_open, gate_2_open, gate_3_satisfied, labels, invalid_markers, source }.',
        inputSchema: {
            project_root: zod_1.z
                .string()
                .optional()
                .describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, shared_1.okText)(computeGates((0, shared_1.resolveRoot)(project_root))));
}
//# sourceMappingURL=gates.js.map