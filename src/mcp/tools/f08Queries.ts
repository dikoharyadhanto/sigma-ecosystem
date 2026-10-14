import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { respond } from '../contract';
import { noProject } from '../shared';
import { previewClone } from '../../services/cloneDraftService';
import { auditPackStatus, listDecisions } from '../../services/auditDecisionService';
export const cloneShape = {
  type: z.enum(['intent', 'plan']), source_chain: z.string().regex(/^v\d+$/),
  source_version: z.string().regex(/^v\d+(?:\.\d+)?$/), title: z.string().min(1), focus: z.string().min(1),
  allow_reopen_closed: z.boolean().optional(),
};
export function registerF08QueryTools(server: McpServer): void {
  server.registerTool('sigma_preview_clone', {
    title: 'Preview a draft from a registered source', inputSchema: cloneShape,
    description: 'Read-only clone preview with reset sections, diff, activation effects and a token binding source, template and target state. Supports INTENT 5 and PLAN 3.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async args => respond('sigma_preview_clone', undefined, root => root ? previewClone({
    projectRoot: root, type: args.type, sourceChain: args.source_chain, sourceVersion: args.source_version,
    title: args.title, focus: args.focus, allowReopenClosed: args.allow_reopen_closed,
  }) : noProject()));
  server.registerTool('sigma_get_audit_pack', {
    title: 'Read an audit snapshot and detect stale sources', inputSchema: { id: z.string().min(1) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async args => respond('sigma_get_audit_pack', undefined, root => root ? auditPackStatus(root, args.id) : noProject()));
  server.registerTool('sigma_list_decisions', {
    title: 'List substantive questions and control tickets separately',
    inputSchema: { chain: z.string().regex(/^v\d+$/).optional(), history: z.boolean().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async args => respond('sigma_list_decisions', undefined, root => root ? listDecisions(root, args.chain, args.history) : noProject()));
}
