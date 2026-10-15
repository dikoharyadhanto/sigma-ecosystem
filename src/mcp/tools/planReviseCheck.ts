// sigma_plan_revise_check — the evaluation half of `sigma plan revise check`.
//
// Evaluates a staged revision of an APPROVED PLAN: baseline identity, contract
// diff, declared checkpoint/loosening, and whether early Director approval is
// required. It writes nothing. The CLI's `--prepare-ticket` flag (now also the
// separate `sigma plan revise ticket`) is the ticket-issuing half and is NOT
// exposed here; it belongs to the control plane (Phase 3).
//
// checkPlanRevision() is the same function the CLI calls, and commit calls it
// again, so this answer and the commit-time check cannot disagree.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listChainVersions } from '../../engine/chain';
import { checkPlanRevision } from '../../engine/revisions';
import { respond } from '../contract';
import { noProject, SOURCE_ENGINE } from '../shared';
import { asPrecondition, scrubDeep } from './queryHelpers';

export function computePlanReviseCheck(root: string | null, version: string): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();
  try {
    const review = checkPlanRevision(root, version);
    return { ...scrubDeep(review, [root]), source: SOURCE_ENGINE };
  } catch (e) {
    return asPrecondition(e, [root]);
  }
}

export function registerPlanReviseCheckTool(server: McpServer): void {
  server.registerTool(
    'sigma_plan_revise_check',
    {
      title: 'Evaluate a staged PLAN revision',
      description:
        'Evaluate the staged revision of an APPROVED PLAN `version` in the active chain — the evaluation half of ' +
        '`sigma plan revise check`. Read-only: creates no ticket, certifies nothing, and changes no PLAN, ledger, or ' +
        'chain state. Returns the review { version, next_revision, candidate, candidate_sha256, contract_sha256, ' +
        'intent, stage, diff, early_approval_required, dependencies_sha256, ... , source }. Fails with ' +
        'INVALID_OPERATION when the PLAN is not APPROVED, nothing is staged, or the staging baseline is stale. ' +
        'Issuing a Director approval ticket is a separate control-plane step.',
      inputSchema: { version: z.string().regex(/^v\d+(?:\.\d+)?$/) },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => respond('sigma_plan_revise_check', undefined, (root) => computePlanReviseCheck(root, args.version)),
  );
}
