"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerF08ControlTools = registerF08ControlTools;
const zod_1 = require("zod");
const shared_1 = require("../shared");
const f08Queries_1 = require("../../tools/f08Queries");
const cloneDraftService_1 = require("../../../services/cloneDraftService");
const auditDecisionService_1 = require("../../../services/auditDecisionService");
const writeFields = { idempotency_key: zod_1.z.string().min(1), expected_state_revision: zod_1.z.string().min(1) };
const targetFields = { type: zod_1.z.enum(['intent', 'plan', 'exec', 'roadmap', 'close']), version: zod_1.z.string().min(1), expected_artifact_sha256: zod_1.z.string().min(1) };
const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
function registerF08ControlTools(server) {
    server.registerTool('sigma_clone_draft', {
        title: 'Create the reviewed clone as a fresh DRAFT', description: 'ARC for INTENT, FMN for PLAN. Requires a prior clone preview token; no old certification or audit verdict is inherited.',
        inputSchema: { ...f08Queries_1.cloneShape, preview_token: zod_1.z.string().min(1), ...writeFields }, annotations,
    }, async (args) => {
        const input = (root) => ({ projectRoot: root, type: args.type, sourceChain: args.source_chain,
            sourceVersion: args.source_version, title: args.title, focus: args.focus, allowReopenClosed: args.allow_reopen_closed });
        return (0, shared_1.respondControlWrite)({
            tool: 'sigma_clone_draft', operationId: args.type + '_clone', idempotencyKey: args.idempotency_key,
            argumentsForHash: { type: args.type, source_chain: args.source_chain, source_version: args.source_version,
                title: args.title, focus: args.focus, allow_reopen_closed: Boolean(args.allow_reopen_closed), preview_token: args.preview_token },
            allowedRoles: [args.type === 'intent' ? 'ARC' : 'FMN'], checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision),
            transactionFiles: root => (0, cloneDraftService_1.cloneTransactionFiles)(input(root)), guardedWrites: true,
        }, root => (0, cloneDraftService_1.cloneDraft)(input(root), args.preview_token));
    });
    server.registerTool('sigma_create_audit_pack', {
        title: 'Create a bounded audit snapshot', description: 'Create an audit pack from registered artifacts. No external sending and no lifecycle approval.',
        inputSchema: { ...targetFields, include_evidence: zod_1.z.boolean().optional(), ...writeFields }, annotations,
    }, async (args) => (0, shared_1.respondControlWrite)({
        tool: 'sigma_create_audit_pack', operationId: 'audit_new', idempotencyKey: args.idempotency_key,
        argumentsForHash: { type: args.type, version: args.version, hash: args.expected_artifact_sha256, include_evidence: Boolean(args.include_evidence) },
        allowedRoles: ['ARC', 'FMN', 'DEV'], checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision), transactionFiles: auditDecisionService_1.f08TransactionFiles,
    }, root => (0, auditDecisionService_1.createAuditPack)(root, args.type, args.version, args.expected_artifact_sha256, args.include_evidence)));
    server.registerTool('sigma_record_audit_response', {
        title: 'Record original AUD response', description: 'AUD only. Stores the exact response and declared origin against an unchanged audit pack. Never approves an artifact.',
        inputSchema: { pack_id: zod_1.z.string().min(1), pack_sha256: zod_1.z.string().min(1),
            raw: zod_1.z.string().min(1), origin: zod_1.z.string().min(1), ...writeFields }, annotations,
    }, async (args) => (0, shared_1.respondControlWrite)({
        tool: 'sigma_record_audit_response', operationId: 'audit_record', idempotencyKey: args.idempotency_key,
        argumentsForHash: { pack_id: args.pack_id, hash: args.pack_sha256, raw: args.raw, origin: args.origin },
        allowedRoles: ['AUD'], checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision), transactionFiles: auditDecisionService_1.f08TransactionFiles,
    }, (root, role) => (0, auditDecisionService_1.recordAuditResponse)(root, args.pack_id, args.raw, args.origin, args.pack_sha256, role)));
    server.registerTool('sigma_add_decision', {
        title: 'Record an explicit substantive question', description: 'ARC/FMN/DEV can add questions scoped to an active-intent artifact/hash. No MCP tool resolves a Director decision.',
        inputSchema: { ...targetFields, question: zod_1.z.string().min(1), ...writeFields }, annotations,
    }, async (args) => (0, shared_1.respondControlWrite)({
        tool: 'sigma_add_decision', operationId: 'decisions_add', idempotencyKey: args.idempotency_key,
        argumentsForHash: { type: args.type, version: args.version, hash: args.expected_artifact_sha256, question: args.question },
        allowedRoles: ['ARC', 'FMN', 'DEV'], checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision), transactionFiles: auditDecisionService_1.f08TransactionFiles,
    }, (root, role) => (0, auditDecisionService_1.addQuestion)(root, args.type, args.version, args.question, args.expected_artifact_sha256, role)));
    server.registerTool('sigma_record_readiness', {
        title: 'Record advisory FMN readiness assessment', description: 'FMN only, tied to current PLAN and INTENT hashes. Never modifies gates or substitutes for Director approval.',
        inputSchema: { version: zod_1.z.string().min(1), status: zod_1.z.enum(['READY', 'SCOPE_GAP', 'PENDING_ALIGNMENT', 'UNKNOWN']),
            reason: zod_1.z.string().min(1), expected_artifact_sha256: zod_1.z.string().min(1), expected_source_sha256: zod_1.z.string().min(1), ...writeFields }, annotations,
    }, async (args) => (0, shared_1.respondControlWrite)({
        tool: 'sigma_record_readiness', operationId: 'decisions_assess', idempotencyKey: args.idempotency_key,
        argumentsForHash: { version: args.version, status: args.status, reason: args.reason, hash: args.expected_artifact_sha256, source_hash: args.expected_source_sha256 },
        allowedRoles: ['FMN'], checkPreconditions: (0, shared_1.staleStateCheck)(args.expected_state_revision), transactionFiles: auditDecisionService_1.f08TransactionFiles,
    }, (root, role) => (0, auditDecisionService_1.recordReadiness)(root, args.version, args.status, args.reason, args.expected_artifact_sha256, args.expected_source_sha256, role)));
}
//# sourceMappingURL=f08.js.map