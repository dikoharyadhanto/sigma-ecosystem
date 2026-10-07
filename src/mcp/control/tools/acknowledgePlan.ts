import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readActiveChain, chainFilePath } from '../../../engine/chain';
import { acknowledgePlan } from '../../../engine/revisions';
import { ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { respondControlWrite, staleStateCheck } from '../shared';
export function registerAcknowledgePlanTool(server: McpServer): void {
    server.registerTool('sigma_acknowledge_plan', { title: 'Acknowledge current PLAN revision', description: 'DEV explicitly acknowledges the latest current PLAN revision/hash after valid CONTRACT_CHANGE notices. Grants no coding authority and never auto-acknowledges from mailbox status.', inputSchema: { version: z.string().min(1), revision: z.number().int().positive(), expected_state_revision: z.string().min(1), idempotency_key: z.string().min(1) }, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } }, async (args: {
        version: string;
        revision: number;
        expected_state_revision: string;
        idempotency_key: string;
    }) => respondControlWrite({ tool: 'sigma_acknowledge_plan', operationId: 'exec_acknowledge_plan', guardedWrites: true, idempotencyKey: args.idempotency_key, argumentsForHash: { version: args.version, revision: args.revision }, allowedRoles: ['DEV'], checkPreconditions: staleStateCheck(args.expected_state_revision), transactionFiles: root => [chainFilePath(root, readActiveChain(root).chainVersion)] }, root => { try {
        return acknowledgePlan(root, args.version, args.revision);
    }
    catch (e) {
        throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, (e as Error).message.split(root).join('.'));
    } }));
}
