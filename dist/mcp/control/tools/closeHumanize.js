"use strict";
// Stage E W1 — sigma_close_humanize. Control-plane only. Mirrors the
// createXDraft.ts wiring shape. See closeHumanizeService.ts for what
// differs about the use case itself (no --v selector at all — always the
// active chain's own close).
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCloseHumanizeTool = registerCloseHumanizeTool;
const zod_1 = require("zod");
const closeHumanizeService_1 = require("../../../services/closeHumanizeService");
const shared_1 = require("../shared");
function registerCloseHumanizeTool(server) {
    server.registerTool('sigma_close_humanize', {
        title: 'Generate DIR-CLOSE human projection',
        description: 'Scaffolds a human-readable Notion projection (and its internal, never-published Fidelity Ledger) ' +
            'from a LOCKED DIR-CLOSE — the MCP control-plane equivalent of `sigma close humanize`. AUD role only. ' +
            'Always targets the active chain\'s own DIR-CLOSE (no version selector). Refuses to overwrite an ' +
            'existing projection unless force:true. Requires idempotency_key and expected_state_revision (from a ' +
            'prior sigma_get_state call on this binding).',
        inputSchema: {
            force: zod_1.z.boolean().optional().describe('Overwrite an already-generated human projection for this version.'),
            idempotency_key: zod_1.z.string().min(1),
            expected_state_revision: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => (0, shared_1.respondControlWrite)({
        tool: 'sigma_close_humanize',
        operationId: 'close_humanize',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: { force: Boolean(args.force) },
        allowedRoles: ['AUD'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        transactionFiles: closeHumanizeService_1.humanizeCloseTransactionFiles,
    }, (root) => (0, closeHumanizeService_1.humanizeClose)({ projectRoot: root, force: args.force })));
}
//# sourceMappingURL=closeHumanize.js.map