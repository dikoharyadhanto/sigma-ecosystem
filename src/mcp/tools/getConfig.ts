// Stage B2 — sigma_get_config. Query-plane equivalent of `sigma config
// show`. ProjectConfig (src/engine/projectConfig.ts) carries no credential
// field at all — same surface as the CLI, nothing added.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readProjectConfig, resolveAutoOutdateKeep, resolveMemoLimit } from '../../engine/projectConfig';
import { SOURCE_ENGINE } from '../shared';
import { respond } from '../contract';

export function computeGetConfig(root: string | null): unknown {
  if (!root) return { active: false, source: SOURCE_ENGINE };

  const config = readProjectConfig(root);
  return {
    active: true,
    interaction_language: config.interaction_language,
    document_language: config.document_language,
    output_document_language: config.output_document_language,
    mailbox_auto_outdate_keep: resolveAutoOutdateKeep(config),
    memo_unread_limit: resolveMemoLimit(config),
    source: SOURCE_ENGINE,
  };
}

export function registerGetConfigTool(server: McpServer): void {
  server.registerTool(
    'sigma_get_config',
    {
      title: 'Get Sigma project configuration',
      description:
        'Return the project\'s language and mailbox configuration — the query-plane equivalent of `sigma ' +
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
    },
    async () =>
      respond('sigma_get_config', undefined, (root) => computeGetConfig(root))
  );
}
