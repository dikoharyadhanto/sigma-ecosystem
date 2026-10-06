// Stage C pilot (intent) + Stage E W1 extension (plan/exec) —
// sigma_update_artifact_draft. Control-plane only. Scope pinned to
// intent/plan/exec at the schema level (z.enum) as well as inside
// updateArtifactDraft() itself — see artifactDraftUpdate.ts's header.
// Role is derived from `type`, not hardcoded — ARC owns intent, FMN owns
// plan, DEV owns exec (ownerRoleForArtifactType()), computed per call so it
// can never be supplied by the caller.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  updateArtifactDraft,
  updateArtifactDraftTransactionFiles,
  ownerRoleForArtifactType,
  UpdatableArtifactType,
} from '../artifactDraftUpdate';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerUpdateArtifactDraftTool(server: McpServer): void {
  server.registerTool(
    'sigma_update_artifact_draft',
    {
      title: 'Update artifact DRAFT content',
      description:
        'Replaces the full content of a registered DRAFT artifact — intent (ARC role), plan (FMN role), or ' +
        'exec (DEV role) — and only the active chain\'s own version of that type. Requires idempotency_key, ' +
        'expected_state_revision (from sigma_get_state), and expected_artifact_sha256 (from a prior ' +
        'sigma_read_artifact call) — a mismatch on either is rejected rather than silently overwritten.',
      inputSchema: {
        type: z.enum(['intent', 'plan', 'exec']),
        version: z.string().min(1).describe('Must match an existing DRAFT version of that type in the active chain, e.g. "v1" (intent) or "v0.1" (plan/exec).'),
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
      type: UpdatableArtifactType;
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
          allowedRoles: [ownerRoleForArtifactType(args.type)],
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
