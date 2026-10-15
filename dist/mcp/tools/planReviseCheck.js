"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePlanReviseCheck = computePlanReviseCheck;
exports.registerPlanReviseCheckTool = registerPlanReviseCheckTool;
const zod_1 = require("zod");
const chain_1 = require("../../engine/chain");
const revisions_1 = require("../../engine/revisions");
const contract_1 = require("../contract");
const shared_1 = require("../shared");
const queryHelpers_1 = require("./queryHelpers");
function computePlanReviseCheck(root, version) {
    if (!root)
        return (0, shared_1.noProject)();
    if ((0, chain_1.listChainVersions)(root).length === 0)
        return (0, shared_1.noProject)();
    try {
        const review = (0, revisions_1.checkPlanRevision)(root, version);
        return { ...(0, queryHelpers_1.scrubDeep)(review, [root]), source: shared_1.SOURCE_ENGINE };
    }
    catch (e) {
        return (0, queryHelpers_1.asPrecondition)(e, [root]);
    }
}
function registerPlanReviseCheckTool(server) {
    server.registerTool('sigma_plan_revise_check', {
        title: 'Evaluate a staged PLAN revision',
        description: 'Evaluate the staged revision of an APPROVED PLAN `version` in the active chain — the evaluation half of ' +
            '`sigma plan revise check`. Read-only: creates no ticket, certifies nothing, and changes no PLAN, ledger, or ' +
            'chain state. Returns the review { version, next_revision, candidate, candidate_sha256, contract_sha256, ' +
            'intent, stage, diff, early_approval_required, dependencies_sha256, ... , source }. Fails with ' +
            'INVALID_OPERATION when the PLAN is not APPROVED, nothing is staged, or the staging baseline is stale. ' +
            'Issuing a Director approval ticket is a separate control-plane step.',
        inputSchema: { version: zod_1.z.string().regex(/^v\d+(?:\.\d+)?$/) },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async (args) => (0, contract_1.respond)('sigma_plan_revise_check', undefined, (root) => computePlanReviseCheck(root, args.version)));
}
//# sourceMappingURL=planReviseCheck.js.map