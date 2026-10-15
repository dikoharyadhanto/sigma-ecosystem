// sigma_intent_baseline_check — query-plane equivalent of `sigma intent
// baseline check`. Verifies that the INTENT in Git is the latest certified
// content. Adopting a baseline (`baseline adopt`, which creates a tag) stays
// CLI-only and Director-confirmed.
//
// Git is driven through the shared adapter (src/engine/gitRepo.ts) which runs
// with GIT_OPTIONAL_LOCKS=0 and never stages, commits, fetches, or tags here.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listChainVersions } from '../../engine/chain';
import { inspectIntentGit, intentGitDrift } from '../../engine/intentGit';
import { respond } from '../contract';
import { noProject, SOURCE_ENGINE } from '../shared';
import { serializeGitReport } from './intentGitReport';
import { asPrecondition, chainArg, resolveChainTarget, scrubHostPaths } from './queryHelpers';

export function computeIntentBaselineCheck(root: string | null, chain?: string): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();
  try {
    const { chainVersion, data } = resolveChainTarget(root, chain);
    const report = inspectIntentGit(root, chainVersion, data, 'clean');
    const drift = intentGitDrift(root, chainVersion, data).map((d) => scrubHostPaths(d, [root, report.repo_root]));
    return {
      active_chain: chainVersion,
      ...serializeGitReport(report, root),
      drift,
      source: SOURCE_ENGINE,
    };
  } catch (e) {
    return asPrecondition(e, [root]);
  }
}

export function registerIntentBaselineCheckTool(server: McpServer): void {
  server.registerTool(
    'sigma_intent_baseline_check',
    {
      title: 'Check the INTENT Git baseline',
      description:
        'Verify that the INTENT in Git is the latest certified content — the query-plane equivalent of ' +
        '`sigma intent baseline check`. Run before editing an amendment. Read-only: reads Git, never stages, ' +
        'commits, fetches, or tags, and does not adopt a baseline. Returns { active_chain, chain, file, repo_path, ' +
        'ok, checks[{id,ok,blocking,detail}], blockers, baseline, revision, certified_sha256, working_sha256, ' +
        'working_sha256_lf, drift[], source }. ok:false is a finding, not an error; host paths are masked.',
      inputSchema: { chain: chainArg },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => respond('sigma_intent_baseline_check', undefined, (root) => computeIntentBaselineCheck(root, args.chain)),
  );
}
