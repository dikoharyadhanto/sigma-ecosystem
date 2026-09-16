// PLAN-IMPL-SIGMA-MCP-QUERY-COMMAND-PLANE §9.2, Stage E W1 — sigma_record_evidence.
// Control-plane only, no CLI equivalent — see recordEvidence.ts's header.
// DEV role only, matching §6.2's "DEV: ... create/update exec/evidence".

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { recordEvidence, recordEvidenceTransactionFiles } from '../recordEvidence';
import { respondControlWrite, staleStateCheck } from '../shared';

export function registerRecordEvidenceTool(server: McpServer): void {
  server.registerTool(
    'sigma_record_evidence',
    {
      title: 'Record structured evidence for a DEV-EXEC version',
      description:
        'Appends a structured evidence citation (description + a project-relative file reference, hashed ' +
        'server-side) to a DEV-EXEC version — DEV role only. ref_path must resolve inside the project root ' +
        '(no arbitrary host path); the server reads and hashes it, it never trusts a caller-supplied hash. ' +
        'Targets the active DEV-EXEC by default, or a specific version via exec_version. Requires ' +
        'idempotency_key and expected_state_revision (from a prior sigma_get_state call on this binding).',
      inputSchema: {
        exec_version: z
          .string()
          .regex(/^v\d+\.\d+$/, 'Expected an exec version like "v1.1".')
          .optional()
          .describe('Which DEV-EXEC to attach evidence to. Optional when there is an active DEV-EXEC.'),
        description: z.string().min(1),
        ref_path: z.string().min(1).describe('Path to the evidence file, relative to the project root.'),
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
      exec_version?: string;
      description: string;
      ref_path: string;
      idempotency_key: string;
      expected_state_revision: string;
    }) =>
      respondControlWrite(
        {
          tool: 'sigma_record_evidence',
          operationId: 'record_evidence',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {
            exec_version: args.exec_version ?? null,
            description: args.description,
            ref_path: args.ref_path,
          },
          allowedRoles: ['DEV'],
          checkPreconditions: staleStateCheck(args.expected_state_revision),
          transactionFiles: recordEvidenceTransactionFiles,
        },
        (root, role) =>
          recordEvidence({
            projectRoot: root,
            execVersion: args.exec_version,
            description: args.description,
            refPath: args.ref_path,
            actorRole: role,
          })
      )
  );
}
