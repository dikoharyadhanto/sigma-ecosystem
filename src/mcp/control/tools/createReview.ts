// sigma_create_review — control-plane equivalent of `sigma review new`
// (PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY WP-MCP-04).
//
// Single step: a PRODUCT REVIEW is one file with no chain state and no
// ticket. ARC only, as `review new` is operated by ARC after the Director
// states the product is ready and FMN's review request has arrived. Neither
// of those two human facts can be verified here, exactly as with the CLI; the
// tool enforces what the CLI enforces (RATIFIED INTENT, one review per INTENT)
// and nothing weaker.
//
// It never records a verdict. Verdicts are written into the document by ARC,
// AUD, and the Director themselves.
//
// Its transaction lists exactly one file, the review itself. The file name is
// derived from the chain version, never from the caller.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createReviewDraft, resolveReviewNewTarget, reviewNewTransactionFiles, ReviewNewError } from '../../../services/reviewNewService';
import { ERROR_CODES } from '../../contract';
import { McpQueryError } from '../../errors';
import { scrubHostPaths } from '../../tools/queryHelpers';
import { respondControlWrite, staleStateCheck } from '../shared';

function refusal(root: string, e: unknown): never {
  if (e instanceof ReviewNewError) {
    throw new McpQueryError(e.code === 'GATE_BLOCKED' ? ERROR_CODES.GATE_BLOCKED : ERROR_CODES.INVALID_OPERATION, scrubHostPaths(e.message, [root]));
  }
  if (e instanceof McpQueryError) throw e;
  // Missing chain, malformed tracker, invalid numbering: CLI prints these as is.
  throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, scrubHostPaths(e instanceof Error ? e.message : String(e), [root]));
}

export function registerCreateReviewTool(server: McpServer): void {
  server.registerTool(
    'sigma_create_review',
    {
      title: 'Create the PRODUCT REVIEW',
      description:
        'Creates the PRODUCT REVIEW (Sigma/review/PRODUCT-REVIEW-vN.md) for the active chain from the template — ' +
        'the MCP control-plane equivalent of `sigma review new`. ARC role only. Requires a RATIFIED INTENT; one ' +
        'review is kept per INTENT, a second call is refused. Records no verdict: ARC, AUD, and the Director write ' +
        'theirs into the document. Writes one file and changes no chain state. Requires idempotency_key and ' +
        'expected_state_revision (from a prior sigma_get_state call on this binding). Returns { chain, path, ' +
        'validation: { ok, errors, warnings } }. Whether a CLOSE may follow is sigma_close_check.',
      inputSchema: {
        idempotency_key: z.string().min(1),
        expected_state_revision: z.string().min(1),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: { idempotency_key: string; expected_state_revision: string }) => {
      const stale = staleStateCheck(args.expected_state_revision);
      return respondControlWrite(
        {
          tool: 'sigma_create_review',
          operationId: 'review_new',
          idempotencyKey: args.idempotency_key,
          argumentsForHash: {},
          allowedRoles: ['ARC'],
          checkPreconditions: (root) => {
            stale(root);
            // Refuse before a journal exists, so a refusal leaves nothing behind.
            try { resolveReviewNewTarget(root); } catch (e) { refusal(root, e); }
          },
          transactionFiles: (root) => reviewNewTransactionFiles(root),
          guardedWrites: true,
        },
        (root) => {
          try {
            const result = createReviewDraft(root);
            return {
              chain: result.chainVersion,
              path: result.relPath,
              validation: {
                ok: result.docReport.ok,
                errors: result.docReport.errors,
                warnings: result.docReport.warnings,
              },
            };
          } catch (e) {
            return refusal(root, e);
          }
        },
      );
    },
  );
}
