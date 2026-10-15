"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCloseCheck = computeCloseCheck;
exports.registerCloseCheckTool = registerCloseCheckTool;
const chain_1 = require("../../engine/chain");
const closeNewService_1 = require("../../services/closeNewService");
const contract_1 = require("../contract");
const shared_1 = require("../shared");
const queryHelpers_1 = require("./queryHelpers");
function computeCloseCheck(root, chain) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    try {
        const { chainVersion, data } = (0, queryHelpers_1.resolveChainTarget)(root, chain);
        const result = (0, closeNewService_1.assessCloseNewEligibility)(data, root);
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
            source: shared_1.SOURCE_ENGINE,
        };
    }
    catch (e) {
        return (0, queryHelpers_1.asPrecondition)(e, [root]);
    }
}
function registerCloseCheckTool(server) {
    server.registerTool('sigma_close_check', {
        title: 'Check whether a CLOSE can be created',
        description: 'Evaluate Gate 3 and the PRODUCT REVIEW verdicts for the active chain (or `chain`) before a DIR-CLOSE exists — ' +
            'the query-plane equivalent of `sigma close check`. Read-only; creates nothing and issues no ticket. ' +
            'NOT sigma_check_document(type=close), which validates an existing CLOSE document. ' +
            'Returns { active_chain, eligible, closure_readiness (not_eligible | eligible | eligible_with_pass_with_risk), ' +
            'gate_3_satisfied, product_review { file, verdicts, accepted }, blockers[{code,message}], risk_notes, source }. ' +
            'Reaching a CLOSE still needs the sigma_prepare_close_new / sigma_commit_close_new pair and a Director approval.',
        inputSchema: { chain: queryHelpers_1.chainArg },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_close_check', undefined, (root) => computeCloseCheck(root, args.chain)));
}
//# sourceMappingURL=closeCheck.js.map