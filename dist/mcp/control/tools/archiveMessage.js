"use strict";
// Stage E W1 — sigma_inbox_archive. Control-plane tool wrapping the shared
// service src/services/inboxArchiveService.ts (moved there 2026-09-16,
// Codex finding H-02, to satisfy the CLI/MCP shared-service invariant —
// see that file's header for the ownership-check design).
//
// Role gating here is two-layer, unlike every other primitive so far:
// `allowedRoles` admits all four AI roles (matrix: "semua"), and the
// per-message ownership check (bound role must equal the message's `to`)
// happens inside mutate(), not at the coarse role gate.
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerArchiveMessageTool = registerArchiveMessageTool;
const zod_1 = require("zod");
const inboxArchiveService_1 = require("../../../services/inboxArchiveService");
const shared_1 = require("../shared");
function registerArchiveMessageTool(server) {
    server.registerTool('sigma_inbox_archive', {
        title: 'Archive a mailbox message',
        description: 'Marks a mailbox message ARCHIVED in Sigma/messages/index.json — the MCP control-plane equivalent of ' +
            '`sigma inbox archive <id>`, with one deliberate addition: a bound role may only archive a message ' +
            'addressed to itself (rejected with ROLE_NOT_AUTHORIZED otherwise). The CLI command has no such ' +
            'check; this is new MCP-only behavior, not a straight port. Never reads or returns message content — ' +
            'only flips a status field. Requires idempotency_key and expected_state_revision (from a prior ' +
            'sigma_get_state call on this binding).',
        inputSchema: {
            message_id: zod_1.z.string().min(1),
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
        tool: 'sigma_inbox_archive',
        operationId: 'inbox_archive',
        idempotencyKey: args.idempotency_key,
        argumentsForHash: { message_id: args.message_id },
        allowedRoles: ['ARC', 'FMN', 'DEV', 'AUD'],
        checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
        transactionFiles: inboxArchiveService_1.archiveMessageTransactionFiles,
    }, (root, role) => (0, inboxArchiveService_1.archiveMessage)({ projectRoot: root, actorRole: role, messageId: args.message_id })));
}
//# sourceMappingURL=archiveMessage.js.map