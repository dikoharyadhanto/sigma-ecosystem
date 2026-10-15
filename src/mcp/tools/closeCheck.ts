// sigma_close_check — query-plane equivalent of `sigma close check`.
//
// Answers "may a CLOSE be created now?" BEFORE one exists: Gate 3, then that
// the PRODUCT REVIEW exists, then that its required verdicts are PASS or
// PASS_WITH_RISK. It is deliberately NOT sigma_check_document(type=close),
// which validates the structure of a CLOSE document that already exists. The
// answer here follows the gate and the review, never the presence of a CLOSE
// file (PLAN-IMPL-SIGMA-MCP-COVERAGE-POLICY-PARITY AC-MCP-07).
//
// It calls the same assessCloseNewEligibility that `close check`, the
// prepare step, and `close new` use, so the four can never disagree.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listChainVersions } from '../../engine/chain';
import { assessCloseNewEligibility } from '../../services/closeNewService';
import { respond } from '../contract';
import { noProject, SOURCE_ENGINE } from '../shared';
import { asPrecondition, chainArg, resolveChainTarget } from './queryHelpers';

export function computeCloseCheck(root: string | null, chain?: string): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();
  try {
    const { chainVersion, data } = resolveChainTarget(root, chain);
    const result = assessCloseNewEligibility(data, root);
    const risks = result.review?.riskNotes ?? [];
    return {
      active_chain: chainVersion,
      eligible: result.eligible,
      closure_readiness: !result.eligible ? 'not_eligible' : risks.length > 0 ? 'eligible_with_pass_with_risk' : 'eligible',
      gate_3_satisfied: result.gate3Satisfied,
      product_review: {
        file: result.reviewFile,
        verdicts: result.review
          ? { arc: result.review.arc, aud: result.review.audSkipped ? 'SKIP_FOR_AUDIT' : result.review.aud, director: result.review.director }
          : null,
        accepted: result.review?.accepted ?? false,
      },
      blockers: result.blockers,
      risk_notes: risks,
      source: SOURCE_ENGINE,
    };
  } catch (e) {
    return asPrecondition(e, [root]);
  }
}

export function registerCloseCheckTool(server: McpServer): void {
  server.registerTool(
    'sigma_close_check',
    {
      title: 'Check whether a CLOSE can be created',
      description:
        'Evaluate Gate 3 and the PRODUCT REVIEW verdicts for the active chain (or `chain`) before a DIR-CLOSE exists — ' +
        'the query-plane equivalent of `sigma close check`. Read-only; creates nothing and issues no ticket. ' +
        'NOT sigma_check_document(type=close), which validates an existing CLOSE document. ' +
        'Returns { active_chain, eligible, closure_readiness (not_eligible | eligible | eligible_with_pass_with_risk), ' +
        'gate_3_satisfied, product_review { file, verdicts, accepted }, blockers[{code,message}], risk_notes, source }. ' +
        'Reaching a CLOSE still needs the sigma_prepare_close_new / sigma_commit_close_new pair and a Director approval.',
      inputSchema: { chain: chainArg },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => respond('sigma_close_check', undefined, (root) => computeCloseCheck(root, args.chain)),
  );
}
