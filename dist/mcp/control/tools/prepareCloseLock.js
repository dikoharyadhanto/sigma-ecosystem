"use strict";
// Stage F (W2 batch, continued) — sigma_prepare_close_lock. Same two-stage
// shape as Stage D's prepareIntentRatify.ts. No business argument — the
// Director approval record replaces the CLI's interactive
// promptApprove()/--yes gate entirely (see closeLockService.ts's header).
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPrepareCloseLockTool = registerPrepareCloseLockTool;
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const chain_1 = require("../../../engine/chain");
const artifactPath_1 = require("../../artifactPath");
const controlStore_1 = require("../../../engine/controlStore");
const docCheck_1 = require("../../../utils/docCheck");
const contract_1 = require("../../contract");
const errors_1 = require("../../errors");
const shared_1 = require("../../shared");
const shared_2 = require("../shared");
function registerPrepareCloseLockTool(server) {
    server.registerTool('sigma_prepare_close_lock', {
        title: 'Prepare a close-lock operation ticket',
        description: 'Freezes the active chain\'s DRAFT DIR-CLOSE (version, document hash, state_revision) into an ' +
            'operation ticket. Locking closes the project lifecycle and auto-locks a still-DRAFT ROADMAP as a ' +
            'side effect — listed in `effects[]`. Does not lock anything. The ticket grants no authority by ' +
            'itself: a Director must record an approval via the trusted local CLI (`sigma control approve ' +
            '<ticket_id>`) before sigma_commit_close_lock can use it. Tickets expire after 30 minutes. AUD role only.',
        inputSchema: {
            idempotency_key: zod_1.z.string().min(1),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async (args) => {
        const operationTicketId = (0, controlStore_1.generateId)('opt');
        return (0, shared_2.respondControlWrite)({
            tool: 'sigma_prepare_close_lock',
            operationId: 'close_lock_prepare',
            idempotencyKey: args.idempotency_key,
            argumentsForHash: {},
            allowedRoles: ['AUD'],
            checkPreconditions: () => { },
            transactionFiles: (root) => [(0, controlStore_1.ticketPath)(root, operationTicketId)],
        }, (root) => {
            const { data: chain } = (0, chain_1.readActiveChain)(root);
            if (!chain.close || chain.close.state !== 'DRAFT') {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'Active DIR-CLOSE is not in DRAFT state. Cannot lock.');
            }
            if (!chain.close.file) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Active DIR-CLOSE has no registered file.');
            }
            const doc = (0, artifactPath_1.readCanonicalArtifactFile)(root, 'close', chain.close.version, chain.close.file);
            if (!doc.present || !doc.sha256) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, 'The DRAFT DIR-CLOSE file is not present on disk.');
            }
            const report = (0, docCheck_1.validateSigmaDocFile)(path_1.default.join(root, chain.close.file), 'close');
            try {
                (0, docCheck_1.ensureSigmaDocEligible)(report, 'close');
            }
            catch (e) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INVALID_OPERATION, e.message);
            }
            const { revision } = (0, contract_1.computeStateRevision)(root);
            if (!revision) {
                throw new errors_1.McpQueryError(contract_1.ERROR_CODES.INTERNAL_ERROR, 'Could not compute a state_revision for this project.');
            }
            const roadmapToLock = chain.roadmap && chain.roadmap.state === 'DRAFT' ? chain.roadmap.version : null;
            const binding = (0, shared_1.getBinding)();
            const now = new Date();
            const ticket = {
                operation_ticket_id: operationTicketId,
                operation_id: 'close_lock',
                project_id: binding.projectId ?? '',
                bound_role: binding.role ?? '',
                arguments_hash: (0, shared_2.stableHash)({}),
                target: { artifact: 'close', version: chain.close.version, sha256: doc.sha256 },
                expected_state_revision: revision,
                effects: [
                    `close.${chain.close.version}.state: DRAFT -> LOCKED`,
                    'lifecycle_state: -> CLOSED',
                    ...(roadmapToLock ? [`roadmap.${roadmapToLock}.state: DRAFT -> LOCKED (cascade)`] : []),
                ],
                authority: 'director',
                issued_at: now.toISOString(),
                expires_at: new Date(now.getTime() + controlStore_1.TICKET_TTL_MS).toISOString(),
                consumed_at: null,
            };
            (0, controlStore_1.writeTicket)(root, ticket);
            return {
                operation_ticket_id: ticket.operation_ticket_id,
                operation_id: ticket.operation_id,
                target: ticket.target,
                effects: ticket.effects,
                expected_state_revision: ticket.expected_state_revision,
                expires_at: ticket.expires_at,
            };
        });
    });
}
//# sourceMappingURL=prepareCloseLock.js.map