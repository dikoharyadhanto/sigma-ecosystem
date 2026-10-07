"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAcknowledgePlanTool = registerAcknowledgePlanTool;
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const revisions_1 = require("../../../engine/revisions");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../shared");
function registerAcknowledgePlanTool(server) {
    server.registerTool('sigma_acknowledge_plan', { title: 'Acknowledge current PLAN revision', description: 'DEV explicitly acknowledges the latest current PLAN revision/hash after valid CONTRACT_CHANGE notices. Grants no coding authority and never auto-acknowledges from mailbox status.', inputSchema: { version: zod_1.z.string().min(1), revision: zod_1.z.number().int().positive(), expected_state_revision: zod_1.z.string().min(1), idempotency_key: zod_1.z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (args) => (0, shared_1.respondControlWrite)({ tool: 'sigma_acknowledge_plan', operationId: 'exec_acknowledge_plan', guardedWrites: true, idempotencyKey: args.idempotency_key, argumentsForHash: { version: args.version, revision: args.revision }, allowedRoles: ['DEV'], checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision), transactionFiles: root => [(0, chain_1.chainFilePath)(root, (0, chain_1.readActiveChain)(root).chainVersion)] }, root => {
        try {
            return (0, revisions_1.acknowledgePlan)(root, args.version, args.revision);
        }
        catch (e) {
            throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, e.message.split(root).join('.'));
        }
    }));
}
//# sourceMappingURL=acknowledgePlan.js.map