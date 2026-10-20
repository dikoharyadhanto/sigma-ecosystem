"use strict";
// sigma_intent_amendment_preview — query-plane equivalent of `sigma intent
// amendment preview`. A review package for an amendment: Git baseline check,
// diff against the baseline commit, the file hash the Director would approve,
// and the impact on PLAN/EXEC. It creates no amendment and no tag; recording
// is `sigma_prepare_intent_amendment` / `sigma_commit_intent_amendment`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeIntentAmendmentPreview = computeIntentAmendmentPreview;
exports.registerIntentAmendmentPreviewTool = registerIntentAmendmentPreviewTool;
const chain_1 = require("../../engine/chain");
const intentGit_1 = require("../../engine/intentGit");
const contract_1 = require("../contract");
const shared_1 = require("../shared");
const intentGitReport_1 = require("./intentGitReport");
const queryHelpers_1 = require("./queryHelpers");
function computeIntentAmendmentPreview(root, chain) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    try {
        const { chainVersion, data } = (0, queryHelpers_1.resolveChainTarget)(root, chain);
        const preview = (0, intentGit_1.previewIntentAmendment)(root, chainVersion, data);
        const patch = (0, queryHelpers_1.boundText)(preview.diff.patch);
        return {
            active_chain: chainVersion,
            mode: preview.mode,
            report: (0, intentGitReport_1.serializeGitReport)(preview.report, root),
            doc_sha256_to_approve: preview.report.working_sha256,
            next_amendment_id: preview.next_amendment_id,
            next_tag: preview.next_tag,
            impact: preview.impact,
            diff: {
                stat: (0, queryHelpers_1.scrubHostPaths)(preview.diff.stat, [root, preview.report.repo_root]),
                patch: patch.text,
                patch_truncated: patch.truncated,
                patch_sha256: preview.diff_sha256,
                note: 'Mechanical evidence, not a semantic judgment.',
            },
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch (e) {
        return (0, queryHelpers_1.asPrecondition)(e, [root]);
    }
}
function registerIntentAmendmentPreviewTool(server) {
    server.registerTool('sigma_intent_amendment_preview', {
        title: 'Preview an INTENT amendment',
        description: 'Build the read-only review package for an INTENT amendment — the query-plane equivalent of ' +
            '`sigma intent amendment preview`: Git baseline check, diff against the baseline, the INTENT file hash to ' +
            'approve, and the impact on PLAN and EXEC. Creates no amendment, ticket, or tag. mode is "git" (baseline ' +
            'is a commit + tag; the commit is supplied at commit time) or "snapshot" (baseline is a local copy under ' +
            'Sigma/revisions/; no commit is used). Returns { active_chain, mode, ' +
            'report, doc_sha256_to_approve, next_amendment_id, next_tag, impact, diff{stat,patch,patch_truncated,' +
            'patch_sha256}, source }. report.ok:false is a finding, not an error; the patch is cut at 64 KiB and ' +
            'flagged by patch_truncated.',
        inputSchema: { chain: queryHelpers_1.chainArg },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_intent_amendment_preview', undefined, (root) => computeIntentAmendmentPreview(root, args.chain)));
}
//# sourceMappingURL=intentAmendmentPreview.js.map