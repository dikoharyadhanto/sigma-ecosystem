"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneShape = void 0;
exports.registerF08QueryTools = registerF08QueryTools;
const zod_1 = require("zod");
const contract_1 = require("../contract");
const shared_1 = require("../shared");
const cloneDraftService_1 = require("../../services/cloneDraftService");
const auditDecisionService_1 = require("../../services/auditDecisionService");
exports.cloneShape = {
    type: zod_1.z.enum(['intent', 'plan']), source_chain: zod_1.z.string().regex(/^v\d+$/),
    source_version: zod_1.z.string().regex(/^v\d+(?:\.\d+)?$/), title: zod_1.z.string().min(1), focus: zod_1.z.string().min(1),
    allow_reopen_closed: zod_1.z.boolean().optional(),
};
function registerF08QueryTools(server) {
    server.registerTool('sigma_preview_clone', {
        title: 'Preview a draft from a registered source', inputSchema: exports.cloneShape,
        description: 'Read-only clone preview with reset sections, diff, activation effects and a token binding source, template and target state. Supports INTENT 5 and PLAN 3.',
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_preview_clone', undefined, root => root ? (0, cloneDraftService_1.previewClone)({
        projectRoot: root, type: args.type, sourceChain: args.source_chain, sourceVersion: args.source_version,
        title: args.title, focus: args.focus, allowReopenClosed: args.allow_reopen_closed,
    }) : (0, shared_1.noProject)()));
    server.registerTool('sigma_get_audit_pack', {
        title: 'Read an audit snapshot and detect stale sources', inputSchema: { id: zod_1.z.string().min(1) },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_get_audit_pack', undefined, root => root ? (0, auditDecisionService_1.auditPackStatus)(root, args.id) : (0, shared_1.noProject)()));
    server.registerTool('sigma_list_decisions', {
        title: 'List substantive questions and control tickets separately',
        inputSchema: { chain: zod_1.z.string().regex(/^v\d+$/).optional(), history: zod_1.z.boolean().optional() },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_list_decisions', undefined, root => root ? (0, auditDecisionService_1.listDecisions)(root, args.chain, args.history) : (0, shared_1.noProject)()));
}
//# sourceMappingURL=f08Queries.js.map