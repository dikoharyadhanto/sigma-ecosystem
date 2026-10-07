"use strict";
// Stage B2 — sigma_get_config. Query-plane equivalent of `sigma config
// show`. ProjectConfig (src/engine/projectConfig.ts) carries no credential
// field at all — same surface as the CLI, nothing added.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGetConfig = computeGetConfig;
exports.registerGetConfigTool = registerGetConfigTool;
const projectConfig_1 = require("../../engine/projectConfig");
const shared_1 = require("../shared");
const contract_1 = require("../contract");
function computeGetConfig(root) {
    if (!root)
        return { active: false, source: shared_1.SOURCE_ENGINE };
    const config = (0, projectConfig_1.readProjectConfig)(root);
    return {
        active: true,
        interaction_language: config.interaction_language,
        document_language: config.document_language,
        output_document_language: config.output_document_language,
        mailbox_auto_outdate_keep: (0, projectConfig_1.resolveAutoOutdateKeep)(config),
        memo_unread_limit: (0, projectConfig_1.resolveMemoLimit)(config),
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerGetConfigTool(server) {
    server.registerTool('sigma_get_config', {
        title: 'Get Sigma project configuration',
        description: 'Return the project\'s language and mailbox configuration — the query-plane equivalent of `sigma ' +
            'config show`. No credentials are included (the CLI itself does not print them either). Read-only. ' +
            'Returns { active, interaction_language, document_language, output_document_language, ' +
            'mailbox_auto_outdate_keep, memo_unread_limit, source }.',
        inputSchema: {},
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async () => (0, contract_1.respond)('sigma_get_config', undefined, (root) => computeGetConfig(root)));
}
//# sourceMappingURL=getConfig.js.map