"use strict";
// Stage B2 — sigma_get_config. Query-plane equivalent of `sigma config
// show`. ProjectConfig (src/engine/projectConfig.ts) carries no credential
// field at all; notion.parent_page_id/database_id exist on the type but the
// CLI itself never prints them, so this tool doesn't either — same surface
// as the CLI, nothing added.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGetConfig = computeGetConfig;
exports.registerGetConfigTool = registerGetConfigTool;
const zod_1 = require("zod");
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
        notion_humanize_gate_enabled: config.notion_humanize_gate?.enabled ?? false,
        mailbox_auto_outdate_keep: (0, projectConfig_1.resolveAutoOutdateKeep)(config),
        memo_unread_limit: (0, projectConfig_1.resolveMemoLimit)(config),
        source: shared_1.SOURCE_ENGINE,
    };
}
function registerGetConfigTool(server) {
    server.registerTool('sigma_get_config', {
        title: 'Get Sigma project configuration',
        description: 'Return the project\'s language and mailbox/gate configuration — the query-plane equivalent of `sigma ' +
            'config show`. No credentials or Notion page/database identifiers are included (the CLI itself does not ' +
            'print them either). Read-only. Returns { active, interaction_language, document_language, ' +
            'output_document_language, notion_humanize_gate_enabled, mailbox_auto_outdate_keep, memo_unread_limit, ' +
            'source }.',
        inputSchema: {
            project_root: zod_1.z.string().optional().describe('Optional absolute path to the Sigma project root directory.'),
        },
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    }, async ({ project_root }) => (0, contract_1.respond)('sigma_get_config', project_root, (root) => computeGetConfig(root)));
}
//# sourceMappingURL=getConfig.js.map