import type { ChainState, ArtifactVersion } from './chain';
export type LifecycleModel = 'legacy_lock' | 'paired_approval' | 'unknown';
export function resolveLifecycleModel(chain: ChainState): LifecycleModel {
    const model = chain.lifecycle_model ?? 'legacy_lock';
    if (!['legacy_lock', 'paired_approval', 'unknown'].includes(model))
        throw new Error('Unsupported lifecycle_model: ' + model);
    return model;
}
export function assertKnownLifecycle(chain: ChainState): void {
    if (resolveLifecycleModel(chain) === 'unknown')
        throw new Error('Lifecycle approval provenance is unknown; Director recovery required.');
}
export function eligiblePlanState(chain: ChainState): string {
    assertKnownLifecycle(chain);
    return resolveLifecycleModel(chain) === 'paired_approval' ? 'APPROVED' : 'LOCKED';
}
export function approvedPlanCurrent(chain: ChainState, plan: ArtifactVersion): boolean {
    if (resolveLifecycleModel(chain) === 'unknown')
        return false;
    return plan.state === eligiblePlanState(chain) && plan.intent_version_ref === chain.intent.version &&
        (resolveLifecycleModel(chain) === 'legacy_lock' || !!plan.revision && !!plan.contract_sha256 &&
            !!plan.intent_revision_ref && plan.intent_revision_ref === chain.intent.revision &&
            plan.intent_doc_sha256_ref === chain.intent.certified_doc_sha256 && !plan.needs_intent_review && !plan.pending_notice);
}
export function lifecycleWarnings(chain: ChainState): string[] {
    const model = resolveLifecycleModel(chain);
    return model === 'unknown' ? ['Lifecycle approval provenance unknown; approval is blocked.'] :
        model === 'legacy_lock' ? ['Legacy lifecycle: revision evidence is not required; opt-in doctor --migrate-lifecycle per chain.'] : [];
}
