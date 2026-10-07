import { ChainState, hasCleanGate2Chain, hasCleanGate3Chain } from './chain';
import { resolveLifecycleModel, lifecycleWarnings } from './lifecycle';
import { assertPlanCertified, assertAllNotices } from './revisions';
import { approvalReview } from '../services/approvalService';
export function effectiveLifecycleGates(root: string, chain: ChainState) {
    const model = resolveLifecycleModel(chain);
    if (model === 'legacy_lock')
        return { ...chain.gates };
    if (model === 'unknown')
        return { ...chain.gates, gate_2_open: false, gate_3_satisfied: false };
    const verified = (version: string, requireIntent: boolean) => { try {
        assertAllNotices(root, assertPlanCertified(root, chain, version, requireIntent));
        return true;
    }
    catch {
        return false;
    } };
    return { ...chain.gates, gate_2_open: hasCleanGate2Chain(chain) && chain.plan.versions.some(p => p.state === 'APPROVED' && verified(p.version, true)),
        gate_3_satisfied: hasCleanGate3Chain(chain) && chain.plan.versions.filter(p => p.state === 'LOCKED' && !p.historical_legacy).every(p => verified(p.version, false)) };
}
export function lifecycleView(root: string, chain: ChainState) {
    const model = resolveLifecycleModel(chain);
    const plans = chain.plan.versions.map(plan => {
        const blockers: string[] = [];
        if (model === 'paired_approval' && plan.state !== 'DRAFT' && plan.state !== 'SUPERSEDED' && !plan.historical_legacy) {
            try {
                const ledger = assertPlanCertified(root, chain, plan.version, plan.state !== 'LOCKED');
                assertAllNotices(root, ledger);
            }
            catch (e) {
                blockers.push((e as Error).message.split(root).join('.'));
            }
        }
        if (plan.state === 'APPROVED' && !plan.revision)
            blockers.push('Imported baseline approval required (--v explicit).');
        return { version: plan.version, state: plan.state, revision: plan.revision ?? null, contract_sha256: plan.contract_sha256 ?? null, intent_revision_ref: plan.intent_revision_ref ?? null, needs_intent_review: plan.needs_intent_review ?? false, pending_notice: plan.pending_notice ?? false, historical_legacy: plan.historical_legacy ?? false, blockers };
    });
    const execs = chain.exec.versions.map(exec => {
        let blockers: string[] = [];
        if (exec.state === 'DRAFT') {
            try {
                blockers = approvalReview(root, 'exec', exec.version).blockers;
            }
            catch (e) {
                blockers = [(e as Error).message.split(root).join('.')];
            }
        }
        return { version: exec.version, state: exec.state, plan: exec.plan_version_ref ?? null, plan_revision_ref: exec.plan_revision_ref ?? null, plan_contract_sha256_ref: exec.plan_contract_sha256_ref ?? null, acknowledged_at: exec.acknowledged_at ?? null, blockers };
    });
    return { lifecycle_model: model, effective_gates: effectiveLifecycleGates(root, chain), lifecycle_warnings: lifecycleWarnings(chain), plans, execs, approval_blockers: [...plans.flatMap(p => p.blockers.map(b => 'PLAN ' + p.version + ': ' + b)), ...execs.flatMap(e => e.blockers.map(b => 'EXEC ' + e.version + ': ' + b))] };
}
