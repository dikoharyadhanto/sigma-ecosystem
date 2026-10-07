"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveApprovalTarget = resolveApprovalTarget;
exports.approvalReview = approvalReview;
exports.ensureApprovalReady = ensureApprovalReady;
exports.approveArtifactTransactionFiles = approveArtifactTransactionFiles;
exports.approveArtifactUseCase = approveArtifactUseCase;
const fs_extra_1 = __importDefault(require("fs-extra"));
const chain_1 = require("../engine/chain");
const lifecycle_1 = require("../engine/lifecycle");
const revisions_1 = require("../engine/revisions");
const docCheck_1 = require("../utils/docCheck");
const planLockService_1 = require("./planLockService");
const execLockService_1 = require("./execLockService");
const controlStore_1 = require("../engine/controlStore");
function resolveApprovalTarget(chain, domain, explicit) {
    const resolution = (0, chain_1.resolveTargetVersion)(chain[domain].versions, explicit);
    if (resolution.kind === 'resolved')
        return resolution.version;
    if (resolution.kind === 'ambiguous') {
        const candidates = resolution.candidates.map(v => domain === 'exec' ? v + ' (plan ' + chain.exec.versions.find(e => e.version === v)?.plan_version_ref + ')' : v);
        throw new Error(resolution.candidates.length + ' DRAFT ' + (domain === 'plan' ? 'FMN-PLANs' : 'DEV-EXECs') + ' are open: ' + candidates.join(', ') + '; specify --v.');
    }
    throw new Error('No DRAFT ' + (domain === 'plan' ? 'FMN-PLAN' : 'DEV-EXEC') + ' to approve; imported baseline review requires explicit --v.');
}
function approvalReview(root, domain, explicit) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    (0, lifecycle_1.assertKnownLifecycle)(chain);
    const version = resolveApprovalTarget(chain, domain, explicit);
    const entry = chain[domain].versions.find(e => e.version === version);
    if (!entry)
        throw new Error('Approval target not found/registered: ' + version);
    const model = (0, lifecycle_1.resolveLifecycleModel)(chain);
    const file = (0, revisions_1.artifactFile)(root, chain, domain, version);
    const doc = fs_extra_1.default.readFileSync(file);
    const report = (0, docCheck_1.validateSigmaDocFile)(file, domain);
    const blockers = [];
    try {
        (0, docCheck_1.ensureSigmaDocEligible)(report, domain);
    }
    catch (e) {
        blockers.push(e.message);
    }
    const deltas = [];
    let source = null;
    let ledger = null;
    const dependencies = { target: (0, revisions_1.sha256)(doc) };
    if (model === 'paired_approval') {
        if (domain === 'plan' && (chain.plan.versions.filter(p => p.version === version).length !== 1 || entry.intent_version_ref !== chain.intent.version))
            blockers.push('PLAN identity must be unique and reference its owning INTENT.');
        try {
            source = (0, revisions_1.currentIntent)(root, chain);
            dependencies.intent = (0, revisions_1.sha256)(fs_extra_1.default.readFileSync((0, revisions_1.artifactFile)(root, chain, 'intent', chain.intent.version)));
        }
        catch (e) {
            blockers.push(e.message);
        }
        if (domain === 'plan') {
            if (!(entry.state === 'DRAFT' || entry.state === 'APPROVED' && !entry.revision && !!explicit))
                blockers.push('PLAN initial approval requires DRAFT; imported baseline requires explicit APPROVED target without revision.');
            if (entry.revision || entry.revision_ledger)
                blockers.push('Existing baseline cannot be replaced by initial approve.');
            try {
                (0, revisions_1.planContractHash)(doc.toString('utf8'));
            }
            catch (e) {
                blockers.push(e.message);
            }
        }
        else {
            const plans = chain.plan.versions.filter(p => p.version === version);
            if (chain.exec.versions.filter(e => e.version === version).length !== 1 || entry.state !== 'DRAFT' || entry.plan_version_ref !== version || plans.length !== 1 || plans[0].state !== 'APPROVED' || chain.exec.versions.filter(e => e.state !== 'SUPERSEDED' && e.plan_version_ref === version).length !== 1)
                blockers.push('Approval requires exactly one same-number DRAFT EXEC / APPROVED PLAN pair.');
            try {
                ledger = (0, revisions_1.assertPlanCertified)(root, chain, version);
                (0, revisions_1.assertAllNotices)(root, ledger);
                const plan = plans[0];
                dependencies.plan = (0, revisions_1.sha256)(fs_extra_1.default.readFileSync((0, revisions_1.artifactFile)(root, chain, 'plan', version)));
                dependencies.ledger = plan.revision_ledger_sha256;
                if (!entry.acknowledged_at || entry.plan_revision_ref !== plan.revision || entry.plan_contract_sha256_ref !== plan.contract_sha256)
                    blockers.push('STALE_PLAN: EXEC must explicitly acknowledge the latest PLAN revision.');
                for (let i = 1; i < ledger.records.length; i++) {
                    const previous = ledger.records[i - 1];
                    const record = ledger.records[i];
                    deltas.push({ revision: record.revision, declaration: record.declaration, authorization: record.authorization ?? null, notice: record.notice, delta: (0, revisions_1.contractDiff)(fs_extra_1.default.readFileSync((0, revisions_1.boundedPath)(root, previous.snapshot), 'utf8'), fs_extra_1.default.readFileSync((0, revisions_1.boundedPath)(root, record.snapshot), 'utf8')) });
                    dependencies['notice-' + record.revision] = record.notice.file_sha256;
                }
            }
            catch (e) {
                blockers.push(e.message);
            }
        }
    }
    else {
        if (entry.state !== 'DRAFT')
            blockers.push('Legacy approval requires DRAFT.');
        // Legacy approval still freezes every relevant available document; it does not invent certification.
        for (const [kind, targetVersion] of [['intent', chain.intent.version], ...(domain === 'exec' ? [['plan', entry.plan_version_ref]] : [])]) {
            try {
                const dependency = (0, revisions_1.artifactFile)(root, chain, kind, targetVersion);
                dependencies[kind] = fs_extra_1.default.existsSync(dependency) ? (0, revisions_1.sha256)(fs_extra_1.default.readFileSync(dependency)) : 'missing';
            }
            catch {
                dependencies[kind] = 'unavailable';
            }
        }
    }
    const effects = domain === 'plan' ? ['PLAN ' + version + ': ' + entry.state + ' -> ' + (model === 'paired_approval' ? 'APPROVED' : 'LOCKED'), 'Coding start still requires explicit Director authorization'] : ['EXEC ' + version + ': DRAFT -> LOCKED', ...(model === 'paired_approval' ? ['PLAN ' + version + ': APPROVED -> LOCKED; pair committed together'] : [])];
    const review = { chain: chainVersion, lifecycle_model: model, domain, version, target_sha256: (0, revisions_1.sha256)(doc), source, plan_revision: domain === 'plan' ? 1 : chain.plan.versions.find(p => p.version === version)?.revision, acknowledgement: domain === 'exec' ? { revision: entry.plan_revision_ref, hash: entry.plan_contract_sha256_ref, at: entry.acknowledged_at } : null, deltas, blockers, document_valid: report.ok, document_requirements: report.requirements, advisory_document: doc.toString('utf8'), effects, legacy_evidence_limit: model === 'legacy_lock' ? 'No revision baseline certification required' : null };
    return { ...review, dependencies_sha256: (0, revisions_1.sha256)(JSON.stringify({ chain, dependencies, review })) };
}
function ensureApprovalReady(review) {
    if (review.blockers.length)
        throw new Error('Approval blocked:\n' + review.blockers.map(b => ' - ' + b).join('\n'));
}
function approveArtifactTransactionFiles(root, domain, explicit) {
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    const version = resolveApprovalTarget(chain, domain, explicit);
    return (0, lifecycle_1.resolveLifecycleModel)(chain) === 'paired_approval' && domain === 'plan' ? (0, revisions_1.revisionTransactionFiles)(root, version) : [(0, chain_1.chainFilePath)(root, chainVersion), ...((0, lifecycle_1.resolveLifecycleModel)(chain) === 'paired_approval' && domain === 'exec' ? [(0, revisions_1.boundedPath)(root, (0, revisions_1.revisionPaths)(version).ledger)] : []), ...(0, revisions_1.roadmapTransactionFiles)(root, chain)];
}
function approveArtifactUseCase(root, domain, explicit, receipt = { channel: 'cli' }) {
    const review = approvalReview(root, domain, explicit);
    ensureApprovalReady(review);
    const { chainVersion, data: chain } = (0, chain_1.readActiveChain)(root);
    (0, chain_1.assertChainCanMutate)(chain);
    const entry = chain[domain].versions.find(e => e.version === review.version);
    if ((0, lifecycle_1.resolveLifecycleModel)(chain) === 'legacy_lock') {
        const result = domain === 'plan' ? (0, planLockService_1.lockPlanDraftUseCase)(root, review.version) : (0, execLockService_1.lockExecDraftUseCase)(root, review.version);
        const latest = (0, chain_1.readActiveChain)(root).data;
        const approved = latest[domain].versions.find(e => e.version === review.version);
        approved.approved_at = new Date().toISOString();
        approved.approval_receipt = { ...receipt, approved_at: approved.approved_at };
        (0, revisions_1.renderGovernanceRoadmap)(root, latest);
        (0, chain_1.writeChain)(root, chainVersion, latest);
        return { ...result, lifecycle_model: 'legacy_lock', state: 'LOCKED' };
    }
    const now = new Date().toISOString();
    if (domain === 'plan') {
        (0, revisions_1.certifyPlanBaseline)(root, chain, review.version, review.target_sha256, review.source?.hash);
        entry.state = 'APPROVED';
    }
    else {
        (0, revisions_1.approveLedgerWithExec)(root, chain, review.version, now);
        const plan = chain.plan.versions.find(p => p.version === review.version);
        plan.state = 'LOCKED';
        plan.locked_at = now;
        plan.updated_at = now;
        entry.state = 'LOCKED';
        entry.locked_at = now;
        if (chain.plan.active_version === plan.version)
            chain.plan.active_state = 'LOCKED';
    }
    entry.approved_at = now;
    entry.updated_at = now;
    entry.approval_receipt = { ...receipt, approved_at: now };
    chain[domain].active_version = review.version;
    chain[domain].active_state = entry.state;
    chain.gates.gate_2_open = (0, chain_1.hasCleanGate2Chain)(chain);
    chain.gates.gate_3_satisfied = (0, chain_1.hasCleanGate3Chain)(chain);
    // Compare editor-visible source bytes again immediately before committing the tracker.
    if ((0, revisions_1.sha256)(fs_extra_1.default.readFileSync((0, revisions_1.artifactFile)(root, chain, domain, review.version))) !== review.target_sha256)
        throw new Error('Approval target changed during transaction.');
    if (domain === 'exec')
        (0, revisions_1.assertPlanCertified)(root, chain, review.version);
    (0, revisions_1.currentIntent)(root, chain);
    (0, revisions_1.renderGovernanceRoadmap)(root, chain);
    (0, controlStore_1.controlTestFailpoint)('approval_after_roadmap');
    (0, chain_1.writeChain)(root, chainVersion, chain);
    (0, controlStore_1.controlTestFailpoint)('approval_after_chain');
    return { chainVersion, version: review.version, lifecycle_model: 'paired_approval', state: entry.state, revision: entry.revision, gate3Satisfied: chain.gates.gate_3_satisfied };
}
//# sourceMappingURL=approvalService.js.map