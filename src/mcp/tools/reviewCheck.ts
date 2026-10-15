// sigma_review_check — query-plane equivalent of `sigma review check`.
// Validates the chain's PRODUCT REVIEW and reports its verdict state. Read
// only: it reads the document, never creates or edits it (that is `review new`).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import { listChainVersions } from '../../engine/chain';
import { findProductReviewRel } from '../../services/closeNewService';
import { validateSigmaDocFile } from '../../utils/docCheck';
import { ERROR_CODES, respond } from '../contract';
import { McpQueryError } from '../errors';
import { noProject, SOURCE_ENGINE } from '../shared';
import { asPrecondition, chainArg, resolveChainTarget } from './queryHelpers';

export function computeReviewCheck(root: string | null, chain?: string): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();
  try {
    const { chainVersion, data } = resolveChainTarget(root, chain);
    const rel = findProductReviewRel(root, data);
    if (!rel) {
      throw new McpQueryError(ERROR_CODES.INVALID_OPERATION, 'No PRODUCT REVIEW found for this chain. It is created by `sigma review new`.');
    }
    const report = validateSigmaDocFile(path.join(root, rel), 'review');
    return {
      active_chain: chainVersion,
      ok: report.ok,
      heading: report.heading,
      // Project-relative on every binding mode. redactPath() keeps the absolute
      // path for an unbound client, which a new tool has no reason to inherit.
      file: rel,
      document_type: report.documentType,
      schema: report.schema,
      errors: report.errors,
      warnings: report.warnings,
      passes: report.passes,
      requirements: report.requirements,
      source: SOURCE_ENGINE,
    };
  } catch (e) {
    return asPrecondition(e, [root]);
  }
}

export function registerReviewCheckTool(server: McpServer): void {
  server.registerTool(
    'sigma_review_check',
    {
      title: 'Check the PRODUCT REVIEW',
      description:
        'Validate the PRODUCT REVIEW of the active chain (or `chain`) and report its structure and verdict state — ' +
        'the query-plane equivalent of `sigma review check`. Read-only: never creates or edits the review. ' +
        'Returns { active_chain, ok, heading, file, document_type, schema, errors, warnings, passes, requirements, source }. ' +
        'Fails with INVALID_OPERATION when the chain has no PRODUCT REVIEW. Whether a CLOSE may be created is ' +
        'answered by sigma_close_check, not here.',
      inputSchema: { chain: chainArg },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => respond('sigma_review_check', undefined, (root) => computeReviewCheck(root, args.chain)),
  );
}
