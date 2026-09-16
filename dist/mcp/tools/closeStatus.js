"use strict";
// Stage B2 — sigma_close_status. Query-plane equivalent of `sigma close
// status` — the active chain's DIR-CLOSE (single object, may not exist yet)
// plus the chain's overall lifecycle_state.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCloseStatus = computeCloseStatus;
exports.registerCloseStatusTool = registerCloseStatusTool;
const zod_1 = require("zod");
const chain_1 = require("../../engine/chain");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeCloseStatus(root) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0) {
        return { active: false, close: null, source: shared_1.SOURCE_ENGINE };
    }
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    return {
        active: true,
        active_chain: chainVersion,
        close: chain.close
            ? {
                version: chain.close.version,
                state: chain.close.state,
                locked_at: chain.close.locked_at ?? null,
                file: chain.close.file ?? null,
            }
            : null,
        lifecycle_state: chain.lifecycle_state,
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerCloseStatusTool(server) {
    server.registerTool('sigma_close_status', {
        title: 'Get DIR-CLOSE status',
        description: 'Return the active chain\'s DIR-CLOSE status — the query-plane equivalent of `sigma close status`: ' +
            'version, state, lock timestamp, and the chain\'s overall lifecycle_state. Read-only. Returns { active, ' +
            'active_chain, close, lifecycle_state, source } — close is null when no DIR-CLOSE has been created yet.',
        inputSchema: {
            project_root: zod_1.z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, contract_1.respond)('sigma_close_status', project_root, (root) => computeCloseStatus(root)));
}
//# sourceMappingURL=closeStatus.js.map