"use strict";
// sigma_intent_baseline_check — query-plane equivalent of `sigma intent
// baseline check`. Verifies that the INTENT in Git is the latest certified
// content. Adopting a baseline (`baseline adopt`, which creates a tag) stays
// CLI-only and Director-confirmed.
//
// Git is driven through the shared adapter (src/engine/gitRepo.ts) which runs
// with GIT_OPTIONAL_LOCKS=0 and never stages, commits, fetches, or tags here.
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeIntentBaselineCheck = computeIntentBaselineCheck;
exports.registerIntentBaselineCheckTool = registerIntentBaselineCheckTool;
const chain_1 = require("../../engine/chain");
const intentGit_1 = require("../../engine/intentGit");
const contract_1 = require("../contract");
const shared_1 = require("../shared");
const intentGitReport_1 = require("./intentGitReport");
const queryHelpers_1 = require("./queryHelpers");
function computeIntentBaselineCheck(root, chain) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    try {
        const { chainVersion, data } = (0, queryHelpers_1.resolveChainTarget)(root, chain);
        const report = (0, intentGit_1.inspectIntentGit)(root, chainVersion, data, 'clean');
        const drift = (0, intentGit_1.intentGitDrift)(root, chainVersion, data).map((d) => (0, queryHelpers_1.scrubHostPaths)(d, [root, report.repo_root]));
        return {
            active_chain: chainVersion,
            ...(0, intentGitReport_1.serializeGitReport)(report, root),
            drift,
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch (e) {
        return (0, queryHelpers_1.asPrecondition)(e, [root]);
    }
}
function registerIntentBaselineCheckTool(server) {
    server.registerTool('sigma_intent_baseline_check', {
        title: 'Check the INTENT Git baseline',
        description: 'Verify that the INTENT in Git is the latest certified content — the query-plane equivalent of ' +
            '`sigma intent baseline check`. Run before editing an amendment. Read-only: reads Git, never stages, ' +
            'commits, fetches, or tags, and does not adopt a baseline. Returns { active_chain, chain, file, repo_path, ' +
            'ok, checks[{id,ok,blocking,detail}], blockers, baseline, revision, certified_sha256, working_sha256, ' +
            'working_sha256_lf, drift[], source }. ok:false is a finding, not an error; host paths are masked.',
        inputSchema: { chain: queryHelpers_1.chainArg },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_intent_baseline_check', undefined, (root) => computeIntentBaselineCheck(root, args.chain)));
}
//# sourceMappingURL=intentBaselineCheck.js.map