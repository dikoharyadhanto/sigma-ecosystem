// sigma_intent_amendment_preview — query-plane equivalent of `sigma intent
// amendment preview`. A review package for an amendment: Git baseline check,
// diff against the baseline commit, the file hash the Director would approve,
// and the impact on PLAN/EXEC. It creates no amendment and no tag; recording
// is `sigma_prepare_intent_amendment` / `sigma_commit_intent_amendment`.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listChainVersions } from '../../engine/chain';
import { previewIntentAmendment } from '../../engine/intentGit';
import { respond } from '../contract';
import { noProject, SOURCE_ENGINE } from '../shared';
import { serializeGitReport } from './intentGitReport';
import { asPrecondition, boundText, chainArg, resolveChainTarget, scrubHostPaths } from './queryHelpers';

export function computeIntentAmendmentPreview(root: string | null, chain?: string): unknown {
  if (!root) return noProject();
  if (listChainVersions(root).length === 0) return noProject();
  try {
    const { chainVersion, data } = resolveChainTarget(root, chain);
    const preview = previewIntentAmendment(root, chainVersion, data);
    const patch = boundText(preview.diff.patch);
    return {
      active_chain: chainVersion,
      mode: preview.mode,
      report: serializeGitReport(preview.report, root),
      doc_sha256_to_approve: preview.report.working_sha256,
      next_amendment_id: preview.next_amendment_id,
      next_tag: preview.next_tag,
      impact: preview.impact,
      diff: {
        stat: scrubHostPaths(preview.diff.stat, [root, preview.report.repo_root]),
        patch: patch.text,
        patch_truncated: patch.truncated,
        patch_sha256: preview.diff_sha256,
        note: 'Mechanical evidence, not a semantic judgment.',
      },
      source: SOURCE_ENGINE,
    };
  } catch (e) {
    return asPrecondition(e, [root]);
  }
}

export function registerIntentAmendmentPreviewTool(server: McpServer): void {
  server.registerTool(
    'sigma_intent_amendment_preview',
    {
      title: 'Preview an INTENT amendment',
      description:
        'Build the read-only review package for an INTENT amendment — the query-plane equivalent of ' +
        '`sigma intent amendment preview`: Git baseline check, diff against the baseline, the INTENT file hash to ' +
        'approve, and the impact on PLAN and EXEC. Creates no amendment, ticket, or tag. mode is "git" (baseline ' +
        'is a commit + tag; the commit is supplied at commit time) or "snapshot" (baseline is a local copy under ' +
        'Sigma/revisions/; no commit is used). Returns { active_chain, mode, ' +
        'report, doc_sha256_to_approve, next_amendment_id, next_tag, impact, diff{stat,patch,patch_truncated,' +
        'patch_sha256}, source }. report.ok:false is a finding, not an error; the patch is cut at 64 KiB and ' +
        'flagged by patch_truncated.',
      inputSchema: { chain: chainArg },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => respond('sigma_intent_amendment_preview', undefined, (root) => computeIntentAmendmentPreview(root, args.chain)),
  );
}
