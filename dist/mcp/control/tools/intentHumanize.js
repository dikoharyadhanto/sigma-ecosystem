"use strict";
// Stage E W1 — sigma_intent_humanize. Control-plane only. Mirrors the
// createXDraft.ts wiring shape. See intentHumanizeService.ts for what
// differs about the use case itself.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIntentHumanizeTool = registerIntentHumanizeTool;
const zod_1 = require("zod");
const intentHumanizeService_1 = require("../../../services/intentHumanizeService");
const shared_1 = require("../shared");
function registerIntentHumanizeTool(server) {
    server.registerTool('sigma_intent_humanize', {
        title: 'Generate DIR-INTENT human projection',
        description: 'Scaffolds a human-readable Notion projection (and its internal, never-published Fidelity Ledger) ' +
            'from a RATIFIED DIR-INTENT — the MCP control-plane equivalent of `sigma intent humanize`. ARC role ' +
            'only. Requires the target chain\'s intent to be RATIFIED. Refuses to overwrite an existing ' +
            'projection unless force:true. Requires idempotency_key and expected_state_revision (from a prior ' +
            'sigma_get_state call on this binding).',
        inputSchema: {
            version: zod_1.z.string().min(1).optional().describe('Chain version to humanize instead of the active one, e.g. "v1".'),
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
        tool: 'sigma_intent_humanize',
        operationId: 'intent_humanize',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: { version: args.version ?? null, force: Boolean(args.force) },
        allowedRoles: ['ARC'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        transactionFiles: (root) => (0, intentHumanizeService_1.humanizeIntentTransactionFiles)(root, args.version),
    }, (root) => (0, intentHumanizeService_1.humanizeIntent)({ projectRoot: root, version: args.version, force: args.force })));
}
//# sourceMappingURL=intentHumanize.js.map