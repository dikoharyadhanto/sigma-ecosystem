import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { approvalReview, ensureApprovalReady, approveArtifactUseCase, approveArtifactTransactionFiles, ApprovalDomain } from '../../../services/approvalService';
import { generateId, writeTicket, readTicket, ticketPath, approvalPath, markTicketConsumed, markApprovalConsumed, OperationTicket, TICKET_TTL_MS, controlTestFailpoint } from '../../../engine/controlStore';
import { validateDirectorTicket } from '../../../engine/revisions';
import { computeStateRevision, ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { getBinding } from '../../shared';
import { respondControlWrite, stableHash } from '../shared';
function readyReview(root: string, domain: ApprovalDomain, version?: string) {
    try {
        const review = approvalReview(root, domain, version);
        ensureApprovalReady(review);
        return review;
    }
    catch (e) {
        throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, (e as Error).message.split(root).join('.'));
    }
}
export function registerArtifactApprovalTools(server: McpServer, domain: ApprovalDomain): void {
    const role = domain === 'plan' ? 'FMN' : 'DEV';
    const prepare = 'sigma_prepare_' + domain + '_approve';
    const commit = 'sigma_commit_' + domain + '_approve';
    server.registerTool(prepare, { title: 'Prepare ' + domain + ' approval', description: 'Freeze artifact, lifecycle, source revisions, full document hashes, ledger/notice and delta review package. Trusted local Director approval required; role ' + role + '.', inputSchema: { version: z.string().min(1).optional(), idempotency_key: z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (args: {
        version?: string;
        idempotency_key: string;
    }) => {
        const id = generateId('opt');
        return respondControlWrite({ tool: prepare, operationId: domain + '_approve_prepare', guardedWrites: true, idempotencyKey: args.idempotency_key, argumentsForHash: { version: args.version ?? null }, allowedRoles: [role], checkPreconditions: () => { }, transactionFiles: root => [ticketPath(root, id)] }, root => {
            const review = readyReview(root, domain, args.version);
            const binding = getBinding();
            const now = new Date();
            const ticket: OperationTicket = { operation_ticket_id: id, operation_id: domain + '_approve', project_id: binding.projectId!, bound_role: role, arguments_hash: stableHash({ version: review.version, review }), target: { artifact: domain, version: review.version, sha256: review.target_sha256 }, expected_state_revision: computeStateRevision(root).revision!, effects: review.effects, authority: 'director', issued_at: now.toISOString(), expires_at: new Date(now.getTime() + TICKET_TTL_MS).toISOString(), consumed_at: null, review_package: review, dependencies_sha256: review.dependencies_sha256 };
            writeTicket(root, ticket);
            return ticket;
        });
    });
    server.registerTool(commit, { title: 'Commit ' + domain + ' approval', description: 'Consume the exact trusted local Director approval after rechecking all frozen dependencies under the shared lease. EXEC approval locks its same-number PLAN/EXEC together.', inputSchema: { operation_ticket_id: z.string().min(1), approval_id: z.string().min(1), idempotency_key: z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (args: {
        operation_ticket_id: string;
        approval_id: string;
        idempotency_key: string;
    }) => {
        let version = '';
        let dependencies = '';
        return respondControlWrite({ tool: commit, operationId: domain + '_approve_commit', guardedWrites: true, idempotencyKey: args.idempotency_key, argumentsForHash: { operation_ticket_id: args.operation_ticket_id, approval_id: args.approval_id }, allowedRoles: [role], operationTicketId: args.operation_ticket_id, approvalId: args.approval_id,
            transactionFiles: root => [...approveArtifactTransactionFiles(root, domain, version), ticketPath(root, args.operation_ticket_id), approvalPath(root, args.approval_id)],
            checkPreconditions: root => {
                const ticket = readTicket(root, args.operation_ticket_id);
                if (!ticket?.target || ticket.operation_id !== domain + '_approve' || ticket.target.artifact !== domain || ticket.bound_role !== role)
                    throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'Approval ticket operation/role/target mismatch; lock tickets are tombstones.');
                version = ticket.target.version;
                const review = readyReview(root, domain, version);
                dependencies = review.dependencies_sha256;
                if (ticket.target.sha256 !== review.target_sha256 || ticket.dependencies_sha256 !== dependencies)
                    throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, 'Approval artifact/source/dependencies changed; prepare a new ticket.');
                try {
                    validateDirectorTicket(root, args.operation_ticket_id, args.approval_id, domain + '_approve', version, review.target_sha256, dependencies);
                }
                catch (e) {
                    const message=(e as Error).message;
                    throw new McpQueryError(message.startsWith('APPROVAL_MISMATCH')?ERROR_CODES.APPROVAL_MISMATCH:ERROR_CODES.STALE_STATE,message);
                }
            } }, root => {
            if (approvalReview(root, domain, version).dependencies_sha256 !== dependencies)
                throw new McpQueryError(ERROR_CODES.STALE_ARTIFACT, 'Dependencies changed immediately before approval.');
            const result = approveArtifactUseCase(root, domain, version, { channel: 'mcp-control', ticket_id: args.operation_ticket_id, approval_id: args.approval_id });
            const time = new Date().toISOString();
            markTicketConsumed(root, args.operation_ticket_id, time);
            controlTestFailpoint('approval_after_ticket_consumed');
            markApprovalConsumed(root, args.approval_id, time);
            controlTestFailpoint('approval_after_approval_consumed');
            return { ...result, operation_ticket_id: args.operation_ticket_id, approval_id: args.approval_id };
        });
    });
}
