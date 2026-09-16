"use strict";
// Stage E W1 — sigma_update_reference. Control-plane only. Unlike every
// other control tool, this mutation never touches progress-v<N>.json at
// all — see referenceUpdateService.ts's header. Role "any" per the
// capability matrix; all four AI roles are allowed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpdateReferenceTool = registerUpdateReferenceTool;
const zod_1 = require("zod");
const referenceUpdateService_1 = require("../../../services/referenceUpdateService");
const shared_1 = require("../shared");
function registerUpdateReferenceTool(server) {
    server.registerTool('sigma_update_reference', {
        title: 'Sync reference list from local data files',
        description: 'Syncs the Local Artifact table in Sigma/reference/reference-list.md from files found in ' +
            'Sigma/reference/data/ — the MCP control-plane equivalent of `sigma reference update`. Any role. ' +
            'Top-level only (a data/ subfolder is one row, not walked recursively); auto-assigns the next ' +
            'sequential LA id; never modifies existing rows (Category/Notes stay manual); flags but never deletes ' +
            'rows whose file no longer exists. Self-heals a missing reference-list.md from its template. Not ' +
            'tracked in progress-v<N>.json — no gate, no lock state. Requires idempotency_key and ' +
            'expected_state_revision (from a prior sigma_get_state call on this binding).',
        inputSchema: {
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
        tool: 'sigma_update_reference',
        operationId: 'reference_update',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: {},
        allowedRoles: ['ARC', 'FMN', 'DEV', 'AUD'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        transactionFiles: referenceUpdateService_1.referenceUpdateTransactionFiles,
    }, (root) => (0, referenceUpdateService_1.updateReferenceList)(root)));
}
//# sourceMappingURL=updateReference.js.map