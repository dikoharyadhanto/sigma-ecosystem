"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectiveLifecycleGates = effectiveLifecycleGates;
exports.lifecycleView = lifecycleView;
const chain_1 = require("./chain");
const lifecycle_1 = require("./lifecycle");
const revisions_1 = require("./revisions");
const approvalService_1 = require("../services/approvalService");
function effectiveLifecycleGates(root, chain) {
    const model = (0, lifecycle_1.resolveLifecycleModel)(chain);
    if (model === 'legacy_lock')
        return { ...chain.gates };
    if (model === 'unknown')
        return { ...chain.gates, gate_2_open: false, gate_3_satisfied: false };
    const verified = (version, requireIntent) => {
        try {
            (0, revisions_1.assertAllNotices)(root, (0, revisions_1.assertPlanCertified)(root, chain, version, requireIntent));
            return true;
        }
        catch {
            return false;
        }
    };
    return { ...chain.gates, gate_2_open: (0, chain_1.hasCleanGate2Chain)(chain) && chain.plan.versions.some(p => p.state === 'APPROVED' && verified(p.version, true)),
        gate_3_satisfied: (0, chain_1.hasCleanGate3Chain)(chain) && chain.plan.versions.filter(p => p.state === 'LOCKED' && !p.historical_legacy).every(p => verified(p.version, false)) };
}
function lifecycleView(root, chain) {
    const model = (0, lifecycle_1.resolveLifecycleModel)(chain);
    const plans = chain.plan.versions.map(plan => {
        const blockers = [];
        if (model === 'paired_approval' && plan.state !== 'DRAFT' && plan.state !== 'SUPERSEDED' && !plan.historical_legacy) {
            try {
                const ledger = (0, revisions_1.assertPlanCertified)(root, chain, plan.version, plan.state !== 'LOCKED');
                (0, revisions_1.assertAllNotices)(root, ledger);
            }
            catch (e) {
                blockers.push(e.message.split(root).join('.'));
            }
        }
        if (plan.state === 'APPROVED' && !plan.revision)
            blockers.push('Imported baseline approval required (--v explicit).');
        return { version: plan.version, state: plan.state, revision: plan.revision ?? null, contract_sha256: plan.contract_sha256 ?? null, intent_revision_ref: plan.intent_revision_ref ?? null, needs_intent_review: plan.needs_intent_review ?? false, pending_notice: plan.pending_notice ?? false, historical_legacy: plan.historical_legacy ?? false, blockers };
    });
    const execs = chain.exec.versions.map(exec => {
        let blockers = [];
        if (exec.state === 'DRAFT') {
            try {
                blockers = (0, approvalService_1.approvalReview)(root, 'exec', exec.version).blockers;
            }
            catch (e) {
                blockers = [e.message.split(root).join('.')];
            }
        }
        return { version: exec.version, state: exec.state, plan: exec.plan_version_ref ?? null, plan_revision_ref: exec.plan_revision_ref ?? null, plan_contract_sha256_ref: exec.plan_contract_sha256_ref ?? null, acknowledged_at: exec.acknowledged_at ?? null, blockers };
    });
    return { lifecycle_model: model, effective_gates: effectiveLifecycleGates(root, chain), lifecycle_warnings: (0, lifecycle_1.lifecycleWarnings)(chain), plans, execs, approval_blockers: [...plans.flatMap(p => p.blockers.map(b => 'PLAN ' + p.version + ': ' + b)), ...execs.flatMap(e => e.blockers.map(b => 'EXEC ' + e.version + ': ' + b))] };
}
//# sourceMappingURL=lifecycleView.js.map