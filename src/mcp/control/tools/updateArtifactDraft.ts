// Stage C pilot — sigma_update_artifact_draft. Control-plane only. Scope
// pinned to type "intent" at the schema level (z.literal) as well as inside
// updateArtifactDraft() itself — see artifactDraftUpdate.ts's header.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { updateArtifactDraft, updateArtifactDraftTransactionFiles } from '../artifactDraftUpdate';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerUpdateArtifactDraftTool(server: McpServer): void {
  server.registerTool(
    'sigma_update_artifact_draft',
    {
      title: 'Update artifact DRAFT content',
      description:
        'Replaces the full content of a registered DRAFT artifact. Stage C pilot scope: intent only, and ' +
        'only the active chain\'s own intent version. ARC role only. Requires idempotency_key, ' +
        'expected_state_revision (from sigma_get_state), and expected_artifact_sha256 (from a prior ' +
        'sigma_read_artifact call) — a mismatch on either is rejected rather than silently overwritten.',
      inputSchema: {
        type: z.literal('intent'),
        version: z.string().min(1).describe('Must match the active chain\'s current intent version, e.g. "v1".'),
        content: z.string().describe('Full replacement content of the DRAFT file (not a diff).'),
        expected_artifact_sha256: z.string().min(1),
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: {
      type: 'intent';
      version: string;
      content: string;
      expected_artifact_sha256: string;
      idempotency_key: string;
      expected_state_revision: string;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_update_artifact_draft',
          operationId: 'artifact_draft_update',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            type: args.type,
            version: args.version,
            content: args.content,
            expected_artifact_sha256: args.expected_artifact_sha256,
          },
          allowedRoles: ['ARC'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          artifactHashBefore: args.expected_artifact_sha256,
          transactionFiles: (root) => updateArtifactDraftTransactionFiles({
            projectRoot: root,
            type: args.type,
            version: args.version,
          }),
        },
        (root) =>
          updateArtifactDraft({
            projectRoot: root,
            type: args.type,
            version: args.version,
            content: args.content,
            expectedArtifactSha256: args.expected_artifact_sha256,
          })
      )
  );
}
