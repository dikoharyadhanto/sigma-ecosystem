"use strict";
// Stage B2 — sigma_list_intents. Query-plane equivalent of `sigma intent
// list` — the ONE B2 operation that is cross-chain: reads every
// progress-v<N>.json under the project, not just the active chain (every
// other B2/existing query tool is scoped to the active chain only). Still
// within the "one binding, one project" model — a project root can contain
// multiple chains, and this lists all of them.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeListIntents = computeListIntents;
exports.registerListIntentsTool = registerListIntentsTool;
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeListIntents(root) {
    if (!root)
        return (0, shared_1.noProject)({ chains: [] });
    const versions = (0, chain_1.listChainVersions)(root);
    if (versions.length === 0)
        return { chains: [], source: shared_1.SOURCE_ENGINE };
    let activeChainVersion = null;
    try {
        activeChainVersion = (0, chain_1.resolveActiveChainVersion)(root);
    }
    catch {
        // No chain is eligible to be active (e.g. every chain SUPERSEDED) —
        // still list everything, just without an `active: true` marker.
    }
    return {
        chains: versions.map((v) => {
            const chain = (0, chain_1.readChain)(root, v);
            return {
                chain_version: v,
                intent_state: chain.intent.state,
                lifecycle_state: chain.lifecycle_state,
                gate_1_open: chain.gates.gate_1_open,
                gate_2_open: chain.gates.gate_2_open,
                gate_3_satisfied: chain.gates.gate_3_satisfied,
                active: v === activeChainVersion,
            };
        }),
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerListIntentsTool(server) {
    server.registerTool('sigma_list_intents', {
        title: 'List all chains (DIR-INTENTs)',
        description: 'List every chain under the project root — the query-plane equivalent of `sigma intent list`. The only ' +
            'B2 tool that is cross-chain: every other tool in this project reports on the active chain only. ' +
            'Read-only. Returns { chains: [{ chain_version, intent_state, lifecycle_state, gate_1_open, gate_2_open, ' +
            'gate_3_satisfied, active }], source }.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, contract_1.respond)('sigma_list_intents', undefined, (root) => computeListIntents(root)));
}
//# sourceMappingURL=listIntents.js.map