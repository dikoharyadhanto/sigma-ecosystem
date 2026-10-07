import fs from 'fs-extra';
import { readActiveChain, ChainState, resolveTargetVersion, assertChainCanMutate, writeChain, chainFilePath, hasCleanGate2Chain, hasCleanGate3Chain } from '../engine/chain';
import { assertKnownLifecycle, resolveLifecycleModel } from '../engine/lifecycle';
import { sha256, planContractHash, artifactFile, revisionPaths, boundedPath, currentIntent, assertPlanCertified, assertAllNotices, certifyPlanBaseline, revisionTransactionFiles, renderGovernanceRoadmap, roadmapTransactionFiles, contractDiff, approveLedgerWithExec } from '../engine/revisions';
import { validateSigmaDocFile, ensureSigmaDocEligible } from '../utils/docCheck';
import { lockPlanDraftUseCase } from './planLockService';
import { lockExecDraftUseCase } from './execLockService';
import { controlTestFailpoint } from '../engine/controlStore';
export type ApprovalDomain = 'plan' | 'exec';
export function resolveApprovalTarget(chain: ChainState, domain: ApprovalDomain, explicit?: string): string {
    const resolution = resolveTargetVersion(chain[domain].versions, explicit);
    if (resolution.kind === 'resolved')
        return resolution.version;
    if (resolution.kind === 'ambiguous') {
        const candidates = resolution.candidates.map(v => domain === 'exec' ? v + ' (plan ' + chain.exec.versions.find(e => e.version === v)?.plan_version_ref + ')' : v);
        throw new Error(resolution.candidates.length + ' DRAFT ' + (domain === 'plan' ? 'FMN-PLANs' : 'DEV-EXECs') + ' are open: ' + candidates.join(', ') + '; specify --v.');
    }
    throw new Error('No DRAFT ' + (domain === 'plan' ? 'FMN-PLAN' : 'DEV-EXEC') + ' to approve; imported baseline review requires explicit --v.');
}
export function approvalReview(root: string, domain: ApprovalDomain, explicit?: string) {
    const { chainVersion, data: chain } = readActiveChain(root);
    assertKnownLifecycle(chain);
    const version = resolveApprovalTarget(chain, domain, explicit);
    const entry = chain[domain].versions.find(e => e.version === version);
    if (!entry)
        throw new Error('Approval target not found/registered: ' + version);
    const model = resolveLifecycleModel(chain);
    const file = artifactFile(root, chain, domain, version);
    const doc = fs.readFileSync(file);
    const report = validateSigmaDocFile(file, domain);
    const blockers: string[] = [];
    try {
        ensureSigmaDocEligible(report, domain);
    }
    catch (e) {
        blockers.push((e as Error).message);
    }
    const deltas: any[] = [];
    let source: any = null;
    let ledger: any = null;
    const dependencies: Record<string, string> = { target: sha256(doc) };
    if (model === 'paired_approval') {
        if(domain==='plan'&&(chain.plan.versions.filter(p=>p.version===version).length!==1||entry.intent_version_ref!==chain.intent.version))blockers.push('PLAN identity must be unique and reference its owning INTENT.');
        try {
            source = currentIntent(root, chain);
            dependencies.intent = sha256(fs.readFileSync(artifactFile(root, chain, 'intent', chain.intent.version)));
        }
        catch (e) {
            blockers.push((e as Error).message);
        }
        if (domain === 'plan') {
            if (!(entry.state === 'DRAFT' || entry.state === 'APPROVED' && !entry.revision && !!explicit))
                blockers.push('PLAN initial approval requires DRAFT; imported baseline requires explicit APPROVED target without revision.');
            if (entry.revision || entry.revision_ledger)
                blockers.push('Existing baseline cannot be replaced by initial approve.');
            try {
                planContractHash(doc.toString('utf8'));
            }
            catch (e) {
                blockers.push((e as Error).message);
            }
        }
        else {
            const plans = chain.plan.versions.filter(p => p.version === version);
            if (chain.exec.versions.filter(e=>e.version===version).length!==1 || entry.state !== 'DRAFT' || entry.plan_version_ref !== version || plans.length !== 1 || plans[0].state !== 'APPROVED' || chain.exec.versions.filter(e => e.state !== 'SUPERSEDED' && e.plan_version_ref === version).length !== 1)
                blockers.push('Approval requires exactly one same-number DRAFT EXEC / APPROVED PLAN pair.');
            try {
                ledger = assertPlanCertified(root, chain, version);
                assertAllNotices(root, ledger);
                const plan = plans[0];
                dependencies.plan = sha256(fs.readFileSync(artifactFile(root, chain, 'plan', version)));
                dependencies.ledger = plan.revision_ledger_sha256!;
                if (!entry.acknowledged_at || entry.plan_revision_ref !== plan.revision || entry.plan_contract_sha256_ref !== plan.contract_sha256)
                    blockers.push('STALE_PLAN: EXEC must explicitly acknowledge the latest PLAN revision.');
                for (let i = 1; i < ledger.records.length; i++) {
                    const previous = ledger.records[i - 1];
                    const record = ledger.records[i];
                    deltas.push({ revision: record.revision, declaration: record.declaration, authorization: record.authorization ?? null, notice: record.notice, delta: contractDiff(fs.readFileSync(boundedPath(root, previous.snapshot), 'utf8'), fs.readFileSync(boundedPath(root, record.snapshot), 'utf8')) });
                    dependencies['notice-' + record.revision] = record.notice.file_sha256;
                }
            }
            catch (e) {
                blockers.push((e as Error).message);
            }
        }
    }
    else {
        if (entry.state !== 'DRAFT')
            blockers.push('Legacy approval requires DRAFT.');
        // Legacy approval still freezes every relevant available document; it does not invent certification.
        for (const [kind, targetVersion] of [['intent', chain.intent.version], ...(domain === 'exec' ? [['plan', entry.plan_version_ref!]] : [])] as Array<[
            'intent' | 'plan',
            string
        ]>) {
            try {
                const dependency = artifactFile(root, chain, kind, targetVersion);
                dependencies[kind] = fs.existsSync(dependency) ? sha256(fs.readFileSync(dependency)) : 'missing';
            }
            catch {
                dependencies[kind] = 'unavailable';
            }
        }
    }
    const effects = domain === 'plan' ? ['PLAN ' + version + ': ' + entry.state + ' -> ' + (model === 'paired_approval' ? 'APPROVED' : 'LOCKED'), 'Coding start still requires explicit Director authorization'] : ['EXEC ' + version + ': DRAFT -> LOCKED', ...(model === 'paired_approval' ? ['PLAN ' + version + ': APPROVED -> LOCKED; pair committed together'] : [])];
    const review = { chain: chainVersion, lifecycle_model: model, domain, version, target_sha256: sha256(doc), source, plan_revision: domain === 'plan' ? 1 : chain.plan.versions.find(p => p.version === version)?.revision, acknowledgement: domain === 'exec' ? { revision: entry.plan_revision_ref, hash: entry.plan_contract_sha256_ref, at: entry.acknowledged_at } : null, deltas, blockers, document_valid: report.ok, document_requirements: report.requirements, advisory_document: doc.toString('utf8'), effects, legacy_evidence_limit: model === 'legacy_lock' ? 'No revision baseline certification required' : null };
    return { ...review, dependencies_sha256: sha256(JSON.stringify({ chain, dependencies, review })) };
}
export function ensureApprovalReady(review: ReturnType<typeof approvalReview>): void { if (review.blockers.length)
    throw new Error('Approval blocked:\n' + review.blockers.map(b => ' - ' + b).join('\n')); }
