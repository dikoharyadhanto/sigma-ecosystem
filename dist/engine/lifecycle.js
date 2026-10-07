"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLifecycleModel = resolveLifecycleModel;
exports.assertKnownLifecycle = assertKnownLifecycle;
exports.eligiblePlanState = eligiblePlanState;
exports.approvedPlanCurrent = approvedPlanCurrent;
exports.lifecycleWarnings = lifecycleWarnings;
function resolveLifecycleModel(chain) {
    const model = chain.lifecycle_model ?? 'legacy_lock';
    if (!['legacy_lock', 'paired_approval', 'unknown'].includes(model))
        throw new Error('Unsupported lifecycle_model: ' + model);
    return model;
}
function assertKnownLifecycle(chain) {
    if (resolveLifecycleModel(chain) === 'unknown')
        throw new Error('Lifecycle approval provenance is unknown; Director recovery required.');
}
function eligiblePlanState(chain) {
    assertKnownLifecycle(chain);
    return resolveLifecycleModel(chain) === 'paired_approval' ? 'APPROVED' : 'LOCKED';
}
function approvedPlanCurrent(chain, plan) {
    if (resolveLifecycleModel(chain) === 'unknown')
        return false;
    return plan.state === eligiblePlanState(chain) && plan.intent_version_ref === chain.intent.version &&
        (resolveLifecycleModel(chain) === 'legacy_lock' || !!plan.revision && !!plan.contract_sha256 &&
            !!plan.intent_revision_ref && plan.intent_revision_ref === chain.intent.revision &&
            plan.intent_doc_sha256_ref === chain.intent.certified_doc_sha256 && !plan.needs_intent_review && !plan.pending_notice);
}
function lifecycleWarnings(chain) {
    const model = resolveLifecycleModel(chain);
    return model === 'unknown' ? ['Lifecycle approval provenance unknown; approval is blocked.'] :
        model === 'legacy_lock' ? ['Legacy lifecycle: revision evidence is not required; opt-in doctor --migrate-lifecycle per chain.'] : [];
}
//# sourceMappingURL=lifecycle.js.map