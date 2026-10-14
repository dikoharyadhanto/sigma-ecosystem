import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { respondControlWrite, staleStateCheck } from '../shared';
import { cloneShape } from '../../tools/f08Queries';
import { cloneDraft, cloneTransactionFiles, CloneInput } from '../../../services/cloneDraftService';
import { createAuditPack, recordAuditResponse, addQuestion, recordReadiness, f08TransactionFiles } from '../../../services/auditDecisionService';
const writeFields = { idempotency_key: z.string().min(1), expected_state_revision: z.string().min(1) };
const targetFields = { type: z.enum(['intent', 'plan', 'exec', 'roadmap', 'close']), version: z.string().min(1), expected_artifact_sha256: z.string().min(1) };
const annotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export function registerF08ControlTools(server: McpServer): void {
  server.registerTool('sigma_clone_draft', {
    title: 'Create the reviewed clone as a fresh DRAFT', description: 'ARC for INTENT, FMN for PLAN. Requires a prior clone preview token; no old certification or audit verdict is inherited.',
    inputSchema: { ...cloneShape, preview_token: z.string().min(1), ...writeFields }, annotations,
  }, async args => {
    const input = (root: string): CloneInput => ({ projectRoot: root, type: args.type, sourceChain: args.source_chain,
      sourceVersion: args.source_version, title: args.title, focus: args.focus, allowReopenClosed: args.allow_reopen_closed });
    return respondControlWrite({
      tool: 'sigma_clone_draft', operationId: args.type + '_clone', idempotencyKey: args.idempotency_key,
      argumentsForHash: { type: args.type, source_chain: args.source_chain, source_version: args.source_version,
        title: args.title, focus: args.focus, allow_reopen_closed: Boolean(args.allow_reopen_closed), preview_token: args.preview_token },
      allowedRoles: [args.type === 'intent' ? 'ARC' : 'FMN'], checkPreconditions: staleStateCheck(args.expected_state_revision),
      transactionFiles: root => cloneTransactionFiles(input(root)), guardedWrites: true,
    }, root => cloneDraft(input(root), args.preview_token));
  });
  server.registerTool('sigma_create_audit_pack', {
    title: 'Create a bounded audit snapshot', description: 'Create an audit pack from registered artifacts. No external sending and no lifecycle approval.',
    inputSchema: { ...targetFields, include_evidence: z.boolean().optional(), ...writeFields }, annotations,
  }, async args => respondControlWrite({
    tool: 'sigma_create_audit_pack', operationId: 'audit_new', idempotencyKey: args.idempotency_key,
    argumentsForHash: { type: args.type, version: args.version, hash: args.expected_artifact_sha256, include_evidence: Boolean(args.include_evidence) },
    allowedRoles: ['ARC', 'FMN', 'DEV'], checkPreconditions: staleStateCheck(args.expected_state_revision), transactionFiles: f08TransactionFiles,
  }, root => createAuditPack(root, args.type, args.version, args.expected_artifact_sha256, args.include_evidence)));
  server.registerTool('sigma_record_audit_response', {
    title: 'Record original AUD response', description: 'AUD only. Stores the exact response and declared origin against an unchanged audit pack. Never approves an artifact.',
    inputSchema: { pack_id: z.string().min(1), pack_sha256: z.string().min(1),
      raw: z.string().min(1), origin: z.string().min(1), ...writeFields }, annotations,
  }, async args => respondControlWrite({
    tool: 'sigma_record_audit_response', operationId: 'audit_record', idempotencyKey: args.idempotency_key,
    argumentsForHash: { pack_id: args.pack_id, hash: args.pack_sha256, raw: args.raw, origin: args.origin },
    allowedRoles: ['AUD'], checkPreconditions: staleStateCheck(args.expected_state_revision), transactionFiles: f08TransactionFiles,
  }, (root, role) => recordAuditResponse(root, args.pack_id, args.raw, args.origin, args.pack_sha256, role)));
  server.registerTool('sigma_add_decision', {
    title: 'Record an explicit substantive question', description: 'ARC/FMN/DEV can add questions scoped to an active-intent artifact/hash. No MCP tool resolves a Director decision.',
    inputSchema: { ...targetFields, question: z.string().min(1), ...writeFields }, annotations,
  }, async args => respondControlWrite({
    tool: 'sigma_add_decision', operationId: 'decisions_add', idempotencyKey: args.idempotency_key,
    argumentsForHash: { type: args.type, version: args.version, hash: args.expected_artifact_sha256, question: args.question },
    allowedRoles: ['ARC', 'FMN', 'DEV'], checkPreconditions: staleStateCheck(args.expected_state_revision), transactionFiles: f08TransactionFiles,
  }, (root, role) => addQuestion(root, args.type, args.version, args.question, args.expected_artifact_sha256, role)));
  server.registerTool('sigma_record_readiness', {
    title: 'Record advisory FMN readiness assessment', description: 'FMN only, tied to current PLAN and INTENT hashes. Never modifies gates or substitutes for Director approval.',
    inputSchema: { version: z.string().min(1), status: z.enum(['READY', 'SCOPE_GAP', 'PENDING_ALIGNMENT', 'UNKNOWN']),
      reason: z.string().min(1), expected_artifact_sha256: z.string().min(1), expected_source_sha256: z.string().min(1), ...writeFields }, annotations,
  }, async args => respondControlWrite({
    tool: 'sigma_record_readiness', operationId: 'decisions_assess', idempotencyKey: args.idempotency_key,
    argumentsForHash: { version: args.version, status: args.status, reason: args.reason, hash: args.expected_artifact_sha256, source_hash: args.expected_source_sha256 },
    allowedRoles: ['FMN'], checkPreconditions: staleStateCheck(args.expected_state_revision), transactionFiles: f08TransactionFiles,
  }, (root, role) => recordReadiness(root, args.version, args.status, args.reason, args.expected_artifact_sha256, args.expected_source_sha256, role)));
}
