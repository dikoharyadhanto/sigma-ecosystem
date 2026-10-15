"use strict";
// sigma_dev_status — query-plane equivalent of `sigma dev status`.
// Reads the DEV workspace state from the identity record, the dev/ folder, and
// its marker. Creating a workspace is `dev create-workspace`, CLI only.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDevStatus = computeDevStatus;
exports.registerDevStatusTool = registerDevStatusTool;
const devWorkspace_1 = require("../../engine/devWorkspace");
const contract_1 = require("../contract");
const shared_1 = require("../shared");
const queryHelpers_1 = require("./queryHelpers");
function computeDevStatus(root) {
    if (!root)
        return (0, shared_1.noProject)();
    try {
        const status = (0, devWorkspace_1.getDevWorkspaceStatus)(root);
        return {
            active: true,
            state: status.state,
            degraded_reason: status.degradedReason,
            unregistered_folder: status.unregisteredFolder,
            guidance: (0, devWorkspace_1.describeDevWorkspace)(status),
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch (e) {
        return (0, queryHelpers_1.asPrecondition)(e, [root]);
    }
}
function registerDevStatusTool(server) {
    server.registerTool('sigma_dev_status', {
        title: 'Get the DEV workspace status',
        description: 'Report whether the DEV workspace is INACTIVE, ACTIVE, or ACTIVE_DEGRADED — the query-plane equivalent of ' +
            '`sigma dev status`. Read-only; creating or repairing a workspace stays CLI-only. ' +
            'Returns { active, state, degraded_reason, unregistered_folder, guidance[], source }.',
        inputSchema: {},
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => (0, contract_1.respond)('sigma_dev_status', undefined, (root) => computeDevStatus(root)));
}
//# sourceMappingURL=devStatus.js.map