export function approveArtifactTransactionFiles(root: string, domain: ApprovalDomain, explicit?: string): string[] {
    const { chainVersion, data: chain } = readActiveChain(root);
    const version = resolveApprovalTarget(chain, domain, explicit);
    return resolveLifecycleModel(chain) === 'paired_approval' && domain === 'plan' ? revisionTransactionFiles(root, version) : [chainFilePath(root, chainVersion), ...(resolveLifecycleModel(chain) === 'paired_approval' && domain === 'exec' ? [boundedPath(root, revisionPaths(version).ledger)] : []), ...roadmapTransactionFiles(root, chain)];
}
export function approveArtifactUseCase(root: string, domain: ApprovalDomain, explicit?: string, receipt: {
    channel: string;
    ticket_id?: string;
    approval_id?: string;
} = { channel: 'cli' }) {
    const review = approvalReview(root, domain, explicit);
    ensureApprovalReady(review);
    const { chainVersion, data: chain } = readActiveChain(root);
    assertChainCanMutate(chain);
    const entry = chain[domain].versions.find(e => e.version === review.version)!;
    if (resolveLifecycleModel(chain) === 'legacy_lock') {
        const result = domain === 'plan' ? lockPlanDraftUseCase(root, review.version) : lockExecDraftUseCase(root, review.version);
        const latest = readActiveChain(root).data;
        const approved = latest[domain].versions.find(e => e.version === review.version)!;
        approved.approved_at = new Date().toISOString();
        approved.approval_receipt = { ...receipt, approved_at: approved.approved_at };
        renderGovernanceRoadmap(root, latest);
        writeChain(root, chainVersion, latest);
        return { ...result, lifecycle_model: 'legacy_lock', state: 'LOCKED' };
    }
    const now = new Date().toISOString();
    if (domain === 'plan') {
        certifyPlanBaseline(root, chain, review.version, review.target_sha256, review.source?.hash);
        entry.state = 'APPROVED';
    }
    else {
        approveLedgerWithExec(root, chain, review.version, now);
        const plan = chain.plan.versions.find(p => p.version === review.version)!;
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
    chain.gates.gate_2_open = hasCleanGate2Chain(chain);
    chain.gates.gate_3_satisfied = hasCleanGate3Chain(chain);
    // Compare editor-visible source bytes again immediately before committing the tracker.
    if (sha256(fs.readFileSync(artifactFile(root, chain, domain, review.version))) !== review.target_sha256)
        throw new Error('Approval target changed during transaction.');
    if (domain === 'exec')
        assertPlanCertified(root, chain, review.version);
    currentIntent(root, chain);
    renderGovernanceRoadmap(root, chain);
    controlTestFailpoint('approval_after_roadmap');
    writeChain(root, chainVersion, chain);
    controlTestFailpoint('approval_after_chain');
    return { chainVersion, version: review.version, lifecycle_model: 'paired_approval', state: entry.state, revision: entry.revision, gate3Satisfied: chain.gates.gate_3_satisfied };
}
